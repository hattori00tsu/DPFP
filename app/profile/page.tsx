'use client';

import { Layout } from '@/components/Layout';
import { useAuth } from '@/lib/auth-context';
import { User } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { prefectures } from '@/public/prefecture';
import { partyMemberRankLabels } from '@/public/category';
import type { UserDemographics } from '@/types';
import useSWR from 'swr';

export default function ProfilePage() {
  const { profile, userEmail, refreshProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [demographicsForForm, setDemographicsForForm] = useState<UserDemographics | null>(null);
  const [changingPlanId, setChangingPlanId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: profile?.name || '',
    birth_year: '',
    gender: '',
    prefecture_code: '',
    party_member_rank: '',
  });

  // SWR fetchers
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

  const { data: demographicsResp, mutate: mutateDemographics, isLoading: loadingDemographics } = useSWR(
    profile ? `/api/profile/demographics?userId=${profile.id}` : null,
    jsonFetcher
  );
  const demographics: UserDemographics | null = demographicsResp?.demographics ?? null;

  // サブスクリプションとプラン一覧をサマリAPIで一括取得
  const { data: summaryResp, mutate: mutateSummary, isLoading: loadingSummary } = useSWR(
    profile ? `/api/subscriptions/summary?userId=${profile.id}` : null,
    jsonFetcher
  );
  const subscription: { planId: string; planName: string; priceJpy: number; status: string; currentPeriodStart: string | null; currentPeriodEnd: string | null } | null = summaryResp?.subscription ?? null;
  const plans: Array<{ id: string; plan_key: string; name: string; price_jpy: number; max_custom_timelines: number }> = summaryResp?.plans ?? [];

  // Stripe成功遷移時は即時反映を試みる + SWR再検証
  useEffect(() => {
    if (!profile) return;
    const params = new URLSearchParams(window.location.search);
    const subscribed = params.get('subscribed');
    const sessionId = params.get('session_id');

    // チェックアウトからの戻り以外では重い同期処理を実行しない
    if (!(subscribed === '1' && sessionId)) {
      return;
    }

    const runSync = async () => {
      try {
        await fetch('/api/stripe/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId }),
        });
      } catch (e) {
      } finally {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          await fetch('/api/stripe/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
            },
          });
        } catch (e) {
        } finally {
          mutateSummary();
        }
      }
    };

    runSync();
  }, [profile, mutateSummary]);

  // Realtime 購読（demographics, subscriptions）
  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel(`profile-realtime-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_demographics', filter: `user_id=eq.${profile.id}` }, () => {
        mutateDemographics();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_subscriptions', filter: `user_id=eq.${profile.id}` }, () => {
        mutateSummary();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, mutateDemographics, mutateSummary]);

  const handleChangePlan = async (planId: string, planKey: string, price: number) => {
    if (!profile) return;
    try {
      setChangingPlanId(planId);
      if (price > 0) {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: JSON.stringify({ planKey }),
        });
        const json = await res.json();
        if (json?.url) {
          window.location.href = json.url;
          return;
        }
        alert('チェックアウトの作成に失敗しました');
      } else {
        const { error } = await supabase
          .from('user_subscriptions')
          .upsert({ user_id: profile.id, plan_id: planId, status: 'active' }, { onConflict: 'user_id' });
        if (error) throw error;
        await mutateSummary();
        alert('プランを更新しました');
      }
    } catch (e) {
      alert('プラン更新に失敗しました');
    } finally {
      setChangingPlanId(null);
    }
  };

  if (!profile) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // プロフィールの名前を更新
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: formData.name,
          is_profile_complete: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (profileError) {
        throw profileError;
      }

      // user_demographicsを更新または挿入
      const demographicsData = {
        user_id: profile.id,
        birth_year: formData.birth_year ? parseInt(formData.birth_year.toString()) : null,
        gender: formData.gender || null,
        prefecture_code: formData.prefecture_code || null,
        party_member_rank: formData.party_member_rank || null,
        updated_at: new Date().toISOString(),
      };

      if (demographics) {
        // 更新
        const { error: demoError } = await supabase
          .from('user_demographics')
          .update(demographicsData)
          .eq('user_id', profile.id);

        if (demoError) {
          throw demoError;
        }
      } else {
        // 挿入
        const { error: demoError } = await supabase
          .from('user_demographics')
          .insert(demographicsData);

        if (demoError) {
          throw demoError;
        }
      }

      alert('プロフィールを更新しました');
      setIsEditing(false);
      await mutateDemographics();
      await refreshProfile();
    } catch (error: any) {
      
      // エラーメッセージをより詳しく表示
      let errorMessage = 'プロフィールの更新に失敗しました';
      if (error?.code === '42501') {
        errorMessage = '権限がありません。ログインし直してください。';
      } else if (error?.message) {
        errorMessage = `エラー: ${error.message}`;
      }
      
      alert(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const genderLabels: { [key: string]: string } = {
    male: '男性',
    female: '女性',
    other: 'その他',
    no_answer: '無回答',
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);

  const isLoading = loadingDemographics || loadingSummary;
  if (isLoading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">読み込み中...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
                  <User className="w-8 h-8 text-primary-600" />
                </div>
                <div className="ml-4">
                  <h1 className="text-2xl font-bold text-gray-900">{profile.name}</h1>
                  <p className="text-gray-600">{userEmail}</p>
                </div>
              </div>
              {!isEditing && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      try {
                        await supabase.auth.signOut();
                        window.location.href = '/auth';
                      } catch (e) {
                        console.error(e);
                      }
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    ログアウト
                  </button>
                  <button
                    onClick={() => {
                      setFormData({
                        name: profile.name,
                        birth_year: demographics?.birth_year?.toString() || '',
                        gender: demographics?.gender || '',
                        prefecture_code: demographics?.prefecture_code || '',
                        party_member_rank: demographics?.party_member_rank || '',
                      });
                      setDemographicsForForm(demographics);
                      setIsEditing(true);
                    }}
                    className="px-4 py-2 bg-primary-600 text-black rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    編集
                  </button>
                </div>
              )}
            </div>

            {/* サブスクリプション状況 */}
            <div className="mb-8 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">サブスクリプション</h3>
              {subscription ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-500">プラン</div>
                    <div className="text-gray-900">{subscription.planName} {subscription.priceJpy > 0 ? `(¥${subscription.priceJpy.toLocaleString()}/月)` : ''}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">ステータス</div>
                    <div className="text-gray-900">{subscription.status}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">前回の決済日</div>
                    <div className="text-gray-900">{subscription.currentPeriodStart ? new Date(subscription.currentPeriodStart).toLocaleDateString('ja-JP') : '—'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">次回の決済日</div>
                    <div className="text-gray-900">{subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString('ja-JP') : '—'}</div>
                  </div>
                  <div className="md:col-span-2 mt-2">
                    {process.env.NEXT_PUBLIC_STRIPE_PORTAL_URL ? (
                      <a
                        href={process.env.NEXT_PUBLIC_STRIPE_PORTAL_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center px-4 py-2 bg-primary-600 text-black rounded-lg hover:bg-primary-700 transition-colors"
                      >
                        Stripeのカスタマーポータルで管理
                      </a>
                    ) : (
                      <div className="text-sm text-gray-500">ポータルURLが未設定です。環境変数 NEXT_PUBLIC_STRIPE_PORTAL_URL を設定してください。</div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-gray-600">現在、サブスクリプションは未設定です。プランを選択してください。</div>
              )}
            </div>

            {isEditing ? (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    名前 *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    生まれた年（西暦）
                  </label>
                  <select
                    value={formData.birth_year}
                    onChange={(e) => setFormData({ ...formData, birth_year: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">選択してください</option>
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}年
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    性別
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">選択してください</option>
                    <option value="male">男性</option>
                    <option value="female">女性</option>
                    <option value="other">その他</option>
                    <option value="no_answer">無回答</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    お住まいの都道府県
                  </label>
                  <select
                    value={formData.prefecture_code}
                    onChange={(e) => setFormData({ ...formData, prefecture_code: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">選択してください</option>
                    {prefectures.map((pref) => (
                      <option key={pref.id} value={pref.id}>
                        {pref.name_ja}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    党員ランク
                  </label>
                  <select
                    value={formData.party_member_rank}
                    onChange={(e) => setFormData({ ...formData, party_member_rank: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">選択してください</option>
                    {Object.entries(partyMemberRankLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-4">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                  >
                    {isSaving ? '保存中...' : '保存'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    disabled={isSaving}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
                  >
                    キャンセル
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">生まれた年</h3>
                  <p className="text-gray-900">{demographics?.birth_year ? `${demographics.birth_year}年` : '未設定'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">性別</h3>
                  <p className="text-gray-900">{demographics?.gender ? genderLabels[demographics.gender] : '未設定'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">お住まいの都道府県</h3>
                  <p className="text-gray-900">
                    {demographics?.prefecture_code
                      ? prefectures.find((p) => p.id === demographics.prefecture_code)?.name_ja || '未設定'
                      : '未設定'}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">党員ランク</h3>
                  <p className="text-gray-900">
                    {demographics?.party_member_rank ? partyMemberRankLabels[demographics.party_member_rank as keyof typeof partyMemberRankLabels] : '未設定'}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">登録日</h3>
                  <p className="text-gray-900">{new Date(profile.created_at).toLocaleDateString('ja-JP')}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">最終更新</h3>
                  <p className="text-gray-900">{new Date(profile.updated_at).toLocaleDateString('ja-JP')}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
