import { NextRequest, NextResponse } from 'next/server';
import { PoliticianSNSScraper } from '@/lib/politician-sns-scraper';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const scraper = new PoliticianSNSScraper();
    const result = await scraper.scrapeOnePolitician(id);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error scraping politician SNS:', error);
    return NextResponse.json({ success: false, message: '議員SNS取得に失敗しました' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return POST(request, ctx);
}


