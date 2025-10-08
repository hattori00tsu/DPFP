import { NextRequest, NextResponse } from 'next/server';
import { SNSScraper } from '@/lib/sns-scraper';

export async function GET() {
  try {
    const scraper = new SNSScraper();
    const settings = await scraper.getPrefSNSSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json({ error: '設定の取得に失敗しました' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prefecture, platform, account_url, rss_url, scraping_url, youtube_channel_id, is_active } = body;

    if (!prefecture || !platform || !account_url) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 });
    }

    // YouTube: RSS自動生成
    let nextRss = rss_url;
    const p = String(platform || '').toLowerCase();
    if (!nextRss && (p === 'youtube' || p === 'iceage') && youtube_channel_id) {
      nextRss = `https://www.youtube.com/feeds/videos.xml?channel_id=${youtube_channel_id}`;
    }

    const scraper = new SNSScraper();
    const result = await scraper.createPrefSNSSetting({
      prefecture,
      platform,
      account_url,
      rss_url: nextRss,
      scraping_url,
      is_active
    } as any);

    if (!result.success) return NextResponse.json({ error: result.message }, { status: 400 });
    return NextResponse.json({ message: result.message, setting: result.data });
  } catch (error) {
    return NextResponse.json({ error: '設定の作成に失敗しました' }, { status: 500 });
  }
}


