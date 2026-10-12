import { NextResponse, type NextRequest } from 'next/server';
import { isInKorea } from '@/lib/naver-map-shared';
import { CACHE, RATE, REVALIDATE, errorJson, naverFetch, rateLimit, rejectCrossSite, rejectUnknownParams, single, strictCoord, upstreamErrorResponse, warnUpstream } from '../_lib/upstream';

// 주소 → 좌표(네이버 Geocoding) 프록시(261012 사장 '네이버 다이나믹맵인데 이거 네이버 맵좀 전부 다 적용해줘').
//  · GET /api/naver-map/geocode?query=서울 중구 퇴계로 212[&lat=37.56&lng=126.99]
//      query 2~80자(공백 정리) · lat/lng(둘 다, 대한민국 안)는 '가까운 곳 먼저' 기준점(소수 3자리로 반올림 — 캐시 적중↑)
//  · → { results: [{ roadAddress, jibunAddress, englishAddress, buildingName, postalCode, lat, lng, area: { sido, sigungu, dong } }] } 최대 5개, 대한민국 밖 결과는 뺀다
//  · 주소(도로명·지번) 검색이다 — 가게 이름 검색은 안 된다(장소 검색은 채팅 /chat/place-search 카카오 로컬).
//  · 결과 CDN 7일 캐시(없음은 1시간). 잘못된 칸 400 · 다른 사이트 403 · 너무 잦음 429(IP 별, _lib/upstream RATE) · 키 없음 503 · 네이버 실패 502.
//  · 주소 길이 한도는 '글자 수'(80자)로 본다 — 인코딩된 주소로 먼저 자르면 한글 69자 주소가 400 이었다(261012 검수). 인코딩 길이는 넉넉히(900).

const ALLOWED = ['query', 'lat', 'lng'] as const;

type GeoElement = { types?: string[]; longName?: string };
type GeoAddress = {
  roadAddress?: string;
  jibunAddress?: string;
  englishAddress?: string;
  addressElements?: GeoElement[];
  x?: string;
  y?: string;
};

function element(list: GeoElement[] | undefined, type: string): string {
  return String(list?.find((e) => e.types?.includes(type))?.longName || '').trim();
}

export async function GET(req: NextRequest) {
  const cross = rejectCrossSite(req);
  if (cross) return cross;
  const unknown = rejectUnknownParams(req, ALLOWED, 900);
  if (unknown) return unknown;

  const queryS = single(req, 'query'), latS = single(req, 'lat'), lngS = single(req, 'lng');
  if ([queryS, latS, lngS].some((v) => v === undefined)) return errorJson('duplicate_param', 400);

  const query = String(queryS || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (query.length < 2) return errorJson('bad_query', 400);
  if (query.length > 80) return errorJson('too_long', 400);

  const up = new URLSearchParams({ query, count: '5' });
  if (latS != null || lngS != null) {
    const lat = strictCoord(latS);
    const lng = strictCoord(lngS);
    if (lat == null || lng == null || !isInKorea(lat, lng)) return errorJson('bad_coord', 400);
    up.set('coordinate', `${lng.toFixed(3)},${lat.toFixed(3)}`);
  }

  const limited = rateLimit(req, 'geocode', RATE.geocode);
  if (limited) return limited;

  try {
    const res = await naverFetch('/map-geocode/v2/geocode', up, REVALIDATE.json);
    const data = (await res.json()) as { status?: string; addresses?: GeoAddress[] };
    if (data.status !== 'OK') {
      warnUpstream('/map-geocode/v2/geocode', `status:${String(data.status || '').replace(/[^A-Z_]/gi, '').slice(0, 30)}`);
      return errorJson('upstream', 502);
    }
    const results = (data.addresses || [])
      .map((a) => {
        const lat = Number(a.y);
        const lng = Number(a.x);
        if (!isInKorea(lat, lng)) return null;
        return {
          roadAddress: String(a.roadAddress || '').trim(),
          jibunAddress: String(a.jibunAddress || '').trim(),
          englishAddress: String(a.englishAddress || '').trim(),
          buildingName: element(a.addressElements, 'BUILDING_NAME'),
          postalCode: element(a.addressElements, 'POSTAL_CODE'),
          lat,
          lng,
          area: {
            sido: element(a.addressElements, 'SIDO'),
            sigungu: element(a.addressElements, 'SIGUGUN'),
            dong: element(a.addressElements, 'DONGMYUN'),
          },
        };
      })
      .filter((r): r is NonNullable<typeof r> => !!r)
      .slice(0, 5);
    return NextResponse.json({ results }, { headers: { 'Cache-Control': results.length ? CACHE.json : CACHE.empty } });
  } catch (e) {
    return upstreamErrorResponse(e);
  }
}
