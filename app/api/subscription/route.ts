import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'ユーザーIDが必要です' }, { status: 400 });
  }

  try {
    const { data: us, error: usError } = await supabase
      .from('user_subscriptions')
      .select('id, plan_id, status, current_period_start, current_period_end')
      .eq('user_id', userId)
      .maybeSingle();

    if (usError && usError.code !== 'PGRST116') throw usError;

    if (!us) {
      return NextResponse.json({ subscription: null });
    }

    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('id, name, price_jpy')
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


