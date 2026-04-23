'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '../store/auth.store';
import { authApi } from '../api/auth.api';
import { registerPushSubscription, flushOneSignalPlayerId, notifyIOSLogin, notifyIOSLogout } from '../utils/push';
import type { LoginResponse } from '@prettyful/types';
import toast from 'react-hot-toast';

export function useAuth() {
  const router = useRouter();
  const { setAuth, logout: storeLogout, user, refreshToken } = useAuthStore();

  const handleLoginResponse = (data: LoginResponse, skipOnboarding = false) => {
    setAuth(data.user, data.tokens.accessToken, data.tokens.refreshToken);
    notifyIOSLogin(data.user.id);
    void registerPushSubscription();
    void flushOneSignalPlayerId();
    // 소셜 로그인은 온보딩 스킵, 이메일 가입만 온보딩
    if (skipOnboarding || (!data.isNewUser && data.user.name)) {
      router.push('/main');
    } else if (data.isNewUser && !data.user.name) {
      router.push('/onboarding');
    } else {
      router.push('/main');
    }
  };

  const withLogin = async (call: () => Promise<LoginResponse>, fallbackMsg: string, skipOnboarding = false) => {
    try {
      handleLoginResponse(await call(), skipOnboarding);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? fallbackMsg);
    }
  };

  return {
    user,
    isAuthenticated: user !== null,

    kakaoLogin: (code: string) =>
      withLogin(() => authApi.kakaoLogin(code), '카카오 로그인에 실패했습니다.', true),

    googleLogin: (idToken: string) =>
      withLogin(() => authApi.googleLogin(idToken), '구글 로그인에 실패했습니다.', true),

    naverLogin: (code: string, state: string) =>
      withLogin(() => authApi.naverLogin(code, state), '네이버 로그인에 실패했습니다.', true),

    appleLogin: (identityToken: string, fullName?: string) =>
      withLogin(() => authApi.appleLogin(identityToken, fullName), 'Apple 로그인에 실패했습니다.', true),

    emailLogin: (email: string, password: string) =>
      withLogin(() => authApi.emailLogin(email, password), '이메일 또는 비밀번호를 확인해주세요.'),

    emailRegister: (dto: { email: string; password: string; name: string; phone?: string }) =>
      withLogin(() => authApi.emailRegister(dto), '회원가입에 실패했습니다.'),

    logout: async () => {
      try {
        if (refreshToken) await authApi.logout(refreshToken);
      } finally {
        notifyIOSLogout();
        storeLogout();
        router.push('/login');
      }
    },
  };
}
