import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

type Provider = 'kakao' | 'naver';
type ImportTarget = 'api' | 'database';

type BusinessCategory =
  | '웨딩홀'
  | '드레스'
  | '피부과'
  | '스튜디오'
  | '헤어'
  | '메이크업'
  | '가전'
  | '스냅'
  | '한복'
  | '성형외과'
  | '보석'
  | '답례품'
  | '자동차'
  | '신혼여행'
  | '가구';

type PlaceCandidate = {
  provider: Provider;
  providerId: string;
  name: string;
  category: BusinessCategory;
  address: string;
  phone?: string | null;
  lat?: number | null;
  lng?: number | null;
  url?: string | null;
};

const WEDDING_PARTNER_CATEGORIES: BusinessCategory[] = [
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

const CATEGORY_KEYWORDS: Record<BusinessCategory, string[]> = {
  웨딩홀: ['웨딩홀', '예식장', '컨벤션 웨딩홀'],
  드레스: ['웨딩드레스', '드레스샵', '브라이덜샵'],
  피부과: ['웨딩 피부관리', '피부과', '에스테틱'],
  스튜디오: ['웨딩 스튜디오', '웨딩촬영 스튜디오', '브라이덜 스튜디오'],
  헤어: ['웨딩 헤어', '헤어메이크업', '헤어샵'],
  메이크업: ['웨딩 메이크업', '메이크업샵', '혼주 메이크업'],
  가전: ['혼수가전', '가전 매장', '전자제품 매장'],
  스냅: ['웨딩스냅', '본식스냅', '스냅사진'],
  한복: ['혼주한복', '웨딩한복', '한복대여'],
  성형외과: ['성형외과', '웨딩 성형외과', '쁘띠성형'],
  보석: ['예물', '웨딩반지', '주얼리'],
  답례품: ['결혼 답례품', '웨딩 답례품', '답례품'],
  자동차: ['웨딩카', '수입차 렌트', '렌터카'],
  신혼여행: ['허니문 여행사', '신혼여행', '여행사'],
  가구: ['신혼가구', '가구점', '혼수가구'],
};

const CATEGORY_DISPLAY_ORDER = new Map(
  WEDDING_PARTNER_CATEGORIES.map((category, index) => [category, index]),
);

const DEFAULT_REGIONS = ['서울', '경기', '인천'];
const DEFAULT_MAX_PER_CATEGORY = 20;
const DEFAULT_PAGE_SIZE = 15;

function readCsvEnv(name: string, fallback: string[]) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const values = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return values.length ? values : fallback;
}

function parseCategories() {
  const requested = readCsvEnv('MAP_IMPORT_CATEGORIES', WEDDING_PARTNER_CATEGORIES);
  const allowed = new Set<string>(WEDDING_PARTNER_CATEGORIES);
  const categories = requested.filter((category): category is BusinessCategory => allowed.has(category));
  const ignored = requested.filter((category) => !allowed.has(category));
  if (ignored.length > 0) {
    console.warn(`알 수 없는 카테고리 제외: ${ignored.join(', ')}`);
  }
  return categories.length ? categories : WEDDING_PARTNER_CATEGORIES;
}

function normalizeText(value?: string | null) {
  return (value || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKey(value?: string | null) {
  return normalizeText(value).toLowerCase().replace(/\s+/g, '');
}

function placeKey(place: Pick<PlaceCandidate, 'name' | 'address'>) {
  return `${normalizeKey(place.name)}|${normalizeKey(place.address)}`;
}

function getProvider(): Provider {
  const requested = (process.env.MAP_PROVIDER || process.env.PROVIDER || '').toLowerCase();
  if (requested === 'kakao' || requested === 'daum') return 'kakao';
  if (requested === 'naver') return 'naver';
  if (process.env.KAKAO_REST_API_KEY) return 'kakao';
  return 'naver';
}

function getTarget(): ImportTarget {
  const requested = (process.env.IMPORT_TARGET || '').toLowerCase();
  if (requested === 'api' || requested === 'database') return requested;
  if (getApiBaseUrl() && process.env.ADMIN_SECRET_KEY) return 'api';
  return 'database';
}

function getApiBaseUrl() {
  return (
    process.env.ADMIN_API_URL ||
    process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    ''
  ).replace(/\/$/, '');
}

function adminHeaders() {
  const key = process.env.ADMIN_SECRET_KEY;
  if (!key) throw new Error('ADMIN_SECRET_KEY is required for IMPORT_TARGET=api.');
  return {
    'content-type': 'application/json',
    'x-admin-key': key,
  };
}

function assertProviderConfig(provider: Provider) {
  if (provider === 'kakao') {
    if (!process.env.KAKAO_REST_API_KEY) {
      throw new Error('KAKAO_REST_API_KEY is required for Kakao/Daum Local search.');
    }
    return;
  }

  const clientId =
    process.env.NAVER_LOCAL_CLIENT_ID ||
    process.env.NAVER_MAP_CLIENT_ID ||
    process.env.NAVER_CLIENT_ID;
  const clientSecret =
    process.env.NAVER_LOCAL_CLIENT_SECRET ||
    process.env.NAVER_MAP_CLIENT_SECRET ||
    process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('NAVER_LOCAL_CLIENT_ID/NAVER_LOCAL_CLIENT_SECRET are required for Naver Local search.');
  }
}

function assertTargetConfig(target: ImportTarget) {
  if (target === 'api') {
    if (!getApiBaseUrl()) {
      throw new Error('ADMIN_API_URL, API_BASE_URL, or NEXT_PUBLIC_API_URL is required for IMPORT_TARGET=api.');
    }
    if (!process.env.ADMIN_SECRET_KEY) {
      throw new Error('ADMIN_SECRET_KEY is required for IMPORT_TARGET=api.');
    }
    return;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for IMPORT_TARGET=database.');
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toNumber(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : ({} as T);
}

async function searchKakao(category: BusinessCategory, query: string, page = 1) {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) throw new Error('KAKAO_REST_API_KEY is required for Kakao/Daum Local search.');

  const url = new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
  url.searchParams.set('query', query);
  url.searchParams.set('page', String(page));
  url.searchParams.set('size', String(DEFAULT_PAGE_SIZE));

  const payload = await fetchJson<{
    documents: Array<{
      id: string;
      place_name: string;
      road_address_name?: string;
      address_name?: string;
      phone?: string;
      x?: string;
      y?: string;
      place_url?: string;
    }>;
    meta?: { is_end?: boolean };
  }>(url.toString(), {
    headers: { Authorization: `KakaoAK ${key}` },
  });

  const places = payload.documents
    .map((item) => ({
      provider: 'kakao' as const,
      providerId: item.id,
      name: normalizeText(item.place_name),
      category,
      address: normalizeText(item.road_address_name || item.address_name),
      phone: normalizeText(item.phone) || null,
      lat: toNumber(item.y),
      lng: toNumber(item.x),
      url: item.place_url || null,
    }))
    .filter((item) => item.name && item.address);

  return { places, isEnd: Boolean(payload.meta?.is_end) };
}

async function searchNaver(category: BusinessCategory, query: string, start = 1) {
  const clientId =
    process.env.NAVER_LOCAL_CLIENT_ID ||
    process.env.NAVER_MAP_CLIENT_ID ||
    process.env.NAVER_CLIENT_ID;
  const clientSecret =
    process.env.NAVER_LOCAL_CLIENT_SECRET ||
    process.env.NAVER_MAP_CLIENT_SECRET ||
    process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('NAVER_LOCAL_CLIENT_ID/NAVER_LOCAL_CLIENT_SECRET are required for Naver Local search.');
  }

  const url = new URL('https://openapi.naver.com/v1/search/local.json');
  url.searchParams.set('query', query);
  url.searchParams.set('display', String(DEFAULT_PAGE_SIZE));
  url.searchParams.set('start', String(start));
  url.searchParams.set('sort', 'random');

  const payload = await fetchJson<{
    items: Array<{
      title: string;
      link?: string;
      telephone?: string;
      address?: string;
      roadAddress?: string;
    }>;
    total?: number;
  }>(url.toString(), {
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
    },
  });

  const places = payload.items
    .map((item, index) => ({
      provider: 'naver' as const,
      providerId: `${normalizeKey(item.title)}-${normalizeKey(item.roadAddress || item.address)}-${start + index}`,
      name: normalizeText(item.title),
      category,
      address: normalizeText(item.roadAddress || item.address),
      phone: normalizeText(item.telephone) || null,
      lat: null,
      lng: null,
      url: item.link || null,
    }))
    .filter((item) => item.name && item.address);

  return { places, isEnd: start + DEFAULT_PAGE_SIZE > (payload.total || 0) };
}

function buildQueries(category: BusinessCategory, regions: string[]) {
  const keywords = CATEGORY_KEYWORDS[category];
  const queries = new Set<string>();
  for (const region of regions) {
    for (const keyword of keywords) {
      queries.add(`${region} ${keyword}`);
    }
  }
  return [...queries];
}

async function collectPlaces(provider: Provider, categories: BusinessCategory[], regions: string[], maxPerCategory: number) {
  const collected: PlaceCandidate[] = [];
  const seen = new Set<string>();

  for (const category of categories) {
    let categoryCount = 0;
    const queries = buildQueries(category, regions);

    for (const query of queries) {
      if (categoryCount >= maxPerCategory) break;

      for (let page = 1; page <= 3; page += 1) {
        if (categoryCount >= maxPerCategory) break;

        const result =
          provider === 'kakao'
            ? await searchKakao(category, query, page)
            : await searchNaver(category, query, 1 + (page - 1) * DEFAULT_PAGE_SIZE);

        for (const place of result.places) {
          const key = placeKey(place);
          if (seen.has(key)) continue;
          seen.add(key);
          collected.push(place);
          categoryCount += 1;
          if (categoryCount >= maxPerCategory) break;
        }

        await wait(160);
        if (result.isEnd) break;
      }
    }

    console.log(`- ${category}: ${categoryCount}개 후보 수집`);
  }

  return collected;
}

async function getExistingKeysFromApi(apiBaseUrl: string) {
  const keys = new Set<string>();
  let page = 1;

  while (page <= 20) {
    const payload = await fetchJson<{
      data?: Array<{ businessName: string; address?: string | null }>;
      total?: number;
      limit?: number;
    }>(`${apiBaseUrl}/api/v1/admin/businesses?page=${page}&limit=200`, {
      headers: adminHeaders(),
    });
    const items = payload.data || [];
    for (const item of items) {
      keys.add(placeKey({ name: item.businessName, address: item.address || '' }));
    }
    if (!items.length || items.length < 200) break;
    page += 1;
  }

  return keys;
}

async function getApiCategoryNames(apiBaseUrl: string) {
  const payload = await fetchJson<Array<{ name: string }>>(`${apiBaseUrl}/api/v1/admin/business-categories`, {
    headers: adminHeaders(),
  });
  return new Set(payload.map((item) => item.name));
}

async function getExistingKeysFromDb(prisma: PrismaClient) {
  const existing = await prisma.businessProfile.findMany({
    select: { businessName: true, address: true },
  });
  return new Set(existing.map((item) => placeKey({ name: item.businessName, address: item.address || '' })));
}

async function ensureCategories(prisma: PrismaClient, categories: BusinessCategory[]) {
  const existing = await prisma.category.findMany({
    where: { type: 'business', name: { in: categories } },
    select: { id: true, name: true },
  });
  const byName = new Map(existing.map((item) => [item.name, item.id]));

  for (const category of categories) {
    if (byName.has(category)) continue;
    const created = await prisma.category.create({
      data: {
        type: 'business',
        name: category,
        displayOrder: CATEGORY_DISPLAY_ORDER.get(category) || 0,
        isActive: true,
      },
      select: { id: true, name: true },
    });
    byName.set(created.name, created.id);
  }

  return byName;
}

function buildDescription(place: PlaceCandidate) {
  const source = place.provider === 'kakao' ? '카카오맵' : '네이버 지역검색';
  return `<p>${place.category} 카테고리의 웨딩 파트너 업체입니다.</p><p>업체 기본 정보는 ${source} 장소 검색 API 기준으로 등록되었습니다.</p>`;
}

async function createBusinessByApi(apiBaseUrl: string, place: PlaceCandidate) {
  return fetchJson(`${apiBaseUrl}/api/v1/admin/businesses`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({
      businessName: place.name,
      businessType: place.category,
      address: place.address,
      phone: place.phone || undefined,
      lat: place.lat ?? undefined,
      lng: place.lng ?? undefined,
      websiteUrl: place.url || undefined,
      descriptionHtml: buildDescription(place),
      categoryNames: [place.category],
      status: 'approved',
    }),
  });
}

async function generateReferralCode(prisma: PrismaClient) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
    const exists = await prisma.user.findUnique({ where: { referralCode: code }, select: { id: true } });
    if (!exists) return code;
  }
  return randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
}

async function createBusinessByDb(prisma: PrismaClient, categoryIds: Map<string, string>, place: PlaceCandidate) {
  const user = await prisma.user.create({
    data: {
      name: place.name,
      email: `biz-${randomUUID()}@freetiful.internal`,
      role: 'business',
      referralCode: await generateReferralCode(prisma),
    },
    select: { id: true },
  });

  const categoryId = categoryIds.get(place.category);
  return prisma.businessProfile.create({
    data: {
      userId: user.id,
      businessName: place.name,
      status: 'approved',
      businessType: place.category,
      address: place.address,
      phone: place.phone || null,
      lat: place.lat,
      lng: place.lng,
      websiteUrl: place.url || null,
      descriptionHtml: buildDescription(place),
      approvedAt: new Date(),
      categories: categoryId ? { create: [{ categoryId }] } : undefined,
    },
  });
}

async function importByApi(places: PlaceCandidate[], dryRun: boolean) {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) throw new Error('ADMIN_API_URL, API_BASE_URL, or NEXT_PUBLIC_API_URL is required for IMPORT_TARGET=api.');

  const existingKeys = await getExistingKeysFromApi(apiBaseUrl);
  let created = 0;
  let skipped = 0;

  for (const place of places) {
    const key = placeKey(place);
    if (existingKeys.has(key)) {
      skipped += 1;
      continue;
    }
    if (!dryRun) await createBusinessByApi(apiBaseUrl, place);
    existingKeys.add(key);
    created += 1;
    console.log(`${dryRun ? '[dry-run] ' : ''}등록: ${place.category} · ${place.name}`);
    await wait(120);
  }

  return { created, skipped };
}

async function importByDatabase(places: PlaceCandidate[], dryRun: boolean) {
  const prisma = new PrismaClient();
  try {
    const categoryIds = await ensureCategories(prisma, WEDDING_PARTNER_CATEGORIES);
    const existingKeys = await getExistingKeysFromDb(prisma);
    let created = 0;
    let skipped = 0;

    for (const place of places) {
      const key = placeKey(place);
      if (existingKeys.has(key)) {
        skipped += 1;
        continue;
      }
      if (!dryRun) await createBusinessByDb(prisma, categoryIds, place);
      existingKeys.add(key);
      created += 1;
      console.log(`${dryRun ? '[dry-run] ' : ''}등록: ${place.category} · ${place.name}`);
    }

    return { created, skipped };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const provider = getProvider();
  const target = getTarget();
  const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
  const regions = readCsvEnv('MAP_IMPORT_REGIONS', DEFAULT_REGIONS);
  let categories = parseCategories();
  const maxPerCategory = Number(process.env.MAP_IMPORT_LIMIT_PER_CATEGORY || DEFAULT_MAX_PER_CATEGORY);

  assertProviderConfig(provider);
  assertTargetConfig(target);

  if (target === 'api') {
    const apiCategories = await getApiCategoryNames(getApiBaseUrl());
    const missing = categories.filter((category) => !apiCategories.has(category));
    if (missing.length > 0) {
      console.warn(`운영 API에 없는 카테고리 제외: ${missing.join(', ')}`);
      categories = categories.filter((category) => apiCategories.has(category));
    }
    if (categories.length === 0) {
      throw new Error('등록 가능한 웨딩파트너 카테고리가 없습니다.');
    }
  }

  console.log(`지도 API 업체 수집 시작: provider=${provider}, target=${target}, dryRun=${dryRun ? 'yes' : 'no'}`);
  console.log(`지역: ${regions.join(', ')}`);
  console.log(`카테고리: ${categories.join(', ')}`);

  const places = await collectPlaces(provider, categories, regions, maxPerCategory);
  console.log(`총 ${places.length}개 후보 수집 완료`);

  const result =
    target === 'api'
      ? await importByApi(places, dryRun)
      : await importByDatabase(places, dryRun);

  console.log(`완료: 등록 ${result.created}개, 중복 스킵 ${result.skipped}개`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
