import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

console.log('=== campkjh user state ===');
const u = await prisma.user.findUnique({
  where: { id: 'a7c23078-a2cd-4643-87c0-c9292321bc3b' },
  select: { id: true, email: true, name: true, isActive: true, role: true, mergedToUserId: true },
});
console.log(JSON.stringify(u, null, 2));

console.log('\n=== legacy A state ===');
const a = await prisma.user.findUnique({
  where: { id: '6a62b32c-748f-491d-9e8c-b647dae7eb8a' },
  select: { id: true, email: true, name: true, isActive: true, role: true, mergedToUserId: true },
});
console.log(JSON.stringify(a, null, 2));

console.log('\n=== B chats summary ===');
const rooms = await prisma.chatRoom.findMany({
  where: {
    OR: [
      { userId: 'a7c23078-a2cd-4643-87c0-c9292321bc3b' },
      { proProfile: { userId: 'a7c23078-a2cd-4643-87c0-c9292321bc3b' } },
      { members: { some: { userId: 'a7c23078-a2cd-4643-87c0-c9292321bc3b' } } },
    ],
  },
  select: {
    id: true,
    userId: true,
    proProfileId: true,
    userDeletedAt: true,
    proDeletedAt: true,
    lastMessageAt: true,
    _count: { select: { messages: true } },
    members: { select: { userId: true } },
  },
  orderBy: { lastMessageAt: 'desc' },
  take: 10,
});
console.log(`총 ${rooms.length}개 룸`);
for (const r of rooms) {
  const isCustomer = r.userId === 'a7c23078-a2cd-4643-87c0-c9292321bc3b';
  console.log(`  ${r.id.slice(0,8)} ${isCustomer ? '고객' : '프로'} msgs=${r._count.messages} members=${r.members.length} userDel=${r.userDeletedAt ? 'Y' : '-'} proDel=${r.proDeletedAt ? 'Y' : '-'}`);
}

console.log('\n=== B sessions ===');
const sessions = await prisma.session.count({ where: { userId: 'a7c23078-a2cd-4643-87c0-c9292321bc3b' } });
console.log(`active session 수: ${sessions}`);

await prisma.$disconnect();
