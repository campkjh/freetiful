import { apiClient } from './client';
import type { LoginResponse, User } from '@prettyful/types';

const BASE = '/api/v1/auth';

export const authApi = {
  kakaoLogin: (code: string) =>
    apiClient.post<LoginResponse>(`${BASE}/login/kakao`, { code }).then((r) => r.data),

  googleLogin: (idToken: string) =>
    apiClient.post<LoginResponse>(`${BASE}/login/google`, { idToken }).then((r) => r.data),

  naverLogin: (code: string, state: string) =>
    apiClient.post<LoginResponse>(`${BASE}/login/naver`, { code, state }).then((r) => r.data),

  appleLogin: (identityToken: string, fullName?: string) =>
    apiClient.post<LoginResponse>(`${BASE}/login/apple`, { identityToken, fullName }).then((r) => r.data),

  emailRegister: (data: { email: string; password: string; name: string; phone?: string }) =>
    apiClient.post<LoginResponse>(`${BASE}/register/email`, data).then((r) => r.data),

  emailLogin: (email: string, password: string) =>
    apiClient.post<LoginResponse>(`${BASE}/login/email`, { email, password }).then((r) => r.data),

  refresh: (refreshToken: string) =>
    apiClient.post(`${BASE}/refresh`, { refreshToken }).then((r) => r.data),

  logout: (refreshToken: string) =>
    apiClient.post(`${BASE}/logout`, { refreshToken }),

  me: () =>
    apiClient.get<User>(`${BASE}/me`).then((r) => r.data),
};
