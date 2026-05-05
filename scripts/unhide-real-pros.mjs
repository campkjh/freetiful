import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// 실제 유저 (이메일이 @ 포함, archived 가 아님) 의 approved proProfile 중
// isProfileHidden=true 인 것을 false 로 변경
const targets = await prisma.proProfile.findMany({
  where: {
    status: 'approved',
    isProfileHidden: true,
    user: {
      isActive: true,
      email: { contains: '@' },
      NOT: [
        { email: { startsWith: 'merged-' } },
        { email: { endsWith: '@kakao.freetiful.com' } },
        { email: { contains: 'fixture' } },
        { email: { contains: 'seed' } },
      ],
    },
  },
  include: { user: { select: { name: true, email: true } } },
});

console.log(`unhide 대상: ${targets.length}명`);
for (const p of targets) {
  console.log(`  - ${p.user.name} (${p.user.email})`);
}

if (process.argv.includes('--execute')) {
  const result = await prisma.proProfile.updateMany({
    where: { id: { in: targets.map((t) => t.id) } },
    data: { isProfileHidden: false },
  });
  console.log(`\n✓ ${result.count}건 unhide 완료`);
} else {
  console.log('\n[DRY-RUN] 실행하려면 --execute 추가');
}

await prisma.$disconnect();
