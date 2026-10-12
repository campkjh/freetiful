/**
 * 네이버 지도 공용 규칙 — 서버(프록시 /api/naver-map/*)와 화면(NaverMap)이 같은 값을 쓴다
 * (261012 사장 '네이버 다이나믹맵인데 이거 네이버 맵좀 전부 다 적용해줘').
 *
 *  · 순수 함수·상수만(React·window·비밀 없음) — 서버 처리기와 클라이언트 둘 다 import 한다.
 *  · 범위는 대한민국 안(제주 마라도 ~ 독도 · 백령도)만. 밖이면 프록시가 400 → 남이 우리 한도로 세계 지도를 뽑아 가지 못한다.
 *  · 좌표는 소수 5자리(약 1m)로 반올림해 같은 곳이면 같은 주소 → CDN 캐시 적중이 오른다.
 */

/** 대한민국 경계 상자(여유 조금) — 남 마라도 33.11 · 북 강원 고성 38.61 · 서 백령도 124.6 · 동 독도 131.87 */
export const KOREA_BOUNDS = { minLat: 32.8, maxLat: 38.9, minLng: 124.0, maxLng: 132.2 } as const;

/** 지도 확대 단계 — 늘 SDK zoom 뜻(웹 메르카토르 256px 기준). 정적 프록시는 위쪽에 level = zoom - 1 로 보낸다(네이버 static level 이 한 단계 작음) */
export const NAVER_MAP_ZOOM = { min: 6, max: 20, default: 16 } as const;

/**
 * 정적 지도 그림 크기(CSS px, 배율 곱하기 전) — 네이버 한도는 1~1024, 우리는 10px 단위 40~1020 만 받는다
 * (261012 검수: 아무 크기나 받으면 같은 곳 그림이 기기 폭마다 따로 캐시되고, 남이 크기만 바꿔 우리 한도를 태울 수 있다).
 * 넓이(w×h)도 1020×640 까지 — 가장 큰 쓰임(비즈 PC 오시는길 · 어드민 위치 칸)도 이 안에 들고, jpg 한 장이 데이터 캐시(2MB) 안에 든다.
 */
export const NAVER_STATIC_SIZE = { min: 40, max: 1020, step: 10 } as const;
export const NAVER_STATIC_MAX_AREA = 1020 * 640;

/** 정적 지도 한 장에 찍는 표시 최대 개수 · 표시 글자 최대 길이 */
export const NAVER_STATIC_MAX_MARKERS = 5;
export const NAVER_MARKER_LABEL_MAX = 20;

/** 표시 색 — 프리티풀 파랑(themeColor #3180F7) */
export const NAVER_MARKER_COLOR = '3180F7';

export type NaverMapLang = 'ko' | 'en' | 'ja' | 'zh';
export const NAVER_MAP_LANGS: readonly NaverMapLang[] = ['ko', 'en', 'ja', 'zh'];

export type LatLngLiteral = { lat: number; lng: number };
export type MapMarkerLiteral = LatLngLiteral & { label?: string };

/** 숫자로 읽기 — 빈 값·NaN·무한대는 null */
export function toFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** 대한민국 안 좌표인가(0,0 같은 빈 좌표·문자열·범위 밖 거름) */
export function isInKorea(lat: unknown, lng: unknown): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat >= KOREA_BOUNDS.minLat && lat <= KOREA_BOUNDS.maxLat && lng >= KOREA_BOUNDS.minLng && lng <= KOREA_BOUNDS.maxLng;
}

/** 소수 5자리 반올림(약 1.1m) — 캐시 키를 고르게 */
export function roundCoord(n: number): number {
  return Math.round(n * 1e5) / 1e5;
}

/** 정수로 자르고 범위에 가두기 */
export function clampInt(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * 표시 글자 다듬기 — 네이버 static 표시 문법의 구분자(| : ,) · 줄바꿈 · 이모지(BMP 밖)를 빼고 20자로.
 * 빈 글자면 ''.
 */
export function cleanMarkerLabel(label: unknown): string {
  if (typeof label !== 'string') return '';
  return label
    .replace(/[\u0000-\u001f\u007f|:,;]+/g, ' ')
    .replace(/[\uD800-\uDFFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAVER_MARKER_LABEL_MAX);
}

/**
 * 여러 표시를 한 칸(w×h px)에 담는 확대 단계와 가운데(웹 메르카토르, 256px 타일 기준 — SDK zoom 과 같은 척도).
 * 표시 하나면 그 자리 + fallbackZoom.
 */
export function fitMarkers(
  markers: LatLngLiteral[],
  w: number,
  h: number,
  fallbackZoom: number = NAVER_MAP_ZOOM.default,
  paddingPx = 48,
): { center: LatLngLiteral; zoom: number } | null {
  const pts = markers.filter((m) => isInKorea(m.lat, m.lng));
  if (pts.length === 0) return null;
  if (pts.length === 1) return { center: { lat: pts[0].lat, lng: pts[0].lng }, zoom: fallbackZoom };
  const lats = pts.map((p) => p.lat);
  const lngs = pts.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const mercY = (lat: number) => {
    const s = Math.sin((lat * Math.PI) / 180);
    return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
  };
  const dx = (maxLng - minLng) / 360; // 세계 폭 대비
  const dy = Math.abs(mercY(minLat) - mercY(maxLat));
  const availW = Math.max(16, w - paddingPx * 2);
  const availH = Math.max(16, h - paddingPx * 2);
  // 다 들어가는 가장 큰 단계(못 찾으면 최소 단계). 표시끼리 아주 가까우면 기본 단계보다 더 들어가지 않는다
  let zoom: number = NAVER_MAP_ZOOM.min;
  for (let z = NAVER_MAP_ZOOM.max; z >= NAVER_MAP_ZOOM.min; z--) {
    const world = 256 * 2 ** z;
    if (dx * world <= availW && dy * world <= availH) { zoom = z; break; }
  }
  return {
    center: { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 },
    zoom: Math.min(zoom, fallbackZoom),
  };
}

export type NaverStaticMapOptions = {
  center: LatLngLiteral;
  /** 확대 단계 6~20 (기본 16) — SDK zoom 뜻 그대로(프록시가 네이버 static level 로 바꾼다) */
  level?: number;
  /** CSS px — 10px 단위로 올려 40~1020 에 가둔다(넓이 한도를 넘으면 높이를 줄인다). 칸에 맞추는 계산은 planStaticImage */
  width: number;
  height: number;
  markers?: MapMarkerLiteral[];
  /** 1 | 2 (기본 2 = 레티나) */
  scale?: 1 | 2;
  lang?: NaverMapLang;
};

/** 10px 단위로 올려 한도 안에 */
export function snapStaticSize(cssPx: number): number {
  const n = Math.ceil(Math.max(1, Number.isFinite(cssPx) ? cssPx : 1) / NAVER_STATIC_SIZE.step) * NAVER_STATIC_SIZE.step;
  return Math.min(NAVER_STATIC_SIZE.max, Math.max(NAVER_STATIC_SIZE.min, n));
}

/**
 * 정적 지도 주소의 칸들 — 화면(naverStaticMapSrc)과 서버 검사(/api/naver-map/static 의 '정규 주소' 비교)가 같은 함수를 쓴다.
 * 순서 · 숫자 꼴(소수 5자리 · 앞 0 없음) · 생략 규칙(lang=ko 생략)이 하나뿐이라 CDN 키와 네이버 쪽 요청이 1:1 로 맞는다.
 * 가운데가 대한민국 밖이면 null.
 */
export function staticQueryParams(o: NaverStaticMapOptions): URLSearchParams | null {
  if (!o || !o.center || !isInKorea(o.center.lat, o.center.lng)) return null;
  const w = snapStaticSize(o.width);
  let h = snapStaticSize(o.height);
  if (w * h > NAVER_STATIC_MAX_AREA) {
    h = Math.max(NAVER_STATIC_SIZE.min, Math.floor(NAVER_STATIC_MAX_AREA / w / NAVER_STATIC_SIZE.step) * NAVER_STATIC_SIZE.step);
  }
  const p = new URLSearchParams();
  p.set('lat', String(roundCoord(o.center.lat)));
  p.set('lng', String(roundCoord(o.center.lng)));
  p.set('level', String(clampInt(o.level ?? NAVER_MAP_ZOOM.default, NAVER_MAP_ZOOM.min, NAVER_MAP_ZOOM.max)));
  p.set('w', String(w));
  p.set('h', String(h));
  p.set('scale', o.scale === 1 ? '1' : '2');
  if (o.lang && o.lang !== 'ko' && NAVER_MAP_LANGS.includes(o.lang)) p.set('lang', o.lang);
  (o.markers || [])
    .filter((m) => isInKorea(m.lat, m.lng))
    .slice(0, NAVER_STATIC_MAX_MARKERS)
    .forEach((m) => {
      const label = cleanMarkerLabel(m.label);
      p.append('m', `${roundCoord(m.lat)},${roundCoord(m.lng)}${label ? `,${label}` : ''}`);
    });
  return p;
}

/**
 * 우리 정적 지도 프록시 주소(/api/naver-map/static?...) — 서버 검사와 같은 규칙으로 미리 가둔다.
 * 가운데가 대한민국 밖이면 null(그림 대신 주소 카드로).
 */
export function naverStaticMapSrc(o: NaverStaticMapOptions): string | null {
  const p = staticQueryParams(o);
  return p ? `/api/naver-map/static?${p.toString()}` : null;
}

// ─── 칸에 정적 그림 깔기(261012 검수: 로고 잘림) ───
//  예전엔 그림을 50px 단위로 크게 받아 object-fit: cover 가운데 맞춤으로 그려, 칸이 50의 배수가 아니면 왼쪽 아래 'NAVER' 로고가
//  잘렸다(393 아이폰 업체 상세 'AVER' · 채팅 말풍선 로고 아래 절반 · 어드민 1064px 칸은 로고가 아예 안 보임). 로고 · 저작권 표시는 약관상 가리면 안 된다.
//  → 그림은 칸 크기를 10px 단위로 올려 받고(칸보다 최대 9px 큼) 늘리지 않은 채 칸의 '왼쪽 아래'에 붙인다 — 로고가 늘 칸 안.
//    잘리는 건 오른쪽 · 위 9px 안쪽뿐이라 핀은 가운데에서 4.5px 안으로만 비켜난다(같은 곳이면 기기 폭이 달라도 같은 그림 → 캐시 적중).
//  → 칸이 한도(1020 · 넓이 1020×640)보다 크면 한도 안에서 받아 비율 그대로 늘려(s>1) 왼쪽 아래에 붙이고, 가운데를 옮겨 받아 핀이 칸 가운데에 오게 한다.

/** 칸(CSS px) → 받을 그림 크기 w×h(10px 단위) + 늘릴 배율 s(1 = 그대로). 그림 w·s × h·s 는 늘 칸을 덮는다 */
export function planStaticImage(boxW: number, boxH: number): { w: number; h: number; s: number } {
  const bw = Math.max(1, Math.round(Number.isFinite(boxW) ? boxW : 1));
  const bh = Math.max(1, Math.round(Number.isFinite(boxH) ? boxH : 1));
  const w0 = snapStaticSize(bw);
  const h0 = snapStaticSize(bh);
  if (w0 >= bw && h0 >= bh && w0 * h0 <= NAVER_STATIC_MAX_AREA) return { w: w0, h: h0, s: 1 };
  // 한도보다 큰 칸 — 비율을 지키며 한도 안으로 줄여 받고, 화면에서 s 배 늘린다
  const k = Math.max(bw / NAVER_STATIC_SIZE.max, bh / NAVER_STATIC_SIZE.max, Math.sqrt((bw * bh) / NAVER_STATIC_MAX_AREA), 1);
  const step = NAVER_STATIC_SIZE.step;
  const fit = (n: number, round: (x: number) => number) =>
    Math.min(NAVER_STATIC_SIZE.max, Math.max(NAVER_STATIC_SIZE.min, round(n / step) * step));
  // 올림이 한도 안이면 올림(덜 늘림), 아니면 내림
  let w = fit(bw / k, Math.ceil);
  let h = fit(bh / k, Math.ceil);
  if (w * h > NAVER_STATIC_MAX_AREA) { w = fit(bw / k, Math.floor); h = fit(bh / k, Math.floor); }
  const s = Math.max(bw / w, bh / h, 1);
  return { w, h, s: Math.ceil(s * 1000) / 1000 };
}

/** 위경도 → 줌 z 의 전역 픽셀(웹 메르카토르 256px — SDK zoom · 정적 그림(CSS px) 척도) */
export function latLngToWorldPx(lat: number, lng: number, z: number): { x: number; y: number } {
  const scale = 256 * 2 ** z;
  const sin = Math.sin((Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180);
  return { x: ((lng + 180) / 360) * scale, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale };
}

/** 줌 z 의 전역 픽셀 → 위경도 */
export function worldPxToLatLng(x: number, y: number, z: number): LatLngLiteral {
  const scale = 256 * 2 ** z;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  return { lat: (180 / Math.PI) * Math.atan(Math.sinh(n)), lng: (x / scale) * 360 - 180 };
}

/**
 * 왼쪽 아래에 붙여 그릴 그림의 가운데 — 칸에 보이는 부분의 한가운데가 center 가 되게 그림 가운데를 옮긴다.
 * (보이는 부분 = 그림의 왼쪽 bw/s · 아래 bh/s 만큼 → 그 가운데가 그림 가운데보다 왼쪽 · 아래)
 */
export function staticImageCenterForBox(
  center: LatLngLiteral,
  zoom: number,
  plan: { w: number; h: number; s: number },
  boxW: number,
  boxH: number,
): LatLngLiteral {
  const p = latLngToWorldPx(center.lat, center.lng, zoom);
  const dx = plan.w / 2 - boxW / (2 * plan.s);
  const dy = plan.h / 2 - boxH / (2 * plan.s);
  return worldPxToLatLng(p.x + dx, p.y - dy, zoom);
}
