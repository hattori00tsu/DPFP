'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { supabase } from '@/lib/supabase';
import { PostCard } from './PostCard';
import { Loader2, RefreshCw } from 'lucide-react';
import { politicianTypeLabels, mediaTypeLabels } from '@/public/category';
import { prefectures } from '@/public/prefecture';

interface CustomTimeline {
    id: string;
    name: string;
    description: string;
    include_x?: boolean;
    include_youtube?: boolean;
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
        politician_platforms?: Record<string, string[]>; // 議員ごとのSNS選択
    };
    is_auto_generated?: boolean;
}

interface TimelinePost {
    id: string;
    platform: string;
    content: string | null;
    media_urls: string[] | null;
    thumbnail_url?: string | null;
    post_url: string;
    published_at: string;
    engagement_count: number | null;
    hashtags: string[] | null;
    mentions: string[] | null;
    politicians?: {
        id: string;
        name: string;
        position: string;
        prefecture?: string;
        region?: string;
        party_role?: string;
    };
}

interface CustomTimelineViewerProps {
    userId: string;
    timelineId?: string;
}

export default function CustomTimelineViewer({ userId, timelineId }: CustomTimelineViewerProps) {
    // 常時表示。機能フラグは撤去
    const [selectedTimelineId, setSelectedTimelineId] = useState<string>(timelineId || '');
    const [posts, setPosts] = useState<TimelinePost[]>([]);
    const [loadingPosts, setLoadingPosts] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});

    // SWR for timelines
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

    const { data: timelines = [], error: timelinesError, isLoading: loading } = useSWR(
        timelineId ? null : `timelines-${userId}`,
        timelinesFetcher,
        { revalidateOnFocus: false }
    );

    useEffect(() => {
        if (timelineId) {
            setSelectedTimelineId(timelineId);
        } else if (timelines.length > 0 && !selectedTimelineId) {
            setSelectedTimelineId(timelines[0].id);
        }
    }, [timelineId, timelines, selectedTimelineId]);

    useEffect(() => {
        if (selectedTimelineId) {
            fetchTimelinePosts(selectedTimelineId, 1);
        }
    }, [selectedTimelineId]);

    const fetchTimelinePosts = async (timelineId: string, pageNum = 1) => {
        setLoadingPosts(true);
        try {
            const params = new URLSearchParams();
            params.set('timelineId', timelineId);
            params.set('page', String(pageNum));
            params.set('limit', '20');
            const { data: { session } } = await supabase.auth.getSession();
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
            const res = await fetch(`/api/custom-timeline?${params.toString()}`, { cache: 'no-store', headers });
            if (!res.ok) throw new Error('failed');
            const json = await res.json();
            const postsData = json.posts || [];
            if (pageNum === 1) {
                setPosts(postsData);
            } else {
                setPosts(prev => [...prev, ...postsData]);
            }
            setHasMore(postsData.length === 20);
        } catch (e) {
        } finally {
            setLoadingPosts(false);
        }
    };

    // Realtime subscription for posts
    useEffect(() => {
        if (!selectedTimelineId) return;

        const channel = supabase
            .channel('politician_sns_posts_changes')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'politician_sns_posts'
                },
                (payload) => {
                    // 新しい投稿があった場合、リストを再取得
                    fetchTimelinePosts(selectedTimelineId, 1);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedTimelineId]);

    const handleRefresh = () => {
        if (selectedTimelineId) {
            setPage(1);
            fetchTimelinePosts(selectedTimelineId, 1);
        }
    };

    const loadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchTimelinePosts(selectedTimelineId, nextPage);
    };

    const toggleExpand = (id: string) => {
        setExpandedMap(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

        if (diffInHours < 1) {
            return '1時間未満前';
        } else if (diffInHours < 24) {
            return `${diffInHours}時間前`;
        } else {
            const diffInDays = Math.floor(diffInHours / 24);
            if (diffInDays < 7) {
                return `${diffInDays}日前`;
            } else {
                return date.toLocaleDateString('ja-JP', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
        }
    };

    const getPlatformColor = (platform: string) => {
        const colors = {
            twitter: 'bg-blue-100 text-blue-800',
            x: 'bg-blue-100 text-blue-800',
            facebook: 'bg-blue-600 text-white',
            instagram: 'bg-pink-100 text-pink-800',
            youtube: 'bg-red-100 text-red-800',
            note: 'bg-green-100 text-green-800',
            niconico: 'bg-gray-200 text-gray-800'
        };
        return colors[platform as keyof typeof colors] || 'bg-gray-100 text-gray-800';
    };

    const getPlatformLabel = (platform: string) => {
        const labels = {
            twitter: 'X (Twitter)',
            x: 'X (Twitter)',
            facebook: 'Facebook',
            instagram: 'Instagram',
            youtube: 'YouTube',
            note: 'note',
            niconico: 'niconico'
        };
        return labels[platform as keyof typeof labels] || platform;
    };

    const getPrefectureName = (code?: string) => {
        if (!code) return '';
        const p = prefectures.find(p => p.id === code);
        return p ? p.name_ja : '';
    };

    const truncateContent = (content?: string | null, maxLength: number = 200) => {
        if (!content) return '';
        if (content.length <= maxLength) return content;
        return content.substring(0, maxLength) + '...';
    };

    // timelineIdが指定されている場合は、タイムライン選択UIを非表示
    const isDirectTimeline = !!timelineId;

    // 直接timelineIdが指定されている場合は、timelines配列のチェックをスキップ
    if (!isDirectTimeline) {
        if (loading) {
            return (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
            );
        }

        if (timelines.length === 0) {
            return (
                <div className="text-center py-12">
                    <p className="text-gray-500 mb-4">カスタムタイムラインがありません</p>
                    <p className="text-sm text-gray-400">
                        右上の「タイムライン管理」ボタンから新しいタイムラインを作成してください
                    </p>
                </div>
            );
        }
    }

    const selectedTimeline = timelines.find(t => t.id === selectedTimelineId);

    

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">
                    {!isDirectTimeline && timelines.find(t => t.id === selectedTimelineId)?.name}
                </h2>
                <button
                    onClick={handleRefresh}
                    disabled={loadingPosts}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                    更新
                </button>
            </div>

            {loadingPosts && posts.length === 0 ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            ) : posts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                    <p>表示するSNS投稿がありません。</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {posts.map((post: any) => {
                        const politician = post.politicians;
                        const expanded = !!expandedMap[post.id];
                        
                        return (
                            <div key={post.id} className="bg-white rounded-lg shadow-sm border p-6">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPlatformColor(post.platform)}`}>
                                                {getPlatformLabel(post.platform)}
                                            </span>
                                            <span className="text-sm text-gray-500">
                                                {formatDate(post.published_at)}
                                            </span>
                                        </div>

                                        {politician && (
                                            <div className="mb-3">
                                                <h3 className="text-xl font-bold text-gray-900">{politician.name}</h3>
                                                <p className="text-sm text-gray-600">
                                                    {politicianTypeLabels[politician.position as keyof typeof politicianTypeLabels] || politician.position} - {getPrefectureName(politician.prefecture) || politician.region || ''}
                                                    {politician.party_role && ` • ${politician.party_role}`}
                                                </p>
                                            </div>
                                        )}

                                        <div className="mb-4">
                                            <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                                {expanded ? (post.content || '') : truncateContent(post.content)}
                                            </p>
                                            {(post.content && post.content.length > 200) && (
                                                <button
                                                    className="ml-2 text-xs text-gray-600 underline align-baseline"
                                                    onClick={() => toggleExpand(post.id)}
                                                >
                                                    {expanded ? '閉じる' : 'さらに表示'}
                                                </button>
                                            )}
                                        </div>

                                        {post.thumbnail_url && (
                                            <div className="mb-4">
                                                <img
                                                    src={post.thumbnail_url}
                                                    alt={post.content || 'サムネイル'}
                                                    className="w-full max-w-md rounded-md border"
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = 'none';
                                                    }}
                                                />
                                            </div>
                                        )}

                                        {post.post_url && (
                                            <a
                                                href={post.post_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 hover:text-blue-800 text-sm"
                                            >
                                                投稿を見る →
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {hasMore && (
                        <div className="text-center">
                            <button
                                onClick={loadMore}
                                disabled={loadingPosts}
                                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50"
                            >
                                {loadingPosts ? '読み込み中...' : 'さらに表示'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}