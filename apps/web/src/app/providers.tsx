'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { installNativeAuthBridge } from '@/lib/auth/native-login';
import { useAuthStore } from '@/lib/store/auth.store';
import {
  initNativePushBridge,
  syncPushRegistration,
} from '@/lib/utils/push';
import { apiClient } from '@/lib/api/client';

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
    installNativeAuthBridge();
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

  // API 콜드스타트 완화 (B1/B2): 앱 진입 즉시 + 4분마다 + 포그라운드 복귀 시
  // /health 핑으로 Railway 컨테이너를 미리 깨워, 새요청/채팅 첫 진입을 빠르게.
  useEffect(() => {
    const warm = () => { void apiClient.get('/api/v1/health', { timeout: 8000 }).catch(() => {}); };
    warm();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') warm();
    }, 4 * 60 * 1000);
    const onVisible = () => { if (document.visibilityState === 'visible') warm(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
