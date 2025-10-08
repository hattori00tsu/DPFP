'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { Layout } from '@/components/Layout';
import { prefectures } from '@/public/prefecture';
import { mediaTypeLabels } from '@/public/category';

interface PrefSettingItem {
  id: string;
  prefecture: string; // code
  platform: string;
  account_name: string;
  account_url: string;
  is_active: boolean;
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('failed');
  const j = await res.json();
  return (j.settings as PrefSettingItem[]) || [];
};

export default function PrefBranchesPage() {
  const { data: settings = [], isLoading } = useSWR('/api/admin/pref-sns-settings', fetcher, { revalidateOnFocus: false });

  const group: Record<string, PrefSettingItem[]> = {};
  for (const s of settings) {
    if (!s.is_active) continue;
    (group[s.prefecture] ||= []).push(s);
  }

  const labelFromPlatform = (p: string) => {
    const key = String(p || '').toLowerCase();
    if (key === 'twitter' || key === 'x' || key === 'twitter2') return mediaTypeLabels.x;
    if (key === 'youtube') return mediaTypeLabels.youtube;
    if (key === 'instagram') return mediaTypeLabels.instagram;
    if (key === 'facebook') return mediaTypeLabels.facebook;
    if (key === 'note') return mediaTypeLabels.note;
    if (key === 'election_dot_com') return mediaTypeLabels.election_dot_com;
    return 'SNS';
  };

  return (
    <Layout>
      <div>
        <h1 className="text-2xl font-bold mb-4">都道府県支部一覧</h1>
        {isLoading ? (
          <div className="text-gray-500">読み込み中...</div>
        ) : (
          <div className="space-y-6">
            {prefectures.map(pref => {
              const list = group[pref.id] || [];
              return (
                <div key={pref.id} className="bg-white border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="font-semibold text-gray-900">{pref.name_ja}</h2>
                    <span className="text-xs text-gray-500">{list.length} 件</span>
                  </div>
                  {list.length === 0 ? (
                    <div className="text-sm text-gray-500">設定がありません</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {list.map(s => (
                        <Link
                          key={s.id}
                          href={s.account_url}
                          target="_blank"
                          className="px-2 py-1 text-xs rounded-full border bg-gray-50 hover:bg-gray-100"
                        >
                          {s.account_name}（{labelFromPlatform(s.platform)}）
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}


