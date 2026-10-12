'use client';

/**
 * 채팅 '장소 보내기' — 지도에서 직접 고르기(261012 사장 '네이버 다이나믹맵 전부 다 적용').
 *
 *  · 가운데 고정 핀 + 지도를 끌어서 맞춘다 → 멈추면 가운데 좌표를 네이버 역지오코딩(/api/naver-map/reverse, 비밀키는 서버)으로 주소로.
 *  · 지도는 두 겹 사다리:
 *      ① 네이버 다이나믹맵(NaverMap interactive, 잠금 덮개 없이) — 콘솔 인증이 되는 출처에서
 *      ② 인증 실패 · SDK 못 받음 · 8초 초과면 '정적 그림을 손으로 끄는 지도'(StaticPanMap) — /api/naver-map/static 그림을 손가락 따라 옮기고,
 *         놓으면 새 가운데 그림을 받아 이음매 없이 바꾼다(정적 그림과 SDK 가 같은 웹 메르카토르 척도 — chat-location.ts 실측 메모).
 *         두 손가락 오므리기/벌리기 · +/− 단추 · 휠(PC)로 확대. 빈 상자 · 네이버 '인증 실패' 판은 어디서도 보이지 않는다.
 *  · 현재 위치 단추는 위치를 줄 수 있는 기기에서만(안드로이드 앱 2.0.6 은 window.Android.supportsGeolocation 이 있을 때만 — 부모가 판단해 넘김).
 *  · 검색에서 고른 장소로 들어오면(seed) 핀을 20m 안에서만 움직였을 땐 그 장소 이름·주소·좌표를 그대로 보낸다.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import NaverMap from '@/components/map/NaverMap';
import {
  KOREA_BOUNDS,
  NAVER_MAP_ZOOM,
  NAVER_STATIC_MAX_AREA,
  NAVER_STATIC_SIZE,
  canUseNaverDynamicMap,
  clampInt,
  isInKorea,
  naverStaticMapSrc,
  roundCoord,
  snapStaticSize,
  staticImageCenterForBox,
  type LatLngLiteral,
  type NaverMapEventListener,
  type NaverMapInstance,
  type NaverMapsNS,
} from '@/lib/naver-map';
import {
  MAP_PICKED_FALLBACK_NAME,
  distanceMeters,
  globalPxToLonLat,
  isValidLatLng,
  lonLatToGlobalPx,
  type PickedPlace,
} from './chat-location';

/** 고르기 지도 처음 단계 — 건물 하나하나가 보이는 정도 */
const PICK_ZOOM = 17;
/** 핀을 이만큼(m) 안에서만 움직였으면 검색에서 고른 장소를 그대로 보낸다 */
const SEED_KEEP_METERS = 20;
/** 아무 위치도 모를 때 처음 가운데 — 서울시청 */
export const DEFAULT_PICK_CENTER: LatLngLiteral = { lat: 37.56668, lng: 126.97843 };

// ─── 좌표 → 주소(네이버 역지오코딩, 서버 프록시) ───

export type ReverseAddress = {
  found: boolean;
  /** 도로명(없으면 지번) 짧은 주소 — '서울특별시 중구 세종대로 110' */
  address: string;
  roadAddress: string;
  jibunAddress: string;
  buildingName: string;
  /** '서울 중구 태평로1가' */
  short: string;
};

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const reverseCache = new Map<string, Promise<ReverseAddress>>();

/** 같은 자리(소수 5자리)는 한 번만 묻는다. 실패 · 시간 초과는 기억하지 않는다(다음에 다시) */
export function fetchReverseAddress(lat: number, lng: number): Promise<ReverseAddress> {
  if (!isInKorea(lat, lng)) return Promise.resolve({ found: false, address: '', roadAddress: '', jibunAddress: '', buildingName: '', short: '' });
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  const hit = reverseCache.get(key);
  if (hit) return hit;
  // 8초 넘게 답이 없으면 실패로(느린 망에서 '주소 찾는 중…'에 갇혀 보내기 단추가 영영 꺼져 있지 않게 — 좌표로는 보낼 수 있다)
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 8000) : null;
  const p = fetch(`/api/naver-map/reverse?lat=${lat.toFixed(5)}&lng=${lng.toFixed(5)}`, { credentials: 'omit', signal: ctrl?.signal })
    .finally(() => { if (timer) clearTimeout(timer); })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`reverse ${r.status}`))))
    .then((d: Record<string, unknown>) => ({
      found: d?.found === true,
      address: str(d?.address),
      roadAddress: str(d?.roadAddress),
      jibunAddress: str(d?.jibunAddress),
      buildingName: str(d?.buildingName),
      short: str(d?.short),
    }));
  p.catch(() => { reverseCache.delete(key); });
  reverseCache.set(key, p);
  if (reverseCache.size > 300) {
    const first = reverseCache.keys().next().value;
    if (first) reverseCache.delete(first);
  }
  return p;
}

/**
 * 좌표만 있는 옛 위치 메시지에 주소를 붙여 보일 때 — 대한민국 밖 · 좌표 없음이면 null.
 * 실패(8초 초과 · 망 오류)면 2.5초 뒤 한 번 더(261012 검수: 한 번 끊기면 '상대가 보낸 위치'만 남고 주소가 영영 비었다). 실패는 캐시에 안 남으니 새로 묻는다.
 */
export function useReverseAddress(lat: number | null, lng: number | null): ReverseAddress | null {
  const [res, setRes] = useState<ReverseAddress | null>(null);
  useEffect(() => {
    if (lat == null || lng == null || !isInKorea(lat, lng)) { setRes(null); return; }
    let alive = true;
    let retry: ReturnType<typeof setTimeout> | null = null;
    const ask = (left: number) => {
      fetchReverseAddress(lat, lng)
        .then((r) => { if (alive) setRes(r); })
        .catch(() => { if (alive && left > 0) retry = setTimeout(() => ask(left - 1), 2500); });
    };
    ask(1);
    return () => { alive = false; if (retry) clearTimeout(retry); };
  }, [lat, lng]);
  return res;
}

// ─── 현재 위치(자체 감시 타이머로 끝 보장) ───

export class GeoError extends Error {
  readonly code: 'denied' | 'failed';
  constructor(code: 'denied' | 'failed') {
    super(`geo: ${code}`);
    this.name = 'GeoError';
    this.code = code;
  }
}

/** 현재 위치 한 번 — 웹뷰가 위치 요청에 아무 답도 안 주는 경우가 있어 9초 감시 타이머로 끝을 보장한다 */
export function getCurrentPositionSafe(timeoutMs = 9000): Promise<LatLngLiteral> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) { reject(new GeoError('failed')); return; }
    let done = false;
    const watchdog = setTimeout(() => { if (!done) { done = true; reject(new GeoError('failed')); } }, timeoutMs);
    const finish = () => { done = true; clearTimeout(watchdog); };
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (done) return;
          finish();
          const { latitude, longitude } = pos.coords;
          if (!isValidLatLng(latitude, longitude)) { reject(new GeoError('failed')); return; }
          resolve({ lat: latitude, lng: longitude });
        },
        (err) => {
          if (done) return;
          finish();
          reject(new GeoError(err?.code === 1 ? 'denied' : 'failed'));
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
      );
    } catch {
      finish();
      reject(new GeoError('failed'));
    }
  });
}

// ─── 작은 그림들 ───

function CrosshairIcon({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="6.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** 가운데 고정 핀 — 끝이 칸 한가운데(보낼 좌표)에. 끄는 동안 살짝 들린다 */
function CenterPin({ lifted }: { lifted: boolean }) {
  return (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 z-[4] h-[6px] w-[14px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/30 transition-[opacity,transform] duration-200"
        style={{ opacity: lifted ? 0.9 : 0.5, transform: `translate(-50%, -50%) scale(${lifted ? 0.8 : 1})` }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 z-[5] block transition-transform duration-200 ease-out"
        style={{ transform: `translate(-50%, calc(-100% + 2px)) translateY(${lifted ? -10 : 0}px)` }}
      >
        <svg width="36" height="46" viewBox="0 0 28 36" style={{ display: 'block', filter: 'drop-shadow(0 3px 4px rgba(0,0,0,.28))' }}>
          <path d="M14 1C6.82 1 1 6.7 1 13.73c0 8.9 10.77 19.4 12.12 20.67a1.27 1.27 0 0 0 1.76 0C16.23 33.13 27 22.63 27 13.73 27 6.7 21.18 1 14 1Z" fill="#3182F6" stroke="#fff" strokeWidth="2" />
          <circle cx="14" cy="13.5" r="4.6" fill="#fff" />
        </svg>
      </span>
    </>
  );
}

// ─── 정적 그림을 손으로 끄는 지도(다이나믹맵 대신) ───

type ShownImage = { src: string; c: LatLngLiteral; z: number; w: number; h: number };

function clampToKorea(c: LatLngLiteral): LatLngLiteral {
  const m = 0.02; // 경계에 딱 붙지 않게
  return {
    lat: Math.min(KOREA_BOUNDS.maxLat - m, Math.max(KOREA_BOUNDS.minLat + m, c.lat)),
    lng: Math.min(KOREA_BOUNDS.maxLng - m, Math.max(KOREA_BOUNDS.minLng + m, c.lng)),
  };
}

/**
 * /api/naver-map/static 그림 한 장을 손가락 따라 옮기는 지도.
 *  · 그림 크기 = 칸 크기를 10px 단위로 올린 것(프록시는 10px 단위만 받는다 — 261012 검수). 멈춰 있을 때 그림의 왼쪽 아래가 칸의 왼쪽 아래에
 *    딱 붙도록 가운데를 옮겨 받는다(staticImageCenterForBox) → 네이버 로고 · 저작권(왼쪽 아래)이 늘 칸 안, 넘치는 9px 는 오른쪽 · 위로만.
 *    그래서 끄는 동안엔 가장자리에 연회색이 비치고, 놓으면 새 가운데 그림을 미리 받아 두었다가 이음매 없이 바꾼다.
 *  · 끄는 중엔 그림을 받지 않는다(놓을 때 한 장) — 네이버 정적 지도 한도를 아낀다.
 *  · 두 손가락: 벌리면 확대 · 오므리면 축소(손을 떼면 가까운 단계로). 휠(PC) · 더블클릭도 확대/축소.
 */
function StaticPanMap({
  center,
  zoom,
  onDragStart,
  onSettle,
  children,
}: {
  center: LatLngLiteral;
  zoom: number;
  onDragStart: () => void;
  onSettle: (c: LatLngLiteral, z: number) => void;
  children?: ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [view, setView] = useState({ c: center, z: zoom });
  const viewRef = useRef(view);
  viewRef.current = view;
  const [shown, setShown] = useState<ShownImage | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [gesturing, setGesturing] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<
    | { kind: 'pan'; id: number; x: number; y: number; gx: number; gy: number; moved: boolean }
    | { kind: 'pinch'; dist: number; z0: number }
    | { kind: 'done' }
    | null
  >(null);
  const onSettleRef = useRef(onSettle);
  onSettleRef.current = onSettle;
  const onDragStartRef = useRef(onDragStart);
  onDragStartRef.current = onDragStart;

  // 부모가 가운데 · 단계를 바꾸면(현재 위치 단추 · 모드 전환) 따라간다
  useEffect(() => {
    setView((v) => (v.c.lat === center.lat && v.c.lng === center.lng && v.z === zoom ? v : { c: center, z: zoom }));
  }, [center.lat, center.lng, zoom]);

  // 칸 크기
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      // 레이아웃 크기 — getBoundingClientRect 는 시트가 뜨는 애니메이션(PC scale .98)까지 곱해 작게 잰다
      const cw = el.offsetWidth;
      const ch = el.offsetHeight;
      if (cw < 8 || ch < 8) return; // 시트가 아직 펼쳐지기 전
      setBox((prev) => (prev && prev.w === cw && prev.h === ch ? prev : { w: cw, h: ch }));
    };
    measure();
    if (typeof ResizeObserver !== 'function') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 멈춰 있을 때 받을 그림 — 크기는 10px 단위(넓이 한도 안), 가운데는 '그림 왼쪽 아래 = 칸 왼쪽 아래'가 되게 옮긴 뒤
  // 프록시와 같이 소수 5자리로(그림 가운데와 계산이 정확히 같게 — 아래 imgStyle 은 반올림된 그림 가운데로 자리를 잡는다)
  const scale: 1 | 2 = typeof window !== 'undefined' && (window.devicePixelRatio || 1) >= 1.5 ? 2 : 1;
  const target = useMemo<ShownImage | null>(() => {
    if (!box || gesturing) return null;
    const z = clampInt(view.z, NAVER_MAP_ZOOM.min, NAVER_MAP_ZOOM.max);
    const w = snapStaticSize(box.w);
    const h = Math.min(snapStaticSize(box.h), Math.max(NAVER_STATIC_SIZE.min, Math.floor(NAVER_STATIC_MAX_AREA / w / NAVER_STATIC_SIZE.step) * NAVER_STATIC_SIZE.step));
    const shifted = staticImageCenterForBox(view.c, z, { w, h, s: 1 }, Math.min(box.w, w), Math.min(box.h, h));
    const c = { lat: roundCoord(shifted.lat), lng: roundCoord(shifted.lng) };
    const src = naverStaticMapSrc({ center: c, level: z, width: w, height: h, scale });
    return src ? { src, c, z, w, h } : null;
  }, [box, gesturing, view, scale]);

  // 미리 받아 두었다가 다 오면 바꾼다(바꾸는 순간 깜빡임 없음). 실패하면 옛 그림 유지
  useEffect(() => {
    if (!target || shown?.src === target.src) return;
    let alive = true;
    const img = new Image();
    img.decoding = 'async';
    // 다 받고 · 풀어 둔 뒤에 바꾼다(바꾸는 순간 빈 칸이 한 번 비치지 않게)
    img.onload = () => {
      const show = () => { if (alive) setShown(target); };
      if (typeof img.decode === 'function') img.decode().then(show, show); else show();
    };
    img.onerror = () => { if (alive) setFailedSrc(target.src); };
    img.src = target.src;
    return () => { alive = false; img.onload = null; img.onerror = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.src]);

  const settle = useCallback((z?: number) => {
    const v = viewRef.current;
    const nz = clampInt(z ?? v.z, NAVER_MAP_ZOOM.min, NAVER_MAP_ZOOM.max);
    const next = { c: v.c, z: nz };
    viewRef.current = next;
    setView(next);
    setGesturing(false);
    onSettleRef.current(next.c, nz);
  }, []);

  const zoomBy = useCallback((d: number) => {
    const v = viewRef.current;
    const nz = clampInt(v.z + d, NAVER_MAP_ZOOM.min, NAVER_MAP_ZOOM.max);
    if (nz === v.z) return;
    viewRef.current = { c: v.c, z: nz };
    setView(viewRef.current);
    onSettleRef.current(v.c, nz);
  }, []);

  // 휠(PC) — 페이지 · 시트가 같이 굴러가지 않게 passive:false 로 직접 단다
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    let last = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const now = Date.now();
      if (now - last < 250 || Math.abs(e.deltaY) < 4) return;
      last = now;
      zoomBy(e.deltaY < 0 ? 1 : -1);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomBy]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
    if (pointers.current.size === 1) {
      const v = viewRef.current;
      const g = lonLatToGlobalPx(v.c.lat, v.c.lng, v.z);
      gesture.current = { kind: 'pan', id: e.pointerId, x: e.clientX, y: e.clientY, gx: g.x, gy: g.y, moved: false };
    } else if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      const wasMoving = gesture.current?.kind === 'pan' && gesture.current.moved;
      gesture.current = { kind: 'pinch', dist: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), z0: viewRef.current.z };
      if (!wasMoving) { setGesturing(true); onDragStartRef.current(); }
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;
    if (g.kind === 'pan' && g.id === e.pointerId) {
      const dx = e.clientX - g.x;
      const dy = e.clientY - g.y;
      if (!g.moved) {
        if (Math.hypot(dx, dy) < 4) return;
        g.moved = true;
        setGesturing(true);
        onDragStartRef.current();
      }
      const z = viewRef.current.z;
      const next = { c: clampToKorea(globalPxToLonLat(g.gx - dx, g.gy - dy, z)), z };
      viewRef.current = next;
      setView(next);
    } else if (g.kind === 'pinch' && pointers.current.size >= 2) {
      const [a, b] = Array.from(pointers.current.values());
      const ratio = Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)) / g.dist;
      // 손가락 사이가 두 배 = 한 단계(가운데 핀 기준으로 확대 — 보낼 좌표가 흔들리지 않게)
      const z = Math.min(NAVER_MAP_ZOOM.max, Math.max(NAVER_MAP_ZOOM.min, g.z0 + Math.log2(ratio)));
      const next = { c: viewRef.current.c, z };
      viewRef.current = next;
      setView(next);
    }
  };

  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (!g) return;
    if (g.kind === 'pan' && g.id === e.pointerId) {
      gesture.current = null;
      if (g.moved) settle();
    } else if (g.kind === 'pinch') {
      // 두 손가락 중 하나를 떼면 끝 — 남은 손가락은 다 뗄 때까지 무시(갑자기 끌리지 않게)
      gesture.current = pointers.current.size > 0 ? { kind: 'done' } : null;
      settle(Math.round(viewRef.current.z));
    } else if (g.kind === 'done' && pointers.current.size === 0) {
      gesture.current = null;
    }
  };

  // 지금 보이는 그림의 자리 — 그림 가운데(shown.c)가 지금 화면 가운데(view.c)에서 얼마나 떨어졌는지 + 단계 차이만큼 확대
  let imgStyle: CSSProperties | null = null;
  if (shown && box) {
    const s = 2 ** (view.z - shown.z);
    const pc = lonLatToGlobalPx(view.c.lat, view.c.lng, view.z);
    const ps = lonLatToGlobalPx(shown.c.lat, shown.c.lng, view.z);
    const w = shown.w * s;
    const h = shown.h * s;
    imgStyle = {
      position: 'absolute',
      left: 0,
      top: 0,
      width: w,
      height: h,
      maxWidth: 'none',
      transform: `translate3d(${box.w / 2 + (ps.x - pc.x) - w / 2}px, ${box.h / 2 + (ps.y - pc.y) - h / 2}px, 0)`,
      willChange: gesturing ? 'transform' : undefined,
    };
  }
  const loadFailed = !shown && !!failedSrc && failedSrc === target?.src;

  return (
    <div
      ref={boxRef}
      className="relative h-full w-full select-none overflow-hidden bg-[#EEF0F3]"
      style={{ touchAction: 'none', cursor: gesturing ? 'grabbing' : 'grab', WebkitTouchCallout: 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onDoubleClick={() => zoomBy(1)}
      data-static-pan-map={shown ? 'ready' : loadFailed ? 'failed' : 'loading'}
    >
      {!shown && !loadFailed && <div aria-hidden className="absolute inset-0 animate-pulse bg-[#E9ECEF]" />}
      {shown && imgStyle && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shown.src} alt="" aria-hidden="true" draggable={false} style={imgStyle} className="pointer-events-none select-none" />
      )}
      {loadFailed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-6 text-center">
          <span className="text-[15px] font-semibold text-[#4E5968]">지도를 불러오지 못했어요</span>
          <span className="text-[13px] text-[#8B95A1]">뒤로 가서 장소를 검색해 보내 주세요</span>
        </div>
      )}
      {/* 확대 · 축소 */}
      <div
        className="absolute right-3 top-3 z-[6] flex flex-col overflow-hidden rounded-[12px] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.14)]"
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="지도 확대"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => zoomBy(1)}
          disabled={view.z >= NAVER_MAP_ZOOM.max}
          className="flex h-9 w-9 items-center justify-center text-[20px] font-medium leading-none text-[#333D4B] active:bg-[#F2F4F6] disabled:text-[#C9CFD6]"
        >
          +
        </button>
        <span className="mx-2 h-px bg-[#EEF0F3]" aria-hidden="true" />
        <button
          type="button"
          aria-label="지도 축소"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => zoomBy(-1)}
          disabled={view.z <= NAVER_MAP_ZOOM.min}
          className="flex h-9 w-9 items-center justify-center text-[20px] font-medium leading-none text-[#333D4B] active:bg-[#F2F4F6] disabled:text-[#C9CFD6]"
        >
          −
        </button>
      </div>
      {children}
    </div>
  );
}

// ─── 지도에서 고르기 패널 ───

type AddrState = { key: string; status: 'loading' | 'ok' | 'none' | 'error'; data?: ReverseAddress };

const coordKey = (c: LatLngLiteral) => `${c.lat.toFixed(5)},${c.lng.toFixed(5)}`;

export function MapPickPanel({
  initialCenter,
  seed,
  geoSupported,
  onPickChange,
}: {
  initialCenter: LatLngLiteral;
  /** 검색에서 고른 장소로 들어왔을 때 — 핀을 거의 안 움직이면 그 이름 · 주소 · 좌표 그대로 */
  seed?: PickedPlace | null;
  /** 현재 위치 단추를 보일지(위치를 줄 수 있는 기기만) */
  geoSupported: boolean;
  /** 보낼 곳 — ready=false 면(끄는 중 · 주소 찾는 중) 보내기 단추를 잠시 막는다 */
  onPickChange: (pick: PickedPlace, ready: boolean) => void;
}) {
  const start = isInKorea(initialCenter.lat, initialCenter.lng) ? initialCenter : DEFAULT_PICK_CENTER;
  const [mode, setMode] = useState<'dynamic' | 'static'>(() => (canUseNaverDynamicMap() ? 'dynamic' : 'static'));
  const [center, setCenter] = useState<LatLngLiteral>(start);
  const [zoom, setZoom] = useState(PICK_ZOOM);
  const [dragging, setDragging] = useState(false);
  const [locating, setLocating] = useState(false);
  const [addr, setAddr] = useState<AddrState>({ key: '', status: 'loading' });
  const firstCenter = useRef(start); // NaverMap 에 주는 가운데는 처음 값 그대로(움직임은 지도 객체로 — 가운데를 되먹이면 idle 이 맴돈다)
  const mapRef = useRef<NaverMapInstance | null>(null);
  const nsRef = useRef<NaverMapsNS | null>(null);
  const listenersRef = useRef<NaverMapEventListener[]>([]);
  const centerRef = useRef(center);
  centerRef.current = center;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const onPickChangeRef = useRef(onPickChange);
  onPickChangeRef.current = onPickChange;

  const detachListeners = useCallback(() => {
    const naver = nsRef.current;
    if (naver && listenersRef.current.length) {
      try { naver.Event.removeListener(listenersRef.current); } catch { /* 지도가 먼저 부서졌을 수 있다 */ }
    }
    listenersRef.current = [];
  }, []);

  useEffect(() => () => detachListeners(), [detachListeners]);

  // 다이나믹맵이 실제로 보이기 시작하면 — 그 사이 현재 위치 단추로 옮긴 가운데를 맞추고, 끌기 · 멈춤을 듣는다
  const handleReady = useCallback((map: NaverMapInstance, naver: NaverMapsNS) => {
    detachListeners();
    mapRef.current = map;
    nsRef.current = naver;
    try {
      const c = centerRef.current;
      const now = map.getCenter();
      if (Math.abs(now.lat() - c.lat) > 1e-6 || Math.abs(now.lng() - c.lng) > 1e-6) map.setCenter(new naver.LatLng(c.lat, c.lng));
      if (map.getZoom() !== zoomRef.current) map.setZoom(zoomRef.current, false);
    } catch { /* 무시 */ }
    const lift = () => setDragging(true);
    listenersRef.current = [
      naver.Event.addListener(map, 'dragstart', lift),
      // 끄는 도중 손을 잠깐 멈추면 SDK 가 idle 을 한 번 내기도 한다 — 다시 움직이면 다시 들어 올려 중간 지점 주소를 묻지 않게
      naver.Event.addListener(map, 'drag', lift),
      naver.Event.addListener(map, 'pinchstart', lift),
      naver.Event.addListener(map, 'idle', () => {
        setDragging(false);
        try {
          const c = map.getCenter();
          setCenter({ lat: c.lat(), lng: c.lng() });
          setZoom(map.getZoom());
        } catch { /* 부서진 지도 */ }
      }),
    ];
  }, [detachListeners]);

  // 다이나믹맵이 안 되면(인증 실패 · SDK 못 받음 · 시간 초과) 정적 그림 끄는 지도로 — 지금 가운데 그대로
  const handleFallback = useCallback(() => {
    detachListeners();
    mapRef.current = null;
    nsRef.current = null;
    setDragging(false);
    setMode('static');
  }, [detachListeners]);

  // 멈춘 가운데 → 주소(0.3초 쉬었다가). 같은 자리는 다시 묻지 않는다
  useEffect(() => {
    if (dragging) return;
    const key = coordKey(center);
    if (!isInKorea(center.lat, center.lng)) { setAddr({ key, status: 'none' }); return; }
    setAddr((prev) => (prev.key === key && prev.status !== 'error' ? prev : { key, status: 'loading' }));
    let alive = true;
    let retry: ReturnType<typeof setTimeout> | null = null;
    const ask = (left: number) => {
      fetchReverseAddress(center.lat, center.lng)
        .then((d) => { if (alive) setAddr({ key, status: d.address || d.short ? 'ok' : 'none', data: d }); })
        .catch(() => {
          if (!alive) return;
          // 실패는 바로 알린다(좌표로 보낼 수 있게 보내기 단추를 푼다) — 그리고 2.5초 뒤 한 번 더 조용히 물어 주소가 오면 바꾼다(261012 검수)
          setAddr((prev) => (prev.key === key && prev.status === 'ok' ? prev : { key, status: 'error' }));
          if (left > 0) retry = setTimeout(() => ask(left - 1), 2500);
        });
    };
    const t = setTimeout(() => ask(1), 300);
    return () => { alive = false; clearTimeout(t); if (retry) clearTimeout(retry); };
  }, [center, dragging]);

  const seedCoord = seed && isValidLatLng(seed.lat, seed.lng) ? { lat: seed.lat as number, lng: seed.lng as number } : null;
  const seedNear = !!seedCoord && distanceMeters(center, seedCoord) <= SEED_KEEP_METERS;
  const currentKey = coordKey(center);
  const addrNow = addr.key === currentKey ? addr : { key: currentKey, status: 'loading' as const };
  const data = addrNow.status === 'ok' ? addrNow.data : undefined;
  const address = data ? data.address || data.short : '';
  const building = data?.buildingName || '';

  const pick = useMemo<PickedPlace>(() => {
    if (seedNear && seed) return seed;
    const lat = Math.round(center.lat * 1e6) / 1e6;
    const lng = Math.round(center.lng * 1e6) / 1e6;
    return {
      lat,
      lng,
      placeName: building || (address ? undefined : MAP_PICKED_FALLBACK_NAME),
      address: address || undefined,
      label: building || address || MAP_PICKED_FALLBACK_NAME,
    };
  }, [seedNear, seed, center.lat, center.lng, building, address]);
  const ready = !dragging && (seedNear || addrNow.status !== 'loading');

  useEffect(() => { onPickChangeRef.current(pick, ready); }, [pick, ready]);

  const goHere = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const p = await getCurrentPositionSafe();
      if (!isInKorea(p.lat, p.lng)) {
        toast.error('지금 위치가 국내가 아니에요 · 지도를 끌어서 골라 주세요');
        return;
      }
      const map = mapRef.current;
      const naver = nsRef.current;
      if (mode === 'dynamic' && map && naver) {
        try {
          if (map.getZoom() < 15) map.setZoom(PICK_ZOOM, false);
          map.panTo(new naver.LatLng(p.lat, p.lng));
        } catch { setCenter(p); }
      } else {
        setCenter(p);
        setZoom((z) => Math.max(z, 15));
      }
    } catch (e) {
      toast.error(e instanceof GeoError && e.code === 'denied'
        ? '위치 권한이 꺼져 있어요 · 지도를 끌어서 골라 주세요'
        : '현재 위치를 찾지 못했어요 · 지도를 끌어서 골라 주세요');
    } finally {
      setLocating(false);
    }
  };

  const hereButton = geoSupported ? (
    <button
      type="button"
      aria-label="현재 위치로"
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onClick={goHere}
      disabled={locating}
      className="absolute bottom-3 right-3 z-[6] flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#3182F6] shadow-[0_2px_10px_rgba(0,0,0,0.16)] transition-transform active:scale-90"
    >
      {locating
        ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#3182F6]/30 border-t-[#3182F6]" />
        : <CrosshairIcon size={22} />}
    </button>
  ) : null;

  // 주소 칸 글
  let title: string;
  let sub = '';
  let tone: 'normal' | 'muted' = 'normal';
  const coordText = `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`;
  if (dragging) {
    title = '지도를 끌어서 핀을 맞춰 주세요';
    tone = 'muted';
  } else if (seedNear && seed) {
    title = seed.label;
    sub = seed.address || '';
  } else if (addrNow.status === 'loading') {
    title = '주소 찾는 중…';
    tone = 'muted';
  } else if (addrNow.status === 'ok') {
    title = building || address;
    sub = building ? address : (data?.jibunAddress && data.jibunAddress !== address ? data.jibunAddress : '');
  } else if (addrNow.status === 'none') {
    title = '주소가 없는 곳이에요';
    sub = `${coordText} · 좌표로 보내요`;
  } else {
    title = '주소를 불러오지 못했어요';
    sub = `${coordText} · 좌표로 보내요`;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-[200px] flex-1 overflow-hidden rounded-[20px] bg-[#EEF0F3]" data-map-pick={mode}>
        {mode === 'dynamic' ? (
          <>
            <NaverMap
              center={firstCenter.current}
              zoom={PICK_ZOOM}
              interactive
              lockUntilTap={false}
              href={null}
              title="지도에서 고르기"
              className="h-full w-full"
              onReady={handleReady}
              onFallback={handleFallback}
            />
            {hereButton}
          </>
        ) : (
          <StaticPanMap
            center={center}
            zoom={zoom}
            onDragStart={() => setDragging(true)}
            onSettle={(c, z) => { setDragging(false); setCenter(c); setZoom(z); }}
          >
            {hereButton}
          </StaticPanMap>
        )}
        <CenterPin lifted={dragging} />
      </div>

      <div className="mt-3 flex shrink-0 items-start gap-3 rounded-2xl bg-[#F9FAFB] px-4 py-3" aria-live="polite">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E8F3FF] text-[#3182F6]">
          {addrNow.status === 'loading' && !dragging && !seedNear
            ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#3182F6]/30 border-t-[#3182F6]" />
            : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 2.2c-4.2 0-7.6 3.3-7.6 7.5 0 5.3 6.3 11.4 7.1 12.1.3.3.7.3 1 0 .8-.7 7.1-6.8 7.1-12.1 0-4.2-3.4-7.5-7.6-7.5Z" fill="currentColor" />
                <circle cx="12" cy="9.8" r="2.7" fill="#fff" />
              </svg>
            )}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block break-keep text-[15px] font-bold leading-[1.4] [overflow-wrap:anywhere] ${tone === 'muted' ? 'text-[#8B95A1]' : 'text-[#191F28]'}`}>{title}</span>
          {sub && <span className="mt-0.5 block break-keep text-[13px] leading-[1.4] text-[#8B95A1] [overflow-wrap:anywhere]">{sub}</span>}
        </span>
      </div>
    </div>
  );
}
