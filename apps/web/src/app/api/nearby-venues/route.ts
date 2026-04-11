import { NextRequest, NextResponse } from 'next/server';

const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');
  if (!address || !KAKAO_KEY) {
    return NextResponse.json({ venues: [] });
  }

  // 1. 주소 → 좌표
  const geoRes = await fetch(
    `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`,
    { headers: { Authorization: `KakaoAK ${KAKAO_KEY}` } },
  );
  const geoData = await geoRes.json();
  const doc = geoData.documents?.[0];
  if (!doc) {
    return NextResponse.json({ venues: [] });
  }

  const { x, y } = doc; // x=경도, y=위도

  // 2. 근처 웨딩홀 키워드 검색 (반경 10km)
  const searchRes = await fetch(
    `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent('웨딩홀')}&x=${x}&y=${y}&radius=10000&sort=distance&size=10`,
    { headers: { Authorization: `KakaoAK ${KAKAO_KEY}` } },
  );
  const searchData = await searchRes.json();

  const venues = (searchData.documents || []).map((v: Record<string, string>) => ({
    name: v.place_name,
    address: v.road_address_name || v.address_name,
    phone: v.phone,
    distance: Number(v.distance),
    category: v.category_name,
    url: v.place_url,
    x: v.x,
    y: v.y,
  }));

  return NextResponse.json({ venues, center: { x, y } });
}
