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
