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
        result = await snsScraper.scrapeAllActiveSNS();
        break;
      case 'all':
      default:
        // 全てのソースをスクレイピング
        await scraper.scrapeAllSources();
        const snsResult = await snsScraper.scrapeAllActiveSNS();
        // ユーザータイムライン更新
        await scraper.updateUserTimelines();
        result = {
          success: true,
          message: `全てのスクレイピングが完了しました (SNS: ${snsResult.count || 0}件)`
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