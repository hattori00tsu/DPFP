import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'ユーザーIDが必要です' }, { status: 400 });
  }

  try {
    const { data: preferences, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) throw error;

    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('Error fetching preferences:', error);
    return NextResponse.json(
      { error: '設定の取得に失敗しました' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, preferenceType, preferenceValue, isActive = true } = await request.json();

    if (!userId || !preferenceType || !preferenceValue) {
      return NextResponse.json(
        { error: '必要なパラメータが不足しています' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('user_preferences')
      .upsert({
        user_id: userId,
        preference_type: preferenceType,
        preference_value: preferenceValue,
        is_active: isActive
      }, {
        onConflict: 'user_id,preference_type,preference_value'
      })
      .select();

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      preference: data[0] 
    });
  } catch (error) {
    console.error('Error saving preference:', error);
    return NextResponse.json(
      { error: '設定の保存に失敗しました' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId, preferenceType, preferenceValue } = await request.json();

    if (!userId || !preferenceType || !preferenceValue) {
      return NextResponse.json(
        { error: '必要なパラメータが不足しています' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('user_preferences')
      .delete()
      .eq('user_id', userId)
      .eq('preference_type', preferenceType)
      .eq('preference_value', preferenceValue);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting preference:', error);
    return NextResponse.json(
      { error: '設定の削除に失敗しました' },
      { status: 500 }
    );
  }
}