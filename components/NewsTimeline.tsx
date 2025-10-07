'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { supabase } from '@/lib/supabase';
import { Clock, ExternalLink, Tag } from 'lucide-react';

interface NewsItem {
  id: string;
  title: string;
  url: string;
  content?: string;
  published_at: string;
  source_url: string;
  category: string;
  tags: string[];
}

interface TimelineItem {
  id: string;
  displayed_at: string;
  is_read: boolean;
  scraped_news: NewsItem;
}

interface NewsTimelineProps {
  userId: string;
}

export default function NewsTimeline({ userId }: NewsTimelineProps) {
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // SWRで1ページ目をキャッシュし、Realtimeで更新時のみ再取得
  const { data: swrResp, isLoading, mutate } = useSWR(
    userId ? `/api/timeline?userId=${userId}&page=1&limit=20` : null,
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    }
  );

  useEffect(() => {
    if (swrResp?.timeline) {
      setTimeline(swrResp.timeline);
      setHasMore(swrResp.timeline.length === 20);
      setPage(1);
      setLoading(false);
    }
  }, [swrResp]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`news-timeline-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_timeline', filter: `user_id=eq.${userId}` }, () => {
        mutate();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, mutate]);

  const fetchTimeline = async (pageNum = 1) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/timeline?userId=${userId}&page=${pageNum}&limit=20`);
      const data = await response.json();
      if (data.timeline) {
        if (pageNum === 1) setTimeline(data.timeline);
        else setTimeline(prev => [...prev, ...data.timeline]);
        setHasMore(data.timeline.length === 20);
      }
    } catch (error) {
      console.error('Error fetching timeline:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (newsId: string) => {
    try {
      await fetch('/api/timeline', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          newsId,
          isRead: true
        })
      });

      setTimeline(prev => 
        prev.map(item => 
          item.scraped_news.id === newsId 
            ? { ...item, is_read: true }
            : item
        )
      );
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchTimeline(nextPage);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      news: 'bg-blue-100 text-blue-800',
      team: 'bg-green-100 text-green-800',
      policy: 'bg-purple-100 text-purple-800',
      event: 'bg-orange-100 text-orange-800',
      default: 'bg-gray-100 text-gray-800'
    };
    return colors[category as keyof typeof colors] || colors.default;
  };

  if ((loading || isLoading) && timeline.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">ニュースタイムライン</h2>
        <button
          onClick={() => fetchTimeline(1)}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          更新
        </button>
      </div>

      {timeline.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>表示するニュースがありません。</p>
          <p className="text-sm mt-2">設定で興味のあるカテゴリやキーワードを選択してください。</p>
        </div>
      ) : (
        <div className="space-y-4">
          {timeline.map((item) => (
            <div
              key={item.id}
              className={`border rounded-lg p-4 transition-all hover:shadow-md ${
                item.is_read ? 'bg-gray-50 border-gray-200' : 'bg-white border-blue-200'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(item.scraped_news.category)}`}>
                    {item.scraped_news.category}
                  </span>
                  {!item.is_read && (
                    <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                  )}
                </div>
                <div className="flex items-center text-sm text-gray-500">
                  <Clock className="w-4 h-4 mr-1" />
                  {formatDate(item.scraped_news.published_at)}
                </div>
              </div>

              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {item.scraped_news.title}
              </h3>

              {item.scraped_news.content && (
                <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                  {item.scraped_news.content}
                </p>
              )}

              {item.scraped_news.tags && item.scraped_news.tags.length > 0 && (
                <div className="flex items-center space-x-2 mb-3">
                  <Tag className="w-4 h-4 text-gray-400" />
                  <div className="flex flex-wrap gap-1">
                    {item.scraped_news.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">
                  出典: {new URL(item.scraped_news.source_url).hostname}
                </span>
                <div className="flex space-x-2">
                  {!item.is_read && (
                    <button
                      onClick={() => markAsRead(item.scraped_news.id)}
                      className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                      既読にする
                    </button>
                  )}
                  <a
                    href={item.scraped_news.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    記事を読む
                  </a>
                </div>
              </div>
            </div>
          ))}

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