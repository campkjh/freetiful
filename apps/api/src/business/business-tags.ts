const CATEGORY_TAGS: Record<string, string[]> = {
  웨딩홀: ['웨딩홀', '홀투어', '예식장'],
  드레스: ['웨딩드레스', '드레스투어', '본식드레스'],
  피부과: ['웨딩케어', '피부관리', '예신관리'],
  스튜디오: ['웨딩촬영', '스튜디오', '리마인드촬영'],
  헤어: ['웨딩헤어', '헤어스타일링', '혼주헤어'],
  메이크업: ['웨딩메이크업', '메이크업샵', '혼주메이크업'],
  가전: ['혼수가전', '신혼가전', '입주준비'],
  스냅: ['웨딩스냅', '본식스냅', '사진촬영'],
  DVD: ['본식DVD', '영상촬영', '웨딩영상'],
  한복: ['혼주한복', '신랑신부한복', '한복대여'],
  성형외과: ['웨딩성형', '쁘띠시술', '예신관리'],
  보석: ['예물', '웨딩밴드', '주얼리'],
  답례품: ['결혼답례품', '하객선물', '커스텀답례'],
  자동차: ['웨딩카', '리무진', '의전차량'],
  신혼여행: ['허니문', '신혼여행', '여행상담'],
  가구: ['신혼가구', '입주가구', '혼수준비'],
};

const NAME_TAG_RULES: Array<{ test: RegExp; tags: string[] }> = [
  { test: /호텔|라마다|오토그래프|파크|그랜드/i, tags: ['호텔웨딩', '프리미엄홀'] },
  { test: /컨벤션|센터|스퀘어|플라자/i, tags: ['컨벤션홀', '대형예식'] },
  { test: /채플|성당|교회/i, tags: ['채플웨딩', '경건한예식'] },
  { test: /가든|야외|하우스/i, tags: ['야외예식', '하우스웨딩'] },
  { test: /청담|논현|강남/i, tags: ['강남권', '접근성좋은'] },
  { test: /데이뷰|피부|의원|클리닉|에스테틱/i, tags: ['프리미엄케어', '피부관리'] },
  { test: /필름|스냅|포토|사진/i, tags: ['감성촬영', '본식기록'] },
  { test: /드레스|브라이드/i, tags: ['드레스피팅', '본식드레스'] },
  { test: /헤어|메이크|메이크업|살롱/i, tags: ['신부스타일링', '혼주스타일링'] },
];

const TAG_MARKER_RE = /<!--freetiful-business-tags:([A-Za-z0-9+/=]+)-->/;
const VISIBILITY_MARKER_RE = /<!--freetiful-business-visibility:(visible|hidden)-->/;

function uniqueClean(values: unknown[], max = 6) {
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const value of values) {
    const tag = String(value || '').trim().replace(/^#+/, '');
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    cleaned.push(tag);
    if (cleaned.length >= max) break;
  }

  return cleaned;
}

export function normalizeBusinessTags(values: unknown, max = 6) {
  return uniqueClean(Array.isArray(values) ? values : [], max);
}

export function extractBusinessTagsFromHtml(html?: string | null) {
  const encoded = html?.match(TAG_MARKER_RE)?.[1];
  if (!encoded) return [];

  try {
    return normalizeBusinessTags(JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')));
  } catch {
    return [];
  }
}

export function stripBusinessTagMarker(html?: string | null) {
  const stripped = String(html || '')
    .replace(TAG_MARKER_RE, '')
    .replace(VISIBILITY_MARKER_RE, '')
    .trim();
  return stripped || null;
}

export function withBusinessTagMarker(html: string | null | undefined, tags: unknown) {
  const cleanHtml = stripBusinessTagMarker(html);
  const normalizedTags = normalizeBusinessTags(tags);
  if (normalizedTags.length === 0) return cleanHtml;

  const encoded = Buffer.from(JSON.stringify(normalizedTags), 'utf8').toString('base64');
  return `${cleanHtml || ''}\n<!--freetiful-business-tags:${encoded}-->`.trim();
}

export function extractBusinessVisibilityFromHtml(html?: string | null) {
  const visibility = html?.match(VISIBILITY_MARKER_RE)?.[1];
  if (visibility === 'visible') return true;
  if (visibility === 'hidden') return false;
  return null;
}

export function withBusinessVisibilityMarker(
  html: string | null | undefined,
  isVisible?: boolean | null,
) {
  const withoutVisibility = String(html || '').replace(VISIBILITY_MARKER_RE, '').trim();
  if (typeof isVisible !== 'boolean') return withoutVisibility || null;
  return `${withoutVisibility}\n<!--freetiful-business-visibility:${isVisible ? 'visible' : 'hidden'}-->`.trim();
}

export function deriveBusinessTags(input: {
  businessName?: string | null;
  businessType?: string | null;
  address?: string | null;
  categoryNames?: Array<string | null | undefined>;
}) {
  const categories = (input.categoryNames || [])
    .map((name) => String(name || '').trim())
    .filter(Boolean)
    .filter((name) => name !== '전체' && name !== '인기');

  const baseTags = categories.flatMap((category) => CATEGORY_TAGS[category] || [category]);
  if (baseTags.length === 0 && input.businessType) baseTags.push(input.businessType);

  const targetText = `${input.businessName || ''} ${input.businessType || ''} ${input.address || ''}`;
  const nameTags = NAME_TAG_RULES.flatMap((rule) => (rule.test.test(targetText) ? rule.tags : []));

  return uniqueClean([...baseTags, ...nameTags], 6);
}

export function resolveBusinessTags(business: {
  businessName?: string | null;
  businessType?: string | null;
  address?: string | null;
  tags?: string[] | null;
  descriptionHtml?: string | null;
  categories?: Array<{ category?: { name?: string | null } | null }>;
}) {
  const storedTags = normalizeBusinessTags(business.tags);
  if (storedTags.length > 0) return storedTags;

  const markerTags = extractBusinessTagsFromHtml(business.descriptionHtml);
  if (markerTags.length > 0) return markerTags;

  return deriveBusinessTags({
    businessName: business.businessName,
    businessType: business.businessType,
    address: business.address,
    categoryNames: business.categories?.map((item) => item.category?.name),
  });
}
