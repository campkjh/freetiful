'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { consumeAuthReturnTo, getOAuthRedirectUri } from '@/lib/auth/oauth';

function NaverCallbackInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { naverLogin } = useAuth();
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    if (code && state) {
      called.current = true;
      naverLogin(code, state, getOAuthRedirectUri('naver'));
    } else {
      called.current = true;
      router.replace(consumeAuthReturnTo('/main'));
    }
  }, [searchParams, naverLogin, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-500 text-sm">네이버 로그인 처리 중...</p>
      </div>
    </div>
  );
}

export default function NaverCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" /></div>}>
      <NaverCallbackInner />
    </Suspense>
  );
}
