import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = (page - 1) * limit;

  try {
    const { data, error } = await supabase
      .from('politician_sns_posts')
      .select(`
        id,
        platform,
        content,
        media_urls,
        thumbnail_url,
        post_url,
        published_at,
        engagement_count,
        hashtags,
        mentions,
        politicians (
          id,
          name,
          position,
          prefecture,
          party_role
        )
      `)
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const snsTimeline = data?.map(post => ({
      id: `public-${post.id}`,
      displayed_at: post.published_at,
      is_read: false,
      is_liked: false,
      politician_sns_posts: post
    })) || [];

    return NextResponse.json({ snsTimeline });
  } catch (error) {
    console.error('Error fetching SNS timeline:', error);
    return NextResponse.json(
      { error: 'SNSタイムラインの取得に失敗しました' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { userId, snsPostId, isRead, isLiked } = await request.json();

    if (!userId || !snsPostId) {
      return NextResponse.json(
        { error: '必要なパラメータが不足しています' },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (typeof isRead === 'boolean') updateData.is_read = isRead;
    if (typeof isLiked === 'boolean') updateData.is_liked = isLiked;

    const { error } = await supabase
      .from('user_sns_timeline')
      .update(updateData)
      .eq('user_id', userId)
      .eq('sns_post_id', snsPostId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating SNS timeline:', error);
    return NextResponse.json(
      { error: 'SNSタイムラインの更新に失敗しました' },
      { status: 500 }
    );
  }
}