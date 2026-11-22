'use client';

// 송년회 2차 회식(261122 사장 '설문조사에 첫번째가 2차 회식 참여 여부 — https://naver.me/58N6jsaj 지도가 나오게끔 · 현 위치로부터 네비게이션 마냥').
// 장소 · 길찾기 주소 · 거리 — 화면은 components/reception/AfterPartyPlace.tsx.
// 개인정보: 내 위치는 이 기기 안에서만 쓴다(지도 점 · 거리). 서버(우리 API · 정적 지도 프록시)로도, 바깥 지도 링크로도 보내지 않는다 —
//  길찾기 링크는 도착지만 넣고 출발지를 비워 두면 지도 앱이 현 위치에서 출발한다.
import { isAndroidAppShell } from '@/lib/app-links';
import { androidViewIntentUrl, isMobileDevice } from '@/lib/naver-map';

/** 2차 장소 — naver.me/58N6jsaj = map.naver.com/p/entry/place/1288496717(261122 확인) */
export const AFTER_PARTY_PLACE = {
  name: '청담항',
  address: '서울 강남구 영동대로138길 9 2층',
  jibun: '청담동 131-14',
  lat: 37.522929,
  lng: 127.0565744,
  naverPlaceId: '1288496717',
  /** 사장이 준 원래 링크(네이버 지도 장소 화면) */
  link: 'https://naver.me/58N6jsaj',
} as const;

export type RouteMode = 'public' | 'car' | 'walk';

export const ROUTE_MODES: ReadonlyArray<{ mode: RouteMode; label: string }> = [
  { mode: 'public', label: '대중교통' },
  { mode: 'car', label: '자동차' },
  { mode: 'walk', label: '도보' },
];

/** 네이버 지도 웹 길찾기 끝 칸(앱 nmap://route/{public|car|walk} 와 짝) */
const WEB_MODE: Record<RouteMode, string> = { public: 'transit', car: 'car', walk: 'walk' };

const APP_NAME = 'com.freetiful.web';
const NMAP_PACKAGE = 'com.nhn.android.nmap';

/** 네이버 지도 앱 길찾기 — 출발지(slat·slng)를 빼면 앱이 현 위치에서 출발한다 */
export function naverAppRouteUrl(mode: RouteMode): string {
  const p = new URLSearchParams({
    dlat: String(AFTER_PARTY_PLACE.lat),
    dlng: String(AFTER_PARTY_PLACE.lng),
    dname: AFTER_PARTY_PLACE.name,
    appname: APP_NAME,
  });
  return `nmap://route/${mode}?${p.toString()}`;
}

/**
 * 네이버 지도 웹 길찾기(도착지 채움, 출발지 빈칸 '-') — lib/naver-map-links naverMapRouteUrl 과 같은 꼴(헤드리스 크롬 실측 261012).
 * PC = 도착지가 채워진 길찾기, 휴대폰 = launchApp 을 거쳐 네이버 '빠른길찾기'(앱이 있으면 앱).
 */
export function naverWebRouteUrl(mode: RouteMode): string {
  const { lat, lng, name } = AFTER_PARTY_PLACE;
  return `https://map.naver.com/p/directions/-/${lng.toFixed(6)},${lat.toFixed(6)},${encodeURIComponent(name)},,/-/${WEB_MODE[mode]}`;
}

/** 안드로이드 브라우저(크롬 · 삼성 인터넷) — 네이버 지도 앱을 intent 로 부르고, 앱이 없으면 브라우저가 웹 길찾기로 간다(타이머 필요 없음) */
export function naverAndroidIntentUrl(mode: RouteMode): string {
  const app = naverAppRouteUrl(mode).replace(/^nmap:\/\//, '');
  return `intent://${app}#Intent;scheme=nmap;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=${NMAP_PACKAGE};S.browser_fallback_url=${encodeURIComponent(naverWebRouteUrl(mode))};end`;
}

/** 카카오맵 웹 길찾기 — 도착지만(출발 = 현 위치). 휴대폰에선 카카오맵이 앱으로 넘겨 준다 */
export function kakaoRouteUrl(): string {
  const { lat, lng, name } = AFTER_PARTY_PLACE;
  return `https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lng}`;
}

/** 프리티풀 아이폰 앱(WKWebView 메시지 다리) — lib/landing-track visitPlatform 과 같은 판별 */
export function isIosAppShell(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as unknown as { webkit?: { messageHandlers?: unknown } }).webkit?.messageHandlers;
}

const isAndroidBrowser = () => typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '') && !isAndroidAppShell();

/** 안드로이드 앱 2.0.6 이하 — 위치 권한 창(onGeolocationPermissionsShowPrompt)이 없어 위치 요청이 답 없이 끝난다(채팅 ChatExtras 와 같은 판별) */
export function androidAppWithoutGeolocation(): boolean {
  if (typeof window === 'undefined') return false;
  const bridge = (window as unknown as { Android?: Record<string, unknown> }).Android;
  return !!bridge && typeof bridge.supportsGeolocation !== 'function';
}

/**
 * 네이버 지도 길찾기 누름 — 기기마다 길이 다르다.
 *  · PC: 아무것도 안 함(링크 기본 = 새 창 웹 길찾기) → 'link'
 *  · 안드로이드 프리티풀 앱: 웹뷰가 nmap:// 를 못 연다 → 웹 길찾기를 intent:// 로 감싸 바깥(브라우저 · 네이버 지도 앱)으로 → 'web'
 *  · 안드로이드 브라우저: intent(앱 → 없으면 웹) → 'app'
 *  · 아이폰(사파리 · 프리티풀 앱) 등: nmap:// 를 열어 보고 1.4초 안에 화면이 안 숨으면 앱이 없는 것 → onMissing.
 *    사파리는 웹 길찾기로 넘어간다. 프리티풀 아이폰 앱은 스크립트 이동이 앱 화면을 남의 사이트로 바꾸므로 넘기지 않고 onMissing 만
 *    (화면이 '웹에서 길찾기' 링크를 보여 주고, 손님이 누르면 인앱 사파리로 열린다).
 *    앱 묻는 창 등으로 창이 흐려졌으면(blur) 넘기지 않는다 — 손님이 고르는 중.
 */
export function openNaverRoute(mode: RouteMode, e: { preventDefault(): void }, onMissing?: () => void): 'link' | 'web' | 'app' {
  if (typeof window === 'undefined') return 'link';
  const web = naverWebRouteUrl(mode);
  if (isAndroidAppShell()) {
    e.preventDefault();
    try { window.location.href = androidViewIntentUrl(web); } catch { /* 주소를 못 만들면 그대로 */ }
    return 'web';
  }
  if (!isMobileDevice()) return 'link';
  e.preventDefault();
  if (isAndroidBrowser()) {
    window.location.href = naverAndroidIntentUrl(mode);
    return 'app';
  }
  tryAppThenWeb(naverAppRouteUrl(mode), web, { autoWeb: !isIosAppShell(), onMissing });
  return 'app';
}

/** 앱 스킴을 열어 보고, waitMs 안에 화면이 안 숨으면(앱 없음) onMissing → autoWeb 이면 웹 주소로 */
export function tryAppThenWeb(appUrl: string, webUrl: string, opts: { autoWeb: boolean; onMissing?: () => void; waitMs?: number }) {
  let left = false;
  let blurred = false;
  const onVis = () => { if (document.visibilityState === 'hidden') left = true; };
  const onHide = () => { left = true; };
  const onBlur = () => { blurred = true; };
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('pagehide', onHide);
  window.addEventListener('blur', onBlur);
  const off = () => {
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('pagehide', onHide);
    window.removeEventListener('blur', onBlur);
  };
  const missing = () => {
    off();
    if (left) return;
    try { opts.onMissing?.(); } catch { /* 듣는 쪽 오류 무시 */ }
    if (opts.autoWeb && !blurred) window.location.href = webUrl;
  };
  const timer = window.setTimeout(missing, opts.waitMs ?? 1400);
  try {
    window.location.href = appUrl;
  } catch {
    window.clearTimeout(timer);
    missing();
  }
}

/** 두 점 직선거리(m) — 하버사인 */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371008.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 거리 글자 — 1km 아래는 10m 단위('350m'), 위는 소수 한 자리('1.2km', 10km 넘으면 정수) */
export function formatDistance(m: number): string {
  if (!Number.isFinite(m) || m < 0) return '';
  const r = Math.round(m / 10) * 10;
  if (r < 1000) return `${Math.max(10, r)}m`;
  const km = m / 1000;
  return km >= 10 ? `${Math.round(km)}km` : `${km.toFixed(1)}km`;
}
