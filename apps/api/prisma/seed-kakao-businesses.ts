import axios from 'axios';
import { createHash } from 'crypto';
import { BusinessStatus, PrismaClient, UserRole } from '@prisma/client';

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

const QUERY_BY_CATEGORY: Record<(typeof CATEGORIES)[number], string[]> = {
  웨딩홀: ['웨딩홀', '예식장', '호텔 웨딩홀', '컨벤션 웨딩홀'],
  드레스: ['웨딩드레스', '드레스샵', '본식 드레스', '웨딩샵'],
  피부과: ['피부과', '웨딩 피부관리', '신부관리 피부과', '에스테틱'],
  스튜디오: ['웨딩스튜디오', '사진관', '리마인드웨딩 스튜디오', '웨딩 촬영'],
  헤어: ['웨딩 헤어샵', '헤어샵', '미용실', '신부 헤어'],
  메이크업: ['웨딩 메이크업', '메이크업샵', '신부 메이크업', '혼주 메이크업'],
  가전: ['혼수가전', '가전매장', '전자랜드', '하이마트'],
  스냅: ['웨딩스냅', '본식스냅', '스냅사진', '웨딩 사진'],
  한복: ['혼주 한복', '한복대여', '웨딩 한복', '한복'],
  성형외과: ['성형외과', '웨딩 성형외과', '쁘띠성형', '피부성형'],
  보석: ['예물 주얼리', '예물샵', '주얼리', '커플링'],
  답례품: ['결혼 답례품', '답례품', '웨딩 답례품', '기념품'],
  자동차: ['웨딩카', '렌터카', '수입차 렌트', '리무진'],
  신혼여행: ['허니문 여행사', '신혼여행', '여행사', '허니문'],
  가구: ['신혼가구', '가구점', '침대 매장', '소파 매장'],
};

const DEFAULT_REGIONS = [
  '서울',
  '서울 강남구',
  '서울 서초구',
  '서울 송파구',
  '서울 마포구',
  '서울 용산구',
  '서울 영등포구',
  '서울 종로구',
  '서울 중구',
  '경기',
  '경기 성남',
  '경기 수원',
  '경기 고양',
  '경기 용인',
  '경기 부천',
  '경기 안양',
  '경기 화성',
  '경기 남양주',
  '경기 의정부',
  '인천',
  '부산',
  '부산 해운대',
  '부산 서면',
  '대구',
  '대전',
  '광주',
  '울산',
  '세종',
  '강원 춘천',
  '강원 원주',
  '충북 청주',
  '충남 천안',
  '충남 아산',
  '전북 전주',
  '전남 목포',
  '전남 순천',
  '경북 포항',
  '경북 구미',
  '경남 창원',
  '경남 김해',
  '제주',
];

const TAG_MARKER_PREFIX = '<!-- business-tags:';
const TAG_MARKER_SUFFIX = ' -->';

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

type ExistingBusiness = {
  id: string;
  userId: string;
  businessType: string | null;
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

function uniq(items: string[]) {
  return Array.from(new Set(items.map((item) => clean(item)).filter(Boolean))).slice(0, 8);
}

function deriveTags(input: { businessName: string; businessType: string; address?: string }) {
  const tags = ['인기', input.businessType];
  const address = clean(input.address);
  const region = address.split(' ').slice(0, 2).join(' ');
  if (region) tags.push(region);
  if (/강남|서초|송파|청담|압구정/.test(address)) tags.push('강남권');
  if (/호텔|컨벤션|웨딩홀|예식장/.test(input.businessName + input.businessType)) tags.push('웨딩전문');
  if (/피부|성형|에스테틱/.test(input.businessName + input.businessType)) tags.push('뷰티');
  if (/헤어|메이크업|드레스|한복/.test(input.businessName + input.businessType)) tags.push('스타일링');
  return uniq(tags);
}

function withBusinessTagMarker(html: string | undefined | null, tags: string[]) {
  const stripped = String(html || '').replace(/<!-- business-tags:[\\s\\S]*? -->/g, '').trim();
  const marker = `${TAG_MARKER_PREFIX}${JSON.stringify(uniq(tags))}${TAG_MARKER_SUFFIX}`;
  return `${stripped}${stripped ? '\\n' : ''}${marker}`;
}

function numberFromEnv(names: string[], fallback: number, min: number, max: number) {
  const raw = names.map((name) => process.env[name]).find(Boolean);
  const value = Number(raw || fallback);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function categoryFilter() {
  const selected = splitList(process.env.KAKAO_BUSINESS_CATEGORIES, []);
  if (selected.length === 0) return [...CATEGORIES];
  return CATEGORIES.filter((category) => selected.includes(category));
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

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const { data } = await axios.get<KakaoKeywordResponse>('https://dapi.kakao.com/v2/local/search/keyword.json', {
        params: { query, page, size, sort: 'accuracy' },
        headers: { Authorization: `KakaoAK ${restApiKey}` },
        timeout: 10000,
      });

      return data;
    } catch (error) {
      const status = axios.isAxiosError(error) ? error.response?.status : null;
      const retryable = status === 429 || (typeof status === 'number' && status >= 500);
      if (retryable && attempt < 4) {
        await sleep(700 * attempt);
        continue;
      }

      console.warn(
        `카카오 검색 실패 건너뜀: query="${query}", page=${page}, status=${status || 'unknown'}`,
      );
      return { documents: [], meta: { is_end: true } };
    }
  }

  return { documents: [], meta: { is_end: true } };
}

async function findExistingBusiness(name: string, address: string, placeUrl: string): Promise<ExistingBusiness | null> {
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
    select: { id: true, userId: true, businessType: true },
    take: 1,
  });

  return candidates[0] || null;
}

async function countBusinessesInCategory(categoryId: string) {
  return prisma.businessCategory.count({
    where: {
      categoryId,
      businessProfile: { status: BusinessStatus.approved },
    },
  });
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
  const kakaoCategory = clean(item.category_name);
  const tags = deriveTags({ businessName: name, businessType: categoryName, address });
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
  const wasLinked = existing
    ? Boolean(await prisma.businessCategory.findUnique({
      where: {
        businessProfileId_categoryId: {
          businessProfileId: existing.id,
          categoryId,
        },
      },
      select: { businessProfileId: true },
    }))
    : false;

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
        businessType: existing.businessType || categoryName,
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

  return { id: profile.id, name, linkedNewCategory: !wasLinked };
}

async function seedCategory(category: (typeof CATEGORIES)[number], categoryId: string, targetCount: number, regions: string[]) {
  const seen = new Set<string>();
  const pageLimit = numberFromEnv(['KAKAO_BUSINESS_PAGE_LIMIT'], targetCount >= 1000 ? 10 : 3, 1, 45);
  let currentCount = await countBusinessesInCategory(categoryId);
  let processed = 0;
  const queries = QUERY_BY_CATEGORY[category];

  if (currentCount >= targetCount) {
    return { currentCount, processed, skipped: true };
  }

  for (const region of regions) {
    if (currentCount >= targetCount) break;

    for (const keyword of queries) {
      if (currentCount >= targetCount) break;
      const query = `${region} ${keyword}`;

      for (let page = 1; page <= pageLimit; page += 1) {
        if (currentCount >= targetCount) break;
        const data = await fetchKakaoPlaces(query, page);
        const items = data.documents || [];
        if (items.length === 0) break;

        for (const item of items) {
          if (currentCount >= targetCount) break;
          const key = `${clean(item.id)}:${clean(item.place_name)}:${clean(item.road_address_name || item.address_name)}`;
          if (!key.trim() || seen.has(key)) continue;
          seen.add(key);

          const result = await upsertBusinessFromKakao(category, categoryId, item);
          if (!result) continue;

          processed += 1;
          if (result.linkedNewCategory) currentCount += 1;
        }

        if (data.meta?.is_end) break;
        await sleep(80);
      }

      await sleep(120);
    }

    await sleep(160);
  }

  return { currentCount, processed, skipped: false };
}

async function main() {
  const perCategory = numberFromEnv(['KAKAO_BUSINESS_TARGET_PER_CATEGORY', 'KAKAO_BUSINESS_DISPLAY'], 12, 1, 5000);
  const regions = splitList(process.env.KAKAO_BUSINESS_REGIONS, DEFAULT_REGIONS);
  const categories = categoryFilter();
  let total = 0;

  for (const category of categories) {
    const displayOrder = CATEGORIES.indexOf(category) + 1;
    const categoryRecord = await getOrCreateBusinessCategory(category, displayOrder);
    const result = await seedCategory(category, categoryRecord.id, perCategory, regions);
    total += result.processed;
    console.log(
      `${category}: 현재 ${result.currentCount}/${perCategory}개, 이번 실행 ${result.processed}개 처리${
        result.skipped ? ' (목표치 충족)' : ''
      }`,
    );
    await sleep(250);
  }

  console.log(`카카오맵 웨딩 파트너 총 ${total}개 처리 완료`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
