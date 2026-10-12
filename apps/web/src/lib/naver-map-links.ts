/**
 * '네이버 지도에서 보기 · 길찾기' 주소 — 브라우저 · 아이폰 앱 · 안드로이드 앱(2.0.6) 어디서나 안전하게
 * (261012 사장 '네이버 다이나믹맵인데 이거 네이버 맵좀 전부 다 적용해줘').
 *
 * 헤드리스 크롬 실측(261012, scratchpad/nmap/urls.mjs):
 *  · 좌표 핀 — PC  : https://map.naver.com/p/search/<위도>,<경도> → entry/coordinates 로 바뀌며 그 자리에 핀 + 주소 칸. (모바일에선 '검색결과 없음')
 *              모바일: https://m.map.naver.com/map.naver?lat=&lng=&dlevel=&pinTitle=&pinType=site → 그 자리에 파란 핀(PC 에서도 열림 — 모바일 모양).
 *  · 이름·주소 검색 — PC: map.naver.com/p/search/<검색어>, 모바일: m.map.naver.com/search2/search.naver?query=<검색어>
 *              (map.naver.com/p/search 를 모바일로 열면 app.map.naver.com/launchApp 을 거쳐 앱을 먼저 부른다 — 모바일 주소는 바로 간다)
 *  · 길찾기 — map.naver.com/p/directions/-/<경도>,<위도>,<이름>,,/-/transit → PC 는 도착지가 채워진 길찾기,
 *              모바일은 launchApp 을 거쳐 네이버 '빠른길찾기'(도착지 채움) — 앱이 있으면 앱으로.
 *  · c=경도,위도,줌 꼴(/p?c=...)은 가운데만 옮기고 핀이 없다 — 쓰지 않는다.
 *
 * 앱 안에서:
 *  · 아이폰 앱(WKWebView) — 다른 사이트 링크는 인앱 사파리(SFSafariViewController)로 열린다(ViewController.swift). 그대로 둔다.
 *  · 안드로이드 앱 2.0.6 — https 링크를 웹뷰 안에서 열어 버려, 지도 웹이 nmap:// 같은 스킴을 열다 '웹페이지를 사용할 수 없음'이 날 수 있다.
 *    intent:// 만 밖으로 넘겨 주므로(MainActivity Intent.parseUri) https 주소를 intent://…#Intent;scheme=https;action=VIEW 로 감싸
 *    바깥 브라우저(또는 그 주소를 맡는 네이버 지도 앱)로 넘긴다 — chat/[id]/chat-location.ts androidIntentUrl 과 같은 꼴.
 *
 * SSR 과 첫 렌더가 어긋나지 않게 링크의 href 는 늘 '모바일 주소'(어디서나 열림)로 그리고, 누르는 순간(onClick) 기기에 맞는 주소로 바꾼다.
 */

import { isAndroidAppShell } from './app-links';

export type NaverMapPlace = {
  lat?: number | null;
  lng?: number | null;
  /** 장소 이름(핀 제목 · 길찾기 도착지 이름 · 좌표 없을 때 검색어) */
  name?: string | null;
  /** 주소(좌표 · 이름이 없을 때 검색어) */
  address?: string | null;
  /** 이 글자로 검색(좌표보다 먼저). 예: '빌라드지디 청담' — 장소 상세(리뷰·사진)를 보이고 싶을 때 */
  query?: string | null;
};

export type NaverMapDevice = 'mobile' | 'desktop' | 'auto';

const NAVER_DESKTOP = 'https://map.naver.com';
const NAVER_MOBILE = 'https://m.map.naver.com';

function validLatLng(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' && typeof lng === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

/** 주소 칸에 넣을 이름 — 쉼표 · 슬래시(길찾기 경로 구분자) · 줄바꿈 빼고 60자 */
function cleanName(s: unknown): string {
  return typeof s === 'string' ? s.replace(/[,/\\\n\r\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) : '';
}

/** 휴대폰·태블릿인가(아이패드OS 는 Mac 처럼 보이니 터치 점 수로) — 서버에선 false */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Android|iPhone|iPad|iPod|Mobile|Windows Phone/i.test(ua)) return true;
  return /Macintosh/.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1;
}

function resolveDevice(device: NaverMapDevice | undefined): 'mobile' | 'desktop' {
  if (device === 'mobile' || device === 'desktop') return device;
  // auto — 서버(기기 모름)에선 어디서나 열리는 모바일 주소
  if (typeof window === 'undefined') return 'mobile';
  return isMobileDevice() ? 'mobile' : 'desktop';
}

/**
 * 네이버 지도에서 이 장소 보기.
 *  · query 가 있으면 그 글자로 검색 · 좌표가 있으면 그 자리에 핀 · 아니면 이름(없으면 주소)으로 검색 · 아무것도 없으면 지도 첫 화면.
 *  · device: 'mobile'(기본 렌더용 — PC 에서도 열림) · 'desktop' · 'auto'(지금 기기, 서버에선 mobile)
 */
export function naverMapUrl(place: NaverMapPlace, opts: { device?: NaverMapDevice } = {}): string {
  const device = resolveDevice(opts.device ?? 'mobile');
  const query = cleanName(place.query);
  const name = cleanName(place.name);
  const address = typeof place.address === 'string' ? place.address.replace(/\s+/g, ' ').trim().slice(0, 100) : '';
  const lat = place.lat;
  const lng = place.lng;

  const search = (q: string) =>
    device === 'mobile'
      ? `${NAVER_MOBILE}/search2/search.naver?query=${encodeURIComponent(q)}`
      : `${NAVER_DESKTOP}/p/search/${encodeURIComponent(q)}`;

  if (query) return search(query);
  if (validLatLng(lat, lng)) {
    const la = Number(lat).toFixed(6);
    const ln = Number(lng).toFixed(6);
    if (device === 'desktop') return `${NAVER_DESKTOP}/p/search/${la},${ln}`;
    const p = new URLSearchParams({ lat: la, lng: ln, dlevel: '12', pinType: 'site' });
    if (name) p.set('pinTitle', name);
    return `${NAVER_MOBILE}/map.naver?${p.toString()}`;
  }
  if (name || address) return search(name || address);
  return device === 'mobile' ? `${NAVER_MOBILE}/` : `${NAVER_DESKTOP}/`;
}

/**
 * 네이버 지도 길찾기(도착지 = 이 장소, 대중교통). 좌표가 없으면 이름·주소 검색으로 대신(도착지를 정확히 못 박을 수 없어서).
 */
export function naverMapRouteUrl(place: NaverMapPlace, opts: { device?: NaverMapDevice } = {}): string {
  const lat = place.lat;
  const lng = place.lng;
  if (!validLatLng(lat, lng)) return naverMapUrl({ ...place, lat: null, lng: null }, opts);
  const name = cleanName(place.name) || cleanName(place.address) || '도착지';
  return `${NAVER_DESKTOP}/p/directions/-/${Number(lng).toFixed(6)},${Number(lat).toFixed(6)},${encodeURIComponent(name)},,/-/transit`;
}

/**
 * https 주소를 안드로이드 intent:// 로 감싼다 — 지금 깔린 앱(2.0.6)이 바깥으로 넘기는 유일한 꼴.
 * (chat/[id]/chat-location.ts androidIntentUrl 과 같은 꼴 — 그쪽은 채팅 담당이라 여기 따로 둔다)
 */
export function androidViewIntentUrl(httpsUrl: string): string {
  const u = new URL(httpsUrl);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(':', '')};action=android.intent.action.VIEW;end`;
}

/**
 * 바깥 지도 링크를 누를 때(onClick) — 안드로이드 앱이면 intent:// 로 바깥에, 아니면 링크 기본 동작(새 창 · 인앱 사파리) 그대로.
 * 반환값: 이 함수가 대신 열었으면 true.
 */
export function openExternalMapLink(e: { preventDefault(): void } | null, href: string): boolean {
  if (typeof window === 'undefined' || !/^https:\/\//i.test(href)) return false;
  if (!isAndroidAppShell()) return false;
  e?.preventDefault();
  try {
    window.location.href = androidViewIntentUrl(href);
  } catch {
    /* 주소를 못 만들면 아무 일도 안 한다(오류 화면보다 낫다) */
  }
  return true;
}

/**
 * <a {...naverMapLinkProps(place)}> — href 는 늘 모바일 주소(SSR 과 같음), 누르는 순간 기기에 맞는 주소로 바꾸고
 * 안드로이드 앱이면 intent:// 로 바깥에 넘긴다. kind: 'view'(기본) | 'route'(길찾기)
 */
export function naverMapLinkProps(place: NaverMapPlace, opts: { kind?: 'view' | 'route' } = {}) {
  const build = (device: NaverMapDevice) =>
    opts.kind === 'route' ? naverMapRouteUrl(place, { device }) : naverMapUrl(place, { device });
  return {
    href: build('mobile'),
    target: '_blank' as const,
    rel: 'noopener noreferrer',
    onClick: (e: { preventDefault(): void; currentTarget: EventTarget | null }) => {
      const href = build('auto');
      if (openExternalMapLink(e, href)) return;
      // 기본 동작이 읽기 전에 href 를 기기에 맞는 주소로(같은 클릭 안에서 바꾸면 그 주소로 열린다)
      const a = e.currentTarget as HTMLAnchorElement | null;
      if (a && typeof a.setAttribute === 'function' && a.getAttribute('href') !== href) a.setAttribute('href', href);
    },
  };
}
