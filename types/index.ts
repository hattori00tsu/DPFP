export type UserRole = 'member' | 'politician' | 'staff' | 'volunteer' | 'admin';
export type PoliticianPosition = 'representative' | 'senator' | 'local';
export type PostSourceType = 'party_hq' | 'politician' | 'media' | 'sns';
export type PostCategory = 'policy' | 'event' | 'media' | 'sns' | 'parliament';
export type EventType = 'rally' | 'volunteer' | 'meeting' | 'other';

export interface Profile {
  id: string;
  name: string;
  role: UserRole;
  is_profile_complete: boolean;
  notification_settings: {
    email: boolean;
    daily_digest: boolean;
    weekly_summary: boolean;
  };
  created_at: string;
  updated_at: string;
}

export interface UserDemographics {
  id: string;
  user_id: string;
  birth_year: number | null;
  gender: 'male' | 'female' | 'other' | 'no_answer' | null;
  prefecture_code: string | null;
  party_member_rank: 'special_member' | 'member' | 'supporter' | 'fan' | 'other' | null;
  created_at: string;
  updated_at: string;
}

export interface Politician {
  id: string;
  name: string;
  position: PoliticianPosition;
  prefecture: string; // 都道府県コード（例: '13'）
  region?: string; // 互換のため残す（旧表示用）
  twitter_handle: string | null;
  profile_url: string | null;
  party_role: string | null;
  bio: string | null;
  created_at: string;
}

export interface Post {
  id: string;
  title: string;
  content: string | null;
  url: string | null;
  published_at: string;
  source_type: PostSourceType;
  source_id: string | null;
  category: PostCategory;
  region: string | null;
  tags: string[];
  engagement: {
    likes?: number;
    retweets?: number;
    views?: number;
  };
  created_at: string;
  politician?: Politician;
}

export interface Event {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  location: string;
  organizer_id: string | null;
  event_type: EventType;
  capacity: number | null;
  registration_url: string | null;
  created_at: string;
  organizer?: Politician;
}

export interface VolunteerOpportunity {
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
}

export interface Notification {
  id: string;
  user_id: string;
  content_type: string;
  content_id: string | null;
  title: string;
  message: string;
  sent_at: string;
  read_at: string | null;
}

export interface FilterState {
  region: string | null;
  politician: string | null;
  category: PostCategory | null;
  sourceType: PostSourceType | null;
  dateFrom: string | null;
  dateTo: string | null;
  search: string;
  newsCategories?: PostCategory[];
  eventCategories?: EventType[];
  prefectures?: string[];
  snsCategories?: PostSourceType[];
}

export interface CustomTimeline {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  include_x: boolean;
  include_youtube: boolean;
  enabled_platforms?: {
    x: boolean;
    facebook: boolean;
    instagram: boolean;
    youtube: boolean;
    line: boolean;
    blog: boolean;
    note: boolean;
    tiktok: boolean;
    niconico: boolean;
  };
  created_at: string;
  updated_at: string;
}

export interface TimelinePrefecture {
  id: string;
  timeline_id: string;
  prefecture_code: string;
  enabled_platforms?: {
    x?: boolean;
    facebook?: boolean;
    instagram?: boolean;
    youtube?: boolean;
    line?: boolean;
    blog?: boolean;
    note?: boolean;
    tiktok?: boolean;
    niconico?: boolean;
  };
  created_at: string;
}

export interface TimelinePolitician {
  id: string;
  timeline_id: string;
  politician_id: string;
  created_at: string;
}
