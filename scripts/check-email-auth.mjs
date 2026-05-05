import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const records = await prisma.authProviderRecord.findMany({
  where: {
    provider: 'email',
    providerUserId: { contains: 'kakao_4230630516' },
  },
});
console.log('Email auth records for kakao_4230630516:');
console.log(JSON.stringify(records, null, 2));

console.log('\n=== campkjh user ===');
const u = await prisma.user.findUnique({
  where: { id: 'a7c23078-a2cd-4643-87c0-c9292321bc3b' },
  select: { id: true, email: true, isActive: true, mergedToUserId: true },
});
console.log(JSON.stringify(u, null, 2));

console.log('\n=== legacy A ===');
const a = await prisma.user.findUnique({
  where: { id: '6a62b32c-748f-491d-9e8c-b647dae7eb8a' },
  select: { id: true, email: true, isActive: true, mergedToUserId: true },
});
console.log(JSON.stringify(a, null, 2));

await prisma.$disconnect();
