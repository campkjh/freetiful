// 채팅 '장소' 보내기·보기 도우미(261012 사장 '채팅창 내에서 갤럭시 장소/음성 전달 실패(아이폰 갤럭시 둘다 발생함)').
//  · 예전 위치 선택창은 네이버 지도 SDK 키(NEXT_PUBLIC_NAVER_MAP_CLIENT_ID)가 운영에 없어 '이 위치 전송하기'가 영영 안 눌렸고,
//    갤럭시 앱(2.0.6)은 웹뷰 위치 권한 처리가 없어 현재 위치도 못 받았다 → 위치를 보낼 길이 아예 없었다.
//  · 지금은 장소 검색(카카오 로컬, 서버 경유 /chat/place-search — 지도 SDK·키 노출 없음)으로 고르고,
//    받은 쪽은 지도 그림(OSM 타일) + 장소명·주소 + '지도에서 보기'(카카오맵 링크) 카드로 본다.
//  · 순수 함수만 둔다(화면은 ChatExtras 의 PlacePickerSheet·LocationCard).

export type PlaceResult = {
  name: string;
  address: string;
  roadAddress?: string;
  category?: string;
  lat: number;
  lng: number;
};

/** 위도·경도가 실제 좌표인지(NaN·문자열·범위 밖 거름) */
export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' && typeof lng === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

/** 카카오맵 링크 이름 칸 — 쉼표는 좌표 구분자라 공백으로, 너무 길면 자른다 */
function cleanMapName(name: string) {
  return (name || '').replace(/[,\n\r]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}

/** '지도에서 보기' — 좌표가 있으면 핀 찍힌 카카오맵, 없으면(장소명만 보낸 경우) 카카오맵 검색 */
export function kakaoMapUrl(name: string | undefined, lat?: number, lng?: number): string {
  const clean = cleanMapName(name || '');
  if (isValidLatLng(lat, lng)) {
    const la = Number(lat).toFixed(6);
    const ln = Number(lng).toFixed(6);
    return `https://map.kakao.com/link/map/${encodeURIComponent(clean || '공유한 위치')},${la},${ln}`;
  }
  return `https://map.kakao.com/?q=${encodeURIComponent(clean)}`;
}

/**
 * 안드로이드 앱(웹뷰)용 — https 주소를 intent:// 로 감싼다.
 * 지금 깔린 앱(2.0.6)은 intent:// 만 외부 앱(브라우저·카카오맵)으로 넘기고(MainActivity Intent.parseUri),
 * 그냥 열면 웹뷰 안에서 카카오맵 웹이 kakaomap:// 같은 스킴을 열다 '웹페이지를 사용할 수 없음'이 난다.
 */
export function androidIntentUrl(httpsUrl: string): string {
  const u = new URL(httpsUrl);
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(':', '')};action=android.intent.action.VIEW;end`;
}

// ─── 지도 그림(OSM 타일) — 지도 SDK·키 없이 카드 위에 깔 정적 지도 ───

const TILE = 256;

/** 위경도 → 줌 z 의 전역 픽셀 좌표(웹 메르카토르) */
export function lonLatToGlobalPx(lat: number, lng: number, z: number) {
  const scale = TILE * 2 ** z;
  const x = ((lng + 180) / 360) * scale;
  const s = Math.sin((Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale;
  return { x, y };
}

/** w×h 칸 가운데에 좌표가 오도록 깔 타일 목록(left/top 은 칸 기준 px) */
export function tilesForView(lat: number, lng: number, z: number, w: number, h: number) {
  const { x, y } = lonLatToGlobalPx(lat, lng, z);
  const left0 = x - w / 2;
  const top0 = y - h / 2;
  const n = 2 ** z;
  const tx0 = Math.floor(left0 / TILE);
  const ty0 = Math.floor(top0 / TILE);
  const tx1 = Math.floor((left0 + w - 1) / TILE);
  const ty1 = Math.floor((top0 + h - 1) / TILE);
  const tiles: { key: string; url: string; left: number; top: number }[] = [];
  for (let ty = ty0; ty <= ty1; ty++) {
    if (ty < 0 || ty >= n) continue;
    for (let tx = tx0; tx <= tx1; tx++) {
      const wx = ((tx % n) + n) % n;
      tiles.push({
        key: `${z}/${wx}/${ty}`,
        url: `https://tile.openstreetmap.org/${z}/${wx}/${ty}.png`,
        left: Math.round(tx * TILE - left0),
        top: Math.round(ty * TILE - top0),
      });
    }
  }
  return tiles;
}

/** 위치 메시지 본문(목록·옛 앱·검색에 보이는 글) — 장소명 > 주소 > 기본 문구 */
export function locationContent(placeName?: string, address?: string) {
  const name = (placeName || '').trim();
  const addr = (address || '').trim();
  return (name || addr || '내 위치를 공유했습니다').slice(0, 200);
}
