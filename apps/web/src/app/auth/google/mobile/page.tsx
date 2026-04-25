'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { loginFromNativeCallback } from '@/lib/auth/native-login';

function GoogleMobileInner() {
  const params = useSearchParams();
  const hasStarted = useRef(false);
  const [status, setStatus] = useState('구글 로그인 처리 중...');

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    (async () => {
      try {
        await loginFromNativeCallback('google', params, { onStatus: setStatus });
      } catch (e: any) {
        setStatus(`로그인 실패: ${e?.response?.data?.message || e?.message || '알 수 없는 오류'}`);
      }
    })();
  }, [params]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-400 rounded-full animate-spin mb-4" />
      <p className="text-gray-500 text-sm">{status}</p>
    </div>
  );
}

export default function GoogleMobileCallback() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <GoogleMobileInner />
    </Suspense>
  );
}
