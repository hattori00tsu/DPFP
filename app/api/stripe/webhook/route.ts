import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

async function upsertByPlanKey(userId: string, planKey: string, subscription?: Stripe.Subscription) {
  const { data: plan, error: planErr } = await supabaseAdmin
    .from('subscription_plans')
    .select('id')
    .eq('plan_key', planKey)
    .single();
  if (planErr || !plan) {
    console.error('plan lookup failed', planErr, planKey);
    return;
  }
  const payload: any = {
    user_id: userId,
    plan_id: plan.id,
    status: subscription?.status || 'active',
    stripe_customer_id: subscription?.customer as string | undefined,
    stripe_subscription_id: subscription?.id,
    stripe_price_id: (subscription?.items?.data?.[0]?.price?.id as string | undefined) || undefined,
  };
  if (subscription) {
    // Fallback: 一部APIバージョンではcurrent_period_*がitem側に存在
    const item = subscription.items?.data?.[0] as any;
    const cps = (subscription as any).current_period_start || item?.current_period_start || null;
    const cpe = (subscription as any).current_period_end || item?.current_period_end || null;

    payload.current_period_start = cps ? new Date(cps * 1000).toISOString() : null;
    payload.current_period_end = cpe ? new Date(cpe * 1000).toISOString() : null;
    payload.cancel_at_period_end = subscription.cancel_at_period_end || false;
  }
  await supabaseAdmin.from('user_subscriptions').upsert(payload, { onConflict: 'user_id' });
}

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
  const sig = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET as string;
  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const body = await request.text();
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed.', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = (session.client_reference_id || session.metadata?.user_id) as string | undefined;
        let planKey = (session.metadata?.plan_key || '') as string;
        let subscription: Stripe.Subscription | undefined;
        try {
          const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
            expand: ['line_items', 'subscription'],
          });
          subscription = typeof fullSession.subscription === 'string'
            ? await stripe.subscriptions.retrieve(fullSession.subscription)
            : (fullSession.subscription as Stripe.Subscription | undefined);
          if (!planKey) {
            const priceId = (fullSession as any).line_items?.data?.[0]?.price?.id || null;
            const fromPrice = planKeyFromPrice(priceId);
            if (fromPrice) planKey = fromPrice;
          }
        } catch (e) {
          console.error('Failed to retrieve full session/subscription', e);
        }
        // サブスクリプション詳細が取得できない場合は、このイベントでは更新せず後続イベントに委ねる
        if (!userId || !planKey || !subscription) break;
        await upsertByPlanKey(userId, planKey, subscription);
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.user_id as string | undefined;
        // metadataが無い場合はcustomerからの復元はスキップ（今回はCheckoutでmetadata付与済みの想定）
        if (!userId) break;
        let planKey = subscription.metadata?.plan_key as string | undefined;
        if (!planKey) {
          const priceId = (subscription.items?.data?.[0]?.price?.id as string | undefined) || undefined;
          planKey = planKeyFromPrice(priceId) || undefined;
        }
        if (!planKey) break;
        await upsertByPlanKey(userId, planKey, subscription);
        break;
      }
      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        if (typeof invoice.subscription === 'string') {
          const sub = await stripe.subscriptions.retrieve(invoice.subscription);
          const userId = sub.metadata?.user_id as string | undefined;
          let planKey = sub.metadata?.plan_key as string | undefined;
          if (!planKey) {
            const priceId = sub.items?.data?.[0]?.price?.id as string | undefined;
            planKey = planKeyFromPrice(priceId) || undefined;
          }
          if (userId && planKey) {
            await upsertByPlanKey(userId, planKey, sub);
          }
        }
        break;
      }
      default:
        break;
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    console.error('Webhook handler error:', e);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}


