import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claimRefund, SETTLED_REFUND_BLOCK_MESSAGE } from './settlement-refund';
import { SettlementService } from './settlement.service';
import { PaymentService } from '../payment/payment.service';
import { AdminService } from '../admin/admin.service';

// ── 가짜 prisma(메모리) — $transaction 은 사본에서 돌리고 던지면 버린다(실제 롤백처럼) ──
type Row = Record<string, any>;
const same = (row: Row, where: Row) => Object.entries(where).every(([k, v]) => row[k] === v);

function makeDb(init: { payments: Row[]; logs: Row[] }) {
  let state = structuredClone(init);
  const clientOf = (st: () => typeof state) => {
    const pay = (id: string) => st().payments.find((p) => p.id === id);
    const logOf = (where: Row) => st().logs.find((l) => (where.id ? l.id === where.id : l.paymentId === where.paymentId));
    const withPayment = (l: Row | undefined) => (l ? { ...l, proProfile: null, payment: { status: pay(l.paymentId)!.status } } : null);
    const updateMany = (rows: Row[]) => async ({ where, data }: any) => {
      let count = 0;
      for (const r of rows) if (same(r, where)) { Object.assign(r, data); count += 1; }
      return { count };
    };
    return {
      payment: {
        findUnique: async ({ where }: any) => {
          const p = pay(where.id);
          return p ? { ...p, quotations: [], settlementLog: st().logs.find((l) => l.paymentId === p.id) ?? null } : null;
        },
        findUniqueOrThrow: async ({ where }: any) => ({ ...pay(where.id)! }),
        updateMany: (args: any) => updateMany(st().payments)(args),
        update: async ({ where, data }: any) => Object.assign(pay(where.id)!, data),
      },
      settlementLog: {
        findUnique: async ({ where }: any) => withPayment(logOf(where)),
        findUniqueOrThrow: async ({ where }: any) => ({ ...logOf(where)! }),
        updateMany: (args: any) => updateMany(st().logs)(args),
        update: async ({ where, data }: any) => Object.assign(logOf(where)!, data),
      },
      quotation: { update: async () => ({}) },
      chatRoom: { findFirst: async () => null },
      proProfile: { findUnique: async () => null },
    };
  };
  const db: any = {
    ...clientOf(() => state),
    $transaction: async (fn: (tx: any) => Promise<any>) => {
      const draft = structuredClone(state);
      const out = await fn(clientOf(() => draft));
      state = draft;
      return out;
    },
    pay: (id: string) => state.payments.find((p) => p.id === id),
    log: (paymentId: string) => state.logs.find((l) => l.paymentId === paymentId),
  };
  return db;
}

const NOW = new Date();
const payment = (id: string, status = 'completed') => ({ id, userId: 'u1', proProfileId: 'pp1', quotationId: null, method: '카드', amount: 300000, status, refundAmount: null, refundReason: null, refundedAt: null, settledAt: null, pgTransactionId: null, createdAt: NOW, updatedAt: NOW });
const log = (paymentId: string, status = 'pending') => ({ id: `s-${paymentId}`, paymentId, proProfileId: 'pp1', amount: 300000, platformFee: 0, netAmount: 300000, status, settledAt: status === 'settled' ? NOW : null, settledByUserId: null, note: null, createdAt: NOW });

const services = (db: any) => ({
  settle: Object.assign(Object.create(SettlementService.prototype), { prisma: db, notification: { createNotification: async () => undefined } }) as SettlementService,
  pay: Object.assign(Object.create(PaymentService.prototype), {
    prisma: db,
    notificationService: { createNotification: async () => undefined },
    logger: { warn: () => undefined, error: () => undefined, log: () => undefined },
  }) as PaymentService,
  admin: Object.assign(Object.create(AdminService.prototype), { prisma: db }) as AdminService,
});

test('refund cancels the pending settlement log in the same transaction — full and 50% partial alike (사장: 부분 환불도 사회자 정산 없음)', async () => {
  const db = makeDb({ payments: [payment('full'), payment('half')], logs: [log('full'), log('half')] });
  assert.equal(await claimRefund(db, 'full', { refundAmount: 300000, refundReason: '변심', refundedAt: NOW }), 'ok');
  assert.equal(await claimRefund(db, 'half', { refundAmount: 150000, refundReason: '변심', refundedAt: NOW }), 'ok');
  for (const id of ['full', 'half']) {
    assert.equal(db.pay(id).status, 'refunded');
    assert.equal(db.log(id).status, 'cancelled');
  }
  assert.equal(db.pay('half').refundAmount, 150000);
  // 두 번 누름 — 두 번째는 아무것도 안 바꾸고 PG 취소도 안 부른다
  assert.equal(await claimRefund(db, 'half', { refundAmount: 150000, refundReason: '또', refundedAt: NOW }), 'not_completed');
  assert.equal(db.pay('half').refundReason, '변심');
});

test('refund claim on an already-settled log changes nothing (rolled back)', async () => {
  const db = makeDb({ payments: [payment('p')], logs: [log('p', 'settled')] });
  assert.equal(await claimRefund(db, 'p', { refundAmount: 300000, refundReason: 'x', refundedAt: NOW }), 'settled');
  assert.equal(db.pay('p').status, 'completed');
  assert.equal(db.log('p').status, 'settled');
});

test('cancelPayment: settled → 고객센터 안내, nothing refunded; pending → refunded + log cancelled', async () => {
  const db = makeDb({ payments: [payment('settled'), payment('open')], logs: [log('settled', 'settled'), log('open')] });
  const { pay } = services(db);
  await assert.rejects(pay.cancelPayment('u1', 'settled', '변심'), (e: any) => e.message === SETTLED_REFUND_BLOCK_MESSAGE);
  assert.equal(db.pay('settled').status, 'completed');
  const out: any = await pay.cancelPayment('u1', 'open', '변심');
  assert.equal(out.status, 'refunded');
  assert.equal(out.refundRate, 100);
  assert.equal(db.log('open').status, 'cancelled');
  // 이미 환불 = 다시 못 함
  await assert.rejects(pay.cancelPayment('u1', 'open', '변심'), /완료된 결제만/);
});

test('refundAsSystem: settled log → no automatic refund; pending → refunded + cancelled', async () => {
  const db = makeDb({ payments: [payment('settled'), payment('open')], logs: [log('settled', 'settled'), log('open')] });
  const { pay } = services(db);
  await pay.refundAsSystem('settled', '사회자 거절');
  assert.equal(db.pay('settled').status, 'completed');
  const out: any = await pay.refundAsSystem('open', '사회자 거절');
  assert.equal(out.status, 'refunded');
  assert.equal(out.refundAmount, 300000);
  assert.equal(db.log('open').status, 'cancelled');
});

test('markSettled rejects refunded payments (legacy pending log) and cancelled logs; settles paid ones', async () => {
  const legacy = { ...payment('legacy', 'refunded'), refundAmount: 150000 };
  const db = makeDb({ payments: [legacy, payment('gone', 'refunded'), payment('ok')], logs: [log('legacy'), log('gone', 'cancelled'), log('ok')] });
  const { settle } = services(db);
  await assert.rejects(settle.markSettled('s-legacy', 'admin'), /환불된 결제라 정산할 수 없습니다/);
  await assert.rejects(settle.markSettled('s-gone', 'admin'), /취소된 정산 내역/);
  assert.equal(db.log('legacy').status, 'pending');
  const done: any = await settle.markSettled('s-ok', 'admin', '메모');
  assert.equal(done.status, 'settled');
  assert.ok(db.pay('ok').settledAt instanceof Date);
  await assert.rejects(settle.markSettled('s-ok', 'admin'), /이미 정산 완료/);
});

test('markSettled loses the race to a refund that cancelled the log first', async () => {
  const db = makeDb({ payments: [payment('p')], logs: [log('p')] });
  const { settle } = services(db);
  // 정산하기가 결제 상태를 읽은 뒤, 트랜잭션 전에 고객 환불이 끝난 상황
  const realTx = db.$transaction;
  db.$transaction = async (fn: any) => {
    db.$transaction = realTx;
    await claimRefund(db, 'p', { refundAmount: 300000, refundReason: 'x', refundedAt: NOW });
    return realTx(fn);
  };
  await assert.rejects(settle.markSettled('s-p', 'admin'), /방금 환불되었거나/);
  assert.equal(db.log('p').status, 'cancelled');
  assert.equal(db.pay('p').settledAt, null);
});

test('unmarkSettled: only settled logs; a refunded payment goes back to cancelled, not pending', async () => {
  const db = makeDb({ payments: [payment('paid'), payment('cs', 'refunded'), payment('gone', 'refunded')], logs: [log('paid', 'settled'), log('cs', 'settled'), log('gone', 'cancelled')] });
  const { settle } = services(db);
  await settle.unmarkSettled('s-paid');
  assert.equal(db.log('paid').status, 'pending');
  await settle.unmarkSettled('s-cs');
  assert.equal(db.log('cs').status, 'cancelled');
  await assert.rejects(settle.unmarkSettled('s-gone'), /정산 완료된 내역만/);
  assert.equal(db.log('gone').status, 'cancelled');
});

test('admin payment edit: refunded cancels the pending log, back to completed restores it, settled log untouched', async () => {
  const db = makeDb({ payments: [payment('p'), payment('s')], logs: [log('p'), log('s', 'settled')] });
  const { admin } = services(db);
  await admin.updatePayment('p', { status: 'refunded', refundAmount: '150000' });
  assert.equal(db.pay('p').status, 'refunded');
  assert.ok(db.pay('p').refundedAt instanceof Date);
  assert.equal(db.log('p').status, 'cancelled');
  await admin.updatePayment('p', { status: 'completed' });
  assert.equal(db.log('p').status, 'pending');
  await admin.updatePayment('s', { status: 'refunded' });
  assert.equal(db.pay('s').status, 'refunded');
  assert.equal(db.log('s').status, 'settled');
  // 상태를 안 바꾸는 수정은 정산 로그를 건드리지 않는다
  await admin.updatePayment('p', { refundReason: '메모' });
  assert.equal(db.log('p').status, 'pending');
});
