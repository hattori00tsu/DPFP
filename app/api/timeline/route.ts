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
    const { data: timeline, error } = await supabase
      .from('user_timeline')
      .select(`
        id,
        displayed_at,
        is_read,
        scraped_news (
          id,
          title,
          url,
          content,
          published_at,
          source_url,
          category,
          tags
        )
      `)
      .eq('user_id', userId)
      .order('displayed_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({ timeline });
  } catch (error) {
    console.error('Error fetching timeline:', error);
    return NextResponse.json(
      { error: 'タイムラインの取得に失敗しました' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { userId, newsId, isRead } = await request.json();

    if (!userId || !newsId) {
      return NextResponse.json(
        { error: '必要なパラメータが不足しています' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('user_timeline')
      .update({ is_read: isRead })
      .eq('user_id', userId)
      .eq('news_id', newsId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating timeline:', error);
    return NextResponse.json(
      { error: 'タイムラインの更新に失敗しました' },
      { status: 500 }
    );
  }
}