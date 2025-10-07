import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 政党SNSアカウント一覧取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');

    let query = supabase
      .from('party_sns_accounts')
      .select(`
        *,
        parties!inner(name, name_en)
      `)
      .order('created_at', { ascending: false });

    if (platform) {
      query = query.eq('platform', platform);
    }

    const { data: accounts, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error('Error fetching party SNS accounts:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 政党SNSアカウント作成・更新
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      party_id,
      platform,
      account_name,
      account_handle,
      account_url,
      rss_url,
      rss_feed_id,
      scraping_method,
      is_active
    } = body;

    // 必須フィールドの検証
    if (!party_id || !platform || !account_handle || !account_url) {
      return NextResponse.json(
        { error: '必須フィールドが不足しています' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('party_sns_accounts')
      .upsert({
        party_id,
        platform,
        account_name,
        account_handle,
        account_url,
        rss_url,
        rss_feed_id,
        scraping_method: scraping_method || 'rss',
        is_active: is_active !== undefined ? is_active : true,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'party_id,platform,account_handle'
      })
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ account: data[0] });
  } catch (error) {
    console.error('Error creating/updating party SNS account:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 政党SNSアカウント削除
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('id');

    if (!accountId) {
      return NextResponse.json(
        { error: 'アカウントIDが必要です' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('party_sns_accounts')
      .delete()
      .eq('id', accountId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting party SNS account:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}