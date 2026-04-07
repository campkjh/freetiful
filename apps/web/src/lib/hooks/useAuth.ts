'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '../store/auth.store';
import { authApi } from '../api/auth.api';
import type { LoginResponse } from '@prettyful/types';
import toast from 'react-hot-toast';

export function useAuth() {
  const router = useRouter();
  const { setAuth, logout: storeLogout, user, refreshToken } = useAuthStore();

  const handleLoginResponse = (data: LoginResponse) => {
    setAuth(data.user, data.tokens.accessToken, data.tokens.refreshToken);
    router.push(data.needsPhone || (data.isNewUser && !data.user.name) ? '/onboarding' : '/home');
  };

  const withLogin = async (call: () => Promise<LoginResponse>, fallbackMsg: string) => {
    try {
      handleLoginResponse(await call());
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? fallbackMsg);
    }
  };

  return {
    user,
    isAuthenticated: user !== null,

    kakaoLogin: (code: string) =>
      withLogin(() => authApi.kakaoLogin(code), '카카오 로그인에 실패했습니다.'),

    googleLogin: (idToken: string) =>
      withLogin(() => authApi.googleLogin(idToken), '구글 로그인에 실패했습니다.'),

    naverLogin: (code: string, state: string) =>
      withLogin(() => authApi.naverLogin(code, state), '네이버 로그인에 실패했습니다.'),

    appleLogin: (identityToken: string, fullName?: string) =>
      withLogin(() => authApi.appleLogin(identityToken, fullName), 'Apple 로그인에 실패했습니다.'),

    emailLogin: (email: string, password: string) =>
      withLogin(() => authApi.emailLogin(email, password), '이메일 또는 비밀번호를 확인해주세요.'),

    emailRegister: (dto: { email: string; password: string; name: string; phone?: string }) =>
      withLogin(() => authApi.emailRegister(dto), '회원가입에 실패했습니다.'),

    logout: async () => {
      try {
        if (refreshToken) await authApi.logout(refreshToken);
      } finally {
        storeLogout();
        router.push('/login');
      }
    },
  };
}
