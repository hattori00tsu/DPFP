'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { newsreleaseTypeLabels, eventTypeLabels, snsTypeLabels } from '@/public/category';
import { prefectures } from '@/public/prefecture';
import { Loader as Loader2, Newspaper, Calendar, Share2 } from 'lucide-react';

interface OfficialNews {
  id: string;
  category: string;
  published_at: string;
  title: string;
  content?: string | null;
  thumbnail_url?: string | null;
  url?: string | null;
}

interface OfficialEvent {
  id: string;
  category: string;
  prefecture?: string | null;
  event_date: string;
  title: string;
  description?: string | null;
  location?: string | null;
  thumbnail_url?: string | null;
  url?: string | null;
}

interface OfficialSnsPost {
  id: string;
  platform: string;
  published_at: string;
  title?: string | null;
  thumbnail_url?: string | null;
  url?: string | null;
}

export default function OfficialPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'news' | 'events' | 'sns'>('news');

  // カテゴリー選択状態（デフォルトで全て選択）
  const [selectedNewsCategories, setSelectedNewsCategories] = useState<string[]>(Object.keys(newsreleaseTypeLabels));
  const [selectedEventCategories, setSelectedEventCategories] = useState<string[]>(Object.keys(eventTypeLabels));
  const [selectedSnsCategories, setSelectedSnsCategories] = useState<string[]>(Object.keys(snsTypeLabels));
  const [selectedPrefectures, setSelectedPrefectures] = useState<string[]>(prefectures.map(p => p.id));

  // ポップアップは廃止（都道府県もインライン選択）

  // 選択表示 折りたたみ/展開
  const [isCategoryPanelCollapsed, setIsCategoryPanelCollapsed] = useState(true);
  // 各タブの表示件数（さらに表示）
  const [newsVisibleCount, setNewsVisibleCount] = useState(20);
  const [eventsVisibleCount, setEventsVisibleCount] = useState(20);
  const [snsVisibleCount, setSnsVisibleCount] = useState(20);
  const [expandedSnsIds, setExpandedSnsIds] = useState<Record<string, boolean>>({});

  const toggleSnsExpand = (id: string) => {
    setExpandedSnsIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // 一括取得API用フェッチャー
  const combinedFetcher = async () => {
    const params = new URLSearchParams();
    if (selectedNewsCategories.length > 0) params.set('newsCategories', selectedNewsCategories.join(','));
    if (selectedEventCategories.length > 0) params.set('eventCategories', selectedEventCategories.join(','));
    if (selectedSnsCategories.length > 0) params.set('snsCategories', selectedSnsCategories.join(','));
    if (selectedPrefectures.length > 0) params.set('prefectures', selectedPrefectures.join(','));
    params.set('limit', '100');

    const res = await fetch(`/api/official?${params.toString()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch official data');
    return res.json();
  };

  // SWR hook（1本化）
  const { data: combinedData, mutate: mutateCombined, isLoading: loadingCombined } = useSWR(
    ['official-combined', selectedNewsCategories, selectedEventCategories, selectedSnsCategories, selectedPrefectures],
    combinedFetcher,
    { revalidateOnFocus: false, keepPreviousData: true }
  );

  const newsData: OfficialNews[] = (combinedData?.news as OfficialNews[]) || [];
  const eventsData: OfficialEvent[] = (combinedData?.events as OfficialEvent[]) || [];
  const snsData: OfficialSnsPost[] = (combinedData?.sns as OfficialSnsPost[]) || [];

  // 初回のみローディング表示、データがあれば既存データを表示
  const isInitialLoading = loadingCombined && newsData.length === 0 && eventsData.length === 0 && snsData.length === 0;
  
  // バックグラウンド更新中かどうか
  const isRefreshing = loadingCombined && !isInitialLoading;

  useEffect(() => {
    if (profile?.id) {
      loadUserPreferences(profile.id);
    }
  }, [profile?.id]);

  // Realtime subscriptions for automatic updates
  useEffect(() => {
    // News subscription
    const newsChannel = supabase
      .channel('official_news_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'official_news'
        },
        (payload) => {
          mutateCombined();
        }
      )
      .subscribe();

    // Events subscription
    const eventsChannel = supabase
      .channel('official_events_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'official_events'
        },
        (payload) => {
          mutateCombined();
        }
      )
      .subscribe();

    // SNS subscription
    const snsChannel = supabase
      .channel('official_sns_posts_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'official_sns_posts'
        },
        (payload) => {
          mutateCombined();
        }
      )
      .subscribe();

    // Cleanup
    return () => {
      supabase.removeChannel(newsChannel);
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(snsChannel);
    };
  }, [mutateCombined]);

  // カテゴリー選択が変更されたときに自動保存（一時的に無効化）
  // useEffect(() => {
  //   if (profile) {
  //     // 初回ロード時は保存しない（loadUserPreferencesの後に実行されるため）
  //     const timer = setTimeout(() => {
  //       saveUserPreferences();
  //     }, 500);
  //     return () => clearTimeout(timer);
  //   }
  // }, [
  //   JSON.stringify(selectedNewsCategories), 
  //   JSON.stringify(selectedEventCategories), 
  //   JSON.stringify(selectedSnsCategories), 
  //   JSON.stringify(selectedPrefectures)
  // ]);

  const loadUserPreferences = async (userId: string) => {
    const { data: preferences, error } = await supabase
      .from('user_filter_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (preferences && !error) {
      setSelectedNewsCategories(preferences.news_categories || Object.keys(newsreleaseTypeLabels));
      setSelectedEventCategories(preferences.event_categories || Object.keys(eventTypeLabels));
      setSelectedSnsCategories(preferences.sns_categories || Object.keys(snsTypeLabels));
      setSelectedPrefectures(preferences.prefectures || prefectures.map(p => p.id));
    } else {
      // 初期設定として全てのカテゴリーを選択
      const allNewsCategories = Object.keys(newsreleaseTypeLabels);
      const allEventCategories = Object.keys(eventTypeLabels);
      const allSnsCategories = Object.keys(snsTypeLabels);
      const allPrefectures = prefectures.map(p => p.id);

      setSelectedNewsCategories(allNewsCategories);
      setSelectedEventCategories(allEventCategories);
      setSelectedSnsCategories(allSnsCategories);
      setSelectedPrefectures(allPrefectures);

      // 初期設定をデータベースに保存
      await supabase
        .from('user_filter_preferences')
        .insert({
          user_id: userId,
          news_categories: allNewsCategories,
          event_categories: allEventCategories,
          sns_categories: allSnsCategories,
          prefectures: allPrefectures
        });
    }
  };

  const saveUserPreferences = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // まず既存のレコードを確認
      const { data: existing } = await supabase
        .from('user_filter_preferences')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (existing) {
        // 既存レコードを更新
        const { error } = await supabase
          .from('user_filter_preferences')
          .update({
            news_categories: selectedNewsCategories,
            event_categories: selectedEventCategories,
            sns_categories: selectedSnsCategories,
            prefectures: selectedPrefectures,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);

        if (error) {
        }
      } else {
        // 新規レコードを挿入
        const { error } = await supabase
          .from('user_filter_preferences')
          .insert({
            user_id: user.id,
            news_categories: selectedNewsCategories,
            event_categories: selectedEventCategories,
            sns_categories: selectedSnsCategories,
            prefectures: selectedPrefectures
          });

        if (error) {
        }
      }
    }
  };


  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-2 sm:px-2 lg:px-2 py-2">
        {/* バックグラウンド更新インジケーター */}
        {isRefreshing && (
          <div className="fixed top-20 right-4 z-50 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">更新中...</span>
          </div>
        )}
        
        <div className="mb-8">
          <div className="flex justify-between items-center">
          </div>
        </div>


        {/* タブナビゲーション */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('news')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'news'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <div className="flex items-center">
                <Newspaper className="w-4 h-4 mr-2" />
                ニュースリリース
              </div>
            </button>
            <button
              onClick={() => setActiveTab('events')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'events'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-2" />
                イベント・ボランティア情報
              </div>
            </button>
            <button
              onClick={() => setActiveTab('sns')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'sns'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              <div className="flex items-center">
                <Share2 className="w-4 h-4 mr-2" />
                公式SNS
              </div>
            </button>
          </nav>
        </div>

        {/* カテゴリー選択バー（インライン + 枠全体の折りたたみ） */}
        {profile && (
          <div className="mb-6 p-4 bg-white rounded-lg shadow-sm border">
            {/* ヘッダー */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
              {activeTab === 'news' && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">ニュースカテゴリー選択</span>
                    <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                      </span>
                </div>
              )}
              {activeTab === 'events' && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">イベントカテゴリー選択</span>
                    <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded-full">
                        </span>
                  </div>
                )}
                {activeTab === 'sns' && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">SNSカテゴリー選択</span>
                    <span className="px-2 py-0.5 bg-orange-600 text-white text-xs rounded-full">
                        </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* 都道府県はインライン化済みのためボタンは不要 */}
                  <button
                  onClick={() => setIsCategoryPanelCollapsed(!isCategoryPanelCollapsed)}
                  className="text-sm text-gray-600 hover:text-gray-800 underline"
                >
                  {isCategoryPanelCollapsed ? '選択欄を開く' : '選択欄を閉じる'}
                  </button>
                </div>
            </div>

            {/* 本文（カテゴリー 〇/× トグル） */}
            {!isCategoryPanelCollapsed && (
              <div className="mt-2">
                {activeTab === 'news' && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(newsreleaseTypeLabels).map(([key, label]) => {
                      const selected = selectedNewsCategories.includes(key);
                      return (
                  <button
                          key={key}
                          onClick={() => {
                            if (selected) {
                              setSelectedNewsCategories(selectedNewsCategories.filter(c => c !== key));
                            } else {
                              setSelectedNewsCategories([...selectedNewsCategories, key]);
                            }
                      setTimeout(saveUserPreferences, 100);
                    }}
                          className={`px-3 py-2 rounded-md border transition ${selected
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                          }`}
                  >
                          <span className="mr-2">{selected ? '〇' : '×'}</span>
                          {label}
                  </button>
                      );
                    })}
                  </div>
                )}

                {activeTab === 'events' && (
                  <>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {Object.entries(eventTypeLabels).map(([key, label]) => {
                        const selected = selectedEventCategories.includes(key);
                        return (
                          <button
                            key={key}
                            onClick={() => {
                              if (selected) {
                                setSelectedEventCategories(selectedEventCategories.filter(c => c !== key));
                              } else {
                                setSelectedEventCategories([...selectedEventCategories, key]);
                              }
                              setTimeout(saveUserPreferences, 100);
                            }}
                            className={`px-3 py-2 rounded-md border transition ${selected
                              ? 'bg-green-600 text-white border-green-600'
                              : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                            }`}
                          >
                            <span className="mr-2">{selected ? '〇' : '×'}</span>
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {prefectures.map((pref) => {
                        const selected = selectedPrefectures.includes(pref.id);
                        return (
                  <button
                            key={pref.id}
                            onClick={() => {
                              if (selected) {
                                setSelectedPrefectures(selectedPrefectures.filter(p => p !== pref.id));
                              } else {
                                setSelectedPrefectures([...selectedPrefectures, pref.id]);
                              }
                      setTimeout(saveUserPreferences, 100);
                    }}
                            className={`px-3 py-2 rounded-md border transition ${selected
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                            }`}
                  >
                            <span className="mr-2">{selected ? '〇' : '×'}</span>
                            {pref.name_ja}
                  </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {activeTab === 'sns' && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(snsTypeLabels).map(([key, label]) => {
                      const selected = selectedSnsCategories.includes(key);
                return (
                    <button
                          key={key}
                          onClick={() => {
                            if (selected) {
                              setSelectedSnsCategories(selectedSnsCategories.filter(c => c !== key));
                            } else {
                              setSelectedSnsCategories([...selectedSnsCategories, key]);
                            }
                        setTimeout(saveUserPreferences, 100);
                      }}
                          className={`px-3 py-2 rounded-md border transition ${selected
                            ? 'bg-orange-600 text-white border-orange-600'
                            : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'
                          }`}
                    >
                          <span className="mr-2">{selected ? '〇' : '×'}</span>
                          {label}
                    </button>
                );
              })}
                  </div>
                )}
            </div>
            )}
          </div>
        )}

        {/* コンテンツ表示 */}
        {isInitialLoading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="space-y-4">
            {activeTab === 'news' && (
              <>
                {newsData.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">ニュースリリースが見つかりませんでした</p>
                    <p className="text-sm text-gray-400 mt-2">
                      カテゴリーを選択してください
                    </p>
                  </div>
                ) : (
                  newsData.slice(0, newsVisibleCount).map((news) => (
                    <div key={news.id} className="bg-white rounded-lg shadow-sm border p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                              {newsreleaseTypeLabels[news.category as keyof typeof newsreleaseTypeLabels]}
                            </span>
                            <span className="text-sm text-gray-500">
                              {new Date(news.published_at).toLocaleDateString('ja-JP')}
                            </span>
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            {news.title}
                          </h3>
                          <p className="text-gray-600 mb-3">
                            {news.content}
                          </p>
                          {news.thumbnail_url && (
                            <div className="mb-3">
                              <img src={news.thumbnail_url} alt={news.title} className="w-full max-w-md rounded-md border" />
                            </div>
                          )}
                          {news.url && (
                            <a
                              href={news.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              詳細を見る →
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                {newsData.length > newsVisibleCount && (
                  <div className="flex justify-center pt-2">
                    <button
                      onClick={() => setNewsVisibleCount(newsVisibleCount + 20)}
                      className="px-4 py-2 text-sm rounded-md border bg-gray-50 hover:bg-gray-100"
                    >
                      さらに表示
                    </button>
                  </div>
                )}
              </>
            )}

            {activeTab === 'events' && (
              <>
                {eventsData.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">イベント・ボランティア情報が見つかりませんでした</p>
                    <p className="text-sm text-gray-400 mt-2">
                      カテゴリーや都道府県を選択してください
                    </p>
                  </div>
                ) : (
                  eventsData.slice(0, eventsVisibleCount).map((event) => (
                    <div key={event.id} className="bg-white rounded-lg shadow-sm border p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                              {eventTypeLabels[event.category as keyof typeof eventTypeLabels]}
                            </span>
                            {event.prefecture && (
                              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                                {prefectures.find(p => p.id === event.prefecture)?.name_ja}
                              </span>
                            )}
                            <span className="text-sm text-gray-500">
                              {new Date(event.event_date).toLocaleDateString('ja-JP')}
                            </span>
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            {event.title}
                          </h3>
                          <p className="text-gray-600 mb-2">
                            {event.description}
                          </p>
                          {event.location && (
                            <p className="text-sm text-gray-500 mb-2">
                              📍 {event.location}
                            </p>
                          )}
                          {event.thumbnail_url && (
                            <div className="mb-3">
                              <img src={event.thumbnail_url} alt={event.title} className="w-full max-w-md rounded-md border" />
                            </div>
                          )}
                          {event.url && (
                            <a
                              href={event.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-green-600 hover:text-green-800 text-sm"
                            >
                              詳細・申込み →
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                {eventsData.length > eventsVisibleCount && (
                  <div className="flex justify-center pt-2">
                    <button
                      onClick={() => setEventsVisibleCount(eventsVisibleCount + 20)}
                      className="px-4 py-2 text-sm rounded-md border bg-gray-50 hover:bg-gray-100"
                    >
                      さらに表示
                    </button>
                  </div>
                )}
              </>
            )}

            {activeTab === 'sns' && (
              <>
                {snsData.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">公式SNS投稿が見つかりませんでした</p>
                    <p className="text-sm text-gray-400 mt-2">
                      SNSカテゴリーを選択してください
                    </p>
                  </div>
                ) : (
                  snsData.slice(0, snsVisibleCount).map((sns) => (
                    <div key={sns.id} className="bg-white rounded-lg shadow-sm border p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                              {sns.platform === 'twitter'
                                ? snsTypeLabels.X
                                : sns.platform === 'twitter2'
                                ? snsTypeLabels.X2
                                : sns.platform === 'youtube'
                                ? snsTypeLabels.YouTube
                                : sns.platform === 'iceage'
                                ? snsTypeLabels.iceage
                                : 'SNS'}
                            </span>
                            <span className="text-sm text-gray-500">
                              {new Date(sns.published_at).toLocaleDateString('ja-JP')}
                            </span>
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            {(() => {
                              const full = sns.title || '投稿';
                              const isLong = (sns.title?.length || 0) > 140;
                              const expanded = !!expandedSnsIds[sns.id];
                              const shown = !isLong || expanded ? full : full.substring(0, 140) + '...';
                              return (
                                <>
                                  {shown}
                                  {isLong && (
                                    <button
                                      onClick={() => toggleSnsExpand(sns.id)}
                                      className="ml-2 text-xs text-gray-600 underline align-baseline"
                                    >
                                      {expanded ? '閉じる' : 'さらに表示'}
                                    </button>
                                  )}
                                </>
                              );
                            })()}
                          </h3>
                          {sns.thumbnail_url && (
                            <div className="mb-4">
                              <img
                                src={sns.thumbnail_url}
                                alt={sns.title || 'サムネイル'}
                                className="w-full max-w-md rounded-md border"
                              />
                            </div>
                          )}
                          {sns.url && (
                            <a
                              href={sns.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-orange-600 hover:text-orange-800 text-sm"
                            >
                              投稿を見る →
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                {snsData.length > snsVisibleCount && (
                  <div className="flex justify-center pt-2">
                    <button
                      onClick={() => setSnsVisibleCount(snsVisibleCount + 20)}
                      className="px-4 py-2 text-sm rounded-md border bg-gray-50 hover:bg-gray-100"
                    >
                      さらに表示
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {!profile && (
          <div className="text-center py-12">
            <p className="text-gray-500">ログインが必要です</p>
          </div>
        )}

        {/* 都道府県のポップアップは廃止（インライン選択に変更） */}
      </div>
    </Layout>
  );
}
