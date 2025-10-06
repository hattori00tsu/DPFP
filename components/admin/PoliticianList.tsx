'use client';

import { useState } from 'react';
import { prefectures } from '@/public/prefecture';
import { Edit, Trash2, ExternalLink, CheckCircle, XCircle, Download } from 'lucide-react';
import { politicianTypeLabels } from '@/public/category';

interface SNSAccount {
  id: string;
  platform: string;
  account_handle: string;
  account_url: string;
  rss_url?: string;
  is_active: boolean;
  last_scraped_at?: string;
}

interface Politician {
  id: string;
  name: string;
  position: string;
  prefecture?: string;
  region?: string;
  party_role?: string;
  bio?: string;
  twitter_handle?: string;
  profile_url?: string;
  created_at: string;
  politician_sns_accounts: SNSAccount[];
}

interface PoliticianListProps {
  politicians: Politician[];
  loading: boolean;
  onEdit: (politician: Politician) => void;
  onDelete: (id: string) => void;
}

export default function PoliticianList({ politicians, loading, onEdit, onDelete }: PoliticianListProps) {
  const [scrapingAccount, setScrapingAccount] = useState<string | null>(null);

  const getPositionLabel = (position: string) => {
    return politicianTypeLabels[position as keyof typeof politicianTypeLabels] || position;
  };

  const getPrefectureName = (code?: string) => {
    if (!code) return '';
    const p = prefectures.find(p => p.id === code);
    return p ? p.name_ja : '';
  };

  const getPlatformLabel = (platform: string) => {
    const labels = {
      twitter: 'X (Twitter)',
      youtube: 'YouTube',
      instagram: 'Instagram',
      facebook: 'Facebook'
    };
    return labels[platform as keyof typeof labels] || platform;
  };

  const getPlatformColor = (platform: string) => {
    const colors = {
      twitter: 'bg-blue-100 text-blue-800',
      youtube: 'bg-red-100 text-red-800',
      instagram: 'bg-pink-100 text-pink-800',
      facebook: 'bg-blue-600 text-white'
    };
    return colors[platform as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '未取得';
    return new Date(dateString).toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleScrapeAccount = async (accountId: string, accountHandle: string) => {
    try {
      setScrapingAccount(accountId);
      const res = await fetch(`/api/admin/politicians/sns-accounts/${accountId}`, { 
        method: 'POST' 
      });
      const data = await res.json();
      
      if (data.success) {
        alert(`✓ ${data.message}`);
        // ページをリロードして最新の取得時刻を表示
        window.location.reload();
      } else {
        alert(`✗ ${data.message}`);
      }
    } catch (e) {
      alert('実行中にエラーが発生しました');
    } finally {
      setScrapingAccount(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (politicians.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">議員情報が登録されていません</p>
        <p className="text-sm text-gray-400 mt-2">「新規追加」ボタンから議員情報を追加してください</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={async () => {
            try {
              const res = await fetch('/api/admin/politicians/sns-scrape', { method: 'POST' });
              const data = await res.json();
              alert(data.message || (data.success ? '全議員のSNS取得を実行しました' : 'エラーが発生しました'));
            } catch (e) {
              alert('実行中にエラーが発生しました');
            }
          }}
          className="px-3 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700"
        >
          全議員のSNS取得
        </button>
      </div>
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {politicians.map((politician) => (
            <li key={politician.id} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        {politician.name}
                      </h3>
                      <div className="mt-1 flex items-center space-x-4 text-sm text-gray-500">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {getPositionLabel(politician.position)}
                        </span>
                        <span>{getPrefectureName(politician.prefecture) || politician.region || ''}</span>
                        {politician.party_role && (
                          <span className="text-gray-700 font-medium">
                            {politician.party_role}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => onEdit(politician)}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(politician.id)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/admin/politicians/${politician.id}/sns-scrape`, { method: 'POST' });
                            const data = await res.json();
                            alert(data.message || (data.success ? 'SNS取得を実行しました' : 'エラーが発生しました'));
                          } catch (e) {
                            alert('実行中にエラーが発生しました');
                          }
                        }}
                        className="p-2 text-gray-400 hover:text-purple-600 transition-colors"
                      >
                        取得
                      </button>
                    </div>
                  </div>

                  {politician.bio && (
                    <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                      {politician.bio}
                    </p>
                  )}

                  {/* SNSアカウント情報 */}
                  {politician.politician_sns_accounts.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">SNSアカウント</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {politician.politician_sns_accounts.map((account) => (
                          <div
                            key={account.id}
                            className="flex flex-col p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${getPlatformColor(account.platform)}`}>
                                  {getPlatformLabel(account.platform)}
                                </span>
                                {account.is_active ? (
                                  <CheckCircle className="w-3 h-3 text-green-500" />
                                ) : (
                                  <XCircle className="w-3 h-3 text-red-500" />
                                )}
                              </div>
                              <a
                                href={account.account_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-400 hover:text-blue-600"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                            
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">
                                {account.account_handle}
                              </p>
                              {account.rss_url && (
                                <p className="text-xs text-gray-500">RSS設定済み</p>
                              )}
                              <p className="text-xs text-gray-400 mt-1">
                                最終取得: {formatDateTime(account.last_scraped_at)}
                              </p>
                            </div>

                            {account.is_active && (
                              <button
                                onClick={() => handleScrapeAccount(account.id, account.account_handle)}
                                disabled={scrapingAccount === account.id}
                                className="mt-2 w-full flex items-center justify-center px-2 py-1.5 text-xs bg-purple-50 text-purple-700 rounded hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                {scrapingAccount === account.id ? (
                                  <>
                                    <div className="animate-spin rounded-full h-3 w-3 border-b border-purple-700 mr-1"></div>
                                    取得中...
                                  </>
                                ) : (
                                  <>
                                    <Download className="w-3 h-3 mr-1" />
                                    取得
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-3 text-xs text-gray-400">
                    作成日: {formatDate(politician.created_at)}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="text-center text-sm text-gray-500">
        合計 {politicians.length} 名の議員が登録されています
      </div>
    </div>
  );
}