import { Layout } from "@/components/Layout";

export default function AboutPage() {

  return (
    <>
    <Layout>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-2xl font-bold text-gray-900 pt-4 pb-4">このサービスについて</h1>
      <p className="text-gray-600 pb-4 text-lg">このサービスは国民民主党の公式情報・議員のsnsの情報がまとめ見たり、カスタムしてみることができます。</p>
      <p className="text-gray-600 pb-4 text-lg">サービスは有志が勝手に作っており、国民民主党の本部とは一切関係はございません</p>
      <p className="text-gray-600 pb-4 text-lg">掲載されている情報はrssを利用して取得しています。</p>
      <p className="text-gray-600 pb-4 text-lg">このサイトの情報の再配信は禁止としています。</p>
    </div>

    </Layout>
    </>
  );
}





