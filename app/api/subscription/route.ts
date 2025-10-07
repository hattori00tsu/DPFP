import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'ユーザーIDが必要です' }, { status: 400 });
  }

  try {
    // 認証ヘッダーを引き継いだSupabaseクライアントを生成（RLSを本人権限で評価）
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const authHeader = request.headers.get('Authorization') || '';
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // 要求されたuserIdとトークンのユーザーが一致するかチェック
    const { data: userRes } = await client.auth.getUser();
    if (!userRes?.user || userRes.user.id !== userId) {
      return NextResponse.json({ error: '権限がありません' }, { status: 403 });
    }

    const { data: us, error: usError } = await client
      .from('user_subscriptions')
      .select('id, plan_id, status, current_period_start, current_period_end')
      .eq('user_id', userId)
      .maybeSingle();

    if (usError && usError.code !== 'PGRST116') throw usError;

    if (!us) {
      return NextResponse.json({ subscription: null });
    }

    const { data: plan, error: planError } = await client
      .from('subscription_plans')
      .select('id, name, price_jpy, max_custom_timelines')
      .eq('id', us.plan_id)
      .maybeSingle();

    if (planError && planError.code !== 'PGRST116') throw planError;

    return NextResponse.json({
      subscription: {
        planId: plan?.id || us.plan_id,
        planName: plan?.name || '—',
        priceJpy: plan?.price_jpy || 0,
        status: us.status,
        currentPeriodStart: us.current_period_start,
        currentPeriodEnd: us.current_period_end,
        maxCustomTimelines: plan?.max_custom_timelines ?? 3,
      }
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json(
      { error: 'サブスクリプションの取得に失敗しました' },
      { status: 500 }
    );
  }
}


