import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('id, plan_key, name, price_jpy, max_custom_timelines, is_active')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ plans: data || [] });
  } catch (error) {
    console.error('Error fetching plans:', error);
    return NextResponse.json(
      { error: 'プラン一覧の取得に失敗しました' },
      { status: 500 }
    );
  }
}


