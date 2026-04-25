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
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

// Derived selector — avoids storing redundant boolean
export const useIsAuthenticated = () => useAuthStore((s) => s.user !== null);
