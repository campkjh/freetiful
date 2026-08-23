'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';
import { apiClient } from '@/lib/api/client';
import { EmptyDocumentIcon } from '@/components/icons/color';
import { MY_CARD, MyDetailHeader } from '../_components/detail-ui';

interface PaymentItem {
  id: string;
  title: string;
  /** 고객 화면이면 사회자 이름, 사회자 화면이면 고객 이름 */
  proName: string;
  phone?: string;
  amount: number;
  status: string;
  date: string;
  method: string;
  refundAmount?: number;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  completed: { label: '결제완료', color: 'bg-[#E9F8EF] text-[#12B76A]' },
  escrowed: { label: '에스크로', color: 'bg-[#EAF2FF] text-[#3182F6]' },
  refunded: { label: '환불완료', color: 'bg-[#FFF0F0] text-[#E5484D]' },
  pending: { label: '결제대기', color: 'bg-[#FFF6E5] text-[#D98A00]' },
};

const CACHE_KEY = 'freetiful-payment-cache';

function getCache(): PaymentItem[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function setCache(data: PaymentItem[]) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch {}
}

function Skeleton() {
  return (
    <div className="space-y-3 px-4 pt-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[150px] animate-pulse rounded-[24px] bg-[#F7F8FA]" />
      ))}
    </div>
  );
}

export default function PaymentHistoryPage() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);

  const cached = useMemo(() => getCache(), []);
  const [payments, setPayments] = useState<PaymentItem[] | null>(cached);
  const [viewerIsPro, setViewerIsPro] = useState(false);
  const [isLoading, setIsLoading] = useState(cached === null);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (authUser) {
      apiClient.get('/api/v1/payment', { params: { limit: 50 } })
        .then((res) => {
          const data = res.data?.data || [];
          const isPro = res.data?.viewerRole === 'pro';
          setViewerIsPro(isPro);
          // 같은 quotation 에 대해 결제하기를 여러 번 눌러 pending 이 누적된 경우,
          // 하나의 row 로 통합한다 — 상태 우선순위: completed > refunded > escrowed > pending.
          const rankStatus = (s: string) =>
            s === 'completed' ? 4 : s === 'refunded' ? 3 : s === 'escrowed' ? 2 : 1;
          const byQuotation = new Map<string, any>();
          const noQuotation: any[] = [];
          for (const p of data) {
            const qid =
              p.quotationId ||
              (Array.isArray(p.quotations) ? p.quotations[0]?.id : p.quotation?.id);
            if (!qid) { noQuotation.push(p); continue; }
            const existing = byQuotation.get(qid);
            if (!existing || rankStatus(p.status) > rankStatus(existing.status)) {
              byQuotation.set(qid, p);
            }
          }
          const merged = [...byQuotation.values(), ...noQuotation]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          const mapped: PaymentItem[] = merged.map((p: any) => {
            const q = Array.isArray(p.quotations) ? p.quotations[0] : p.quotation;
            return {
              id: p.id,
              title: p.description || q?.title || '결제',
              // 사회자 계정이면 서버가 customer 를 실어준다 → 고객 이름을 보여준다
              proName: isPro
                ? (p.customer?.name || '고객')
                : (q?.proProfile?.user?.name || ''),
              phone: isPro ? (p.customerPhone || undefined) : undefined,
              amount: Number(p.amount ?? 0),
              status: p.status,
              date: new Date(p.createdAt).toLocaleDateString('ko-KR'),
              method: p.paymentMethod || '',
              refundAmount: p.refundAmount ? Number(p.refundAmount) : undefined,
            };
          });
          setPayments(mapped);
          setCache(mapped);
        })
        .catch(() => { setPayments([]); })
        .finally(() => setIsLoading(false));
    } else {
      setPayments([]);
      setIsLoading(false);
    }
  }, [authUser]);

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-white pb-10" style={{ letterSpacing: '-0.02em' }}>
      <MyDetailHeader title={viewerIsPro ? '고객 결제 내역' : '결제/환불 내역'} onBack={() => router.back()} />

      {isLoading && !cached ? (
        <Skeleton />
      ) : (
        <div className="space-y-3 px-4 pt-2">
          {!payments || payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
              <EmptyDocumentIcon size={64} className="mb-3" />
              <p className="text-[15px] font-bold text-[#2B313D]">결제 내역이 없습니다</p>
              <p className="mt-1.5 text-[13px] text-[#A4ABBA]">결제가 완료되면 이곳에서 확인할 수 있어요.</p>
            </div>
          ) : payments.map((p) => {
            const status = STATUS_MAP[p.status] || STATUS_MAP.pending;
            return (
              <div key={p.id} className={`${MY_CARD} space-y-2 p-5`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-[#A4ABBA]">{p.date}</span>
                  <span className={`shrink-0 rounded-full px-2.5 py-[5px] text-[11.5px] font-bold ${status.color}`}>
                    {status.label}
                  </span>
                </div>
                <p className="text-[15px] font-bold text-[#2B313D]">{p.title}</p>
                <p className="text-[13px] font-medium text-[#8B95A1]">
                  {viewerIsPro ? `고객 ${p.proName}` : p.proName}
                  {p.method ? ` · ${p.method}` : ''}
                </p>
                {viewerIsPro && p.phone && (
                  <a href={`tel:${p.phone}`} className="block text-[13px] font-bold text-[#3180F7]">
                    {p.phone.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3')}
                  </a>
                )}
                <div className="flex items-center justify-between border-t border-[#F5F6F8] pt-3">
                  <span className="text-[13px] text-[#8B95A1]">{viewerIsPro ? '고객 결제금액' : '결제금액'}</span>
                  <span className="text-[17px] font-bold tabular-nums text-[#2B313D]">
                    {p.amount.toLocaleString()}원
                  </span>
                </div>
                {p.refundAmount && (
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[#E5484D]">환불금액</span>
                    <span className="text-[15px] font-bold tabular-nums text-[#E5484D]">
                      {p.refundAmount.toLocaleString()}원
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
