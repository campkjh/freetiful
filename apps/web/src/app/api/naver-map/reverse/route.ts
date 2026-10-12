import { NextResponse, type NextRequest } from 'next/server';
import { isInKorea, roundCoord } from '@/lib/naver-map-shared';
import { CACHE, RATE, REVALIDATE, errorJson, naverFetch, rateLimit, rejectCrossSite, rejectUnknownParams, single, strictCoord, upstreamErrorResponse, warnUpstream } from '../_lib/upstream';

// 좌표 → 주소(네이버 Reverse Geocoding) 프록시(261012 사장 '네이버 다이나믹맵인데 이거 네이버 맵좀 전부 다 적용해줘').
//  · GET /api/naver-map/reverse?lat=37.56029&lng=126.99376   (대한민국 안 · 소수 5자리까지만 받음 — 더 긴 꼴은 400, 같은 자리를 주소만 바꿔 캐시를 비켜 가지 못하게)
//  · → { found, address, roadAddress, jibunAddress, buildingName, short, area: { sido, sigungu, dong } }
//      address = 도로명(없으면 지번) 짧은 주소 '서울특별시 중구 퇴계로36길 2' · short = '서울 중구 필동2가' · 바다처럼 주소가 없으면 found:false + 빈 글자
//  · 결과 CDN 7일 캐시(없음은 1시간). 잘못된 칸 400 · 다른 사이트 403 · 너무 잦음 429(IP 별) · 키 없음 503 · 네이버 실패 502.
//  · 소수 4자리(약 11m)로 더 뭉개지는 않는다 — 건물 하나 폭이라 이웃 건물 주소가 붙을 수 있다(보내는 좌표와 주소가 어긋남).

const ALLOWED = ['lat', 'lng'] as const;

type Area = { name?: string; alias?: string };
type Land = {
  type?: string;
  number1?: string;
  number2?: string;
  name?: string;
  addition0?: { type?: string; value?: string };
};
type RevResult = {
  name?: string;
  region?: { area1?: Area; area2?: Area; area3?: Area; area4?: Area };
  land?: Land;
};

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const join = (...parts: string[]) => parts.map((p) => p.trim()).filter(Boolean).join(' ');
const landNumber = (land?: Land) => {
  const n1 = s(land?.number1);
  const n2 = s(land?.number2);
  return n1 ? (n2 ? `${n1}-${n2}` : n1) : '';
};

const EMPTY = { found: false, address: '', roadAddress: '', jibunAddress: '', buildingName: '', short: '', area: { sido: '', sigungu: '', dong: '' } };

export async function GET(req: NextRequest) {
  const cross = rejectCrossSite(req);
  if (cross) return cross;
  const unknown = rejectUnknownParams(req, ALLOWED, 200);
  if (unknown) return unknown;

  const latS = single(req, 'lat'), lngS = single(req, 'lng');
  if (latS === undefined || lngS === undefined) return errorJson('duplicate_param', 400);
  const lat = strictCoord(latS, 5);
  const lng = strictCoord(lngS, 5);
  if (lat == null || lng == null || !isInKorea(lat, lng)) return errorJson('bad_coord', 400);

  const limited = rateLimit(req, 'reverse', RATE.reverse);
  if (limited) return limited;

  const up = new URLSearchParams({ coords: `${roundCoord(lng)},${roundCoord(lat)}`, orders: 'roadaddr,addr', output: 'json' });
  try {
    const res = await naverFetch('/map-reversegeocode/v2/gc', up, REVALIDATE.json);
    const data = (await res.json()) as { status?: { code?: number }; results?: RevResult[] };
    const code = data.status?.code;
    if (code === 3) return NextResponse.json(EMPTY, { headers: { 'Cache-Control': CACHE.empty } }); // 결과 없음(바다 등)
    if (code !== 0) {
      warnUpstream('/map-reversegeocode/v2/gc', `code:${Number(code)}`);
      return errorJson('upstream', 502);
    }

    const results = data.results || [];
    const road = results.find((r) => r.name === 'roadaddr');
    const addr = results.find((r) => r.name === 'addr');
    const region = (road || addr || results[0])?.region;
    const sido = s(region?.area1?.name);
    const sigungu = s(region?.area2?.name);
    const dong = s(region?.area3?.name);
    const ri = s(region?.area4?.name);

    const roadAddress = road?.land?.name ? join(sido, sigungu, s(road.land.name), landNumber(road.land)) : '';
    const buildingName = road?.land?.addition0?.type === 'building' ? s(road.land.addition0.value) : '';
    const jibunNo = landNumber(addr?.land);
    const jibunAddress = addr ? join(sido, sigungu, dong, ri, jibunNo ? `${addr.land?.type === '2' ? '산 ' : ''}${jibunNo}` : '') : '';
    const short = join(s(region?.area1?.alias) || sido, sigungu, dong);
    const address = roadAddress || jibunAddress;
    if (!address && !short) return NextResponse.json(EMPTY, { headers: { 'Cache-Control': CACHE.empty } });

    return NextResponse.json(
      { found: !!address, address, roadAddress, jibunAddress, buildingName, short, area: { sido, sigungu, dong } },
      { headers: { 'Cache-Control': CACHE.json } },
    );
  } catch (e) {
    return upstreamErrorResponse(e);
  }
}
