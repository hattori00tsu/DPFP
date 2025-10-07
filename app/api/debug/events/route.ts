import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  try {
    // official_eventsテーブルの全データを取得
    const { data: events, error } = await supabaseAdmin
      .from('official_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // user_filter_preferencesのデフォルト値も取得
    const { data: samplePrefs, error: prefsError } = await supabaseAdmin
      .from('user_filter_preferences')
      .select('event_categories, prefectures')
      .limit(1);

    return NextResponse.json({
      events: events || [],
      eventCount: events?.length || 0,
      samplePreferences: samplePrefs?.[0] || null,
      prefsError: prefsError?.message || null
    });
  } catch (error) {
    console.error('Debug events error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}