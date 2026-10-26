/**
 * 결제 환불 ↔ 정산 로그(261026). 예전엔 환불해도 정산 로그가 '대기'로 남아, 고객에게 돌려준 돈을 사회자에게 또 정산할 수 있었다.
 *  · 사장 결정: 50% 부분 환불이어도 사회자 정산 없음(남은 50%는 플랫폼 몫 = 위약금) → 환불이면 전액·부분 모두 로그 'cancelled'.
 *  · 사장 결정: 이미 사회자에게 정산(지급)된 결제는 앱에서 바로 환불하지 않는다 → 고객센터(SETTLED_REFUND_BLOCK_MESSAGE).
 *  · 잠금 순서 = 정산 로그 → 결제(정산하기 markSettled 와 같은 순서) — 환불과 정산하기가 같은 순간에 와도 한쪽만 이긴다.
 */
import type { Prisma, PrismaClient } from '@prisma/client';

/** 사회자에게 정산해도 되는 결제 상태 — 돈이 아직 플랫폼에 있는 상태(환불·실패·입금 전 제외) */
export const SETTLEABLE_PAYMENT_STATUSES = ['completed', 'escrowed', 'settled'] as const;
export const isSettleablePayment = (status?: string | null) =>
  !!status && (SETTLEABLE_PAYMENT_STATUSES as readonly string[]).includes(status);

export const SETTLED_REFUND_BLOCK_MESSAGE =
  '이미 사회자 정산이 끝난 예약이라 앱에서 바로 취소할 수 없어요. 고객센터로 문의해 주세요.';

type Tx = Prisma.TransactionClient;

/**
 * 환불된 결제의 정산 로그 취소 — 결제 행을 고치는 같은 트랜잭션 안에서, 결제 행보다 먼저 부른다.
 *  'cancelled' = 대기 로그를 취소(이미 취소였던 것 포함) · 'settled' = 이미 사회자에게 지급됨(부른 쪽이 판단) · 'none' = 로그 없음
 */
export async function cancelSettlementForRefund(tx: Tx, paymentId: string): Promise<'cancelled' | 'settled' | 'none'> {
  const res = await tx.settlementLog.updateMany({ where: { paymentId, status: 'pending' }, data: { status: 'cancelled' } });
  if (res.count > 0) return 'cancelled';
  const log = await tx.settlementLog.findUnique({ where: { paymentId }, select: { status: true } });
  if (!log) return 'none';
  return log.status === 'settled' ? 'settled' : 'cancelled';
}

/** 어드민이 환불 표시를 되돌려 결제를 다시 '완료'로 — 환불 때 취소된 정산 로그를 다시 '대기'로(사회자 몫이 조용히 사라지지 않게) */
export async function restoreSettlementAfterRefundUndo(tx: Tx, paymentId: string) {
  await tx.settlementLog.updateMany({ where: { paymentId, status: 'cancelled' }, data: { status: 'pending' } });
}

class RefundClaimStop extends Error {
  constructor(readonly reason: 'settled' | 'not_completed') {
    super(reason);
  }
}

/**
 * 환불을 DB 에서 먼저 잡는다(PG 취소 전에) — 정산 로그 취소 + 결제 completed→refunded 를 한 트랜잭션으로.
 *  사이에 정산하기가 끝났으면 'settled', 이미 환불됐거나(두 번 누름) 완료 상태가 아니면 'not_completed' — 둘 다 아무것도 안 바뀐다.
 *  그래서 PG 취소는 'ok' 일 때만 부른다(같은 결제를 두 번 부분 취소해 100% 돌려주는 일도 막힌다).
 */
export async function claimRefund(
  prisma: Pick<PrismaClient, '$transaction'>,
  paymentId: string,
  data: { refundAmount: number; refundReason: string; refundedAt: Date },
): Promise<'ok' | 'settled' | 'not_completed'> {
  try {
    await prisma.$transaction(async (tx) => {
      if ((await cancelSettlementForRefund(tx, paymentId)) === 'settled') throw new RefundClaimStop('settled');
      const claimed = await tx.payment.updateMany({ where: { id: paymentId, status: 'completed' }, data: { status: 'refunded', ...data } });
      if (claimed.count === 0) throw new RefundClaimStop('not_completed');
    });
    return 'ok';
  } catch (e) {
    if (e instanceof RefundClaimStop) return e.reason;
    throw e;
  }
}
