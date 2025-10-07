import type { Metadata } from 'next';
import { Noto_Sans_JP } from 'next/font/google';
import './globals.css';
import Providers from '@/components/Providers';

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
});

export const metadata: Metadata = {
  title: '国民ファンダム - 国民民主党 党員向け情報統合システム',
  description: '国民民主党の議員・党員・アクティブサポーター向けの情報統合プラットフォーム',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className={notoSansJP.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
