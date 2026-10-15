import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LandingService } from './landing.service';
import { attributeLandingLead, leadLandingPage } from './landing-attribution';
import { AdminDailyBriefingService, briefingWindow } from '../admin/admin-daily-briefing.service';

test('landing source matching does not attribute unrelated pages', () => {
  assert.equal(leadLandingPage('landing_quick_match'), 'quick-match');
  assert.equal(leadLandingPage('landing_wedding_mc_v3'), 'wedding-mc');
  assert.equal(leadLandingPage('freetiful-corporate-mc'), 'corporate-mc');
  assert.equal(leadLandingPage('pro_detail_inquiry'), null);
});

test('visit identity comes from verified auth, never overwrites a member, and rejects missing session keys', async () => {
  let insert: any;
  let update: any;
  const service = new LandingService({ landingVisit: {
    upsert: async (args: any) => { insert = args; return { id: 'visit' }; },
    updateMany: async (args: any) => { update = args; },
  } } as any);
  const input = { page: 'quick-match', sessionKey: 'valid-session-key-uuid', userId: 'spoofed-member' };
  await service.recordVisit(input, 'verified-member');
  assert.equal(insert.create.userId, 'verified-member');
  assert.equal(update.where.userId, null);
  assert.equal(update.data.userId, 'verified-member');
  insert = null;
  assert.equal((await service.recordVisit({ page: 'quick-match', sessionKey: '' })).ok, false);
  assert.equal(insert, null);
});

test('server attribution preserves account ownership and links each new lead', async () => {
  const changes: any[] = [];
  let owner: string | null = null;
  const tx = {
    landingVisit: { upsert: async () => ({ id: 'visit', userId: owner }), update: async (v: any) => { changes.push(v); } },
    matchRequest: { update: async (v: any) => { changes.push(v); } },
    businessInquiry: { update: async (v: any) => { changes.push(v); } },
  };
  const prisma = { $transaction: async (callback: any) => callback(tx) } as any;
  const input = { page: 'wedding-mc', sessionKey: 'valid-session-key-uuid', userId: 'member-a', matchRequestId: 'request-a' };
  await attributeLandingLead(prisma, input);
  assert.equal(changes[1].data.landingVisitId, 'visit');
  owner = 'member-a'; changes.length = 0;
  await attributeLandingLead(prisma, { ...input, userId: 'member-b' });
  assert.equal(changes.length, 0);
  await attributeLandingLead(prisma, { ...input, matchRequestId: 'request-b' });
  assert.equal(changes[1].where.id, 'request-b');
  changes.length = 0;
  await attributeLandingLead(prisma, { page: 'corporate-mc', sessionKey: input.sessionKey, inquiryId: 'inquiry' });
  assert.equal(changes[0].data.userId, undefined);
  assert.equal(changes[1].where.id, 'inquiry');
});

test('visit statuses use exact request payments, preserve anonymous/legacy uncertainty, and respect date filters', async () => {
  const base = { page: 'quick-match', utmSource: 'naver', utmMedium: null, utmCampaign: null, referrer: null, converted: false, createdAt: new Date(), userId: null, matchRequests: [], businessInquiries: [] };
  const rows = [
    { ...base, id: 'anonymous' },
    { ...base, id: 'legacy', converted: true },
    { ...base, id: 'contact', converted: true, businessInquiries: [{ name: '기업 문의자' }] },
    { ...base, id: 'paid', userId: 'u', matchRequests: [{ id: 'r', user: { id: 'u', name: '방문 회원', profileImageUrl: null }, deliveries: [{ id: 'd', status: 'replied' }], _count: { chatRooms: 1 } }] },
    { ...base, id: 'unpaid', userId: 'u', matchRequests: [{ id: 'r2', user: { id: 'u', name: '방문 회원', profileImageUrl: null }, deliveries: [], _count: { chatRooms: 0 } }] },
  ];
  let query: any;
  let paymentQuery: any;
  const service = new LandingService({
    landingVisit: { findMany: async (args: any) => { query = args; return rows; } },
    user: { findMany: async () => [{ id: 'u', name: '방문 회원', profileImageUrl: null }] },
    quotation: { findMany: async () => [{ id: 'quote', paymentId: 'payment', matchDeliveryId: 'd', chatRoom: null }] },
    payment: { findMany: async (args: any) => { paymentQuery = args; return [{ id: 'payment', quotationId: 'quote' }]; } },
  } as any);
  const result = (await service.recentVisits(150, 'quick-match', '2026-10-14T15:00:00Z', '2026-10-15T14:59:59Z')).data;
  assert.equal(result[0].visitor.kind, 'anonymous');
  assert.equal(result[1].paid, null);
  assert.equal(result[2].visitor.name, '기업 문의자');
  assert.equal(result[2].visitor.kind, 'contact');
  assert.equal(result[3].paid, true);
  assert.equal(result[3].connected, true);
  assert.equal(result[4].paid, false, 'same member, different request must not inherit a payment');
  assert.equal(result[4].connected, false);
  assert.equal(query.where.createdAt.gte.toISOString(), '2026-10-14T15:00:00.000Z');
  assert.deepEqual(paymentQuery.where.status.in, ['completed', 'escrowed', 'settled']);
  assert.equal(paymentQuery.where.AND[0].OR[1].method.not, 'admin_review');
  await assert.rejects(() => service.recentVisits(100, undefined, 'invalid'), /조회 기간/);
});

test('briefing two-hour slots respect Korean midnight', () => {
  assert.equal(briefingWindow(new Date('2026-10-15T14:59:00Z')).slotKey, '2026-10-15:22');
  const midnight = briefingWindow(new Date('2026-10-15T15:00:00Z'));
  assert.equal(midnight.slotKey, '2026-10-16:00');
  assert.equal(midnight.start.toISOString(), '2026-10-15T15:00:00.000Z');
  assert.equal(midnight.expiresAt.toISOString(), '2026-10-15T17:00:00.000Z');
});

test('briefing deduplicates generation, reuses persisted snapshots, and labels non-AI fallback', async () => {
  let saved: any = null;
  let collects = 0;
  const metrics = { revenue: 800000n, payments: 2, requests: 3, connected: 1, visits: 12, signups: 2, inquiries: 1, unresponded: 2 };
  const prisma = {
    adminDailyBriefing: {
      findUnique: async ({ where }: any) => saved?.slotKey === where.slotKey ? saved : null,
      upsert: async ({ create }: any) => { saved = create; }, deleteMany: async () => ({}),
    },
    $queryRaw: async () => { collects++; return [{ ...metrics, bucket: 'today' }, { ...metrics, bucket: 'previous', revenue: 0n }]; },
    businessInquiry: { count: async () => 4 }, proProfile: { count: async () => 1 },
  } as any;
  const service = new AdminDailyBriefingService(prisma);
  (service as any).client = null;
  const now = new Date('2026-10-15T04:00:00Z');
  const reports = await Promise.all([service.get(now), service.get(now)]);
  assert.equal(collects, 1);
  assert.equal(reports[0].source, 'rule');
  assert.equal(reports[0].today.revenue, 800000);
  assert.match(reports[0].summary, /800,000/);
  assert.match(reports[0].insights[0], /증감률은 계산하지/);
  await service.get(now);
  assert.equal(collects, 1);
  await service.get(new Date('2026-10-15T05:00:00Z'));
  assert.equal(collects, 2);
});

test('unavailable metrics must not be presented as zero revenue', async () => {
  const service = new AdminDailyBriefingService({ adminDailyBriefing: { findUnique: async () => null }, $queryRaw: async () => { throw new Error('DB unavailable'); } } as any);
  await assert.rejects(() => service.get(), /DB unavailable/);
});
