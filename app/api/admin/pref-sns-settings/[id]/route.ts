import { NextRequest, NextResponse } from 'next/server';
import { SNSScraper } from '@/lib/sns-scraper';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const p = String(body.platform || '').toLowerCase();
    const channelId = (body.youtube_channel_id || '').trim();
    if ((p === 'youtube' || p === 'iceage') && !body.rss_url && channelId) {
      body.rss_url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
    }
    const scraper = new SNSScraper();
    const result = await scraper.updatePrefSNSSetting(id, body);
    if (!result.success) return NextResponse.json({ error: result.message }, { status: 400 });
    return NextResponse.json({ message: result.message, setting: result.data });
  } catch (error) {
    return NextResponse.json({ error: '設定の更新に失敗しました' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const scraper = new SNSScraper();
    const result = await scraper.deletePrefSNSSetting(id);
    if (!result.success) return NextResponse.json({ error: result.message }, { status: 400 });
    return NextResponse.json({ message: result.message });
  } catch (error) {
    return NextResponse.json({ error: '設定の削除に失敗しました' }, { status: 500 });
  }
}


