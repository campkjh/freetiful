'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '../store/auth.store';
import { authApi } from '../api/auth.api';
import { notifyIOSLogout, syncPushRegistration } from '../utils/push';
import { consumeAuthReturnTo } from '../auth/oauth';
import type { LoginResponse } from '@prettyful/types';
import toast from 'react-hot-toast';

function isRedirectUriRejected(error: any) {
  const message = error?.response?.data?.message;
  return (
    error?.response?.status === 400 &&
    Array.isArray(message) &&
    message.some((item) => typeof item === 'string' && item.includes('redirectUri'))
  );
}

export function useAuth() {
  const router = useRouter();
  const { setAuth, logout: storeLogout, user, refreshToken } = useAuthStore();

  const handleLoginResponse = (data: LoginResponse, skipOnboarding = false) => {
    setAuth(data.user, data.tokens.accessToken, data.tokens.refreshToken);
    try { sessionStorage.removeItem('freetiful-auth-switching'); } catch {}
    void syncPushRegistration(data.user.id);
    // 소셜 로그인은 온보딩 스킵, 이메일 가입만 온보딩
    if (skipOnboarding || (!data.isNewUser && data.user.name)) {
      router.replace(consumeAuthReturnTo('/main'));
    } else if (data.isNewUser && !data.user.name) {
      router.replace('/onboarding');
    } else {
      router.replace(consumeAuthReturnTo('/main'));
    }
  };

  const withLogin = async (call: () => Promise<LoginResponse>, fallbackMsg: string, skipOnboarding = false) => {
    try {
      handleLoginResponse(await call(), skipOnboarding);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? fallbackMsg);
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/auth/')) {
        window.setTimeout(() => router.replace(consumeAuthReturnTo('/main')), 800);
      }
    }
  };

  return {
    user,
    isAuthenticated: user !== null,

    kakaoLogin: (code: string, redirectUri?: string) =>
      withLogin(async () => {
        if (redirectUri) {
          let exchanged = false;
          try {
            const token = await authApi.exchangeKakaoCode(code, redirectUri);
            exchanged = true;
            return await authApi.kakaoNativeLogin(token.accessToken);
          } catch (e) {
            if (exchanged) throw e;
            console.warn('[auth] kakao token exchange fallback failed; using API code login', e);
          }
        }
        try {
          return await authApi.kakaoLogin(code, redirectUri);
        } catch (e) {
          if (redirectUri && isRedirectUriRejected(e)) {
            console.warn('[auth] kakao API code login does not accept redirectUri; retrying legacy payload', e);
            return authApi.kakaoLogin(code);
          }
          throw e;
        }
      }, '카카오 로그인에 실패했습니다.', true),

    googleLogin: (idToken: string) =>
      withLogin(() => authApi.googleLogin(idToken), '구글 로그인에 실패했습니다.', true),

    naverLogin: (code: string, state: string, redirectUri?: string) =>
      withLogin(async () => {
        // 백엔드 code login 만 사용. 이전엔 Next.js 의 /api/oauth/naver/token 으로
        // 먼저 token 교환을 시도했는데, 잘못된 client_id 가 하드코딩돼 있어 실패하면서
        // naver 가 code 를 소비해버려 두 번째 시도(backend) 도 실패하던 케이스가 있었다.
        // 한 번에 backend 로 보내는 게 가장 안정적.
        try {
          return await authApi.naverLogin(code, state, redirectUri);
        } catch (e) {
          if (redirectUri && isRedirectUriRejected(e)) {
            console.warn('[auth] naver API code login does not accept redirectUri; retrying legacy payload', e);
            return authApi.naverLogin(code, state);
          }
          throw e;
        }
      }, '네이버 로그인에 실패했습니다.', true),

    appleLogin: (identityToken: string, fullName?: string) =>
      withLogin(() => authApi.appleLogin(identityToken, fullName), 'Apple 로그인에 실패했습니다.', true),

    emailLogin: (email: string, password: string) =>
      withLogin(() => authApi.emailLogin(email, password), '이메일 또는 비밀번호를 확인해주세요.'),

    emailRegister: (dto: { email: string; password: string; name: string; phone?: string }) =>
      withLogin(() => authApi.emailRegister(dto), '회원가입에 실패했습니다.'),

    logout: async () => {
      // 낙관적 로그아웃 — 상태/화면 먼저 정리(즉시 반영), 서버 세션 해제는 백그라운드
      const tokenForRevoke = refreshToken;
      notifyIOSLogout();
      storeLogout();
      router.push('/main');
      if (tokenForRevoke) authApi.logout(tokenForRevoke).catch(() => {});
    },
  };
}
