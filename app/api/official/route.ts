import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// 公式ページ用の一括取得API
// GET /api/official?newsCategories=a,b&eventCategories=c,d&snsCategories=e,f&prefectures=p1,p2
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const newsCategoriesParam = searchParams.get('newsCategories');
  const eventCategoriesParam = searchParams.get('eventCategories');
  const snsCategoriesParam = searchParams.get('snsCategories');
  const prefecturesParam = searchParams.get('prefectures');
  const limitParam = searchParams.get('limit');

  const newsCategories = newsCategoriesParam ? newsCategoriesParam.split(',').filter(Boolean) : [];
  const eventCategories = eventCategoriesParam ? eventCategoriesParam.split(',').filter(Boolean) : [];
  const snsCategories = snsCategoriesParam ? snsCategoriesParam.split(',').filter(Boolean) : [];
  const prefectures = prefecturesParam ? prefecturesParam.split(',').filter(Boolean) : [];
  const limit = Math.min(Math.max(parseInt(limitParam || '100', 10) || 100, 1), 200);

  // クライアント側のカテゴリ→プラットフォーム対応に合わせる
  const categoryToPlatformMap: Record<string, string> = {
    X: 'twitter',
    X2: 'twitter2',
    YouTube: 'youtube',
    iceage: 'iceage',
  };
  const snsPlatforms = snsCategories
    .map((c) => categoryToPlatformMap[c])
    .filter((v): v is string => Boolean(v));

  try {
    // ニュース
    let newsQuery = supabase
      .from('official_news')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(limit);

    if (newsCategories.length > 0) {
      newsQuery = newsQuery.in('category', newsCategories);
    }

    // イベント
    let eventsQuery = supabase
      .from('official_events')
      .select('*')
      .order('event_date', { ascending: false })
      .limit(limit);

    if (eventCategories.length > 0) {
      eventsQuery = eventsQuery.in('category', eventCategories);
    }
    if (prefectures.length > 0) {
      const orExpr = `prefecture.in.(${prefectures.join(',')}),prefecture.is.null`;
      eventsQuery = eventsQuery.or(orExpr);
    }

    // SNS
    let snsQuery = supabase
      .from('official_sns_posts')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(limit);
    if (snsPlatforms.length > 0) {
      snsQuery = snsQuery.in('platform', snsPlatforms);
    }

    const [newsRes, eventsRes, snsRes] = await Promise.all([
      newsQuery,
      eventsQuery,
      snsQuery,
    ]);

    if (newsRes.error) throw newsRes.error;
    if (eventsRes.error) throw eventsRes.error;
    if (snsRes.error) throw snsRes.error;

    return NextResponse.json({
      news: newsRes.data || [],
      events: eventsRes.data || [],
      sns: snsRes.data || [],
    });
  } catch (error) {
    console.error('Error in /api/official:', error);
    return NextResponse.json({ error: '公式データの取得に失敗しました' }, { status: 500 });
  }
}


