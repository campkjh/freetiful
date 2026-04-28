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

const QUERY_BY_CATEGORY: Record<(typeof CATEGORIES)[number], string> = {
  웨딩홀: '서울 웨딩홀',
  드레스: '서울 웨딩드레스',
  피부과: '서울 웨딩 피부과',
  스튜디오: '서울 웨딩스튜디오',
  헤어: '서울 웨딩 헤어샵',
  메이크업: '서울 웨딩 메이크업',
  가전: '서울 혼수가전',
  스냅: '서울 웨딩스냅',
  한복: '서울 혼주 한복',
  성형외과: '서울 성형외과',
  보석: '서울 예물 주얼리',
  답례품: '서울 결혼 답례품',
  자동차: '서울 웨딩카',
  신혼여행: '서울 허니문 여행사',
  가구: '서울 신혼가구',
};

type NaverLocalItem = {
  title?: string;
  link?: string;
  category?: string;
  description?: string;
  telephone?: string;
  address?: string;
  roadAddress?: string;
};

function requireEnv(name: string, fallbackName?: string) {
  const value = process.env[name] || (fallbackName ? process.env[fallbackName] : '');
  if (!value) {
    throw new Error(`${name}${fallbackName ? ` or ${fallbackName}` : ''} is required`);
  }
  return value;
}

function stripNaverHtml(value = '') {
  return value
    .replace(/<\/?b>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function hashKey(value: string) {
  return createHash('sha1').update(value).digest('hex');
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

async function fetchLocalItems(category: (typeof CATEGORIES)[number], display = 5) {
  const clientId = requireEnv('NAVER_SEARCH_CLIENT_ID', 'NAVER_CLIENT_ID');
  const clientSecret = requireEnv('NAVER_SEARCH_CLIENT_SECRET', 'NAVER_CLIENT_SECRET');
  const { data } = await axios.get<{ items?: NaverLocalItem[] }>('https://openapi.naver.com/v1/search/local.json', {
    params: {
      query: QUERY_BY_CATEGORY[category],
      display,
      start: 1,
      sort: 'random',
    },
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
    },
    timeout: 10000,
  });
  return data.items || [];
}

async function upsertBusinessFromNaver(categoryName: (typeof CATEGORIES)[number], categoryId: string, item: NaverLocalItem) {
  const name = stripNaverHtml(item.title);
  if (!name) return null;

  const address = stripNaverHtml(item.roadAddress || item.address || '');
  const link = stripNaverHtml(item.link || '');
  const phone = stripNaverHtml(item.telephone || '');
  const sourceKey = hashKey(`${categoryName}:${name}:${address || link}`);
  const email = `naver-${sourceKey.slice(0, 16)}@freetiful.local`;

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      role: UserRole.business,
      name,
      email,
      emailVerified: true,
      referralCode: `NV${sourceKey.slice(0, 8).toUpperCase()}`,
      notificationSettings: { create: {} },
    },
    update: {
      role: UserRole.business,
      name,
      isActive: true,
    },
    select: { id: true },
  });

  const profile = await prisma.businessProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      status: BusinessStatus.approved,
      businessName: name,
      businessType: categoryName,
      address,
      phone: phone || null,
      websiteUrl: link || null,
      descriptionHtml: `<p>${name}은(는) 네이버 지역검색 기준으로 등록된 ${categoryName} 파트너입니다.</p>${address ? `<p><strong>주소</strong> ${address}</p>` : ''}`,
      approvedAt: new Date(),
    },
    update: {
      status: BusinessStatus.approved,
      businessName: name,
      businessType: categoryName,
      address,
      phone: phone || null,
      websiteUrl: link || null,
      descriptionHtml: `<p>${name}은(는) 네이버 지역검색 기준으로 등록된 ${categoryName} 파트너입니다.</p>${address ? `<p><strong>주소</strong> ${address}</p>` : ''}`,
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

async function main() {
  const perCategory = Number(process.env.NAVER_BUSINESS_DISPLAY || 5);
  let total = 0;

  for (const [index, category] of CATEGORIES.entries()) {
    const categoryRecord = await getOrCreateBusinessCategory(category, index + 1);
    const items = await fetchLocalItems(category, perCategory);
    let saved = 0;
    for (const item of items) {
      const result = await upsertBusinessFromNaver(category, categoryRecord.id, item);
      if (result) saved += 1;
    }
    total += saved;
    console.log(`${category}: ${saved}개 저장`);
    await sleep(120);
  }

  console.log(`네이버 웨딩 파트너 총 ${total}개 저장 완료`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
