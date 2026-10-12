// 채팅 '장소' 보내기·보기 도우미(261012 사장 '채팅창 내에서 갤럭시 장소/음성 전달 실패(아이폰 갤럭시 둘다 발생함)').
//  · 예전 위치 선택창은 네이버 지도 SDK 키(NEXT_PUBLIC_NAVER_MAP_CLIENT_ID)가 운영에 없어 '이 위치 전송하기'가 영영 안 눌렸고,
//    갤럭시 앱(2.0.6)은 웹뷰 위치 권한 처리가 없어 현재 위치도 못 받았다 → 위치를 보낼 길이 아예 없었다.
//  · (261012 사장 '네이버 다이나믹맵 전부 다 적용') 키가 들어와 지도는 전부 네이버로:
//      - 장소 검색은 그대로 카카오 로컬(서버 경유 /chat/place-search — 네이버 지도엔 가게 이름 검색이 없다. 카카오가 안 되면 네이버 주소 검색으로 이어 감)
//      - '지도에서 직접 고르기' = 네이버 지도(다이나믹맵, 인증 실패 시 정적 그림을 손으로 끄는 지도)로 가운데 핀 → 네이버 역지오코딩 주소
//      - 받은 쪽 카드 = 네이버 정적 지도 그림(/api/naver-map/static) + 장소명·주소 + '네이버 지도에서 보기'
//  · 순수 함수만 둔다(화면은 ChatExtras 의 PlacePickerSheet·LocationCard, ChatMapPicker 의 MapPickPanel).

export type PlaceResult = {
  name: string;
  address: string;
  roadAddress?: string;
  category?: string;
  lat: number;
  lng: number;
};

/** 시트에서 고른 장소 — label 은 시트 표시용, placeName·address 는 메시지 metadata 로 간다 */
export type PickedPlace = { lat?: number; lng?: number; placeName?: string; address?: string; label: string };

/** 위도·경도가 실제 좌표인지(NaN·문자열·범위 밖 거름) */
export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' && typeof lng === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

/**
 * 안드로이드 앱(웹뷰)용 — https 주소를 intent:// 로 감싼다(지금 깔린 2.0.6 은 intent:// 만 바깥 앱으로 넘긴다).
 * 공용 도우미(lib/naver-map-links androidViewIntentUrl)와 같은 것 — 예전 이름으로도 부를 수 있게 남겨 둔다.
 */
export { androidViewIntentUrl as androidIntentUrl } from '@/lib/naver-map-links';

// ─── 웹 메르카토르(256px 타일 = 네이버 SDK zoom 척도) ───
//  정적 지도 그림(/api/naver-map/static, level=zoom)도 같은 척도다 — 261012 실측: 가운데를 (120,70)px 옮긴 두 그림이
//  zoom 15·17·19 × 배율 1·2 모두 정확히 (120,70)px 어긋나 겹친다(scratchpad/cmap/merc.mjs). 그래서 '정적 그림을 손으로 끄는 지도'가 이음매 없이 된다.

const TILE = 256;

/** 위경도 → 줌 z 의 전역 픽셀 좌표 */
export function lonLatToGlobalPx(lat: number, lng: number, z: number) {
  const scale = TILE * 2 ** z;
  const x = ((lng + 180) / 360) * scale;
  const s = Math.sin((Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale;
  return { x, y };
}

/** 줌 z 의 전역 픽셀 좌표 → 위경도 */
export function globalPxToLonLat(x: number, y: number, z: number) {
  const scale = TILE * 2 ** z;
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { lat, lng };
}

/** 두 점 사이 거리(m, 짧은 거리용 근사) */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLng = (b.lng - a.lng) * toRad * Math.cos(((a.lat + b.lat) / 2) * toRad);
  return R * Math.sqrt(dLat * dLat + dLng * dLng);
}

/** 위치 메시지 본문(목록·옛 앱·검색에 보이는 글) — 장소명 > 주소 > 기본 문구 */
export function locationContent(placeName?: string, address?: string) {
  const name = (placeName || '').trim();
  const addr = (address || '').trim();
  return (name || addr || '내 위치를 공유했습니다').slice(0, 200);
}

/** 지도에서 고른 곳에 붙일 이름 — 주소가 하나도 없을 때(바다·산속) 메시지 제목 */
export const MAP_PICKED_FALLBACK_NAME = '지도에서 고른 위치';
