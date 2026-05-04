import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// 구 /auth/kakao/mobile 쉼이 만든 email auth provider 레코드 정리
// (provider=email, providerUserId 가 kakao_*@kakao.freetiful.com 형식)
const records = await prisma.authProviderRecord.findMany({
  where: {
    provider: 'email',
    providerUserId: { startsWith: 'kakao_', endsWith: '@kakao.freetiful.com' },
  },
});

console.log(`찾은 legacy email auth records: ${records.length}건`);
records.forEach((r) => console.log(`  - userId=${r.userId} providerUserId=${r.providerUserId}`));

if (process.argv.includes('--execute')) {
  const result = await prisma.authProviderRecord.deleteMany({
    where: {
      provider: 'email',
      providerUserId: { startsWith: 'kakao_', endsWith: '@kakao.freetiful.com' },
    },
  });
  console.log(`\n삭제 완료: ${result.count}건`);
} else {
  console.log('\n[DRY-RUN] 실행하려면 --execute 추가');
}

await prisma.$disconnect();
