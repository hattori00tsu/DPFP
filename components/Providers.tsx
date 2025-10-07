'use client';

import { SWRConfig } from 'swr';
import { AuthProvider } from '@/lib/auth-context';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        revalidateIfStale: false,
        dedupingInterval: 30000,
      }}
    >
      <AuthProvider>
        {children}
      </AuthProvider>
    </SWRConfig>
  );
}


