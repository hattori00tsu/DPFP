import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// 議員一覧取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');
    const prefecture = searchParams.get('prefecture');
    const position = searchParams.get('position');

    let query = supabaseAdmin
      .from('politicians')
      .select(`
        *,
        politician_sns_accounts (
          id,
          platform,
          account_handle,
          account_url,
          rss_url,
          rss_feed_id,
          is_active
        )
      `)
      .order('name');

    if (name && name.trim() !== '') {
      // 部分一致（大文字小文字・かなカナはDB依存。ここではILIKEを使用）
      query = query.ilike('name', `%${name.trim()}%`);
    }

    if (prefecture && prefecture.trim() !== '') {
      query = query.eq('prefecture', prefecture.trim());
    }

    if (position && position.trim() !== '') {
      query = query.eq('position', position.trim());
    }

    const { data: politicians, error } = await query;

    if (error) throw error;

    return NextResponse.json({ politicians });
  } catch (error) {
    console.error('Error fetching politicians:', error);
    return NextResponse.json(
      { error: '議員情報の取得に失敗しました' },
      { status: 500 }
    );
  }
}

// 議員新規作成
export async function POST(request: NextRequest) {
  try {
    const {
      name,
      position,
      prefecture,
      party_role,
      bio,
      profile_url,
      sns_accounts
    } = await request.json();

    // 議員情報を作成
    const { data: politician, error: politicianError } = await supabaseAdmin
      .from('politicians')
      .insert({
        name,
        position,
        prefecture,
        party_role,
        bio,
        profile_url
      })
      .select()
      .single();

    if (politicianError) throw politicianError;

    // SNSアカウント情報を作成
    if (sns_accounts && sns_accounts.length > 0) {
      const snsAccountsData = sns_accounts.map((account: any) => ({
        politician_id: politician.id,
        platform: account.platform,
        account_handle: account.account_handle,
        account_url: account.account_url,
        rss_url: account.rss_url,
        rss_feed_id: account.rss_feed_id,
        is_active: account.is_active ?? true
      }));

      const { error: snsError } = await supabaseAdmin
        .from('politician_sns_accounts')
        .insert(snsAccountsData);

      if (snsError) throw snsError;
    }

    return NextResponse.json({ 
      success: true, 
      politician 
    });
  } catch (error) {
    console.error('Error creating politician:', error);
    return NextResponse.json(
      { error: '議員情報の作成に失敗しました' },
      { status: 500 }
    );
  }
}