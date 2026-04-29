import axios from 'axios';
import { createHash } from 'crypto';
import { BusinessStatus, PrismaClient, UserRole } from '@prisma/client';
import { deriveBusinessTags, withBusinessTagMarker } from '../src/business/business-tags';

const prisma = new PrismaClient();

const CATEGORIES = [
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

const QUERY_BY_CATEGORY: Record<(typeof CATEGORIES)[number], string> = {
  웨딩홀: '웨딩홀',
  드레스: '웨딩드레스',
  피부과: '웨딩 피부과',
  스튜디오: '웨딩스튜디오',
  헤어: '웨딩 헤어샵',
  메이크업: '웨딩 메이크업',
  가전: '혼수가전',
  스냅: '웨딩스냅',
  한복: '혼주 한복',
  성형외과: '웨딩 성형외과',
  보석: '예물 주얼리',
  답례품: '결혼 답례품',
  자동차: '웨딩카',
  신혼여행: '허니문 여행사',
  가구: '신혼가구',
};

type KakaoPlace = {
  id?: string;
  place_name?: string;
  category_name?: string;
  phone?: string;
  address_name?: string;
  road_address_name?: string;
  x?: string;
  y?: string;
  place_url?: string;
};

type KakaoKeywordResponse = {
  documents?: KakaoPlace[];
  meta?: {
    is_end?: boolean;
    pageable_count?: number;
    total_count?: number;
  };
};

function requireEnv(...names: string[]) {
  const found = names.find((name) => process.env[name]);
  if (found) return process.env[found] as string;
  throw new Error(`${names.join(' or ')} is required`);
}

function hashKey(value: string) {
  return createHash('sha1').update(value).digest('hex');
}

function clean(value?: string | null) {
  return String(value || '').trim();
}

function splitList(value: string | undefined, fallback: string[]) {
  const items = String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getOrCreateBusinessCategory(name: string, displayOrder: number) {
  const existing = await prisma.category.findFirst({
    where: { type: 'business', name },
    select: { id: true },
  });
  if (existing) return existing;

  return prisma.category.create({
    data: { type: 'business', name, displayOrder, isActive: true },
    select: { id: true },
  });
}

async function fetchKakaoPlaces(query: string, page = 1, size = 15) {
  const restApiKey = requireEnv(
    'KAKAO_LOCAL_REST_API_KEY',
    'KAKAO_MAP_REST_API_KEY',
    'KAKAO_REST_API_KEY',
  );

  const { data } = await axios.get<KakaoKeywordResponse>('https://dapi.kakao.com/v2/local/search/keyword.json', {
    params: {
      query,
      page,
      size,
      sort: 'accuracy',
    },
    headers: {
      Authorization: `KakaoAK ${restApiKey}`,
    },
    timeout: 10000,
  });

  return data;
}

async function findExistingBusiness(name: string, address: string, placeUrl: string) {
  const candidates = await prisma.businessProfile.findMany({
    where: {
      OR: [
        ...(placeUrl ? [{ websiteUrl: placeUrl }] : []),
        {
          businessName: name,
          ...(address ? { address } : {}),
        },
      ],
    },
    select: { id: true, userId: true },
    take: 1,
  });

  return candidates[0] || null;
}

async function upsertBusinessFromKakao(
  categoryName: (typeof CATEGORIES)[number],
  categoryId: string,
  item: KakaoPlace,
) {
  const name = clean(item.place_name);
  if (!name) return null;

  const address = clean(item.road_address_name || item.address_name);
  const placeUrl = clean(item.place_url);
  const phone = clean(item.phone);
  const lat = clean(item.y);
  const lng = clean(item.x);
  const tags = deriveBusinessTags({
    businessName: name,
    businessType: categoryName,
    address,
    categoryNames: [categoryName],
  });
  const kakaoCategory = clean(item.category_name);
  const descriptionHtml = withBusinessTagMarker(
    [
      `<p>${name}은(는) 카카오맵 지역검색 기준으로 등록된 ${categoryName} 파트너입니다.</p>`,
      address ? `<p><strong>주소</strong> ${address}</p>` : '',
      kakaoCategory ? `<p><strong>카카오 카테고리</strong> ${kakaoCategory}</p>` : '',
    ].filter(Boolean).join(''),
    tags,
  );

  const existing = await findExistingBusiness(name, address, placeUrl);
  const sourceKey = hashKey(`kakao:${categoryName}:${item.id || name}:${address || placeUrl}`);
  const email = `kakao-${sourceKey.slice(0, 16)}@freetiful.local`;

  const user = existing
    ? { id: existing.userId }
    : await prisma.user.upsert({
      where: { email },
      create: {
        role: UserRole.business,
        name,
        email,
        emailVerified: true,
        referralCode: `KK${sourceKey.slice(0, 8).toUpperCase()}`,
        notificationSettings: { create: {} },
      },
      update: {
        role: UserRole.business,
        name,
        isActive: true,
      },
      select: { id: true },
    });

  const profile = existing
    ? await prisma.businessProfile.update({
      where: { id: existing.id },
      data: {
        status: BusinessStatus.approved,
        businessName: name,
        businessType: categoryName,
        address,
        phone: phone || null,
        lat: lat || undefined,
        lng: lng || undefined,
        websiteUrl: placeUrl || null,
        descriptionHtml,
        approvedAt: new Date(),
      },
      select: { id: true },
    })
    : await prisma.businessProfile.create({
      data: {
        userId: user.id,
        status: BusinessStatus.approved,
        businessName: name,
        businessType: categoryName,
        address,
        phone: phone || null,
        lat: lat || undefined,
        lng: lng || undefined,
        websiteUrl: placeUrl || null,
        descriptionHtml,
        approvedAt: new Date(),
      },
      select: { id: true },
    });

  await prisma.businessCategory.upsert({
    where: {
      businessProfileId_categoryId: {
        businessProfileId: profile.id,
        categoryId,
      },
    },
    create: {
      businessProfileId: profile.id,
      categoryId,
    },
    update: {},
  });

  return { id: profile.id, name };
}

async function seedCategory(category: (typeof CATEGORIES)[number], categoryId: string, targetCount: number, regions: string[]) {
  const seen = new Set<string>();
  let saved = 0;

  for (const region of regions) {
    if (saved >= targetCount) break;
    const query = `${region} ${QUERY_BY_CATEGORY[category]}`;

    for (let page = 1; page <= 3; page += 1) {
      if (saved >= targetCount) break;
      const data = await fetchKakaoPlaces(query, page);
      const items = data.documents || [];
      if (items.length === 0) break;

      for (const item of items) {
        if (saved >= targetCount) break;
        const key = `${clean(item.place_name)}:${clean(item.road_address_name || item.address_name)}`;
        if (!key.trim() || seen.has(key)) continue;
        seen.add(key);

        const result = await upsertBusinessFromKakao(category, categoryId, item);
        if (result) saved += 1;
      }

      if (data.meta?.is_end) break;
      await sleep(120);
    }

    await sleep(180);
  }

  return saved;
}

async function main() {
  const perCategory = Number(process.env.KAKAO_BUSINESS_DISPLAY || 12);
  const regions = splitList(process.env.KAKAO_BUSINESS_REGIONS, ['서울', '경기', '인천', '부산', '대구', '대전', '광주']);
  let total = 0;

  for (let index = 0; index < CATEGORIES.length; index += 1) {
    const category = CATEGORIES[index];
    const categoryRecord = await getOrCreateBusinessCategory(category, index + 1);
    const saved = await seedCategory(category, categoryRecord.id, perCategory, regions);
    total += saved;
    console.log(`${category}: ${saved}개 저장`);
    await sleep(250);
  }

  console.log(`카카오맵 웨딩 파트너 총 ${total}개 저장 완료`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
