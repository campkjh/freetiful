#!/usr/bin/env node
/**
 * 카카오 레거시 합성 이메일 계정 → native 계정 일괄 병합 스크립트
 *
 * Railway 가 최신 코드 배포가 안 되어 어드민 API 사용 못 할 때
 * 운영 DB 에 직접 연결해 처리하는 우회 도구.
 *
 * 사용법:
 *   1) DATABASE_URL 환경변수 세팅 (Railway Dashboard → Variables 에서 복사)
 *      예:  export DATABASE_URL="postgres://..."
 *   2) 실행:
 *      node scripts/merge-legacy-kakao.mjs              ← dry-run (변경 없음, 어떤 계정 합쳐질지 미리 확인)
 *      node scripts/merge-legacy-kakao.mjs --execute    ← 실제 실행
 *
 * 동작:
 *   - email 이 kakao_{id}@kakao.freetiful.com 인 모든 유저 검색
 *   - 같은 카카오 providerUserId 의 native 계정(AuthProviderRecord) 매칭
 *   - 매칭되는 페어에 대해 ChatRoom/Member/Message/Payment/Quotation/Favorite/Review/
 *     Notification/MatchRequest/PointTransaction/UserCoupon/AuthProviderRecord 를
 *     native 계정으로 이관, 레거시 유저는 archive (이메일 무효화 + isActive=false)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const EXECUTE = process.argv.includes('--execute');

const log = (msg) => console.log(msg);
const ok  = (msg) => console.log('\x1b[32m✓\x1b[0m', msg);
const warn = (msg) => console.log('\x1b[33m!\x1b[0m', msg);
const err = (msg) => console.log('\x1b[31m✗\x1b[0m', msg);

async function findPairs() {
  const legacyUsers = await prisma.user.findMany({
    where: { email: { startsWith: 'kakao_', endsWith: '@kakao.freetiful.com' } },
    select: { id: true, email: true, name: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const pairs = [];
  for (const legacy of legacyUsers) {
    const m = legacy.email?.match(/^kakao_(.+)@kakao\.freetiful\.com$/);
    const providerUserId = m?.[1] || '';
    let native = null;
    if (providerUserId) {
      const record = await prisma.authProviderRecord.findFirst({
        where: { provider: 'kakao', providerUserId },
        select: { user: { select: { id: true, email: true, name: true } } },
      });
      if (record?.user && record.user.id !== legacy.id) {
        native = record.user;
      }
    }
    pairs.push({ legacy, native, providerUserId });
  }
  return pairs;
}

async function mergePair(fromId, toId) {
  if (fromId === toId) return { rooms: 0, messages: 0 };
  // ChatRoom.userId
  const rooms = await prisma.chatRoom.updateMany({ where: { userId: fromId }, data: { userId: toId } });

  // ChatRoomMember 중복 처리
  const dup = await prisma.chatRoomMember.findMany({ where: { userId: fromId }, select: { roomId: true } });
  if (dup.length > 0) {
    const ids = dup.map((d) => d.roomId);
    const existing = await prisma.chatRoomMember.findMany({
      where: { userId: toId, roomId: { in: ids } },
      select: { roomId: true },
    });
    const have = new Set(existing.map((e) => e.roomId));
    if (have.size > 0) {
      await prisma.chatRoomMember.deleteMany({
        where: { userId: fromId, roomId: { in: Array.from(have) } },
      });
    }
    await prisma.chatRoomMember.updateMany({ where: { userId: fromId }, data: { userId: toId } });
  }

  const messages = await prisma.message.updateMany({ where: { senderId: fromId }, data: { senderId: toId } });

  // 기타 user 참조
  await prisma.payment.updateMany({ where: { userId: fromId }, data: { userId: toId } }).catch(() => {});
  await prisma.quotation.updateMany({ where: { userId: fromId }, data: { userId: toId } }).catch(() => {});
  await prisma.favorite.updateMany({ where: { userId: fromId }, data: { userId: toId } }).catch(() => {});
  await prisma.review.updateMany({ where: { reviewerId: fromId }, data: { reviewerId: toId } }).catch(() => {});
  await prisma.notification.updateMany({ where: { userId: fromId }, data: { userId: toId } }).catch(() => {});
  await prisma.matchRequest.updateMany({ where: { userId: fromId }, data: { userId: toId } }).catch(() => {});
  await prisma.pointTransaction.updateMany({ where: { userId: fromId }, data: { userId: toId } }).catch(() => {});
  await prisma.userCoupon.updateMany({ where: { userId: fromId }, data: { userId: toId } }).catch(() => {});
  await prisma.authProviderRecord.updateMany({ where: { userId: fromId }, data: { userId: toId } }).catch(() => {});
  await prisma.session.deleteMany({ where: { userId: fromId } }).catch(() => {});

  // 레거시 유저 archive
  const legacy = await prisma.user.findUnique({ where: { id: fromId }, select: { email: true } });
  if (legacy?.email) {
    await prisma.user.update({
      where: { id: fromId },
      data: {
        email: `merged-${Date.now()}-${legacy.email}`.slice(0, 200),
        isActive: false,
        name: `[merged] ${legacy.email.slice(0, 50)}`,
      },
    });
  }

  return { rooms: rooms.count, messages: messages.count };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    err('DATABASE_URL 환경변수가 필요합니다.');
    log('Railway Dashboard → freetiful-api → Variables → DATABASE_URL 복사 후');
    log('  export DATABASE_URL="postgres://..."');
    log('  node scripts/merge-legacy-kakao.mjs');
    process.exit(1);
  }

  log(`\n=== 카카오 레거시 계정 통합 스크립트 ===`);
  log(`모드: ${EXECUTE ? '\x1b[31m실제 실행 (변경 발생)\x1b[0m' : '\x1b[33mDRY-RUN (변경 없음)\x1b[0m'}`);
  log('');

  const pairs = await findPairs();
  const matched = pairs.filter((p) => p.native);
  const orphan = pairs.filter((p) => !p.native);

  log(`총 합성 이메일 유저: \x1b[1m${pairs.length}\x1b[0m`);
  log(`매칭되는 native 계정 있음: \x1b[1m${matched.length}\x1b[0m  ← 합병 대상`);
  log(`매칭 없음 (유령): \x1b[1m${orphan.length}\x1b[0m  ← 건너뜀`);
  log('');

  if (matched.length === 0) {
    ok('합병할 페어가 없습니다.');
    return;
  }

  log('--- 합병 대상 ---');
  for (const p of matched) {
    log(`  ${p.legacy.email}  →  ${p.native.email} (${p.native.name || '이름없음'})`);
  }
  log('');

  if (!EXECUTE) {
    warn('DRY-RUN 모드입니다. 실제 변경은 없습니다.');
    log('실행하려면: \x1b[1mnode scripts/merge-legacy-kakao.mjs --execute\x1b[0m');
    return;
  }

  log('합병 시작...\n');
  let success = 0;
  let failed = 0;
  for (const p of matched) {
    try {
      const r = await mergePair(p.legacy.id, p.native.id);
      ok(`${p.legacy.email} → ${p.native.email}  rooms=${r.rooms} msgs=${r.messages}`);
      success++;
    } catch (e) {
      err(`${p.legacy.email} 실패: ${e.message}`);
      failed++;
    }
  }
  log('');
  ok(`완료: 성공 ${success}건, 실패 ${failed}건`);
}

main()
  .catch((e) => { err(e.message || String(e)); process.exit(1); })
  .finally(() => prisma.$disconnect());
