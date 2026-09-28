'use client';

// 결제/환불내역(260928 사장 '구매내역과 동일하게'): 사진 색 카드(PaymentToneCard) + 제목 ⌄ 거르기(TitleFilterMenu).
// 고객 화면 = 사회자 사진·이름, 사회자 화면(받은 결제) = 고객 사진·이름·연락처.
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';
import { apiClient } from '@/lib/api/client';
import { EmptyDocumentIcon } from '@/components/icons/color';
import TitleFilterMenu, { type TitleFilterOption } from '@/components/ui/TitleFilterMenu';
import { QdBackIcon } from '../_components/detail-ui';
import PaymentToneCard, { TossMenuIcon, type PaymentToneRow } from '../_components/PaymentToneCard';

type Filter = 'all' | 'paid' | 'waiting' | 'refunded';

interface PaymentItem {
  id: string;
  title: string;
  /** 카드 사진 — 고객 화면이면 사회자, 사회자 화면이면 고객 */
  image?: string;
  proId?: string;
  /** 고객 화면이면 사회자 이름, 사회자 화면이면 고객 이름 */
  proName: string;
  phone?: string;
  amount: number;
  status: string;
  date: string;
  method: string;
  refundAmount?: number;
}

/** 결제 상태 → 배지·거르기 묶음 */
function statusInfo(status: string, viewerIsPro: boolean): { label: string; dot: string; group: Filter | null } {
  switch (status) {
    case 'completed':
    case 'escrowed':
      return { label: '결제완료', dot: '#3182F6', group: 'paid' };
    case 'settled':
      return { label: viewerIsPro ? '정산완료' : '결제완료', dot: '#3182F6', group: 'paid' };
    case 'refunded':
      return { label: '환불완료', dot: '#F04452', group: 'refunded' };
    case 'waiting_for_deposit':
      return { label: '입금대기', dot: '#FFB020', group: 'waiting' };
    case 'failed':
      return { label: '결제실패', dot: '#B0B8C1', group: null };
    default:
      return { label: '결제대기', dot: '#FFB020', group: 'waiting' };
  }
}

const FILTER_META: Record<Exclude<Filter, 'all'>, { label: string; icon: string }> = {
  paid: { label: '결제완료', icon: 'pay-card' },
  waiting: { label: '결제대기', icon: 'clock' },
  refunded: { label: '환불', icon: 'coin' },
};

// v2 — 사진·사회자 id 를 담기 시작(옛 캐시엔 없다)
const CACHE_KEY = 'freetiful-payment-cache-v2';

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
    <div className="space-y-3 px-5 pt-2">
      {[0, 1].map((i) => (
        <div key={i} className="animate-pulse overflow-hidden rounded-[20px] bg-[#F7F8FA]">
          <div className="w-full bg-[#F2F4F6]" style={{ aspectRatio: '16 / 9' }} />
          <div className="h-[118px]" />
        </div>
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
  const [filter, setFilter] = useState<Filter>('all');

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
              image: isPro
                ? (p.customer?.profileImageUrl || undefined)
                : (p.pro?.image || q?.proProfile?.images?.[0]?.imageUrl || q?.proProfile?.user?.profileImageUrl || undefined),
              proId: isPro ? undefined : (p.pro?.id || p.proProfileId || q?.proProfile?.id || undefined),
              // 사회자 계정이면 서버가 customer 를 실어준다 → 고객 이름을 보여준다
              proName: isPro
                ? (p.customer?.name || '고객')
                : (p.pro?.name || q?.proProfile?.user?.name || ''),
              phone: isPro ? (p.customerPhone || undefined) : undefined,
              amount: Number(p.amount ?? 0),
              status: p.status,
              date: new Date(p.createdAt).toLocaleDateString('ko-KR'),
              // 결제 수단 — 서버 Payment.method(토스가 준 '카드'·'가상계좌'·간편결제 이름). 예전엔 없는 paymentMethod 를 읽어 늘 비었다
              method: p.method || '',
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

  const all = payments || [];
  const filtered = all.filter((p) => filter === 'all' || statusInfo(p.status, viewerIsPro).group === filter);
  const countOf = (f: Filter) => (f === 'all' ? all.length : all.filter((p) => statusInfo(p.status, viewerIsPro).group === f).length);
  // 사회자 화면(받은 결제)은 입금 전 건이 서버에서 빠져 '결제대기'가 없다
  const filterKeys: Exclude<Filter, 'all'>[] = viewerIsPro ? ['paid', 'refunded'] : ['paid', 'waiting', 'refunded'];
  const options: TitleFilterOption<Filter>[] = [
    { key: 'all', label: '전체', title: viewerIsPro ? '고객 결제 내역' : '결제/환불 내역', icon: <TossMenuIcon name="list" />, count: countOf('all') },
    ...filterKeys.map((f) => ({ key: f, label: FILTER_META[f].label, title: `${FILTER_META[f].label} 내역`, icon: <TossMenuIcon name={FILTER_META[f].icon} />, count: countOf(f) })),
  ];

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-white pb-10" style={{ letterSpacing: '-0.02em' }}>
      {/* 헤더 — 채팅 목록처럼 제목 ⌄ 거르기(260928 사장). iOS 옛 앱은 네이티브 헤더가 덮어 숨김 */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-1 bg-white pl-2 pr-4" data-native-back-header>
        <button type="button" onClick={() => router.back()} aria-label="뒤로가기" className="qd-back">
          <QdBackIcon />
        </button>
        <TitleFilterMenu<Filter> value={filter} options={options} onChange={setFilter} enterClassName="qd-a-title" />
      </header>

      {isLoading && !cached ? (
        <Skeleton />
      ) : (
        <div key={filter} className="qd-body space-y-3 px-5 pt-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
              <EmptyDocumentIcon size={64} className="mb-3" />
              <p className="text-[15px] font-bold text-[#2B313D]">{filter === 'all' ? '결제 내역이 없습니다' : `${FILTER_META[filter].label} 내역이 없어요`}</p>
              <p className="mt-1.5 text-[13px] text-[#A4ABBA]">결제가 완료되면 이곳에서 확인할 수 있어요.</p>
            </div>
          ) : filtered.map((p, i) => {
            const st = statusInfo(p.status, viewerIsPro);
            const rows: PaymentToneRow[] = [{ label: viewerIsPro ? '고객 결제금액' : '결제금액', value: `${p.amount.toLocaleString()}원` }];
            if (p.refundAmount) rows.push({ label: '환불금액', value: `${p.refundAmount.toLocaleString()}원`, tone: 'danger' });
            return (
              <PaymentToneCard
                key={p.id}
                index={i}
                href={p.proId ? `/pros/${p.proId}` : undefined}
                image={p.image}
                name={viewerIsPro ? `고객 ${p.proName}` : (p.proName ? `${p.proName} 사회자` : p.title)}
                badge={{ label: st.label, dot: st.dot }}
                meta={[p.date, ...(p.method ? [p.method] : []), p.title]}
                rows={rows}
                footer={viewerIsPro && p.phone ? (
                  <a href={`tel:${p.phone}`} className="mt-3 flex h-11 items-center justify-center rounded-[12px] bg-white/70 text-[14px] font-bold text-[#3182F6] active:scale-[0.99]">
                    {p.phone.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3')} 전화하기
                  </a>
                ) : undefined}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
