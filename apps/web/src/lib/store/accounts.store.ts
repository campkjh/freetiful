'use client';

import axios from 'axios';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@prettyful/types';
import { useAuthStore } from './auth.store';

/* ─────────────────────────────────────────────────────────────
 * 이 기기에 저장한 계정들 — 마이 탭을 두 번 누르면 뜨는 '계정 전환'(261006 사장 '계정 여러 개 만들어
 * 원라인 일반바 계정 연결처럼 왔다 갔다').
 *  · 로그인해 있는 계정은 저절로 들어온다(AccountSwitcher 가 인증 상태가 바뀔 때마다 토큰째 갱신 —
 *    새로고침 토큰은 1회용(서버 popSession)이라 늘 마지막 것으로 들고 있어야 다시 돌아올 수 있다).
 *  · 바꾸기 = 고른 계정의 토큰으로 먼저 살아 있는지 묻고(접속 토큰이 죽었으면 1회 갱신, 그래도 안 되면 목록에서 뺀다)
 *    → 인증 교체 → 페이지를 통째로 다시 연다(화면마다 들고 있던 이전 계정 데이터가 섞이지 않게).
 *  · 목록에서 지우는 건 '명시적 로그아웃'과 '이 기기에서 빼기'뿐 — 세션 만료로 풀린 계정은 남겨 뒀다가 고를 때 확인한다.
 *  · 사용자별 저장 키 청소(clearUserScopedAuthStorage) 목록에 넣지 않는다 — 계정이 바뀌어도 이 목록은 남아야 한다.
 *  · 푸시는 지금 보고 있는 계정 것만 온다(기기 하나 = OneSignal 사용자 하나 · 바꾸면 providers 가 다시 묶는다).
 * ──────────────────────────────────────────────────────────── */

export type SavedAccount = {
  id: string;
  user: User;
  accessToken: string;
  refreshToken: string;
  /** 목록 순서(처음 저장한 때) — 바꿀 때마다 줄이 뒤섞이지 않게 */
  addedAt: number;
  lastUsedAt: number;
};

export const MAX_SAVED_ACCOUNTS = 8;

interface AccountsState {
  accounts: SavedAccount[];
  hasHydrated: boolean;
  upsert: (user: User, accessToken: string, refreshToken: string) => void;
  forget: (id: string) => void;
  setHasHydrated: (value: boolean) => void;
}

export const useAccountsStore = create<AccountsState>()(
  persist(
    (set) => ({
      accounts: [],
      hasHydrated: false,
      upsert: (user, accessToken, refreshToken) => set((state) => {
        const now = Date.now();
        const prev = state.accounts.find((a) => a.id === user.id);
        const next: SavedAccount = { id: user.id, user, accessToken, refreshToken, addedAt: prev?.addedAt ?? now, lastUsedAt: now };
        let accounts = prev ? state.accounts.map((a) => (a.id === user.id ? next : a)) : [...state.accounts, next];
        if (accounts.length > MAX_SAVED_ACCOUNTS) {
          // 넘치면 가장 오래 안 쓴 계정부터(지금 계정은 빼고)
          const drop = new Set(
            accounts
              .filter((a) => a.id !== user.id)
              .sort((a, b) => a.lastUsedAt - b.lastUsedAt)
              .slice(0, accounts.length - MAX_SAVED_ACCOUNTS)
              .map((a) => a.id),
          );
          accounts = accounts.filter((a) => !drop.has(a.id));
        }
        return { accounts };
      }),
      forget: (id) => set((state) => ({ accounts: state.accounts.filter((a) => a.id !== id) })),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: 'freetiful-accounts-v1',
      partialize: (state) => ({ accounts: state.accounts }),
      onRehydrateStorage: () => (state) => { state?.setHasHydrated(true); },
    },
  ),
);

/** 지금 로그인한 계정을 목록에 반영(로그인 · 토큰 회전 · 프로필 갱신) */
export function rememberCurrentAccount() {
  const { user, accessToken, refreshToken } = useAuthStore.getState();
  if (!user?.id || !accessToken || !refreshToken) return;
  const saved = useAccountsStore.getState().accounts.find((a) => a.id === user.id);
  if (saved && saved.user === user && saved.accessToken === accessToken && saved.refreshToken === refreshToken) return;
  useAccountsStore.getState().upsert(user, accessToken, refreshToken);
}

/** 명시적 로그아웃 — 그 계정을 이 기기 목록에서 뺀다(서버 세션 해제는 부르는 쪽이 하던 대로) */
export function forgetSavedAccount(id?: string | null) {
  if (id) useAccountsStore.getState().forget(id);
}

/** '이 기기에서 빼기' — 목록에서 지우고, 그 계정 자신의 토큰으로 서버 세션도 끊는다(지금 계정이 아니라 apiClient 를 안 쓴다) */
export function removeSavedAccount(id: string) {
  const account = useAccountsStore.getState().accounts.find((a) => a.id === id);
  useAccountsStore.getState().forget(id);
  if (!account) return;
  axios
    .post('/api/v1/auth/logout', { refreshToken: account.refreshToken }, {
      headers: { Authorization: `Bearer ${account.accessToken}` },
      timeout: 8000,
    })
    .catch(() => {});
}

type Verified = { user: User; accessToken: string; refreshToken: string };

const statusOf = (e: unknown) => (axios.isAxiosError(e) ? e.response?.status : undefined);

async function fetchProfile(accessToken: string): Promise<User | null> {
  const res = await axios.get('/api/v1/users/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 10000,
  });
  const fresh = res.data;
  return fresh?.id ? (fresh as User) : null;
}

/** 저장된 토큰이 아직 쓸 만한지 — 접속 토큰(30일)으로 프로필을 묻고, 401 이면 새로고침 토큰(60일)으로 한 번 갱신 */
async function verifyAccount(account: SavedAccount): Promise<Verified | 'expired' | 'offline'> {
  try {
    const fresh = await fetchProfile(account.accessToken);
    return { user: fresh ? { ...account.user, ...fresh } : account.user, accessToken: account.accessToken, refreshToken: account.refreshToken };
  } catch (e) {
    if (statusOf(e) !== 401) return 'offline';
  }
  let accessToken: string;
  let refreshToken: string;
  try {
    const res = await axios.post('/api/v1/auth/refresh', { refreshToken: account.refreshToken }, { timeout: 15000 });
    const tokens = res.data?.tokens;
    if (!tokens?.accessToken) return 'expired';
    accessToken = tokens.accessToken;
    refreshToken = tokens.refreshToken || account.refreshToken;
  } catch (e) {
    const status = statusOf(e);
    return status === 401 || status === 403 ? 'expired' : 'offline';
  }
  try {
    const fresh = await fetchProfile(accessToken);
    return { user: fresh ? { ...account.user, ...fresh } : account.user, accessToken, refreshToken };
  } catch (e) {
    // 갱신은 됐는데도 401 = 정지·탈퇴된 계정
    if (statusOf(e) === 401) return 'expired';
    return { user: account.user, accessToken, refreshToken };
  }
}

export type SwitchResult = 'ok' | 'current' | 'missing' | 'expired' | 'offline' | 'busy';

let switching = false;

/** 저장된 계정으로 바꾸기 — 성공하면 `to`(기본 /my)로 페이지를 새로 연다 */
export async function switchAccount(id: string, options: { to?: string } = {}): Promise<SwitchResult> {
  if (switching) return 'busy';
  const account = useAccountsStore.getState().accounts.find((a) => a.id === id);
  if (!account) return 'missing';
  if (useAuthStore.getState().user?.id === id) return 'current';
  switching = true;
  try {
    rememberCurrentAccount(); // 떠나는 계정의 마지막 토큰부터 챙긴다
    const verified = await verifyAccount(account);
    if (verified === 'expired') {
      useAccountsStore.getState().forget(id);
      return 'expired';
    }
    if (verified === 'offline') return 'offline';
    if (verified.user.id !== id) useAccountsStore.getState().forget(id); // 다른 계정에 합쳐진 계정
    useAuthStore.getState().setAuth(verified.user, verified.accessToken, verified.refreshToken);
    useAccountsStore.getState().upsert(verified.user, verified.accessToken, verified.refreshToken);
    try { localStorage.setItem('userRole', verified.user.role || 'general'); } catch {}
    window.dispatchEvent(new CustomEvent('freetiful:auth-changed', { detail: { user: verified.user } }));
    // 푸시 다시 묶기(네이티브 OneSignal.login)는 providers 의 토큰 구독이 바로 보낸다 — 그 뒤 새로 연다
    window.setTimeout(() => window.location.replace(options.to || '/my'), 150);
    return 'ok';
  } finally {
    switching = false;
  }
}

/* ── '계정 추가' 표식 — 로그인하러 다녀오는 동안(카카오·네이버 다녀오기 · 네이티브 시트) 탭 안에 남긴다.
 *    추가하는 동안 지금 계정은 로그인된 채로 둔다(취소하면 그대로) — 새 계정 로그인이 끝나야 setAuth 로 바뀐다. */
const ADDING_KEY = 'freetiful-accounts-adding';
const ADDING_TTL_MS = 30 * 60 * 1000;
type AddingMarker = { from: string; tail: string; at: number };

export function markAddingAccount() {
  const { user, accessToken } = useAuthStore.getState();
  if (!user?.id || !accessToken) return;
  try {
    sessionStorage.setItem(ADDING_KEY, JSON.stringify({ from: user.id, tail: accessToken.slice(-16), at: Date.now() } satisfies AddingMarker));
  } catch {}
}

export function readAddingMarker(): AddingMarker | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(ADDING_KEY);
    if (!raw) return null;
    const marker = JSON.parse(raw) as AddingMarker;
    if (!marker?.from || Date.now() - Number(marker.at) > ADDING_TTL_MS) {
      sessionStorage.removeItem(ADDING_KEY);
      return null;
    }
    return marker;
  } catch {
    return null;
  }
}

export function clearAddingMarker() {
  try { sessionStorage.removeItem(ADDING_KEY); } catch {}
}

/** 계정 추가를 마무리 — 다른 계정이 들어왔으면 'added', 같은 계정으로 다시 로그인했으면 'same', 그대로면 'canceled' */
export function settleAddingAccount(): { result: 'added' | 'same' | 'canceled'; name?: string } | null {
  const marker = readAddingMarker();
  if (!marker) return null;
  if (window.location.pathname.startsWith('/auth/')) return null; // 로그인 처리 중
  const { user, accessToken } = useAuthStore.getState();
  if (!user) return null; // 로그인 창이 떠 있는 중
  clearAddingMarker();
  if (user.id !== marker.from) return { result: 'added', name: user.name };
  if (accessToken && !accessToken.endsWith(marker.tail)) return { result: 'same', name: user.name };
  return { result: 'canceled' };
}

/* ── 줄 표시 ───────────────────────────────────────────────── */
const ROLE_LABEL: Record<string, string> = { pro: '사회자', admin: '관리자', business: '업체' };
const PROVIDER_LABEL: Record<string, string> = { kakao: '카카오', naver: '네이버', google: '구글', apple: '애플' };

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return phone;
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

/** '사회자 · 카카오 로그인' / '일반 회원 · me@mail.com' / '일반 회원 · 010-****-1234' */
export function accountSubLabel(user: User) {
  const role = ROLE_LABEL[user.role] || '일반 회원';
  const email = String(user.email || '').trim();
  const synthetic = email.match(/^(kakao|naver|google|apple)_[^@]+@(kakao|naver|google|apple)\.freetiful\.com$/i);
  const via = synthetic
    ? `${PROVIDER_LABEL[synthetic[1].toLowerCase()]} 로그인`
    : email || (user.phone ? maskPhone(user.phone) : '');
  return via ? `${role} · ${via}` : role;
}
