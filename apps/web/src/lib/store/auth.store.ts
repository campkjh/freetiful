'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@prettyful/types';

const USER_SCOPED_STORAGE_KEYS = [
  'freetiful-auth-user-id',
  'freetiful-chat-rooms-cache-v1',
  'freetiful-coupon-cache',
  'freetiful-favorites',
  'freetiful-favorites-list-cache-v1',
  'freetiful-my-pro-category',
  'freetiful-my-pro-id',
  'freetiful-my-pro-stats-cache-v1',
  'freetiful-notifications-cache',
  'freetiful-notifications-count',
  'freetiful-payment-cache',
  'freetiful-pro-dashboard-cache-v2',
  'freetiful-pudding',
  'freetiful-purchase-cache',
  'freetiful-user',
  'prettyful-auth',
  'pro-quotes',
  'proRegistrationComplete',
  'proRegister_allAgreed',
  'proRegister_awards',
  'proRegister_bank',
  'proRegister_careerYears',
  'proRegister_category',
  'proRegister_code',
  'proRegister_companyLogos',
  'proRegister_customOptions',
  'proRegister_description',
  'proRegister_enabledPlans',
  'proRegister_faq',
  'proRegister_gender',
  'proRegister_intro',
  'proRegister_languages',
  'proRegister_mainPhotoIndex',
  'proRegister_name',
  'proRegister_phone',
  'proRegister_photos',
  'proRegister_prices',
  'proRegister_regions',
  'proRegister_selectedCategories',
  'proRegister_selectedRegions',
  'proRegister_terms',
  'proRegister_videos',
  'userRole',
  'viewAsUser',
];

export function clearUserScopedAuthStorage() {
  if (typeof window === 'undefined') return;
  try {
    USER_SCOPED_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  } catch {}
}

function syncUserRole(user: User) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('freetiful-auth-user-id', user.id);
    localStorage.setItem('userRole', user.role || 'general');
  } catch {}
}

function getLastAuthUserId() {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('freetiful-auth-user-id');
  } catch {
    return null;
  }
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  hasHydrated: boolean;

  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
  setHasHydrated: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      hasHydrated: false,

      setAuth: (user, accessToken, refreshToken) => set((state) => {
        const lastUserId = getLastAuthUserId();
        if ((state.user?.id && state.user.id !== user.id) || (lastUserId && lastUserId !== user.id)) {
          clearUserScopedAuthStorage();
        }
        syncUserRole(user);
        return { user, accessToken, refreshToken };
      }),
      setUser: (user) => set((state) => {
        const lastUserId = getLastAuthUserId();
        if ((state.user?.id && state.user.id !== user.id) || (lastUserId && lastUserId !== user.id)) {
          clearUserScopedAuthStorage();
        }
        syncUserRole(user);
        return { user };
      }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      logout: () => {
        clearUserScopedAuthStorage();
        set({ user: null, accessToken: null, refreshToken: null });
      },
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'prettyful-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
      onRehydrateStorage: () => (state, error) => {
        // localStorage 파싱 실패(error) 또는 빈 state → hasHydrated가 false에 고착되는 버그 방지.
        // state가 undefined여도 반드시 true로 설정해야 isLoggedIn 체크가 unblock된다.
        if (error || !state) {
          useAuthStore.getState().setHasHydrated(true);
          return;
        }
        state.setHasHydrated(true);
        // Hydration 직후, 토큰이 있으면 서버에서 최신 user 정보 한 번 fetch.
        // 머지된 레거시 계정의 cached user 객체를 본 계정으로 자동 갱신 (synthetic email → real).
        if (typeof window === 'undefined') return;
        const accessToken = state.accessToken;
        const cachedUser = state.user;
        if (!accessToken || !cachedUser) return;
        // 합성 이메일이면 우선순위 높여 즉시 fetch
        const isLegacyEmail = !!cachedUser.email?.match(/^kakao_\d+@kakao\.freetiful\.com$/);
        const fire = () => {
          import('../api/users.api').then(({ usersApi }) => {
            usersApi.getProfile()
              .then((fresh: any) => {
                if (!fresh?.id) return;
                if (fresh.id !== cachedUser.id || fresh.email !== cachedUser.email) {
                  useAuthStore.getState().setUser(fresh);
                }
              })
              .catch(() => {});
          });
        };
        if (isLegacyEmail) fire();
        else setTimeout(fire, 100); // 일반 케이스는 메인 렌더 후 살짝 늦게
      },
    },
  ),
);

// Derived selector — avoids storing redundant boolean
export const useIsAuthenticated = () => useAuthStore((s) => s.user !== null);
