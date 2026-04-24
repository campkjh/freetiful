import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/store/auth.store';
import { syncPushRegistration } from '@/lib/utils/push';
import type { LoginResponse } from '@prettyful/types';

type Provider = 'kakao' | 'naver' | 'google';
const AUTH_RETURN_TO_KEY = 'freetiful-auth-return-to';
const DEFAULT_WEB_ORIGIN = 'https://freetiful.com';
const KAKAO_JS_KEY = 'dca1b472188890116c81a55eff590885';

type KakaoSdk = {
  init: (key: string) => void;
  isInitialized?: () => boolean;
  Auth: {
    login: (options: {
      success: (auth: { access_token?: string }) => void;
      fail: (error: unknown) => void;
    }) => void;
    getAccessToken?: () => string | null;
  };
};

function normalizeOrigin(value: string | null | undefined) {
  return value?.replace(/\/+$/, '') || '';
}

export function getOAuthOrigin() {
  const configured = normalizeOrigin(process.env.NEXT_PUBLIC_WEB_URL || process.env.NEXT_PUBLIC_APP_URL);
  if (configured) return configured;
  if (typeof window === 'undefined') return DEFAULT_WEB_ORIGIN;

  const origin = normalizeOrigin(window.location.origin);
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
  const isPreview = window.location.hostname.endsWith('.vercel.app');
  return isLocal || isPreview ? origin : origin.replace('://www.', '://');
}

export function getOAuthRedirectUri(provider: Exclude<Provider, 'google'>) {
  return `${getOAuthOrigin()}/auth/${provider}/callback`;
}

export function normalizeAuthReturnTo(value: string | null | undefined, fallback = '/main') {
  if (!value) return fallback;
  try {
    const origin = typeof window !== 'undefined' ? normalizeOrigin(window.location.origin) : DEFAULT_WEB_ORIGIN;
    const allowedOrigins = new Set([origin, origin.replace('://www.', '://'), getOAuthOrigin()]);
    const raw = value.startsWith('http') ? new URL(value).pathname + new URL(value).search + new URL(value).hash : value;
    if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
    const pathname = raw.split(/[?#]/)[0] || '/';
    if (pathname === '/') return '/main';
    if (pathname.startsWith('/auth') || pathname.startsWith('/api') || pathname.startsWith('/_next')) return fallback;
    if (value.startsWith('http') && !allowedOrigins.has(normalizeOrigin(new URL(value).origin))) return fallback;
    return raw;
  } catch {
    return fallback;
  }
}

export function rememberAuthReturnTo(value?: string) {
  if (typeof window === 'undefined') return;
  const current = value ?? `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const safePath = normalizeAuthReturnTo(current);
  try {
    sessionStorage.setItem(AUTH_RETURN_TO_KEY, safePath);
    localStorage.setItem(AUTH_RETURN_TO_KEY, safePath);
  } catch {}
}

export function consumeAuthReturnTo(fallback = '/main') {
  if (typeof window === 'undefined') return fallback;
  let value: string | null = null;
  try {
    value = sessionStorage.getItem(AUTH_RETURN_TO_KEY) || localStorage.getItem(AUTH_RETURN_TO_KEY);
    sessionStorage.removeItem(AUTH_RETURN_TO_KEY);
    localStorage.removeItem(AUTH_RETURN_TO_KEY);
  } catch {}
  return normalizeAuthReturnTo(value, fallback);
}

function getKakaoSdk() {
  const kakao = (window as unknown as { Kakao?: KakaoSdk }).Kakao;
  if (!kakao?.Auth?.login) return null;
  if (!kakao.isInitialized?.()) kakao.init(KAKAO_JS_KEY);
  return kakao;
}

async function completeNativeOAuthLogin(provider: 'kakao' | 'naver', accessToken: string) {
  const res = await fetch(`/api/v1/auth/login/${provider}/native`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken }),
  });
  const data = (await res.json().catch(() => null)) as LoginResponse | { message?: string } | null;
  if (!res.ok || !data || !('tokens' in data) || !('user' in data)) {
    throw new Error((data as { message?: string } | null)?.message || 'Social login failed');
  }
  useAuthStore.getState().setAuth(data.user, data.tokens.accessToken, data.tokens.refreshToken);
  void syncPushRegistration(data.user.id);
  window.location.replace(consumeAuthReturnTo('/main'));
}

function startKakaoSdkLogin() {
  const kakao = getKakaoSdk();
  if (!kakao) return false;

  kakao.Auth.login({
    success: (auth) => {
      const accessToken = auth.access_token || kakao.Auth.getAccessToken?.();
      if (!accessToken) {
        toast.error('카카오 로그인 토큰을 받지 못했습니다.');
        return;
      }
      void completeNativeOAuthLogin('kakao', accessToken).catch((error) => {
        console.error('[auth] kakao native token login failed', error);
        toast.error('카카오 로그인에 실패했습니다.');
      });
    },
    fail: (error) => {
      console.warn('[auth] kakao sdk login failed', error);
      toast.error('카카오 로그인이 취소되었거나 실패했습니다.');
    },
  });
  return true;
}

export function startOAuth(provider: Provider) {
  if (typeof window === 'undefined') return;

  rememberAuthReturnTo();
  const w = window as any;
  const ios = w?.webkit?.messageHandlers as Record<string, { postMessage: (msg: object) => void } | undefined> | undefined;
  const and = w?.Android as Record<string, (() => void) | undefined> | undefined;

  if (provider === 'kakao') {
    if (ios?.kakaoLogin) { ios.kakaoLogin.postMessage({}); return; }
    if (and?.kakaoLogin) { and.kakaoLogin(); return; }
    if (startKakaoSdkLogin()) return;
    const key = KAKAO_JS_KEY;
    window.location.href = `https://kauth.kakao.com/oauth/authorize?client_id=${key}&redirect_uri=${encodeURIComponent(getOAuthRedirectUri('kakao'))}&response_type=code`;
    return;
  }

  if (provider === 'naver') {
    if (ios?.naverLogin) { ios.naverLogin.postMessage({}); return; }
    if (and?.naverLogin) { and.naverLogin(); return; }
    const key = 'cnaly_pSLgjMyP3Itds_';
    const state = Math.random().toString(36).substring(7);
    sessionStorage.setItem('naver_state', state);
    window.location.href = `https://nid.naver.com/oauth2.0/authorize?client_id=${key}&redirect_uri=${encodeURIComponent(getOAuthRedirectUri('naver'))}&response_type=code&state=${state}`;
    return;
  }

  if (ios?.googleLogin) { ios.googleLogin.postMessage({}); return; }
  if (and?.googleLogin) { and.googleLogin(); return; }
  toast.error('Google 웹 로그인은 현재 앱 로그인으로 연결됩니다. 카카오 또는 네이버로 로그인해주세요.');
}
