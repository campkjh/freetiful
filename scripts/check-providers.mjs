import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const providers = await prisma.authProviderRecord.findMany({
  where: { userId: 'a7c23078-a2cd-4643-87c0-c9292321bc3b' },
});
console.log(JSON.stringify(providers, null, 2));
await prisma.$disconnect();
