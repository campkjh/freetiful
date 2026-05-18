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

function deriveCredentials(provider: NativeProvider, providerId: string) {
  return {
    email: `${provider}_${providerId}@${provider}.freetiful.com`,
    password: `${provider}_${providerId}_freetiful_oauth_v1`,
  };
}

/**
 * 네이티브 SDK 가 accessToken 없이 providerId 만 전달하는 케이스용 폴백.
 * 백엔드 emailLogin/emailRegister 가 'kakao_{id}@kakao.freetiful.com' 패턴을 감지해
 * 기존 카카오 native 계정으로 라우팅 (새 synthetic 계정 생성 안 함).
 */
async function loginWithDerivedAccount(
  provider: NativeProvider,
  providerId: string,
  name: string,
): Promise<LoginResponse> {
  const { email, password } = deriveCredentials(provider, providerId);
  try {
    return await authApi.emailLogin(email, password);
  } catch {
    return await authApi.emailRegister({ email, password, name });
  }
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

  // KakaoTalk 앱이 빈 params 로 deeplink 복귀하는 케이스 — 이미 인증된 토큰이 localStorage 에 있으면 그걸로 /main 이동
  if (typeof window !== 'undefined') {
    try {
      const stored = useAuthStore.getState();
      if (stored.accessToken && stored.user) {
        options?.onStatus?.('로그인 완료 중...');
        const target = normalizeAuthReturnTo(returnTo || consumeAuthReturnTo('/main'), '/main');
        window.location.replace(target);
        return;
      }
    } catch {}
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
      // 폴백: kakaoId 만 받은 경우 derive credentials 로 emailLogin 시도
      // 백엔드가 합성 이메일 패턴 감지 시 기존 native 카카오 유저로 라우팅 (새 계정 생성 X)
      const kakaoId = firstParam(params, ['kakaoId', 'id', 'userId']);
      if (kakaoId) {
        options?.onStatus?.('계정 연결 중...');
        try {
          data = await loginWithDerivedAccount(
            'kakao',
            kakaoId,
            firstParam(params, ['name', 'nickname']) || '카카오 사용자',
          );
        } catch (e) {
          // 최후 폴백: home 으로
          options?.onStatus?.('로그인 화면으로 돌아갑니다...');
          if (typeof window !== 'undefined') window.location.replace('/main');
          return;
        }
      } else {
        options?.onStatus?.('로그인 화면으로 돌아갑니다...');
        if (typeof window !== 'undefined') window.location.replace('/main');
        return;
      }
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
      // 폴백: naverId 만 받은 경우 derive credentials 로 emailLogin 시도
      const naverId = firstParam(params, ['naverId', 'id', 'userId']);
      if (naverId) {
        options?.onStatus?.('계정 연결 중...');
        try {
          data = await loginWithDerivedAccount(
            'naver',
            naverId,
            firstParam(params, ['name', 'nickname']) || '네이버 사용자',
          );
        } catch (e) {
          options?.onStatus?.('로그인 화면으로 돌아갑니다...');
          if (typeof window !== 'undefined') window.location.replace('/main');
          return;
        }
      } else {
        options?.onStatus?.('로그인 화면으로 돌아갑니다...');
        if (typeof window !== 'undefined') window.location.replace('/main');
        return;
      }
    }
  }

  if (provider === 'google') {
    const idToken = firstParam(params, ['idToken', 'id_token', 'identityToken', 'token', 'googleIdToken']);
    if (idToken) {
      data = await authApi.googleLogin(idToken);
    } else {
      const googleId = firstParam(params, ['googleId', 'id', 'userId']);
      if (googleId) {
        options?.onStatus?.('계정 연결 중...');
        try {
          data = await loginWithDerivedAccount(
            'google',
            googleId,
            firstParam(params, ['name', 'displayName']) || '구글 사용자',
          );
        } catch (e) {
          options?.onStatus?.('로그인 화면으로 돌아갑니다...');
          if (typeof window !== 'undefined') window.location.replace('/main');
          return;
        }
      } else {
        options?.onStatus?.('로그인 화면으로 돌아갑니다...');
        if (typeof window !== 'undefined') window.location.replace('/main');
        return;
      }
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
      const appleId = firstParam(params, ['appleUserId', 'appleId', 'id', 'userId']);
      if (appleId) {
        options?.onStatus?.('계정 연결 중...');
        try {
          data = await loginWithDerivedAccount(
            'apple',
            appleId,
            firstParam(params, ['fullName', 'name']) || 'Apple 사용자',
          );
        } catch (e) {
          options?.onStatus?.('로그인 화면으로 돌아갑니다...');
          if (typeof window !== 'undefined') window.location.replace('/main');
          return;
        }
      } else {
        options?.onStatus?.('로그인 화면으로 돌아갑니다...');
        if (typeof window !== 'undefined') window.location.replace('/main');
        return;
      }
    }
  }

  if (!data) throw new Error('소셜 로그인 응답을 처리하지 못했습니다.');

  options?.onStatus?.('로그인 완료 중...');
  await completeNativeLogin(data, { returnTo });
}
