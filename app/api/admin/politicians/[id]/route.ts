import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// 個別議員情報取得
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { data: politician, error } = await supabaseAdmin
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
          is_active,
          follower_count,
          is_verified,
          last_scraped_at
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({ politician });
  } catch (error) {
    console.error('Error fetching politician:', error);
    return NextResponse.json(
      { error: '議員情報の取得に失敗しました' },
      { status: 500 }
    );
  }
}

// 議員情報更新
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const {
      name,
      position,
      prefecture,
      region,
      party_role,
      bio,
      twitter_handle,
      profile_url,
      sns_accounts
    } = await request.json();

    // 議員情報を更新
    const { data: politician, error: politicianError } = await supabaseAdmin
      .from('politicians')
      .update({
        name,
        position,
        prefecture,
        region,
        party_role,
        bio,
        twitter_handle,
        profile_url
      })
      .eq('id', id)
      .select()
      .single();

    if (politicianError) throw politicianError;

    // 既存のSNSアカウントを削除
    await supabaseAdmin
      .from('politician_sns_accounts')
      .delete()
      .eq('politician_id', id);

    // 新しいSNSアカウント情報を作成
    if (sns_accounts && sns_accounts.length > 0) {
      const snsAccountsData = sns_accounts.map((account: any) => ({
        politician_id: id,
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
    console.error('Error updating politician:', error);
    return NextResponse.json(
      { error: '議員情報の更新に失敗しました' },
      { status: 500 }
    );
  }
}

// 議員削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // SNSアカウントは外部キー制約で自動削除される
    const { error } = await supabaseAdmin
      .from('politicians')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting politician:', error);
    return NextResponse.json(
      { error: '議員情報の削除に失敗しました' },
      { status: 500 }
    );
  }
}