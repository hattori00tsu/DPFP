'use client';

import useSWR from 'swr';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Layout } from '@/components/Layout';
import { prefectures } from '@/public/prefecture';
import { mediaTypeLabels } from '@/public/category';

// 簡易マップ（地域ごとに配置したクリック可能なグリッド）
const regionToPrefIds: Record<string, string[]> = {
  '北海道': ['01'],
  '東北': ['02','03','04','05','06','07'],
  '関東': ['08','09','10','11','12','13','14'],
  '中部': ['15','16','17','18','19','20','21','22','23'],
  '近畿': ['24','25','26','27','28','29','30'],
  '中国': ['31','32','33','34','35'],
  '四国': ['36','37','38','39'],
  '九州・沖縄': ['40','41','42','43','44','45','46','47'],
};

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
  politician_prefectures?: { prefecture_code: string }[];
}

interface PrefSettingItem {
  id: string;
  prefecture: string;
  platform: string;
  account_name: string;
  account_url: string;
  is_active: boolean;
}

interface PrefSnsPost {
  id: string;
  prefecture: string;
  platform: string;
  published_at: string;
  title?: string | null;
  url?: string | null;
}

interface SnsTimelineItem {
  id: string;
  politician_sns_posts?: {
    id: string;
    platform: string;
    content?: string | null;
    thumbnail_url?: string | null;
    post_url?: string | null;
    published_at?: string;
    politicians?: {
      id: string;
      prefecture?: string;
    }
  };
}

const fetchPoliticians = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('failed');
  const j = await res.json();
  return (j.politicians as PoliticianItem[]) || [];
};

const fetchPrefSettings = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('failed');
  const j = await res.json();
  return (j.settings as PrefSettingItem[]) || [];
};

function labelFromPlatform(p: string) {
  const key = String(p || '').toLowerCase();
  if (key === 'twitter' || key === 'x' || key === 'twitter2') return mediaTypeLabels.x;
  if (key === 'youtube') return mediaTypeLabels.youtube;
  if (key === 'instagram') return mediaTypeLabels.instagram;
  if (key === 'facebook') return mediaTypeLabels.facebook;
  if (key === 'note') return mediaTypeLabels.note;
  if (key === 'election_dot_com') return mediaTypeLabels.election_dot_com;
  return 'SNS';
}

function normalizePlatform(p: string) {
  const key = String(p || '').toLowerCase();
  return (key === 'twitter' || key === 'x' || key === 'twitter2') ? 'x' : key;
}

// 表示用：北海道以外は末尾の「都/府/県」を省く
function formatPrefNameJa(name: string) {
  if (!name) return '';
  if (name === '北海道') return name;
  return name.replace(/(都|府|県)$/u, '');
}

export default function DirectoryPage() {
  const { data: politicians = [], isLoading: loadingPoliticians } = useSWR('/api/admin/politicians', fetchPoliticians, { revalidateOnFocus: false });
  const { data: settings = [], isLoading: loadingSettings } = useSWR('/api/admin/pref-sns-settings', fetchPrefSettings, { revalidateOnFocus: false });
  const [selectedPrefId, setSelectedPrefId] = useState<string | null>(null);
  // 地方ごとにボタンをまとめて表示するため、従来のグリッド座標指定は不要

  const loading = loadingPoliticians || loadingSettings;

  // Group politicians by prefecture (prefer relation, fallback to legacy field)
  const polByPref: Record<string, PoliticianItem[]> = {};
  for (const p of politicians) {
    const rel = (p as any).politician_prefectures as { prefecture_code: string }[] | undefined;
    const codes = Array.isArray(rel) && rel.length > 0 ? rel.map(r => String(r.prefecture_code)) : [];
    if (codes.length > 0) {
      for (const code of codes) {
        (polByPref[code] ||= []).push(p);
      }
      continue;
    }
    if (p.prefecture) {
      let code = p.prefecture;
      if (!/^\d{2}$/.test(code)) {
        const found = prefectures.find(q => q.name_ja === code || formatPrefNameJa(q.name_ja) === code);
        if (found) code = found.id;
      }
      (polByPref[code] ||= []).push(p);
    }
  }

  // Group prefectural branch settings by prefecture (active only)
  const prefByPref: Record<string, PrefSettingItem[]> = {};
  for (const s of settings) {
    if (!s.is_active) continue;
    (prefByPref[s.prefecture] ||= []).push(s);
  }


  // 最新投稿機能は不使用

  return (
    <Layout>
      <div className="mx-auto max-w-5xl px-4">
        <div className="flex items-center justify-between mb-4">
        </div>
        {/* 地方ごとにまとめた都道府県ボタン */}
        <div className="mx-auto max-w-4xl mb-4">
          {Object.entries(regionToPrefIds).map(([region, ids]) => (
            <div key={region} className="mb-4 p-2 bg-white border rounded-none shadow-sm">
              <div className="text-sm font-semibold text-gray-700 mb-2">{region}</div>
              <div className="flex flex-wrap gap-2">
                {ids.map((id) => {
                  const pref = prefectures.find(p => p.id === id);
                  if (!pref) return null;
                  return (
                    <button
                      key={id}
                      onClick={() => setSelectedPrefId(id)}
                      className="text-xs md:text-sm px-3 py-2 bg-gray-50 hover:bg-gray-100 border rounded-none shadow-sm text-gray-800 transition focus:outline-none focus:ring-2 focus:ring-purple-200"
                      aria-label={pref.name_ja}
                    >
                      {formatPrefNameJa(pref.name_ja)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* 地域ブロックUI（必要であれば復活可） */}
        {loading ? (
          <div className="text-gray-500">読み込み中...</div>
        ) : (
          <div className="text-gray-500">地図上の都道府県をクリックしてください</div>
        )}

        {/* 選択都道府県のポップアップ */}
        {selectedPrefId && (() => {
          const pref = prefectures.find(p => p.id === selectedPrefId);
          const polList = polByPref[selectedPrefId] || [];
          const branchList = prefByPref[selectedPrefId] || [];
          return (
            <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4" onClick={() => setSelectedPrefId(null)}>
              <div className="bg-white rounded-none shadow-lg border w-full max-w-3xl md:max-w-4xl max-h-[85vh] overflow-hidden p-4 md:p-6" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-lg font-semibold text-gray-900">{pref ? formatPrefNameJa(pref.name_ja) : '都道府県'}</div>
                  <button onClick={() => setSelectedPrefId(null)} aria-label="閉じる" className="text-sm text-gray-500 hover:text-gray-700">閉じる</button>
                </div>
                <div className="overflow-y-auto pr-1 space-y-6">
                  {/* 支部SNS */}
                  <div>
                    <div className="text-sm font-medium text-gray-800 mb-2">支部SNS</div>
                    {branchList.length === 0 ? (
                      <div className="text-sm text-gray-500">設定がありません</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {branchList.map(b => (
                          <a
                            key={b.id}
                            href={b.account_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-1.5 md:px-4 md:py-2 rounded-md bg-orange-500 text-white hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-300 text-sm md:text-base font-semibold shadow-sm"
                            aria-label={`${b.platform}`}
                          >
                            {b.platform}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 議員 */}
                  <div>
                    {polList.length === 0 ? (
                      <div className="text-sm text-gray-500">登録がありません</div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {polList.map(p => (
                          <div key={p.id} className="border rounded-none shadow-sm p-3">
                            <div className="flex items-center justify-between mb-1">
                              <div className="font-medium text-gray-900 break-words">{p.name}</div>
                            </div>
                            {p.profile_url && (
                              <div className="mb-2">
                                <Link href={p.profile_url} target="_blank" className="text-blue-600 hover:text-blue-800 text-xs">プロフィール</Link>
                              </div>
                            )}
                            <div>
                              <div className="text-xs text-gray-500 mb-1">SNS</div>
                              <div className="flex flex-wrap gap-2">
                                {(p.politician_sns_accounts || [])
                                  .filter(a => a.is_active && a.account_url)
                                  .map(a => (
                                    <a
                                      key={a.id}
                                      href={a.account_url || '#'}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center px-3 py-1.5 md:px-4 md:py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm md:text-base font-semibold shadow-sm"
                                      aria-label={`${p.name} の ${a.platform}`}
                                    >
                                      {a.platform}
                                    </a>
                                  ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </Layout>
  );
}

<style jsx>{`
/* スマホで読みやすいサイズに */
@media (max-width: 640px) {
  .grid.grid-cols-10 > button { padding: 6px 6px; font-size: 11px; }
}
`}</style>


