import { Suspense } from 'react';
import { Layout } from '@/components/Layout';
import AdminPageClient from './AdminPageClient';

export default function AdminPage() {
    return (
        <Layout>
            <Suspense fallback={<div className="py-8">Loading...</div>}>
                <AdminPageClient />
            </Suspense>
        </Layout>
    );
}