import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2024-06-20' });

function planKeyFromPrice(priceId?: string | null): string | null {
  if (!priceId) return null;
  const map: Record<string, string | undefined> = {
    [process.env.STRIPE_PRICE_ID_SUPPORT_330 || '']: 'support_330',
    [process.env.STRIPE_PRICE_ID_SUPPORT_1100 || '']: 'support_1100',
    [process.env.STRIPE_PRICE_ID_SUPPORT_3300 || '']: 'support_3300',
  };
  return map[priceId] || null;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Search subscription by metadata.user_id
    let sub: Stripe.Subscription | null = null;
    try {
      // @ts-ignore: search availability
      const res = await stripe.subscriptions.search({
        query: `metadata['user_id']:'${user.id}'`,
        limit: 1,
      });
      sub = (res?.data && res.data.length > 0) ? res.data[0] : null;
    } catch (e) {
      // fallback: no search - not expected since we set metadata
      sub = null;
    }

    if (!sub) return NextResponse.json({ ok: true, message: 'No subscription found for user' });

    const priceId = (sub.items?.data?.[0]?.price?.id as string | undefined) || undefined;
    const planKey = planKeyFromPrice(priceId);
    if (!planKey) return NextResponse.json({ ok: false, error: 'Plan key not mapped from price' }, { status: 500 });

    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('id')
      .eq('plan_key', planKey)
      .single();
    if (!plan) return NextResponse.json({ ok: false, error: 'Plan not found' }, { status: 500 });

    const item: any = sub.items?.data?.[0] || {};
    const cps = (sub as any).current_period_start || item?.current_period_start || null;
    const cpe = (sub as any).current_period_end || item?.current_period_end || null;

    const payload: any = {
      user_id: user.id,
      plan_id: plan.id,
      status: sub.status,
      current_period_start: cps ? new Date(cps * 1000).toISOString() : null,
      current_period_end: cpe ? new Date(cpe * 1000).toISOString() : null,
      cancel_at_period_end: sub.cancel_at_period_end || false,
    };

    // Use service role to bypass RLS
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string
    );
    await admin.from('user_subscriptions').upsert(payload, { onConflict: 'user_id' });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('sync error', e);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}


