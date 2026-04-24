'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi } from '@/lib/api/auth.api';
import { usersApi } from '@/lib/api/users.api';
import { useAuthStore } from '@/lib/store/auth.store';

function deriveCredentials(kakaoId: string) {
  return {
    email: `kakao_${kakaoId}@kakao.freetiful.com`,
    password: `kakao_${kakaoId}_freetiful_oauth_v1`,
  };
}

function KakaoMobileInner() {
  const router = useRouter();
  const params = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [status, setStatus] = useState('카카오 로그인 처리 중...');

  useEffect(() => {
    const kakaoId = params.get('kakaoId') || params.get('id') || params.get('userId');
    const name = params.get('name') || params.get('nickname') || '카카오 사용자';
    const profileImageUrl = params.get('profileImageUrl') || params.get('profile_image_url') || '';

    if (!kakaoId) {
      router.replace('/main');
      return;
    }

    (async () => {
      try {
        const { email, password } = deriveCredentials(kakaoId);
        setStatus('로그인 중...');
        let data;
        try {
          data = await authApi.emailLogin(email, password);
        } catch {
          setStatus('계정 생성 중...');
          data = await authApi.emailRegister({ email, password, name });
        }
        setAuth(data.user, data.tokens.accessToken, data.tokens.refreshToken);
        if (profileImageUrl) {
          try {
            const updated = await usersApi.updateProfile({ profileImageUrl });
            setAuth(updated, data.tokens.accessToken, data.tokens.refreshToken);
          } catch (e) {
            console.warn('[kakao-mobile] image 업데이트 실패', e);
          }
        }
        window.location.replace('/main');
      } catch (e: any) {
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
