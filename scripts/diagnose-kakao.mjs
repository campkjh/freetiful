import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const legacyId = '4230630516';
const nativeEmail = 'campkjh@nate.com';

const records = await prisma.authProviderRecord.findMany({
  where: { provider: 'kakao', providerUserId: legacyId },
  include: { user: { select: { id: true, email: true, name: true, isActive: true } } },
});
console.log('AuthProviderRecord (kakao, ' + legacyId + '):');
console.log(JSON.stringify(records, null, 2));

console.log('\nUser by email containing kakao_' + legacyId + ':');
const u1 = await prisma.user.findMany({
  where: { email: { contains: 'kakao_' + legacyId } },
  select: { id: true, email: true, name: true, isActive: true },
});
console.log(JSON.stringify(u1, null, 2));

console.log('\nUser ' + nativeEmail + ':');
const u2 = await prisma.user.findFirst({
  where: { email: nativeEmail },
  select: { id: true, email: true, name: true, isActive: true },
});
console.log(JSON.stringify(u2, null, 2));

await prisma.$disconnect();
