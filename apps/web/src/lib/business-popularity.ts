export const POPULAR_PARTNER_TAG = '인기';

// 웨딩 파트너 엑셀 등록 배치까지의 업체를 인기 파트너로 표시한다.
const POPULAR_PARTNER_BATCH_CUTOFF = Date.parse('2026-04-27T15:00:00.000Z');

export function getBusinessCategoryNames(business: any): string[] {
  if (!Array.isArray(business?.categories)) return [];
  return business.categories
    .map((item: any) => item?.category?.name || item?.name)
    .filter((name: unknown): name is string => typeof name === 'string' && name.trim().length > 0)
    .map((name) => name.trim());
}

export function isPopularBusinessPartner(business: any, categoryNames = getBusinessCategoryNames(business)) {
  if (business?.isPopular === true || business?.isFeatured === true) return true;
  if (categoryNames.includes(POPULAR_PARTNER_TAG)) return true;

  const rawTags = Array.isArray(business?.tags) ? business.tags : [];
  if (rawTags.some((tag: unknown) => tag === POPULAR_PARTNER_TAG)) return true;

  const createdAt = Date.parse(business?.createdAt || business?.approvedAt || '');
  return Number.isFinite(createdAt) && createdAt < POPULAR_PARTNER_BATCH_CUTOFF;
}

export function getBusinessDisplayTags(
  categoryNames: string[],
  businessType?: string | null,
  isPopular = false,
  maxTags = 3,
) {
  const baseTags = categoryNames.filter((name) => name !== POPULAR_PARTNER_TAG);
  const tags = isPopular ? [POPULAR_PARTNER_TAG, ...baseTags] : [...baseTags];

  if (tags.length === 0 && businessType) tags.push(businessType);

  return Array.from(new Set(tags)).slice(0, maxTags);
}

export function sortPopularPartnersFirst<T extends { isPopular?: boolean }>(items: T[]) {
  return [...items].sort((a, b) => Number(Boolean(b.isPopular)) - Number(Boolean(a.isPopular)));
}
