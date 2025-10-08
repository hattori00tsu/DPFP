'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/lib/auth-context';
import PoliticianList from '@/components/admin/PoliticianList';
import PoliticianForm from '@/components/admin/PoliticianForm';
import SNSSettingsManager from '@/components/admin/SNSSettingsManager';
import PrefSNSSettingsManager from '@/components/admin/PrefSNSSettingsManager';
import { Plus, Users, Settings, Download, RefreshCw, MessageSquare, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { prefectures } from '@/public/prefecture';
import { politicianTypeLabels } from '@/public/category';

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
    politician_sns_accounts: any[];
}

export default function AdminPageClient() {
    const searchParams = useSearchParams();
    const { profile } = useAuth();
    const isAuthorized = !!profile && (profile.role === 'staff' || profile.role === 'politician');

    const [showForm, setShowForm] = useState(false);
    const [editingPolitician, setEditingPolitician] = useState<Politician | null>(null);
    const [activeTab, setActiveTab] = useState<'list' | 'form' | 'scraping' | 'sns-settings'>('list');
    const [scrapingStatus, setScrapingStatus] = useState<{ [key: string]: 'idle' | 'running' | 'success' | 'error' }>({
        all: 'idle',
        news: 'idle',
        events: 'idle',
        sns: 'idle'
    });
    const [scrapingMessages, setScrapingMessages] = useState<{ [key: string]: string }>({});

    // フィルター状態
    const [filterName, setFilterName] = useState('');
    const [filterPrefecture, setFilterPrefecture] = useState('');
    const [filterPosition, setFilterPosition] = useState('');

    // SWR fetcher and key with filters
    const buildUrl = () => {
        const params = new URLSearchParams();
        if (filterName.trim()) params.set('name', filterName.trim());
        if (filterPrefecture) params.set('prefecture', filterPrefecture);
        if (filterPosition) params.set('position', filterPosition);
        const qs = params.toString();
        return `/api/admin/politicians${qs ? `?${qs}` : ''}`;
    };

    const urlKey = buildUrl();

    const politiciansFetcher = async (url: string) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch politicians');
        const data = await response.json();
        return data.politicians || [];
    };

    // SWR hook
    const { data: politicians = [], error: politiciansError, mutate: mutatePoliticians, isLoading: loading } = useSWR(
        urlKey,
        politiciansFetcher,
        { revalidateOnFocus: false }
    );

    // Realtime subscription for politicians
    useEffect(() => {
        if (!isAuthorized) return;
        const channel = supabase
            .channel('politicians_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'politicians'
                },
                () => {
                    mutatePoliticians();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [mutatePoliticians, isAuthorized]);

    // クエリ ?edit=<id> に応じてフォームを新規タブで開いた際にも自動表示
    useEffect(() => {
        const editId = searchParams?.get('edit');
        if (!editId) return;

        // 既に取得済みの一覧から対象を探す。見つからない場合は軽く取得を試みる。
        const found = politicians.find((p: any) => p.id === editId);
        if (found) {
            setEditingPolitician(found as any);
            setShowForm(true);
            setActiveTab('form');
            return;
        }

        // 単体取得（APIが存在するため）
        (async () => {
            try {
                const res = await fetch(`/api/admin/politicians/${editId}`);
                if (res.ok) {
                    const data = await res.json();
                    const p = data.politician || data;
                    if (p && p.id) {
                        setEditingPolitician(p);
                        setShowForm(true);
                        setActiveTab('form');
                    }
                }
            } catch {}
        })();
    }, [searchParams, politicians]);

    const handleAddNew = () => {
        setEditingPolitician(null);
        setShowForm(true);
        setActiveTab('form');
    };

    const handleEdit = (politician: Politician) => {
        setEditingPolitician(politician);
        setShowForm(true);
        setActiveTab('form');
    };

    const handleFormSuccess = () => {
        setShowForm(false);
        setEditingPolitician(null);
        setActiveTab('list');
        mutatePoliticians();
    };

    const handleFormCancel = () => {
        setShowForm(false);
        setEditingPolitician(null);
        setActiveTab('list');
    };

    const handleDelete = async (id: string) => {
        if (!confirm('この議員情報を削除してもよろしいですか？')) {
            return;
        }

        try {
            const response = await fetch(`/api/admin/politicians/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                mutatePoliticians();
            } else {
                alert('削除に失敗しました');
            }
        } catch (error) {
            alert('削除中にエラーが発生しました');
        }
    };

    const handleScraping = async (type: 'all' | 'news' | 'events' | 'sns') => {
        setScrapingStatus(prev => ({ ...prev, [type]: 'running' }));
        setScrapingMessages(prev => ({ ...prev, [type]: 'スクレイピングを開始しています...' }));

        try {
            const response = await fetch('/api/scrape', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ type })
            });

            const data = await response.json();

            if (data.success) {
                setScrapingStatus(prev => ({ ...prev, [type]: 'success' }));
                setScrapingMessages(prev => ({ ...prev, [type]: data.message }));
            } else {
                setScrapingStatus(prev => ({ ...prev, [type]: 'error' }));
                setScrapingMessages(prev => ({ ...prev, [type]: data.message || 'スクレイピング中にエラーが発生しました' }));
            }
        } catch (error) {
            setScrapingStatus(prev => ({ ...prev, [type]: 'error' }));
            setScrapingMessages(prev => ({ ...prev, [type]: 'スクレイピング中にエラーが発生しました' }));
        }

        // 3秒後にステータスをリセット
        setTimeout(() => {
            setScrapingStatus(prev => ({ ...prev, [type]: 'idle' }));
            setScrapingMessages(prev => ({ ...prev, [type]: '' }));
        }, 5000);
    };

    return (
        !isAuthorized ? (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">アクセス権限がありません</h2>
                    <p className="text-gray-600">この画面にアクセスするには管理者権限が必要です。</p>
                </div>
            </div>
        ) : (
        <div className="max-w-7xl mx-auto">
            <div className="mb-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">管理画面</h1>
                        <p className="text-gray-600">
                            議員情報とSNSアカウントの管理
                        </p>
                    </div>
                    <button
                        onClick={handleAddNew}
                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        新規追加
                    </button>
                </div>
            </div>

            {/* タブナビゲーション */}
            <div className="border-b border-gray-200 mb-6">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setActiveTab('list')}
                        className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'list'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        <div className="flex items-center">
                            <Users className="w-4 h-4 mr-2" />
                            議員一覧
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('scraping')}
                        className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'scraping'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        <div className="flex items-center">
                            <Download className="w-4 h-4 mr-2" />
                            スクレイピング
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('sns-settings')}
                        className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'sns-settings'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                    >
                        <div className="flex items-center">
                            <MessageSquare className="w-4 h-4 mr-2" />
                            SNS設定
                        </div>
                    </button>
                    {showForm && (
                        <button
                            onClick={() => setActiveTab('form')}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'form'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            <div className="flex items-center">
                                <Settings className="w-4 h-4 mr-2" />
                                {editingPolitician ? '編集' : '新規作成'}
                            </div>
                        </button>
                    )}
                </nav>
            </div>

            {/* コンテンツ */}
            {activeTab === 'list' && (
                <>
                    {/* 検索フィルター */}
                    <div className="mb-4 bg-white border rounded-lg p-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">名前</label>
                                <input
                                    type="text"
                                    value={filterName}
                                    onChange={(e) => setFilterName(e.target.value)}
                                    placeholder="氏名で検索"
                                    className="w-full border rounded-md px-3 py-2 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">都道府県</label>
                                <select
                                    value={filterPrefecture}
                                    onChange={(e) => setFilterPrefecture(e.target.value)}
                                    className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                                >
                                    <option value="">すべて</option>
                                    {prefectures.filter(p => p.id !== '48').map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name_ja}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">役職</label>
                                <select
                                    value={filterPosition}
                                    onChange={(e) => setFilterPosition(e.target.value)}
                                    className="w-full border rounded-md px-3 py-2 text-sm bg-white"
                                >
                                    <option value="">すべて</option>
                                    {Object.entries(politicianTypeLabels).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-end">
                                <button
                                    onClick={() => {
                                        setFilterName('');
                                        setFilterPrefecture('');
                                        setFilterPosition('');
                                    }}
                                    className="w-full md:w-auto px-3 py-2 text-sm border rounded-md hover:bg-gray-50 flex items-center justify-center"
                                >
                                    <X className="w-4 h-4 mr-1" /> クリア
                                </button>
                            </div>
                        </div>
                    </div>

                    <PoliticianList
                        politicians={politicians}
                        loading={loading}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                    />
                </>
            )}

            {activeTab === 'scraping' && (
                <div className="bg-white rounded-lg shadow-sm border p-6">
                    <div className="mb-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">公式情報スクレイピング</h2>
                        <p className="text-gray-600">
                            国民民主党の公式サイトから最新のニュース、イベント情報を取得します。
                        </p>
                    </div>

                    <div className="space-y-4">
                        {/* 全体実行 */}
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                            <div>
                                <h3 className="font-medium text-gray-900">全てのソースを一括実行</h3>
                                <p className="text-sm text-gray-600">
                                    ニュース、イベント、チーム更新情報を全て取得
                                </p>
                            </div>
                            <button
                                onClick={() => handleScraping('all')}
                                disabled={scrapingStatus.all === 'running'}
                                className={`flex items-center px-4 py-2 rounded-md font-medium ${scrapingStatus.all === 'running'
                                    ? 'bg-gray-400 text-white cursor-not-allowed'
                                    : scrapingStatus.all === 'success'
                                        ? 'bg-green-600 text-white'
                                        : scrapingStatus.all === 'error'
                                            ? 'bg-red-600 text-white'
                                            : 'bg-blue-600 text-white hover:bg-blue-700'
                                    }`}
                            >
                                {scrapingStatus.all === 'running' ? (
                                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Download className="w-4 h-4 mr-2" />
                                )}
                                {scrapingStatus.all === 'running' ? '実行中...' : '全て実行'}
                            </button>
                        </div>

                        {scrapingMessages.all && (
                            <div className={`p-4 rounded-lg ${scrapingStatus.all === 'success'
                                ? 'bg-green-50 text-green-800 border border-green-200'
                                : scrapingStatus.all === 'error'
                                    ? 'bg-red-50 text-red-800 border border-red-200'
                                    : 'bg-blue-50 text-blue-800 border border-blue-200'
                                }`}>
                                {scrapingMessages.all}
                            </div>
                        )}

                        {/* 個別実行 */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* ニュース */}
                            <div className="p-4 border rounded-lg">
                                <h3 className="font-medium text-gray-900 mb-2">公式ニュース</h3>
                                <p className="text-sm text-gray-600 mb-4">
                                    new-kokumin.jp/news
                                </p>
                                <button
                                    onClick={() => handleScraping('news')}
                                    disabled={scrapingStatus.news === 'running'}
                                    className={`w-full flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium ${scrapingStatus.news === 'running'
                                        ? 'bg-gray-400 text-white cursor-not-allowed'
                                        : scrapingStatus.news === 'success'
                                            ? 'bg-green-600 text-white'
                                            : scrapingStatus.news === 'error'
                                                ? 'bg-red-600 text-white'
                                                : 'bg-blue-600 text-white hover:bg-blue-700'
                                        }`}
                                >
                                    {scrapingStatus.news === 'running' ? (
                                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <Download className="w-4 h-4 mr-2" />
                                    )}
                                    {scrapingStatus.news === 'running' ? '実行中...' : 'ニュース取得'}
                                </button>
                                {scrapingMessages.news && (
                                    <div className={`mt-2 p-2 rounded text-xs ${scrapingStatus.news === 'success'
                                        ? 'bg-green-50 text-green-800'
                                        : scrapingStatus.news === 'error'
                                            ? 'bg-red-50 text-red-800'
                                            : 'bg-blue-50 text-blue-800'
                                        }`}>
                                        {scrapingMessages.news}
                                    </div>
                                )}
                            </div>

                            {/* イベント */}
                            <div className="p-4 border rounded-lg">
                                <h3 className="font-medium text-gray-900 mb-2">イベント情報</h3>
                                <p className="text-sm text-gray-600 mb-4">
                                    team.new-kokumin.jp/evinfo/
                                </p>
                                <button
                                    onClick={() => handleScraping('events')}
                                    disabled={scrapingStatus.events === 'running'}
                                    className={`w-full flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium ${scrapingStatus.events === 'running'
                                        ? 'bg-gray-400 text-white cursor-not-allowed'
                                        : scrapingStatus.events === 'success'
                                            ? 'bg-green-600 text-white'
                                            : scrapingStatus.events === 'error'
                                                ? 'bg-red-600 text-white'
                                                : 'bg-green-600 text-white hover:bg-green-700'
                                        }`}
                                >
                                    {scrapingStatus.events === 'running' ? (
                                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <Download className="w-4 h-4 mr-2" />
                                    )}
                                    {scrapingStatus.events === 'running' ? '実行中...' : 'イベント取得'}
                                </button>
                                {scrapingMessages.events && (
                                    <div className={`mt-2 p-2 rounded text-xs ${scrapingStatus.events === 'success'
                                        ? 'bg-green-50 text-green-800'
                                        : scrapingStatus.events === 'error'
                                            ? 'bg-red-50 text-red-800'
                                            : 'bg-blue-50 text-blue-800'
                                        }`}>
                                        {scrapingMessages.events}
                                    </div>
                                )}
                            </div>

                            {/* 公式SNS */}
                            <div className="p-4 border rounded-lg">
                                <h3 className="font-medium text-gray-900 mb-2">公式SNS</h3>
                                <p className="text-sm text-gray-600 mb-4">
                                    X (Twitter), YouTube
                                </p>
                                <button
                                    onClick={() => handleScraping('sns')}
                                    disabled={scrapingStatus.sns === 'running'}
                                    className={`w-full flex items-center justify-center px-3 py-2 rounded-md text-sm font-medium ${scrapingStatus.sns === 'running'
                                        ? 'bg-gray-400 text-white cursor-not-allowed'
                                        : scrapingStatus.sns === 'success'
                                            ? 'bg-green-600 text-white'
                                            : scrapingStatus.sns === 'error'
                                                ? 'bg-red-600 text-white'
                                                : 'bg-purple-600 text-white hover:bg-purple-700'
                                        }`}
                                >
                                    {scrapingStatus.sns === 'running' ? (
                                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <Download className="w-4 h-4 mr-2" />
                                    )}
                                    {scrapingStatus.sns === 'running' ? '実行中...' : 'SNS取得'}
                                </button>
                                {scrapingMessages.sns && (
                                    <div className={`mt-2 p-2 rounded text-xs ${scrapingStatus.sns === 'success'
                                        ? 'bg-green-50 text-green-800'
                                        : scrapingStatus.sns === 'error'
                                            ? 'bg-red-50 text-red-800'
                                            : 'bg-blue-50 text-blue-800'
                                        }`}>
                                        {scrapingMessages.sns}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <h4 className="font-medium text-yellow-800 mb-2">注意事項</h4>
                            <ul className="text-sm text-yellow-700 space-y-1">
                                <li>• 個別実行では特定のソースのみを取得します</li>
                                <li>• 取得したデータは /official ページで確認できます</li>
                                <li>• 重複データは自動的に除外されます</li>
                                <li>• 実行後、ユーザータイムラインも自動更新されます</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'sns-settings' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <SNSSettingsManager />
                    <PrefSNSSettingsManager />
                </div>
            )}

            {activeTab === 'form' && showForm && (
                <PoliticianForm
                    politician={editingPolitician}
                    onSuccess={handleFormSuccess}
                    onCancel={handleFormCancel}
                />
            )}
        </div>
        )
    );
}


