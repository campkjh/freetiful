import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const legacyUserId = '6a62b32c-748f-491d-9e8c-b647dae7eb8a';
const nativeUserId = 'a7c23078-a2cd-4643-87c0-c9292321bc3b';

console.log('=== USER A (legacy archived) ===');
const a = await prisma.user.findUnique({ where: { id: legacyUserId } });
console.log(JSON.stringify(a, null, 2));

console.log('\n=== USER B (native campkjh) ===');
const b = await prisma.user.findUnique({ where: { id: nativeUserId } });
console.log(JSON.stringify(b, null, 2));

console.log('\n=== B\'s relations ===');
const counts = {
  authProviders: await prisma.authProviderRecord.count({ where: { userId: nativeUserId } }),
  sessions: await prisma.session.count({ where: { userId: nativeUserId } }),
  chatRooms: await prisma.chatRoom.count({ where: { userId: nativeUserId } }),
  chatRoomMembers: await prisma.chatRoomMember.count({ where: { userId: nativeUserId } }),
  messages: await prisma.message.count({ where: { senderId: nativeUserId } }),
  notificationSettings: await prisma.notificationSettings.count({ where: { userId: nativeUserId } }),
  refundAccount: await prisma.refundAccount.count({ where: { userId: nativeUserId } }).catch(() => 'n/a'),
};
console.log(JSON.stringify(counts, null, 2));

console.log('\n=== A\'s remaining relations ===');
const aCounts = {
  authProviders: await prisma.authProviderRecord.count({ where: { userId: legacyUserId } }),
  sessions: await prisma.session.count({ where: { userId: legacyUserId } }),
  chatRooms: await prisma.chatRoom.count({ where: { userId: legacyUserId } }),
  chatRoomMembers: await prisma.chatRoomMember.count({ where: { userId: legacyUserId } }),
  messages: await prisma.message.count({ where: { senderId: legacyUserId } }),
  notificationSettings: await prisma.notificationSettings.count({ where: { userId: legacyUserId } }),
};
console.log(JSON.stringify(aCounts, null, 2));

await prisma.$disconnect();
