'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Calendar, Users, MessageSquare, ArrowRight } from 'lucide-react';
import { Footer } from '@/components/Footer';

export default function Home() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
    };

    checkAuth();
  }, [router]);

  // 認証チェック中はローディング表示
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ヒーローセクション */}
      <div className="bg-gradient-to-br from-primary-50 to-primary-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            国民ファンダム
              <span className="block text-primary-600">国民民主党推しのためのポータルサイト</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              最新の公式情報、イベント情報、政治家のSNS投稿を一箇所で確認できます。
              党員の皆様の政治参加をサポートします。
            </p>
            <Link
                href="/dashboard"
                className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-black bg-primary-600 hover:bg-primary-700 transition"
              >
                ダッシュボード
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/auth"
                className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-black bg-primary-600 hover:bg-primary-700 transition"
              >
                ログインして始める
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 機能紹介セクション */}
      <div className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              主な機能
            </h2>
            <p className="text-lg text-gray-600">
              政治情報を効率的に収集・管理できる機能を提供しています
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-primary-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                最新ニュース・イベント
              </h3>
              <p className="text-gray-600">
                国民民主党に関連する最新のニュースやイベント情報を自動収集し、
                タイムライン形式で表示します。
              </p>
            </div>

            <div className="text-center">
              <div className="bg-primary-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                政治家SNS投稿
              </h3>
              <p className="text-gray-600">
                国民民主党所属の政治家のSNS投稿を一箇所で確認できます。
                重要な発言や政策発表を見逃しません。
              </p>
            </div>

            <div className="text-center">
              <div className="bg-primary-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                パーソナライズ
              </h3>
              <p className="text-gray-600">
                お住まいの地域や関心のある分野に基づいて、
                関連性の高い情報を優先的に表示します。
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTAセクション */}
      <div className="bg-primary-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              今すぐ始めましょう
            </h2>
            <p className="text-xl text-primary-100 mb-8">
              Googleアカウントで簡単にログインできます
            </p>
            <Link
              href="/auth"
              className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-primary-600 bg-white hover:bg-gray-50 transition"
            >
              ログイン
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
