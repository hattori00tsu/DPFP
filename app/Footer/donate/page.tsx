import { Footer } from "@/components/Footer";
import { Layout } from "@/components/Layout";
import Link from "next/link";

export default function AboutPage() {

  return (
    <>
    <Layout>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-2xl font-bold text-gray-900 pt-4 pb-4">ご支援のお願い</h1>
      <p className="text-gray-600 pb-4 text-lg">このプロジェクトは有志による非公式プロジェクトであり、サーバー代やAPIの費用は自己負担です。</p>
      <Link href="/pricing" className="text-gray-600 pb-4 text-lg">ご支援はこちらからお願いします。</Link>
    </div>
    </Layout>
    </>
  );
}





