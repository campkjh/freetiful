import { NextRequest, NextResponse } from 'next/server';

// 채팅 '장소' 보내기용 장소 검색(261012 사장 '채팅창 내에서 갤럭시 장소/음성 전달 실패(아이폰 갤럭시 둘다 발생함)').
//  · 주소 = /chat/place-search (채팅 화면 옆에 둔 서버 처리기 — 화면 없음, 레이아웃도 타지 않는다).
//  · 카카오 로컬 REST(KAKAO_REST_API_KEY, /api/nearby-venues 와 같은 키)를 서버에서 부른다 → 키가 브라우저로 안 나가고
//    지도 SDK·도메인 등록 없이 아이폰·갤럭시 앱·PC 어디서나 같다. (네이버 지도 키는 운영에 없어 예전 선택창이 막혀 있었다)
//  · GET ?q=검색어[&lat=&lng=]  → { places: [{ name, address, roadAddress, category, lat, lng }] }
//      키워드 검색 0건이면 주소 검색으로 한 번 더. 좌표가 오면 거리 정보를 같이 받는다(정확도 순서는 유지).
//  · GET ?lat=&lng=             → { address, name } (현재 위치 보내기 때 주소 붙이기)
//  · 키 없음·카카오 오류는 { places: [], error: 'unavailable' } — 화면이 '검색어 그대로 보내기'로 이어 간다(막다른 길 없음).
//  · 남용 방지: 검색어 1~60자, 좌표 범위 검사·소수 4자리로 반올림(캐시 적중↑), 같은 요청은 CDN 5분 캐시.

const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
const KAKAO = 'https://dapi.kakao.com/v2/local';

type Place = { name: string; address: string; roadAddress?: string; category?: string; lat: number; lng: number };

function num(v: string | null): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function okJson(body: unknown) {
  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
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
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`kakao ${res.status}`);
    return (await res.json()) as { documents?: Record<string, any>[] };
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

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const q = (sp.get('q') || '').replace(/\s+/g, ' ').trim();
  const latRaw = num(sp.get('lat'));
  const lngRaw = num(sp.get('lng'));
  const hasCoord =
    latRaw != null && lngRaw != null && latRaw >= -90 && latRaw <= 90 && lngRaw >= -180 && lngRaw <= 180;
  const lat = hasCoord ? latRaw!.toFixed(4) : '';
  const lng = hasCoord ? lngRaw!.toFixed(4) : '';

  // ── 좌표 → 주소(현재 위치 보내기) ──
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
  if (q.length > 60) return failJson({ places: [], error: 'too_long' }, 400);
  if (!KAKAO_KEY) return failJson({ places: [], error: 'unavailable' });
  try {
    const params: Record<string, string> = { query: q, size: '15' };
    if (hasCoord) Object.assign(params, { x: lng, y: lat });
    const kw = await kakao('search/keyword.json', params);
    let places = (kw.documents || []).map(toPlaceFromKeyword).filter((p): p is Place => !!p && !!p.name);
    if (places.length === 0) {
      const ad = await kakao('search/address.json', { query: q, size: '10' });
      places = (ad.documents || []).map(toPlaceFromAddress).filter((p): p is Place => !!p && !!p.name);
    }
    return okJson({ places });
  } catch {
    return failJson({ places: [], error: 'unavailable' });
  }
}
