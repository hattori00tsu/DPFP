'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { Layout } from '@/components/Layout';
import { prefectures } from '@/public/prefecture';
import { mediaTypeLabels } from '@/public/category';

interface SNSAccount {
  id: string;
  platform: string;
  account_handle?: string | null;
  account_url: string | null;
  is_active: boolean;
}

interface PoliticianItem {
  id: string;
  name: string;
  position: string;
  prefecture: string;
  profile_url?: string | null;
  politician_sns_accounts?: SNSAccount[];
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('failed');
  const j = await res.json();
  return (j.politicians as PoliticianItem[]) || [];
};

export default function PoliticiansPage() {
  const { data: politicians = [], isLoading } = useSWR('/api/admin/politicians', fetcher, { revalidateOnFocus: false });

  const getPrefName = (code: string) => prefectures.find(p => p.id === code)?.name_ja || '不明';
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
        <h1 className="text-2xl font-bold mb-4">議員一覧</h1>
        {isLoading ? (
          <div className="text-gray-500">読み込み中...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {politicians.map((p) => (
              <div key={p.id} className="bg-white border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-gray-900">{p.name}</div>
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded-full">{getPrefName(p.prefecture)}</span>
                </div>
                {p.profile_url && (
                  <div className="mb-2">
                    <Link href={p.profile_url} target="_blank" className="text-blue-600 hover:text-blue-800 text-sm">プロフィール</Link>
                  </div>
                )}
                <div className="mt-2">
                  <div className="text-xs text-gray-500 mb-1">SNSリンク</div>
                  <div className="flex flex-wrap gap-2">
                    {(p.politician_sns_accounts || [])
                      .filter(a => a.is_active && a.account_url)
                      .map((a) => (
                        <Link
                          key={a.id}
                          href={a.account_url || '#'}
                          target="_blank"
                          className="px-2 py-1 text-xs rounded-full border bg-gray-50 hover:bg-gray-100"
                        >
                          {labelFromPlatform(a.platform)}
                        </Link>
                      ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}


