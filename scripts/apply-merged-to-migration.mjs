#!/usr/bin/env node
/**
 * 1) User.mergedToUserId 컬럼 추가 (없으면)
 * 2) 이미 archive 된 레거시 카카오 계정에 mergedToUserId 백필
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

console.log('=== mergedToUserId 컬럼 추가 + 백필 ===');

// 1. 컬럼 추가 (이미 있으면 noop)
try {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "users"
    ADD COLUMN IF NOT EXISTS "mergedToUserId" TEXT
  `);
  console.log('✓ users.mergedToUserId 컬럼 추가 (또는 이미 있음)');
} catch (e) {
  console.error('컬럼 추가 실패:', e.message);
  process.exit(1);
}

// 2. 백필: archive 된(merged-*) 유저 찾아 매칭되는 native 계정으로 mergedToUserId 설정
const archivedUsers = await prisma.user.findMany({
  where: { email: { startsWith: 'merged-' }, mergedToUserId: null },
  select: { id: true, email: true },
});
console.log(`\nmergedToUserId 미설정 archived 유저: ${archivedUsers.length}건`);

let backfilled = 0;
for (const u of archivedUsers) {
  // email 형태: "merged-{timestamp}-kakao_{providerUserId}@kakao.freetiful.com"
  const m = u.email?.match(/kakao_(\d+)@kakao\.freetiful\.com/);
  if (!m) continue;
  const providerUserId = m[1];
  // 같은 providerUserId 의 native 계정 찾기
  const record = await prisma.authProviderRecord.findFirst({
    where: { provider: 'kakao', providerUserId },
    select: { userId: true },
  });
  if (!record || record.userId === u.id) continue;
  await prisma.user.update({
    where: { id: u.id },
    data: { mergedToUserId: record.userId },
  });
  console.log(`  ✓ ${u.email}  →  ${record.userId}`);
  backfilled++;
}
console.log(`\n백필 완료: ${backfilled}건`);

await prisma.$disconnect();
