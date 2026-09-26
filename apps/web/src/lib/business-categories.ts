export const WEDDING_PARTNER_CATEGORIES = [
  '웨딩홀',
  '드레스',
  '피부과',
  '스튜디오',
  '헤어',
  '메이크업',
  '가전',
  '스냅',
  '한복',
  '성형외과',
  '보석',
  '답례품',
  '자동차',
  '신혼여행',
  '가구',
] as const;

export type WeddingPartnerCategory = (typeof WEDDING_PARTNER_CATEGORIES)[number];

export const WEDDING_PARTNER_CATEGORY_TABS: readonly string[] = [
  '전체',
  ...WEDDING_PARTNER_CATEGORIES,
];

export const WEDDING_PARTNER_CATEGORY_ICONS: Record<WeddingPartnerCategory, string> = {
  웨딩홀: 'wedding-hall.png',
  드레스: 'dress.png',
  피부과: 'derma.png',
  스튜디오: 'studio.png',
  헤어: 'hair.png',
  메이크업: 'makeup.png',
  가전: 'appliance.png',
  스냅: 'snap.png',
  한복: 'hanbok.png',
  성형외과: 'plastic.png',
  보석: 'jewelry.png',
  답례품: 'gift.png',
  자동차: 'car.png',
  신혼여행: 'honeymoon.png',
  가구: 'furniture.png',
};

/**
 * 홈 카테고리 칸 타일 색 — 아이콘마다 그 그림 색을 아주 옅게(260926 사장 "타일 컬러를 각 아이콘 컬러에 맞춰 조금씩").
 * 아이콘 파일의 색 있는 픽셀에서 대표 색상을 뽑아 밝기 95% 안팎으로 다듬은 값. 없는 칸은 기본 연회색.
 * iOS 네이티브 홈(NativeHomeSections.swift HomeCategoryIcons.tileTints)도 같은 값을 쓴다.
 */
export const CATEGORY_TILE_DEFAULT = '#F6F6F6';
export const CATEGORY_TILE_TINTS: Record<string, string> = {
  'wedding-mc-icon.png': '#F2F6E8', // 백합 잎 연두·크림
  'event-mc-icon.png': '#FBEBEC', // 와인 로제
  'foreign-mc.png': '#EAF3FC', // 지구본 하늘
  'wedding-hall.png': '#FAF3E3', // 샹들리에 샴페인 골드
  'dress.png': '#EBF2FC', // 드레스 연파랑
  'derma.png': '#EAF5EE', // 주사기 세이지 민트(흰 마스크가 살짝 떠 보이게)
  'studio.png': '#FEEFE4', // 주황 카메라 피치
  'hair.png': '#FCEAF2', // 드라이어 마젠타 핑크
  'makeup.png': '#FCEDE8', // 팩트·립스틱 피치 핑크
  'snap.png': '#EFF6EC', // 정원·부케 초록
};

export function categoryTileColor(img: string): string {
  const file = String(img || '').split('/').pop() || '';
  return CATEGORY_TILE_TINTS[file] || CATEGORY_TILE_DEFAULT;
}
