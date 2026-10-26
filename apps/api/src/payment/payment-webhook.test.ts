import { test, mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { ServiceUnavailableException } from '@nestjs/common';
import { PaymentService } from './payment.service';

// 토스 웹훅(handleTossWebhook) — 본문 status 를 믿지 않고 토스 결제 조회로만 상태를 바꾸는지.
// prisma·axios 는 가짜. 토스 쪽 결제는 tossByKey(paymentKey)·tossByOrder(orderId) 에 둔다.

type Row = { id: string; userId: string; proProfileId: string; quotationId: string | null; amount: number; platformFee: number | null; netAmount: number | null; method: string | null; pgTransactionId: string | null; status: string };

const TOSS = 'https://api.tosspayments.com/v1/payments';

function setup(rows: Row[], toss: any[]) {
  const calls = { tossGets: [] as string[], quotationPaid: 0, chatMessages: [] as any[], settlementLogs: 0, matchClosed: 0, warns: [] as string[], errors: [] as string[] };
  const byKey = (k: string) => toss.find((t) => t.paymentKey === k);
  const byOrder = (o: string) => toss.find((t) => t.orderId === o);
  let tossFail: { status?: number } | null = null;

  mock.method(axios, 'get', async (url: string) => {
    calls.tossGets.push(url);
    if (tossFail) throw Object.assign(new Error('toss down'), tossFail.status ? { response: { status: tossFail.status, data: { code: 'X' } } } : {});
    const rest = url.slice(TOSS.length + 1);
    const t = rest.startsWith('orders/') ? byOrder(decodeURIComponent(rest.slice(7))) : byKey(decodeURIComponent(rest));
    if (!t) throw Object.assign(new Error('404'), { response: { status: 404, data: { code: 'NOT_FOUND_PAYMENT' } } });
    return { data: { ...t } };
  });

  const matches = (r: Row, where: any) =>
    (where.OR ? where.OR.some((c: any) => r.pgTransactionId === c.pgTransactionId) : true) &&
    (where.pgTransactionId === undefined || r.pgTransactionId === where.pgTransactionId) &&
    (where.id === undefined || r.id === where.id) &&
    (where.status === undefined || r.status === where.status);
  const prisma: any = {
    payment: {
      findFirst: async ({ where }: any) => { const r = rows.find((x) => matches(x, where)); return r ? { ...r } : null; },
      findUnique: async ({ where }: any) => { const r = rows.find((x) => matches(x, where)); return r ? { ...r } : null; },
      // 조건부 갱신 — 같은 틱 안에서 확인·쓰기(실제 DB 의 UPDATE … WHERE status=… 처럼 원자적)
      updateMany: async ({ where, data }: any) => {
        const hit = rows.filter((x) => matches(x, where));
        hit.forEach((x) => Object.assign(x, data));
        return { count: hit.length };
      },
      update: async () => { throw new Error('webhook must use conditional updateMany'); },
    },
    quotation: { update: async ({ where }: any) => { calls.quotationPaid++; return { id: where.id, title: '본식 사회', matchDeliveryId: 'd1' }; } },
    chatRoom: { findFirst: async () => ({ id: 'room1', matchRequestId: 'mr1' }), create: async () => ({ id: 'room1' }) },
    proProfile: { findUnique: async () => ({ userId: 'pro-user' }) },
    matchDelivery: { findUnique: async () => ({ matchRequestId: 'mr1' }) },
    matchRequest: { updateMany: async () => { calls.matchClosed++; return { count: 1 }; } },
    settlementLog: { upsert: async () => { calls.settlementLogs++; return {}; } },
  };
  const chat: any = {
    sendMessage: async (_room: string, _user: string, msg: any) => { calls.chatMessages.push(msg); return { id: `m${calls.chatMessages.length}` }; },
    getRoomMemberIds: async () => ['cust', 'pro-user'],
  };
  const realtime: any = { emitPersistedMessage: async () => {}, emitDashboardUpdated: () => {} };
  const notification: any = { createNotification: async () => {} };
  const config: any = { get: () => 'test_sk_dummy' };
  const service = new PaymentService(prisma, config, notification, chat, realtime);
  (service as any).logger = { log() {}, warn: (m: string) => calls.warns.push(m), error: (m: string) => calls.errors.push(m) };
  return { service, calls, setTossFail: (f: { status?: number } | null) => { tossFail = f; } };
}

const row = (o: Partial<Row>): Row => ({ id: 'pay1', userId: 'cust', proProfileId: 'pro1', quotationId: 'q1', amount: 550000, platformFee: 55000, netAmount: 495000, method: '가상계좌', pgTransactionId: 'pk_va_1', status: 'waiting_for_deposit', ...o });
const tossPay = (o: any) => ({ paymentKey: 'pk_va_1', orderId: 'ORDER-1-aaaa', status: 'WAITING_FOR_DEPOSIT', totalAmount: 550000, method: '가상계좌', secret: 'ps_real_secret', ...o });

afterEach(() => mock.restoreAll());

test('forged DONE for an unpaid virtual account is rejected: stays waiting, no side effects, 200, logged', async () => {
  const rows = [row({})];
  const { service, calls } = setup(rows, [tossPay({})]);
  const res = await service.handleTossWebhook({ eventType: 'PAYMENT_STATUS_CHANGED', data: { status: 'DONE', paymentKey: 'pk_va_1', orderId: 'ORDER-1-aaaa' } }, '1.2.3.4');
  assert.deepEqual(res, { ok: true });
  assert.equal(rows[0].status, 'waiting_for_deposit');
  assert.deepEqual(calls.tossGets, [`${TOSS}/pk_va_1`]);
  assert.equal(calls.quotationPaid + calls.chatMessages.length + calls.settlementLogs, 0);
  assert.equal(calls.warns.length, 1);
  assert.match(calls.warns[0], /거부\(본문 상태가 토스와 다름\).*from=1\.2\.3\.4/);
});

test('forged DONE with only orderId (DEPOSIT_CALLBACK shape) and a guessed secret is rejected with 200', async () => {
  const rows = [row({})];
  const { service, calls } = setup(rows, [tossPay({})]);
  assert.deepEqual(await service.handleTossWebhook({ status: 'DONE', orderId: 'ORDER-1-aaaa', secret: 'guess' }), { ok: true });
  assert.deepEqual(await service.handleTossWebhook({ status: 'DONE', orderId: 'ORDER-1-aaaa' }), { ok: true });
  assert.equal(rows[0].status, 'waiting_for_deposit');
  assert.equal(calls.settlementLogs, 0);
  assert.equal(calls.errors.length, 0);
});

test('real DEPOSIT_CALLBACK (secret matches) that Toss lookup has not caught up with → 503, then the retry completes it', async () => {
  const rows = [row({})];
  const toss = [tossPay({})];
  const { service, calls } = setup(rows, toss);
  const body = { createdAt: '2026-10-26T10:00:00.000000', secret: 'ps_real_secret', status: 'DONE', transactionKey: 'tx1', orderId: 'ORDER-1-aaaa' };
  await assert.rejects(service.handleTossWebhook(body), ServiceUnavailableException);
  assert.equal(rows[0].status, 'waiting_for_deposit');
  assert.equal(calls.settlementLogs, 0);
  toss[0].status = 'DONE';
  await service.handleTossWebhook(body);
  assert.equal(rows[0].status, 'completed');
  assert.equal(calls.settlementLogs, 1);
});

test('real PAYMENT_STATUS_CHANGED DONE completes the payment once with all side effects', async () => {
  const rows = [row({})];
  const { service, calls } = setup(rows, [tossPay({ status: 'DONE' })]);
  await service.handleTossWebhook({ eventType: 'PAYMENT_STATUS_CHANGED', data: { status: 'DONE', paymentKey: 'pk_va_1', orderId: 'ORDER-1-aaaa' } });
  assert.equal(rows[0].status, 'completed');
  assert.equal(rows[0].pgTransactionId, 'pk_va_1');
  assert.equal(calls.quotationPaid, 1);
  assert.equal(calls.settlementLogs, 1);
  assert.equal(calls.matchClosed, 1);
  assert.equal(calls.chatMessages.length, 1);
  assert.equal(calls.chatMessages[0].content, '결제가 완료되었습니다 (550,000원).');
  // 채팅 카드 주문번호는 paymentKey 가 아니라 토스 orderId
  assert.equal(calls.chatMessages[0].metadata.system.orderId, 'ORDER-1-aaaa');
  assert.equal(calls.warns.length, 0);
});

test('real DEPOSIT_CALLBACK (flat, orderId only) finds the waiting payment via Toss orderId lookup and completes it', async () => {
  // confirm 이 pgTransactionId 를 paymentKey 로 바꿔 둬서 orderId 로는 DB 에서 못 찾는 경우(예전엔 '웹훅 대상 결제 없음'으로 끝)
  const rows = [row({})];
  const { service, calls } = setup(rows, [tossPay({ status: 'DONE' })]);
  await service.handleTossWebhook({ createdAt: '2026-10-26T10:00:00.000000', secret: 'ps_x', status: 'DONE', transactionKey: 'tx1', orderId: 'ORDER-1-aaaa' });
  assert.deepEqual(calls.tossGets, [`${TOSS}/orders/ORDER-1-aaaa`]);
  assert.equal(rows[0].status, 'completed');
  assert.equal(calls.settlementLogs, 1);
});

test('duplicate and concurrent deliveries of the same deposit run side effects exactly once', async () => {
  const rows = [row({})];
  const { service, calls } = setup(rows, [tossPay({ status: 'DONE' })]);
  const statusChanged = { eventType: 'PAYMENT_STATUS_CHANGED', data: { status: 'DONE', paymentKey: 'pk_va_1', orderId: 'ORDER-1-aaaa' } };
  const depositCallback = { status: 'DONE', orderId: 'ORDER-1-aaaa', secret: 'ps_x' };
  await Promise.all([service.handleTossWebhook(statusChanged), service.handleTossWebhook(depositCallback), service.handleTossWebhook(statusChanged)]);
  assert.equal(rows[0].status, 'completed');
  assert.equal(calls.settlementLogs, 1);
  assert.equal(calls.chatMessages.length, 1);
  // 이미 끝난 결제의 재전송은 토스에 묻지도 않는다
  const before = calls.tossGets.length;
  await service.handleTossWebhook(statusChanged);
  assert.equal(calls.tossGets.length, before);
  assert.equal(calls.settlementLogs, 1);
});

test('Toss DONE with a different amount is not completed', async () => {
  const rows = [row({})];
  const { service, calls } = setup(rows, [tossPay({ status: 'DONE', totalAmount: 1000 })]);
  await service.handleTossWebhook({ eventType: 'PAYMENT_STATUS_CHANGED', data: { status: 'DONE', paymentKey: 'pk_va_1', orderId: 'ORDER-1-aaaa' } });
  assert.equal(rows[0].status, 'waiting_for_deposit');
  assert.equal(calls.settlementLogs, 0);
  assert.match(calls.warns[0], /금액 불일치/);
});

test('keys Toss does not know, or a body mixing someone else\'s keys, are rejected with 200', async () => {
  const rows = [row({})];
  const { service, calls } = setup(rows, [tossPay({ status: 'DONE' })]);
  // DB 에도 토스에도 없는 키
  assert.deepEqual(await service.handleTossWebhook({ data: { status: 'DONE', orderId: 'ORDER-nope' } }), { ok: true });
  // 남의 실제 paymentKey + 다른 orderId
  await service.handleTossWebhook({ data: { status: 'DONE', paymentKey: 'pk_va_1', orderId: 'ORDER-mine' } });
  assert.equal(rows[0].status, 'waiting_for_deposit');
  assert.equal(calls.settlementLogs, 0);
  assert.ok(calls.warns.some((w) => /키 불일치/.test(w)));
  // 숫자·객체 같은 이상한 키는 DB·토스 조회 없이 끝
  const n = calls.tossGets.length;
  await service.handleTossWebhook({ data: { status: 'DONE', paymentKey: { $ne: null }, orderId: 12345 } });
  assert.equal(calls.tossGets.length, n);
});

test('finished payments (refunded/completed/failed) are never reopened by a webhook', async () => {
  for (const status of ['refunded', 'completed', 'failed', 'settled']) {
    const rows = [row({ status })];
    const { service, calls } = setup(rows, [tossPay({ status: 'DONE' })]);
    await service.handleTossWebhook({ data: { status: 'DONE', paymentKey: 'pk_va_1', orderId: 'ORDER-1-aaaa' } });
    assert.equal(rows[0].status, status);
    assert.equal(calls.tossGets.length, 0);
    assert.equal(calls.settlementLogs, 0);
  }
});

test('Toss lookup outage → 503 so Toss retries; the retry then completes the real deposit', async () => {
  for (const fail of [{}, { status: 500 }, { status: 401 }, { status: 429 }]) {
    const rows = [row({})];
    const { service, calls, setTossFail } = setup(rows, [tossPay({ status: 'DONE' })]);
    setTossFail(fail);
    const body = { eventType: 'PAYMENT_STATUS_CHANGED', data: { status: 'DONE', paymentKey: 'pk_va_1', orderId: 'ORDER-1-aaaa' } };
    await assert.rejects(service.handleTossWebhook(body), ServiceUnavailableException);
    assert.equal(rows[0].status, 'waiting_for_deposit');
    assert.equal(calls.errors.length, 1);
    setTossFail(null);
    await service.handleTossWebhook(body);
    assert.equal(rows[0].status, 'completed');
    assert.equal(calls.settlementLogs, 1);
  }
});

test('cancel/expire is applied only when Toss says so', async () => {
  const rows = [row({})];
  const toss = [tossPay({})];
  const { service } = setup(rows, toss);
  // 위조 취소(남의 입금대기 결제를 실패로 만드는 장난) — 토스는 아직 입금대기
  await service.handleTossWebhook({ status: 'CANCELED', orderId: 'ORDER-1-aaaa' });
  assert.equal(rows[0].status, 'waiting_for_deposit');
  toss[0].status = 'CANCELED';
  await service.handleTossWebhook({ status: 'CANCELED', orderId: 'ORDER-1-aaaa' });
  assert.equal(rows[0].status, 'failed');
});

test('pending order that Toss reports DONE (confirm never saved) is completed by orderId and keeps the paymentKey for refunds', async () => {
  const rows = [row({ status: 'pending', pgTransactionId: 'ORDER-2-bbbb', method: null })];
  const { service, calls } = setup(rows, [tossPay({ paymentKey: 'pk_card_2', orderId: 'ORDER-2-bbbb', status: 'DONE', method: '카드' })]);
  await service.handleTossWebhook({ eventType: 'PAYMENT_STATUS_CHANGED', data: { status: 'DONE', paymentKey: 'pk_card_2', orderId: 'ORDER-2-bbbb' } });
  assert.deepEqual(calls.tossGets, [`${TOSS}/orders/ORDER-2-bbbb`]);
  assert.equal(rows[0].status, 'completed');
  assert.equal(rows[0].pgTransactionId, 'pk_card_2');
  assert.equal(rows[0].method, '카드');
  assert.equal(calls.settlementLogs, 1);
});

test('pending order still unpaid at Toss is not completed by a forged DONE', async () => {
  const rows = [row({ status: 'pending', pgTransactionId: 'ORDER-3-cccc', method: null })];
  const { service, calls } = setup(rows, [tossPay({ paymentKey: 'pk_3', orderId: 'ORDER-3-cccc', status: 'IN_PROGRESS' })]);
  await service.handleTossWebhook({ data: { status: 'DONE', orderId: 'ORDER-3-cccc' } });
  // orderId 를 paymentKey 칸에 넣어 보내도 토스 조회는 실패(없는 결제)로 끝난다
  await service.handleTossWebhook({ data: { status: 'DONE', paymentKey: 'ORDER-3-cccc' } });
  assert.equal(rows[0].status, 'pending');
  assert.equal(calls.settlementLogs, 0);
});
