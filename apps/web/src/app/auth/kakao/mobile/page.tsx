'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi } from '@/lib/api/auth.api';
import { usersApi } from '@/lib/api/users.api';
import { useAuthStore } from '@/lib/store/auth.store';

/**
 * Stady-style native-to-web login bridge.
 *
 * Flow:
 *   1. iOS/Android native SDK performs Kakao login + fetches user info via SDK.
 *   2. Native app loads `/auth/kakao/mobile?kakaoId=...&email=...&nickname=...`.
 *   3. This page maps the verified kakaoId to a deterministic email
 *      `kakao_{id}@kakao.freetiful.com` and logs in via existing email endpoints.
 *      On first login we auto-register. Zero backend changes, zero browser-side
 *      cross-origin calls to kapi.kakao.com.
 */

function deriveCredentials(kakaoId: string) {
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
    const kakaoId = params.get('kakaoId');
    const nickname = params.get('nickname') || '카카오 사용자';
    const profileImageUrl = params.get('profileImageUrl') || '';

    if (!kakaoId) {
      setStatus('잘못된 요청입니다 (kakaoId 없음).');
      return;
    }

    (async () => {
      try {
        const { email, password } = deriveCredentials(kakaoId);

        setStatus('로그인 중...');
        let loginData;
        try {
          loginData = await authApi.emailLogin(email, password);
        } catch {
          setStatus('계정 생성 중...');
          loginData = await authApi.emailRegister({ email, password, name: nickname });
        }

        setAuth(loginData.user, loginData.tokens.accessToken, loginData.tokens.refreshToken);

        // 프로필 이미지 업데이트 (카카오 제공)
        if (profileImageUrl) {
          try {
            const updated = await usersApi.updateProfile({ profileImageUrl });
            setAuth(updated, loginData.tokens.accessToken, loginData.tokens.refreshToken);
          } catch (imgErr) {
            console.warn('[kakao-mobile] 프로필 이미지 업데이트 실패', imgErr);
          }
        }

        // 홈(/main)으로 이동 — 전체 새로고침으로 Zustand 상태 확실히 반영
        setTimeout(() => { window.location.href = '/main'; }, 100);
      } catch (e: any) {
        console.error('[kakao-mobile]', e);
        setStatus(`로그인 실패: ${e?.response?.data?.message || e?.message || '알 수 없는 오류'}`);
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
