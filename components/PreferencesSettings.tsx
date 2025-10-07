'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Check, X, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { prefectures } from '@/public/prefecture';
import { politicianTypeLabels, snsTypeLabels } from '@/public/category';


interface Preference {
  id: string;
  preference_type: string;
  preference_value: string;
  is_active: boolean;
}

interface PreferencesSettingsProps {
  userId: string;
}

interface Politician {
  id: string;
  name: string;
  position: string;
  prefecture?: string;
  region?: string;
  party_role?: string;
}

const CATEGORIES = [
  { value: 'news', label: 'ニュース' },
  { value: 'team', label: 'チーム情報' },
  { value: 'policy', label: '政策' },
  { value: 'event', label: 'イベント' },
  { value: 'parliament', label: '国会情報' }
];

const EVENT_TYPES = [
  { value: 'rally', label: '集会' },
  { value: 'meeting', label: '会議' },
  { value: 'volunteer', label: 'ボランティア' },
  { value: 'other', label: 'その他' }
];

// public/category.tsx の politicianTypeLabels から役職候補を生成
const POLITICIAN_POSITIONS = Object.entries(politicianTypeLabels).map(([key, label]) => ({
  value: key,
  label
}));

const REGIONS = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
];

const SNS_PLATFORMS = Object.entries(snsTypeLabels).map(([value, label]) => ({ value, label }));

export default function PreferencesSettings({ userId }: PreferencesSettingsProps) {
  const [newKeyword, setNewKeyword] = useState('');
  const [saving, setSaving] = useState(false);

  // SWR fetchers
  const preferencesFetcher = async () => {
    const response = await fetch(`/api/preferences?userId=${userId}`);
    if (!response.ok) throw new Error('Failed to fetch preferences');
    const data = await response.json();
    return data.preferences || [];
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
  const { data: preferences = [], error: preferencesError, mutate: mutatePreferences, isLoading: loading } = useSWR(
    `preferences-${userId}`,
    preferencesFetcher,
    { revalidateOnFocus: false }
  );

  const { data: politicians = [], error: politiciansError } = useSWR(
    'politicians-list',
    politiciansFetcher,
    { revalidateOnFocus: false }
  );

  const toggleCategoryPreference = async (category: string) => {
    const existingPref = preferences.find(
      (p: Preference) => p.preference_type === 'category' && p.preference_value === category
    );

    try {
      setSaving(true);
      
      if (existingPref) {
        // 既存の設定を削除
        await fetch('/api/preferences', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            preferenceType: 'category',
            preferenceValue: category
          })
        });

        mutatePreferences();
      } else {
        // 新しい設定を追加
        const response = await fetch('/api/preferences', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            preferenceType: 'category',
            preferenceValue: category,
            isActive: true
          })
        });

        const data = await response.json();
        if (data.preference) {
          mutatePreferences();
        }
      }
    } catch (error) {
    } finally {
      setSaving(false);
    }
  };

  const addKeywordPreference = async () => {
    if (!newKeyword.trim()) return;

    try {
      setSaving(true);
      
      const response = await fetch('/api/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          preferenceType: 'keyword',
          preferenceValue: newKeyword.trim(),
          isActive: true
        })
      });

      const data = await response.json();
      if (data.preference) {
        mutatePreferences();
        setNewKeyword('');
      }
    } catch (error) {
    } finally {
      setSaving(false);
    }
  };

  const removeKeywordPreference = async (keyword: string) => {
    try {
      setSaving(true);
      
      await fetch('/api/preferences', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          preferenceType: 'keyword',
          preferenceValue: keyword
        })
      });

      mutatePreferences();
    } catch (error) {
    } finally {
      setSaving(false);
    }
  };

  const isCategorySelected = (category: string) => {
    return preferences.some(
      (p: Preference) => p.preference_type === 'category' && p.preference_value === category && p.is_active
    );
  };

  const isEventTypeSelected = (eventType: string) => {
    return preferences.some(
      (p: Preference) => p.preference_type === 'event_type' && p.preference_value === eventType && p.is_active
    );
  };

  const isPositionSelected = (position: string) => {
    return preferences.some(
      (p: Preference) => p.preference_type === 'position' && p.preference_value === position && p.is_active
    );
  };

  const isRegionSelected = (region: string) => {
    return preferences.some(
      (p: Preference) => p.preference_type === 'region' && p.preference_value === region && p.is_active
    );
  };

  const isPoliticianSelected = (politicianId: string) => {
    return preferences.some(
      (p: Preference) => p.preference_type === 'politician' && p.preference_value === politicianId && p.is_active
    );
  };

  const isPlatformSelected = (platform: string) => {
    return preferences.some(
      (p: Preference) => p.preference_type === 'platform' && p.preference_value === platform && p.is_active
    );
  };

  const getPrefectureName = (code?: string) => {
    if (!code) return '';
    const p = prefectures.find(p => p.id === code);
    return p ? p.name_ja : '';
  };

  const togglePreference = async (type: string, value: string) => {
    const existingPref = preferences.find(
      (p: Preference) => p.preference_type === type && p.preference_value === value
    );

    try {
      setSaving(true);
      
      if (existingPref) {
        // 既存の設定を削除
        await fetch('/api/preferences', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            preferenceType: type,
            preferenceValue: value
          })
        });

        mutatePreferences();
      } else {
        // 新しい設定を追加
        const response = await fetch('/api/preferences', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            preferenceType: type,
            preferenceValue: value,
            isActive: true
          })
        });

        const data = await response.json();
        if (data.preference) {
          mutatePreferences();
        }
      }
    } catch (error) {
    } finally {
      setSaving(false);
    }
  };

  const toggleEventTypePreference = (eventType: string) => togglePreference('event_type', eventType);
  const togglePositionPreference = (position: string) => togglePreference('position', position);
  const toggleRegionPreference = (region: string) => togglePreference('region', region);
  const togglePoliticianPreference = (politicianId: string) => togglePreference('politician', politicianId);
  const togglePlatformPreference = (platform: string) => togglePreference('platform', platform);

  const getKeywordPreferences = () => {
    return preferences.filter((p: Preference) => p.preference_type === 'keyword' && p.is_active);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">情報設定</h3>
        <p className="text-sm text-gray-600 mb-6">
          興味のある議員、地域、プラットフォームを選択すると、関連するSNS投稿や公式情報がタイムラインに表示されます。
        </p>
      </div>

      {/* 議員の役職選択 */}
      <div>
        <h4 className="text-md font-medium text-gray-800 mb-3">議員の役職</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {POLITICIAN_POSITIONS.map((position) => {
            const isSelected = isPositionSelected(position.value);
            return (
              <button
                key={position.value}
                onClick={() => togglePositionPreference(position.value)}
                disabled={saving}
                className={`flex items-center justify-center p-3 rounded-lg border-2 transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                } disabled:opacity-50`}
              >
                <div className="flex items-center space-x-2">
                  {isSelected && <Check className="w-4 h-4" />}
                  <span className="text-sm font-medium">{position.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 地域選択 */}
      <div>
        <h4 className="text-md font-medium text-gray-800 mb-3">地域</h4>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 max-h-48 overflow-y-auto">
          {REGIONS.map((region) => {
            const isSelected = isRegionSelected(region);
            return (
              <button
                key={region}
                onClick={() => toggleRegionPreference(region)}
                disabled={saving}
                className={`flex items-center justify-center p-2 rounded border transition-all text-xs ${
                  isSelected
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                } disabled:opacity-50`}
              >
                {isSelected && <Check className="w-3 h-3 mr-1" />}
                <span>{region}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SNSプラットフォーム選択 */}
      <div>
        <h4 className="text-md font-medium text-gray-800 mb-3">SNSプラットフォーム</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {SNS_PLATFORMS.map((platform) => {
            const isSelected = isPlatformSelected(platform.value);
            return (
              <button
                key={platform.value}
                onClick={() => togglePlatformPreference(platform.value)}
                disabled={saving}
                className={`flex items-center justify-center p-3 rounded-lg border-2 transition-all ${
                  isSelected
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                } disabled:opacity-50`}
              >
                <div className="flex items-center space-x-2">
                  {isSelected && <Check className="w-4 h-4" />}
                  <span className="text-sm font-medium">{platform.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 特定議員選択 */}
      <div>
        <h4 className="text-md font-medium text-gray-800 mb-3">特定議員をフォロー</h4>
        <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
          {politicians.map((politician) => {
            const isSelected = isPoliticianSelected(politician.id);
            return (
              <button
                key={politician.id}
                onClick={() => togglePoliticianPreference(politician.id)}
                disabled={saving}
                className={`w-full flex items-center justify-between p-3 border-b border-gray-100 last:border-b-0 transition-all ${
                  isSelected
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                } disabled:opacity-50`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                    {politician.name.charAt(0)}
                  </div>
                  <div className="text-left">
                    <div className="font-medium">{politician.name}</div>
                    <div className="text-xs text-gray-500">
                      {politicianTypeLabels[politician.position as keyof typeof politicianTypeLabels] || politician.position} • {getPrefectureName(politician.prefecture) || politician.region || ''}
                    </div>
                  </div>
                </div>
                {isSelected && <Check className="w-4 h-4" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* イベントタイプ選択 */}
      <div>
        <h4 className="text-md font-medium text-gray-800 mb-3">公式イベントタイプ</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {EVENT_TYPES.map((eventType) => {
            const isSelected = isEventTypeSelected(eventType.value);
            return (
              <button
                key={eventType.value}
                onClick={() => toggleEventTypePreference(eventType.value)}
                disabled={saving}
                className={`flex items-center justify-center p-3 rounded-lg border-2 transition-all ${
                  isSelected
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                } disabled:opacity-50`}
              >
                <div className="flex items-center space-x-2">
                  {isSelected && <Check className="w-4 h-4" />}
                  <span className="text-sm font-medium">{eventType.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* キーワード設定 */}
      <div>
        <h4 className="text-md font-medium text-gray-800 mb-3">キーワード</h4>
        
        {/* キーワード追加 */}
        <div className="flex space-x-2 mb-4">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder="キーワードを入力"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyPress={(e) => e.key === 'Enter' && addKeywordPreference()}
          />
          <button
            onClick={addKeywordPreference}
            disabled={!newKeyword.trim() || saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
          >
            <Plus className="w-4 h-4 mr-1" />
            追加
          </button>
        </div>

        {/* 既存のキーワード */}
        <div className="flex flex-wrap gap-2">
          {getKeywordPreferences().map((pref: Preference) => (
            <div
              key={pref.id}
              className="flex items-center space-x-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full"
            >
              <span className="text-sm">{pref.preference_value}</span>
              <button
                onClick={() => removeKeywordPreference(pref.preference_value)}
                disabled={saving}
                className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {getKeywordPreferences().length === 0 && (
            <p className="text-sm text-gray-500">キーワードが設定されていません</p>
          )}
        </div>
      </div>

      {/* 保存状態表示 */}
      {saving && (
        <div className="flex items-center justify-center py-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
          <span className="text-sm text-gray-600">保存中...</span>
        </div>
      )}
    </div>
  );
}