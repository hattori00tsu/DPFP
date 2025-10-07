import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type PlanRow = {
  id: string;
  plan_key: string;
  name: string;
  description: string | null;
  price_jpy: number;
  max_custom_timelines: number;
  is_active: boolean;
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const authHeader = request.headers.get('Authorization') || '';
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1) プラン一覧（有効のみ）
    const { data: plansData, error: plansError } = await client
      .from('subscription_plans')
      .select('id, plan_key, name, description, price_jpy, max_custom_timelines, is_active')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (plansError) throw plansError;

    // 2) ユーザーのサブスク（任意）
    let subscription: any = null;
    if (userId) {
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

      if (us) {
        // 可能なら plansData から名称等を解決。見つからない場合は個別取得。
        const byList = (plansData || []).find((p: PlanRow) => p.id === us.plan_id) as PlanRow | undefined;
        let planName = byList?.name || '—';
        let priceJpy = byList?.price_jpy || 0;
        let maxCustomTimelines = byList?.max_custom_timelines ?? 3;
        if (!byList) {
          const { data: planRow } = await client
            .from('subscription_plans')
            .select('id, name, price_jpy, max_custom_timelines')
            .eq('id', us.plan_id)
            .maybeSingle();
          if (planRow) {
            planName = planRow.name;
            priceJpy = planRow.price_jpy;
            maxCustomTimelines = planRow.max_custom_timelines;
          }
        }

        subscription = {
          planId: us.plan_id,
          planName,
          priceJpy,
          status: us.status,
          currentPeriodStart: us.current_period_start,
          currentPeriodEnd: us.current_period_end,
          maxCustomTimelines,
        };
      }
    }

    return NextResponse.json({
      plans: plansData || [],
      subscription,
    });
  } catch (error) {
    console.error('Error fetching subscription summary:', error);
    return NextResponse.json(
      { error: 'サブスクリプションサマリの取得に失敗しました' },
      { status: 500 }
    );
  }
}


