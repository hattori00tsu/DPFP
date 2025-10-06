import { NextRequest, NextResponse } from 'next/server';
import { SNSScraper } from '@/lib/sns-scraper';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { platform, account_name, account_url, rss_url, scraping_url, is_active } = body;

    const scraper = new SNSScraper();
    const result = await scraper.updateSNSSetting(id, {
      platform,
      account_name,
      account_url,
      rss_url: rss_url || undefined,
      scraping_url: scraping_url || undefined,
      is_active
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
    console.error('Error updating SNS setting:', error);
    return NextResponse.json(
      { error: 'SNS設定の更新に失敗しました' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const scraper = new SNSScraper();
    const result = await scraper.deleteSNSSetting(id);

    if (result.success) {
      return NextResponse.json({ message: result.message });
    } else {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error deleting SNS setting:', error);
    return NextResponse.json(
      { error: 'SNS設定の削除に失敗しました' },
      { status: 500 }
    );
  }
}