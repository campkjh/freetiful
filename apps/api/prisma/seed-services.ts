import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PLANS = [
  {
    title: 'Premium',
    description: '결혼식·돌잔치 등 1시간 이내 행사 진행\n사전 미팅 1회 포함\n행사 당일 30분 전 현장 도착',
    basePrice: 450000,
    displayOrder: 0,
  },
  {
    title: 'Superior',
    description: '기업행사·컨퍼런스 등 2시간 이내 행사 진행\n사전 미팅 2회 포함\n대본 작성 및 리허설 참석\n포토타임 진행\n영상 큐시트 관리',
    basePrice: 800000,
    displayOrder: 1,
  },
  {
    title: 'Enterprise',
    description: '대규모 행사 6시간 풀타임 진행\n사전 미팅 무제한\n대본 작성 및 리허설 참석\n축사·건배사 코디네이션\n포토타임 진행\n하객 응대 안내\n2차 진행 포함\n영상 큐시트 관리\n전담 코디네이터 배정',
    basePrice: 1700000,
    displayOrder: 2,
  },
];

async function main() {
  const pros = await prisma.proProfile.findMany({
    where: { status: 'approved' },
    include: { services: true },
  });

  console.log(`Found ${pros.length} approved pros`);

  for (const pro of pros) {
    // 기존 서비스가 1개 이하인 경우만 처리
    if (pro.services.length >= 3) {
      console.log(`${pro.id} already has ${pro.services.length} services, skipping`);
      continue;
    }

    // 기존 서비스 삭제
    await prisma.proService.deleteMany({ where: { proProfileId: pro.id } });

    // 3개 플랜 생성
    for (const plan of PLANS) {
      await prisma.proService.create({
        data: {
          proProfileId: pro.id,
          title: plan.title,
          description: plan.description,
          basePrice: plan.basePrice,
          priceUnit: 'per_event',
          displayOrder: plan.displayOrder,
          isActive: true,
        },
      });
    }

    console.log(`✓ ${pro.id} - 3 plans created`);
  }

  console.log('Done!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
