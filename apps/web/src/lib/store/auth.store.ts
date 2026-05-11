'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@prettyful/types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;

  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,

      setAuth: (user, accessToken, refreshToken) => set({ user, accessToken, refreshToken }),
      setUser: (user) => set({ user }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      logout: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    {
      name: 'prettyful-auth',
    },
  ),
);

// Derived selector — avoids storing redundant boolean
export const useIsAuthenticated = () => useAuthStore((s) => s.user !== null);

/**
 * Zustand persist hydrates asynchronously after mount, so `user` can be null
 * for a brief window even when the user IS logged in.  This helper falls back
 * to reading the raw `prettyful-auth` key so click-handlers that run before
 * hydration completes still get the correct answer.
 *
 * Safe to call from event handlers (client-only — reads localStorage directly).
 */
export function getIsLoggedIn(user: unknown): boolean {
  if (user) return true;
  try {
    const raw = localStorage.getItem('prettyful-auth');
    if (raw) {
      const parsed = JSON.parse(raw) as { state?: { accessToken?: string; user?: unknown } };
      if (parsed?.state?.accessToken || parsed?.state?.user) return true;
    }
  } catch {}
  return localStorage.getItem('freetiful-logged-in') === 'true';
}
