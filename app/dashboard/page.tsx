'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import CustomTimelineManager from '@/components/CustomTimelineManager';
import CustomTimelineViewer from '@/components/CustomTimelineViewer';
import PoliticianSNSTimeline from '@/components/PoliticianSNSTimeline';
import { Users, List, Settings } from 'lucide-react';

interface Timeline {
  id: string;
  name: string;
  description: string | null;
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('all');
  const [showManageModal, setShowManageModal] = useState(false);

  // SWR fetcher for custom timelines
  const timelinesFetcher = async () => {
    if (!profile) return [];
    
    const { data, error } = await supabase
      .from('custom_timelines')
      .select('id, name, description')
      .eq('user_id', profile.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  };

  // SWR hook
  const { data: customTimelines = [], error: timelinesError, mutate: mutateTimelines } = useSWR(
    profile ? `dashboard-timelines-${profile.id}` : null,
    timelinesFetcher,
    { revalidateOnFocus: false, keepPreviousData: true }
  );

  // Realtime subscription for custom_timelines
  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel('dashboard_timelines_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'custom_timelines',
          filter: `user_id=eq.${profile.id}`
        },
        (payload) => {
          mutateTimelines();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, mutateTimelines]);

  if (!profile) {
    return null;
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <button
              onClick={() => setShowManageModal(true)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Settings className="w-4 h-4 mr-2" />
              タイムライン管理
            </button>
          </div>
        </div>

        {/* タブナビゲーション */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8 overflow-x-auto">
            <button
              onClick={() => setActiveTab('all')}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'all'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <Users className="w-4 h-4 mr-2" />
                すべて
              </div>
            </button>
            {/* カスタムタイムラインをタブとして表示 */}
            {customTimelines.map((timeline) => (
              <button
                key={timeline.id}
                onClick={() => {
                  setActiveTab(timeline.id);
                }}
                className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === timeline.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center">
                  <List className="w-4 h-4 mr-2" />
                  {timeline.name}
                </div>
              </button>
            ))}
          </nav>
        </div>

        {/* タブコンテンツ */}

        {/* タブ内容の切替: すべて -> 全投稿のSNSタイムライン, それ以外 -> カスタムタイムライン */}
        {activeTab === 'all' ? (
          <PoliticianSNSTimeline />
        ) : (
          <CustomTimelineViewer 
            userId={profile.id} 
            timelineId={activeTab}
          />
        )}
      </div>

      {/* タイムライン管理モーダル */}
      {showManageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-semibold">タイムライン管理</h2>
              <button
                onClick={() => {
                  setShowManageModal(false);
                  mutateTimelines();
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>
            <div className="p-6">
              <CustomTimelineManager userId={profile.id} />
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
