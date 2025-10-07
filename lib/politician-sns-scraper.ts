import axios from 'axios';
import * as cheerio from 'cheerio';
import { supabaseAdmin } from './supabase-admin';
import { fetchTweetFullText, normalizeTweetText } from './twitter-text';

export interface PoliticianSNSAccount {
  id: string;
  politician_id: string;
  platform: string; // 'twitter' | 'youtube' | 'note' | 'niconico' | etc
  account_handle: string;
  account_url: string;
  rss_url?: string;
  rss_feed_id?: string;
  is_active: boolean;
}

export interface PoliticianSNSPostInput {
  platform: string;
  postId: string;
  content?: string;
  mediaUrls?: string[];
  thumbnailUrl?: string;
  postUrl: string;
  publishedAt: Date;
}

export class PoliticianSNSScraper {
  async scrapeAllPoliticians(): Promise<{ success: boolean; message: string; count: number }> {
    const { data: accounts } = await supabaseAdmin
      .from('politician_sns_accounts')
      .select('*')
      .eq('is_active', true);

    if (!accounts || accounts.length === 0) {
      return { success: true, message: 'アクティブな議員SNSアカウントがありません', count: 0 };
    }

    let total = 0;
    for (const account of accounts as PoliticianSNSAccount[]) {
      try {
        const count = await this.scrapeAccount(account);
        total += count;
        await supabaseAdmin
          .from('politician_sns_accounts')
          .update({ last_scraped_at: new Date().toISOString() })
          .eq('id', account.id);
      } catch (e) {
        console.error('Error scraping account', account.platform, account.account_handle, e);
      }
      // 軽いレート制限
      await new Promise(r => setTimeout(r, 400));
    }

    return { success: true, message: `議員SNS投稿を合計 ${total} 件取得しました`, count: total };
  }

  async scrapeOnePolitician(politicianId: string): Promise<{ success: boolean; message: string; count: number }> {
    const { data: accounts } = await supabaseAdmin
      .from('politician_sns_accounts')
      .select('*')
      .eq('is_active', true)
      .eq('politician_id', politicianId);

    if (!accounts || accounts.length === 0) {
      return { success: true, message: '対象議員のアクティブなSNSアカウントがありません', count: 0 };
    }

    let total = 0;
    for (const account of accounts as PoliticianSNSAccount[]) {
      try {
        const count = await this.scrapeAccount(account);
        total += count;
        await supabaseAdmin
          .from('politician_sns_accounts')
          .update({ last_scraped_at: new Date().toISOString() })
          .eq('id', account.id);
      } catch (e) {
        console.error('Error scraping account', account.platform, account.account_handle, e);
      }
      await new Promise(r => setTimeout(r, 400));
    }

    return { success: true, message: `議員(${politicianId})のSNS投稿を ${total} 件取得しました`, count: total };
  }

  async scrapeOneAccount(accountId: string): Promise<{ success: boolean; message: string; count: number; platform?: string }> {
    const { data: account, error } = await supabaseAdmin
      .from('politician_sns_accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (error || !account) {
      return { success: false, message: '指定されたSNSアカウントが見つかりません', count: 0 };
    }

    if (!account.is_active) {
      return { success: false, message: 'このSNSアカウントは無効です', count: 0 };
    }

    try {
      const count = await this.scrapeAccount(account as PoliticianSNSAccount);
      
      await supabaseAdmin
        .from('politician_sns_accounts')
        .update({ last_scraped_at: new Date().toISOString() })
        .eq('id', account.id);

      return { 
        success: true, 
        message: `${account.platform}アカウント(@${account.account_handle})から${count}件の投稿を取得しました`, 
        count,
        platform: account.platform
      };
    } catch (e) {
      console.error('Error scraping account', account.platform, account.account_handle, e);
      return { 
        success: false, 
        message: `取得中にエラーが発生しました: ${e instanceof Error ? e.message : '不明なエラー'}`, 
        count: 0,
        platform: account.platform
      };
    }
  }

  private async scrapeAccount(account: PoliticianSNSAccount): Promise<number> {
    const posts: PoliticianSNSPostInput[] = [];

    switch (account.platform) {
      case 'twitter':
        posts.push(...await this.fetchTwitterViaRSS(account));
        break;
      case 'youtube':
        posts.push(...await this.fetchYouTubeViaRSS(account));
        break;
      case 'note':
        posts.push(...await this.fetchNote(account));
        break;
      case 'niconico':
      case 'nicovideo':
        posts.push(...await this.fetchNiconico(account));
        break;
      default:
        return 0;
    }

    await this.savePosts(posts, account.politician_id);
    return posts.length;
  }

  // X(Twitter): RSS Appや任意RSSを使用
  private async fetchTwitterViaRSS(account: PoliticianSNSAccount): Promise<PoliticianSNSPostInput[]> {
    const rssUrl = account.rss_url || (account.rss_feed_id ? `https://rss.app/feeds/${account.rss_feed_id}.xml` : undefined);
    if (!rssUrl) return [];

    

    const response = await axios.get(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 15000
    });

    const posts: PoliticianSNSPostInput[] = [];
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
          let thumbnailUrl: string | undefined;
          const mediaUrlMatch = itemMatch.match(/<media:(?:content|thumbnail)[^>]*url="([^"]+)"/i);
          if (mediaUrlMatch && mediaUrlMatch[1]) {
            thumbnailUrl = mediaUrlMatch[1];
          }
          if (!thumbnailUrl) {
            const enclosureMatch = itemMatch.match(/<enclosure[^>]*url="([^"]+)"[^>]*type="image\/(?:jpeg|jpg|png|gif)"[^>]*\/>/i)
              || itemMatch.match(/<enclosure[^>]*type="image\/(?:jpeg|jpg|png|gif)"[^>]*url="([^"]+)"[^>]*\/>/i);
            if (enclosureMatch && enclosureMatch[1]) {
              thumbnailUrl = enclosureMatch[1];
            }
          }
          if (!thumbnailUrl) {
            const imgMatch = itemMatch.match(/<img[^>]*src="([^"]+)"/i);
            if (imgMatch && imgMatch[1]) {
              thumbnailUrl = imgMatch[1];
            }
          }

          // RSSの省略を公式シンジケーションJSONで補完
          if (postId) {
            const full = await fetchTweetFullText(postId);
            if (full) title = full;
          }
          title = normalizeTweetText(title);

          posts.push({
            platform: 'twitter',
            postId: postId || link,
            content: title,
            thumbnailUrl,
            postUrl: link,
            publishedAt
          });
        }
      } catch (error) {
        console.error('Error parsing Twitter RSS item:', error);
      }
    }

    
    return posts;
  }

  // YouTube: 公式RSS (channel_id) - 公式SNSと完全に同じロジック
  private async fetchYouTubeViaRSS(account: PoliticianSNSAccount): Promise<PoliticianSNSPostInput[]> {
    let feedUrl: string | undefined;

    // channel_idを抽出する（rss_url、account_urlのどちらからでも）
    let channelId = '';
    
    // rss_urlから抽出を試みる
    if (account.rss_url) {
      const url = account.rss_url;
      // 正しいRSS形式かチェック
      if (url.includes('/feeds/videos.xml?channel_id=')) {
        feedUrl = url;
      } else {
        // ?channel_id=UCxxxx を抽出
        const qMatch = url.match(/[?&]channel_id=([^&]+)/);
        if (qMatch && qMatch[1]) {
          channelId = qMatch[1];
        }
      }
    }
    
    // account_urlからも抽出を試みる
    if (!channelId && account.account_url) {
      const url = account.account_url;
      // 1) ?channel_id=UCxxxx を抽出
      const qMatch = url.match(/[?&]channel_id=([^&]+)/);
      // 2) /channel/UCxxxx パスから抽出
      const pathMatch = url.match(/\/channel\/(UC[^/?#]+)/);
      channelId = (qMatch && qMatch[1]) || (pathMatch && pathMatch[1]) || '';
    }

    // channel_idが見つかったらRSS URLを生成
    if (channelId && !feedUrl) {
      feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    }

    if (!feedUrl) {
      return [];
    }

    

    const response = await axios.get(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 15000
    });

    const rssText = response.data as string;
    const posts: PoliticianSNSPostInput[] = [];

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
          platform: 'youtube',
          postId: videoId || url,
          content: title ? `📹 ${title}` : undefined,
          mediaUrls: videoId ? [`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`] : undefined,
          thumbnailUrl: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined,
          postUrl: url,
          publishedAt,
        });
      } catch (e) {
        console.error('Error parsing YouTube RSS entry:', e);
      }
    }

    
    return posts;
  }

  // note: /rss によるRSSフィード
  private async fetchNote(account: PoliticianSNSAccount): Promise<PoliticianSNSPostInput[]> {
    let rssUrl = account.rss_url;
    if (!rssUrl && account.account_url) {
      rssUrl = account.account_url.endsWith('/rss') ? account.account_url : `${account.account_url.replace(/\/?$/, '')}/rss`;
    }
    if (!rssUrl) return [];

    const res = await axios.get(rssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/rss+xml, application/xml, text/xml' },
      timeout: 15000
    });
    const xml: string = res.data;
    const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
    const posts: PoliticianSNSPostInput[] = [];

    for (const item of items.slice(0, 20)) {
      const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = item.match(/<link>([^<]+)<\/link>/);
      const pubMatch = item.match(/<pubDate>([^<]+)<\/pubDate>/) || item.match(/<dc:date>([^<]+)<\/dc:date>/);
      const descriptionMatch = item.match(/<description>([\s\S]*?)<\/description>/);
      const url = linkMatch ? linkMatch[1] : '';
      if (!url) continue;
      const title = this.stripTags(titleMatch ? titleMatch[1] : '').trim();
      const publishedAt = pubMatch ? new Date(pubMatch[1]) : new Date();
      const idFromUrl = url.match(/\/n\/([a-zA-Z0-9_-]+)/)?.[1] || url; // noteの固有ID部分 or URL全体

      // サムネイル抽出（note用に強化）
      let thumbnailUrl: string | undefined;
      
      // 1. media:content / media:thumbnail
      const mediaUrlMatch = item.match(/<media:(?:content|thumbnail)[^>]*url="([^"]+)"/i);
      if (mediaUrlMatch && mediaUrlMatch[1]) {
        thumbnailUrl = mediaUrlMatch[1];
      }
      
      // 2. enclosure
      if (!thumbnailUrl) {
        const enclosureMatch = item.match(/<enclosure[^>]*url="([^"]+)"[^>]*type="image\/(?:jpeg|jpg|png|gif|webp)"[^>]*\/>/i)
          || item.match(/<enclosure[^>]*type="image\/(?:jpeg|jpg|png|gif|webp)"[^>]*url="([^"]+)"[^>]*\/>/i);
        if (enclosureMatch && enclosureMatch[1]) {
          thumbnailUrl = enclosureMatch[1];
        }
      }
      
      // 3. description内のimg（CDATAも考慮）
      if (!thumbnailUrl && descriptionMatch) {
        const description = descriptionMatch[1];
        // CDATAを除去
        const cleanDesc = description.replace(/<!\[CDATA\[|\]\]>/g, '');
        // 最初の画像を取得
        const imgMatch = cleanDesc.match(/<img[^>]*src=["']([^"']+)["']/i);
        if (imgMatch && imgMatch[1]) {
          thumbnailUrl = imgMatch[1];
        }
      }
      
      // 4. note特有: og:image的な情報
      if (!thumbnailUrl) {
        const ogImageMatch = item.match(/og:image["']?\s*content=["']([^"']+)["']/i);
        if (ogImageMatch && ogImageMatch[1]) {
          thumbnailUrl = ogImageMatch[1];
        }
      }

      // RSSでサムネイルが見つからない場合、記事ページから取得（最初の5件のみ）
      if (!thumbnailUrl && posts.length < 5) {
        try {
          
          const pageRes = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000
          });
          const pageHtml = pageRes.data;
          
          // og:image メタタグから取得
          const ogImageMatch = pageHtml.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
          if (ogImageMatch && ogImageMatch[1]) {
            thumbnailUrl = ogImageMatch[1];
          }
          
          // twitter:image メタタグから取得
          if (!thumbnailUrl) {
            const twitterImageMatch = pageHtml.match(/<meta\s+name="twitter:image"\s+content="([^"]+)"/i);
            if (twitterImageMatch && twitterImageMatch[1]) {
              thumbnailUrl = twitterImageMatch[1];
            }
          }
          
          // note特有の画像構造（見出し画像）
          if (!thumbnailUrl) {
            const noteImageMatch = pageHtml.match(/<img[^>]*class="[^"]*note-common-styles__[^"]*"[^>]*src="([^"]+)"/i);
            if (noteImageMatch && noteImageMatch[1]) {
              thumbnailUrl = noteImageMatch[1];
            }
          }
          
          
          
          // レート制限のため少し待機
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (e) {
        }
      }

      

      posts.push({
        platform: 'note',
        postId: idFromUrl,
        content: title,
        thumbnailUrl,
        postUrl: url,
        publishedAt
      });
    }
    return posts;
  }

  // ニコニコチャンネル: 公式検索APIで動画一覧を取得
  private async fetchNiconico(account: PoliticianSNSAccount): Promise<PoliticianSNSPostInput[]> {
    if (!account.account_url) {
      console.error('Niconico: account_url is missing');
      return [];
    }

    

    // ユーザー投稿動画の場合（nicovideo.jp/user/）
    if (account.account_url.includes('nicovideo.jp/user/')) {
      const userId = this.extractNiconicoUserId(account.account_url);
      if (userId) {
        
        return await this.fetchNiconicoUserVideos(userId);
      }
    }

    // チャンネルの場合（nicochannel.jp/）
    if (account.account_url.includes('nicochannel.jp/')) {
    const channelId = this.extractNiconicoChannelId(account.account_url);
    if (!channelId) {
        console.error('[Niconico] Failed to extract channel ID from URL:', account.account_url);
      return [];
    }

      
      return await this.fetchNiconicoViaAPI(channelId, account);
    }

    console.error('[Niconico] Unsupported URL format:', account.account_url);
    return [];
  }

  // ニコニコチャンネルIDを抽出
  private extractNiconicoChannelId(url: string): string | null {
    // https://nicochannel.jp/chxxxxxx または https://nicochannel.jp/username
    const match = url.match(/nicochannel\.jp\/([^\/\?#]+)/);
    return match ? match[1] : null;
  }

  // ニコニコユーザーIDを抽出
  private extractNiconicoUserId(url: string): string | null {
    // https://www.nicovideo.jp/user/12345678
    const match = url.match(/nicovideo\.jp\/user\/(\d+)/);
    return match ? match[1] : null;
  }

  // ニコニコユーザーの投稿動画を取得
  private async fetchNiconicoUserVideos(userId: string): Promise<PoliticianSNSPostInput[]> {
    
    
    // RSSフィードを使用
    const rssUrl = `https://www.nicovideo.jp/user/${userId}/video?rss=2.0`;
    
    try {
      const res = await axios.get(rssUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml'
        },
        timeout: 15000
      });

      const xml: string = res.data;
      
      if (!xml.includes('<rss') && !xml.includes('<feed')) {
        console.error('[Niconico] Not a valid RSS feed');
        return [];
      }

      return this.parseNiconicoRSS(xml);
    } catch (error) {
      console.error('[Niconico] Error fetching user RSS:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  // ニコニコ公式検索API: api.search.nicovideo.jp を使用
  private async fetchNiconicoViaAPI(channelId: string, account: PoliticianSNSAccount): Promise<PoliticianSNSPostInput[]> {
    const allPosts: PoliticianSNSPostInput[] = [];
    
    // 1. スナップショット検索APIで動画を取得
    
    const videos = await this.fetchNiconicoSnapshotAPI(channelId);
    allPosts.push(...videos);
    
    // 2. チャンネルの詳細情報からさらに取得を試みる
    if (allPosts.length === 0) {
      
      const alternativeVideos = await this.fetchNiconicoChannelRSS(channelId);
      allPosts.push(...alternativeVideos);
    }
    
    return allPosts;
  }

  // ニコニコチャンネルプラスのfanclub_site_idを取得
  private async extractFanclubSiteId(channelId: string): Promise<string | null> {
    // 複数のURLを試す（トップページが無い場合がある）
    const urlsToTry = [
      `https://nicochannel.jp/${channelId}/video`,
      `https://nicochannel.jp/${channelId}/live`,
      `https://nicochannel.jp/${channelId}`,
    ];
    
    for (const pageUrl of urlsToTry) {
      try {
        
        
        const response = await axios.get(pageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          },
          timeout: 15000
        });

        const html = response.data;
      
        // パターン1: window.__INITIAL_STATE__ = {...} 形式のJSONを探す
        const initialStateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*({[\s\S]+?});/);
        if (initialStateMatch) {
          try {
            const state = JSON.parse(initialStateMatch[1]);
            const fanclubId = state?.fanclubSite?.fanclub_site_id || 
                            state?.fanclub_site_id ||
                            state?.fanclubSiteId ||
                            state?.siteId;
            if (fanclubId) {
              
              return String(fanclubId);
            }
          } catch (e) {
            
          }
        }

        // パターン2: data-fanclub-site-id="..." のような属性
        const dataAttrMatch = html.match(/data-fanclub-site-id=["'](\d+)["']/);
        if (dataAttrMatch) {
          
          return dataAttrMatch[1];
        }

        // パターン3: fanclub_site_id: 数値 のようなJavaScript変数
        const jsVarMatch = html.match(/fanclub_site_id["\s:]+(\d+)/);
        if (jsVarMatch) {
          
          return jsVarMatch[1];
        }

        
      } catch (error: any) {
        
        // 次のURLを試す
      }
    }
    
    
    return null;
  }

  // ニコニコスナップショット検索API + チャンネル内部API
  private async fetchNiconicoSnapshotAPI(channelId: string): Promise<PoliticianSNSPostInput[]> {
    // 方法1: ニコニコチャンネルプラス用API（動画・生放送・記事一覧）
    try {
      
      
      // まずfanclub_site_idを取得
      const fanclubSiteId = await this.extractFanclubSiteId(channelId);
      if (!fanclubSiteId) {
        
        throw new Error('fanclub_site_id not found');
      }
      
      const allPosts: PoliticianSNSPostInput[] = [];
      
      // 1. 動画を取得
      try {
        
        const videoApiUrl = `https://nfc-api.nicochannel.jp/fc/fanclub_sites/${fanclubSiteId}/video_pages`;
        
        const videoResponse = await axios.get(videoApiUrl, {
          params: { page: 1, per_page: 30 },
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Origin': 'https://nicochannel.jp',
            'Referer': `https://nicochannel.jp/${channelId}/video`
          },
          timeout: 20000
        });

        const videos = videoResponse.data?.data?.video_pages || [];
        
        
        for (const video of videos) {
          const contentId = video.content_code || video.id;
          const title = video.title;
          const thumbnail = video.thumbnail?.url || video.thumbnail_url;
          const publishedDate = video.published_at || video.created_at;
          
          if (contentId) {
            allPosts.push({
              platform: 'niconico',
              postId: contentId,
              content: title ? `🎬 ${title}` : `動画 ${contentId}`,
              thumbnailUrl: thumbnail || undefined,
              mediaUrls: thumbnail ? [thumbnail] : undefined,
              postUrl: `https://nicochannel.jp/${channelId}/video/${contentId}`,
              publishedAt: publishedDate ? new Date(publishedDate) : new Date()
            });
          }
        }
      } catch (e: any) {
        
      }

      // 2. 生放送を取得
      try {
        
        const liveApiUrl = `https://nfc-api.nicochannel.jp/fc/fanclub_sites/${fanclubSiteId}/live_pages`;
        
        const liveResponse = await axios.get(liveApiUrl, {
          params: { page: 1, per_page: 30 },
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Origin': 'https://nicochannel.jp',
            'Referer': `https://nicochannel.jp/${channelId}/live`
          },
          timeout: 20000
        });

        const lives = liveResponse.data?.data?.live_pages || [];
        
        
        for (const live of lives) {
          const contentId = live.content_code || live.id;
          const title = live.title;
          const thumbnail = live.thumbnail?.url || live.thumbnail_url;
          const publishedDate = live.published_at || live.opened_at || live.created_at;
          
          if (contentId) {
            allPosts.push({
              platform: 'niconico',
              postId: contentId,
              content: title ? `📺 ${title}` : `生放送 ${contentId}`,
              thumbnailUrl: thumbnail || undefined,
              mediaUrls: thumbnail ? [thumbnail] : undefined,
              postUrl: `https://nicochannel.jp/${channelId}/live/${contentId}`,
              publishedAt: publishedDate ? new Date(publishedDate) : new Date()
            });
          }
        }
      } catch (e: any) {
        
      }

      // 3. 記事を取得
      try {
        
        const articleApiUrl = `https://nfc-api.nicochannel.jp/fc/fanclub_sites/${fanclubSiteId}/article_pages`;
        
        const articleResponse = await axios.get(articleApiUrl, {
          params: { page: 1, per_page: 30 },
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Origin': 'https://nicochannel.jp',
            'Referer': `https://nicochannel.jp/${channelId}/articles/news`
          },
          timeout: 20000
        });

        const articles = articleResponse.data?.data?.article_pages || [];
        
        
        for (const article of articles) {
          const contentId = article.content_code || article.id;
          const title = article.title;
          const thumbnail = article.thumbnail?.url || article.thumbnail_url;
          const publishedDate = article.published_at || article.created_at;
          
          if (contentId) {
            allPosts.push({
              platform: 'niconico',
              postId: contentId,
              content: title ? `📰 ${title}` : `記事 ${contentId}`,
              thumbnailUrl: thumbnail || undefined,
              mediaUrls: thumbnail ? [thumbnail] : undefined,
              postUrl: `https://nicochannel.jp/${channelId}/articles/news/${contentId}`,
              publishedAt: publishedDate ? new Date(publishedDate) : new Date()
            });
          }
        }
      } catch (e: any) {
        
      }

      if (allPosts.length > 0) {
        
        return allPosts;
      }
    } catch (error: any) {
      console.error(`[Niconico API] Method 1 (Fanclub API) failed (${error.response?.status || 'network error'}):`, error.message);
      if (error.response?.data) {
        
      }
    }

    // 方法2: 旧チャンネルAPI（ch.nicovideo.jp）
    try {
      
      
      const channelApiUrl = `https://nfc-api.nicochannel.jp/fc/video_pages/list`;
      
      const response = await axios.get(channelApiUrl, {
        params: {
          channel_id: channelId,
          page: 1,
          per_page: 30
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Origin': 'https://ch.nicovideo.jp',
          'Referer': `https://ch.nicovideo.jp/${channelId}/video`
        },
        timeout: 20000
      });

      const data = response.data;
      
      if (data?.data?.video_pages && Array.isArray(data.data.video_pages) && data.data.video_pages.length > 0) {
        const videos = data.data.video_pages;
        
        
        const posts: PoliticianSNSPostInput[] = [];
        for (const video of videos) {
          const contentId = video.content_id || video.video_id;
          if (!contentId) continue;
          
          posts.push({
            platform: 'niconico',
            postId: contentId,
            content: video.title ? `🎬 ${video.title}` : undefined,
            thumbnailUrl: video.thumbnail_url || undefined,
            mediaUrls: video.thumbnail_url ? [video.thumbnail_url] : undefined,
            postUrl: `https://www.nicovideo.jp/watch/${contentId}`,
            publishedAt: video.released_at ? new Date(video.released_at) : new Date()
          });
        }
        
        return posts;
      }
    } catch (error: any) {
      console.error(`[Niconico API] Method 2 (old Channel API) failed (${error.response?.status || 'network error'}):`, error.message);
    }

    // 方法3: スナップショット検索API
    const searchApiUrl = 'https://api.search.nicovideo.jp/api/v2/snapshot/video/contents/search';
    
    try {
      
      
      const params = new URLSearchParams({
        q: `ch:${channelId}`,  // チャンネル検索のプレフィックス
        targets: 'title',
        fields: 'contentId,title,thumbnailUrl,startTime',
        _sort: '-startTime',
        _offset: '0',
        _limit: '30',
        _context: 'apiguide'
      });
      
      const response = await axios.get(`${searchApiUrl}?${params.toString()}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        },
        timeout: 20000
      });

      const data = response.data;
      
      
      if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
        
        return this.parseNiconicoAPIResponse(data.data);
      }
    } catch (error: any) {
      console.error(`[Niconico API] Method 3 (Snapshot) failed (${error.response?.status || 'network error'}):`, error.message);
    }

    // 方法4: ユーザー投稿動画として検索
    try {
      
      
      const params = new URLSearchParams({
        q: channelId,
          targets: 'title,description,tags',
        fields: 'contentId,title,thumbnailUrl,startTime',
          _sort: '-startTime',
        _offset: '0',
        _limit: '30',
        _context: 'apiguide'
      });
      
      const response = await axios.get(`${searchApiUrl}?${params.toString()}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        },
        timeout: 20000
      });

      const data = response.data;
      
      if (data?.data && Array.isArray(data.data) && data.data.length > 0) {
        
        return this.parseNiconicoAPIResponse(data.data.slice(0, 10)); // 上位10件のみ
      }
    } catch (error: any) {
      console.error(`[Niconico API] Method 4 failed (${error.response?.status || 'network error'}):`, error.message);
    }

    
    return [];
  }

  // ニコニコAPIのレスポンスをパース
  private parseNiconicoAPIResponse(videos: any[]): PoliticianSNSPostInput[] {
    const posts: PoliticianSNSPostInput[] = [];

    for (const video of videos) {
      const videoId = video.contentId;
      const title = video.title;
      const thumbnailUrl = video.thumbnailUrl;
      const startTime = video.startTime;
      const videoUrl = `https://www.nicovideo.jp/watch/${videoId}`;

      if (!videoId || !title) continue;

      const publishedAt = startTime ? new Date(startTime) : new Date();

      

      posts.push({
        platform: 'niconico',
        postId: videoId,
        content: title,
        thumbnailUrl: thumbnailUrl || undefined,
        mediaUrls: thumbnailUrl ? [thumbnailUrl] : undefined,
        postUrl: videoUrl,
        publishedAt
      });
    }

    return posts;
  }

  // チャンネルのRSSフィードから動画を取得
  private async fetchNiconicoChannelRSS(channelId: string): Promise<PoliticianSNSPostInput[]> {
    // 複数のRSS URL形式を試す
    const rssUrls = [
      `https://nicochannel.jp/${channelId}/video?rss=atom`,
      `https://nicochannel.jp/${channelId}/video?rss=2.0`,
      `https://ch.nicovideo.jp/${channelId}/video?rss=atom`,
      `https://ch.nicovideo.jp/${channelId}/video?rss=2.0`
    ];

    let allPosts: PoliticianSNSPostInput[] = [];

    for (const rssUrl of rssUrls) {
      

    try {
      const res = await axios.get(rssUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*',
            'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
        },
        timeout: 15000
      });

      const xml: string = res.data;
        
        
        if (xml.includes('<rss') || xml.includes('<feed')) {
          
          allPosts = this.parseNiconicoRSS(xml);
          break; // 成功したら他のRSSを試さない
        } else {
          
        }
      } catch (error) {
        const axiosError = error as any;
        console.error(`[Niconico] RSS ${rssUrl} failed (${axiosError.response?.status || 'network error'}):`, axiosError.message);
      }
    }

    // HTMLページから動画、生放送、記事を取得
    
    const scrapedPosts = await this.fetchNiconicoChannelPageScraping(channelId);
    
    // 重複を避けて結合
    const existingPostIds = new Set(allPosts.map(p => p.postId));
    for (const post of scrapedPosts) {
      if (!existingPostIds.has(post.postId)) {
        allPosts.push(post);
      }
    }

    return allPosts;
  }

  // チャンネルページをスクレイピングして動画、生放送、記事を取得
  private async fetchNiconicoChannelPageScraping(channelId: string): Promise<PoliticianSNSPostInput[]> {
    const allPosts: PoliticianSNSPostInput[] = [];

    // 1. 動画ページから取得
    const videoPosts = await this.scrapeNiconicoSection(channelId, 'video', '動画');
    allPosts.push(...videoPosts);

    // 2. 生放送ページから取得
    const livePosts = await this.scrapeNiconicoSection(channelId, 'lives', '生放送');
    allPosts.push(...livePosts);

    // 3. 記事ページから取得
    const articlePosts = await this.scrapeNiconicoArticles(channelId);
    allPosts.push(...articlePosts);

    
    return allPosts;
  }

  // ニコニコチャンネルのセクション（video/lives）をスクレイピング
  private async scrapeNiconicoSection(channelId: string, section: string, sectionName: string): Promise<PoliticianSNSPostInput[]> {
    // 新旧両方のドメインを試す
    const channelUrls = [
      `https://ch.nicovideo.jp/${channelId}/${section}`,
      `https://nicochannel.jp/${channelId}/${section}`
    ];
    
    for (const channelUrl of channelUrls) {
      

      try {
        const res = await axios.get(channelUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
          },
          timeout: 15000
        });

      const html: string = res.data;
      

      const $ = cheerio.load(html);
      const posts: PoliticianSNSPostInput[] = [];

      // デバッグ: HTMLサンプルを出力
      
      
      // すべてのリンクを確認（デバッグ用）
      const allLinks: string[] = [];
      $('a').each((_, elem) => {
        const href = $(elem).attr('href');
        if (href) {
          allLinks.push(href);
        }
      });
      
      if (allLinks.length > 0) {
        
      }

      // watch URLとlive URLを探す
      const contentLinks = new Set<string>();
      
      // パターン1: 通常の /watch/ リンク
      $('a[href*="/watch/"], a[href*="/live/"]').each((_, elem) => {
        const href = $(elem).attr('href');
        if (href) {
          let fullUrl = href;
          if (!href.startsWith('http')) {
            if (href.includes('/watch/')) {
              fullUrl = `https://www.nicovideo.jp${href}`;
            } else if (href.includes('/live/')) {
              fullUrl = `https://live.nicovideo.jp${href}`;
            }
          }
          contentLinks.add(fullUrl);
        }
      });
      
      // パターン2: data属性にURLが埋め込まれている場合
      $('[data-href*="/watch/"], [data-href*="/live/"], [data-video-id]').each((_, elem) => {
        const dataHref = $(elem).attr('data-href');
        const videoId = $(elem).attr('data-video-id');
        
        if (dataHref) {
          const fullUrl = dataHref.startsWith('http') ? dataHref : `https://www.nicovideo.jp${dataHref}`;
          contentLinks.add(fullUrl);
        }
        
        if (videoId) {
          contentLinks.add(`https://www.nicovideo.jp/watch/${videoId}`);
        }
      });

      

        // 最初の10件のみ処理
        const linksArray = Array.from(contentLinks).slice(0, 10);
        
        for (const contentUrl of linksArray) {
          const isLive = contentUrl.includes('/live/');
          const idMatch = contentUrl.match(isLive ? /\/live\/(lv\d+)/ : /\/watch\/([a-zA-Z0-9_-]+)/);
          if (!idMatch) continue;

          const contentId = idMatch[1];
          
          // 詳細情報を取得（最初の3件のみ）
          if (posts.length < 3) {
            try {
              
              const contentRes = await axios.get(contentUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                },
                timeout: 10000
              });

              const contentHtml = contentRes.data;
              const $content = cheerio.load(contentHtml);
              
              // タイトルを取得
              const title = $content('meta[property="og:title"]').attr('content') 
                         || $content('title').text() 
                         || `${isLive ? '生放送' : '動画'} ${contentId}`;
              
              // サムネイルを取得
              const thumbnailUrl = $content('meta[property="og:image"]').attr('content') 
                                || $content('meta[name="thumbnail"]').attr('content');
              
              const publishedAt = new Date();

              

              posts.push({
                platform: 'niconico',
                postId: contentId,
                content: `${isLive ? '📺 ' : '🎬 '}${title}`,
                thumbnailUrl: thumbnailUrl || undefined,
                mediaUrls: thumbnailUrl ? [thumbnailUrl] : undefined,
                postUrl: contentUrl,
                publishedAt
              });

              // レート制限対策
              await new Promise(resolve => setTimeout(resolve, 800));
            } catch (e) {
              console.error(`[Niconico] Failed to fetch ${sectionName} details for ${contentId}:`, e instanceof Error ? e.message : 'Unknown error');
            }
          } else {
            // 詳細情報なしで追加
            posts.push({
              platform: 'niconico',
              postId: contentId,
              content: `${isLive ? '📺 生放送' : '🎬 動画'} ${contentId}`,
              postUrl: contentUrl,
              publishedAt: new Date()
            });
          }
        }

        
        if (posts.length > 0) {
          return posts; // 成功したらすぐに返す
        }

      } catch (error) {
        const axiosError = error as any;
        
      }
    }
    
    // すべてのURLが失敗
    console.error(`[Niconico] All URLs failed for ${sectionName} section`);
        return [];
      }

  // ニコニコチャンネルの記事を取得
  private async scrapeNiconicoArticles(channelId: string): Promise<PoliticianSNSPostInput[]> {
    // 新旧両方のドメインを試す
    const articleUrls = [
      `https://ch.nicovideo.jp/${channelId}/blomaga`,  // 旧ドメインはblomagaを使用
      `https://ch.nicovideo.jp/${channelId}/articles`,
      `https://nicochannel.jp/${channelId}/articles/news`
    ];
    
    for (const articleUrl of articleUrls) {
      

    try {
      const res = await axios.get(articleUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8'
        },
        timeout: 15000
      });

      const html: string = res.data;
      

      const $ = cheerio.load(html);
      const posts: PoliticianSNSPostInput[] = [];

      // 記事リンクを探す（/articles/ または /blomaga/ を含むURL）
      const articleLinks = new Set<string>();
      
      $('a[href*="/articles/"], a[href*="/blomaga/"]').each((_, elem) => {
        const href = $(elem).attr('href');
        if (href) {
          let fullUrl = href;
          if (!href.startsWith('http')) {
            // ドメインを適切に追加
            if (articleUrl.includes('ch.nicovideo.jp')) {
              fullUrl = href.startsWith('/') ? `https://ch.nicovideo.jp${href}` : `https://ch.nicovideo.jp/${href}`;
            } else {
              fullUrl = href.startsWith('/') ? `https://nicochannel.jp${href}` : `https://nicochannel.jp/${href}`;
            }
          }
          // 一覧ページを除外、個別記事のみ
          if ((fullUrl.includes('/articles/') && !fullUrl.endsWith('/articles') && !fullUrl.endsWith('/articles/news')) ||
              (fullUrl.includes('/blomaga/') && !fullUrl.endsWith('/blomaga'))) {
            articleLinks.add(fullUrl);
          }
        }
      });

      

      // 最初の10件のみ処理
      const linksArray = Array.from(articleLinks).slice(0, 10);
      
      for (const articleDetailUrl of linksArray) {
        const articleIdMatch = articleDetailUrl.match(/\/articles\/([^\/\?#]+)/) || articleDetailUrl.match(/\/blomaga\/ar(\d+)/);
        if (!articleIdMatch) continue;

        const articleId = articleIdMatch[1];
        
        // 記事詳細を取得（最初の3件のみ）
        if (posts.length < 3) {
          try {
            
            const articleRes = await axios.get(articleDetailUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
              },
              timeout: 10000
            });

            const articleHtml = articleRes.data;
            const $article = cheerio.load(articleHtml);
            
            // タイトルを取得
            const title = $article('meta[property="og:title"]').attr('content') 
                       || $article('h1').first().text().trim()
                       || $article('title').text() 
                       || `記事 ${articleId}`;
            
            // サムネイルを取得
            const thumbnailUrl = $article('meta[property="og:image"]').attr('content');
            
            // 公開日を取得（簡易的に現在日時を使用）
            const publishedAt = new Date();

            

            posts.push({
              platform: 'niconico',
              postId: `article_${articleId}`,
              content: `📰 ${title}`,
              thumbnailUrl: thumbnailUrl || undefined,
              mediaUrls: thumbnailUrl ? [thumbnailUrl] : undefined,
              postUrl: articleDetailUrl,
              publishedAt
            });

            // レート制限対策
            await new Promise(resolve => setTimeout(resolve, 800));
          } catch (e) {
            console.error(`[Niconico] Failed to fetch article details for ${articleId}:`, e instanceof Error ? e.message : 'Unknown error');
          }
        } else {
          // 詳細情報なしで追加
          posts.push({
            platform: 'niconico',
            postId: `article_${articleId}`,
            content: `📰 記事 ${articleId}`,
            postUrl: articleDetailUrl,
            publishedAt: new Date()
          });
        }
      }

      
      if (posts.length > 0) {
        return posts; // 成功したらすぐに返す
      }

    } catch (error) {
      const axiosError = error as any;
      
    }
  }
  
  // すべてのURLが失敗
  console.error('[Niconico] All URLs failed for articles section');
  return [];
}

  // 共通のRSSパース処理
  private parseNiconicoRSS(xml: string): PoliticianSNSPostInput[] {
      const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    

      const posts: PoliticianSNSPostInput[] = [];
      
      for (const item of items.slice(0, 20)) {
        try {
          const linkMatch = item.match(/<link>(.*?)<\/link>/);
          const titleMatch = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || item.match(/<title>(.*?)<\/title>/);
          const pubMatch = item.match(/<pubDate>(.*?)<\/pubDate>/) || item.match(/<dc:date>(.*?)<\/dc:date>/);
          
          const url = linkMatch ? linkMatch[1].trim() : '';
        if (!url) continue;

          // 動画IDを抽出
          const videoIdMatch = url.match(/\/watch\/([a-zA-Z0-9_\-]+)/);
          const videoId = videoIdMatch ? videoIdMatch[1] : url;

        const title = this.stripTags(titleMatch ? titleMatch[1] : '').trim();
          if (!title) continue;

        const publishedAt = pubMatch ? new Date(pubMatch[1]) : new Date();

        // サムネイル抽出
          let thumbnailUrl: string | undefined;
          
          // 1. media:thumbnail
          const mediaThumb = item.match(/<media:thumbnail[^>]*url=["']([^"']+)["']/i);
          if (mediaThumb && mediaThumb[1]) {
            thumbnailUrl = mediaThumb[1];
          }
          
          // 2. media:content
          if (!thumbnailUrl) {
            const mediaContent = item.match(/<media:content[^>]*url=["']([^"']+)["'][^>]*medium=["']image["']/i);
            if (mediaContent && mediaContent[1]) {
              thumbnailUrl = mediaContent[1];
            }
          }
          
          // 3. enclosure
          if (!thumbnailUrl) {
            const enclosure = item.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image\//i);
            if (enclosure && enclosure[1]) {
              thumbnailUrl = enclosure[1];
            }
          }

        

        posts.push({
          platform: 'niconico',
          postId: videoId,
          content: title.substring(0, 200),
            thumbnailUrl,
            mediaUrls: thumbnailUrl ? [thumbnailUrl] : undefined,
          postUrl: url,
          publishedAt
        });
        } catch (e) {
        console.error('[Niconico] Error parsing RSS item:', e);
        }
      }

      return posts;
  }

  // 旧メソッド（後方互換性のため残す）
  private async fetchNiconicoViaRSS(account: PoliticianSNSAccount): Promise<PoliticianSNSPostInput[]> {
    if (!account.account_url) return [];

    // RSSフィードURLを構築
    let rssUrl = account.rss_url;
    if (!rssUrl) {
      const baseUrl = account.account_url.replace(/\/?$/, '');
      // ニコニコチャンネルのRSSフィードパターン
      rssUrl = `${baseUrl}/video?rss=2.0`;
    }

    

    try {
      const res = await axios.get(rssUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml'
        },
        timeout: 15000
      });

      const xml: string = res.data;
      
      // XML形式かチェック
      if (!xml.includes('<rss') && !xml.includes('<feed')) {
        console.error('[Niconico] Not a valid RSS feed');
        return [];
      }

      return this.parseNiconicoRSS(xml);
    } catch (error) {
      console.error(`[Niconico] RSS feed not available:`, error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }


  private async savePosts(posts: PoliticianSNSPostInput[], politicianId: string): Promise<void> {
    
    
    for (const post of posts) {
      try {
        
        
        const { data, error } = await supabaseAdmin
          .from('politician_sns_posts')
          .upsert({
            politician_id: politicianId,
            platform: post.platform,
            post_id: post.postId,
            content: post.content,
            media_urls: post.mediaUrls || [],
            thumbnail_url: post.thumbnailUrl || null,
            post_url: post.postUrl,
            published_at: post.publishedAt.toISOString()
          }, { onConflict: 'platform,post_id' })
          .select();
          
        if (error) {
          console.error('Error saving politician SNS post:', error);
        } else {
          
        }
      } catch (e) {
        console.error('Error saving politician SNS post:', e);
      }
    }
  }

  private stripTags(text: string): string {
    return (text || '')
      .replace(/<[^>]*>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .trim();
  }

  private extractMediaUrls(content: string): string[] {
    const urls = content.match(/https?:\/\/[^\s<>"']+\.(?:jpg|jpeg|png|gif|mp4|webm)/gi) || [];
    return urls;
  }
}


