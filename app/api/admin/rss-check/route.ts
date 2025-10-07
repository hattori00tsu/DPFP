import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { url, platform } = await request.json();

    if (!url || !platform) {
      return NextResponse.json(
        { error: 'URLとプラットフォームが必要です' },
        { status: 400 }
      );
    }

    // RSSフィードの検証
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RSS Reader)',
        'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml'
      }
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `RSS取得エラー: ${response.status}` },
        { status: 400 }
      );
    }

    const rssText = await response.text();

    // 基本的なRSS/Atom形式の検証
    const isValidRSS = rssText.includes('<rss') || 
                       rssText.includes('<feed') || 
                       rssText.includes('<channel>') ||
                       rssText.includes('<entry>');

    if (!isValidRSS) {
      return NextResponse.json(
        { error: '有効なRSSフィードではありません' },
        { status: 400 }
      );
    }

    // 簡易的な項目数カウント
    const itemCount = (rssText.match(/<item>/g) || []).length + 
                      (rssText.match(/<entry>/g) || []).length;

    // プラットフォーム固有の検証
    let platformSpecific = {};
    
    if (platform === 'twitter') {
      // RSS Appの場合、特定の構造を確認
      const hasTwitterContent = rssText.includes('twitter.com') || 
                               rssText.includes('x.com') ||
                               rssText.includes('rss.app');
      platformSpecific = { hasTwitterContent };
    } else if (platform === 'youtube') {
      // YouTube公式RSSの場合
      const hasYouTubeContent = rssText.includes('youtube.com') ||
                               rssText.includes('yt:videoId') ||
                               rssText.includes('media:group');
      platformSpecific = { hasYouTubeContent };
    }

    return NextResponse.json({
      success: true,
      valid: true,
      itemCount,
      platform,
      ...platformSpecific,
      message: `有効なRSSフィードです（${itemCount}件の項目）`
    });

  } catch (error) {
    console.error('RSS check error:', error);
    return NextResponse.json(
      { error: 'RSS検証中にエラーが発生しました' },
      { status: 500 }
    );
  }
}