import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = (page - 1) * limit;

  if (!userId) {
    return NextResponse.json({ error: 'ユーザーIDが必要です' }, { status: 400 });
  }

  try {
    const { data: eventTimeline, error } = await supabase
      .from('user_event_timeline')
      .select(`
        id,
        displayed_at,
        is_read,
        is_interested,
        scraped_events (
          id,
          title,
          url,
          description,
          event_date,
          end_date,
          location,
          organizer,
          event_type,
          capacity,
          registration_required,
          registration_url,
          contact_info,
          tags
        )
      `)
      .eq('user_id', userId)
      .order('displayed_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({ eventTimeline });
  } catch (error) {
    console.error('Error fetching event timeline:', error);
    return NextResponse.json(
      { error: 'イベントタイムラインの取得に失敗しました' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { userId, eventId, isRead, isInterested } = await request.json();

    if (!userId || !eventId) {
      return NextResponse.json(
        { error: '必要なパラメータが不足しています' },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (typeof isRead === 'boolean') updateData.is_read = isRead;
    if (typeof isInterested === 'boolean') updateData.is_interested = isInterested;

    const { error } = await supabase
      .from('user_event_timeline')
      .update(updateData)
      .eq('user_id', userId)
      .eq('event_id', eventId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating event timeline:', error);
    return NextResponse.json(
      { error: 'イベントタイムラインの更新に失敗しました' },
      { status: 500 }
    );
  }
}