import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { PostCategory, PostSourceType, EventType } from '@/type/types';

export interface UserFilterDefaults {
  id: string;
  user_id: string;
  news_categories: PostCategory[];
  event_categories: EventType[];
  prefectures: string[];
  sns_categories: PostSourceType[];
  created_at: string;
  updated_at: string;
}

export class FilterDefaultsService {
  private supabase = createClientComponentClient();

  // ユーザーのフィルターデフォルト設定を取得
  async getUserFilterDefaults(userId: string): Promise<UserFilterDefaults | null> {
    const { data, error } = await this.supabase
      .from('user_filter_defaults')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching user filter defaults:', error);
      return null;
    }

    return data;
  }

  // ユーザーのフィルターデフォルト設定を更新
  async updateUserFilterDefaults(
    userId: string,
    defaults: Partial<Pick<UserFilterDefaults, 'news_categories' | 'event_categories' | 'prefectures' | 'sns_categories'>>
  ): Promise<UserFilterDefaults | null> {
    const { data, error } = await this.supabase
      .from('user_filter_defaults')
      .update({
        ...defaults,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user filter defaults:', error);
      return null;
    }

    return data;
  }

  // ユーザーのフィルターデフォルト設定を作成（存在しない場合）
  async createUserFilterDefaults(userId: string): Promise<UserFilterDefaults | null> {
    const { data, error } = await this.supabase
      .from('user_filter_defaults')
      .insert({
        user_id: userId,
        news_categories: ['policy', 'media', 'parliament'],
        event_categories: ['rally', 'volunteer', 'meeting', 'other'],
        prefectures: ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県', '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県', '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県', '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'],
        sns_categories: ['party_hq', 'politician', 'sns']
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating user filter defaults:', error);
      return null;
    }

    return data;
  }

  // ユーザーのフィルターデフォルト設定を取得または作成
  async getOrCreateUserFilterDefaults(userId: string): Promise<UserFilterDefaults | null> {
    let defaults = await this.getUserFilterDefaults(userId);
    
    if (!defaults) {
      defaults = await this.createUserFilterDefaults(userId);
    }

    return defaults;
  }
}

export const filterDefaultsService = new FilterDefaultsService();