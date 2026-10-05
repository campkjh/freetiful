import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 홈 '전환 퍼널'(261005 사장) — 홈 방문 → 퀵매칭 페이지 → 견적 요청 → 사회자와 대화 → 견적 받음 → 결제 완료.
 *  · 방문 두 단계는 landing_visits(page='home'|'quick-match', 기기 세션당 1번, 첫 방문 시각) — 261005 부터 기록.
 *  · 견적 요청부터는 그 기간에 견적을 요청한 사람들을 따라간다(사람 기준, 여러 번 해도 1명) — 그중 대화한 사람 →
 *    그중 견적 받은 사람 → 그중 결제한 사람. 단계마다 앞 단계의 일부라 '얼마나 줄어드는지'가 맞게 나온다.
 *    대화 = 고객과 사회자가 둘 다 보낸 채팅방(시스템 메시지 제외), 견적·결제는 관리자 리뷰 직접 등록의 더미 결제를 뺀다.
 *  · 방문(세션)과 회원을 한 사람으로 이어 붙이지는 못한다 — 기간 집계 퍼널.
 */
@Injectable()
export class AdminFunnelService {
  constructor(private prisma: PrismaService) {}

  async funnel(rawDays?: number) {
    const days = [7, 30, 90].includes(Number(rawDays)) ? Number(rawDays) : 30;
    const from = new Date(Date.now() - days * 86400000);
    const [visits, since, cohort, payersAll] = await Promise.all([
      this.prisma.$queryRaw<{ page: string; n: number }[]>`
        SELECT page, count(DISTINCT "sessionKey")::int AS n
        FROM landing_visits WHERE page IN ('home', 'quick-match') AND "createdAt" >= ${from}
        GROUP BY page`,
      this.prisma.$queryRaw<{ page: string; first: Date }[]>`
        SELECT page, min("createdAt") AS first FROM landing_visits WHERE page IN ('home', 'quick-match') GROUP BY page`,
      // 견적 요청한 사람들을 따라간다 — 그중 대화한 사람, 그중 견적 받은 사람, 그중 결제한 사람(단계마다 앞 단계의 일부)
      this.prisma.$queryRaw<{ r: number; r_n: number; t: number; t_n: number; q: number; q_n: number; p: number; p_n: number; p_amt: bigint }[]>`
        WITH req AS (
          SELECT "userId" AS uid, count(*) AS n FROM match_requests WHERE "createdAt" >= ${from} GROUP BY "userId"
        ),
        talk_rooms AS (
          SELECT cr.id, cr."userId" AS uid
          FROM chat_rooms cr JOIN pro_profiles pp ON pp.id = cr."proProfileId"
          WHERE cr."createdAt" >= ${from} AND cr."userId" IN (SELECT uid FROM req)
            AND EXISTS (SELECT 1 FROM messages m WHERE m."roomId" = cr.id AND m."senderId" = cr."userId" AND m."deletedAt" IS NULL AND m.type::text <> 'system')
            AND EXISTS (SELECT 1 FROM messages m WHERE m."roomId" = cr.id AND m."senderId" = pp."userId" AND m."deletedAt" IS NULL AND m.type::text <> 'system')
        ),
        quotes AS (
          SELECT q.id, q."userId" AS uid FROM quotations q
          WHERE q."createdAt" >= ${from} AND q."userId" IN (SELECT DISTINCT uid FROM talk_rooms)
            AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.id = q."paymentId" AND p.method = 'admin_review')
        ),
        paid AS (
          SELECT p.id, p."userId" AS uid, p.amount FROM payments p
          WHERE p."createdAt" >= ${from} AND p."userId" IN (SELECT DISTINCT uid FROM quotes)
            AND p.status::text IN ('completed', 'escrowed', 'settled') AND p.method IS DISTINCT FROM 'admin_review'
        )
        SELECT
          (SELECT count(*) FROM req)::int AS r, (SELECT COALESCE(sum(n), 0) FROM req)::int AS r_n,
          (SELECT count(DISTINCT uid) FROM talk_rooms)::int AS t, (SELECT count(*) FROM talk_rooms)::int AS t_n,
          (SELECT count(DISTINCT uid) FROM quotes)::int AS q, (SELECT count(*) FROM quotes)::int AS q_n,
          (SELECT count(DISTINCT uid) FROM paid)::int AS p, (SELECT count(*) FROM paid)::int AS p_n,
          (SELECT COALESCE(sum(amount), 0) FROM paid)::bigint AS p_amt`,
      // 같은 기간 결제한 사람 전체(견적 요청 없이 바로 문의해 결제한 사람 포함) — 퍼널 밖 결제 안내용
      this.prisma.$queryRaw<{ n: number }[]>`
        SELECT count(DISTINCT "userId")::int AS n FROM payments
        WHERE "createdAt" >= ${from} AND status::text IN ('completed', 'escrowed', 'settled') AND method IS DISTINCT FROM 'admin_review'`,
    ]);
    const c = cohort[0] || ({} as any);
    const v = new Map(visits.map((r) => [r.page, r.n]));
    const s = new Map(since.map((r) => [r.page, r.first]));
    return {
      days,
      from,
      steps: [
        { key: 'home', label: '홈 방문', unit: '명', basis: 'session', value: v.get('home') || 0, sub: '기기(세션) 기준' },
        { key: 'quickMatch', label: '퀵매칭 페이지', unit: '명', basis: 'session', value: v.get('quick-match') || 0, sub: '기기(세션) 기준' },
        { key: 'request', label: '견적 요청', unit: '명', basis: 'user', value: c.r || 0, sub: `요청 ${c.r_n || 0}건` },
        { key: 'talk', label: '사회자와 대화', unit: '명', basis: 'user', value: c.t || 0, sub: `대화한 채팅방 ${c.t_n || 0}개` },
        { key: 'quote', label: '견적 받음', unit: '명', basis: 'user', value: c.q || 0, sub: `견적 ${c.q_n || 0}건` },
        { key: 'paid', label: '결제 완료', unit: '명', basis: 'user', value: c.p || 0, sub: `결제 ${c.p_n || 0}건 · ${Number(c.p_amt || 0).toLocaleString('ko-KR')}원` },
      ],
      /** 같은 기간 결제했지만 견적 요청부터 거치지 않은 사람(바로 문의 등) */
      paidOutsideFunnel: Math.max(0, (payersAll[0]?.n || 0) - (c.p || 0)),
      /** 방문 기록 시작일(이보다 앞 기간은 방문 단계가 비어 있다) */
      trackingSince: { home: s.get('home') || null, quickMatch: s.get('quick-match') || null },
    };
  }
}
