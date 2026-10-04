import { Prisma } from '@prisma/client';

/**
 * 결제 한 건이 '어떤 행사'였는지 — 어드민 정산 내역·결제 조회가 같이 쓴다
 * (261004 사장 '사회자가 어디서 어떤 고객과 행사를 했는지' · '결제조회도 정산내역이랑 동일하게').
 * 견적에 적힌 일시·장소가 먼저, 비어 있으면 그 채팅방의 매칭 요청(퀵매칭·견적 요청)에서 채운다.
 */
export const PAYMENT_EVENT_QUOTATION_SELECT = {
  title: true,
  eventDate: true,
  eventTime: true,
  eventLocation: true,
  chatRoom: {
    select: {
      matchRequest: {
        select: {
          eventDate: true,
          eventTime: true,
          eventLocation: true,
          rawUserInput: true,
          eventCategory: { select: { name: true } },
          category: { select: { name: true } },
        },
      },
    },
  },
} satisfies Prisma.QuotationSelect;

export type PaymentEventQuotation = Prisma.QuotationGetPayload<{ select: typeof PAYMENT_EVENT_QUOTATION_SELECT }>;

export type PaymentEvent = { title: string | null; kind: string | null; date: string | null; time: string | null; location: string | null };

// @db.Time 은 1970-01-01T HH:MM(UTC) 로 온다 → 'HH:MM'
const hhmm = (t?: Date | null) => (t ? `${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}` : null);
const ymd = (d?: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export function paymentEventOf(q?: PaymentEventQuotation | null): PaymentEvent {
  const mr = q?.chatRoom?.matchRequest;
  const raw = (mr?.rawUserInput && typeof mr.rawUserInput === 'object' ? mr.rawUserInput : {}) as Record<string, any>;
  const rawPlace = [raw.region, raw.venue].filter((v) => typeof v === 'string' && v.trim()).join(' ').trim();
  return {
    title: q?.title || null,
    kind: mr?.eventCategory?.name || mr?.category?.name || null,
    date: ymd(q?.eventDate || mr?.eventDate),
    time: hhmm(q?.eventTime || mr?.eventTime),
    location: q?.eventLocation || mr?.eventLocation || rawPlace || null,
  };
}
