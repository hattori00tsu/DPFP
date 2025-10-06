'use client';

import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/lib/auth-context';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/type/types';

export default function SettingsPage() {
  const { profile: authProfile, userEmail, refreshProfile } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(authProfile);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Sync auth profile to local state
  useEffect(() => {
    if (authProfile) {
      setProfile(authProfile);
    }
  }, [authProfile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setLoading(true);
    setSuccess(false);

    const { error } = await supabase
      .from('profiles')
      .update({
        name: profile.name,
        notification_settings: profile.notification_settings,
      })
      .eq('id', profile.id);

    if (!error) {
      setSuccess(true);
      await refreshProfile();
      setTimeout(() => setSuccess(false), 3000);
    }

    setLoading(false);
  };

  if (!profile) {
    return (
      <Layout>
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">設定</h1>
          <p className="text-gray-600">プロフィールと通知設定</p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">プロフィール</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  お名前
                </label>
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  メールアドレス
                </label>
                <input
                  type="email"
                  value={userEmail}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">通知設定</h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">メール通知</p>
                  <p className="text-sm text-gray-500">重要な情報をメールで受け取る</p>
                </div>
                <input
                  type="checkbox"
                  checked={profile.notification_settings?.email || false}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      notification_settings: {
                        ...profile.notification_settings,
                        email: e.target.checked,
                      },
                    })
                  }
                  className="w-5 h-5 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">デイリーダイジェスト</p>
                  <p className="text-sm text-gray-500">1日の主要ニュースまとめ（朝8時配信）</p>
                </div>
                <input
                  type="checkbox"
                  checked={profile.notification_settings?.daily_digest || false}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      notification_settings: {
                        ...profile.notification_settings,
                        daily_digest: e.target.checked,
                      },
                    })
                  }
                  className="w-5 h-5 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">週次サマリー</p>
                  <p className="text-sm text-gray-500">週の活動総括（月曜朝配信）</p>
                </div>
                <input
                  type="checkbox"
                  checked={profile.notification_settings?.weekly_summary || false}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      notification_settings: {
                        ...profile.notification_settings,
                        weekly_summary: e.target.checked,
                      },
                    })
                  }
                  className="w-5 h-5 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
              </div>
            </div>
          </Card>

          {success && (
            <div className="bg-success-50 border border-success-200 text-success-700 px-4 py-3 rounded">
              設定を保存しました
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? '保存中...' : '設定を保存'}
          </Button>
        </form>
      </div>
    </Layout>
  );
}
