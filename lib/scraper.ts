import axios from 'axios';
import * as cheerio from 'cheerio';
import { supabaseAdmin } from './supabase-admin';

export interface ScrapedArticle {
  title: string;
  url: string;
  content?: string;
  publishedAt?: Date;
  category?: string;
  tags?: string[];
  thumbnailUrl?: string;
}

export interface ScrapedEvent {
  title: string;
  url: string;
  description?: string;
  eventDate?: Date;
  endDate?: Date;
  location?: string;
  prefecture?: string;
  organizer?: string;
  eventType?: string;
  capacity?: number;
  registrationRequired?: boolean;
  registrationUrl?: string;
  contactInfo?: string;
  tags?: string[];
  thumbnailUrl?: string;
}

export class KokuminScraper {
  private readonly sources = [
    'https://new-kokumin.jp/news',
    'https://team.new-kokumin.jp',
    'https://team.new-kokumin.jp/evinfo/'
  ];

  async scrapeAllSources(): Promise<void> {
    for (const sourceUrl of this.sources) {
      try {
        await this.scrapeSource(sourceUrl);
        await this.logScraping(sourceUrl, 'success');
      } catch (error) {
        console.error(`Error scraping ${sourceUrl}:`, error);
        await this.logScraping(sourceUrl, 'error', error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }

  // 個別スクレイピングメソッド
  async scrapeNews(): Promise<{ success: boolean; message: string; count?: number }> {
    try {
      
      const sourceUrl = 'https://new-kokumin.jp/news';
      const response = await axios.get(sourceUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 10000
      });

      

      const $ = cheerio.load(response.data);
      const articles = this.scrapeNewsPage($);
      await this.saveArticles(articles, sourceUrl);
      await this.logScraping(sourceUrl, 'success');

      return {
        success: true,
        message: `ニュース記事 ${articles.length} 件を取得しました`,
        count: articles.length
      };
    } catch (error) {
      console.error('Error in scrapeNews:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.logScraping('https://new-kokumin.jp/news', 'error', errorMessage);
      return {
        success: false,
        message: `ニュース取得中にエラーが発生しました: ${errorMessage}`
      };
    }
  }

  async scrapeEvents(): Promise<{ success: boolean; message: string; count?: number }> {
    try {
      const sourceUrl = 'https://team.new-kokumin.jp/evinfo/';
      const response = await axios.get(sourceUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      // 「最近追加された情報」セクションに限定して抽出
      const recentEvents = await this.scrapeRecentAddedEvents($);
      // 既存URLを除外（未登録のみ）
      const newEvents = await this.filterUnregisteredEvents(recentEvents);
      await this.saveEvents(newEvents, sourceUrl);
      await this.logScraping(sourceUrl, 'success');

      return {
        success: true,
        message: `イベント情報 ${newEvents.length} 件を取得しました（未登録のみ）`,
        count: newEvents.length
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.logScraping('https://team.new-kokumin.jp/evinfo/', 'error', errorMessage);
      return {
        success: false,
        message: `イベント情報取得中にエラーが発生しました: ${errorMessage}`
      };
    }
  }

  async scrapeTeamUpdates(): Promise<{ success: boolean; message: string; count?: number }> {
    try {
      
      const sourceUrl = 'https://team.new-kokumin.jp';
      const response = await axios.get(sourceUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 10000
      });

      

      const $ = cheerio.load(response.data);
      const articles = this.scrapeTeamPage($);
      await this.saveArticles(articles, sourceUrl);
      await this.logScraping(sourceUrl, 'success');

      return {
        success: true,
        message: `チーム更新情報 ${articles.length} 件を取得しました`,
        count: articles.length
      };
    } catch (error) {
      console.error('Error in scrapeTeamUpdates:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.logScraping('https://team.new-kokumin.jp', 'error', errorMessage);
      return {
        success: false,
        message: `チーム更新情報取得中にエラーが発生しました: ${errorMessage}`
      };
    }
  }

  private async scrapeSource(sourceUrl: string): Promise<void> {
    const response = await axios.get(sourceUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);

    if (sourceUrl.includes('new-kokumin.jp/news')) {
      const articles = this.scrapeNewsPage($);
      await this.saveArticles(articles, sourceUrl);
    } else if (sourceUrl.includes('team.new-kokumin.jp/evinfo')) {
      // 「最近追加された情報」限定 + 未登録のみ
      const recentEvents = await this.scrapeRecentAddedEvents($);
      const newEvents = await this.filterUnregisteredEvents(recentEvents);
      await this.saveEvents(newEvents, sourceUrl);
    } else if (sourceUrl.includes('team.new-kokumin.jp')) {
      const articles = this.scrapeTeamPage($);
      await this.saveArticles(articles, sourceUrl);
    }
  }

  private scrapeNewsPage($: cheerio.CheerioAPI): ScrapedArticle[] {
    const articles: ScrapedArticle[] = [];
    const seenUrls = new Set<string>();

    

    // 不要なURLを除外するフィルター
    const excludeUrls = [
      'https://new-kokumin.jp/news',
      'https://new-kokumin.jp/',
      'https://new-kokumin.jp/news/business/kokuminseiji_dai3',
      'https://new-kokumin.jp/news/policy/20240328_1',
      'https://new-kokumin.jp/news/policy/20240926_1'
    ];

    // より具体的なセレクターでニュース記事のみを対象とする
    const newsSelectors = [
      // 具体的な日付パターンを含む要素内のリンク
      'li:contains("2025.") a',
      'div:contains("2025.") a',
      // ニュース記事の直接リンク（ただし、特定のパターンのみ）
      'a[href*="/news/business/2025"]',
      'a[href*="/news/policy/2025"]',
      'a[href*="/news/parliament/2025"]',
      'a[href*="/news/election/2025"]',
      'a[href*="/news/information/2025"]'
    ];

    for (const selector of newsSelectors) {
      $(selector).each((_, element) => {
        const $link = $(element);
        const href = $link.attr('href');
        
        if (!href) return;

        const fullUrl = href.startsWith('http') 
          ? href 
          : `https://new-kokumin.jp${href}`;

        // 除外URLをスキップ
        if (excludeUrls.includes(fullUrl)) return;

        // 重複URLをスキップ
        if (seenUrls.has(fullUrl)) return;
        seenUrls.add(fullUrl);

        // 親要素から情報を取得
        const $parent = $link.closest('li, div');
        const parentText = $parent.text().trim();

        // 日付とカテゴリーのパターンをチェック
        const dateAndCategoryMatch = parentText.match(/(\d{4}\.\d{1,2}\.\d{1,2})\s+(\S+)\s*(.+)/);
        
        if (!dateAndCategoryMatch) return; // 日付パターンがない場合はスキップ

        const [, dateStr, categoryStr, titlePart] = dateAndCategoryMatch;
        
        // タイトルを取得
        let title = titlePart.trim();
        if (!title) {
          title = $link.text().trim();
        }

        // タイトルが短すぎる場合はスキップ
        if (!title || title.length < 10) return;

        // 不要なタイトルをフィルタリング
        const excludeTitles = [
          'ニュースリリース',
          'トップ > ニュースリリース',
          'こくみん政治塾',
          '中小企業・非正規賃上げ応援10策',
          '医療制度改革'
        ];

        if (excludeTitles.some(excludeTitle => title.includes(excludeTitle))) return;

        // 日付が取れない場合は保存しない
        const publishedAt = this.parseDate(dateStr);
        if (!publishedAt) return;
        const category = this.parseCategory(categoryStr);

        

        articles.push({
          title: title.substring(0, 200),
          url: fullUrl,
          publishedAt,
          category
        });
      });
    }

    // 重複を除去（URLベース）
    const uniqueArticles = articles.filter((article, index, self) => 
      index === self.findIndex(a => a.url === article.url)
    );

    
    return uniqueArticles;
  }

  private scrapeTeamPage($: cheerio.CheerioAPI): ScrapedArticle[] {
    const articles: ScrapedArticle[] = [];
    const seenUrls = new Set<string>();

    

    // チームページの構造に合わせたセレクター
    const selectors = [
      'a[href*="/team/"]',
      'a[href*="/member/"]',
      'a[href*="/update/"]',
      '.team-list a',
      '.member-list a',
      '.update-list a'
    ];

    for (const selector of selectors) {
      $(selector).each((_, element) => {
        const $link = $(element);
        const href = $link.attr('href');
        
        if (!href) return;

        const fullUrl = href.startsWith('http') 
          ? href 
          : `https://team.new-kokumin.jp${href}`;

        // 重複URLをスキップ
        if (seenUrls.has(fullUrl)) return;
        seenUrls.add(fullUrl);

        // タイトルを取得
        let title = $link.text().trim();
        if (!title) {
          title = $link.find('h1, h2, h3, h4, .title').first().text().trim();
        }
        if (!title) {
          title = $link.closest('article, .team-item, .member-item').find('h1, h2, h3, h4, .title').first().text().trim();
        }

        if (title && title.length > 5) {
          // 日付を取得
          const $parent = $link.closest('article, .team-item, .member-item, li, div');
          const dateText = $parent.find('.date, .published, time, .datetime').first().text().trim();
          const publishedAt = this.parseDate(dateText) || new Date();

          

          articles.push({
            title,
            url: fullUrl,
            publishedAt,
            category: 'team'
          });
        }
      });
    }

    // 重複を除去
    const uniqueArticles = articles.filter((article, index, self) => 
      index === self.findIndex(a => a.url === article.url)
    );

    
    return uniqueArticles;
  }

  private scrapeEventsPage($: cheerio.CheerioAPI): ScrapedEvent[] {
    const events: ScrapedEvent[] = [];
    const seenUrls = new Set<string>();

    

    // 不要なURLを除外するフィルター
    const excludeUrls = [
      'https://team.new-kokumin.jp/evinfo/',
      'https://team.new-kokumin.jp/',
      'https://team.new-kokumin.jp/evinfo',
    ];

    // より具体的なセレクターでイベント情報のみを対象とする
    const eventSelectors = [
      // 具体的な日付パターンを含む要素内のリンク
      'li:contains("2025") a',
      'div:contains("2025") a',
      'tr:contains("2025") a',
      // イベント記事の直接リンク（2025年のもののみ）
      'a[href*="/evinfo/2025"]',
      'a[href*="/event/2025"]',
      // 日付を含むテーブル行やリスト項目内のリンク
      'td:contains("2025") a',
      'li:contains("月") a'
    ];

    for (const selector of eventSelectors) {
      $(selector).each((_, element) => {
        const $link = $(element);
        const href = $link.attr('href');
        
        if (!href) return;

        const fullUrl = href.startsWith('http') 
          ? href 
          : `https://team.new-kokumin.jp${href}`;

        // 除外URLをスキップ
        if (excludeUrls.includes(fullUrl)) return;

        // 重複URLをスキップ
        if (seenUrls.has(fullUrl)) return;
        seenUrls.add(fullUrl);

        // 親要素から情報を取得
        const $parent = $link.closest('li, div, tr, td');
        const parentText = $parent.text().trim();

        // 日付パターンをチェック（複数の形式に対応）
        const datePatterns = [
          /(\d{4}年\d{1,2}月\d{1,2}日)/, // 2025年10月3日
          /(\d{4}\/\d{1,2}\/\d{1,2})/, // 2025/10/3
          /(\d{4}\.\d{1,2}\.\d{1,2})/, // 2025.10.3
          /(\d{1,2}月\d{1,2}日)/, // 10月3日
        ];

        let eventDate: Date | undefined;
        let hasValidDate = false;

        for (const pattern of datePatterns) {
          const dateMatch = parentText.match(pattern);
          if (dateMatch) {
            eventDate = this.parseDate(dateMatch[1]);
            if (eventDate) {
              hasValidDate = true;
              break;
            }
          }
        }

        // 日付パターンがない場合はスキップ
        if (!hasValidDate) return;

        // タイトルを取得
        let title = $link.text().trim();
        if (!title || title.length < 5) {
          // リンクテキストが短い場合は親要素から取得
          const linkText = $link.text().trim();
          const siblingText = $link.siblings().text().trim();
          title = linkText || siblingText;
        }

        // タイトルが短すぎる場合はスキップ
        if (!title || title.length < 5) return;

        // 不要なタイトルをフィルタリング
        const excludeTitles = [
          'イベント情報',
          'ボランティア情報',
          'トップ',
          'ホーム',
          '詳細',
          '申込み'
        ];

        if (excludeTitles.some(excludeTitle => title.includes(excludeTitle))) return;

        // 都道府県の取得（officialページのprefectureフィールド用）
        const prefectureMap = {
          '北海道': '01', '青森': '02', '岩手': '03', '宮城': '04', '秋田': '05', '山形': '06', '福島': '07',
          '茨城': '08', '栃木': '09', '群馬': '10', '埼玉': '11', '千葉': '12', '東京': '13', '神奈川': '14',
          '新潟': '15', '富山': '16', '石川': '17', '福井': '18', '山梨': '19', '長野': '20', '岐阜': '21',
          '静岡': '22', '愛知': '23', '三重': '24', '滋賀': '25', '京都': '26', '大阪': '27', '兵庫': '28',
          '奈良': '29', '和歌山': '30', '鳥取': '31', '島根': '32', '岡山': '33', '広島': '34', '山口': '35',
          '徳島': '36', '香川': '37', '愛媛': '38', '高知': '39', '福岡': '40', '佐賀': '41', '長崎': '42',
          '熊本': '43', '大分': '44', '宮崎': '45', '鹿児島': '46', '沖縄': '47'
        };

        let prefecture = '48'; // デフォルトは「全国どこでも」
        let location = '';
        
        // 「全国どこでも」の場合
        if (parentText.includes('全国どこでも') || parentText.includes('全国')) {
          prefecture = '48';
          location = '全国どこでも';
        } else {
          // 都道府県名を検索
          for (const [prefName, prefCode] of Object.entries(prefectureMap)) {
            if (parentText.includes(prefName)) {
              prefecture = prefCode;
              location = prefName;
              break;
            }
          }
        }

        // イベントタイプの推定（より詳細に分類）
        let eventType = 'other';
        const titleLower = title.toLowerCase();
        const parentTextLower = parentText.toLowerCase();
        
        if (titleLower.includes('候補者募集') || parentTextLower.includes('候補者募集')) {
          eventType = 'candidate_recruitment';
        } else if (titleLower.includes('街頭') || titleLower.includes('集会') || titleLower.includes('rally') || 
                   parentTextLower.includes('街頭') || parentTextLower.includes('集会')) {
          eventType = 'street_campaign_support';
        } else if (titleLower.includes('ポスティング') || parentTextLower.includes('ポスティング')) {
          eventType = 'poster_posting';
        } else if (titleLower.includes('ポスター') || parentTextLower.includes('ポスター掲示')) {
          eventType = 'poster_display';
        } else if (titleLower.includes('室内') || parentTextLower.includes('室内')) {
          eventType = 'indoor_work';
        } else if (titleLower.includes('キャンパス') || parentTextLower.includes('キャンパス')) {
          eventType = 'citizen_campus';
        } else if (titleLower.includes('タウンミーティング') || titleLower.includes('会議') || 
                   parentTextLower.includes('タウンミーティング') || parentTextLower.includes('懇談')) {
          eventType = 'town_meeting';
        } else if (titleLower.includes('オフ会') || parentTextLower.includes('オフ会')) {
          eventType = 'off_meeting';
        } else if (titleLower.includes('ボランティア') || titleLower.includes('volunteer') || 
                   parentTextLower.includes('ボランティア') || parentTextLower.includes('支援')) {
          eventType = 'indoor_event_support';
        }

        // 説明の取得（親要素のテキストから）
        let description = parentText.replace(title, '').trim();
        if (description.length > 100) {
          description = description.substring(0, 100) + '...';
        }

        

        events.push({
          title: title.substring(0, 200),
          url: fullUrl,
          description: description || undefined,
          eventDate: eventDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          location: location || undefined,
          prefecture: prefecture || undefined, // officialページ用のprefectureフィールドを追加
          eventType,
          registrationRequired: parentText.includes('申込') || parentText.includes('登録')
        });
      });
    }

    // 重複を除去（URLベース）
    const uniqueEvents = events.filter((event, index, self) => 
      index === self.findIndex(e => e.url === event.url)
    );

    
    return uniqueEvents;
  }

  // 「最近追加された情報」セクションのみから抽出
  private async scrapeRecentAddedEvents($: cheerio.CheerioAPI): Promise<ScrapedEvent[]> {
    const events: ScrapedEvent[] = [];
    const seenUrls = new Set<string>();

    // 見出しを特定（型安全のため toArray で走査）
    const headers = $('h1, h2, h3, h4').toArray();
    const headerEl = headers.find(el => $(el).text().includes('最近追加された情報'));
    let $container: cheerio.Cheerio<any> = headerEl ? $(headerEl).parent() as any : $('body') as any;

    // 見出し直下〜近傍のリスト・ブロックに限定（context 指定で取得して型エラー回避）
    let scope: cheerio.Cheerio<any> = $('ul, ol, div, section', $container as any).first() as any;
    if (scope.length === 0) scope = $container as any;

    // 対象リンクを抽出
    scope.find('a[href]').each((_, el) => {
      const $link = $(el);
      const href = $link.attr('href');
      if (!href) return;

      const fullUrl = href.startsWith('http') ? href : `https://team.new-kokumin.jp${href}`;
      if (!/https?:\/\/team\.new-kokumin\.jp\/(evinfo|event)\//.test(fullUrl)) return;
      if (seenUrls.has(fullUrl)) return;
      seenUrls.add(fullUrl);

      // 親要素テキストから日付や補足を取得
      const $parent = $link.closest('li, div, tr, td');
      const parentText = $parent.text().trim();

      // 日付抽出
      const datePatterns = [
        /(\d{4}年\d{1,2}月\d{1,2}日)/,
        /(\d{4}\/\d{1,2}\/\d{1,2})/,
        /(\d{4}\.\d{1,2}\.\d{1,2})/,
        /(\d{1,2}月\d{1,2}日)/,
      ];
      let eventDate: Date | undefined;
      for (const pattern of datePatterns) {
        const m = parentText.match(pattern);
        if (m) {
          const d = this.parseDate(m[1]);
          if (d) { eventDate = d; break; }
        }
      }

      // タイトル
      let title = $link.text().trim();
      if (!title) {
        title = $link.closest('li, div, tr').find('h1, h2, h3, h4, .title').first().text().trim();
      }
      if (!title || title.length < 5) return;

      // 都道府県・場所（簡易）
      const prefectureMap = {
        '北海道': '01', '青森': '02', '岩手': '03', '宮城': '04', '秋田': '05', '山形': '06', '福島': '07',
        '茨城': '08', '栃木': '09', '群馬': '10', '埼玉': '11', '千葉': '12', '東京': '13', '神奈川': '14',
        '新潟': '15', '富山': '16', '石川': '17', '福井': '18', '山梨': '19', '長野': '20', '岐阜': '21',
        '静岡': '22', '愛知': '23', '三重': '24', '滋賀': '25', '京都': '26', '大阪': '27', '兵庫': '28',
        '奈良': '29', '和歌山': '30', '鳥取': '31', '島根': '32', '岡山': '33', '広島': '34', '山口': '35',
        '徳島': '36', '香川': '37', '愛媛': '38', '高知': '39', '福岡': '40', '佐賀': '41', '長崎': '42',
        '熊本': '43', '大分': '44', '宮崎': '45', '鹿児島': '46', '沖縄': '47'
      } as const;
      let prefecture = '48';
      let location = '';
      if (parentText.includes('全国どこでも') || parentText.includes('全国')) {
        prefecture = '48';
        location = '全国どこでも';
      } else {
        for (const [prefName, prefCode] of Object.entries(prefectureMap)) {
          if (parentText.includes(prefName)) { prefecture = prefCode; location = prefName; break; }
        }
      }

      // 種別（簡易推定）
      let eventType = 'other';
      const lt = title.toLowerCase();
      const lp = parentText.toLowerCase();
      if (lt.includes('候補者募集') || lp.includes('候補者募集')) eventType = 'candidate_recruitment';
      else if (lt.includes('街頭') || lt.includes('集会') || lp.includes('街頭') || lp.includes('集会')) eventType = 'street_campaign_support';
      else if (lt.includes('ポスティング') || lp.includes('ポスティング')) eventType = 'poster_posting';
      else if (lt.includes('ポスター') || lp.includes('ポスター掲示')) eventType = 'poster_display';
      else if (lt.includes('室内') || lp.includes('室内')) eventType = 'indoor_work';
      else if (lt.includes('キャンパス') || lp.includes('キャンパス')) eventType = 'citizen_campus';
      else if (lt.includes('タウンミーティング') || lp.includes('タウンミーティング') || lt.includes('会議') || lp.includes('懇談')) eventType = 'town_meeting';
      else if (lt.includes('オフ会') || lp.includes('オフ会')) eventType = 'off_meeting';
      else if (lt.includes('ボランティア') || lp.includes('ボランティア')) eventType = 'indoor_event_support';

      let description = $link.closest('li, div').text().trim();
      if (description.startsWith(title)) description = description.slice(title.length).trim();
      if (description.length > 100) description = description.substring(0, 100) + '...';

      events.push({
        title: title.substring(0, 200),
        url: fullUrl,
        description: description || undefined,
        eventDate: eventDate || new Date(),
        location: location || undefined,
        prefecture: prefecture || undefined,
        eventType,
        registrationRequired: parentText.includes('申込') || parentText.includes('登録')
      });
    });

    // 重複除去
    const unique = events.filter((e, i, self) => i === self.findIndex(s => s.url === e.url));
    return unique;
  }

  // 渡されたイベント配列から、Supabaseに未登録のものだけを返す
  private async filterUnregisteredEvents(events: ScrapedEvent[]): Promise<ScrapedEvent[]> {
    if (!events.length) return [];
    const urls = events.map(e => e.url);
    const { data: existing, error } = await supabaseAdmin
      .from('official_events')
      .select('url')
      .in('url', urls);
    if (error) {
      console.error('Error checking existing events:', error);
      return events; // フォールバック（保存側でも重複回避するため安全）
    }
    const existingSet = new Set((existing || []).map(r => r.url));
    return events.filter(e => !existingSet.has(e.url));
  }

  private parseDate(dateText: string): Date | undefined {
    if (!dateText) return undefined;

    // 日本語の日付形式を解析
    const patterns = [
      /(\d{4})\.(\d{1,2})\.(\d{1,2})/, // 2025.10.03 形式
      /(\d{4})年(\d{1,2})月(\d{1,2})日/,
      /(\d{4})\/(\d{1,2})\/(\d{1,2})/,
      /(\d{4})-(\d{1,2})-(\d{1,2})/
    ];

    for (const pattern of patterns) {
      const match = dateText.match(pattern);
      if (match) {
        const [, year, month, day] = match;
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      }
    }

    return undefined;
  }

  private parseCategory(categoryText: string): string {
    if (!categoryText) return 'party_hq';

    // カテゴリーマッピング
    const categoryMap: { [key: string]: string } = {
      '党務': 'party_hq',
      '政策': 'policy',
      '国会': 'parliament',
      '選挙': 'election',
      '党宣言': 'party_declaration',
      'お知らせ': 'announcement',
      '国民民主プレス': 'national_democratic_press_outer',
      'その他': 'other'
    };

    // 完全一致を試す
    if (categoryMap[categoryText]) {
      return categoryMap[categoryText];
    }

    // 部分一致を試す
    for (const [key, value] of Object.entries(categoryMap)) {
      if (categoryText.includes(key)) {
        return value;
      }
    }

    return 'party_hq'; // デフォルト
  }

  private async fetchArticleContent(url: string): Promise<string | undefined> {
    try {
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      
      // 記事本文を取得するための複数のセレクターを試す
      const contentSelectors = [
        '.article-content',
        '.post-content', 
        '.entry-content',
        '.content',
        'main p',
        'article p',
        '.text p',
        'p'
      ];

      let content = '';
      for (const selector of contentSelectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          // 最初の段落のテキストを取得
          content = elements.first().text().trim();
          if (content.length > 10) { // 意味のあるコンテンツがある場合
            break;
          }
        }
      }

      // 最初の50文字を返す
      if (content.length > 50) {
        return content.substring(0, 50) + '...';
      }
      
      return content || undefined;
    } catch (error) {
      console.error(`Error fetching content from ${url}:`, error);
      return undefined;
    }
  }

  private async fetchThumbnailUrl(url: string): Promise<string | undefined> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);

      // 優先順: og:image > twitter:image > link rel="image_src" > 最初のimg
      const ogImage = $('meta[property="og:image"]').attr('content') || $('meta[name="og:image"]').attr('content');
      if (ogImage) return ogImage;
      const twitterImage = $('meta[name="twitter:image"]').attr('content') || $('meta[name="twitter:image:src"]').attr('content');
      if (twitterImage) return twitterImage;
      const linkImage = $('link[rel="image_src"]').attr('href');
      if (linkImage) return linkImage;
      const firstImg = $('img').first().attr('src');
      if (firstImg) return firstImg.startsWith('http') ? firstImg : new URL(firstImg, url).toString();

      return undefined;
    } catch (error) {
      console.error(`Error fetching thumbnail from ${url}:`, error);
      return undefined;
    }
  }

  private async saveArticles(articles: ScrapedArticle[], sourceUrl: string): Promise<void> {
      

    for (const article of articles) {
      try {
        // 既存のURLをチェックして重複を避ける
        const { data: existingArticle } = await supabaseAdmin
          .from('official_news')
          .select('id')
          .eq('url', article.url)
          .single();

        if (existingArticle) {
          continue;
        }

        // コンテンツを取得（最初の50文字）
        let content = article.content;
        if (!content && article.url) {
          content = await this.fetchArticleContent(article.url);
        }

        // サムネイルURLを取得
        const thumbnailUrl = await this.fetchThumbnailUrl(article.url);

        // スクレイピング時に取得したカテゴリーを使用、なければデフォルト
        let category = article.category || 'party_hq';
        if (sourceUrl.includes('team.new-kokumin.jp')) {
          category = 'announcement'; // チーム情報はお知らせとして扱う
        }

        

        const { data, error } = await supabaseAdmin
          .from('official_news')
          .insert({
            title: article.title,
            url: article.url,
            content: content,
            published_at: article.publishedAt?.toISOString() || new Date().toISOString(),
            category: category,
            thumbnail_url: thumbnailUrl || null
          })
          .select();

        if (error) {
          console.error('Error saving article:', error);
        } else {
          
        }
      } catch (error) {
        console.error('Error saving article:', error);
      }
    }
  }

  private async saveEvents(events: ScrapedEvent[], sourceUrl: string): Promise<void> {
    

    for (const event of events) {
      try {
        // 既存のURLをチェックして重複を避ける
        const { data: existingEvent } = await supabaseAdmin
          .from('official_events')
          .select('id')
          .eq('url', event.url)
          .single();

        if (existingEvent) {
          continue;
        }

        // official_eventsテーブルのカテゴリーに合わせてマッピング
        // public/category.tsxのeventTypeLabelsに合わせる
        let category = 'other';
        if (event.eventType === 'rally') {
          category = 'street_campaign_support';
        } else if (event.eventType === 'meeting') {
          category = 'town_meeting';
        } else if (event.eventType === 'volunteer') {
          category = 'poster_posting';
        }

        

        // サムネイルURLを取得
        const thumbnailUrl = await this.fetchThumbnailUrl(event.url);

        const { data, error } = await supabaseAdmin
          .from('official_events')
          .insert({
            title: event.title,
            url: event.url,
            description: event.description,
            event_date: event.eventDate?.toISOString() || new Date().toISOString(),
            location: event.location,
            prefecture: event.prefecture,
            category: category,
            thumbnail_url: thumbnailUrl || null
          })
          .select();

        if (error) {
          console.error('Error saving event:', error);
        } else {
          
        }
      } catch (error) {
        console.error('Error saving event:', error);
      }
    }
  }

  private async logScraping(sourceUrl: string, status: 'success' | 'error' | 'partial', errorMessage?: string): Promise<void> {
    // scraping_logsテーブルが削除されたため、コンソールログのみ
    
  }

  // ユーザーの設定に基づいてタイムラインを更新
  async updateUserTimelines(): Promise<void> {
    const { data: users } = await supabaseAdmin
      .from('profiles')
      .select('id');

    if (!users) return;

    for (const user of users) {
      await this.updateUserTimeline(user.id);
      await this.updateUserEventTimeline(user.id);
    }
  }

  private async updateUserTimeline(userId: string): Promise<void> {
    // ユーザーのフィルター設定を取得
    const { data: filterPrefs } = await supabaseAdmin
      .from('user_filter_preferences')
      .select('news_categories')
      .eq('user_id', userId)
      .single();

    // フィルター設定がない場合はデフォルトカテゴリーを使用
    const categories = filterPrefs?.news_categories || [
      'party_hq', 'policy', 'parliament', 'election', 'party_declaration', 
      'announcement', 'national_democratic_press_outer', 'other'
    ];

    // 設定に基づいてニュースを取得
    const { data: matchingNews } = await supabaseAdmin
      .from('official_news')
      .select('id, title, url, published_at, category')
      .in('category', categories)
      .order('published_at', { ascending: false })
      .limit(50);

    if (!matchingNews) return;

    // タイムラインに追加（重複は自動的に除外される）
    for (const news of matchingNews) {
      await supabaseAdmin
        .from('user_timeline')
        .upsert({
          user_id: userId,
          news_id: news.id
        }, {
          onConflict: 'user_id,news_id'
        });
    }
  }

  private async updateUserEventTimeline(userId: string): Promise<void> {
    // ユーザーのフィルター設定を取得
    const { data: filterPrefs } = await supabaseAdmin
      .from('user_filter_preferences')
      .select('event_categories')
      .eq('user_id', userId)
      .single();

    // フィルター設定がない場合はデフォルトカテゴリーを使用
    const categories = filterPrefs?.event_categories || [
      'candidate_recruitment', 'street_campaign_support', 'party_hq_regular_posting',
      'poster_posting', 'poster_display', 'indoor_work', 'indoor_event_support',
      'citizen_campus', 'town_meeting', 'off_meeting', 'other'
    ];

    // 設定に基づいてイベントを取得
    const { data: matchingEvents } = await supabaseAdmin
      .from('official_events')
      .select('id, title, url, event_date, category, location')
      .in('category', categories)
      .gte('event_date', new Date().toISOString()) // 未来のイベントのみ
      .order('event_date', { ascending: true })
      .limit(50);

    if (!matchingEvents) return;

    // イベントタイムラインに追加（重複は自動的に除外される）
    for (const event of matchingEvents) {
      await supabaseAdmin
        .from('user_event_timeline')
        .upsert({
          user_id: userId,
          event_id: event.id
        }, {
          onConflict: 'user_id,event_id'
        });
    }
  }
}