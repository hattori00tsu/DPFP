import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { selectedEventCategories, selectedPrefectures } = body;

    

    // officialページと同じクエリを実行
    let eventsQuery = supabaseAdmin
      .from('official_events')
      .select('*')
      .order('event_date', { ascending: true });

    if (selectedEventCategories && selectedEventCategories.length > 0) {
      eventsQuery = eventsQuery.in('category', selectedEventCategories);
    }

    if (selectedPrefectures && selectedPrefectures.length > 0) {
      eventsQuery = eventsQuery.in('prefecture', selectedPrefectures);
    }

    const { data: events, error } = await eventsQuery;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 全イベントも取得（比較用）
    const { data: allEvents } = await supabaseAdmin
      .from('official_events')
      .select('category, prefecture, title')
      .order('created_at', { ascending: false });

    return NextResponse.json({
      filteredEvents: events || [],
      filteredCount: events?.length || 0,
      allEvents: allEvents || [],
      allCount: allEvents?.length || 0,
      queryParams: { selectedEventCategories, selectedPrefectures }
    });
  } catch (error) {
    console.error('Debug official query error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}