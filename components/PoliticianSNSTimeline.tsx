'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { supabase } from '@/lib/supabase';
import { Clock, ExternalLink, Heart, MessageCircle, Share, MapPin, Badge } from 'lucide-react';
import { politicianTypeLabels } from '@/public/category';
import { prefectures } from '@/public/prefecture';

interface PoliticianInfo {
  id: string;
  name: string;
  position: 'representative' | 'senator' | 'local';
  prefecture?: string;
  region?: string; // 後方互換のため残す
  party_role?: string;
}

interface SNSPost {
  id: string;
  platform: string;
  content: string | null;
  media_urls: string[];
  post_url: string;
  published_at: string;
  engagement_count: number;
  hashtags: string[];
  mentions: string[];
  politicians: PoliticianInfo | null;
  // Optional thumbnail for preview; if absent, fall back to first media url
  thumbnail_url?: string | null;
}

interface SNSTimelineItem {
  id: string;
  displayed_at: string;
  is_read: boolean;
  is_liked: boolean;
  politician_sns_posts: SNSPost;
}

interface PoliticianSNSTimelineProps {
  userId?: string;
}

export default function PoliticianSNSTimeline({ userId }: PoliticianSNSTimelineProps) {
  const [timeline, setTimeline] = useState<SNSTimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const toggleExpand = (id: string) => {
    setExpandedMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // SWRで1ページ目を取得・キャッシュし、Realtimeの更新時のみ再取得
  const { data: swrResp, isLoading, mutate } = useSWR(
    `/api/sns-timeline?page=1&limit=20${userId ? `&userId=${userId}` : ''}`,
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    }
  );

  useEffect(() => {
    if (swrResp?.snsTimeline) {
      setTimeline(swrResp.snsTimeline);
      setHasMore(swrResp.snsTimeline.length === 20);
      setPage(1);
      setLoading(false);
    }
  }, [swrResp]);

  useEffect(() => {
    // 新規投稿が入ったら再取得
    const channel = supabase
      .channel('politician_sns_posts_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'politician_sns_posts' }, () => {
        mutate();
      })
      .subscribe();

    // ユーザー専用タイムラインを使う場合の更新検知（既読/いいね等）
    let userChannel: ReturnType<typeof supabase.channel> | null = null;
    if (userId) {
      userChannel = supabase
        .channel(`user_sns_timeline_${userId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_sns_timeline', filter: `user_id=eq.${userId}` }, () => {
          mutate();
        })
        .subscribe();
    }

    return () => {
      supabase.removeChannel(channel);
      if (userChannel) supabase.removeChannel(userChannel);
    };
  }, [userId, mutate]);

  const fetchTimeline = async (pageNum = 1) => {
    try {
      setLoading(true);
      const url = userId 
        ? `/api/sns-timeline?userId=${userId}&page=${pageNum}&limit=20`
        : `/api/sns-timeline?page=${pageNum}&limit=20`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.snsTimeline) {
        if (pageNum === 1) {
          setTimeline(data.snsTimeline);
        } else {
          setTimeline(prev => [...prev, ...data.snsTimeline]);
        }
        setHasMore(data.snsTimeline.length === 20);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (snsPostId: string) => {
    if (!userId) return;
    
    try {
      await fetch('/api/sns-timeline', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          snsPostId,
          isRead: true
        })
      });

      setTimeline(prev => 
        prev.map(item => 
          item.politician_sns_posts.id === snsPostId 
            ? { ...item, is_read: true }
            : item
        )
      );
    } catch (error) {
    }
  };

  const toggleLike = async (snsPostId: string, currentState: boolean) => {
    if (!userId) return;
    
    try {
      await fetch('/api/sns-timeline', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          snsPostId,
          isLiked: !currentState
        })
      });

      setTimeline(prev => 
        prev.map(item => 
          item.politician_sns_posts.id === snsPostId 
            ? { ...item, is_liked: !currentState }
            : item
        )
      );
    } catch (error) {
    }
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchTimeline(nextPage);
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

  const getPositionLabel = (position: string) => {
    return politicianTypeLabels[position as keyof typeof politicianTypeLabels] || position;
  };

  const MAX_PREVIEW = 140;

  if ((loading || isLoading) && timeline.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {timeline.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>表示するSNS投稿がありません。</p>
          <p className="text-sm mt-2">設定で興味のある議員や地域を選択してください。</p>
        </div>
      ) : (
        <div className="space-y-4">
          {timeline.map((item) => {
            const post = item.politician_sns_posts;
            const politician = post.politicians;
            
            return (
              <div key={item.id} className="bg-white rounded-lg shadow-sm border p-6">
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
                          {getPositionLabel(politician.position)} - {getPrefectureName(politician.prefecture) || politician.region || ''}
                          {politician.party_role && ` • ${politician.party_role}`}
                        </p>
                      </div>
                    )}

                    <div className="text-sm text-gray-700 mb-4 whitespace-pre-wrap">
                      {(() => {
                        const full = post.content || '投稿';
                        const isLong = (post.content?.length || 0) > MAX_PREVIEW;
                        const expanded = !!expandedMap[post.id];
                        const shown = !isLong || expanded ? full : full.substring(0, MAX_PREVIEW) + '...';
                        return (
                          <>
                            <p>{shown}</p>
                            {isLong && (
                              <button
                                onClick={() => toggleExpand(post.id)}
                                className="mt-1 text-xs text-gray-600 underline"
                              >
                                {expanded ? '閉じる' : 'さらに表示'}
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </div>

                    {(post.thumbnail_url || post.media_urls?.[0]) && (
                      <div className="mb-4">
                        <img
                          src={post.thumbnail_url || post.media_urls?.[0]}
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
                disabled={loading}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50"
              >
                {loading ? '読み込み中...' : 'もっと見る'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}