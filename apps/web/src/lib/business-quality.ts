import { WEDDING_PARTNER_CATEGORIES, type WeddingPartnerCategory } from './business-categories';

const GLOBAL_REJECT_KEYWORDS = [
  '장례',
  '상조',
  '추모',
  '납골',
  '화장장',
  '요양병원',
  '재활병원',
  '떡볶이',
  '분식',
  '김밥',
  '치킨',
  '족발',
  '피자',
  '국밥',
  '순대',
  '마라탕',
  '노래방',
  'pc방',
  '피씨방',
  '부동산',
];

const CATEGORY_KEYWORDS: Record<WeddingPartnerCategory, string[]> = {
  웨딩홀: ['웨딩홀', '예식장', '컨벤션', '채플', '웨딩', '호텔웨딩', '하우스웨딩', '파크텔', '빌라드', '아모르'],
  드레스: ['드레스', '브라이덜', '브라이드', '부띠끄', '부티크', '웨딩샵'],
  피부과: ['피부', '피부과', '의원', '클리닉', '에스테틱', '스킨', '뷰티'],
  스튜디오: ['스튜디오', '사진관', '촬영', '프로필', '포토'],
  헤어: ['헤어', '살롱', '미용실', '헤메', '스타일링'],
  메이크업: ['메이크업', '메이크', '헤메', '뷰티', '스타일링'],
  가전: ['가전', '전자', '하이마트', '삼성스토어', '전자랜드', '테크노', '재활용센터'],
  스냅: ['스냅', '본식스냅', '필름', '그라피', '포토', '사진', '촬영', 'dvd', '영상'],
  한복: ['한복'],
  성형외과: ['성형', '성형외과', '쁘띠'],
  보석: ['보석', '주얼리', '쥬얼리', '예물', '커플링', '웨딩밴드', '다이아', '금은방'],
  답례품: ['답례', '답례품', '선물', '떡', '과자', '케이크', '캔들', '향수', '공방', '캐러멜', '쿠키'],
  자동차: ['웨딩카', '자동차', '리무진', '의전', '렌터카', '렌트카', '플라워카'],
  신혼여행: ['신혼여행', '허니문', '여행', '투어', '리조트'],
  가구: ['가구', '침대', '소파', '리빙', '한샘', '이케아', '테이블', '매트리스'],
};

const CATEGORY_REJECT_KEYWORDS: Partial<Record<WeddingPartnerCategory, string[]>> = {
  웨딩홀: ['장례', '상조', '떡볶이', '분식', '부페', '뷔페'],
  드레스: ['웨딩홀', '예식장', '컨벤션'],
  스튜디오: ['웨딩홀', '예식장', '컨벤션'],
  성형외과: ['피부과'],
  보석: ['무신사'],
  자동차: ['하이마트', '가전'],
  신혼여행: ['시티투어버스', '서울시티투어버스', '리무진'],
};

const DISALLOWED_IMAGE_HOST_PATTERNS = [
  /(^|\.)inven\.co\.kr$/i,
  /(^|\.)ruliweb\.com$/i,
  /(^|\.)viva100\.com$/i,
  /(^|\.)uf\.daum\.net$/i,
  /(^|\.)newsis\.com$/i,
  /(^|\.)yna\.co\.kr$/i,
  /(^|\.)mt\.co\.kr$/i,
  /(^|\.)mk\.co\.kr$/i,
  /(^|\.)joongang\.co\.kr$/i,
  /(^|\.)chosun\.com$/i,
];

const ALLOWED_IMAGE_HOST_PATTERNS = [
  /(^|\.)postfiles\.pstatic\.net$/i,
  /(^|\.)blogfiles\.pstatic\.net$/i,
  /(^|\.)mblogthumb-phinf\.pstatic\.net$/i,
  /(^|\.)dthumb-phinf\.pstatic\.net$/i,
  /(^|\.)ldb-phinf\.pstatic\.net$/i,
  /(^|\.)search\.pstatic\.net$/i,
  /(^|\.)naverbooking-phinf\.pstatic\.net$/i,
  /(^|\.)shop-phinf\.pstatic\.net$/i,
  /(^|\.)blog\.kakaocdn\.net$/i,
  /(^|\.)cdn\.imweb\.me$/i,
  /(^|\.)storage\.googleapis\.com$/i,
  /(^|\.)marryviliaprestige\.com$/i,
  /(^|\.)eltower\.co\.kr$/i,
  /(^|\.)bridevalley\.co\.kr$/i,
];

const TYPE_CATEGORY_RULES: Array<{ test: RegExp; categories: WeddingPartnerCategory[] }> = [
  { test: /웨딩홀|예식장|컨벤션|채플/, categories: ['웨딩홀'] },
  { test: /드레스|브라이덜|브라이드/, categories: ['드레스'] },
  { test: /피부과|피부|에스테틱/, categories: ['피부과'] },
  { test: /성형외과|성형/, categories: ['성형외과'] },
  { test: /스튜디오|사진관/, categories: ['스튜디오'] },
  { test: /헤메샵|헤어.*메이크|메이크.*헤어/, categories: ['헤어', '메이크업'] },
  { test: /헤어|미용실|살롱/, categories: ['헤어'] },
  { test: /메이크업|메이크/, categories: ['메이크업'] },
  { test: /가전|전자|하이마트/, categories: ['가전'] },
  { test: /dvd|스냅|본식스냅|영상/, categories: ['스냅'] },
  { test: /한복/, categories: ['한복'] },
  { test: /보석|주얼리|쥬얼리|예물/, categories: ['보석'] },
  { test: /답례품|답례/, categories: ['답례품'] },
  { test: /자동차|웨딩카|리무진|렌터카|렌트카/, categories: ['자동차'] },
  { test: /신혼여행|허니문|여행|투어/, categories: ['신혼여행'] },
  { test: /가구|침대|소파|리빙/, categories: ['가구'] },
];

const TRUSTED_CURATED_BUSINESS_BEFORE = new Date('2026-04-27T15:00:00.000Z').getTime();

type BusinessCategoryItem = { category?: { name?: string | null } | null; name?: string | null };

export interface BusinessQualityInput {
  businessName?: string | null;
  businessType?: string | null;
  address?: string | null;
  descriptionHtml?: string | null;
  createdAt?: Date | string | null;
  approvedAt?: Date | string | null;
  categories?: Array<BusinessCategoryItem | null> | null;
}

function normalizeText(value?: string | null) {
  return String(value || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, '');
}

function hasAnyKeyword(text: string, keywords: readonly string[]) {
  return keywords.some((keyword) => text.includes(normalizeText(keyword)));
}

function getSearchText(business: BusinessQualityInput) {
  return normalizeText([business.businessName, business.businessType, business.address].filter(Boolean).join(' '));
}

function getNameTypeText(business: BusinessQualityInput) {
  return normalizeText([business.businessName, business.businessType].filter(Boolean).join(' '));
}

function getAddressText(business: BusinessQualityInput) {
  return normalizeText(business.address);
}

function isTrustedCuratedBusiness(business: BusinessQualityInput) {
  const raw = business.createdAt || business.approvedAt;
  if (!raw) return false;
  const value = raw instanceof Date ? raw.getTime() : new Date(raw).getTime();
  return Number.isFinite(value) && value < TRUSTED_CURATED_BUSINESS_BEFORE;
}

function getCategoriesForType(businessType?: string | null) {
  const normalizedType = normalizeText(businessType);
  if (!normalizedType) return [];
  const matched = TYPE_CATEGORY_RULES.find((rule) => rule.test.test(normalizedType));
  return matched?.categories || [];
}

function hasCategoryKeywordInNameType(business: BusinessQualityInput, category: WeddingPartnerCategory) {
  return hasAnyKeyword(getNameTypeText(business), CATEGORY_KEYWORDS[category] || [category]);
}

function hasCategoryKeywordInAddress(business: BusinessQualityInput, category: WeddingPartnerCategory) {
  return hasAnyKeyword(getAddressText(business), CATEGORY_KEYWORDS[category] || [category]);
}

function isAllowedCrossCategory(category: WeddingPartnerCategory, typeCategories: WeddingPartnerCategory[], text: string) {
  if ((category === '헤어' || category === '메이크업') && typeCategories.some((item) => item === '헤어' || item === '메이크업')) {
    return true;
  }
  if (category === '한복' && hasAnyKeyword(text, CATEGORY_KEYWORDS.한복)) return true;
  if (category === '스냅' && hasAnyKeyword(text, CATEGORY_KEYWORDS.스냅)) return true;
  return false;
}

export function getBusinessCategoryNames(business: BusinessQualityInput) {
  return (business.categories || [])
    .map((item) => item?.category?.name || item?.name)
    .filter(
      (name): name is WeddingPartnerCategory =>
        typeof name === 'string' && WEDDING_PARTNER_CATEGORIES.includes(name.trim() as WeddingPartnerCategory),
    )
    .map((name) => name.trim() as WeddingPartnerCategory);
}

export function isBusinessRelevantToCategory(business: BusinessQualityInput, category?: string | null) {
  const targetCategory = String(category || '').trim();
  if (!targetCategory || targetCategory === '전체' || targetCategory === '인기') return true;
  if (!WEDDING_PARTNER_CATEGORIES.includes(targetCategory as WeddingPartnerCategory)) return true;

  const typedCategory = targetCategory as WeddingPartnerCategory;
  const text = getSearchText(business);
  if (!text || hasAnyKeyword(text, GLOBAL_REJECT_KEYWORDS) || hasAnyKeyword(text, CATEGORY_REJECT_KEYWORDS[typedCategory] || [])) {
    return false;
  }

  const trustedCurated = isTrustedCuratedBusiness(business);
  const strongNameTypeMatch = hasCategoryKeywordInNameType(business, typedCategory);
  const addressOnlyMatch = hasCategoryKeywordInAddress(business, typedCategory);
  const typeCategories = getCategoriesForType(business.businessType);

  if (typeCategories.length > 0) {
    if (typeCategories.includes(typedCategory)) return trustedCurated || strongNameTypeMatch;
    return trustedCurated
      ? isAllowedCrossCategory(typedCategory, typeCategories, text)
      : isAllowedCrossCategory(typedCategory, typeCategories, getNameTypeText(business));
  }

  if (strongNameTypeMatch) return true;
  if (trustedCurated && addressOnlyMatch) return true;
  return false;
}

export function getRelevantBusinessCategories(business: BusinessQualityInput) {
  const explicit = getBusinessCategoryNames(business).filter((category) => isBusinessRelevantToCategory(business, category));
  if (explicit.length > 0) return explicit;

  return getCategoriesForType(business.businessType).filter((category) => isBusinessRelevantToCategory(business, category));
}

export function isBusinessRelevantToAnyCategory(business: BusinessQualityInput) {
  const text = getSearchText(business);
  if (!text || hasAnyKeyword(text, GLOBAL_REJECT_KEYWORDS)) return false;
  return getRelevantBusinessCategories(business).length > 0;
}

function hasImageFileExtension(url: string) {
  return /\.(jpg|jpeg|png|webp|avif|gif)(\?|$)/i.test(url);
}

export function isAllowedBusinessImageUrl(url?: string | null) {
  const raw = String(url || '').trim();
  if (!raw) return false;
  if (raw.startsWith('/')) return true;

  try {
    const parsed = new URL(raw);
    const hostname = parsed.hostname;
    if (!hostname) return false;
    if (DISALLOWED_IMAGE_HOST_PATTERNS.some((pattern) => pattern.test(hostname))) return false;
    if (ALLOWED_IMAGE_HOST_PATTERNS.some((pattern) => pattern.test(hostname))) return true;
    return hasImageFileExtension(parsed.pathname);
  } catch {
    return false;
  }
}

export function sanitizeBusinessImageUrls(urls: Array<string | null | undefined>) {
  return urls
    .map((url) => String(url || '').trim())
    .filter((url) => isAllowedBusinessImageUrl(url))
    .filter((url, index, array) => array.indexOf(url) === index);
}
