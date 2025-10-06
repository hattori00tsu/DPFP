'use client';

import { useState, useEffect } from 'react';
import { Calendar, MapPin, Users, ExternalLink, Clock, Heart, User } from 'lucide-react';

interface EventItem {
  id: string;
  title: string;
  url: string;
  description?: string;
  event_date: string;
  end_date?: string;
  location?: string;
  organizer?: string;
  event_type: string;
  capacity?: number;
  registration_required: boolean;
  registration_url?: string;
  contact_info?: string;
  tags: string[];
}

interface EventTimelineItem {
  id: string;
  displayed_at: string;
  is_read: boolean;
  is_interested: boolean;
  scraped_events: EventItem;
}

interface EventTimelineProps {
  userId: string;
}

export default function EventTimeline({ userId }: EventTimelineProps) {
  const [timeline, setTimeline] = useState<EventTimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchTimeline();
  }, [userId]);

  const fetchTimeline = async (pageNum = 1) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/events?userId=${userId}&page=${pageNum}&limit=20`);
      const data = await response.json();

      if (data.eventTimeline) {
        if (pageNum === 1) {
          setTimeline(data.eventTimeline);
        } else {
          setTimeline(prev => [...prev, ...data.eventTimeline]);
        }
        setHasMore(data.eventTimeline.length === 20);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (eventId: string) => {
    try {
      await fetch('/api/events', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          eventId,
          isRead: true
        })
      });

      setTimeline(prev => 
        prev.map(item => 
          item.scraped_events.id === eventId 
            ? { ...item, is_read: true }
            : item
        )
      );
    } catch (error) {
    }
  };

  const toggleInterested = async (eventId: string, currentState: boolean) => {
    try {
      await fetch('/api/events', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          eventId,
          isInterested: !currentState
        })
      });

      setTimeline(prev => 
        prev.map(item => 
          item.scraped_events.id === eventId 
            ? { ...item, is_interested: !currentState }
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
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEventTypeColor = (eventType: string) => {
    const colors = {
      rally: 'bg-red-100 text-red-800',
      meeting: 'bg-blue-100 text-blue-800',
      volunteer: 'bg-green-100 text-green-800',
      other: 'bg-gray-100 text-gray-800'
    };
    return colors[eventType as keyof typeof colors] || colors.other;
  };

  const getEventTypeLabel = (eventType: string) => {
    const labels = {
      rally: '集会',
      meeting: '会議',
      volunteer: 'ボランティア',
      other: 'その他'
    };
    return labels[eventType as keyof typeof labels] || 'その他';
  };

  const isEventPast = (eventDate: string) => {
    return new Date(eventDate) < new Date();
  };

  if (loading && timeline.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">イベントタイムライン</h2>
        <button
          onClick={() => fetchTimeline(1)}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          更新
        </button>
      </div>

      {timeline.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>表示するイベントがありません。</p>
          <p className="text-sm mt-2">設定で興味のあるイベントタイプやキーワードを選択してください。</p>
        </div>
      ) : (
        <div className="space-y-4">
          {timeline.map((item) => {
            const event = item.scraped_events;
            const isPast = isEventPast(event.event_date);
            
            return (
              <div
                key={item.id}
                className={`border rounded-lg p-4 transition-all hover:shadow-md ${
                  item.is_read ? 'bg-gray-50 border-gray-200' : 'bg-white border-blue-200'
                } ${isPast ? 'opacity-75' : ''}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getEventTypeColor(event.event_type)}`}>
                      {getEventTypeLabel(event.event_type)}
                    </span>
                    {isPast && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
                        終了
                      </span>
                    )}
                    {!item.is_read && (
                      <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                    )}
                  </div>
                  <button
                    onClick={() => toggleInterested(event.id, item.is_interested)}
                    className={`p-1 rounded-full transition-colors ${
                      item.is_interested 
                        ? 'text-red-500 hover:text-red-600' 
                        : 'text-gray-400 hover:text-red-500'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${item.is_interested ? 'fill-current' : ''}`} />
                  </button>
                </div>

                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {event.title}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="w-4 h-4 mr-2" />
                    {formatDate(event.event_date)}
                    {event.end_date && ` - ${formatDate(event.end_date)}`}
                  </div>
                  
                  {event.location && (
                    <div className="flex items-center text-sm text-gray-600">
                      <MapPin className="w-4 h-4 mr-2" />
                      {event.location}
                    </div>
                  )}
                  
                  {event.organizer && (
                    <div className="flex items-center text-sm text-gray-600">
                      <User className="w-4 h-4 mr-2" />
                      {event.organizer}
                    </div>
                  )}
                  
                  {event.capacity && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Users className="w-4 h-4 mr-2" />
                      定員: {event.capacity}名
                    </div>
                  )}
                </div>

                {event.description && (
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                    {event.description}
                  </p>
                )}

                {event.registration_required && (
                  <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                    <Clock className="w-4 h-4 inline mr-1" />
                    事前登録が必要です
                  </div>
                )}

                {event.tags && event.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {event.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <div className="text-xs text-gray-500">
                    {event.contact_info && (
                      <span>連絡先: {event.contact_info}</span>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    {!item.is_read && (
                      <button
                        onClick={() => markAsRead(event.id)}
                        className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        既読にする
                      </button>
                    )}
                    {event.registration_url ? (
                      <a
                        href={event.registration_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        申し込み
                      </a>
                    ) : (
                      <a
                        href={event.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        詳細を見る
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