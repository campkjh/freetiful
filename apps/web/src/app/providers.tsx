'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store/auth.store';
import {
  initNativePushBridge,
  syncPushRegistration,
} from '@/lib/utils/push';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      }),
  );

  useEffect(() => {
    initNativePushBridge();
    const state = useAuthStore.getState();
    if (state.accessToken) void syncPushRegistration(state.user?.id);
    const unsubscribe = useAuthStore.subscribe((next, prev) => {
      if (next.accessToken && next.accessToken !== prev.accessToken) {
        void syncPushRegistration(next.user?.id);
      }
    });
    return unsubscribe;
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
