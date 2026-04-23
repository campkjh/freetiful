'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store/auth.store';
import {
  initIOSPushBridge,
  registerPushSubscription,
  flushOneSignalPlayerId,
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
    initIOSPushBridge();
    if (useAuthStore.getState().accessToken) {
      void registerPushSubscription();
      void flushOneSignalPlayerId();
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
