import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { prefectures } from '@/public/prefecture';

export async function POST(request: NextRequest) {
  try {
    // prefecture が null のイベントを取得
    const { data: nullPrefEvents, error: fetchError } = await supabaseAdmin
      .from('official_events')
      .select('*')
      .is('prefecture', null);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

  

    let updatedCount = 0;

    for (const event of nullPrefEvents || []) {
      let prefecture = '48'; // デフォルトは「全国どこでも」
      
      // タイトルと説明から都道府県を検索
      const searchText = `${event.title} ${event.description || ''} ${event.location || ''}`;
      
      if (searchText.includes('全国どこでも') || searchText.includes('全国')) {
        prefecture = '48';
      } else {
        for (const [prefName, prefCode] of Object.entries(prefectures)) {
          if (searchText.includes(prefName)) {
            prefecture = prefCode.id;
            break;
          }
        }
      }

      // イベントを更新
      const { error: updateError } = await supabaseAdmin
        .from('official_events')
        .update({ prefecture })
        .eq('id', event.id);

      if (updateError) {
        console.error(`Error updating event ${event.id}:`, updateError);
      } else {
        updatedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${updatedCount} events`,
      totalFound: nullPrefEvents?.length || 0,
      updated: updatedCount
    });
  } catch (error) {
    console.error('Fix events error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}