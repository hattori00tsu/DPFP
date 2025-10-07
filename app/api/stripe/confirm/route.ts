import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

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
    const { session_id: sessionId } = await request.json();
    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session_id' }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'subscription'],
    });

    const userId = (session.client_reference_id || (session.metadata as any)?.user_id) as string | undefined;
    let planKey = ((session.metadata as any)?.plan_key || '') as string;

    let subscription: Stripe.Subscription | undefined;
    if (typeof session.subscription === 'string') {
      subscription = await stripe.subscriptions.retrieve(session.subscription);
    } else {
      subscription = session.subscription as Stripe.Subscription | undefined;
    }

    if (!planKey) {
      const priceId = (session as any).line_items?.data?.[0]?.price?.id || null;
      const fromPrice = planKeyFromPrice(priceId);
      if (fromPrice) planKey = fromPrice;
    }

    if (!userId || !planKey || !subscription) {
      return NextResponse.json({ ok: false, message: 'Insufficient data to confirm' }, { status: 200 });
    }

    // upsert to user_subscriptions
    const { data: plan, error: planErr } = await supabaseAdmin
      .from('subscription_plans')
      .select('id')
      .eq('plan_key', planKey)
      .single();
    if (planErr || !plan) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 500 });
    }

    const item: any = subscription.items?.data?.[0] || {};
    const cps = (subscription as any).current_period_start || item?.current_period_start || null;
    const cpe = (subscription as any).current_period_end || item?.current_period_end || null;

    const payload: any = {
      user_id: userId,
      plan_id: plan.id,
      status: subscription.status,
      current_period_start: cps ? new Date(cps * 1000).toISOString() : null,
      current_period_end: cpe ? new Date(cpe * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      stripe_customer_id: subscription.customer as string | undefined,
      stripe_subscription_id: subscription.id,
      stripe_price_id: (subscription.items?.data?.[0]?.price?.id as string | undefined) || undefined,
    };

    await supabaseAdmin.from('user_subscriptions').upsert(payload, { onConflict: 'user_id' });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('confirm error', e);
    return NextResponse.json({ error: 'Confirm failed' }, { status: 500 });
  }
}


