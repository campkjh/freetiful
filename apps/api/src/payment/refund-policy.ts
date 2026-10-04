/**
 * 「플랫폼 환불 규정」 제1조 — 실제 환불(PaymentService.cancelPayment)과 어드민 결제 조회(환불 가능 기간 표시)가 같이 쓴다.
 * 규칙을 바꾸면 두 곳이 함께 바뀐다(어드민이 고객에게 엉뚱한 환불 가능 여부를 안내하지 않도록 한 곳에만 둔다).
 *  · 입금일(결제 완료일, 예약 당일 포함 = 1일째) 기준: 4일 이내 100% · 5~7일 이내 50% · 7일 경과 환불 불가
 *  · 서비스 공급일(행사일)이 입금일로부터 7일 이내(예약 당일 포함)면 환불 불가
 *  · 사전미팅 뒤 불가는 시스템이 모른다 → 고객센터
 *  · 입금일 = 결제 완료 시각. 가상계좌는 입금 확인 때 completed 로 바뀐 시각(updatedAt), 그 밖에는 결제를 만든 시각.
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** KST 달력 날짜 번호(1970-01-01 = 0) */
export const kstDay = (d: Date) => Math.floor((d.getTime() + KST_OFFSET_MS) / DAY_MS);
/** KST 날짜 번호 → 'YYYY-MM-DD' */
export const kstDayToYmd = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);

export const REFUND_FULL_DAYS = 4;
export const REFUND_LAST_DAY = 7;

export function paymentPaidAt(p: { method?: string | null; createdAt: Date; updatedAt: Date }): Date {
  return p.method === '가상계좌' ? p.updatedAt : p.createdAt;
}

export type RefundVerdict =
  | { ok: true; day: number; rate: 100 | 50; until: string }
  | { ok: false; day: number; reason: 'event_within_7' | 'expired' };

/** day = 입금일로부터 며칠째(입금 당일 = 1). until = 지금 비율로 환불받을 수 있는 마지막 날(KST) */
export function refundVerdict(paidAt: Date, eventDate: Date | null, now: Date = new Date()): RefundVerdict {
  const paidDay = kstDay(paidAt);
  const day = kstDay(now) - paidDay + 1;
  if (eventDate && kstDay(eventDate) - paidDay + 1 <= REFUND_LAST_DAY) return { ok: false, day, reason: 'event_within_7' };
  if (day > REFUND_LAST_DAY) return { ok: false, day, reason: 'expired' };
  const rate = day <= REFUND_FULL_DAYS ? 100 : 50;
  return { ok: true, day, rate, until: kstDayToYmd(paidDay + (rate === 100 ? REFUND_FULL_DAYS : REFUND_LAST_DAY) - 1) };
}

export const REFUND_BLOCK_MESSAGE: Record<'event_within_7' | 'expired', string> = {
  event_within_7: '행사일이 입금일로부터 7일 이내인 예약은 환불 규정에 따라 예약금 환불이 어려워요. 고객센터로 문의해 주세요.',
  expired: '입금일로부터 7일이 지나 환불 규정에 따라 예약금 환불이 어려워요. 고객센터로 문의해 주세요.',
};
