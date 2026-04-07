import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ─── Categories (Pro) ─────────────────────────────────────────────────────
  await Promise.all([
    prisma.category.upsert({
      where: { id: 'cat-mc' },
      update: {},
      create: { id: 'cat-mc', type: 'pro', name: 'MC', nameEn: 'MC', displayOrder: 1 },
    }),
    prisma.category.upsert({
      where: { id: 'cat-host' },
      update: {},
      create: { id: 'cat-host', type: 'pro', name: '쇼호스트', nameEn: 'Show Host', displayOrder: 2 },
    }),
    prisma.category.upsert({
      where: { id: 'cat-singer' },
      update: {},
      create: { id: 'cat-singer', type: 'pro', name: '가수', nameEn: 'Singer', displayOrder: 3 },
    }),
  ]);

  // ─── Event Categories ─────────────────────────────────────────────────────
  await Promise.all([
    prisma.eventCategory.upsert({
      where: { id: 'ec-wedding' },
      update: {},
      create: { id: 'ec-wedding', categoryId: 'cat-mc', name: '결혼식', displayOrder: 1 },
    }),
    prisma.eventCategory.upsert({
      where: { id: 'ec-birthday' },
      update: {},
      create: { id: 'ec-birthday', categoryId: 'cat-mc', name: '생신잔치 (환갑/칠순)', displayOrder: 2 },
    }),
    prisma.eventCategory.upsert({
      where: { id: 'ec-dol' },
      update: {},
      create: { id: 'ec-dol', categoryId: 'cat-mc', name: '돌잔치', displayOrder: 3 },
    }),
    prisma.eventCategory.upsert({
      where: { id: 'ec-class' },
      update: {},
      create: { id: 'ec-class', categoryId: 'cat-mc', name: '강의/클래스', displayOrder: 4 },
    }),
  ]);

  // ─── Regions ──────────────────────────────────────────────────────────────
  await Promise.all([
    prisma.region.upsert({ where: { id: 'reg-nationwide' }, update: {}, create: { id: 'reg-nationwide', name: '전국', nameEn: 'Nationwide', isNationwide: true, displayOrder: 0 } }),
    prisma.region.upsert({ where: { id: 'reg-seoul' }, update: {}, create: { id: 'reg-seoul', name: '서울/경기', nameEn: 'Seoul Metro', displayOrder: 1 } }),
    prisma.region.upsert({ where: { id: 'reg-gangwon' }, update: {}, create: { id: 'reg-gangwon', name: '강원', nameEn: 'Gangwon', displayOrder: 2 } }),
    prisma.region.upsert({ where: { id: 'reg-chungcheong' }, update: {}, create: { id: 'reg-chungcheong', name: '충청', nameEn: 'Chungcheong', displayOrder: 3 } }),
    prisma.region.upsert({ where: { id: 'reg-jeolla' }, update: {}, create: { id: 'reg-jeolla', name: '전라', nameEn: 'Jeolla', displayOrder: 4 } }),
    prisma.region.upsert({ where: { id: 'reg-gyeongsang' }, update: {}, create: { id: 'reg-gyeongsang', name: '경상', nameEn: 'Gyeongsang', displayOrder: 5 } }),
    prisma.region.upsert({ where: { id: 'reg-jeju' }, update: {}, create: { id: 'reg-jeju', name: '제주', nameEn: 'Jeju', displayOrder: 6 } }),
  ]);

  // ─── Style Options ────────────────────────────────────────────────────────
  const styles = ['격식있는', '유머있는', '감동적인', '경쾌한', '차분한', '프로페셔널한'];
  await Promise.all(
    styles.map((name, i) =>
      prisma.styleOption.upsert({
        where: { id: `style-${i}` },
        update: {},
        create: { id: `style-${i}`, categoryId: 'cat-mc', name, displayOrder: i + 1 },
      }),
    ),
  );

  // ─── Personality Options ──────────────────────────────────────────────────
  const personalities = ['친근한', '활발한', '신중한', '창의적인', '배려심있는', '카리스마있는'];
  await Promise.all(
    personalities.map((name, i) =>
      prisma.personalityOption.upsert({
        where: { id: `pers-${i}` },
        update: {},
        create: { id: `pers-${i}`, name, displayOrder: i + 1 },
      }),
    ),
  );

  // ─── Business Categories ──────────────────────────────────────────────────
  const bizCategories = [
    { id: 'biz-hall', name: '웨딩홀' },
    { id: 'biz-derm', name: '피부과' },
    { id: 'biz-studio', name: '스튜디오' },
    { id: 'biz-dress', name: '드레스' },
    { id: 'biz-makeup', name: '메이크업/헤어' },
    { id: 'biz-snap', name: '스냅/영상' },
    { id: 'biz-perf', name: '공연' },
  ];
  await Promise.all(
    bizCategories.map(({ id, name }, i) =>
      prisma.category.upsert({
        where: { id },
        update: {},
        create: { id, type: 'business', name, displayOrder: i + 1 },
      }),
    ),
  );

  // ─── Admin User ───────────────────────────────────────────────────────────
  const bcrypt = await import('bcrypt');
  const passwordHash = await bcrypt.hash('admin1234!', 12);

  await prisma.user.upsert({
    where: { email: 'admin@prettyful.co.kr' },
    update: {},
    create: {
      email: 'admin@prettyful.co.kr',
      name: '관리자',
      role: 'admin',
      referralCode: 'ADMIN001',
      authProviders: {
        create: {
          provider: 'email',
          providerUserId: 'admin@prettyful.co.kr',
          accessToken: passwordHash,
        },
      },
      notificationSettings: { create: {} },
    },
  });

  console.log('Seed complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
