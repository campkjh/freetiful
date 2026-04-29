const WEDDING_PARTNER_CATEGORIES = [
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
];

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

const CATEGORY_KEYWORDS: Record<string, string[]> = {
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

const CATEGORY_REJECT_KEYWORDS: Record<string, string[]> = {
  웨딩홀: ['장례', '상조', '떡볶이', '분식'],
  드레스: ['웨딩홀', '예식장', '컨벤션'],
  스튜디오: ['웨딩홀', '예식장', '컨벤션'],
  성형외과: ['피부과'],
  보석: ['무신사'],
  자동차: ['하이마트', '가전'],
  신혼여행: ['시티투어버스', '서울시티투어버스', '리무진'],
};

const TYPE_CATEGORY_RULES: Array<{ test: RegExp; categories: string[] }> = [
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

export type BusinessQualityInput = {
  businessName?: string | null;
  businessType?: string | null;
  address?: string | null;
  descriptionHtml?: string | null;
  createdAt?: Date | string | null;
  categories?: Array<{ category?: { name?: string | null } | null }>;
};

function normalizeText(value?: string | null) {
  return String(value || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, '');
}

function getSearchText(business: BusinessQualityInput) {
  return normalizeText([
    business.businessName,
    business.businessType,
    business.address,
  ].filter(Boolean).join(' '));
}

function isTrustedCuratedBusiness(business: BusinessQualityInput) {
  if (!business.createdAt) return false;
  const createdAt = business.createdAt instanceof Date
    ? business.createdAt.getTime()
    : new Date(business.createdAt).getTime();
  return Number.isFinite(createdAt) && createdAt < TRUSTED_CURATED_BUSINESS_BEFORE;
}

function getCategoriesForType(businessType?: string | null) {
  const normalizedType = normalizeText(businessType);
  if (!normalizedType) return [];
  const matched = TYPE_CATEGORY_RULES.find((rule) => rule.test.test(normalizedType));
  return matched?.categories || [];
}

function hasAnyKeyword(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(normalizeText(keyword)));
}

function hasGlobalRejectKeyword(text: string) {
  return hasAnyKeyword(text, GLOBAL_REJECT_KEYWORDS);
}

function hasCategoryRejectKeyword(text: string, category: string) {
  return hasAnyKeyword(text, CATEGORY_REJECT_KEYWORDS[category] || []);
}

function isAllowedCrossCategory(category: string, typeCategories: string[], text: string) {
  if ((category === '헤어' || category === '메이크업') && typeCategories.some((item) => item === '헤어' || item === '메이크업')) {
    return true;
  }
  if (category === '한복' && hasAnyKeyword(text, CATEGORY_KEYWORDS.한복)) {
    return true;
  }
  if (category === '스냅' && hasAnyKeyword(text, CATEGORY_KEYWORDS.스냅)) {
    return true;
  }
  return false;
}

export function isBusinessRelevantToCategory(business: BusinessQualityInput, category?: string | null) {
  const targetCategory = String(category || '').trim();
  if (!targetCategory || targetCategory === '전체' || targetCategory === '인기') return true;
  if (!WEDDING_PARTNER_CATEGORIES.includes(targetCategory)) return true;

  const text = getSearchText(business);
  if (!text || hasGlobalRejectKeyword(text) || hasCategoryRejectKeyword(text, targetCategory)) return false;

  const typeCategories = getCategoriesForType(business.businessType);
  if (typeCategories.length > 0) {
    if (typeCategories.includes(targetCategory)) {
      return isTrustedCuratedBusiness(business) || hasAnyKeyword(text, CATEGORY_KEYWORDS[targetCategory] || [targetCategory]);
    }
    return isAllowedCrossCategory(targetCategory, typeCategories, text);
  }

  return hasAnyKeyword(text, CATEGORY_KEYWORDS[targetCategory] || [targetCategory]);
}

export function getBusinessCategoryNames(business: BusinessQualityInput) {
  return (business.categories || [])
    .map((item) => item.category?.name)
    .filter((name): name is string => Boolean(name && name !== '전체' && name !== '인기'));
}

export function isBusinessRelevantToAnyCategory(business: BusinessQualityInput) {
  const text = getSearchText(business);
  if (!text || hasGlobalRejectKeyword(text)) return false;

  const categoryNames = getBusinessCategoryNames(business);
  if (categoryNames.length === 0) return getCategoriesForType(business.businessType).length > 0;

  return categoryNames.some((category) => isBusinessRelevantToCategory(business, category));
}
