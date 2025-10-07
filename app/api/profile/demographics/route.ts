import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'ユーザーIDが必要です' }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from('user_demographics')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;

    return NextResponse.json({ demographics: data || null });
  } catch (error) {
    console.error('Error fetching demographics:', error);
    return NextResponse.json(
      { error: '属性情報の取得に失敗しました' },
      { status: 500 }
    );
  }
}


