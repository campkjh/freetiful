import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareAdminSort, matchesAdminSearch, parseAdminPaySort, parseAdminSearch, sortAndPage, type AdminSortKey } from './admin-list';
import { paymentPaidAt } from './refund-policy';

test('search folds spaces/case and matches names, event text, phones (any format) and long ids only', () => {
  const q = parseAdminSearch(' 이 나연 ')!;
  assert.equal(q.text, '이나연');
  assert.equal(q.digits, null);
  const f = (o: Partial<Parameters<typeof matchesAdminSearch>[1]>) => ({ texts: [], phones: [], ids: [], ...o });
  assert.ok(matchesAdminSearch(q, f({ texts: ['이나연'] })));
  assert.ok(matchesAdminSearch(q, f({ texts: ['이 나 연'] })));
  assert.ok(!matchesAdminSearch(q, f({ texts: ['이나'] })));

  const phone = parseAdminSearch('010-1234-5678')!;
  assert.equal(phone.digits, '01012345678');
  assert.ok(matchesAdminSearch(phone, f({ phones: ['01012345678'] })));
  assert.ok(matchesAdminSearch(phone, f({ phones: ['010-1234-5678'] })));
  assert.ok(matchesAdminSearch(parseAdminSearch('5678')!, f({ phones: ['010-1234-5678'] })));
  // 숫자 2자리는 연락처로 안 본다(전부 걸려서)
  assert.equal(parseAdminSearch('56')!.digits, null);
  // 이름+숫자 섞인 검색어는 연락처로 안 본다
  assert.equal(parseAdminSearch('이나연 5678')!.digits, null);

  // 짧은 검색어는 UUID 속 글자에 걸리지 않는다, 6자 이상이면 결제 ID·주문번호로 찾는다
  const id = '3f2a9c10-aaaa-bbbb-cccc-123456789abc';
  assert.ok(!matchesAdminSearch(parseAdminSearch('3f2a')!, f({ ids: [id] })));
  assert.ok(matchesAdminSearch(parseAdminSearch('3F2A9C10')!, f({ ids: [id] })));
  assert.equal(parseAdminSearch('   '), null);
  assert.equal(parseAdminSearch(undefined), null);
});

test('sort: paid desc default, paid asc, event asc/desc with missing event dates always last and stable ties', () => {
  assert.equal(parseAdminPaySort(undefined), 'paid_desc');
  assert.equal(parseAdminPaySort('nope'), 'paid_desc');
  assert.equal(parseAdminPaySort('event_asc'), 'event_asc');
  const k = (id: string, paid: string, ev: string | null): AdminSortKey => ({ id, paidAt: new Date(paid), eventDate: ev });
  const rows = [
    k('a', '2026-10-01T00:00:00Z', '2026-12-01'),
    k('b', '2026-10-03T00:00:00Z', null),
    k('c', '2026-10-02T00:00:00Z', '2026-11-01'),
    k('d', '2026-10-04T00:00:00Z', '2026-11-01'),
  ];
  const ids = (sort: Parameters<typeof compareAdminSort>[0]) => sortAndPage(rows, sort, (r) => r, 1, 10).map((r) => r.id).join('');
  assert.equal(ids('paid_desc'), 'dbca');
  assert.equal(ids('paid_asc'), 'acbd');
  // 같은 예식일(c·d)은 결제일 최신 먼저, 예식일 없는 b 는 맨 뒤
  assert.equal(ids('event_asc'), 'dcab');
  assert.equal(ids('event_desc'), 'adcb');
  // 페이지 나누기
  assert.deepEqual(sortAndPage(rows, 'paid_desc', (r) => r, 2, 3).map((r) => r.id), ['a']);
  assert.deepEqual(sortAndPage(rows, 'paid_desc', (r) => r, 3, 3), []);
});

test('virtual-account paid date ignores later row updates (settle/unsettle/merge) by using the settlement log time', () => {
  const createdAt = new Date('2026-10-01T00:00:00Z');
  const deposit = new Date('2026-10-03T05:00:00Z');
  const settledLater = new Date('2026-10-20T05:00:00Z');
  // 카드 = 만든 시각
  assert.equal(paymentPaidAt({ method: '카드', createdAt, updatedAt: settledLater }).getTime(), createdAt.getTime());
  // 가상계좌, 로그 없음 = 예전처럼 updatedAt
  assert.equal(paymentPaidAt({ method: '가상계좌', createdAt, updatedAt: deposit }).getTime(), deposit.getTime());
  // 가상계좌, 정산하기로 updatedAt 이 밀림 = 로그 시각(입금 확인)
  assert.equal(paymentPaidAt({ method: '가상계좌', createdAt, updatedAt: settledLater, settlementLog: { createdAt: deposit } }).getTime(), deposit.getTime());
  // 로그가 나중에 만들어졌으면(백필 등) 이른 쪽 = updatedAt
  assert.equal(paymentPaidAt({ method: '가상계좌', createdAt, updatedAt: deposit, settlementLog: { createdAt: settledLater } }).getTime(), deposit.getTime());
});

// ── 서비스 연결(가짜 prisma) — 검색·정렬·페이지·요약·결제일이 실제 목록 응답에 맞게 들어가나 ──
import { AdminService } from '../admin/admin.service';
import { SettlementService } from '../settlement/settlement.service';

const D = (s: string) => new Date(s);
const quote = (title: string, date: string | null) => ({ title, eventDate: date ? D(date) : null, eventTime: null, eventLocation: '더채플앳논현', chatRoom: null });
const PAYS = [
  { id: 'p1', userId: 'u1', proProfileId: 'pp1', method: '카드', status: 'completed', amount: 300000, createdAt: D('2026-10-01T01:00:00Z'), updatedAt: D('2026-10-01T01:00:00Z'), customerPhone: '01012345670', pgTransactionId: 'ORDER-AAA111', quotations: [quote('이나연 결혼식', '2026-12-20')] },
  // 가상계좌: 10/03 입금(로그 생성) → 10/20 정산하기로 updatedAt 밀림
  { id: 'p2', userId: 'u2', proProfileId: 'pp2', method: '가상계좌', status: 'completed', amount: 400000, createdAt: D('2026-09-30T01:00:00Z'), updatedAt: D('2026-10-20T01:00:00Z'), customerPhone: null, pgTransactionId: 'ORDER-BBB222', quotations: [quote('김하늘 돌잔치', '2026-11-05')], settlementLog: { createdAt: D('2026-10-03T05:00:00Z'), status: 'settled', settledAt: D('2026-10-20T01:00:00Z') } },
  { id: 'p3', userId: 'u3', proProfileId: 'pp1', method: '카드', status: 'refunded', amount: 500000, createdAt: D('2026-10-05T01:00:00Z'), updatedAt: D('2026-10-06T01:00:00Z'), customerPhone: '010-9999-0000', pgTransactionId: 'ORDER-CCC333', quotations: [] },
];
const USERS = [{ id: 'u1', name: '이나연', phone: null }, { id: 'u2', name: '김하늘', phone: '01022223333' }, { id: 'u3', name: '박서준', phone: null }];
const PROS = [{ id: 'pp1', user: { id: 'x1', name: '임하람' } }, { id: 'pp2', user: { id: 'x2', name: '서지수' } }];
const byIn = <T extends { id: string }>(rows: T[], where: any) => (where?.id?.in ? rows.filter((r) => where.id.in.includes(r.id)).reverse() : rows);
const fakePrisma: any = {
  payment: { findMany: async ({ where }: any) => byIn(PAYS, where).filter((p) => !where.status || p.status === where.status).map((p) => ({ settlementLog: null, refundAmount: null, refundReason: null, refundedAt: null, ...p })) },
  user: { findMany: async ({ where }: any) => USERS.filter((u) => where.id.in.includes(u.id)) },
  proProfile: { findMany: async ({ where }: any) => PROS.filter((p) => where.id.in.includes(p.id)) },
  settlementLog: {
    findMany: async ({ where }: any) => {
      const logs = PAYS.map((p, i) => ({
        id: `s${i + 1}`, paymentId: p.id, proProfileId: p.proProfileId, amount: p.amount, platformFee: 0, netAmount: p.amount - 10000,
        status: i === 1 ? 'settled' : 'pending', settledAt: null, note: null, createdAt: (p as any).settlementLog?.createdAt || p.createdAt,
        proProfile: { id: p.proProfileId, user: PROS.find((x) => x.id === p.proProfileId)!.user }, settledBy: null,
        payment: { ...p },
      }));
      return byIn(logs, where).filter((l) => !where.status || l.status === where.status);
    },
  },
};
const admin = Object.assign(Object.create(AdminService.prototype), { prisma: fakePrisma }) as AdminService;
const settle = Object.assign(Object.create(SettlementService.prototype), { prisma: fakePrisma }) as SettlementService;

test('admin payments: search by customer name / phone digits / order no, sort, paging, virtual-account paid date', async () => {
  const all = await admin.getPayments({ page: 1, limit: 20 });
  assert.equal(all.total, 3);
  // 결제일 최신순 — p2 입금일은 10/03(정산하기로 밀린 10/20 아님)
  assert.deepEqual(all.data.map((r: any) => r.id), ['p3', 'p2', 'p1']);
  assert.equal(new Date(all.data[1].paidAt).toISOString(), '2026-10-03T05:00:00.000Z');
  assert.equal((await admin.getPayments({ search: '이 나연' })).data.map((r: any) => r.id).join(), 'p1');
  assert.equal((await admin.getPayments({ search: '010-2222' })).data.map((r: any) => r.id).join(), 'p2');
  assert.equal((await admin.getPayments({ search: '99990000' })).data.map((r: any) => r.id).join(), 'p3');
  assert.equal((await admin.getPayments({ search: 'order-ccc' })).data.map((r: any) => r.id).join(), 'p3');
  assert.equal((await admin.getPayments({ search: '임하람' })).total, 2);
  assert.equal((await admin.getPayments({ search: '돌잔치' })).data.map((r: any) => r.id).join(), 'p2');
  // 예식일 빠른순 — 행사 없는 p3 은 맨 뒤
  assert.deepEqual((await admin.getPayments({ sort: 'event_asc' })).data.map((r: any) => r.id), ['p2', 'p1', 'p3']);
  assert.deepEqual((await admin.getPayments({ sort: 'event_desc' })).data.map((r: any) => r.id), ['p1', 'p2', 'p3']);
  // 페이지 — 2쪽(한 쪽 2줄)
  const p2 = await admin.getPayments({ page: 2, limit: 2, sort: 'paid_asc' });
  assert.equal(p2.total, 3);
  assert.deepEqual(p2.data.map((r: any) => r.id), ['p3']);
  assert.equal((await admin.getPayments({ search: '없는사람' })).total, 0);
});

test('admin settlements: paidAt on each row, search, summary follows the search', async () => {
  const all: any = await settle.adminList({ page: 1, limit: 30 });
  assert.equal(all.meta.total, 3);
  assert.deepEqual(all.data.map((r: any) => r.id), ['s3', 's2', 's1']);
  assert.equal(new Date(all.data[1].payment.paidAt).toISOString(), '2026-10-03T05:00:00.000Z');
  assert.equal(all.data[1].payment.updatedAt, undefined);
  // p3 은 환불된 결제(수정 전 환불이라 로그가 '대기'로 남은 줄) — 목록엔 나오지만 정산 대기 합계에선 빠진다
  assert.deepEqual(all.summary, { pendingCount: 1, pendingAmount: 290000, settledCount: 1, settledAmount: 390000 });
  const hit: any = await settle.adminList({ search: '김하늘' });
  assert.deepEqual(hit.data.map((r: any) => r.id), ['s2']);
  assert.deepEqual(hit.summary, { pendingCount: 0, pendingAmount: 0, settledCount: 1, settledAmount: 390000 });
  assert.deepEqual((await settle.adminList({ sort: 'event_asc' }) as any).data.map((r: any) => r.id), ['s2', 's1', 's3']);
  assert.equal((await settle.adminList({ status: 'pending' as any, search: '김하늘' }) as any).meta.total, 0);
});
