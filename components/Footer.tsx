import Link from 'next/link';
import { Twitter, MessageCircle } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* About Section */}
          <div>
            <h3 className="text-white text-lg font-semibold mb-4">About</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/Footer/about"
                  className="hover:text-white transition-colors duration-200"
                >
                  このサイトについて
                </Link>
              </li>
              <li>
                <Link
                  href="/Footer/support"
                  className="hover:text-white transition-colors duration-200"
                >
                  支援のお願い
                </Link>
              </li>
            </ul>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/"
                  className="hover:text-white transition-colors duration-200"
                >
                  ホーム
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources Section */}
          <div>
            <h3 className="text-white text-lg font-semibold mb-4">Resources</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/Footer/privacy"
                  className="hover:text-white transition-colors duration-200"
                >
                  プライバシーポリシー
                </Link>
              </li>
              <li>
                <Link
                  href="/Footer/terms"
                  className="hover:text-white transition-colors duration-200"
                >
                  利用規約
                </Link>
              </li>
              <li>
                <Link
                  href="/Footer/law"
                  className="hover:text-white transition-colors duration-200"
                >
                  特定商取引法に基づく表記
                </Link>
              </li>
              <li>
                <Link
                  href="/Footer/contact"
                  className="hover:text-white transition-colors duration-200"
                >
                  お問い合わせ
                </Link>
              </li>
              <li>
                <Link
                  href="/Footer/faq"
                  className="hover:text-white transition-colors duration-200"
                >
                  よくある質問
                </Link>
              </li>
              <li>
                <Link
                  href="/Footer/blog"
                  className="hover:text-white transition-colors duration-200"
                >
                  ブログ
                </Link>
              </li>
            </ul>
          </div>

          {/* Social Section */}
          <div>
            <h3 className="text-white text-lg font-semibold mb-4">Social</h3>
            <div className="flex space-x-4">
              <a
                href="https://x.com/hattorivv0000kk"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 hover:text-white transition-colors duration-200"
                aria-label="X (Twitter)"
              >
                <Twitter className="w-6 h-6" />
                <span>X</span>
              </a>
              <a
                href="https://discord.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 hover:text-white transition-colors duration-200"
                aria-label="Discord"
              >
                <MessageCircle className="w-6 h-6" />
                <span>Discord</span>
              </a>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-8 border-t border-gray-800 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} 国民ファンダム. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

