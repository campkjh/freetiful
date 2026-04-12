'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';

function KakaoCallbackInner() {
  const searchParams = useSearchParams();
  const { kakaoLogin } = useAuth();
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    const code = searchParams.get('code');
    if (code) {
      called.current = true;
      kakaoLogin(code);
    }
  }, [searchParams, kakaoLogin]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-500 text-sm">카카오 로그인 처리 중...</p>
      </div>
    </div>
  );
}

export default function KakaoCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" /></div>}>
      <KakaoCallbackInner />
    </Suspense>
  );
}
