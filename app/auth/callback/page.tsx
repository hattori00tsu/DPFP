'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState('ログイン処理中...');

  useEffect(() => {
    let isCancelled = false;

    const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

    const run = async () => {
      try {
        // 1) OAuthコードをセッションに交換
        await supabase.auth.exchangeCodeForSession(window.location.href);

        // 2) セッション取得
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setMessage('セッションを確立できませんでした。もう一度お試しください。');
          await delay(1200);
          router.replace('/auth?error=session_not_found');
          return;
        }

        setMessage('プロフィールを確認しています...');

        // 3) プロフィール取得（トリガーで作成済みのはず。なければ短いリトライ）
        let profile = null as any;
        for (let i = 0; i < 4; i++) {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          if (!error && data) {
            profile = data;
            break;
          }
          await delay(400);
        }

        // 4) ユーザーサブスク自動作成（未作成時のみ）
        setMessage('サブスクリプションを確認しています...');
        const { data: existingSub } = await supabase
          .from('user_subscriptions')
          .select('id')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (!existingSub) {
          const { data: freePlan } = await supabase
            .from('subscription_plans')
            .select('id, plan_key')
            .eq('plan_key', 'free')
            .maybeSingle();

          if (freePlan?.id) {
            await supabase
              .from('user_subscriptions')
              .upsert({ user_id: session.user.id, plan_id: freePlan.id, status: 'active' }, { onConflict: 'user_id' });
          }
        }

        // 5) 登録状況で遷移先を分岐
        const isComplete = !!profile?.is_profile_complete;
        const nextPath = isComplete ? '/dashboard' : '/profile';
        router.replace(nextPath);
      } catch (e) {
        setMessage('ログイン処理でエラーが発生しました');
        await delay(1200);
        router.replace('/auth?error=oauth_callback_failed');
      }
    };

    run();
    return () => { isCancelled = true; };
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white shadow rounded px-6 py-8 w-full max-w-md text-center text-gray-700">
        {message}
      </div>
    </div>
  );
}


