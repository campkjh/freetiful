import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const JWT_SECRET = 'freetiful-jwt-secret-2026-super-secure-key-do-not-share';

const legacyId = '6a62b32c-748f-491d-9e8c-b647dae7eb8a';
const nativeId = 'a7c23078-a2cd-4643-87c0-c9292321bc3b';

const token = jwt.sign({ sub: legacyId }, JWT_SECRET, { expiresIn: '1h' });
console.log('Test JWT for legacy user A (5 chars):', token.slice(0, 30) + '...');

// validateUser 로직 시뮬레이션
async function validateUser(userId) {
  const direct = await prisma.user.findUnique({
    where: { id: userId, isActive: true, isBanned: false },
  });
  if (direct) return direct;
  const archived = await prisma.user.findUnique({
    where: { id: userId },
    select: { mergedToUserId: true },
  }).catch(() => null);
  if (archived?.mergedToUserId) {
    return prisma.user.findUnique({
      where: { id: archived.mergedToUserId, isActive: true, isBanned: false },
    });
  }
  return null;
}

console.log('\n=== validateUser(legacyId) ===');
const result = await validateUser(legacyId);
console.log(result ? `email=${result.email} isActive=${result.isActive}` : 'null');

// Test API call
console.log('\n=== Production API call with legacy token ===');
const fetch = (await import('node-fetch')).default;
const res = await fetch('https://freetiful.com/api/v1/users/me', {
  headers: { 'Authorization': `Bearer ${token}` },
});
console.log('Status:', res.status);
const body = await res.text();
console.log('Body:', body.slice(0, 500));

await prisma.$disconnect();
