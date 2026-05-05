import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

console.log('=== All proProfiles for campkjh ===');
const all = await prisma.proProfile.findMany({
  where: { userId: 'a7c23078-a2cd-4643-87c0-c9292321bc3b' },
  select: { id: true, status: true, isProfileHidden: true, createdAt: true, user: { select: { name: true, email: true } } },
});
console.log(JSON.stringify(all, null, 2));

console.log('\n=== ProProfiles named 김정훈 ===');
const byName = await prisma.proProfile.findMany({
  where: { user: { name: { contains: '김정훈' } } },
  select: { id: true, userId: true, status: true, isProfileHidden: true, user: { select: { name: true, email: true } } },
});
console.log(JSON.stringify(byName, null, 2));

await prisma.$disconnect();
