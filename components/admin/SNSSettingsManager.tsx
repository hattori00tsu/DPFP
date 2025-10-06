'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Plus, Edit2, Trash2, Save, X, Twitter, Youtube } from 'lucide-react';
import { snsTypeLabels } from '@/public/category';
import { supabase } from '@/lib/supabase';

interface SNSSetting {
  id: string;
  platform: string;
  account_name: string;
  account_url: string;
  rss_url?: string;
  scraping_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function SNSSettingsManager() {
  const defaultPlatform = ('X' in snsTypeLabels) ? 'X' : (Object.keys(snsTypeLabels)[0] || '');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    platform: defaultPlatform,
    account_name: '',
    account_url: '',
    rss_url: '',
    scraping_url: '',
    // YouTube専用: チャンネルID（UCで始まるID）
    youtube_channel_id: '',
    is_active: true
  });

  // SWR fetcher
  const settingsFetcher = async () => {
    const response = await fetch('/api/admin/sns-settings');
    if (!response.ok) throw new Error('Failed to fetch SNS settings');
    const data = await response.json();
    return data.settings || [];
  };

  // SWR hook
  const { data: settings = [], error: settingsError, mutate: mutateSettings, isLoading: loading } = useSWR(
    'admin-sns-settings',
    settingsFetcher,
    { revalidateOnFocus: false }
  );

  // Realtime subscription for SNS settings
  useEffect(() => {
    const channel = supabase
      .channel('official_sns_settings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'official_sns_settings'
        },
        (payload) => {
          mutateSettings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [mutateSettings]);

  const isTwitterKey = (p: string) => ['X', 'X2'].includes(p);
  const isYouTubeKey = (p: string) => ['YouTube', 'iceage'].includes(p);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = editingId 
        ? `/api/admin/sns-settings/${editingId}`
        : '/api/admin/sns-settings';
      
      const method = editingId ? 'PUT' : 'POST';
      // 送信前にYouTube用に派生フィールドを整形
      const payload = { ...formData } as any;
      if (isYouTubeKey(payload.platform)) {
        const id = (payload.youtube_channel_id || '').trim();
        if (id) {
          const separator = payload.account_url && payload.account_url.includes('?') ? '&' : '?';
          payload.scraping_url = `${payload.account_url || 'https://www.youtube.com'}${separator}channel_id=${id}`;
          // rss_url は空のままでOK（サーバ側で scraping_url から channel_id を抽出してRSSへフォールバック）
        }
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        mutateSettings();
        resetForm();
      } else {
        const error = await response.json();
        alert(error.error || '保存に失敗しました');
      }
    } catch (error) {
      console.error('Error saving SNS setting:', error);
      alert('保存中にエラーが発生しました');
    }
  };

  const handleEdit = (setting: SNSSetting) => {
    // 既存設定からYouTubeのチャンネルIDを推測
    let youtube_channel_id = '';
    if (isYouTubeKey(setting.platform)) {
      const fromRss = setting.rss_url?.match(/channel_id=([^&#]+)/);
      const fromQuery = setting.scraping_url?.match(/[?&]channel_id=([^&#]+)/);
      const fromPath = setting.account_url?.match(/\/channel\/([^/?#]+)/);
      youtube_channel_id = (fromRss?.[1] || fromQuery?.[1] || fromPath?.[1] || '').trim();
    }

    setFormData({
      platform: setting.platform,
      account_name: setting.account_name,
      account_url: setting.account_url,
      rss_url: setting.rss_url || '',
      scraping_url: setting.scraping_url || '',
      youtube_channel_id,
      is_active: setting.is_active
    });
    setEditingId(setting.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('このSNS設定を削除してもよろしいですか？')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/sns-settings/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        mutateSettings();
      } else {
        const error = await response.json();
        alert(error.error || '削除に失敗しました');
      }
    } catch (error) {
      console.error('Error deleting SNS setting:', error);
      alert('削除中にエラーが発生しました');
    }
  };

  const resetForm = () => {
    setFormData({
      platform: defaultPlatform,
      account_name: '',
      account_url: '',
      rss_url: '',
      scraping_url: '',
      youtube_channel_id: '',
      is_active: true
    });
    setEditingId(null);
    setShowForm(false);
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'X':
      case 'X2':
        return <Twitter className="w-4 h-4" />;
      case 'YouTube':
      case 'iceage':
        return <Youtube className="w-4 h-4" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">公式SNS設定</h2>
          <p className="text-gray-600 text-sm mt-1">
            X (Twitter) と YouTube の公式アカウント設定を管理します
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          新規追加
        </button>
      </div>

      {/* 設定フォーム */}
      {showForm && (
        <div className="mb-6 p-4 border rounded-lg bg-gray-50">
          <h3 className="font-medium text-gray-900 mb-4">
            {editingId ? 'SNS設定を編集' : '新しいSNS設定を追加'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  プラットフォーム
                </label>
                <select
                  value={formData.platform}
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {Object.entries(snsTypeLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  アカウント名
                </label>
                <input
                  type="text"
                  value={formData.account_name}
                  onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="国民民主党"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                アカウントURL
              </label>
              <input
                type="url"
                value={formData.account_url}
                onChange={(e) => setFormData({ ...formData, account_url: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={isYouTubeKey(formData.platform) ? 'https://www.youtube.com/@dpfp_jp' : 'https://twitter.com/dpfp_jp'}
                required
              />
            </div>

            {isTwitterKey(formData.platform) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  RSS URL (rsss.app)
                </label>
                <input
                  type="url"
                  value={formData.rss_url}
                  onChange={(e) => setFormData({ ...formData, rss_url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://rsss.app/twitter/dpfp_jp"
                />
                <p className="text-xs text-gray-500 mt-1">
                  rsss.app で生成されたRSS URLを入力してください
                </p>
              </div>
            )}

            {isYouTubeKey(formData.platform) && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    チャンネルID（UCで始まるID）
                  </label>
                  <input
                    type="text"
                    value={formData.youtube_channel_id}
                    onChange={(e) => setFormData({ ...formData, youtube_channel_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="例: UCxxxxxxxxxxxxxxxx"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    入力されたチャンネルIDから自動でRSSを取得します（URLに ?channel_id= を付加して保存）。
                  </p>
                </div>
              </>
            )}

            <div className="flex items-center">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="is_active" className="ml-2 block text-sm text-gray-700">
                有効にする
              </label>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={resetForm}
                className="flex items-center px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                <X className="w-4 h-4 mr-2" />
                キャンセル
              </button>
              <button
                type="submit"
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Save className="w-4 h-4 mr-2" />
                保存
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 設定一覧 */}
      <div className="space-y-4">
        {settings.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            SNS設定がありません。新規追加ボタンから設定を追加してください。
          </div>
        ) : (
          settings.map((setting: SNSSetting) => (
            <div key={setting.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getPlatformIcon(setting.platform)}
                  <div>
                    <h3 className="font-medium text-gray-900">{setting.account_name}</h3>
                    <p className="text-sm text-gray-600">{setting.account_url}</p>
                    {setting.platform === 'twitter' && setting.rss_url && (
                      <p className="text-xs text-gray-500">RSS: {setting.rss_url}</p>
                    )}
                    {setting.platform === 'youtube' && setting.scraping_url && (
                      <p className="text-xs text-gray-500">スクレイピング: {setting.scraping_url}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    setting.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {setting.is_active ? '有効' : '無効'}
                  </span>
                  <button
                    onClick={() => handleEdit(setting)}
                    className="p-2 text-gray-600 hover:text-blue-600"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(setting.id)}
                    className="p-2 text-gray-600 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}