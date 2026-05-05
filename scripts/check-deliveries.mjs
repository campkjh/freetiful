import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

console.log('=== Recent MatchRequests ===');
const reqs = await prisma.matchRequest.findMany({
  orderBy: { createdAt: 'desc' },
  take: 5,
  select: { id: true, userId: true, type: true, categoryId: true, createdAt: true, _count: { select: { deliveries: true } } },
});
console.log(JSON.stringify(reqs, null, 2));

console.log('\n=== campkjh proProfile ===');
const pro = await prisma.proProfile.findUnique({
  where: { userId: 'a7c23078-a2cd-4643-87c0-c9292321bc3b' },
  select: { id: true, status: true, isProfileHidden: true, categories: { select: { categoryId: true, category: { select: { name: true } } } } },
});
console.log(JSON.stringify(pro, null, 2));

if (pro) {
  console.log('\n=== Deliveries to campkjh proProfile ===');
  const deliveries = await prisma.matchDelivery.findMany({
    where: { proProfileId: pro.id },
    orderBy: { deliveredAt: 'desc' },
    take: 10,
    include: { matchRequest: { select: { categoryId: true, category: { select: { name: true } } } } },
  });
  console.log(`총 ${deliveries.length}건`);
  for (const d of deliveries) {
    console.log(`  ${d.id.slice(0,8)} status=${d.status} cat=${d.matchRequest.category?.name} delivered=${d.deliveredAt.toISOString().slice(0,19)}`);
  }
}

await prisma.$disconnect();
