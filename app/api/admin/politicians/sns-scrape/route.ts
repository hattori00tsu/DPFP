import { NextRequest, NextResponse } from 'next/server';
import { PoliticianSNSScraper } from '@/lib/politician-sns-scraper';

export async function POST(_request: NextRequest) {
  try {
    const scraper = new PoliticianSNSScraper();
    const result = await scraper.scrapeAllPoliticians();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error scraping all politicians SNS:', error);
    return NextResponse.json({ success: false, message: '議員SNS取得に失敗しました' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}


