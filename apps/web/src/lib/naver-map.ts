/**
 * 네이버 지도(Dynamic Map, JS SDK v3) 불러오기 — 앱 전체에 <script> 하나
 * (261012 사장 '네이버 다이나믹맵인데 이거 네이버 맵좀 전부 다 적용해줘').
 *
 *  · 주소 = https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=<NEXT_PUBLIC_NAVER_MAP_CLIENT_ID>
 *    (새 콘솔 키는 ncpKeyId — 옛 ncpClientId 로 보내면 인증 서버가 400 InvalidParameter).
 *  · SDK 는 '페이지 출처'로 인증한다(NCP 콘솔 Application > Web 서비스 URL). 등록 안 된 출처면 지도를 그렸다가
 *    약 0.3초 뒤 SDK 가 스스로 지도를 부수고 '인증 실패' 판을 깔고, 다시 1초 뒤 window.navermap_authFailure 를 부른 다음
 *    window.naver.maps 를 null 로 비운다(maps.js 실측). → 여기서
 *      ① 인증 요청 <script>(oapi.map.naver.com/v3/auth) 의 load/error 를 지켜 성공·실패를 바로 알고,
 *      ② navermap_authFailure 도 받고(최종 신호), ③ 둘 다 못 보면 첫 지도 생성 후 AUTH_GRACE_MS 지나 '성공으로 간주'.
 *    실패는 이 페이지가 살아 있는 동안 고정(다시 불러도 같은 결과)하고 이 기기에 12시간 기억(localStorage, Client ID + 출처별)
 *    — 화면(NaverMap)은 곧장 정적 그림으로 대신한다(261012 검수: 운영 인증이 깨진 동안 새 탭 · 앱을 켤 때마다 SDK 333KB(gzip 93KB)를 받았다 버렸다).
 *  · 끄는 스위치: NEXT_PUBLIC_NAVER_MAP_DYNAMIC=0(또는 off · false) 이면 SDK 를 아예 안 부르고 처음부터 정적 그림(빌드 때 박힘 — 바꾸면 다시 배포).
 *    NCP 콘솔 인증이 고쳐질 때까지 꺼 둘 때 쓴다. 비어 있으면 켜짐.
 *  · 네트워크 실패 · 시간 초과(8초)는 고정하지 않는다 — 다음 호출 때 <script> 를 새로 붙여 다시 시도.
 *  · SSR 안전: 모듈을 읽기만 해서는 window 를 건드리지 않는다. 서버에서 loadNaverMaps() 를 부르면 'ssr' 로 거절.
 *  · 서브모듈(geocoder)은 싣지 않는다 — 주소↔좌표는 서버 프록시 /api/naver-map/geocode · reverse 로(비밀키는 서버에만).
 */

export * from './naver-map-shared';
export * from './naver-map-links';

/** 공개 Client ID(브라우저용) — 비밀키(NAVER_MAP_CLIENT_SECRET)는 서버 처리기에서만 읽는다 */
export const NAVER_MAP_CLIENT_ID = (process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || '').trim();

const SDK_BASE = 'https://oapi.map.naver.com/openapi/v3/maps.js';
const SCRIPT_MARK = 'data-ft-naver-maps';
const LOAD_TIMEOUT_MS = 8000;
const AUTH_GRACE_MS = 2500;
/** 인증 실패를 이 기기(localStorage, 막혔으면 sessionStorage)에 12시간 기억 — 새로고침 · 새 탭 · 앱 재실행에서 333KB SDK 를 또 받고 또 실패하지 않게.
 *  Client ID · 출처가 바뀌면 무효. 콘솔이 고쳐지면 늦어도 12시간 안에 다이나믹맵으로 돌아온다(그동안은 정적 그림 — 지도는 늘 보인다) */
const AUTH_MEMO_KEY = 'ft:naver-map-auth-failed';
const AUTH_MEMO_MS = 12 * 60 * 60 * 1000;

/** 다이나믹맵 스위치(기본 켜짐) */
export const NAVER_MAP_DYNAMIC_ENABLED = !/^(0|off|false|no)$/i.test((process.env.NEXT_PUBLIC_NAVER_MAP_DYNAMIC || '').trim());

// ─── 쓰는 만큼만 적은 naver.maps 타입 ───

export interface NaverLatLng {
  lat(): number;
  lng(): number;
}
export interface NaverPoint {
  x: number;
  y: number;
}
export interface NaverLatLngBounds {
  extend(latlng: NaverLatLng): NaverLatLngBounds;
  getCenter(): NaverLatLng;
}
export type NaverMapEventListener = { __naverListener?: true } & Record<string, unknown>;

export interface NaverMapOptions {
  center?: NaverLatLng;
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  draggable?: boolean;
  pinchZoom?: boolean;
  scrollWheel?: boolean;
  keyboardShortcuts?: boolean;
  disableDoubleTapZoom?: boolean;
  disableDoubleClickZoom?: boolean;
  disableTwoFingerTapZoom?: boolean;
  disableKineticPan?: boolean;
  zoomControl?: boolean;
  zoomControlOptions?: { position?: number; style?: number };
  mapTypeControl?: boolean;
  mapDataControl?: boolean;
  mapDataControlOptions?: { position?: number };
  scaleControl?: boolean;
  logoControl?: boolean;
  logoControlOptions?: { position?: number };
  background?: string;
  tileTransition?: boolean;
}

export interface NaverMapInstance {
  setCenter(center: NaverLatLng): void;
  getCenter(): NaverLatLng;
  setZoom(zoom: number, useEffect?: boolean): void;
  getZoom(): number;
  panTo(center: NaverLatLng, transitionOptions?: Record<string, unknown>): void;
  fitBounds(bounds: NaverLatLngBounds, margin?: { top?: number; right?: number; bottom?: number; left?: number } | number): void;
  setOptions(options: NaverMapOptions): void;
  setOptions(key: keyof NaverMapOptions, value: unknown): void;
  autoResize(): void;
  destroy(): void;
}

export interface NaverMarkerIcon {
  content: string | HTMLElement;
  anchor?: NaverPoint;
}
export interface NaverMarkerOptions {
  position: NaverLatLng;
  map?: NaverMapInstance | null;
  icon?: NaverMarkerIcon;
  title?: string;
  clickable?: boolean;
  zIndex?: number;
}
export interface NaverMarker {
  setMap(map: NaverMapInstance | null): void;
  setPosition(p: NaverLatLng): void;
  getPosition(): NaverLatLng;
  setIcon(icon: NaverMarkerIcon): void;
}

export interface NaverMapsNS {
  Map: new (el: HTMLElement | string, options?: NaverMapOptions) => NaverMapInstance;
  LatLng: new (lat: number, lng: number) => NaverLatLng;
  LatLngBounds: new (sw: NaverLatLng, ne: NaverLatLng) => NaverLatLngBounds;
  Marker: new (options: NaverMarkerOptions) => NaverMarker;
  Point: new (x: number, y: number) => NaverPoint;
  Event: {
    addListener(target: unknown, type: string, fn: (...args: unknown[]) => void): NaverMapEventListener;
    once(target: unknown, type: string, fn: (...args: unknown[]) => void): NaverMapEventListener;
    removeListener(listener: NaverMapEventListener | NaverMapEventListener[]): void;
  };
  Position: Record<'CENTER' | 'TOP_LEFT' | 'TOP_CENTER' | 'TOP_RIGHT' | 'LEFT_CENTER' | 'RIGHT_CENTER' | 'BOTTOM_LEFT' | 'BOTTOM_CENTER' | 'BOTTOM_RIGHT', number>;
  ZoomControlStyle?: Record<'LARGE' | 'SMALL', number>;
  VERSION?: string;
}

declare global {
  interface Window {
    naver?: { maps?: NaverMapsNS | null } & Record<string, unknown>;
    navermap_authFailure?: () => void;
  }
}

// ─── 실패 사유 ───

/** no_key: Client ID 없음 · disabled: 스위치로 끔 · ssr: 서버에서 호출 · network: 스크립트 못 받음 · timeout: 8초 초과 · auth: 출처/키 인증 실패 */
export type NaverMapFailReason = 'no_key' | 'disabled' | 'ssr' | 'network' | 'timeout' | 'auth';

export class NaverMapLoadError extends Error {
  readonly reason: NaverMapFailReason;
  constructor(reason: NaverMapFailReason) {
    super(`naver-map: ${reason}`);
    this.name = 'NaverMapLoadError';
    this.reason = reason;
  }
}

// ─── 모듈 상태(페이지 하나에 하나) ───

type AuthState = 'unknown' | 'ok' | 'failed';
let authState: AuthState = 'unknown';
let sdkPromise: Promise<NaverMapsNS> | null = null;
let authTimer: ReturnType<typeof setTimeout> | null = null;
let authObserver: MutationObserver | null = null;
let hooksInstalled = false;
const failureListeners = new Set<(reason: NaverMapFailReason) => void>();
const authWaiters = new Set<(state: 'ok' | 'failed') => void>();

let memoChecked = false;
const memoTag = () => `${NAVER_MAP_CLIENT_ID}|${typeof location !== 'undefined' ? location.origin : ''}`;
function memoStores(): Storage[] {
  const out: Storage[] = [];
  try { out.push(window.localStorage); } catch { /* 막힌 웹뷰 */ }
  try { out.push(window.sessionStorage); } catch { /* 막힌 웹뷰 */ }
  return out;
}
function restoreAuthMemo() {
  if (memoChecked || typeof window === 'undefined') return;
  memoChecked = true;
  for (const st of memoStores()) {
    try {
      const raw = st.getItem(AUTH_MEMO_KEY) || '';
      const cut = raw.lastIndexOf('|');
      const tag = raw.slice(0, cut);
      const at = Number(raw.slice(cut + 1));
      if (cut > 0 && tag === memoTag() && Date.now() - at < AUTH_MEMO_MS && Date.now() >= at) { authState = 'failed'; return; }
    } catch {
      /* 저장소가 막힌 웹뷰 · 사생활 모드 — 기억 없이 */
    }
  }
}
function saveAuthMemo() {
  for (const st of memoStores()) {
    try { st.setItem(AUTH_MEMO_KEY, `${memoTag()}|${Date.now()}`); return; } catch { /* 다음 저장소 */ }
  }
}

function readyNamespace(): NaverMapsNS | null {
  if (typeof window === 'undefined') return null;
  const ns = window.naver?.maps;
  return ns && typeof ns.Map === 'function' && typeof ns.LatLng === 'function' ? ns : null;
}

function settleAuth(state: 'ok' | 'failed') {
  if (authTimer) { clearTimeout(authTimer); authTimer = null; }
  if (authObserver) { authObserver.disconnect(); authObserver = null; }
  authWaiters.forEach((fn) => { try { fn(state); } catch { /* 듣는 쪽 오류는 무시 */ } });
  authWaiters.clear();
}

function markAuthOk() {
  if (authState !== 'unknown') return;
  authState = 'ok';
  settleAuth('ok');
}

function markAuthFailed() {
  if (authState === 'failed') return;
  authState = 'failed'; // 'ok'(간주) 뒤에 진짜 실패 신호가 와도 실패로 바꾼다
  settleAuth('failed');
  saveAuthMemo();
  failureListeners.forEach((fn) => { try { fn('auth'); } catch { /* 무시 */ } });
}

/** 인증 요청 <script>(JSONP) 를 찾아 load/error 를 단다 — 2xx 면 성공, 401·500 이면 error(브라우저는 오류 상태 스크립트를 실행하지 않는다) */
function watchAuthScript(node: Node) {
  if (!(node instanceof HTMLScriptElement)) return;
  if (!/\/\/oapi\.map\.naver\.com\/v3\/auth/.test(node.src || '')) return;
  node.addEventListener('load', () => markAuthOk(), { once: true });
  node.addEventListener('error', () => markAuthFailed(), { once: true });
}

function installHooks() {
  if (hooksInstalled || typeof window === 'undefined') return;
  hooksInstalled = true;
  const prev = typeof window.navermap_authFailure === 'function' ? window.navermap_authFailure : null;
  window.navermap_authFailure = () => {
    markAuthFailed();
    try { prev?.(); } catch { /* 무시 */ }
  };
  if (typeof MutationObserver === 'function' && authState === 'unknown') {
    // head·body 바로 아래만(하위 트리 X) — 큰 화면 전체 변경을 지켜보지 않게
    authObserver = new MutationObserver((records) => {
      records.forEach((r) => r.addedNodes.forEach(watchAuthScript));
    });
    authObserver.observe(document.head, { childList: true });
    if (document.body) authObserver.observe(document.body, { childList: true });
  }
}

/**
 * 네이버 지도 SDK 를 불러온다(한 번만). 이미 떠 있으면 바로, 불러오는 중이면 같은 약속을 돌려준다.
 * 실패하면 NaverMapLoadError(reason) 로 거절 — 'auth' 는 페이지가 살아 있는 동안 고정, 나머지는 다음 호출 때 다시 시도.
 */
export function loadNaverMaps(): Promise<NaverMapsNS> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return Promise.reject(new NaverMapLoadError('ssr'));
  if (!NAVER_MAP_CLIENT_ID) return Promise.reject(new NaverMapLoadError('no_key'));
  if (!NAVER_MAP_DYNAMIC_ENABLED) return Promise.reject(new NaverMapLoadError('disabled'));
  restoreAuthMemo();
  if (authState === 'failed') return Promise.reject(new NaverMapLoadError('auth'));
  const ready = readyNamespace();
  if (ready) return Promise.resolve(ready);
  if (sdkPromise) return sdkPromise;

  installHooks();
  const attempt = new Promise<NaverMapsNS>((resolve, reject) => {
    // 남은 옛 <script>(이전 실패 · 개발 중 모듈 새로고침)는 load 가 다시 오지 않으니 새로 붙인다
    document.querySelectorAll(`script[${SCRIPT_MARK}]`).forEach((s) => s.remove());
    const script = document.createElement('script');
    script.src = `${SDK_BASE}?ncpKeyId=${encodeURIComponent(NAVER_MAP_CLIENT_ID)}`;
    script.async = true;
    script.setAttribute(SCRIPT_MARK, '1');

    let finished = false;
    let poll: ReturnType<typeof setInterval> | null = null;
    const offFailure = onNaverMapFailure(() => finish(new NaverMapLoadError('auth')));
    const timer = setTimeout(() => finish(new NaverMapLoadError('timeout')), LOAD_TIMEOUT_MS);

    function finish(err: NaverMapLoadError | null, ns?: NaverMapsNS) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (poll) clearInterval(poll);
      offFailure();
      if (err) {
        sdkPromise = null;
        if (err.reason !== 'auth') script.remove(); // 다음 호출 때 새로 받기
        reject(err);
      } else if (ns) {
        resolve(ns);
      }
    }

    script.addEventListener('load', () => {
      const ns = readyNamespace();
      if (ns) { finish(null, ns); return; }
      // 드물게 본체가 한 박자 늦게 채워진다 — 시간 초과 안에서 짧게 기다린다
      poll = setInterval(() => { const n = readyNamespace(); if (n) finish(null, n); }, 50);
    });
    script.addEventListener('error', () => finish(new NaverMapLoadError('network')));
    document.head.appendChild(script);
  });
  sdkPromise = attempt;
  // 거절을 아무도 안 받아도 '처리 안 된 거절' 경고가 뜨지 않게
  attempt.catch(() => {});
  return attempt;
}

/**
 * 지도(new naver.maps.Map)를 만든 직후 부른다 — SDK 는 첫 지도를 만들 때 인증을 묻는다.
 * 인증 결과를 못 보면 AUTH_GRACE_MS 뒤 성공으로 간주(그 뒤 진짜 실패 신호가 오면 다시 실패로).
 */
export function noteNaverMapCreated() {
  if (authState !== 'unknown' || authTimer || typeof window === 'undefined') return;
  authTimer = setTimeout(() => { authTimer = null; markAuthOk(); }, AUTH_GRACE_MS);
}

/** 인증이 정해지면(성공·간주 성공 'ok' / 실패 'failed') 풀리는 약속 */
export function whenNaverMapAuthSettled(): Promise<'ok' | 'failed'> {
  restoreAuthMemo();
  if (authState === 'ok') return Promise.resolve('ok');
  if (authState === 'failed') return Promise.resolve('failed');
  return new Promise((resolve) => { authWaiters.add(resolve); });
}

/** 지금 인증 상태 — 'unknown'(아직) · 'ok' · 'failed' */
export function getNaverMapAuthState(): AuthState {
  restoreAuthMemo();
  return authState;
}

/** 인증 실패를 듣는다(지도를 그린 뒤에 실패가 와도). 돌려준 함수로 해제 */
export function onNaverMapFailure(fn: (reason: NaverMapFailReason) => void): () => void {
  failureListeners.add(fn);
  return () => { failureListeners.delete(fn); };
}

/** 이 페이지에서 동적 지도를 쓸 수 있나(키 있음 · 스위치 켜짐 · 인증 실패 아님) — 거짓이면 처음부터 정적 그림으로 */
export function canUseNaverDynamicMap(): boolean {
  restoreAuthMemo();
  return !!NAVER_MAP_CLIENT_ID && NAVER_MAP_DYNAMIC_ENABLED && authState !== 'failed';
}

/** 동적 지도를 못 쓰는 까닭(쓸 수 있으면 null) */
export function naverDynamicMapBlockReason(): NaverMapFailReason | null {
  if (!NAVER_MAP_CLIENT_ID) return 'no_key';
  if (!NAVER_MAP_DYNAMIC_ENABLED) return 'disabled';
  restoreAuthMemo();
  return authState === 'failed' ? 'auth' : null;
}

// ─── 우리 지도 프록시 JSON 받기(시간 한도 + 한 번 다시) ───

/** 4xx(잘못된 요청 · 없음)는 다시 묻지 않는다 — 망 오류 · 시간 초과 · 5xx · 429 만 */
export class MapFetchError extends Error {
  readonly status: number;
  readonly transient: boolean;
  constructor(status: number, transient: boolean) {
    super(`map-fetch ${status}`);
    this.name = 'MapFetchError';
    this.status = status;
    this.transient = transient;
  }
}

const waitMs = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * /api/naver-map/* · /chat/place-search JSON 받기 — 한 번에 timeoutMs(기본 8초), 망 오류 · 시간 초과 · 5xx · 429 면 retryDelayMs(기본 2.5초) 뒤 한 번 더
 * (261012 검수: 8초에 한 번 끊기면 그 화면에선 다시 묻지 않아 지도 칸이 사라지거나 주소가 빈 채로 남았다 — 느린 모바일 망 · 붐비는 서버).
 * 4xx 는 바로 MapFetchError(transient=false).
 */
export async function fetchMapJson<T = unknown>(
  url: string,
  opts: { timeoutMs?: number; retries?: number; retryDelayMs?: number; signal?: AbortSignal } = {},
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 8000;
  const retries = opts.retries ?? 1;
  const retryDelayMs = opts.retryDelayMs ?? 2500;
  let lastErr: MapFetchError = new MapFetchError(0, true);
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await waitMs(retryDelayMs);
    if (opts.signal?.aborted) throw new MapFetchError(0, false);
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    const onOuterAbort = () => ctrl?.abort();
    opts.signal?.addEventListener('abort', onOuterAbort, { once: true });
    try {
      const res = await fetch(url, { credentials: 'omit', signal: ctrl?.signal, headers: { Accept: 'application/json' } });
      if (res.ok) return (await res.json()) as T;
      const transient = res.status >= 500 || res.status === 429;
      lastErr = new MapFetchError(res.status, transient);
      if (!transient) throw lastErr;
    } catch (e) {
      if (e instanceof MapFetchError && !e.transient) throw e;
      if (opts.signal?.aborted) throw new MapFetchError(0, false);
      if (!(e instanceof MapFetchError)) lastErr = new MapFetchError(0, true);
    } finally {
      if (timer) clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onOuterAbort);
    }
  }
  throw lastErr;
}
