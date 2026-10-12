import { NextResponse, type NextRequest } from 'next/server';
import {
  NAVER_MAP_LANGS,
  NAVER_MAP_ZOOM,
  NAVER_MARKER_COLOR,
  NAVER_STATIC_MAX_AREA,
  NAVER_STATIC_MAX_MARKERS,
  NAVER_STATIC_SIZE,
  cleanMarkerLabel,
  isInKorea,
  roundCoord,
  staticQueryParams,
  type MapMarkerLiteral,
  type NaverMapLang,
} from '@/lib/naver-map-shared';
import { CACHE, RATE, REVALIDATE, errorJson, naverFetch, rateLimit, rejectCrossSite, rejectUnknownParams, single, strictCoord, strictInt, upstreamErrorResponse, warnUpstream } from '../_lib/upstream';

// 네이버 정적 지도 그림 프록시(261012 사장 '네이버 다이나믹맵인데 이거 네이버 맵좀 전부 다 적용해줘').
//  · 동적 지도(SDK)가 인증 실패 · 로딩 실패일 때 NaverMap 이 대신 까는 그림 + 로딩 중 미리보기 + 말풍선처럼 가벼운 칸.
//  · GET /api/naver-map/static?lat=37.56065&lng=126.99359&level=16&w=600&h=300&scale=2[&lang=en|ja|zh][&m=위도,경도[,표시글자]]…
//      lat·lng = 가운데(대한민국 안, 소수 5자리) · level 6~20(= SDK zoom 뜻, 위쪽엔 -1) · w·h 40~1020 의 10px 단위(넓이 1020×640 까지) · scale 1|2 ·
//      m 은 최대 5개(표시 글자 20자, 구분자 제거)
//  · 응답 = 네이버 jpg 그대로 + CDN 30일 캐시. 잘못된 칸 400 · 다른 사이트 403 · 너무 잦음 429 · 키 없음 503 · 네이버 실패 502(캐시 안 함).
//  · (261012 검수) '정규 주소'만 받는다 — 칸 순서 · 숫자 꼴(소수 5자리 · 앞 0 없음) · 생략 규칙이 화면의 naverStaticMapSrc() 와 한 글자도 다르면 400.
//    그래야 CDN 키와 네이버로 나가는 요청이 1:1 이라 같은 그림을 주소만 살짝 바꿔 몇 번이고 새로 받아 가지 못한다.
//    png 는 뺐다(쓰는 곳 없음 · 1024² png 는 1.8MB 라 데이터 캐시(2MB, base64)에 안 들어가 매번 네이버를 불렀다). 받은 그림도 1.4MB 넘으면 버린다.
//  · 화면에서는 lib/naver-map-shared.ts naverStaticMapSrc() 로 주소를 만든다(같은 함수 staticQueryParams 로 서버가 정규 주소를 다시 만들어 비교).

const ALLOWED = ['lat', 'lng', 'level', 'w', 'h', 'scale', 'lang', 'm'] as const;
/** 데이터 캐시 한 칸 2MB(본문 base64 = 4/3 배) 안에 들게 */
const MAX_BYTES = Math.floor(1.4 * 1024 * 1024);

export async function GET(req: NextRequest) {
  const cross = rejectCrossSite(req);
  if (cross) return cross;
  // 표시 5개 × 한글 20자(9배) + 나머지 칸
  const unknown = rejectUnknownParams(req, ALLOWED, 1400);
  if (unknown) return unknown;

  const latS = single(req, 'lat'), lngS = single(req, 'lng'), levelS = single(req, 'level');
  const wS = single(req, 'w'), hS = single(req, 'h'), scaleS = single(req, 'scale'), langS = single(req, 'lang');
  if ([latS, lngS, levelS, wS, hS, scaleS, langS].some((v) => v === undefined)) return errorJson('duplicate_param', 400);

  const lat = strictCoord(latS, 5);
  const lng = strictCoord(lngS, 5);
  if (lat == null || lng == null || !isInKorea(lat, lng)) return errorJson('bad_center', 400);

  const level = strictInt(levelS);
  if (level == null || level < NAVER_MAP_ZOOM.min || level > NAVER_MAP_ZOOM.max) return errorJson('bad_level', 400);

  const w = strictInt(wS);
  const h = strictInt(hS);
  const okSize = (n: number | null): n is number =>
    n != null && n >= NAVER_STATIC_SIZE.min && n <= NAVER_STATIC_SIZE.max && n % NAVER_STATIC_SIZE.step === 0;
  if (!okSize(w) || !okSize(h) || w * h > NAVER_STATIC_MAX_AREA) return errorJson('bad_size', 400);

  const scale = strictInt(scaleS);
  if (scale !== 1 && scale !== 2) return errorJson('bad_scale', 400);

  const lang = (langS == null ? 'ko' : langS) as NaverMapLang;
  if (!NAVER_MAP_LANGS.includes(lang)) return errorJson('bad_lang', 400);

  const rawMarkers = req.nextUrl.searchParams.getAll('m');
  if (rawMarkers.length > NAVER_STATIC_MAX_MARKERS) return errorJson('too_many_markers', 400);
  const parsed: MapMarkerLiteral[] = [];
  const markers: string[] = [];
  for (const raw of rawMarkers) {
    if (raw.length > 80) return errorJson('bad_marker', 400);
    const [mLatS, mLngS, ...rest] = raw.split(',');
    const mLat = strictCoord(mLatS, 5);
    const mLng = strictCoord(mLngS, 5);
    if (mLat == null || mLng == null || !isInKorea(mLat, mLng)) return errorJson('bad_marker', 400);
    const label = cleanMarkerLabel(rest.join(' '));
    parsed.push({ lat: mLat, lng: mLng, label });
    const pos = `${roundCoord(mLng)} ${roundCoord(mLat)}`;
    markers.push(
      label
        ? `type:t|size:mid|pos:${pos}|label:${label}|color:0x${NAVER_MARKER_COLOR}`
        : `type:d|size:mid|pos:${pos}|color:0x${NAVER_MARKER_COLOR}`,
    );
  }

  // 정규 주소 비교 — 화면과 같은 함수로 다시 만들어 (이름, 값) 줄이 순서까지 같아야 한다
  const canon = staticQueryParams({ center: { lat, lng }, level, width: w, height: h, scale, lang, markers: parsed });
  const got = Array.from(req.nextUrl.searchParams.entries());
  const want = canon ? Array.from(canon.entries()) : [];
  if (got.length !== want.length || got.some(([k, v], i) => k !== want[i][0] || v !== want[i][1])) return errorJson('non_canonical', 400);

  // 모양이 맞는 요청만 센다(잘못된 요청은 위에서 공짜로 400)
  const limited = rateLimit(req, 'static', RATE.static);
  if (limited) return limited;

  // 위쪽 주소는 늘 같은 순서로(데이터 캐시 키가 고르게)
  const up = new URLSearchParams();
  up.set('w', String(w));
  up.set('h', String(h));
  up.set('center', `${roundCoord(lng)},${roundCoord(lat)}`);
  // 네이버 정적 지도의 level 은 SDK zoom 보다 한 단계 작다(같은 넓이 = static level 15 ↔ SDK zoom 16, 261012 픽셀 대조 scratchpad/nmap/zoomcmp.jpg)
  //  → 우리 칸의 level 은 늘 'SDK zoom' 뜻으로 받고 위쪽에는 하나 빼서 보낸다. 그래야 미리보기 그림과 동적 지도가 겹쳐도 어긋나지 않는다
  up.set('level', String(level - 1));
  up.set('scale', String(scale));
  up.set('format', 'jpg');
  up.set('lang', lang);
  markers.forEach((m) => up.append('markers', m));

  try {
    const res = await naverFetch('/map-static/v2/raster', up, REVALIDATE.image);
    const type = (res.headers.get('content-type') || '').toLowerCase();
    if (!type.startsWith('image/')) {
      warnUpstream('/map-static/v2/raster', 'not_image');
      return errorJson('upstream', 502);
    }
    const body = await res.arrayBuffer();
    if (body.byteLength === 0 || body.byteLength > MAX_BYTES) {
      warnUpstream('/map-static/v2/raster', body.byteLength ? 'too_big' : 'empty');
      return errorJson('upstream', 502);
    }
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': String(body.byteLength),
        'Cache-Control': CACHE.image,
        'X-Content-Type-Options': 'nosniff',
        // CORP 머리글은 일부러 안 붙인다 — 갤럭시 웹뷰가 CORP 로 그림을 막은 적이 있다(업로드 사진 사고). 다른 사이트 차단은 rejectCrossSite 가 맡는다
      },
    });
  } catch (e) {
    return upstreamErrorResponse(e);
  }
}
