'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/types';

interface AuthContextType {
  profile: Profile | null;
  userEmail: string;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  profile: null,
  userEmail: '',
  loading: true,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const loadProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const isProtectedPath = (path: string | null) => {
        if (!path) return false;
        return (
          path.startsWith('/dashboard') ||
          path.startsWith('/profile') ||
          path.startsWith('/admin') ||
          path.startsWith('/settings')
        );
      };

      if (!session) {
        if (isProtectedPath(pathname)) {
          router.push('/auth');
        } else {
          // 公開ページではリダイレクトせず読み込み完了扱いにする
          setLoading(false);
        }
        return;
      }

      setUserEmail(session.user.email || '');

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (data) {
        setProfile(data);
      }
    } catch (error) {
      console.error('プロファイル読み込みエラー:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialized) {
      loadProfile();
      setInitialized(true);
    }
  }, [initialized]);

  const refreshProfile = async () => {
    await loadProfile();
  };

  return (
    <AuthContext.Provider value={{ profile, userEmail, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

