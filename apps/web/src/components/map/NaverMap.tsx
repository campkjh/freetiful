'use client';

/**
 * 네이버 지도 칸(261012 사장 '네이버 다이나믹맵인데 이거 네이버 맵좀 전부 다 적용해줘').
 *
 * 층 구성(아래 → 위):
 *  ① 바탕 — 연회색 칸 + 정적 지도 그림(/api/naver-map/static, 같은 가운데·단계) → 들어오자마자 '지도'가 보인다
 *  ② 동적 지도(네이버 SDK) — 타일이 다 깔리고 인증이 정해지면(성공) 서서히 덮는다
 *  ③ 덮개 — 고정 모드: 칸 전체가 링크(누르면 네이버 지도) / 움직이는 모드: '눌러서 지도 움직이기' 알약(눌러야 끌기·확대)
 *  ④ children — 칸 위에 얹을 것(예: '크게 보기' 칩)
 * 실패 사다리: SDK 인증 실패·로딩 실패·8초 초과 → ① 정적 그림만 남김 → 그림도 실패 → 주소 카드(핀 + 장소명 + 주소 + '네이버 지도에서 보기').
 *  빈 상자 · 네이버 '인증 실패' 판은 절대 보이지 않는다(동적 층은 인증이 정해지기 전엔 투명, 실패하면 숨김).
 *
 * 스크롤 가로채기 방지: 고정 모드는 지도가 손가락을 받지 않고(덮개 링크), 움직이는 모드도 기본은 잠금 —
 *  한 번 눌러야 움직이고, 마우스가 칸 밖으로 나가거나 칸이 화면 밖으로 나가면 다시 잠근다(비즈 오시는길 BizMap 과 같은 어법).
 * 무거운 일은 칸이 화면 근처(300px)에 올 때만(SDK 로딩 · 지도 생성). 칸이 사라지면 지도도 부순다.
 *
 * (261012 검수 반영)
 *  · 정적 그림은 칸 크기를 10px 단위로 올려 받아 늘리지 않고 칸의 '왼쪽 아래'에 붙인다 — 네이버 로고 · 저작권(왼쪽 아래)이 늘 칸 안
 *    (예전 50px 단위 + 가운데 cover 는 393 아이폰 업체 상세에서 'AVER' · 채팅 말풍선 로고 아래 절반 · 어드민 1064px 칸은 로고 없음).
 *    칸이 한도(1020 · 넓이 1020×640)보다 크면 한도 안에서 받아 비율대로 늘리고 가운데를 옮겨 받는다(lib/naver-map-shared planStaticImage).
 *  · 다이나믹맵 안 SDK 자체 링크(NAVER 로고 → 고지 화면 등, target=_blank)도 안드로이드 앱(2.0.6)에선 intent:// 로 바깥에 넘긴다(새 창을 못 열어 앱 화면이 넘어갔다).
 *  · 인증 실패가 정해지면 그 지도에 SDK 호출(destroy · 표시 지우기)을 하지 않는다 — SDK 가 스스로 부수는 타이머와 겹치면 SDK 안에서
 *    'Cannot read properties of null (reading isArray)' 가 가끔 났다(첫 어드민 실행 1회, 재현 안 됨).
 *  · 주소 카드는 칸 높이에 맞춰 줄인다(150px 아래 = 한 줄 · 90px 아래 = 핀만) — 120px 채팅 카드 · 56px 썸네일에서도 넘치지 않게.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { MapPin } from 'lucide-react';
import {
  NAVER_MAP_ZOOM,
  clampInt,
  fitMarkers,
  getNaverMapAuthState,
  isInKorea,
  loadNaverMaps,
  naverDynamicMapBlockReason,
  naverMapUrl,
  naverStaticMapSrc,
  noteNaverMapCreated,
  onNaverMapFailure,
  openExternalMapLink,
  planStaticImage,
  staticImageCenterForBox,
  whenNaverMapAuthSettled,
  NaverMapLoadError,
  type LatLngLiteral,
  type MapMarkerLiteral,
  type NaverMapFailReason,
  type NaverMapInstance,
  type NaverMapLang,
  type NaverMapsNS,
  type NaverMarker,
} from '@/lib/naver-map';

export type NaverMapFallbackReason = NaverMapFailReason | 'no_center' | 'image';

export type NaverMapProps = {
  /** 가운데. 없으면 표시(markers)들로 맞춘다 */
  center?: LatLngLiteral | null;
  /** 확대 단계 6~20 (기본 16 — 건물·골목이 보이는 정도) */
  zoom?: number;
  /** 표시(핀). label 은 핀 위 흰 말풍선(20자 안) */
  markers?: MapMarkerLiteral[];
  /** true = 손으로 움직이는 지도(기본 잠금 덮개) · false(기본) = 고정 지도, 누르면 href */
  interactive?: boolean;
  /** 움직이는 모드에서 '눌러서 지도 움직이기' 잠금 덮개를 쓸지(기본 true). 꽉 찬 시트처럼 지도만 있는 화면에서만 false */
  lockUntilTap?: boolean;
  /** 잠금 덮개 문구(4개 언어 화면이면 넘겨 줄 것) */
  lockHint?: string;
  /** 고정 모드에서 누르면 열 주소. 기본 = 네이버 지도(좌표 핀). null = 링크 없음 */
  href?: string | null;
  /** 링크 읽기 이름(스크린리더) — 기본 '네이버 지도에서 크게 보기' */
  linkLabel?: string;
  /** 장소 이름 — 주소 카드 제목 · 기본 네이버 지도 핀 제목 */
  title?: string;
  /** 주소 — 주소 카드에 보인다 */
  address?: string;
  /** 주소 카드의 링크 글자(기본 '네이버 지도에서 보기') */
  openLabel?: string;
  /** 가운데가 없을 때(주소 카드) 누르면 네이버 지도에서 이 글자로 검색 — 없으면 title(없으면 address) */
  searchQuery?: string;
  /** 지도 글자 언어(정적 그림) — ko(기본) · en · ja · zh */
  lang?: NaverMapLang;
  /** SDK 없이 정적 그림만(채팅 말풍선 · 목록처럼 여러 개 뜨는 곳) */
  imageOnly?: boolean;
  /** 로딩 동안 정적 그림을 먼저 깔지(기본 true). false 면 연회색 칸만 */
  staticPreview?: boolean;
  /** 움직이는 모드의 확대 단추(기본 true) */
  zoomControl?: boolean;
  /** 표시가 여럿일 때 다 보이게 맞출지(기본 true — center 를 주면 그 가운데 유지) */
  fitToMarkers?: boolean;
  /** 높이·둥근 모서리 등(예: 'h-[196px] rounded-[16px]') — 높이는 꼭 줄 것 */
  className?: string;
  style?: CSSProperties;
  /** 동적 지도가 실제로 보이기 시작할 때(인증 성공 + 타일 깔림) */
  onReady?: (map: NaverMapInstance, naver: NaverMapsNS) => void;
  /** 동적 지도 대신 정적 그림/주소 카드로 바뀔 때(사유) */
  onFallback?: (reason: NaverMapFallbackReason) => void;
  /** 링크를 누를 때(기본 동작 전) */
  onLinkClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  children?: ReactNode;
};

type DynState = 'idle' | 'loading' | 'ready' | 'failed';

const PIN_SVG =
  '<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg" style="display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,.28))">' +
  '<path d="M14 1C6.82 1 1 6.7 1 13.73c0 8.9 10.77 19.4 12.12 20.67a1.27 1.27 0 0 0 1.76 0C16.23 33.13 27 22.63 27 13.73 27 6.7 21.18 1 14 1Z" fill="#3180F7" stroke="#fff" stroke-width="2"/>' +
  '<circle cx="14" cy="13.5" r="4.6" fill="#fff"/></svg>';

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

/** 핀(+말풍선) HTML — 뿌리는 0×0, 핀 끝이 좌표에 오도록 위로 · 가운데로 민다(anchor 0,0) */
function markerHtml(label?: string) {
  const text = (label || '').trim().slice(0, 20);
  const bubble = text
    ? `<div style="margin-bottom:4px;max-width:180px;padding:6px 10px;border-radius:10px;background:#fff;color:#191F28;font:600 13px/18px Pretendard,-apple-system,BlinkMacSystemFont,sans-serif;letter-spacing:-0.26px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 8px rgba(0,0,0,.16)">${escapeHtml(text)}</div>`
    : '';
  return `<div style="position:relative;width:0;height:0"><div style="position:absolute;left:0;bottom:0;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;pointer-events:none">${bubble}${PIN_SVG}</div></div>`;
}

function NaverMap({
  center,
  zoom,
  markers,
  interactive = false,
  lockUntilTap = true,
  lockHint = '눌러서 지도 움직이기',
  href,
  linkLabel = '네이버 지도에서 크게 보기',
  title,
  address,
  openLabel = '네이버 지도에서 보기',
  searchQuery,
  lang = 'ko',
  imageOnly = false,
  staticPreview = true,
  zoomControl = true,
  fitToMarkers = true,
  className = '',
  style,
  onReady,
  onFallback,
  onLinkClick,
  children,
}: NaverMapProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<NaverMapInstance | null>(null);
  const nsRef = useRef<NaverMapsNS | null>(null);
  const markerObjsRef = useRef<NaverMarker[]>([]);
  const onReadyRef = useRef(onReady);
  const onFallbackRef = useRef(onFallback);
  onReadyRef.current = onReady;
  onFallbackRef.current = onFallback;

  const [nearView, setNearView] = useState(false);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [dyn, setDyn] = useState<DynState>('idle');
  // 그림 상태는 주소별로 — 주소가 바뀌면 저절로 '불러오는 중'(효과로 되돌리면 캐시 그림의 onLoad 와 엇갈려 영영 투명해질 수 있다)
  const [imgLoadedSrc, setImgLoadedSrc] = useState<string | null>(null);
  const [imgFailedSrc, setImgFailedSrc] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const fellBackRef = useRef(false);

  // ── 표시 · 가운데 · 단계 정리(대한민국 밖 · 깨진 좌표는 버림) ──
  const validMarkers = useMemo(
    () => (markers || []).filter((m) => m && isInKorea(m.lat, m.lng)).map((m) => ({ lat: m.lat, lng: m.lng, label: m.label })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(markers || [])],
  );
  const markersKey = JSON.stringify(validMarkers);
  const baseZoom = clampInt(typeof zoom === 'number' && Number.isFinite(zoom) ? zoom : NAVER_MAP_ZOOM.default, NAVER_MAP_ZOOM.min, NAVER_MAP_ZOOM.max);
  const explicitCenter = center && isInKorea(center.lat, center.lng) ? { lat: center.lat, lng: center.lng } : null;
  const view = useMemo(() => {
    if (explicitCenter) return { center: explicitCenter, zoom: baseZoom };
    if (validMarkers.length === 0) return null;
    if (validMarkers.length > 1 && fitToMarkers) {
      return fitMarkers(validMarkers, size?.w || 360, size?.h || 200, baseZoom) || { center: validMarkers[0], zoom: baseZoom };
    }
    return { center: { lat: validMarkers[0].lat, lng: validMarkers[0].lng }, zoom: baseZoom };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [explicitCenter?.lat, explicitCenter?.lng, markersKey, baseZoom, fitToMarkers, size?.w, size?.h]);
  const hasCenter = !!view;
  const centerKey = view ? `${view.center.lat},${view.center.lng},${view.zoom}` : '';

  // 기본 링크 = 네이버 지도(좌표 핀). href 는 늘 모바일 주소(SSR 과 같음), 누르는 순간 기기에 맞게
  const placeName = (title || validMarkers[0]?.label || '').trim();
  const naverPlace = useMemo(
    () => ({ lat: view?.center.lat, lng: view?.center.lng, name: placeName, address, query: view ? undefined : searchQuery }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [centerKey, placeName, address, searchQuery],
  );
  const linkHref = href === null ? null : href ?? naverMapUrl(naverPlace, { device: 'mobile' });

  const handleLinkClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      e.stopPropagation();
      onLinkClick?.(e);
      if (e.defaultPrevented || !linkHref) return;
      if (href === undefined) {
        const deviceHref = naverMapUrl(naverPlace, { device: 'auto' });
        if (openExternalMapLink(e, deviceHref)) return;
        if (e.currentTarget.getAttribute('href') !== deviceHref) e.currentTarget.setAttribute('href', deviceHref);
        return;
      }
      openExternalMapLink(e, linkHref);
    },
    [href, linkHref, naverPlace, onLinkClick],
  );

  // ── 칸 크기 재기(정적 그림 크기 · 지도 다시 맞추기) ──
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      // 레이아웃 크기(offsetWidth)로 잰다 — getBoundingClientRect 는 transform 까지 곱해서, 채팅 말풍선이 커지는 애니메이션(scale) 도중에
      // 재면 칸을 작게 알고(ResizeObserver 는 transform 변화엔 안 깨어남) 흐린 작은 그림을 받는다(261012 채팅 실측: 280×120 칸이 200×100)
      const r = el.getBoundingClientRect();
      const w = Math.max(1, Math.round(el.offsetWidth || r.width || 360));
      const h = Math.max(1, Math.round(el.offsetHeight || r.height || 200));
      setSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
      try { mapRef.current?.autoResize(); } catch { /* 부서진 지도 */ }
    };
    measure();
    if (typeof ResizeObserver !== 'function') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── 다이나믹맵 안 SDK 자체 링크(NAVER 로고 → 고지 화면 등) — 안드로이드 앱이면 intent:// 로 바깥에 ──
  //    캡처 단계에서 먼저 본다(SDK 가 제 처리기에서 전파를 끊어도). 앱이 아니면 아무것도 안 함(링크 기본 동작 그대로)
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onClick = (e: Event) => {
      const t = e.target as Element | null;
      const a = t && typeof t.closest === 'function' ? (t.closest('[data-naver-map-layer] a[href]') as HTMLAnchorElement | null) : null;
      if (!a || !el.contains(a)) return;
      const href = a.href || '';
      if (!/^https?:\/\//i.test(href)) return;
      try { if (new URL(href).host === window.location.host) return; } catch { return; }
      // 앱에서 대신 열었으면 SDK 처리기(window.open 등)까지 가지 않게 여기서 멈춘다.
      // SDK '더보기' 안 OpenStreetMap 저작권 링크는 http:// — 앱(평문 http 차단)에 넘길 땐 https 로 올린다(같은 주소가 https 로도 열린다)
      if (openExternalMapLink(e, href.replace(/^http:\/\//i, 'https://'))) e.stopPropagation();
    };
    el.addEventListener('click', onClick, true);
    return () => el.removeEventListener('click', onClick, true);
  }, []);

  // ── 화면 근처에 올 때만 무거운 일 · 화면 밖으로 나가면 다시 잠금 ──
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    if (typeof IntersectionObserver !== 'function') { setNearView(true); return; }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) setNearView(true);
          else setUnlocked(false);
        });
      },
      { rootMargin: '300px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const fallback = useCallback((reason: NaverMapFallbackReason) => {
    if (fellBackRef.current) return; // 인증 실패 신호는 여러 갈래로 온다 — 한 번만
    fellBackRef.current = true;
    setDyn('failed');
    try { onFallbackRef.current?.(reason); } catch { /* 듣는 쪽 오류 무시 */ }
  }, []);

  // 가운데가 없으면(좌표 없음 · 대한민국 밖) 처음부터 주소 카드
  useEffect(() => {
    if (!hasCenter) onFallbackRef.current?.('no_center');
  }, [hasCenter]);

  // ── 표시 다시 그리기 ──
  const drawMarkers = useCallback(() => {
    const naver = nsRef.current;
    const map = mapRef.current;
    markerObjsRef.current.forEach((m) => { try { m.setMap(null); } catch { /* 무시 */ } });
    markerObjsRef.current = [];
    if (!naver || !map) return;
    validMarkers.forEach((m, i) => {
      try {
        markerObjsRef.current.push(
          new naver.Marker({
            position: new naver.LatLng(m.lat, m.lng),
            map,
            icon: { content: markerHtml(m.label), anchor: new naver.Point(0, 0) },
            clickable: false,
            zIndex: 100 + i,
          }),
        );
      } catch { /* 표시 하나 실패는 넘어간다 */ }
    });
  }, [validMarkers]);

  const applyView = useCallback(() => {
    const naver = nsRef.current;
    const map = mapRef.current;
    if (!naver || !map || !view) return;
    try {
      if (!explicitCenter && validMarkers.length > 1 && fitToMarkers) {
        const lats = validMarkers.map((m) => m.lat);
        const lngs = validMarkers.map((m) => m.lng);
        const bounds = new naver.LatLngBounds(
          new naver.LatLng(Math.min(...lats), Math.min(...lngs)),
          new naver.LatLng(Math.max(...lats), Math.max(...lngs)),
        );
        map.fitBounds(bounds, { top: 56, right: 40, bottom: 40, left: 40 });
        if (map.getZoom() > baseZoom) map.setZoom(baseZoom, false);
      } else {
        map.setCenter(new naver.LatLng(view.center.lat, view.center.lng));
        map.setZoom(view.zoom, false);
      }
    } catch { /* 무시 */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerKey, markersKey, fitToMarkers, baseZoom]);

  // ── 동적 지도 만들기 / 부수기 ──
  const dynFailed = dyn === 'failed';
  useEffect(() => {
    if (!nearView || imageOnly || dynFailed || !hasCenter) return;
    const blocked = naverDynamicMapBlockReason();
    if (blocked) {
      fallback(blocked);
      return;
    }
    let cancelled = false;
    setDyn('loading');
    const offFailure = onNaverMapFailure((reason) => { if (!cancelled) fallback(reason); });

    loadNaverMaps()
      .then(async (naver) => {
        const el = mapElRef.current;
        if (cancelled || !el || !view) return;
        const lockedStatic = !interactive;
        const map = new naver.Map(el, {
          center: new naver.LatLng(view.center.lat, view.center.lng),
          zoom: view.zoom,
          minZoom: NAVER_MAP_ZOOM.min,
          maxZoom: NAVER_MAP_ZOOM.max,
          draggable: !lockedStatic,
          pinchZoom: !lockedStatic,
          scrollWheel: !lockedStatic,
          keyboardShortcuts: false,
          disableDoubleTapZoom: lockedStatic,
          disableDoubleClickZoom: lockedStatic,
          disableTwoFingerTapZoom: lockedStatic,
          zoomControl: !lockedStatic && zoomControl,
          zoomControlOptions: { position: naver.Position.TOP_RIGHT, style: naver.ZoomControlStyle?.SMALL },
          mapTypeControl: false,
          scaleControl: false,
          // 네이버 로고 · 저작권 표시는 약관상 가리지 않는다 — 정적 그림처럼 왼쪽 아래로 모아 오른쪽 아래(칩 자리)를 비운다
          logoControl: true,
          logoControlOptions: { position: naver.Position.BOTTOM_LEFT },
          mapDataControl: true,
          mapDataControlOptions: { position: naver.Position.BOTTOM_LEFT },
          background: '#F2F4F6',
        });
        noteNaverMapCreated();
        mapRef.current = map;
        nsRef.current = naver;
        drawMarkers();
        applyView();

        // 타일이 깔리고(늦어도 4초) + 인증이 정해지면 보인다
        const tiles = new Promise<void>((resolve) => {
          const t = setTimeout(resolve, 4000);
          try { naver.Event.once(map, 'tilesloaded', () => { clearTimeout(t); resolve(); }); } catch { resolve(); }
        });
        const [, auth] = await Promise.all([tiles, whenNaverMapAuthSettled()]);
        if (cancelled) return;
        if (auth === 'failed') { fallback('auth'); return; }
        setDyn('ready');
        try { onReadyRef.current?.(map, naver); } catch { /* 듣는 쪽 오류 무시 */ }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        fallback(err instanceof NaverMapLoadError ? err.reason : 'network');
      });

    return () => {
      cancelled = true;
      offFailure();
      // 인증 실패면 SDK 가 이 지도를 스스로 부수고(약 0.3초 뒤) naver.maps 를 비운다 — 우리가 먼저 destroy · setMap 을 부르면
      // SDK 의 뒷정리 타이머가 이미 부서진 지도를 만지다 SDK 안에서 예외가 났다. 그때는 손대지 않고 참조만 놓는다(층은 숨김 상태로 남는다)
      const sdkOwnsTeardown = getNaverMapAuthState() === 'failed';
      if (!sdkOwnsTeardown) {
        markerObjsRef.current.forEach((m) => { try { m.setMap(null); } catch { /* 무시 */ } });
        try { mapRef.current?.destroy(); } catch { /* SDK 가 먼저 부쉈을 수 있다 */ }
      }
      markerObjsRef.current = [];
      mapRef.current = null;
      nsRef.current = null;
    };
    // 가운데 · 표시 바뀜은 아래 효과가 지도를 살린 채 옮긴다. 모드(interactive)가 바뀌면 다시 만든다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearView, imageOnly, dynFailed, hasCenter, interactive, zoomControl]);

  useEffect(() => {
    if (!mapRef.current) return;
    applyView();
    drawMarkers();
  }, [applyView, drawMarkers]);

  // ── 정적 그림 주소 · 깔 자리 ──
  //    칸보다 최대 9px 크게(10px 단위) 받아 늘리지 않고 왼쪽 아래에 붙인다 → 로고 · 저작권이 늘 보이고, 같은 곳은 기기 폭이 달라도 같은 그림(캐시).
  //    핀은 가운데에서 오른쪽 · 위로 4.5px 안쪽만 비켜난다. 한도보다 큰 칸(s>1)만 가운데를 옮겨 받아 핀을 칸 가운데에 맞춘다
  const plan = useMemo(() => (size ? planStaticImage(size.w, size.h) : null), [size?.w, size?.h]);
  const staticSrc = useMemo(() => {
    if (!view || !size || !plan) return null;
    const center = plan.s > 1 ? staticImageCenterForBox(view.center, view.zoom, plan, size.w, size.h) : view.center;
    return naverStaticMapSrc({ center, level: view.zoom, width: plan.w, height: plan.h, markers: validMarkers, lang });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerKey, plan, markersKey, lang]);
  const imgState: 'loading' | 'loaded' | 'failed' =
    staticSrc && imgFailedSrc === staticSrc ? 'failed' : staticSrc && imgLoadedSrc === staticSrc ? 'loaded' : 'loading';

  const dynamicOn = !imageOnly && hasCenter && !dynFailed;
  const ready = dyn === 'ready';
  // 미리보기 그림은 동적 지도가 덮은 뒤에도 밑에 둔다 — 서서히 덮는 동안 빈 바탕이 비치지 않고, 나중에 실패해도 그대로 남는다
  const showImage = !!staticSrc && imgState !== 'failed' && (imageOnly || dynFailed || staticPreview);
  const showCard = !hasCenter || ((imageOnly || dynFailed) && (!staticSrc || imgState === 'failed') && !!size);
  const linkActive = !!linkHref && (!interactive || !dynamicOn);
  const lockActive = interactive && dynamicOn && ready && lockUntilTap && !unlocked;
  const mapTakesPointer = interactive && ready && (!lockUntilTap || unlocked);

  useEffect(() => {
    if (imgState === 'failed' && (imageOnly || dynFailed)) onFallbackRef.current?.('image');
  }, [imgState, imageOnly, dynFailed]);

  const a11yName = title || address || '지도';
  // 주소 카드 크기 — 칸 높이에 맞춰(채팅 예약 카드 120px · 고른 장소 썸네일 56px 에서도 넘치지 않게)
  const cardSize: 'full' | 'compact' | 'pin' = !size || size.h >= 150 ? 'full' : size.h >= 90 && size.w >= 140 ? 'compact' : 'pin';

  return (
    <div
      ref={boxRef}
      className={`relative isolate overflow-hidden bg-[#F2F4F6] ${className}`}
      style={style}
      onMouseLeave={() => setUnlocked(false)}
      data-naver-map={dyn}
    >
      {/* ① 바탕: 연회색 숨쉬기(그림 오기 전) */}
      {!showCard && !ready && imgState !== 'loaded' && (
        <div aria-hidden className="absolute inset-0 animate-pulse bg-[#EEF0F3]" />
      )}
      {showImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={staticSrc}
          src={staticSrc!}
          alt={dynamicOn && !dynFailed ? '' : `${a11yName} 지도`}
          aria-hidden={dynamicOn && !dynFailed ? true : undefined}
          draggable={false}
          loading="lazy"
          decoding="async"
          onLoad={() => setImgLoadedSrc(staticSrc)}
          onError={() => setImgFailedSrc(staticSrc)}
          className="absolute bottom-0 left-0 select-none transition-opacity duration-300"
          style={{
            width: plan ? `${plan.w * plan.s}px` : '100%',
            height: plan ? `${plan.h * plan.s}px` : '100%',
            maxWidth: 'none',
            opacity: imgState === 'loaded' ? 1 : 0,
            WebkitTouchCallout: 'none',
          }}
        />
      )}
      {showCard && (
        cardSize === 'pin' ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <MapPin className="h-5 w-5 text-[#3180F7]" />
          </div>
        ) : (
          <div className={`absolute inset-0 flex flex-col items-center justify-center text-center ${cardSize === 'compact' ? 'gap-1 px-4' : 'gap-2 px-5'}`}>
            <span className={`flex shrink-0 items-center justify-center rounded-full bg-white text-[#3180F7] shadow-[0_2px_10px_rgba(0,0,0,0.06)] ${cardSize === 'compact' ? 'h-8 w-8' : 'h-11 w-11'}`}>
              <MapPin className={cardSize === 'compact' ? 'h-4 w-4' : 'h-5 w-5'} />
            </span>
            {(title || address) && (
              <span className={`max-w-full break-keep font-semibold tracking-[-0.2px] text-[#333D4B] [overflow-wrap:anywhere] ${cardSize === 'compact' ? 'line-clamp-1 text-[14px] leading-[1.4]' : 'line-clamp-2 text-[15px] leading-[1.45]'}`}>
                {title || address}
              </span>
            )}
            {title && address && cardSize === 'full' && (
              <span className="line-clamp-2 max-w-full break-keep text-[13px] leading-[1.45] text-[#6B7684] [overflow-wrap:anywhere]">{address}</span>
            )}
            {linkHref && <span className={`font-semibold text-[#3180F7] ${cardSize === 'compact' ? 'text-[12px]' : 'text-[13px]'}`}>{openLabel}</span>}
          </div>
        )
      )}

      {/* ② 동적 지도 — 인증 · 타일 전엔 투명, 실패하면 숨김(SDK 의 '인증 실패' 판이 보이지 않게) */}
      {/*    SDK 는 지도 칸에 position:relative 를 덮어써서(absolute inset-0 이 풀려 높이 0 — 261012 실측) 바깥 틀(absolute)과 지도 칸(100%)을 나눈다 */}
      {dynamicOn || dyn === 'failed' ? (
        <div
          data-naver-map-layer=""
          aria-hidden={!interactive}
          className="absolute inset-0 transition-opacity duration-300"
          style={{
            opacity: ready && !dynFailed ? 1 : 0,
            visibility: dynFailed ? 'hidden' : 'visible',
            pointerEvents: mapTakesPointer ? 'auto' : 'none',
          }}
        >
          <div ref={mapElRef} style={{ width: '100%', height: '100%' }} />
        </div>
      ) : null}

      {/* ③ 덮개 */}
      {linkActive ? (
        <a
          href={linkHref!}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleLinkClick}
          draggable={false}
          aria-label={`${a11yName} — ${linkLabel}`}
          className="absolute inset-0 z-[2] block [-webkit-tap-highlight-color:transparent]"
          style={{ WebkitTouchCallout: 'none' }}
        />
      ) : !interactive || !dynamicOn ? (
        // 링크가 없어도 지도가 손가락을 먹지 않게(페이지 스크롤 그대로)
        <div aria-hidden className="absolute inset-0 z-[2]" />
      ) : null}
      {/*    잠금 알약은 아래 40px — 왼쪽 아래 네이버 로고 · 저작권 줄과 겹치지 않게 */}
      {lockActive && (
        <button
          type="button"
          onClick={() => setUnlocked(true)}
          aria-label={lockHint}
          className="group absolute inset-0 z-[2] flex cursor-pointer items-end justify-center border-0 bg-transparent pb-10 [-webkit-tap-highlight-color:transparent]"
        >
          <span className="h-[34px] rounded-full bg-[#191F28] px-[14px] text-[13px] font-semibold leading-[34px] tracking-[-0.26px] text-white opacity-[0.92] shadow-[0_6px_16px_-6px_rgba(0,0,0,0.35)] transition-[transform,opacity] duration-300 group-hover:-translate-y-0.5 group-hover:opacity-100">
            {lockHint}
          </span>
        </button>
      )}

      {/* ④ 위에 얹을 것 */}
      {children ? <div className="pointer-events-none absolute inset-0 z-[3] [&>*]:pointer-events-auto">{children}</div> : null}
    </div>
  );
}

export default NaverMap;
export { NaverMap };
