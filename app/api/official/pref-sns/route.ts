import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET /api/official/pref-sns?prefectures=13,27&snsCategories=X,YouTube&limit=100
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const prefParam = searchParams.get('prefectures');
  const snsParam = searchParams.get('snsCategories');
  const limitParam = searchParams.get('limit');

  const prefectures = prefParam ? prefParam.split(',').filter(Boolean) : [];
  // 受け取るカテゴリは mediaTypeLabels のキー想定（x, youtube, instagram, facebook, ...）
  const keyToPlatforms: Record<string, string[]> = {
    x: ['twitter', 'x', 'twitter2'],
    youtube: ['youtube'],
    instagram: ['instagram'],
    facebook: ['facebook'],
    note: ['note'],
    election_dot_com: ['election_dot_com'],
  };
  const platformsFromKeys: string[] = [];
  for (const key of (snsParam ? snsParam.split(',') : [])) {
    const arr = keyToPlatforms[key];
    if (arr) platformsFromKeys.push(...arr);
  }
  const limit = Math.min(Math.max(parseInt(limitParam || '100', 10) || 100, 1), 200);

  try {
    let query = supabase
      .from('prefectural_sns_posts')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(limit);

    if (prefectures.length > 0) {
      query = query.in('prefecture', prefectures);
    }
    if (platformsFromKeys.length > 0) {
      query = query.in('platform', platformsFromKeys);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ sns: data || [] });
  } catch (error) {
    console.error('Error in /api/official/pref-sns:', error);
    return NextResponse.json({ error: '支部SNSの取得に失敗しました' }, { status: 500 });
  }
}


