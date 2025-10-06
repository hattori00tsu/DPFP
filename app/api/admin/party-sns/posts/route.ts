import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 政党SNS投稿一覧取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');
    const partyId = searchParams.get('party_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('party_sns_posts')
      .select(`
        *,
        parties!inner(name, name_en),
        party_sns_accounts!inner(account_name, account_handle)
      `)
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (platform) {
      query = query.eq('platform', platform);
    }

    if (partyId) {
      query = query.eq('party_id', partyId);
    }

    const { data: posts, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 総件数も取得
    let countQuery = supabase
      .from('party_sns_posts')
      .select('*', { count: 'exact', head: true });

    if (platform) {
      countQuery = countQuery.eq('platform', platform);
    }

    if (partyId) {
      countQuery = countQuery.eq('party_id', partyId);
    }

    const { count } = await countQuery;

    return NextResponse.json({ 
      posts,
      total: count || 0,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching party SNS posts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 手動スクレイピング実行
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { account_id } = body;

    if (!account_id) {
      return NextResponse.json(
        { error: 'アカウントIDが必要です' },
        { status: 400 }
      );
    }

    // Supabase Edge Functionを呼び出し（関数名を最新に合わせる）
    const { data, error } = await supabase.functions.invoke('party-official-sns-scraper', {
      body: { account_id }
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'スクレイピングを開始しました',
      data 
    });
  } catch (error) {
    console.error('Error triggering manual scraping:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}