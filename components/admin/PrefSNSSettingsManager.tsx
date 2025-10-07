'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { prefectures } from '@/public/prefecture';
import { mediaTypeLabels } from '@/public/category';
import { Plus, Save, X, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface PrefSNSSetting {
  id: string;
  prefecture: string; // code
  platform: string;
  account_name: string;
  account_url: string;
  rss_url?: string;
  scraping_url?: string;
  is_active: boolean;
  updated_at?: string;
}

export default function PrefSNSSettingsManager() {
  const defaultPlatform = Object.keys(mediaTypeLabels)[0] || '';
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<PrefSNSSetting | any>({
    prefecture: prefectures.find(p => p.id !== '48')?.id || '13',
    platform: defaultPlatform,
    account_name: '',
    account_url: '',
    rss_url: '',
    scraping_url: '',
    youtube_channel_id: '',
    is_active: true
  });

  const settingsFetcher = async () => {
    const res = await fetch('/api/admin/pref-sns-settings');
    if (!res.ok) throw new Error('failed');
    const json = await res.json();
    return (json.settings as PrefSNSSetting[]) || [];
  };

  const { data: settings = [], mutate, isLoading } = useSWR('admin-pref-sns-settings', settingsFetcher, { revalidateOnFocus: false });

  useEffect(() => {
    const channel = supabase
      .channel('prefectural_sns_settings_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'prefectural_sns_settings' },
        () => mutate()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [mutate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId ? `/api/admin/pref-sns-settings/${editingId}` : '/api/admin/pref-sns-settings';
    const method = editingId ? 'PUT' : 'POST';
    const payload: any = { ...formData };

    // YouTubeプラットフォームの補助
    const p = String(payload.platform || '').toLowerCase();
    if (p === 'youtube' || p === 'iceage') {
      const channelId = (payload.youtube_channel_id || '').trim();
      if (channelId && !payload.rss_url) {
        payload.rss_url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
      }
      if (payload.account_url && payload.account_url.includes('/channel/')) {
        const sep = payload.account_url.includes('?') ? '&' : '?';
        if (!payload.scraping_url) payload.scraping_url = `${payload.account_url}${sep}channel_id=${payload.account_url.split('/channel/')[1]}`;
      }
    }

    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) {
      mutate();
      resetForm();
    } else {
      const j = await res.json();
      alert(j.error || '保存に失敗しました');
    }
  };

  const resetForm = () => {
    setFormData({
      prefecture: prefectures.find(p => p.id !== '48')?.id || '13',
      platform: defaultPlatform,
      account_name: '',
      account_url: '',
      rss_url: '',
      scraping_url: '',
      is_active: true
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (s: PrefSNSSetting) => {
    setFormData({ ...s });
    setEditingId(s.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('このSNS設定を削除してもよろしいですか？')) return;
    const res = await fetch(`/api/admin/pref-sns-settings/${id}`, { method: 'DELETE' });
    if (res.ok) mutate(); else alert('削除に失敗しました');
  };

  const groupByPref = useMemo(() => {
    const map: Record<string, PrefSNSSetting[]> = {};
    for (const s of settings) {
      (map[s.prefecture] ||= []).push(s);
    }
    return map;
  }, [settings]);

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">都道府県支部SNS設定</h2>
          <p className="text-gray-600 text-sm mt-1">都道府県ごとの支部SNSアカウントを管理します</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700">
          <Plus className="w-4 h-4 mr-2" /> 新規追加
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-4 border rounded-lg bg-gray-50">
          <h3 className="font-medium text-gray-900 mb-4">{editingId ? 'SNS設定を編集' : '新しいSNS設定を追加'}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">都道府県</label>
                <select value={formData.prefecture} onChange={(e) => setFormData({ ...formData, prefecture: e.target.value })} className="w-full px-3 py-2 border rounded-md" required>
                  {prefectures.map(p => (
                    <option key={p.id} value={p.id}>{p.name_ja}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">プラットフォーム</label>
                <select value={formData.platform} onChange={(e) => setFormData({ ...formData, platform: e.target.value })} className="w-full px-3 py-2 border rounded-md" required>
                  {Object.entries(mediaTypeLabels).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">アカウント名</label>
                <input type="text" value={formData.account_name} onChange={(e) => setFormData({ ...formData, account_name: e.target.value })} className="w-full px-3 py-2 border rounded-md" required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">アカウントURL</label>
              <input type="url" value={formData.account_url} onChange={(e) => setFormData({ ...formData, account_url: e.target.value })} className="w-full px-3 py-2 border rounded-md" required />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">RSS URL</label>
                <input type="url" value={formData.rss_url} onChange={(e) => setFormData({ ...formData, rss_url: e.target.value })} className="w-full px-3 py-2 border rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">スクレイピングURL</label>
                <input type="url" value={formData.scraping_url} onChange={(e) => setFormData({ ...formData, scraping_url: e.target.value })} className="w-full px-3 py-2 border rounded-md" />
              </div>
            </div>

            {(String(formData.platform || '').toLowerCase() === 'youtube' || String(formData.platform || '').toLowerCase() === 'iceage') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">YouTube チャンネルID（UC〜）</label>
                  <input
                    type="text"
                    value={formData.youtube_channel_id}
                    onChange={(e) => setFormData({ ...formData, youtube_channel_id: e.target.value })}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="例: UCxxxxxxxxxxxxxxxx"
                  />
                  <p className="text-xs text-gray-500 mt-1">URLとチャンネルIDを入力するとRSSを自動生成します。</p>
                </div>
              </div>
            )}

            <div className="flex items-center">
              <input type="checkbox" id="active" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} className="h-4 w-4" />
              <label htmlFor="active" className="ml-2 text-sm text-gray-700">有効にする</label>
            </div>

            <div className="flex justify-end space-x-3">
              <button type="button" onClick={resetForm} className="flex items-center px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">
                <X className="w-4 h-4 mr-2" /> キャンセル
              </button>
              <button type="submit" className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700">
                <Save className="w-4 h-4 mr-2" /> 保存
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <div className="text-gray-500">読み込み中...</div>
      ) : (
        <div className="space-y-6">
          {prefectures.map(pref => {
            const list = groupByPref[pref.id] || [];
            return (
              <div key={pref.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900">{pref.name_ja}</h3>
                  <span className="text-xs text-gray-500">{list.length} 件</span>
                </div>
                {list.length === 0 ? (
                  <div className="text-sm text-gray-500">設定がありません</div>
                ) : (
                  <div className="space-y-2">
                    {list.map(s => (
                      <div key={s.id} className="flex items-center justify-between p-3 border rounded">
                        <div>
                          <div className="font-medium text-gray-900">{s.account_name}</div>
                          <div className="text-xs text-gray-600">{s.platform} / {s.account_url}</div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${s.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{s.is_active ? '有効' : '無効'}</span>
                          <button onClick={() => handleEdit(s)} className="p-2 text-gray-600 hover:text-blue-600"><Edit2 className="w-4 h-4"/></button>
                          <button onClick={() => handleDelete(s.id)} className="p-2 text-gray-600 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


