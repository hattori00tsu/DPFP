import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

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

    

    const prefectureMap = {
      '北海道': '01', '青森': '02', '岩手': '03', '宮城': '04', '秋田': '05', '山形': '06', '福島': '07',
      '茨城': '08', '栃木': '09', '群馬': '10', '埼玉': '11', '千葉': '12', '東京': '13', '神奈川': '14',
      '新潟': '15', '富山': '16', '石川': '17', '福井': '18', '山梨': '19', '長野': '20', '岐阜': '21',
      '静岡': '22', '愛知': '23', '三重': '24', '滋賀': '25', '京都': '26', '大阪': '27', '兵庫': '28',
      '奈良': '29', '和歌山': '30', '鳥取': '31', '島根': '32', '岡山': '33', '広島': '34', '山口': '35',
      '徳島': '36', '香川': '37', '愛媛': '38', '高知': '39', '福岡': '40', '佐賀': '41', '長崎': '42',
      '熊本': '43', '大分': '44', '宮崎': '45', '鹿児島': '46', '沖縄': '47'
    };

    let updatedCount = 0;

    for (const event of nullPrefEvents || []) {
      let prefecture = '48'; // デフォルトは「全国どこでも」
      
      // タイトルと説明から都道府県を検索
      const searchText = `${event.title} ${event.description || ''} ${event.location || ''}`;
      
      if (searchText.includes('全国どこでも') || searchText.includes('全国')) {
        prefecture = '48';
      } else {
        for (const [prefName, prefCode] of Object.entries(prefectureMap)) {
          if (searchText.includes(prefName)) {
            prefecture = prefCode;
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