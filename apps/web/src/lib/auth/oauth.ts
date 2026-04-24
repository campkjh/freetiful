import toast from 'react-hot-toast';

type Provider = 'kakao' | 'naver' | 'google';
const AUTH_RETURN_TO_KEY = 'freetiful-auth-return-to';

export function normalizeAuthReturnTo(value: string | null | undefined, fallback = '/main') {
  if (!value) return fallback;
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://freetiful.co.kr';
    const raw = value.startsWith('http') ? new URL(value).pathname + new URL(value).search + new URL(value).hash : value;
    if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
    const pathname = raw.split(/[?#]/)[0] || '/';
    if (pathname === '/') return '/main';
    if (pathname.startsWith('/auth') || pathname.startsWith('/api') || pathname.startsWith('/_next')) return fallback;
    if (value.startsWith('http') && new URL(value).origin !== origin) return fallback;
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

export function startOAuth(provider: Provider) {
  if (typeof window === 'undefined') return;

  rememberAuthReturnTo();
  const origin = window.location.origin;
  const w = window as any;
  const ios = w?.webkit?.messageHandlers as Record<string, { postMessage: (msg: object) => void } | undefined> | undefined;
  const and = w?.Android as Record<string, (() => void) | undefined> | undefined;

  if (provider === 'kakao') {
    if (ios?.kakaoLogin) { ios.kakaoLogin.postMessage({}); return; }
    if (and?.kakaoLogin) { and.kakaoLogin(); return; }
    const key = 'dca1b472188890116c81a55eff590885';
    window.location.href = `https://kauth.kakao.com/oauth/authorize?client_id=${key}&redirect_uri=${encodeURIComponent(origin + '/auth/kakao/callback')}&response_type=code`;
    return;
  }

  if (provider === 'naver') {
    if (ios?.naverLogin) { ios.naverLogin.postMessage({}); return; }
    if (and?.naverLogin) { and.naverLogin(); return; }
    const key = 'R4WM7ZyC8hHuE_O7qLdy';
    const state = Math.random().toString(36).substring(7);
    sessionStorage.setItem('naver_state', state);
    window.location.href = `https://nid.naver.com/oauth2.0/authorize?client_id=${key}&redirect_uri=${encodeURIComponent(origin + '/auth/naver/callback')}&response_type=code&state=${state}`;
    return;
  }

  if (ios?.googleLogin) { ios.googleLogin.postMessage({}); return; }
  if (and?.googleLogin) { and.googleLogin(); return; }
  toast.error('Google 웹 로그인은 현재 앱 로그인으로 연결됩니다. 카카오 또는 네이버로 로그인해주세요.');
}
