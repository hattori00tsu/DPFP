'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Hop as Home, Calendar, User, LogOut, Menu, X, Shield, CreditCard } from 'lucide-react';
import { Footer } from './Footer';
import { useAuth } from '@/lib/auth-context';

interface LayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: 'ダッシュボード', href: '/dashboard'},
  { name: '公式情報', href: '/official' },
  { name: 'プロフィール', href: '/profile'},
  { name: 'プラン', href: '/pricing' },
];

const adminNavigation = [
  { name: '管理画面', href: '/admin'},
];

export function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, userEmail, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 fixed w-full z-10 top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="flex items-center">
                <span className="text-2xl font-bold text-primary-600">国民ファンダム</span>
              </Link>

              <div className="hidden md:ml-10 md:flex md:space-x-8">
                {navigation.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`inline-flex items-center px-1 pt-1 text-sm font-medium border-b-2 transition ${isActive
                          ? 'border-primary-500 text-gray-900'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                    >
                      {item.name}
                    </Link>
                  );
                })}

                {/* 管理者のみ表示 */}
                {(profile?.role === 'staff' || profile?.role === 'politician') &&
                  adminNavigation.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`inline-flex items-center px-1 pt-1 text-sm font-medium border-b-2 transition ${isActive
                            ? 'border-red-500 text-red-700'
                            : 'border-transparent text-red-500 hover:text-red-700 hover:border-red-300'
                          }`}
                      >
                        <Shield className="w-4 h-4 mr-2" />
                        {item.name}
                      </Link>
                    );
                  })
                }
              </div>
            </div>

            <div className="flex items-center">
              <div className="hidden md:flex md:items-center md:space-x-4">
                <span className="text-sm text-gray-700">{profile.name}</span>
                <span className="text-xs px-2 py-1 bg-primary-100 text-primary-700 rounded-full">
                  {profile.role}
                </span>
                <button
                  onClick={handleSignOut}
                  className="text-gray-500 hover:text-gray-700 transition"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-3 py-2 rounded-md text-base font-medium ${isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                  >
                    <div className="flex items-center">
                      <Home className="w-5 h-5 mr-3" />
                      {item.name}
                    </div>
                  </Link>
                );
              })}

              {/* 管理者のみ表示 */}
              {(profile?.role === 'staff' || profile?.role === 'politician') &&
                adminNavigation.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block px-3 py-2 rounded-md text-base font-medium ${isActive
                          ? 'bg-red-50 text-red-700'
                          : 'text-red-600 hover:bg-red-50 hover:text-red-700'
                        }`}
                    >
                      <div className="flex items-center">
                        <Shield className="w-5 h-5 mr-3" />
                        {item.name}
                      </div>
                    </Link>
                  );
                })
              }
            </div>
            <div className="pt-4 pb-3 border-t border-gray-200">
              <div className="flex items-center px-5">
                <div className="flex-shrink-0">
                  <User className="w-10 h-10 text-gray-400" />
                </div>
                <div className="ml-3">
                  <div className="text-base font-medium text-gray-800">{profile.name}</div>
                  <div className="text-sm font-medium text-gray-500">{userEmail}</div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="ml-auto flex-shrink-0 p-1 text-gray-400 hover:text-gray-500"
                >
                  <LogOut className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      <main className="pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>

      <Footer />
    </div>
  );
}
