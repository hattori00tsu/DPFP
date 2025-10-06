import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          role: 'member' | 'politician' | 'staff' | 'volunteer';
          notification_settings: any;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      scraped_news: {
        Row: {
          id: string;
          title: string;
          url: string;
          content: string | null;
          published_at: string | null;
          source_url: string;
          category: string | null;
          tags: string[];
          scraped_at: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['scraped_news']['Row'], 'id' | 'scraped_at' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['scraped_news']['Insert']>;
      };
      user_preferences: {
        Row: {
          id: string;
          user_id: string;
          preference_type: string;
          preference_value: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_preferences']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['user_preferences']['Insert']>;
      };
      user_timeline: {
        Row: {
          id: string;
          user_id: string;
          news_id: string;
          displayed_at: string;
          is_read: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_timeline']['Row'], 'id' | 'displayed_at' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['user_timeline']['Insert']>;
      };
      scraped_events: {
        Row: {
          id: string;
          title: string;
          url: string;
          description: string | null;
          event_date: string | null;
          end_date: string | null;
          location: string | null;
          organizer: string | null;
          event_type: string | null;
          capacity: number | null;
          registration_required: boolean;
          registration_url: string | null;
          contact_info: string | null;
          source_url: string;
          tags: string[];
          scraped_at: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['scraped_events']['Row'], 'id' | 'scraped_at' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['scraped_events']['Insert']>;
      };
      user_event_timeline: {
        Row: {
          id: string;
          user_id: string;
          event_id: string;
          displayed_at: string;
          is_read: boolean;
          is_interested: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_event_timeline']['Row'], 'id' | 'displayed_at' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['user_event_timeline']['Insert']>;
      };
      politician_sns_posts: {
        Row: {
          id: string;
          politician_id: string;
          platform: string;
          post_id: string;
          content: string;
          media_urls: string[];
          post_url: string;
          published_at: string;
          engagement_count: number;
          hashtags: string[];
          mentions: string[];
          scraped_at: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['politician_sns_posts']['Row'], 'id' | 'scraped_at' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['politician_sns_posts']['Insert']>;
      };
      politician_sns_accounts: {
        Row: {
          id: string;
          politician_id: string;
          platform: string;
          account_handle: string;
          account_url: string;
          follower_count: number | null;
          is_verified: boolean;
          is_active: boolean;
          last_scraped_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['politician_sns_accounts']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['politician_sns_accounts']['Insert']>;
      };
      user_sns_timeline: {
        Row: {
          id: string;
          user_id: string;
          sns_post_id: string;
          displayed_at: string;
          is_read: boolean;
          is_liked: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_sns_timeline']['Row'], 'id' | 'displayed_at' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['user_sns_timeline']['Insert']>;
      };
      scraping_logs: {
        Row: {
          id: string;
          source_url: string;
          status: 'success' | 'error' | 'partial';
          items_scraped: number;
          error_message: string | null;
          scraped_at: string;
        };
        Insert: Omit<Database['public']['Tables']['scraping_logs']['Row'], 'id' | 'scraped_at'>;
        Update: Partial<Database['public']['Tables']['scraping_logs']['Insert']>;
      };
      politicians: {
        Row: {
          id: string;
          name: string;
          position: 'representative' | 'senator' | 'local';
          prefecture: string;
          region: string; // 互換のため存在する可能性
          twitter_handle: string | null;
          profile_url: string | null;
          party_role: string | null;
          bio: string | null;
          created_at: string;
        };
      };
      posts: {
        Row: {
          id: string;
          title: string;
          content: string | null;
          url: string | null;
          published_at: string;
          source_type: 'party_hq' | 'politician' | 'media' | 'sns';
          source_id: string | null;
          category: 'policy' | 'event' | 'media' | 'sns' | 'parliament';
          region: string | null;
          tags: string[];
          engagement: any;
          created_at: string;
        };
      };
      events: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          start_date: string;
          end_date: string | null;
          location: string;
          organizer_id: string | null;
          event_type: 'rally' | 'volunteer' | 'meeting' | 'other';
          capacity: number | null;
          registration_url: string | null;
          created_at: string;
        };
      };
      volunteer_opportunities: {
        Row: {
          id: string;
          title: string;
          description: string;
          region: string;
          activity_type: string;
          start_date: string | null;
          end_date: string | null;
          required_people: number | null;
          contact_info: string | null;
          created_at: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          content_type: string;
          content_id: string | null;
          title: string;
          message: string;
          sent_at: string;
          read_at: string | null;
        };
      };
      custom_timelines: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          filters: any;
          is_auto_generated: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['custom_timelines']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['custom_timelines']['Insert']>;
      };
    };
  };
};
