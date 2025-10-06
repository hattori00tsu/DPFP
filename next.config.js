/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Supabase functionsをビルドから除外
    config.resolve.alias = {
      ...config.resolve.alias,
    };
    
    config.module.rules.push({
      test: /supabase\/functions/,
      loader: 'ignore-loader'
    });
    
    return config;
  },
  // TypeScript設定でSupabase functionsを除外
  typescript: {
    ignoreBuildErrors: false,
  },
  // ビルド時にSupabase functionsディレクトリを無視
  outputFileTracingExcludes: {
    '*': ['./supabase/functions/**/*'],
  },
}

module.exports = nextConfig
