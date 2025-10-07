import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// 簡易メモリキャッシュ（Vercelエッジ/Nodeの短命プロセス想定のためTTL短め）
const cache = new Map<string, { expires: number; json: any }>();
const inflight = new Map<string, Promise<any>>();

// カスタムタイムライン投稿の一括取得API
// GET /api/custom-timeline?timelineId=xxx&page=1&limit=20
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const timelineId = searchParams.get('timelineId');
  const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10) || 20, 1), 50);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  if (!timelineId) {
    return NextResponse.json({ error: 'timelineIdが必要です' }, { status: 400 });
  }

  try {
    // 認証: AuthorizationヘッダーのJWTを検証
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization') || '';
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    if (!token) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { data: userRes, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: '認証に失敗しました' }, { status: 401 });
    }
    const userId = userRes.user.id;

    // ユーザー単位のキャッシュキー
    const now = Date.now();
    const cacheKey = `${userId}:${timelineId}:${page}:${limit}`;

    // ヒットすれば返却
    const hit = cache.get(cacheKey);
    if (hit && hit.expires > now) {
      return NextResponse.json(hit.json);
    }

    // 同一キーの同時実行をまとめる
    const inFlight = inflight.get(cacheKey);
    if (inFlight) {
      const json = await inFlight;
      return NextResponse.json(json);
    }

    const run = (async (): Promise<any> => {

    // タイムライン設定を取得（所有者チェック）
    const { data: timeline, error: timelineError } = await supabaseAdmin
      .from('custom_timelines')
      .select('*')
      .eq('id', timelineId)
      .maybeSingle();

    if (timelineError) throw timelineError;
    if (!timeline) return NextResponse.json({ posts: [] });

    if (timeline.user_id !== userId) {
      return NextResponse.json({ error: 'このタイムラインにアクセスできません' }, { status: 403 });
    }

    // 政治家リストを決定
    let targetPoliticianIds: string[] = [];

    const { data: timelinePoliticians } = await supabaseAdmin
      .from('timeline_politicians')
      .select('politician_id')
      .eq('timeline_id', timelineId);

    if (timelinePoliticians && timelinePoliticians.length > 0) {
      targetPoliticianIds = timelinePoliticians.map((tp: any) => tp.politician_id);
    } else {
      const { data: timelinePrefectures } = await supabaseAdmin
        .from('timeline_prefectures')
        .select('prefecture_code')
        .eq('timeline_id', timelineId);

      if (timelinePrefectures && timelinePrefectures.length > 0) {
        const prefectureCodes = timelinePrefectures.map((tp: any) => tp.prefecture_code);
        const { data: regionPoliticians } = await supabaseAdmin
          .from('politicians')
          .select('id')
          .in('prefecture', prefectureCodes);
        if (regionPoliticians) {
          targetPoliticianIds = regionPoliticians.map((p: any) => p.id);
        }
      } else if (timeline.filters) {
        const filters = timeline.filters as any;
        const fromFilters: string[] = [];
        if (filters.politician_ids && filters.politician_ids.length > 0) {
          fromFilters.push(...filters.politician_ids);
        }
        if (filters.regions && filters.regions.length > 0) {
          const { data: regionPoliticians } = await supabaseAdmin
            .from('politicians')
            .select('id')
            .in('prefecture', filters.regions);
          if (regionPoliticians) {
            fromFilters.push(...regionPoliticians.map((p: any) => p.id));
          }
        }
        targetPoliticianIds = [...new Set(fromFilters)];
      }
    }

    if (targetPoliticianIds.length === 0) {
      return NextResponse.json({ posts: [] });
    }

    // プラットフォームフィルタ
    let platformAllowed: string[] | null = null;
    if (timeline.enabled_platforms) {
      const platformMap: Record<string, string[]> = {
        x: ['twitter', 'x'],
        facebook: ['facebook'],
        instagram: ['instagram'],
        youtube: ['youtube'],
        line: ['line'],
        blog: ['blog'],
        note: ['note'],
        tiktok: ['tiktok'],
        niconico: ['niconico'],
      };
      platformAllowed = [];
      Object.entries(timeline.enabled_platforms as any).forEach(([k, v]) => {
        if (v && platformMap[k]) platformAllowed!.push(...platformMap[k]);
      });
    } else if (timeline.include_x !== undefined || timeline.include_youtube !== undefined) {
      platformAllowed = [];
      if (timeline.include_x) platformAllowed.push('twitter', 'x');
      if (timeline.include_youtube) platformAllowed.push('youtube');
    }

    let query = supabaseAdmin
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
        politician_id,
        politicians ( id, name, position, prefecture, party_role )
      `)
      .in('politician_id', targetPoliticianIds)
      .order('published_at', { ascending: false })
      .range(from, to);

    if (platformAllowed && platformAllowed.length > 0) {
      query = query.in('platform', platformAllowed);
    }

    const { data: posts, error } = await query as any;
    if (error) throw error;
    const json = { posts: posts || [] };
    // 30秒キャッシュ
    cache.set(cacheKey, { expires: now + 30_000, json });
    return json;
    })();

    inflight.set(cacheKey, run);
    const json = await run;
    inflight.delete(cacheKey);
    return NextResponse.json(json);
  } catch (error) {
    console.error('Error in /api/custom-timeline:', error);
    return NextResponse.json({ error: 'タイムラインの取得に失敗しました' }, { status: 500 });
  }
}


