import { NextRequest, NextResponse } from 'next/server';
import { SNSScraper } from '@/lib/sns-scraper';

export async function GET() {
  try {
    const scraper = new SNSScraper();
    const settings = await scraper.getSNSSettings();
    
    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error fetching SNS settings:', error);
    return NextResponse.json(
      { error: 'SNS設定の取得に失敗しました' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { platform, account_name, account_url, rss_url, scraping_url, is_active } = body;

    if (!platform || !account_name || !account_url) {
      return NextResponse.json(
        { error: 'プラットフォーム、アカウント名、アカウントURLは必須です' },
        { status: 400 }
      );
    }

    const scraper = new SNSScraper();
    const result = await scraper.createSNSSetting({
      platform,
      account_name,
      account_url,
      rss_url: rss_url || undefined,
      scraping_url: scraping_url || undefined,
      is_active: is_active !== undefined ? is_active : true
    });

    if (result.success) {
      return NextResponse.json({ 
        message: result.message,
        setting: result.data 
      });
    } else {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error creating SNS setting:', error);
    return NextResponse.json(
      { error: 'SNS設定の作成に失敗しました' },
      { status: 500 }
    );
  }
}