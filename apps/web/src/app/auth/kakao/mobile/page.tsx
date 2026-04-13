'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi } from '@/lib/api/auth.api';
import { useAuthStore } from '@/lib/store/auth.store';

/**
 * Stady-style native-to-web login bridge.
 *
 * Flow:
 *   1. iOS/Android native SDK logs in with Kakao → obtains `accessToken`.
 *   2. Native app loads `/auth/kakao/mobile?token={accessToken}` inside WebView.
 *   3. This page verifies the token by calling `kapi.kakao.com/v2/user/me` directly
 *      from the browser (Kakao allows CORS for the Bearer-token API).
 *   4. With the verified kakaoId, we map the user to a deterministic email
 *      `kakao_{id}@kakao.freetiful.com` and log in via the existing email endpoints.
 *      On first login, we auto-register. No backend changes required.
 */

function deriveCredentials(kakaoId: string) {
  // Deterministic email+password per kakaoId — shim until a native-token backend endpoint is deployed.
  const email = `kakao_${kakaoId}@kakao.freetiful.com`;
  const password = `kakao_${kakaoId}_freetiful_oauth_v1`;
  return { email, password };
}

function KakaoMobileInner() {
  const router = useRouter();
  const params = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [status, setStatus] = useState('카카오 로그인 처리 중...');

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setStatus('잘못된 요청입니다. 토큰이 없습니다.');
      return;
    }

    (async () => {
      try {
        setStatus('카카오 계정 확인 중...');
        const kakaoRes = await fetch('https://kapi.kakao.com/v2/user/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!kakaoRes.ok) throw new Error(`Kakao verify failed (${kakaoRes.status})`);
        const kakaoUser = await kakaoRes.json();
        const kakaoId = String(kakaoUser.id);
        const nickname = kakaoUser.kakao_account?.profile?.nickname || '';

        const { email, password } = deriveCredentials(kakaoId);

        setStatus('로그인 중...');
        let loginData;
        try {
          loginData = await authApi.emailLogin(email, password);
        } catch {
          setStatus('계정 생성 중...');
          loginData = await authApi.emailRegister({ email, password, name: nickname || '카카오 사용자' });
        }

        setAuth(loginData.user, loginData.tokens.accessToken, loginData.tokens.refreshToken);
        router.replace('/home');
      } catch (e: any) {
        console.error(e);
        setStatus(`로그인 실패: ${e.message || '알 수 없는 오류'}`);
      }
    })();
  }, [params, router, setAuth]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white">
      <div className="w-10 h-10 border-4 border-gray-200 border-t-yellow-400 rounded-full animate-spin mb-4" />
      <p className="text-gray-500 text-sm">{status}</p>
    </div>
  );
}

export default function KakaoMobileCallback() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <KakaoMobileInner />
    </Suspense>
  );
}
