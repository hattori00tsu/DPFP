import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

const PLAN_KEY_TO_PRICE_ENV: Record<string, string> = {
  support_330: 'STRIPE_PRICE_ID_SUPPORT_330',
  support_1100: 'STRIPE_PRICE_ID_SUPPORT_1100',
  support_3300: 'STRIPE_PRICE_ID_SUPPORT_3300',
};

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { planKey } = await request.json();
    if (!planKey || !PLAN_KEY_TO_PRICE_ENV[planKey]) {
      return NextResponse.json({ error: 'Invalid planKey' }, { status: 400 });
    }

    const priceId = process.env[PLAN_KEY_TO_PRICE_ENV[planKey]];
    if (!priceId) {
      return NextResponse.json({ error: 'Price ID not configured' }, { status: 500 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer_email: user.email || undefined,
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan_key: planKey,
        },
      },
      success_url: `${request.nextUrl.origin}/profile?subscribed=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.nextUrl.origin}/pricing?canceled=1`,
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
        plan_key: planKey,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json({ error: 'Checkout failed' }, { status: 500 });
  }
}


