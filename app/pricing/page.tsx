'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Layout } from '@/components/Layout';
import useSWR from 'swr';

type Plan = {
  id: string;
  plan_key: string;
  name: string;
  description: string | null;
  price_jpy: number;
  max_custom_timelines: number;
  is_active: boolean;
};

type UserSubscription = {
  id: string;
  user_id: string;
  plan_id: string;
  
};

export default function PricingPage() {
  const [current, setCurrent] = useState<UserSubscription | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const jsonFetcher = async (url: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
  };

  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUserId(session?.user?.id ?? null);
    })();
  }, []);

  const { data: summaryResp, isLoading } = useSWR(
    '/api/subscriptions/summary' + (userId ? `?userId=${userId}` : ''),
    jsonFetcher
  );
  const plans: Plan[] = summaryResp?.plans ?? [];
  const subscription = summaryResp?.subscription ?? null;
  useEffect(() => {
    if (subscription) {
      setCurrent({ id: 'current', user_id: userId || '', plan_id: subscription.planId } as any);
    }
  }, [subscription, userId]);

  const selectedPlanId = current?.plan_id || null;
  const selectedPlan = useMemo(() => plans.find((p) => p.id === selectedPlanId) || null, [plans, selectedPlanId]);

  const handleSelect = async (planId: string) => {
    try {
      setUpdating(planId);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/auth';
        return;
      }

      if (!current) {
        const { error } = await supabase
          .from('user_subscriptions')
          .insert({ user_id: session.user.id, plan_id: planId, status: 'active' });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_subscriptions')
          .update({ plan_id: planId, status: 'active', cancel_at_period_end: false, canceled_at: null })
          .eq('id', current.id);
        if (error) throw error;
      }

      setCurrent((prev) => (prev ? { ...prev, plan_id: planId, status: 'active' } : prev));
      alert('プランを更新しました');
    } catch (e) {
      alert('プランの更新に失敗しました');
    } finally {
      setUpdating(null);
    }
  };

  const priceText = (price: number) => (price === 0 ? '無料' : `¥${price.toLocaleString()}/月`);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">ご支援のお願い</h1>
          <p className="text-gray-600">
            このプロジェクトは有志による非公式プロジェクトであり、サーバー代やAPIの費用は自己負担です。
          </p>
        </div>

        {selectedPlan ? (
          <div className="mb-6 text-center text-sm text-gray-700">
            現在のプラン: <span className="font-semibold">{selectedPlan.name}</span>
          </div>
        ) : null}

        <div className="grid md:grid-cols-4 gap-6">
          {plans.map((plan) => {
            const isSelected = selectedPlanId === plan.id;
            return (
              <Card key={plan.id} className={`p-6 relative ${isSelected ? 'ring-2 ring-primary-500' : ''}`}>
                <div className="flex flex-col h-full">
                  <div className="mb-4">
                    <h2 className="text-xl font-semibold text-gray-900">{plan.name}</h2>
                    <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
                  </div>
                  {isSelected && (
                    <div className="absolute top-4 right-4 text-xs px-2 py-1 rounded-full bg-primary-100 text-primary-700">現在のプラン</div>
                  )}
                  <div className="text-2xl font-bold text-gray-900 mb-2">{priceText(plan.price_jpy)}</div>
                  <ul className="text-sm text-gray-700 mb-6 list-disc pl-5 space-y-1">
                    <li>カスタムタイムライン上限 {plan.max_custom_timelines} 個</li>
                    <li>将来的な追加機能（応援プラン）</li>
                  </ul>
                  <div className="mt-auto w-full">
                    <Button
                      onClick={async () => {
                        if (isSelected) return;
                        try {
                          setUpdating(plan.id);
                          const { data: { session } } = await supabase.auth.getSession();
                          if (plan.price_jpy > 0) {
                            const res = await fetch('/api/stripe/checkout', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ planKey: plan.plan_key }),
                              ...(session?.access_token
                                ? { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` } }
                                : {}),
                            });
                            const data = await res.json();
                            if (data.url) {
                              window.location.href = data.url;
                              return;
                            }
                            alert('チェックアウトの作成に失敗しました');
                          } else {
                            await handleSelect(plan.id);
                          }
                        } finally {
                          setUpdating(null);
                        }
                      }}
                      disabled={updating === plan.id || isSelected}
                      className="w-full text-black"
                    >
                      {isSelected ? '現在はこのプランです' : 'プロフィールのカスタマーポータルから変更できます'}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="mt-10 text-sm text-gray-600">
          <p>・お支払い処理は今後の実装予定です。現在はプラン選択のみ可能です。</p>
          <p>・プランに応じたカスタムタイムライン上限は順次適用予定です。</p>
        </div>
      </div>
    </Layout>
  );
}


