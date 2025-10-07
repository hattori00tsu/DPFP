import { NextRequest, NextResponse } from 'next/server';
import { PoliticianSNSScraper } from '@/lib/politician-sns-scraper';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId } = await params;
    const scraper = new PoliticianSNSScraper();
    const result = await scraper.scrapeOneAccount(accountId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error scraping SNS account:', error);
    return NextResponse.json({ success: false, message: 'SNSアカウントの取得に失敗しました' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ accountId: string }> }) {
  return POST(request, ctx);
}

