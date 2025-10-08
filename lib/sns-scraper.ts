import axios from 'axios';
import * as cheerio from 'cheerio';
import { supabaseAdmin } from './supabase-admin';
import { fetchTweetFullText, normalizeTweetText } from './twitter-text';

export interface SNSPost {
  platform: string;
  postId?: string;
  title?: string;
  content?: string;
  thumbnailUrl?: string;
  url: string;
  publishedAt: Date;
}

export interface SNSSetting {
  id: string;
  platform: string;
  account_name: string;
  account_url: string;
  rss_url?: string;
  scraping_url?: string;
  is_active: boolean;
}

export class SNSScraper {
  private normalizePlatformForPosts(platform: string): string {
    const p = (platform || '').toLowerCase();
    if (p === 'x' || p === 'twitter') return 'twitter';
    if (p === 'x2') return 'twitter2';
    if (p === 'youtube') return 'youtube';
    if (p === 'iceage') return 'iceage';
    return p;
  }

  // 都道府県支部: 有効なすべてのSNS設定をスクレイピング
  async scrapeAllActivePrefecturalSNS(): Promise<{ success: boolean; message: string; count?: number }> {
    try {
      const { data: settings } = await supabaseAdmin
        .from('prefectural_sns_settings')
        .select('*')
        .eq('is_active', true);

      if (!settings || settings.length === 0) {
        return {
          success: false,
          message: '有効な都道府県支部SNS設定が見つかりません'
        };
      }

      let totalCount = 0;
      const results: string[] = [];

      for (const setting of settings as any[]) {
        try {
          const posts = await (async () => {
            if (this.isTwitterPlatform(setting.platform) && setting.rss_url) {
              return await this.scrapeTwitterRSS(setting, setting.platform);
            }
            if (this.isYouTubePlatform(setting.platform)) {
              if (setting.rss_url) return await this.scrapeYouTubeRSS(setting, setting.platform);
              if (setting.scraping_url) {
                const url = setting.scraping_url as string;
                const qMatch = url.match(/[?&]channel_id=([^&]+)/);
                const pathMatch = url.match(/\/channel\/([^/?#]+)/);
                const channelId = (qMatch && qMatch[1]) || (pathMatch && pathMatch[1]) || '';
                if (channelId) {
                  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
                  return await this.scrapeYouTubeRSS(setting, setting.platform, feedUrl);
                }
                return await this.scrapeYouTube(setting);
              }
            }
            return [] as SNSPost[];
          })();

          const saved = await this.savePrefecturalSNSPosts(posts, setting);
          totalCount += saved;
          results.push(`${setting.prefecture}/${setting.platform}: ${saved}件`);
        } catch (error) {
          console.error(`Error scraping prefectural ${setting.platform}:`, error);
          results.push(`${setting.prefecture}/${setting.platform}: エラー`);
        }
      }

      return {
        success: true,
        message: `都道府県支部SNS投稿 ${totalCount}件を取得しました (${results.join(', ')})`,
        count: totalCount
      };
    } catch (error) {
      console.error('Error in scrapeAllActivePrefecturalSNS:', error);
      return {
        success: false,
        message: `都道府県支部SNS取得中にエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private isTwitterPlatform(platform: string): boolean {
    const p = (platform || '').toLowerCase();
    return p === 'twitter' || p === 'x' || p === 'x2';
  }

  private isYouTubePlatform(platform: string): boolean {
    const p = (platform || '').toLowerCase();
    return p === 'youtube' || p === 'iceage';
  }
  
  async scrapeAllActiveSNS(): Promise<{ success: boolean; message: string; count?: number }> {
    try {
      const { data: settings } = await supabaseAdmin
        .from('official_sns_settings')
        .select('*')
        .eq('is_active', true);

      if (!settings || settings.length === 0) {
        return {
          success: false,
          message: '有効なSNS設定が見つかりません'
        };
      }

      let totalCount = 0;
      const results: string[] = [];

      for (const setting of settings) {
        try {
          const result = await this.scrapeSNSAccount(setting);
          if (result.success) {
            totalCount += result.count || 0;
            results.push(`${setting.platform}: ${result.count}件`);
          } else {
            results.push(`${setting.platform}: エラー - ${result.message}`);
          }
        } catch (error) {
          console.error(`Error scraping ${setting.platform}:`, error);
          results.push(`${setting.platform}: エラー`);
        }
      }

      return {
        success: true,
        message: `公式SNS投稿 ${totalCount}件を取得しました (${results.join(', ')})`,
        count: totalCount
      };
    } catch (error) {
      console.error('Error in scrapeAllActiveSNS:', error);
      return {
        success: false,
        message: `公式SNS取得中にエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async scrapeSNSAccount(setting: SNSSetting): Promise<{ success: boolean; message: string; count?: number }> {
    try {
      let posts: SNSPost[] = [];

      if (this.isTwitterPlatform(setting.platform) && setting.rss_url) {
        posts = await this.scrapeTwitterRSS(setting, setting.platform);
      } else if (this.isYouTubePlatform(setting.platform)) {
        // YouTube: rss_url を優先。無ければ scraping_url から channel_id 等を抽出してRSSへフォールバック
        if (setting.rss_url) {
          posts = await this.scrapeYouTubeRSS(setting, setting.platform);
        } else if (setting.scraping_url) {
          const url = setting.scraping_url;
          // 1) ?channel_id=UCxxxx を抽出
          const qMatch = url.match(/[?&]channel_id=([^&]+)/);
          // 2) /channel/UCxxxx パスから抽出
          const pathMatch = url.match(/\/channel\/([^/?#]+)/);
          const channelId = (qMatch && qMatch[1]) || (pathMatch && pathMatch[1]) || '';
          if (channelId) {
            const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
            posts = await this.scrapeYouTubeRSS(setting, setting.platform, feedUrl);
          } else {
            // 最後の手段としてHTMLスクレイピング（成功率低）
            posts = await this.scrapeYouTube(setting);
          }
        } else {
          return {
            success: false,
            message: `${setting.platform}の設定が不完全です`,
          };
        }
      } else {
        return {
          success: false,
          message: `${setting.platform}の設定が不完全です`
        };
      }

      await this.saveSNSPosts(posts, setting);

      return {
        success: true,
        message: `${setting.account_name}から${posts.length}件の投稿を取得しました`,
        count: posts.length
      };
    } catch (error) {
      console.error(`Error scraping ${setting.platform}:`, error);
      return {
        success: false,
        message: `${setting.account_name}の取得中にエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // YouTube公式RSSの簡易パーサ
  private async scrapeYouTubeRSS(setting: SNSSetting, platformKey: string, feedUrl?: string): Promise<SNSPost[]> {
    const targetUrl = feedUrl || setting.rss_url;
    if (!targetUrl) return [];

    

    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 15000
    });

    const rssText = response.data as string;
    const posts: SNSPost[] = [];

    // itemを抽出
    const itemMatches = rssText.match(/<entry[\s\S]*?<\/entry>/g) || rssText.match(/<item[\s\S]*?<\/item>/g) || [];

    for (const item of itemMatches.slice(0, 20)) {
      try {
        // YouTube公式RSS(Atom)の典型
        const idMatch = item.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || item.match(/<id>.*?video:([^<]+)<\/id>/);
        const titleMatch = item.match(/<title(?:[^>]*)>([\s\S]*?)<\/title>/);
        const linkMatch = item.match(/<link[^>]*href="([^"]+)"[^>]*\/>/) || item.match(/<link>([^<]+)<\/link>/);
        const publishedMatch = item.match(/<published>([^<]+)<\/published>/) || item.match(/<pubDate>([^<]+)<\/pubDate>/);
        // 説明文は取得しない（UI/保存しない方針）

        const videoId = idMatch ? idMatch[1] : undefined;
        const url = linkMatch ? linkMatch[1] : (videoId ? `https://www.youtube.com/watch?v=${videoId}` : '');
        const titleRaw = titleMatch ? titleMatch[1] : '';
        const publishedRaw = publishedMatch ? publishedMatch[1] : '';

        if (!url) continue;

        const strip = (t: string) => t.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
        const title = strip(titleRaw).trim();

        let publishedAt = new Date();
        if (publishedRaw) {
          const d = new Date(publishedRaw);
          if (!isNaN(d.getTime())) publishedAt = d;
        }

        posts.push({
          platform: this.normalizePlatformForPosts(platformKey),
          postId: videoId,
          title: title,
          // 説明文は保存しない
          content: undefined,
          // サムネイルは videoId から生成
          thumbnailUrl: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined,
          url,
          publishedAt,
        });
      } catch (e) {
        console.error('Error parsing YouTube RSS entry:', e);
      }
    }

    
    return posts;
  }

  private async scrapeTwitterRSS(setting: SNSSetting, platformKey: string): Promise<SNSPost[]> {
    if (!setting.rss_url) return [];

    
    
    const response = await axios.get(setting.rss_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 15000
    });

    const posts: SNSPost[] = [];
    const rssText = response.data;

    // 簡易RSS解析
    const itemMatches = rssText.match(/<item>([\s\S]*?)<\/item>/g) || [];

    for (const itemMatch of itemMatches.slice(0, 20)) {
      try {
        const titleMatch = itemMatch.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || itemMatch.match(/<title>(.*?)<\/title>/);
        const linkMatch = itemMatch.match(/<link>(.*?)<\/link>/);
        const pubDateMatch = itemMatch.match(/<pubDate>(.*?)<\/pubDate>/);

        if (titleMatch && linkMatch) {
          let title = titleMatch[1] || '';
          const link = linkMatch[1] || '';
          const pubDate = pubDateMatch ? pubDateMatch[1] : '';
          
          // Twitter投稿IDを抽出
          const tweetIdMatch = link.match(/status\/(\d+)/);
          const postId = tweetIdMatch ? tweetIdMatch[1] : undefined;

          // 公開日をパース
          let publishedAt = new Date();
          if (pubDate) {
            publishedAt = new Date(pubDate);
          }

          // サムネイル抽出
          // 1) <media:content url="..."> or <media:thumbnail url="...">
          let thumbnailUrl: string | undefined;
          const mediaUrlMatch = itemMatch.match(/<media:(?:content|thumbnail)[^>]*url="([^"]+)"/i)
            || itemMatch.match(/<media:(?:content|thumbnail)[^>]*url='([^']+)'/i);
          if (mediaUrlMatch && mediaUrlMatch[1]) {
            thumbnailUrl = mediaUrlMatch[1];
          }
          // 2) <enclosure url="..." type="image/..." />（単/二重引用の両方に対応）
          if (!thumbnailUrl) {
            const enclosureMatch = itemMatch.match(/<enclosure[^>]*url="([^"]+)"[^>]*type="image\/(?:jpeg|jpg|png|gif)"[^>]*\/>/i)
              || itemMatch.match(/<enclosure[^>]*type="image\/(?:jpeg|jpg|png|gif)"[^>]*url="([^"]+)"[^>]*\/>/i)
              || itemMatch.match(/<enclosure[^>]*url='([^']+)'[^>]*type='image\/(?:jpeg|jpg|png|gif)'[^>]*\/>/i)
              || itemMatch.match(/<enclosure[^>]*type='image\/(?:jpeg|jpg|png|gif)'[^>]*url='([^']+)'[^>]*\/>/i);
            if (enclosureMatch && enclosureMatch[1]) {
              thumbnailUrl = enclosureMatch[1];
            }
          }
          // 3) <img src="..."> or data-src / srcset in description/content
          if (!thumbnailUrl) {
            const imgMatch = itemMatch.match(/<img[^>]*src="([^"]+)"/i)
              || itemMatch.match(/<img[^>]*src='([^']+)'/i)
              || itemMatch.match(/<img[^>]*data-src="([^"]+)"/i)
              || itemMatch.match(/<img[^>]*data-src='([^']+)'/i);
            if (imgMatch && imgMatch[1]) {
              thumbnailUrl = imgMatch[1];
            }
          }
          // 4) srcset の先頭URL
          if (!thumbnailUrl) {
            const srcsetMatch = itemMatch.match(/<img[^>]*srcset="([^"]+)"/i) || itemMatch.match(/<img[^>]*srcset='([^']+)'/i);
            if (srcsetMatch && srcsetMatch[1]) {
              const first = srcsetMatch[1].split(',')[0]?.trim().split(' ')[0];
              if (first) thumbnailUrl = first;
            }
          }

          // RSSの省略を公式シンジケーションJSONで補完
          if (postId) {
            const full = await fetchTweetFullText(postId);
            if (full) title = full;
          }
          title = normalizeTweetText(title);

          posts.push({
            platform: this.normalizePlatformForPosts(platformKey),
            postId,
            title: title,
            // 説明文は保存しない
            content: undefined,
            thumbnailUrl,
            url: link,
            publishedAt
          });
        }
      } catch (error) {
        console.error('Error parsing Twitter RSS item:', error);
      }
    }

    
    return posts;
  }

  private async scrapeYouTube(setting: SNSSetting): Promise<SNSPost[]> {
    if (!setting.scraping_url) return [];

    
    
    const response = await axios.get(setting.scraping_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    const posts: SNSPost[] = [];

    // YouTubeの動画リストを取得
    // 実際のYouTubeページの構造に応じて調整が必要
    const videoSelectors = [
      'a[href*="/watch?v="]',
      '#contents ytd-video-renderer a',
      '.ytd-rich-item-renderer a[href*="/watch"]'
    ];

    const seenUrls = new Set<string>();

    for (const selector of videoSelectors) {
      $(selector).each((_, element) => {
        const $link = $(element);
        const href = $link.attr('href');
        
        if (!href) return;

        let fullUrl = href;
        if (href.startsWith('/watch')) {
          fullUrl = `https://www.youtube.com${href}`;
        }

        // 重複チェック
        if (seenUrls.has(fullUrl)) return;
        seenUrls.add(fullUrl);

        // 動画IDを抽出
        const videoIdMatch = fullUrl.match(/[?&]v=([^&]+)/);
        const postId = videoIdMatch ? videoIdMatch[1] : undefined;

        if (!postId) return;

        // タイトルを取得
        let title = $link.attr('title') || $link.text().trim();
        if (!title) {
          // 親要素からタイトルを探す
          const $parent = $link.closest('ytd-video-renderer, .ytd-rich-item-renderer, .video-item');
          title = $parent.find('#video-title, .video-title, h3').first().text().trim();
        }

        if (!title || title.length < 5) return;

        const $parent = $link.closest('ytd-video-renderer, .ytd-rich-item-renderer');

        // 公開日を取得（可能であれば）
        let publishedAt = new Date();
        const dateText = $parent.find('#metadata-line, .metadata-line, .published-time').first().text().trim();
        if (dateText) {
          // 日本語の相対時間を解析（例：「1日前」「1週間前」）
          const timeMatch = dateText.match(/(\d+)(日|週間|か月|年)前/);
          if (timeMatch) {
            const [, num, unit] = timeMatch;
            const amount = parseInt(num);
            const now = new Date();
            
            switch (unit) {
              case '日':
                publishedAt = new Date(now.getTime() - amount * 24 * 60 * 60 * 1000);
                break;
              case '週間':
                publishedAt = new Date(now.getTime() - amount * 7 * 24 * 60 * 60 * 1000);
                break;
              case 'か月':
                publishedAt = new Date(now.getTime() - amount * 30 * 24 * 60 * 60 * 1000);
                break;
              case '年':
                publishedAt = new Date(now.getTime() - amount * 365 * 24 * 60 * 60 * 1000);
                break;
            }
          }
        }

        posts.push({
          platform: this.normalizePlatformForPosts(setting.platform),
          postId,
          title: title,
          // 説明文は保存しない
          content: undefined,
          thumbnailUrl: postId ? `https://i.ytimg.com/vi/${postId}/hqdefault.jpg` : undefined,
          url: fullUrl,
          publishedAt
        });
      });
    }

    
    return posts;
  }

  private async saveSNSPosts(posts: SNSPost[], setting: SNSSetting): Promise<void> {
    

    for (const post of posts) {
      try {
        // 重複チェック
        let existingPost = null;
        if (post.postId) {
          const { data } = await supabaseAdmin
            .from('official_sns_posts')
            .select('id')
            .eq('platform', post.platform)
            .eq('post_id', post.postId)
            .single();
          existingPost = data;
        } else {
          // postIdがない場合はURLで重複チェック
          const { data } = await supabaseAdmin
            .from('official_sns_posts')
            .select('id')
            .eq('url', post.url)
            .single();
          existingPost = data;
        }

        if (existingPost) {
          
          continue;
        }

        

        const { data, error } = await supabaseAdmin
          .from('official_sns_posts')
          .insert({
            sns_setting_id: setting.id,
            platform: post.platform,
            post_id: post.postId,
            title: post.title,
            url: post.url,
            published_at: post.publishedAt.toISOString(),
            thumbnail_url: post.thumbnailUrl || (post.platform === 'youtube' && post.postId ? `https://i.ytimg.com/vi/${post.postId}/hqdefault.jpg` : null)
          })
          .select();

        if (error) {
          console.error('Error saving SNS post:', error);
        } else {
          
        }
      } catch (error) {
        console.error('Error saving SNS post:', error);
      }
    }
  }

  // 都道府県支部: 投稿保存
  private async savePrefecturalSNSPosts(posts: SNSPost[], setting: any): Promise<number> {
    let savedCount = 0;
    for (const post of posts) {
      try {
        // 重複チェック（post_id または URL）
        let existingPost = null as any;
        if (post.postId) {
          const { data } = await supabaseAdmin
            .from('prefectural_sns_posts')
            .select('id')
            .eq('platform', post.platform)
            .eq('post_id', post.postId)
            .single();
          existingPost = data;
        } else {
          const { data } = await supabaseAdmin
            .from('prefectural_sns_posts')
            .select('id')
            .eq('url', post.url)
            .single();
          existingPost = data;
        }

        if (existingPost) {
          continue;
        }

        const { error } = await supabaseAdmin
          .from('prefectural_sns_posts')
          .insert({
            sns_setting_id: setting.id,
            prefecture: setting.prefecture,
            platform: post.platform,
            post_id: post.postId,
            title: post.title,
            url: post.url,
            published_at: post.publishedAt.toISOString(),
            thumbnail_url: post.thumbnailUrl || (post.platform === 'youtube' && post.postId ? `https://i.ytimg.com/vi/${post.postId}/hqdefault.jpg` : null)
          });

        if (!error) savedCount += 1;
      } catch (error) {
        console.error('Error saving prefectural SNS post:', error);
      }
    }
    return savedCount;
  }

  // SNS設定の管理メソッド
  async getSNSSettings(): Promise<SNSSetting[]> {
    const { data, error } = await supabaseAdmin
      .from('official_sns_settings')
      .select('*')
      .order('platform');

    if (error) {
      console.error('Error fetching SNS settings:', error);
      return [];
    }

    return data || [];
  }

  async createSNSSetting(setting: Omit<SNSSetting, 'id'>): Promise<{ success: boolean; message: string; data?: SNSSetting }> {
    try {
      const { data, error } = await supabaseAdmin
        .from('official_sns_settings')
        .insert(setting)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          message: `設定の作成に失敗しました: ${error.message}`
        };
      }

      return {
        success: true,
        message: 'SNS設定を作成しました',
        data
      };
    } catch (error) {
      return {
        success: false,
        message: `設定の作成中にエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async updateSNSSetting(id: string, updates: Partial<SNSSetting>): Promise<{ success: boolean; message: string; data?: SNSSetting }> {
    try {
      const { data, error } = await supabaseAdmin
        .from('official_sns_settings')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return {
          success: false,
          message: `設定の更新に失敗しました: ${error.message}`
        };
      }

      return {
        success: true,
        message: 'SNS設定を更新しました',
        data
      };
    } catch (error) {
      return {
        success: false,
        message: `設定の更新中にエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async deleteSNSSetting(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabaseAdmin
        .from('official_sns_settings')
        .delete()
        .eq('id', id);

      if (error) {
        return {
          success: false,
          message: `設定の削除に失敗しました: ${error.message}`
        };
      }

      return {
        success: true,
        message: 'SNS設定を削除しました'
      };
    } catch (error) {
      return {
        success: false,
        message: `設定の削除中にエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // 都道府県支部: 設定取得
  async getPrefSNSSettings(): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('prefectural_sns_settings')
      .select('*')
      .order('prefecture')
      .order('platform');
    if (error) {
      console.error('Error fetching prefectural SNS settings:', error);
      return [];
    }
    return data || [];
  }

  async createPrefSNSSetting(setting: { prefecture: string; platform: string; account_url: string; rss_url?: string; scraping_url?: string; is_active?: boolean; }): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      // account_name はDB定義上 NOT NULL のため、URLから簡易に生成
      const derivedName = (() => {
        try {
          const u = new URL(setting.account_url);
          const path = u.pathname.replace(/\/$/, '');
          return path.split('/').filter(Boolean).pop() || u.hostname;
        } catch {
          return setting.account_url;
        }
      })();
      const { data, error } = await supabaseAdmin
        .from('prefectural_sns_settings')
        .insert({ ...setting, account_name: derivedName })
        .select()
        .single();
      if (error) return { success: false, message: `設定の作成に失敗しました: ${error.message}` };
      return { success: true, message: 'SNS設定を作成しました', data };
    } catch (error) {
      return { success: false, message: `設定の作成中にエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  async updatePrefSNSSetting(id: string, updates: Partial<{ prefecture: string; platform: string; account_url: string; rss_url?: string; scraping_url?: string; is_active?: boolean; }>): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      // account_url 更新時には account_name も自動更新
      const next: any = { ...updates, updated_at: new Date().toISOString() };
      if (updates.account_url) {
        try {
          const u = new URL(updates.account_url);
          const path = u.pathname.replace(/\/$/, '');
          next.account_name = path.split('/').filter(Boolean).pop() || u.hostname;
        } catch {
          next.account_name = updates.account_url;
        }
      }
      const { data, error } = await supabaseAdmin
        .from('prefectural_sns_settings')
        .update(next)
        .eq('id', id)
        .select()
        .single();
      if (error) return { success: false, message: `設定の更新に失敗しました: ${error.message}` };
      return { success: true, message: 'SNS設定を更新しました', data };
    } catch (error) {
      return { success: false, message: `設定の更新中にエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  async deletePrefSNSSetting(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabaseAdmin
        .from('prefectural_sns_settings')
        .delete()
        .eq('id', id);
      if (error) return { success: false, message: `設定の削除に失敗しました: ${error.message}` };
      return { success: true, message: 'SNS設定を削除しました' };
    } catch (error) {
      return { success: false, message: `設定の削除中にエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }
}