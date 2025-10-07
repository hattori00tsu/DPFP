'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { supabase } from '@/lib/supabase';
import { Plus, Edit, Trash2, Search, X, Check } from 'lucide-react';
import { politicianTypeLabels, mediaTypeLabels } from '@/public/category';
import { prefectures } from '@/public/prefecture';

interface CustomTimeline {
  id: string;
  name: string;
  description: string;
  include_x: boolean;
  include_youtube: boolean;
  enabled_platforms?: {
    x: boolean;
    facebook: boolean;
    instagram: boolean;
    youtube: boolean;
    line: boolean;
    blog: boolean;
    note: boolean;
    tiktok: boolean;
    niconico: boolean;
  };
  filters?: {
    regions?: string[];
    politician_ids?: string[];
    platforms?: string[];
    politician_platforms?: Record<string, string[]>; // 追加: 議員ごとのSNS選択
  };
  created_at: string;
}

interface Politician {
  id: string;
  name: string;
  name_kana: string;
  prefecture: string;
  position: string;
  party: string;
  x_account?: string;
  youtube_channel?: string;
}

interface Prefecture {
  code: string;
  name: string;
}

// public/category.tsx の politicianTypeLabels を使用
const POSITION_LABELS = politicianTypeLabels;

interface CustomTimelineManagerProps {
  userId: string;
}

export default function CustomTimelineManager({ userId }: CustomTimelineManagerProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTimeline, setEditingTimeline] = useState<CustomTimeline | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPrefecture, setSelectedPrefecture] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('');
  const [maxTimelines, setMaxTimelines] = useState<number>(3);

  // フォーム状態
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    include_x: true,
    include_youtube: true,
    enabledPlatforms: Object.keys(mediaTypeLabels).reduce((acc: any, key) => {
      acc[key] = true; // デフォルトは全SNSを選択
      return acc;
    }, {} as Record<string, boolean>),
    politicianPlatforms: {} as Record<string, Record<string, boolean>>, // 議員ごとのSNS選択
    prefecturePlatforms: {} as Record<string, Record<string, boolean>>, // 都道府県ごとの上書き
    selectedPrefectures: [] as string[],
    selectedPoliticians: [] as string[]
  });

  // SWR fetchers
  const timelinesFetcher = async () => {
    const { data, error } = await supabase
      .from('custom_timelines')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  };

  const politiciansFetcher = async () => {
    const { data, error } = await supabase
      .from('politicians')
      .select('*')
      .order('name');

    if (error) throw error;
    return data || [];
  };

  // SWR hooks
  const { data: timelines = [], error: timelinesError, mutate: mutateTimelines, isLoading: loading } = useSWR(
    `timelines-${userId}`,
    timelinesFetcher,
    { revalidateOnFocus: false }
  );

  const subscriptionFetcher = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/subscriptions/summary?userId=${userId}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Failed to fetch subscription');
    return res.json();
  };

  const { data: subscriptionResp } = useSWR(
    userId ? `subscription-${userId}` : null,
    subscriptionFetcher,
    { revalidateOnFocus: false }
  );

  useEffect(() => {
    const limit = subscriptionResp?.subscription?.maxCustomTimelines;
    if (typeof limit === 'number' && limit > 0) {
      setMaxTimelines(limit);
    } else {
      setMaxTimelines(3);
    }
  }, [subscriptionResp]);

  const { data: politicians = [], error: politiciansError } = useSWR(
    'politicians',
    politiciansFetcher,
    { revalidateOnFocus: false }
  );

  // Realtime subscription for timelines
  useEffect(() => {
    const channel = supabase
      .channel('custom_timelines_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'custom_timelines',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          mutateTimelines();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, mutateTimelines]);

  const filteredPoliticians = politicians.filter(politician => {
    const matchesSearch = searchTerm === '' || 
      politician.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      politician.name_kana.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPrefecture = selectedPrefecture === '' || 
      politician.prefecture === selectedPrefecture;
    
    const matchesPosition = selectedPosition === '' || 
      politician.position === selectedPosition;

    return matchesSearch && matchesPrefecture && matchesPosition;
  });

  const handleCreateTimeline = async () => {
    if (!formData.name.trim()) return;

    try {
      // filtersカラム用のデータを準備
      const filters = {
        regions: formData.selectedPrefectures,
        politician_ids: formData.selectedPoliticians,
        platforms: Object.entries(formData.enabledPlatforms)
          .filter(([_, enabled]) => enabled)
          .map(([platform]) => platform),
        politician_platforms: Object.fromEntries(
          Object.entries(formData.politicianPlatforms).map(([politicianId, per]) => [
            politicianId,
            Object.entries(per)
              .filter(([k, v]) => k in mediaTypeLabels && v)
              .map(([k]) => k)
          ])
        )
      };

      const { data: timeline, error: timelineError } = await supabase
        .from('custom_timelines')
        .insert({
          user_id: userId,
          name: formData.name,
          description: formData.description,
          include_x: formData.include_x,
          include_youtube: formData.include_youtube,
          enabled_platforms: formData.enabledPlatforms,
          filters: filters
        })
        .select()
        .single();

      if (timelineError) throw timelineError;

      // 都道府県を追加（都道府県ごとのSNS上書きを保存）
      if (formData.selectedPrefectures.length > 0) {
        const prefectureInserts = formData.selectedPrefectures.map(prefCode => {
          const perPref = formData.prefecturePlatforms[prefCode];
          const enabled = perPref
            ? Object.fromEntries(
                Object.entries(perPref).filter(([k, v]) => k in mediaTypeLabels && v)
              )
            : null;
          const base: any = {
            timeline_id: timeline.id,
            prefecture_code: prefCode
          };
          if (enabled && Object.keys(enabled).length > 0) {
            base.enabled_platforms = enabled;
          }
          return base;
        });

        const { error: prefError } = await supabase
          .from('timeline_prefectures')
          .insert(prefectureInserts);

        if (prefError) throw prefError;
      }

      // 議員を追加
      if (formData.selectedPoliticians.length > 0) {
        const politicianInserts = formData.selectedPoliticians.map(politicianId => ({
          timeline_id: timeline.id,
          politician_id: politicianId
        }));

        const { error: polError } = await supabase
          .from('timeline_politicians')
          .insert(politicianInserts);

        if (polError) throw polError;
      }

      resetForm();
      setShowCreateModal(false);
      mutateTimelines();
    } catch (error: any) {
      console.error('Error creating timeline:', error);
      if (typeof error?.message === 'string' && error.message.includes('タイムラインの上限')) {
        alert(`タイムラインの上限は${maxTimelines}個までです`);
      }
    }
  };

  const handleEditTimeline = async (timeline: CustomTimeline) => {
    // 既存のタイムライン設定を取得
    const { data: prefectures } = await supabase
      .from('timeline_prefectures')
      .select('prefecture_code, enabled_platforms')
      .eq('timeline_id', timeline.id);

    const { data: politicians } = await supabase
      .from('timeline_politicians')
      .select('politician_id')
      .eq('timeline_id', timeline.id);

    const prefecturePlatforms: Record<string, Record<string, boolean>> = {};
    (prefectures || []).forEach((p: any) => {
      if (p.enabled_platforms) {
        const base = Object.keys(mediaTypeLabels).reduce((acc: any, key) => {
          acc[key] = false;
          return acc;
        }, {} as Record<string, boolean>);
        Object.entries(p.enabled_platforms).forEach(([plat, enabled]: any) => {
          if (plat in base) base[plat] = !!enabled;
        });
        prefecturePlatforms[p.prefecture_code] = base;
      }
    });

    setFormData({
      name: timeline.name,
      description: timeline.description || '',
      include_x: timeline.include_x,
      include_youtube: timeline.include_youtube,
      enabledPlatforms: (() => {
        const base = Object.keys(mediaTypeLabels).reduce((acc: any, key) => {
          acc[key] = false;
          return acc;
        }, {} as Record<string, boolean>);
        if (timeline.enabled_platforms) {
          Object.entries(timeline.enabled_platforms).forEach(([k, v]: any) => {
            if (k in base) base[k] = !!v;
          });
          return base;
        }
        base['x'] = !!timeline.include_x;
        base['youtube'] = !!timeline.include_youtube;
        return base;
      })(),
      politicianPlatforms: (() => {
        const map: Record<string, Record<string, boolean>> = {};
        const pp = timeline.filters?.politician_platforms || {};
        Object.entries(pp).forEach(([politicianId, platforms]) => {
          const base = Object.keys(mediaTypeLabels).reduce((acc: any, key) => {
            acc[key] = false;
            return acc;
          }, {} as Record<string, boolean>);
          (platforms as string[]).forEach((k) => {
            if (k in base) base[k] = true;
          });
          map[politicianId] = base;
        });
        return map;
      })(),
      prefecturePlatforms,
      selectedPrefectures: prefectures?.map((p: any) => p.prefecture_code) || [],
      selectedPoliticians: politicians?.map(p => p.politician_id) || []
    });

    setEditingTimeline(timeline);
    setShowCreateModal(true);
  };

  const handleUpdateTimeline = async () => {
    if (!editingTimeline || !formData.name.trim()) return;

    try {
      // filtersカラム用のデータを準備
      const filters = {
        regions: formData.selectedPrefectures,
        politician_ids: formData.selectedPoliticians,
        platforms: Object.entries(formData.enabledPlatforms)
          .filter(([_, enabled]) => enabled)
          .map(([platform]) => platform),
        politician_platforms: Object.fromEntries(
          Object.entries(formData.politicianPlatforms).map(([politicianId, per]) => [
            politicianId,
            Object.entries(per)
              .filter(([k, v]) => k in mediaTypeLabels && v)
              .map(([k]) => k)
          ])
        )
      };

      // タイムライン基本情報を更新
      const { error: updateError } = await supabase
        .from('custom_timelines')
        .update({
          name: formData.name,
          description: formData.description,
          include_x: formData.include_x,
          include_youtube: formData.include_youtube,
          enabled_platforms: formData.enabledPlatforms,
          filters: filters
        })
        .eq('id', editingTimeline.id);

      if (updateError) throw updateError;

      // 既存の都道府県と議員を削除
      await supabase
        .from('timeline_prefectures')
        .delete()
        .eq('timeline_id', editingTimeline.id);

      await supabase
        .from('timeline_politicians')
        .delete()
        .eq('timeline_id', editingTimeline.id);

      // 新しい都道府県を追加（都道府県ごとのSNS上書きを保存）
      if (formData.selectedPrefectures.length > 0) {
        const prefectureInserts = formData.selectedPrefectures.map(prefCode => {
          const perPref = formData.prefecturePlatforms[prefCode];
          const enabled = perPref
            ? Object.fromEntries(
                Object.entries(perPref).filter(([k, v]) => k in mediaTypeLabels && v)
              )
            : null;
          const base: any = {
            timeline_id: editingTimeline.id,
            prefecture_code: prefCode
          };
          if (enabled && Object.keys(enabled).length > 0) {
            base.enabled_platforms = enabled;
          }
          return base;
        });

        const { error: prefError } = await supabase
          .from('timeline_prefectures')
          .insert(prefectureInserts);

        if (prefError) throw prefError;
      }

      // 新しい議員を追加
      if (formData.selectedPoliticians.length > 0) {
        const politicianInserts = formData.selectedPoliticians.map(politicianId => ({
          timeline_id: editingTimeline.id,
          politician_id: politicianId
        }));

        const { error: polError } = await supabase
          .from('timeline_politicians')
          .insert(politicianInserts);

        if (polError) throw polError;
      }

      resetForm();
      setShowCreateModal(false);
      setEditingTimeline(null);
      mutateTimelines();
    } catch (error: any) {
      console.error('Error updating timeline:', error);
    }
  };

  const handleDeleteTimeline = async (timelineId: string) => {
    if (!confirm('このタイムラインを削除しますか？')) return;

    const { error } = await supabase
      .from('custom_timelines')
      .delete()
      .eq('id', timelineId);

    if (error) {
      console.error('Error deleting timeline:', error);
    } else {
      mutateTimelines();
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      include_x: true,
      include_youtube: true,
      enabledPlatforms: Object.keys(mediaTypeLabels).reduce((acc: any, key) => {
        acc[key] = true; // デフォルトは全SNSを選択
        return acc;
      }, {} as Record<string, boolean>),
      politicianPlatforms: {},
      prefecturePlatforms: {},
      selectedPrefectures: [],
      selectedPoliticians: []
    });
    setSearchTerm('');
    setSelectedPrefecture('');
    setSelectedPosition('');
    setEditingTimeline(null);
  };

  const togglePlatform = (platform: keyof typeof formData.enabledPlatforms) => {
    setFormData(prev => ({
      ...prev,
      enabledPlatforms: {
        ...prev.enabledPlatforms,
        [platform]: !prev.enabledPlatforms[platform]
      }
    }));
  };

  const togglePrefecturePlatform = (prefCode: string, platform: string) => {
    setFormData(prev => {
      const existing = prev.prefecturePlatforms[prefCode] || {} as Record<string, boolean>;
      const currentVal = existing[platform];
      const nextVal = !(currentVal === undefined ? true : currentVal);
      return {
        ...prev,
        prefecturePlatforms: {
          ...prev.prefecturePlatforms,
          [prefCode]: {
            ...existing,
            [platform]: nextVal
          }
        }
      };
    });
  };

  const togglePrefecture = (prefCode: string) => {
    setFormData(prev => ({
      ...prev,
      selectedPrefectures: prev.selectedPrefectures.includes(prefCode)
        ? prev.selectedPrefectures.filter(p => p !== prefCode)
        : [...prev.selectedPrefectures, prefCode]
    }));
  };

  const togglePolitician = (politicianId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedPoliticians: prev.selectedPoliticians.includes(politicianId)
        ? prev.selectedPoliticians.filter(p => p !== politicianId)
        : [...prev.selectedPoliticians, politicianId]
    }));
  };

  if (loading) {
    return <div className="text-center py-8">読み込み中...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">カスタムタイムライン</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={timelines.length >= maxTimelines}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4 mr-2" />
          新規作成 ({timelines.length}/{maxTimelines})
        </button>
      </div>

      {/* タイムライン一覧 */}
      <div className="grid gap-4">
        {timelines.map(timeline => (
          <div key={timeline.id} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">{timeline.name}</h3>
                {timeline.description && (
                  <p className="text-gray-600 mt-1">{timeline.description}</p>
                )}
                <div className="flex flex-wrap items-center mt-2 gap-2">
                  {timeline.enabled_platforms ? (
                    Object.entries(timeline.enabled_platforms).map(([platform, enabled]) => {
                      if (!enabled) return null;
                      const platformLabels: Record<string, string> = {
                        x: 'X',
                        facebook: 'Facebook',
                        instagram: 'Instagram',
                        youtube: 'YouTube',
                        line: 'LINE',
                        blog: 'Blog',
                        note: 'Note',
                        tiktok: 'Tiktok',
                        niconico: 'Niconico'
                      };
                      return (
                        <span key={platform} className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                          {platformLabels[platform]}
                        </span>
                      );
                    })
                  ) : (
                    <>
                      <span className={`text-sm ${timeline.include_x ? 'text-green-600' : 'text-gray-400'}`}>
                        X {timeline.include_x ? '✓' : '✗'}
                      </span>
                      <span className={`text-sm ${timeline.include_youtube ? 'text-green-600' : 'text-gray-400'}`}>
                        YouTube {timeline.include_youtube ? '✓' : '✗'}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEditTimeline(timeline)}
                  className="p-2 text-gray-400 hover:text-blue-600"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteTimeline(timeline.id)}
                  className="p-2 text-gray-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 作成モーダル */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {editingTimeline ? 'タイムライン編集' : '新しいタイムライン作成'}
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 基本情報 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  タイムライン名 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例: 関東地方の議員"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  説明
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="タイムラインの説明を入力"
                />
              </div>

              {/* 都道府県選択 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  都道府県選択
                </label>
                <div className="grid grid-cols-8 gap-2 border border-gray-200 rounded p-2">
                  {prefectures.map(pref => {
                    const selected = formData.selectedPrefectures.includes(pref.id);
                    return (
                      <button
                        type="button"
                        key={pref.id}
                        onClick={() => togglePrefecture(pref.id)}
                        aria-pressed={selected}
                        className={`text-sm px-2 py-1 rounded border transition ${
                          selected
                            ? 'bg-blue-100 text-blue-800 border-blue-300'
                            : 'bg-gray-50 text-gray-400 border-gray-200'
                        }`}
                      >
                        <span className="mr-1">{selected ? '〇' : '×'}</span>
                        {pref.name_ja}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 都道府県ごとのSNS上書き */}
              {formData.selectedPrefectures.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    都道府県ごとのSNS設定（上書き）
                  </label>
                  <div className="space-y-3">
                    {formData.selectedPrefectures.map(prefCode => (
                      <div key={prefCode} className="border rounded p-3">
                        <div className="text-sm font-medium mb-2">
                          {prefectures.find(p => p.id === prefCode)?.name_ja}
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          {Object.entries(mediaTypeLabels).map(([key, label]) => {
                            const v = formData.prefecturePlatforms[prefCode]?.[key];
                            const selected = v === undefined ? true : v;
                            return (
                              <button
                                type="button"
                                key={key}
                                onClick={() => togglePrefecturePlatform(prefCode, key)}
                                aria-pressed={selected}
                                className={`text-sm px-2 py-1 rounded border transition ${
                                  selected
                                    ? 'bg-blue-100 text-blue-800 border-blue-300'
                                    : 'bg-gray-50 text-gray-400 border-gray-200'
                                }`}
                              >
                                <span className="mr-1">{selected ? '〇' : '×'}</span>
                                {label}
                              </button>
                            );
                          })}
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                          チェックしたSNSのみ、この都道府県では表示されます（未設定の場合は全体設定に従います）。
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 議員検索・選択 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  議員選択
                </label>
                
                {/* 検索フィルター */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <input
                      type="text"
                      placeholder="議員名で検索"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <select
                    value={selectedPrefecture}
                    onChange={(e) => setSelectedPrefecture(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">全都道府県</option>
                    {prefectures.map(pref => (
                      <option key={pref.id} value={pref.id}>{pref.name_ja}</option>
                    ))}
                  </select>
                  <select
                    value={selectedPosition}
                    onChange={(e) => setSelectedPosition(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">全ての役職</option>
                    {Object.entries(POSITION_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                {/* 議員リスト */}
                <div className="max-h-64 overflow-y-auto border border-gray-200 rounded p-2">
                {filteredPoliticians.map(politician => (
                  <div key={politician.id} className="p-2 hover:bg-gray-50 border-b last:border-b-0">
                    <button
                      type="button"
                      onClick={() => togglePolitician(politician.id)}
                      className="w-full flex items-center text-left"
                      aria-pressed={formData.selectedPoliticians.includes(politician.id)}
                    >
                      <span className={`mr-3 ${formData.selectedPoliticians.includes(politician.id) ? 'text-blue-600' : 'text-gray-400'}`}>
                        {formData.selectedPoliticians.includes(politician.id) ? '〇' : '×'}
                      </span>
                      <div className="flex-1">
                        <div className="font-medium">{politician.name}</div>
                        <div className="text-sm text-gray-500">
                          {prefectures.find(p => p.id === politician.prefecture)?.name_ja} - {POSITION_LABELS[politician.position as keyof typeof POSITION_LABELS]}
                        </div>
                      </div>
                    </button>

                    {/* 議員ごとのSNS選択 */}
                    {formData.selectedPoliticians.includes(politician.id) && (
                      <div className="mt-2 grid grid-cols-4 gap-2">
                        {Object.entries(mediaTypeLabels).map(([key, label]) => {
                          const v = formData.politicianPlatforms[politician.id]?.[key];
                          const selected = v === undefined ? true : v;
                          return (
                            <button
                              type="button"
                              key={key}
                              onClick={() => {
                                setFormData(prev => {
                                  const current = prev.politicianPlatforms[politician.id] || {} as Record<string, boolean>;
                                  const currentVal = current[key];
                                  const nextVal = !(currentVal === undefined ? true : currentVal);
                                  return {
                                    ...prev,
                                    politicianPlatforms: {
                                      ...prev.politicianPlatforms,
                                      [politician.id]: {
                                        ...current,
                                        [key]: nextVal
                                      }
                                    }
                                  };
                                });
                              }}
                              aria-pressed={selected}
                              className={`text-sm px-2 py-1 rounded border transition ${
                                selected
                                  ? 'bg-blue-100 text-blue-800 border-blue-300'
                                  : 'bg-gray-50 text-gray-400 border-gray-200'
                              }`}
                            >
                              <span className="mr-1">{selected ? '〇' : '×'}</span>
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
                </div>
              </div>

              {/* アクションボタン */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  キャンセル
                </button>
                <button
                  onClick={editingTimeline ? handleUpdateTimeline : handleCreateTimeline}
                  disabled={!formData.name.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {editingTimeline ? '更新' : '作成'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}