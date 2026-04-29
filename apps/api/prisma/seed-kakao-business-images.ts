import axios from 'axios';
import { BusinessStatus, PrismaClient } from '@prisma/client';

const KAKAO_IMAGE_SEARCH_URL = 'https://dapi.kakao.com/v2/search/image';
const TAG_MARKER = 'business-tags';

type BusinessForImage = {
  id: string;
  businessName: string;
  businessType: string | null;
  address: string | null;
  descriptionHtml: string | null;
  user: { email: string | null };
  categories: Array<{ category: { name: string } }>;
};

type KakaoImageDocument = {
  collection?: string;
  thumbnail_url?: string;
  image_url?: string;
  width?: number;
  height?: number;
  display_sitename?: string;
  doc_url?: string;
  datetime?: string;
};

type KakaoImageResponse = {
  documents?: KakaoImageDocument[];
};

function getRuntimeDatabaseUrl() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) return undefined;

  try {
    const url = new URL(rawUrl);
    if (url.hostname.includes('pooler.supabase.com')) {
      if (url.port === '5432') url.port = '6543';
      url.searchParams.set('pgbouncer', 'true');
      url.searchParams.set('connection_limit', process.env.DATABASE_CONNECTION_LIMIT || '1');
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

const prisma = new PrismaClient(
  getRuntimeDatabaseUrl()
    ? { datasources: { db: { url: getRuntimeDatabaseUrl() } } }
    : undefined,
);

function numberFromEnv(names: string[], fallback: number, min: number, max: number) {
  for (const name of names) {
    const raw = process.env[name];
    if (!raw) continue;
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return Math.min(max, Math.max(min, Math.floor(parsed)));
  }
  return fallback;
}

function getKakaoRestApiKey() {
  const key = process.env.KAKAO_LOCAL_REST_API_KEY
    || process.env.KAKAO_MAP_REST_API_KEY
    || process.env.KAKAO_REST_API_KEY;

  if (!key) {
    throw new Error('KAKAO_REST_API_KEY 또는 KAKAO_MAP_REST_API_KEY가 필요합니다.');
  }

  return key;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clean(value?: string | null) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function addressKeywords(address?: string | null) {
  const parts = clean(address).split(' ').filter(Boolean);
  return unique([
    parts.slice(0, 3).join(' '),
    parts.slice(0, 2).join(' '),
    parts[0],
  ].filter(Boolean));
}

function getCategoryNames(business: BusinessForImage) {
  return unique([
    ...business.categories.map((item) => item.category.name),
    business.businessType,
  ].map(clean).filter(Boolean));
}

function buildQueries(business: BusinessForImage) {
  const name = clean(business.businessName);
  const categories = getCategoryNames(business);
  const regions = addressKeywords(business.address);

  return unique([
    ...regions.map((region) => `${name} ${region}`),
    ...categories.map((category) => `${name} ${category}`),
    name,
  ].map(clean).filter((query) => query.length > 0));
}

function isProbablyUsableImage(doc: KakaoImageDocument) {
  const imageUrl = clean(doc.image_url);
  const thumbnailUrl = clean(doc.thumbnail_url);
  if (!imageUrl && !thumbnailUrl) return false;

  const width = Number(doc.width || 0);
  const height = Number(doc.height || 0);
  if (width > 0 && height > 0) {
    if (width < 180 || height < 140) return false;
    const ratio = width / height;
    if (ratio < 0.38 || ratio > 3.2) return false;
  }

  const lowerUrl = `${imageUrl} ${thumbnailUrl}`.toLowerCase();
  if (/\.(gif|svg)(\?|$)/.test(lowerUrl)) return false;
  if (/static\.map|staticmap|map\/staticmap/.test(lowerUrl)) return false;

  return true;
}

function preferredImageUrl(doc: KakaoImageDocument) {
  const imageUrl = clean(doc.image_url);
  const thumbnailUrl = clean(doc.thumbnail_url);

  if (imageUrl) {
    return imageUrl;
  }

  return thumbnailUrl;
}

async function searchImages(query: string, apiKey: string) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await axios.get<KakaoImageResponse>(KAKAO_IMAGE_SEARCH_URL, {
        headers: { Authorization: `KakaoAK ${apiKey}` },
        params: {
          query,
          sort: 'accuracy',
          size: 12,
        },
        timeout: 10_000,
      });

      return response.data.documents || [];
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : null;
      const retryable = status === 429 || (typeof status === 'number' && status >= 500);
      if (retryable && attempt < 4) {
        await sleep(900 * attempt);
        continue;
      }

      console.warn(`이미지 검색 실패 건너뜀: query="${query}", status=${status || 'unknown'}`);
      return [];
    }
  }

  return [];
}

function selectImageUrls(documents: KakaoImageDocument[], maxImages: number) {
  const urls = documents
    .filter(isProbablyUsableImage)
    .map(preferredImageUrl)
    .filter(Boolean);

  return unique(urls).slice(0, maxImages);
}

async function findImageUrlsForBusiness(business: BusinessForImage, apiKey: string, maxImages: number) {
  const seenUrls = new Set<string>();

  for (const query of buildQueries(business)) {
    const documents = await searchImages(query, apiKey);
    const urls = selectImageUrls(documents, maxImages)
      .filter((url) => !seenUrls.has(url));

    urls.forEach((url) => seenUrls.add(url));
    if (seenUrls.size >= maxImages) break;
  }

  return Array.from(seenUrls).slice(0, maxImages);
}

function kakaoSeedWhere() {
  return {
    OR: [
      { descriptionHtml: { contains: TAG_MARKER } },
      { user: { email: { startsWith: 'kakao-' } } },
    ],
  };
}

function categoryFilter() {
  const categories = clean(process.env.KAKAO_BUSINESS_IMAGE_CATEGORIES)
    .split(',')
    .map(clean)
    .filter(Boolean);

  if (categories.length === 0) return {};

  return {
    categories: {
      some: {
        category: { name: { in: categories } },
      },
    },
  };
}

async function getBusinessesWithoutImages(limit: number) {
  const baseWhere = {
    status: BusinessStatus.approved,
    images: { none: {} },
    ...categoryFilter(),
  };

  const curated = await prisma.businessProfile.findMany({
    where: { ...baseWhere, NOT: kakaoSeedWhere() },
    take: limit,
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      businessName: true,
      businessType: true,
      address: true,
      descriptionHtml: true,
      user: { select: { email: true } },
      categories: { include: { category: { select: { name: true } } } },
    },
  });

  if (curated.length >= limit) return curated;

  const seeded = await prisma.businessProfile.findMany({
    where: {
      ...baseWhere,
      ...kakaoSeedWhere(),
      id: { notIn: curated.map((item) => item.id) },
    },
    take: limit - curated.length,
    orderBy: [{ profileViews: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      businessName: true,
      businessType: true,
      address: true,
      descriptionHtml: true,
      user: { select: { email: true } },
      categories: { include: { category: { select: { name: true } } } },
    },
  });

  return [...curated, ...seeded];
}

async function addImagesToBusiness(business: BusinessForImage, apiKey: string, maxImages: number) {
  const existing = await prisma.businessImage.findMany({
    where: { businessProfileId: business.id },
    select: { imageUrl: true, displayOrder: true },
    orderBy: { displayOrder: 'desc' },
  });
  const existingUrls = new Set(existing.map((item) => item.imageUrl));
  const startOrder = (existing[0]?.displayOrder ?? -1) + 1;
  const imageUrls = (await findImageUrlsForBusiness(business, apiKey, maxImages))
    .filter((url) => !existingUrls.has(url));

  if (imageUrls.length === 0) return 0;

  await prisma.businessImage.createMany({
    data: imageUrls.map((imageUrl, index) => ({
      businessProfileId: business.id,
      imageUrl,
      displayOrder: startOrder + index,
    })),
  });

  return imageUrls.length;
}

async function runWorker(
  workerId: number,
  businesses: BusinessForImage[],
  state: { index: number; addedProfiles: number; addedImages: number; missed: number; failed: number },
  apiKey: string,
  maxImages: number,
  delayMs: number,
) {
  while (state.index < businesses.length) {
    const currentIndex = state.index;
    state.index += 1;
    const business = businesses[currentIndex];

    try {
      const added = await addImagesToBusiness(business, apiKey, maxImages);
      if (added > 0) {
        state.addedProfiles += 1;
        state.addedImages += added;
      } else {
        state.missed += 1;
      }

      if ((currentIndex + 1) % 25 === 0 || currentIndex === businesses.length - 1) {
        console.log(
          `진행 ${currentIndex + 1}/${businesses.length}: 이미지 ${state.addedImages}장 추가, 미발견 ${state.missed}개`,
        );
      }
    } catch (error) {
      state.failed += 1;
      console.warn(`이미지 추가 실패: ${business.businessName} (${business.id})`, error);
    }

    if (delayMs > 0) await sleep(delayMs + workerId * 30);
  }
}

async function main() {
  const apiKey = getKakaoRestApiKey();
  const limit = numberFromEnv(['KAKAO_BUSINESS_IMAGE_LIMIT'], 500, 1, 50_000);
  const maxImages = numberFromEnv(['KAKAO_BUSINESS_IMAGES_PER_PROFILE'], 1, 1, 5);
  const concurrency = numberFromEnv(['KAKAO_BUSINESS_IMAGE_CONCURRENCY'], 2, 1, 8);
  const delayMs = numberFromEnv(['KAKAO_BUSINESS_IMAGE_DELAY_MS'], 120, 0, 5_000);

  const remaining = await prisma.businessProfile.count({
    where: {
      status: BusinessStatus.approved,
      images: { none: {} },
      ...categoryFilter(),
    },
  });
  const businesses = await getBusinessesWithoutImages(Math.min(limit, remaining));

  console.log(
    `카카오 이미지 검색으로 업체 이미지 채우기 시작: 대상 ${businesses.length}/${remaining}개, 업체당 ${maxImages}장, 동시 ${concurrency}`,
  );

  const state = { index: 0, addedProfiles: 0, addedImages: 0, missed: 0, failed: 0 };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, businesses.length) }, (_, index) =>
      runWorker(index, businesses, state, apiKey, maxImages, delayMs),
    ),
  );

  console.log(
    `완료: 이미지 추가 업체 ${state.addedProfiles}개, 이미지 ${state.addedImages}장, 미발견 ${state.missed}개, 실패 ${state.failed}개`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
