'use client';

import type { LoginResponse, User } from '@prettyful/types';
import { authApi } from '@/lib/api/auth.api';
import { usersApi } from '@/lib/api/users.api';
import {
  consumeAuthReturnTo,
  getOAuthOrigin,
  normalizeAuthReturnTo,
} from '@/lib/auth/oauth';
import { useAuthStore } from '@/lib/store/auth.store';
import { syncPushRegistration } from '@/lib/utils/push';

type NativeProvider = 'kakao' | 'naver' | 'google' | 'apple';
type SearchParamReader = Pick<URLSearchParams, 'get'>;
type NativeBridgePayload = Record<string, unknown>;

type NativeLoginPayload = {
  user?: User;
  tokens?: {
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
  };
  accessToken?: string;
  refreshToken?: string;
  isNewUser?: boolean;
  needsPhone?: boolean;
  returnTo?: string;
  state?: {
    user?: User;
    accessToken?: string;
    refreshToken?: string;
  };
};

declare global {
  interface Window {
    FreetifulAuth?: {
      __installed?: boolean;
      completeLogin?: (payload: NativeLoginPayload | string) => Promise<void>;
    };
    freetifulCompleteLogin?: (payload: NativeLoginPayload | string) => Promise<void>;
  }
}

function firstParam(params: SearchParamReader, keys: string[]) {
  for (const key of keys) {
    const value = params.get(key);
    if (value) return value;
  }
  return '';
}

function parseJsonValue<T = any>(value: string) {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    try {
      return JSON.parse(decodeURIComponent(value)) as T;
    } catch {
      return null;
    }
  }
}

function looksLikeJwt(token: string) {
  return token.split('.').length === 3;
}

function normalizeUser(value: any): User | null {
  if (!value || typeof value !== 'object' || !value.id) return null;
  return {
    id: String(value.id),
    role: value.role || 'general',
    name: value.name || value.nickname || '사용자',
    phone: value.phone ?? null,
    email: value.email ?? null,
    profileImageUrl: value.profileImageUrl || value.profile_image_url || value.picture || null,
    referralCode: value.referralCode || '',
    pointBalance: Number(value.pointBalance || 0),
    isActive: value.isActive !== false,
    createdAt: value.createdAt || new Date().toISOString(),
  };
}

function userFromParams(params: SearchParamReader) {
  const rawUser = firstParam(params, ['user', 'userJSON', 'user_json', 'userInfo', 'profile']);
  const parsed = rawUser ? normalizeUser(parseJsonValue(rawUser)) : null;
  if (parsed) return parsed;

  const id = firstParam(params, ['appUserId', 'userId', 'uid']);
  if (!id) return null;

  return normalizeUser({
    id,
    role: firstParam(params, ['role']) || 'general',
    name: firstParam(params, ['name', 'nickname', 'displayName']) || '사용자',
    email: firstParam(params, ['email']) || null,
    phone: firstParam(params, ['phone']) || null,
    profileImageUrl: firstParam(params, ['profileImageUrl', 'profile_image_url', 'photoUrl', 'picture']) || null,
  });
}

async function sessionFromCallbackParams(params: SearchParamReader): Promise<LoginResponse | null> {
  const tokenJson = parseJsonValue<{ accessToken?: string; refreshToken?: string; expiresIn?: number }>(
    firstParam(params, ['tokens', 'authTokens', 'auth', 'session']),
  );
  const accessToken =
    tokenJson?.accessToken ||
    firstParam(params, ['appAccessToken', 'jwt', 'jwtToken', 'accessJwt']) ||
    firstParam(params, ['accessToken']);
  const refreshToken =
    tokenJson?.refreshToken ||
    firstParam(params, ['appRefreshToken', 'refreshJwt']) ||
    firstParam(params, ['refreshToken']);

  if (!accessToken || !refreshToken) return null;

  const explicitAppSession =
    Boolean(tokenJson) ||
    Boolean(firstParam(params, ['appAccessToken', 'jwt', 'jwtToken', 'accessJwt', 'appRefreshToken', 'refreshJwt'])) ||
    Boolean(firstParam(params, ['user', 'userJSON', 'user_json', 'userInfo', 'profile'])) ||
    looksLikeJwt(accessToken);

  if (!explicitAppSession) return null;

  let user = userFromParams(params);
  if (!user && looksLikeJwt(accessToken)) {
    try {
      useAuthStore.getState().setTokens(accessToken, refreshToken);
      user = await authApi.me();
    } catch {
      useAuthStore.getState().logout();
      return null;
    }
  }

  if (!user) return null;

  return {
    user,
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: tokenJson?.expiresIn || Number(firstParam(params, ['expiresIn'])) || 0,
    },
    isNewUser: firstParam(params, ['isNewUser']) === 'true',
    needsPhone: firstParam(params, ['needsPhone']) === 'true',
  };
}

function getMobileRedirectUri(provider: Extract<NativeProvider, 'kakao' | 'naver'>) {
  return `${getOAuthOrigin()}/auth/${provider}/mobile`;
}


function parseBridgePayload(payload: NativeLoginPayload | string): NativeLoginPayload | null {
  if (!payload) return null;
  if (typeof payload !== 'string') return payload;

  try {
    return JSON.parse(payload) as NativeLoginPayload;
  } catch {
    return null;
  }
}

function callNativeBridgeMethod(
  target: unknown,
  methodNames: string[],
  payload: NativeBridgePayload,
) {
  if (!target || typeof target !== 'object') return false;
  const bridge = target as Record<string, unknown>;
  const message = JSON.stringify(payload);

  for (const methodName of methodNames) {
    const method = bridge[methodName];
    if (typeof method !== 'function') continue;

    try {
      method.call(bridge, message);
      return true;
    } catch {
      try {
        method.call(bridge);
        return true;
      } catch {}
    }
  }

  return false;
}

export function requestNativeLoginSheet(payload: NativeBridgePayload = {}) {
  if (typeof window === 'undefined') return false;

  const win = window as Window & {
    webkit?: {
      messageHandlers?: Record<string, { postMessage?: (message: unknown) => void } | undefined>;
    };
    Android?: unknown;
    FreetifulAndroid?: unknown;
    ReactNativeWebView?: { postMessage?: (message: string) => void };
  };

  const iosBridge = win.webkit?.messageHandlers?.showNativeLogin;
  if (typeof iosBridge?.postMessage === 'function') {
    iosBridge.postMessage(payload);
    return true;
  }

  const androidMethodNames = ['showNativeLogin', 'showLogin', 'openLogin', 'login'];
  if (callNativeBridgeMethod(win.Android, androidMethodNames, payload)) return true;
  if (callNativeBridgeMethod(win.FreetifulAndroid, androidMethodNames, payload)) return true;

  if (typeof win.ReactNativeWebView?.postMessage === 'function') {
    win.ReactNativeWebView.postMessage(JSON.stringify({ type: 'showNativeLogin', ...payload }));
    return true;
  }

  return false;
}

function normalizeLoginPayload(payload: NativeLoginPayload | string): LoginResponse | null {
  const parsed = parseBridgePayload(payload);
  if (!parsed) return null;

  const user = parsed.user || parsed.state?.user;
  const accessToken =
    parsed.tokens?.accessToken ||
    parsed.accessToken ||
    parsed.state?.accessToken;
  const refreshToken =
    parsed.tokens?.refreshToken ||
    parsed.refreshToken ||
    parsed.state?.refreshToken;

  if (!user || !accessToken || !refreshToken) return null;

  return {
    user,
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: parsed.tokens?.expiresIn || 0,
    },
    isNewUser: Boolean(parsed.isNewUser),
    needsPhone: Boolean(parsed.needsPhone),
  };
}

export async function completeNativeLogin(
  data: LoginResponse,
  options?: { returnTo?: string | null },
) {
  const { user, tokens } = data;
  useAuthStore.getState().setAuth(user, tokens.accessToken, tokens.refreshToken);

  try {
    sessionStorage.removeItem('freetiful-auth-switching');
    localStorage.setItem('userRole', user.role || 'general');
  } catch {}

  void syncPushRegistration(user.id);
  window.dispatchEvent(new CustomEvent('freetiful:auth-changed', { detail: { user } }));

  const destination = normalizeAuthReturnTo(options?.returnTo || consumeAuthReturnTo('/main'));
  window.setTimeout(() => {
    window.location.replace(destination);
  }, 30);
}

export function restoreNativeAuthFromStorage() {
  if (typeof window === 'undefined') return false;

  const current = useAuthStore.getState();
  if (current.user && current.accessToken && current.refreshToken) return true;

  try {
    const raw = localStorage.getItem('prettyful-auth');
    if (!raw) return false;

    const data = normalizeLoginPayload(JSON.parse(raw) as NativeLoginPayload);
    if (!data) return false;

    useAuthStore.getState().setAuth(data.user, data.tokens.accessToken, data.tokens.refreshToken);
    localStorage.setItem('userRole', data.user.role || 'general');
    void syncPushRegistration(data.user.id);
    return true;
  } catch {
    return false;
  }
}

export function installNativeAuthBridge() {
  if (typeof window === 'undefined') return;
  restoreNativeAuthFromStorage();
  if (window.FreetifulAuth?.__installed) return;

  const completeLogin = async (payload: NativeLoginPayload | string) => {
    const data = normalizeLoginPayload(payload);
    const parsed = parseBridgePayload(payload);
    if (!data) throw new Error('Invalid native login payload');
    await completeNativeLogin(data, { returnTo: parsed?.returnTo });
  };

  window.FreetifulAuth = {
    ...(window.FreetifulAuth || {}),
    __installed: true,
    completeLogin,
  };
  window.freetifulCompleteLogin = completeLogin;

  const reconcile = () => restoreNativeAuthFromStorage();
  window.addEventListener('pageshow', reconcile);
  window.addEventListener('focus', reconcile);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') reconcile();
  });
}

export async function loginFromNativeCallback(
  provider: NativeProvider,
  params: SearchParamReader,
  options?: { onStatus?: (status: string) => void },
) {
  const returnTo = firstParam(params, ['returnTo', 'redirectTo', 'redirect']);
  let data: LoginResponse | null = null;

  options?.onStatus?.('소셜 계정 확인 중...');

  const existingSession = await sessionFromCallbackParams(params);
  if (existingSession) {
    options?.onStatus?.('로그인 완료 중...');
    await completeNativeLogin(existingSession, { returnTo });
    return;
  }

  if (provider === 'kakao') {
    const accessToken = firstParam(params, [
      'accessToken',
      'access_token',
      'token',
      'oauthToken',
      'kakaoAccessToken',
    ]);
    if (accessToken) {
      data = await authApi.kakaoNativeLogin(accessToken);
    } else {
      const code = firstParam(params, ['code', 'authorizationCode']);
      if (code) {
        const redirectUri = firstParam(params, ['redirectUri', 'redirect_uri']) || getMobileRedirectUri('kakao');
        data = await authApi.kakaoLogin(code, redirectUri);
      }
    }

    if (!data) {
      options?.onStatus?.('카카오 로그인 창 여는 중...');
      if (typeof window !== 'undefined') {
        const w = window as any;
        const ios = w.webkit?.messageHandlers as any;
        const and = w.Android as any;
        // (1) 네이티브 브릿지 — sheet 띄우고 /main 으로 이동 (sheet 가 성공 시 localStorage 주입 후 페이지 갱신함)
        if (ios?.kakaoLogin?.postMessage) {
          ios.kakaoLogin.postMessage({});
          window.location.replace('/main');
          return;
        }
        if (typeof and?.kakaoLogin === 'function') {
          try { and.kakaoLogin(); } catch {}
          window.location.replace('/main');
          return;
        }
        // (2) 웹 — 카카오 OAuth code 플로우로 fallback
        const KAKAO_REST_KEY = 'dca1b472188890116c81a55eff590885';
        const redirectUri = `${window.location.origin}/auth/kakao/callback`;
        window.location.replace(
          `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_REST_KEY}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}` +
          `&response_type=code`,
        );
        return;
      }
      throw new Error('카카오 로그인 정보가 없습니다 (accessToken 필요).');
    }
  }

  if (provider === 'naver') {
    const accessToken = firstParam(params, [
      'accessToken',
      'access_token',
      'token',
      'oauthToken',
      'naverAccessToken',
    ]);
    if (accessToken) {
      data = await authApi.naverNativeLogin(accessToken);
    } else {
      const code = firstParam(params, ['code', 'authorizationCode']);
      const state = firstParam(params, ['state']);
      if (code && state) {
        const redirectUri = firstParam(params, ['redirectUri', 'redirect_uri']) || getMobileRedirectUri('naver');
        data = await authApi.naverLogin(code, state, redirectUri);
      }
    }

    if (!data) {
      options?.onStatus?.('네이버 로그인 창 여는 중...');
      if (typeof window !== 'undefined') {
        const w = window as any;
        const ios = w.webkit?.messageHandlers as any;
        const and = w.Android as any;
        if (ios?.naverLogin?.postMessage) { ios.naverLogin.postMessage({}); window.location.replace('/main'); return; }
        if (typeof and?.naverLogin === 'function') { try { and.naverLogin(); } catch {} window.location.replace('/main'); return; }
        const NAVER_KEY = 'R4WM7ZyC8hHuE_O7qLdy';
        const state = Math.random().toString(36).substring(7);
        try { sessionStorage.setItem('naver_state', state); } catch {}
        const redirectUri = `${window.location.origin}/auth/naver/callback`;
        window.location.replace(
          `https://nid.naver.com/oauth2.0/authorize?client_id=${NAVER_KEY}` +
          `&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${state}`,
        );
        return;
      }
      throw new Error('네이버 로그인 정보가 없습니다 (accessToken 또는 code+state 필요).');
    }
  }

  if (provider === 'google') {
    const idToken = firstParam(params, ['idToken', 'id_token', 'identityToken', 'token', 'googleIdToken']);
    if (idToken) {
      data = await authApi.googleLogin(idToken);
    } else {
      options?.onStatus?.('구글 로그인 창 여는 중...');
      if (typeof window !== 'undefined') {
        const w = window as any;
        const ios = w.webkit?.messageHandlers as any;
        const and = w.Android as any;
        if (ios?.googleLogin?.postMessage) { ios.googleLogin.postMessage({}); window.location.replace('/main'); return; }
        if (typeof and?.googleLogin === 'function') { try { and.googleLogin(); } catch {} window.location.replace('/main'); return; }
      }
      throw new Error('구글 로그인 정보가 없습니다 (idToken 필요).');
    }
  }

  if (provider === 'apple') {
    const identityToken = firstParam(params, ['identityToken', 'idToken', 'id_token', 'token']);
    if (identityToken) {
      data = await authApi.appleLogin(
        identityToken,
        firstParam(params, ['fullName', 'name']) || undefined,
      );
    } else {
      options?.onStatus?.('Apple 로그인 창 여는 중...');
      if (typeof window !== 'undefined') {
        const w = window as any;
        const ios = w.webkit?.messageHandlers as any;
        const and = w.Android as any;
        if (ios?.appleLogin?.postMessage) { ios.appleLogin.postMessage({}); window.location.replace('/main'); return; }
        if (typeof and?.appleLogin === 'function') { try { and.appleLogin(); } catch {} window.location.replace('/main'); return; }
      }
      throw new Error('Apple 로그인 정보가 없습니다 (identityToken 필요).');
    }
  }

  if (!data) throw new Error('소셜 로그인 응답을 처리하지 못했습니다.');

  options?.onStatus?.('로그인 완료 중...');
  await completeNativeLogin(data, { returnTo });
}
