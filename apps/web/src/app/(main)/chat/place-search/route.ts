import { NextRequest, NextResponse } from 'next/server';
import { isInKorea } from '@/lib/naver-map-shared';
import { RATE, naverFetch, rateLimit, rejectCrossSite, rejectUnknownParams, single, strictCoord, warnUpstream } from '@/app/api/naver-map/_lib/upstream';

// 채팅 '장소' 보내기용 장소 검색(261012 사장 '채팅창 내에서 갤럭시 장소/음성 전달 실패(아이폰 갤럭시 둘다 발생함)').
//  · 주소 = /chat/place-search (채팅 화면 옆에 둔 서버 처리기 — 화면 없음, 레이아웃도 타지 않는다).
//  · 카카오 로컬 REST(KAKAO_REST_API_KEY, /api/nearby-venues 와 같은 키)를 서버에서 부른다 → 키가 브라우저로 안 나가고
//    지도 SDK·도메인 등록 없이 아이폰·갤럭시 앱·PC 어디서나 같다. (네이버 지도엔 가게·장소 이름 검색이 없어 이름 검색은 카카오가 맡는다)
//  · GET ?q=검색어[&lat=&lng=]  → { places: [{ name, address, roadAddress, category, lat, lng }] }
//      키워드 검색 0건이면 주소 검색으로 한 번 더. 좌표가 오면 거리 정보를 같이 받는다(정확도 순서는 유지).
//  · GET ?lat=&lng=             → { address, name } (예전 번들의 '현재 위치 보내기' 주소 붙이기 — 새 화면은 /api/naver-map/reverse)
//  · 키 없음·카카오 오류는 { places: [], error: 'unavailable' } — 화면이 '검색어 그대로 보내기'로 이어 간다(막다른 길 없음).
//  · (261012 사장 '네이버 다이나믹맵 전부 다 적용') 카카오가 없거나 실패하거나 0건이면 네이버 주소 검색(Geocoding)으로 한 번 더
//    — '서울 중구 세종대로 110' 같은 주소는 카카오 키가 없어도 찾는다. 네이버 비밀키는 공용 서버 도우미(_lib/upstream)만 읽는다.
//  · 남용 방지: 정한 칸(q·lat·lng)만 · 같은 칸 두 번 400 · 다른 사이트에서 끌어 쓰기 403 · 검색어 1~60자 ·
//    좌표는 대한민국 안만(밖이면 기준점은 버리고, 주소 붙이기는 400) · 소수 4자리로 반올림(캐시 적중↑) · 결과는 CDN 1시간 캐시.
//  · (261012 검수) IP 별 호출 한도(429) · 카카오 응답도 데이터 캐시 1시간(예전 no-store — 같은 검색어가 CDN 을 비켜 오면 매번 바깥 호출) ·
//    검색어 한도는 '글자 수'(60자)로 — 인코딩된 주소 길이로 먼저 자르면 한글 46자 검색이 400 이었다 · 카카오 실패는 상태 코드만 로그.

const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
const KAKAO = 'https://dapi.kakao.com/v2/local';
const ALLOWED = ['q', 'lat', 'lng'] as const;

type Place = { name: string; address: string; roadAddress?: string; category?: string; lat: number; lng: number };

function okJson(body: unknown) {
  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  });
}

function failJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function kakao(path: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(`${KAKAO}/${path}?${qs}`, {
      headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
      signal: ctrl.signal,
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      warnUpstream(`kakao/${path}`, res.status);
      throw new Error(`kakao ${res.status}`);
    }
    return (await res.json()) as { documents?: Record<string, any>[] };
  } catch (e) {
    if (!(e instanceof Error && e.message.startsWith('kakao '))) warnUpstream(`kakao/${path}`, ctrl.signal.aborted ? 'timeout' : 'network');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function toPlaceFromKeyword(d: Record<string, any>): Place | null {
  const lat = Number(d.y);
  const lng = Number(d.x);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const category = String(d.category_name || '').split('>').pop()?.trim() || undefined;
  return {
    name: String(d.place_name || '').trim(),
    address: String(d.address_name || '').trim(),
    roadAddress: String(d.road_address_name || '').trim() || undefined,
    category,
    lat,
    lng,
  };
}

function toPlaceFromAddress(d: Record<string, any>): Place | null {
  const lat = Number(d.y);
  const lng = Number(d.x);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const road = d.road_address?.address_name ? String(d.road_address.address_name) : '';
  const building = d.road_address?.building_name ? String(d.road_address.building_name) : '';
  const jibun = String(d.address?.address_name || d.address_name || '');
  return {
    name: building || road || jibun,
    address: jibun || road,
    roadAddress: road || undefined,
    lat,
    lng,
  };
}

type NaverGeoAddress = {
  roadAddress?: string;
  jibunAddress?: string;
  addressElements?: { types?: string[]; longName?: string }[];
  x?: string;
  y?: string;
};

/** 네이버 주소 검색(Geocoding) — 카카오 대신. 주소(도로명·지번)만 찾는다(가게 이름은 0건) */
async function naverAddressSearch(q: string, lat: string, lng: string): Promise<Place[]> {
  if (q.length < 2) return [];
  const up = new URLSearchParams({ query: q.slice(0, 80), count: '10' });
  if (lat && lng) up.set('coordinate', `${lng},${lat}`);
  const res = await naverFetch('/map-geocode/v2/geocode', up, 60 * 60 * 24 * 7);
  const data = (await res.json()) as { status?: string; addresses?: NaverGeoAddress[] };
  if (data.status !== 'OK') throw new Error('naver geocode');
  return (data.addresses || [])
    .map((a): Place | null => {
      const la = Number(a.y);
      const ln = Number(a.x);
      if (!isInKorea(la, ln)) return null;
      const building = String(a.addressElements?.find((e) => e.types?.includes('BUILDING_NAME'))?.longName || '').trim();
      // 네이버는 주소 끝에 건물 이름을 붙여 준다('… 세종대로 110 서울특별시청') — 이름 칸과 겹치니 주소에선 뗀다
      const noBuilding = (s: string) => (building && s.endsWith(` ${building}`) ? s.slice(0, -building.length - 1).trim() : s);
      const road = noBuilding(String(a.roadAddress || '').trim());
      const jibun = noBuilding(String(a.jibunAddress || '').trim());
      const name = building || road || jibun;
      if (!name) return null;
      return { name, address: jibun || road, roadAddress: road || undefined, lat: la, lng: ln };
    })
    .filter((p): p is Place => !!p);
}

export async function GET(req: NextRequest) {
  const cross = rejectCrossSite(req);
  if (cross) return cross;
  // q 60자 × 한글 9배 + 좌표 칸
  const unknown = rejectUnknownParams(req, ALLOWED, 700);
  if (unknown) return unknown;
  const qS = single(req, 'q'), latS = single(req, 'lat'), lngS = single(req, 'lng');
  if (qS === undefined || latS === undefined || lngS === undefined) return failJson({ error: 'duplicate_param' }, 400);

  const q = (qS || '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  const latRaw = strictCoord(latS);
  const lngRaw = strictCoord(lngS);
  const hasCoord = latRaw != null && lngRaw != null && isInKorea(latRaw, lngRaw);
  const lat = hasCoord ? latRaw!.toFixed(4) : '';
  const lng = hasCoord ? lngRaw!.toFixed(4) : '';
  if (q.length > 60) return failJson({ places: [], error: 'too_long' }, 400);
  if (!q && !hasCoord) return failJson({ error: 'bad_request' }, 400);

  // 모양이 맞는 요청만 센다
  const limited = rateLimit(req, 'place-search', RATE.placeSearch);
  if (limited) return limited;

  // ── 좌표 → 주소(예전 번들의 현재 위치 보내기) ──
  if (!q) {
    if (!hasCoord) return failJson({ error: 'bad_request' }, 400);
    if (!KAKAO_KEY) return failJson({ address: '', name: '', error: 'unavailable' });
    try {
      const data = await kakao('geo/coord2address.json', { x: lng, y: lat });
      const d = data.documents?.[0];
      const road = d?.road_address?.address_name ? String(d.road_address.address_name) : '';
      const jibun = d?.address?.address_name ? String(d.address.address_name) : '';
      const building = d?.road_address?.building_name ? String(d.road_address.building_name) : '';
      return okJson({ address: road || jibun, name: building });
    } catch {
      return failJson({ address: '', name: '', error: 'unavailable' });
    }
  }

  // ── 장소·주소 검색 ──
  let places: Place[] = [];
  let kakaoFailed = !KAKAO_KEY;
  if (KAKAO_KEY) {
    try {
      const params: Record<string, string> = { query: q, size: '15' };
      if (hasCoord) Object.assign(params, { x: lng, y: lat });
      const kw = await kakao('search/keyword.json', params);
      places = (kw.documents || []).map(toPlaceFromKeyword).filter((p): p is Place => !!p && !!p.name);
      if (places.length === 0) {
        const ad = await kakao('search/address.json', { query: q, size: '10' });
        places = (ad.documents || []).map(toPlaceFromAddress).filter((p): p is Place => !!p && !!p.name);
      }
    } catch {
      kakaoFailed = true;
      places = [];
    }
  }
  if (places.length > 0) return okJson({ places });

  // 카카오가 없거나 · 실패했거나 · 0건 → 네이버 주소 검색으로 한 번 더
  try {
    const naver = await naverAddressSearch(q, lat, lng);
    if (naver.length > 0) return okJson({ places: naver });
  } catch {
    /* 네이버도 안 되면 아래로 */
  }
  return kakaoFailed ? failJson({ places: [], error: 'unavailable' }) : okJson({ places: [] });
}
