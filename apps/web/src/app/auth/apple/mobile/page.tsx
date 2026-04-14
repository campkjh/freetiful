'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi } from '@/lib/api/auth.api';
import { useAuthStore } from '@/lib/store/auth.store';

function deriveCredentials(appleUserId: string) {
  return {
    email: `apple_${appleUserId}@apple.freetiful.com`,
    password: `apple_${appleUserId}_freetiful_oauth_v1`,
  };
}

function AppleMobileInner() {
  const router = useRouter();
  const params = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [status, setStatus] = useState('Apple 로그인 처리 중...');

  useEffect(() => {
    const appleUserId = params.get('appleUserId');
    const fullName = params.get('fullName') || 'Apple 사용자';
    if (!appleUserId) {
      setStatus('잘못된 요청입니다.');
      return;
    }

    (async () => {
      try {
        const { email, password } = deriveCredentials(appleUserId);
        setStatus('로그인 중...');
        let data;
        try {
          data = await authApi.emailLogin(email, password);
        } catch {
          setStatus('계정 생성 중...');
          data = await authApi.emailRegister({ email, password, name: fullName });
        }
        setAuth(data.user, data.tokens.accessToken, data.tokens.refreshToken);
        setTimeout(() => { window.location.href = '/main'; }, 100);
      } catch (e: any) {
        setStatus(`로그인 실패: ${e?.response?.data?.message || e?.message || '알 수 없는 오류'}`);
      }
    })();
  }, [params, router, setAuth]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <div className="w-10 h-10 border-4 border-gray-200 border-t-black rounded-full animate-spin mb-4" />
      <p className="text-gray-500 text-sm">{status}</p>
    </div>
  );
}

export default function AppleMobileCallback() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <AppleMobileInner />
    </Suspense>
  );
}
