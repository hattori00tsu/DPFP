import { NextRequest, NextResponse } from 'next/server';
import { KokuminScraper } from '@/lib/scraper';
import { SNSScraper } from '@/lib/sns-scraper';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type } = body; // 'all', 'news', 'events', 'sns'

    const scraper = new KokuminScraper();
    const snsScraper = new SNSScraper();
    let result;

    switch (type) {
      case 'news':
        result = await scraper.scrapeNews();
        break;
      case 'events':
        result = await scraper.scrapeEvents();
        break;
      case 'sns':
        {
          const official = await snsScraper.scrapeAllActiveSNS();
          const pref = await snsScraper.scrapeAllActivePrefecturalSNS();
          const total = (official.count || 0) + (pref.count || 0);
          result = {
            success: official.success || pref.success,
            message: `SNS取得完了 (党本部: ${official.count || 0}件, 支部: ${pref.count || 0}件, 合計: ${total}件)`
          };
        }
        break;
      case 'all':
      default:
        // 全てのソースをスクレイピング
        await scraper.scrapeAllSources();
        const official = await snsScraper.scrapeAllActiveSNS();
        const pref = await snsScraper.scrapeAllActivePrefecturalSNS();
        const snsTotal = (official.count || 0) + (pref.count || 0);
        // ユーザータイムライン更新
        await scraper.updateUserTimelines();
        result = {
          success: true,
          message: `全てのスクレイピングが完了しました (SNS: 党本部 ${official.count || 0}件 / 支部 ${pref.count || 0}件, 合計 ${snsTotal}件)`
        };
        break;
    }

    // 個別実行の場合もユーザータイムラインを更新
    if (type !== 'all' && result && result.success) {
      try {
        await scraper.updateUserTimelines();
      } catch (timelineError) {
        console.error('Error updating user timelines:', timelineError);
        // タイムライン更新エラーは警告として扱い、メイン処理は成功とする
      }
    }

    return NextResponse.json(result || { success: false, message: 'Unknown error occurred' });
  } catch (error) {
    console.error('Scraping error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'スクレイピング中にエラーが発生しました'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'スクレイピングAPIエンドポイント',
    endpoints: {
      'POST /api/scrape': 'スクレイピングを実行'
    }
  });
}