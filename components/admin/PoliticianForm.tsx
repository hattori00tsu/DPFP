'use client';

import { useState, useEffect } from 'react';
import { Save, X, Plus, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { mediaTypeLabels, politicianTypeLabels } from '@/public/category';
import { prefectures } from '@/public/prefecture';

interface SNSAccount {
  id?: string;
  platform: string;
  account_handle: string;
  account_url: string;
  rss_url?: string;
  rss_feed_id?: string;
  is_active: boolean;
}

interface Politician {
  id?: string;
  name: string;
  position: string;
  region?: string;
  party_role?: string;
  bio?: string;
  twitter_handle?: string;
  profile_url?: string;
  politician_sns_accounts?: SNSAccount[];
}

interface PoliticianFormProps {
  politician?: Politician | null;
  onSuccess: () => void;
  onCancel: () => void;
}

// public/category.tsx の politicianTypeLabels から役職候補を生成
const POSITIONS = Object.entries(politicianTypeLabels).map(([key, label]) => ({
  value: key,
  label
}));

// 地域の個別選択は廃止（都道府県コードと統合）

// /public/category.tsx の mediaTypeLabels をそのまま候補に使用
const PLATFORM_OPTIONS = Object.entries(mediaTypeLabels).map(([key, label]) => ({
  value: key,
  label
}));

export default function PoliticianForm({ politician, onSuccess, onCancel }: PoliticianFormProps) {
  const [formData, setFormData] = useState<Politician>({
    name: '',
    position: 'representative',
    party_role: '',
    bio: '',
    profile_url: ''
  });

  const [prefectureCodes, setPrefectureCodes] = useState<string[]>(() => {
    const tokyo = prefectures.find(p => p.name_ja === '東京都');
    return [tokyo ? tokyo.id : (prefectures[0]?.id || '13')];
  });

  const [snsAccounts, setSnsAccounts] = useState<SNSAccount[]>([]);
  const [saving, setSaving] = useState(false);
  const [rssChecking, setRssChecking] = useState<{ [key: number]: boolean }>({});
  const [rssStatus, setRssStatus] = useState<{ [key: number]: { valid: boolean; message: string } }>({});

  useEffect(() => {
    if (politician) {
      setFormData({
        name: politician.name || '',
        position: politician.position || 'representative',
        party_role: politician.party_role || '',
        bio: politician.bio || '',
        profile_url: politician.profile_url || ''
      });

      const anyPolitician: any = politician as any;
      if (anyPolitician) {
        if (Array.isArray(anyPolitician.politician_prefectures) && anyPolitician.politician_prefectures.length > 0) {
          setPrefectureCodes(anyPolitician.politician_prefectures.map((pp: any) => pp.prefecture_code));
        } else if (typeof anyPolitician.prefecture === 'string' && anyPolitician.prefecture.length > 0) {
          setPrefectureCodes([anyPolitician.prefecture]);
        }
      }

      if (politician.politician_sns_accounts) {
        setSnsAccounts(politician.politician_sns_accounts.map(account => ({
          id: account.id,
          platform: account.platform,
          account_handle: account.account_handle,
          account_url: account.account_url,
          rss_url: account.rss_url || '',
          rss_feed_id: account.rss_feed_id || '',
          is_active: account.is_active
        })));
      }
    }
  }, [politician]);

  const handleInputChange = (field: keyof Politician, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addSnsAccount = () => {
    setSnsAccounts(prev => [...prev, {
      platform: 'twitter',
      account_handle: '',
      account_url: '',
      rss_url: '',
      rss_feed_id: '',
      is_active: true
    }]);
  };

  const removeSnsAccount = (index: number) => {
    setSnsAccounts(prev => prev.filter((_, i) => i !== index));
    // RSS状態もクリア
    setRssStatus(prev => {
      const newStatus = { ...prev };
      delete newStatus[index];
      return newStatus;
    });
  };

  const updateSnsAccount = (index: number, field: keyof SNSAccount, value: string | boolean) => {
    setSnsAccounts(prev => prev.map((account, i) => 
      i === index ? { ...account, [field]: value } : account
    ));

    // RSS URLが変更された場合、状態をクリア
    if (field === 'rss_url') {
      setRssStatus(prev => {
        const newStatus = { ...prev };
        delete newStatus[index];
        return newStatus;
      });
    }
  };

  const checkRssFeed = async (index: number) => {
    const account = snsAccounts[index];
    if (!account.rss_url) return;

    setRssChecking(prev => ({ ...prev, [index]: true }));

    try {
      const response = await fetch('/api/admin/rss-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: account.rss_url,
          platform: account.platform
        })
      });

      const data = await response.json();

      setRssStatus(prev => ({
        ...prev,
        [index]: {
          valid: data.success,
          message: data.message || data.error
        }
      }));
    } catch (error) {
      setRssStatus(prev => ({
        ...prev,
        [index]: {
          valid: false,
          message: 'RSS検証中にエラーが発生しました'
        }
      }));
    } finally {
      setRssChecking(prev => ({ ...prev, [index]: false }));
    }
  };

  const generateYouTubeRssUrl = (index: number) => {
    const account = snsAccounts[index];
    if (account.platform === 'youtube' && account.account_handle) {
      // UCで始まるchannelIdのみ直接生成。@handleやuser名はRSS生成不可のため案内
      if (account.account_handle.startsWith('UC')) {
        const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${account.account_handle}`;
        updateSnsAccount(index, 'rss_url', rssUrl);
        return;
      }

      // 非UCのhandleの場合は、アカウントURLから自動解決する方が安全
      // とりあえずテンプレートをセットしてユーザーに案内
      const hint = `https://www.youtube.com/@${account.account_handle.replace(/^@/, '')}`;
      updateSnsAccount(index, 'account_url', hint);
      // RSSは自動解決できないため未設定のまま
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // 保存前整形: YouTubeはチャンネルIDのみ入力でOKにする
      const normalizedAccounts = snsAccounts.map((account) => {
        if (account.platform !== 'youtube') return account;

        const channelId = (account.account_handle || '').trim();
        if (!channelId) return account;

        // account_url が未入力ならYouTubeベースURLにする
        const base = account.account_url && account.account_url.trim().length > 0
          ? account.account_url.trim()
          : 'https://www.youtube.com';
        const sep = base.includes('?') ? '&' : '?';
        const accountUrl = `${base}${sep}channel_id=${channelId}`;

        // RSSは未設定のままでOK（サーバ側で抽出してフォールバック実装済み）
        return {
          ...account,
          account_url: accountUrl
        };
      });

      const url = politician?.id 
        ? `/api/admin/politicians/${politician.id}`
        : '/api/admin/politicians';
      
      const method = politician?.id ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          prefectures: prefectureCodes,
          sns_accounts: normalizedAccounts
        })
      });

      if (response.ok) {
        onSuccess();
      } else {
        const data = await response.json();
        alert(data.error || '保存に失敗しました');
      }
    } catch (error) {
      alert('保存中にエラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* 基本情報 */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-6">基本情報</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                氏名 *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                役職 *
              </label>
              <select
                required
                value={formData.position}
                onChange={(e) => handleInputChange('position', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {POSITIONS.map(position => (
                  <option key={position.value} value={position.value}>
                    {position.label}
                  </option>
                ))}
              </select>
            </div>

            

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                都道府県（複数選択可）
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-2 border border-gray-300 rounded-md">
                {prefectures.map(p => {
                  const checked = prefectureCodes.includes(p.id);
                  return (
                    <label key={p.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setPrefectureCodes(prev => {
                            if (e.target.checked) return Array.from(new Set([...prev, p.id]));
                            return prev.filter(code => code !== p.id);
                          });
                        }}
                      />
                      <span>{p.name_ja}（{p.id}）</span>
                    </label>
                  );
                })}
              </div>
              {prefectureCodes.length === 0 && (
                <p className="mt-1 text-xs text-red-600">少なくとも1つ選択してください</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                党内役職
              </label>
              <input
                type="text"
                value={formData.party_role}
                onChange={(e) => handleInputChange('party_role', e.target.value)}
                placeholder="例: 政調会長、幹事長"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                プロフィールURL
              </label>
              <input
                type="url"
                value={formData.profile_url}
                onChange={(e) => handleInputChange('profile_url', e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              経歴・プロフィール
            </label>
            <textarea
              rows={4}
              value={formData.bio}
              onChange={(e) => handleInputChange('bio', e.target.value)}
              placeholder="議員の経歴や活動内容を入力してください"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* SNSアカウント */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-medium text-gray-900">SNSアカウント</h3>
            <button
              type="button"
              onClick={addSnsAccount}
              className="flex items-center px-3 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              <Plus className="w-4 h-4 mr-1" />
              追加
            </button>
          </div>

          {snsAccounts.map((account, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-start mb-4">
                <h4 className="text-md font-medium text-gray-800">
                  SNSアカウント #{index + 1}
                </h4>
                <button
                  type="button"
                  onClick={() => removeSnsAccount(index)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    プラットフォーム
                  </label>
                  <select
                    value={account.platform}
                    onChange={(e) => updateSnsAccount(index, 'platform', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {PLATFORM_OPTIONS.map(platform => (
                      <option key={platform.value} value={platform.value}>
                        {platform.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    アカウントハンドル
                  </label>
                  <input
                    type="text"
                    value={account.account_handle}
                    onChange={(e) => updateSnsAccount(index, 'account_handle', e.target.value)}
                    placeholder={account.platform === 'twitter' ? '@username' : 'Channel ID'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    アカウントURL
                  </label>
                  <input
                    type="url"
                    value={account.account_url}
                    onChange={(e) => updateSnsAccount(index, 'account_url', e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    RSS URL
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="url"
                      value={account.rss_url}
                      onChange={(e) => updateSnsAccount(index, 'rss_url', e.target.value)}
                      placeholder="RSS フィードのURL"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {account.platform === 'youtube' && (
                      <button
                        type="button"
                        onClick={() => generateYouTubeRssUrl(index)}
                        className="px-3 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                      >
                        自動生成
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => checkRssFeed(index)}
                      disabled={!account.rss_url || rssChecking[index]}
                      className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {rssChecking[index] ? '確認中...' : '確認'}
                    </button>
                  </div>
                  
                  {rssStatus[index] && (
                    <div className={`mt-2 flex items-center text-sm ${
                      rssStatus[index].valid ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {rssStatus[index].valid ? (
                        <CheckCircle className="w-4 h-4 mr-1" />
                      ) : (
                        <AlertCircle className="w-4 h-4 mr-1" />
                      )}
                      {rssStatus[index].message}
                    </div>
                  )}
                </div>

                {account.platform === 'twitter' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      RSS App フィードID
                    </label>
                    <input
                      type="text"
                      value={account.rss_feed_id}
                      onChange={(e) => updateSnsAccount(index, 'rss_feed_id', e.target.value)}
                      placeholder="RSS App のフィードID"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id={`active-${index}`}
                    checked={account.is_active}
                    onChange={(e) => updateSnsAccount(index, 'is_active', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor={`active-${index}`} className="ml-2 block text-sm text-gray-700">
                    アクティブ
                  </label>
                </div>
              </div>
            </div>
          ))}

          {snsAccounts.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>SNSアカウントが登録されていません</p>
              <p className="text-sm mt-1">「追加」ボタンからアカウントを追加してください</p>
            </div>
          )}
        </div>

        {/* アクションボタン */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
          >
            <X className="w-4 h-4 mr-2" />
            キャンセル
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </form>
    </div>
  );
}