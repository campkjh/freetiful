// 네이버 지도 서버 프록시 공용(261012 사장 '네이버 다이나믹맵인데 이거 네이버 맵좀 전부 다 적용해줘').
//  · 이 파일은 서버 처리기(/api/naver-map/*/route.ts)만 import 한다 — '_lib' 폴더라 주소(라우트)도 아니다.
//  · 비밀키 NAVER_MAP_CLIENT_SECRET 은 여기서만 읽는다. 응답·로그·오류 메시지에 절대 싣지 않는다.
//  · 새 게이트웨이 maps.apigw.ntruss.com 만(옛 naveropenapi.apigw.ntruss.com 은 이 키로 401 — 261012 curl 확인).
//  · 남용 방지: ① 다른 사이트가 우리 주소를 끌어다 쓰면(Sec-Fetch-Site: cross-site) 403 ② 정한 칸 말고 다른 칸이 오면 400
//    ③ 위쪽 응답은 Next 데이터 캐시(revalidate)에, 우리 응답은 CDN(s-maxage)에 오래 둔다 → 같은 요청은 네이버 한도를 안 쓴다.
//    ④ (261012 검수) IP 별 호출 한도(rateLimit) — 캐시를 비켜 함수까지 온 요청만 센다. 서버 인스턴스마다 따로 세는 '최소 방어'라
//       진짜 한도는 Vercel Firewall 규칙(IP 당 분 N회) · NCP 콘솔 월 사용량 한도로 함께 건다.
//    ⑤ 네이버가 401 · 429 · 5xx 를 주면 경로 + 상태 코드만 로그(비밀키 · 검색어 · 좌표는 안 남김, 같은 오류는 1분에 한 번).
import { NextResponse, type NextRequest } from 'next/server';

const GATEWAY = 'https://maps.apigw.ntruss.com';
const UPSTREAM_TIMEOUT_MS = 6000;

/** 키 두 개(공개 id + 서버 비밀) — 하나라도 없으면 null(→ 503) */
function naverKeys(): { id: string; secret: string } | null {
  const id = (process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || '').trim();
  const secret = (process.env.NAVER_MAP_CLIENT_SECRET || '').trim();
  return id && secret ? { id, secret } : null;
}

export class UpstreamError extends Error {
  readonly status: number;
  constructor(kind: 'unavailable' | 'upstream' | 'timeout', status: number) {
    super(kind);
    this.name = 'UpstreamError';
    this.status = status;
  }
}

/**
 * 네이버 지도 API 부르기. path 는 '/map-static/v2/raster' 처럼 고정 문자열만(사용자 입력으로 만들지 않는다).
 * revalidate(초) 동안 Next 데이터 캐시에 둔다. 키 없음 = UpstreamError('unavailable', 503), 그 밖 실패 = 502.
 */
export async function naverFetch(path: string, params: URLSearchParams, revalidate: number): Promise<Response> {
  const keys = naverKeys();
  if (!keys) throw new UpstreamError('unavailable', 503);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const res = await fetch(`${GATEWAY}${path}?${params.toString()}`, {
      headers: {
        'x-ncp-apigw-api-key-id': keys.id,
        'x-ncp-apigw-api-key': keys.secret,
        Accept: '*/*',
      },
      signal: ctrl.signal,
      next: { revalidate },
    });
    if (!res.ok) {
      warnUpstream(path, res.status);
      throw new UpstreamError('upstream', 502);
    }
    return res;
  } catch (e) {
    if (e instanceof UpstreamError) throw e;
    const kind = ctrl.signal.aborted ? 'timeout' : 'upstream';
    warnUpstream(path, kind === 'timeout' ? 'timeout' : 'network');
    throw new UpstreamError(kind, 502);
  } finally {
    clearTimeout(timer);
  }
}

// ─── 위쪽 오류 로그(경로 + 상태만, 같은 것은 1분에 한 번) ───
const warnedAt = new Map<string, number>();
/** 네이버 · 카카오 같은 바깥 지도 API 실패 기록 — path 는 고정 문자열(사용자 입력 X), status 는 숫자 또는 'timeout' · 'network' */
export function warnUpstream(path: string, status: number | string) {
  const key = `${path}|${status}`;
  const now = Date.now();
  if (now - (warnedAt.get(key) || 0) < 60_000) return;
  warnedAt.set(key, now);
  if (warnedAt.size > 200) warnedAt.clear();
  console.warn('[naver-map] upstream', path, status);
}

// ─── IP 별 호출 한도(인스턴스 메모리 — 최소 방어) ───
type Window2 = { minuteAt: number; minute: number; dayAt: number; day: number };
const buckets = new Map<string, Map<string, Window2>>();
let blockedLogAt = 0;

function clientIp(req: NextRequest): string {
  // Vercel 은 x-real-ip · x-forwarded-for 를 실제 접속 IP 로 덮어쓴다(클라이언트가 보낸 값은 버림)
  const real = (req.headers.get('x-real-ip') || '').trim();
  if (real) return real.slice(0, 64);
  const fwd = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  return (fwd || 'local').slice(0, 64);
}

/**
 * IP 하나가 이 경로를 1분 perMinute · 하루 perDay 번 넘게 부르면 429(캐시 안 함 · Retry-After).
 * 사람 손으로는 닿지 않는 숫자로 잡는다(지도 끌기 · 확대를 쉬지 않고 해도 분 수십 번).
 */
export function rateLimit(req: NextRequest, name: string, limits: { perMinute: number; perDay: number }) {
  const ip = clientIp(req);
  const now = Date.now();
  let table = buckets.get(name);
  if (!table) { table = new Map(); buckets.set(name, table); }
  let w = table.get(ip);
  if (!w) {
    if (table.size > 20000) {
      // 오래된 칸 정리(하루 지난 것) — 그래도 많으면 통째로 비운다
      table.forEach((v, k) => { if (now - v.dayAt > 86_400_000) table!.delete(k); });
      if (table.size > 20000) table.clear();
    }
    w = { minuteAt: now, minute: 0, dayAt: now, day: 0 };
    table.set(ip, w);
  }
  if (now - w.minuteAt >= 60_000) { w.minuteAt = now; w.minute = 0; }
  if (now - w.dayAt >= 86_400_000) { w.dayAt = now; w.day = 0; }
  w.minute += 1;
  w.day += 1;
  if (w.minute > limits.perMinute || w.day > limits.perDay) {
    if (now - blockedLogAt > 60_000) { blockedLogAt = now; console.warn('[naver-map] rate-limited', name); }
    const retry = w.minute > limits.perMinute ? Math.ceil((60_000 - (now - w.minuteAt)) / 1000) : 3600;
    return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': String(Math.max(1, retry)) } });
  }
  return null;
}

/** 경로별 한도 — 정적 그림은 지도 끌기 · 확대마다 한 장, 역지오코딩은 멈출 때마다 한 번 */
export const RATE = {
  static: { perMinute: 120, perDay: 1500 },
  reverse: { perMinute: 60, perDay: 1000 },
  geocode: { perMinute: 30, perDay: 400 },
  placeSearch: { perMinute: 40, perDay: 600 },
} as const;

/** 오류 응답(캐시 안 함) — 본문에는 짧은 코드만 */
export function errorJson(code: string, status: number) {
  return NextResponse.json({ error: code }, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** UpstreamError → 오류 응답 */
export function upstreamErrorResponse(e: unknown) {
  if (e instanceof UpstreamError) return errorJson(e.message, e.status);
  return errorJson('upstream', 502);
}

/**
 * 다른 사이트에서 끌어다 쓰기 막기 — 브라우저가 붙이는 Sec-Fetch-Site 가 cross-site 면 403.
 * (머리글이 없는 경우 — curl · 아주 옛 브라우저 — 는 가릴 수 없어 통과. 우리 화면 · 앱 웹뷰는 same-origin)
 */
export function rejectCrossSite(req: NextRequest) {
  const site = (req.headers.get('sec-fetch-site') || '').toLowerCase();
  if (site === 'cross-site') return errorJson('forbidden', 403);
  return null;
}

/**
 * 정한 칸만 받는다 — 모르는 칸 · 너무 긴 주소는 400 (캐시 깨기용 잡값 막기).
 * maxQueryLength 는 '인코딩된' 주소 길이 — 한글 한 글자가 %XX%XX%XX 9자가 되니 글자 수 한도 × 9 + 여유로 잡는다(글자 수는 각 처리기가 따로 본다).
 */
export function rejectUnknownParams(req: NextRequest, allowed: readonly string[], maxQueryLength = 800) {
  const raw = req.nextUrl.search || '';
  if (raw.length > maxQueryLength) return errorJson('too_long', 400);
  for (const key of req.nextUrl.searchParams.keys()) {
    if (!allowed.includes(key)) return errorJson('bad_param', 400);
  }
  return null;
}

/** 값 하나만 와야 하는 칸이 여러 번 오면 400 */
export function single(req: NextRequest, key: string): string | null | undefined {
  const all = req.nextUrl.searchParams.getAll(key);
  if (all.length > 1) return undefined; // 잘못된 요청 표시
  return all.length ? all[0] : null;
}

/** 엄격한 정수 — '16' 은 되고 '16.5' · '1e1' · ' 16' · '016'(앞 0 — 같은 값 다른 주소로 캐시를 비켜 감) 은 안 된다 */
export function strictInt(v: string | null | undefined): number | null {
  if (v == null || !/^(0|-?[1-9]\d{0,4})$/.test(v)) return null;
  return Number(v);
}

/** 엄격한 좌표 숫자 — '-?123.456789' 꼴만(지수 · 공백 · 16진 거름). maxDecimals 로 소수 자리 한도(기본 10) */
export function strictCoord(v: string | null | undefined, maxDecimals = 10): number | null {
  if (v == null || !new RegExp(`^-?\\d{1,3}(\\.\\d{1,${Math.max(1, Math.min(10, maxDecimals))}})?$`).test(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** 캐시 머리글 */
export const CACHE = {
  /** 지도 그림 — 브라우저 1일 · CDN 30일 · 그 뒤 7일은 옛것 주며 새로 */
  image: 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800',
  /** 주소 결과 — 브라우저 1일 · CDN 7일 */
  json: 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
  /** 결과 없음 — 1시간만 */
  empty: 'public, max-age=600, s-maxage=3600',
} as const;

/** 위쪽 데이터 캐시 수명(초) */
export const REVALIDATE = { image: 60 * 60 * 24 * 30, json: 60 * 60 * 24 * 7 } as const;
