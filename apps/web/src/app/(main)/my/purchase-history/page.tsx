'use client';

// 구매내역(260928 사장): 카드 = 빌라드지디 카드 같은 '사진 색 카드'에 사회자 사진(PaymentToneCard),
// 거르기 = 채팅 목록처럼 제목 ⌄ 메뉴(TitleFilterMenu) — 예전 회색 세그먼트 탭 대신.
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth.store';
import { apiClient } from '@/lib/api/client';
import { CalendarIcon } from '@/components/icons/mono';
import { EmptyDocumentIcon } from '@/components/icons/color';
import TitleFilterMenu, { type TitleFilterOption } from '@/components/ui/TitleFilterMenu';
import { QdBackIcon } from '../_components/detail-ui';
import PaymentToneCard, { TossMenuIcon } from '../_components/PaymentToneCard';

type Status = 'all' | 'paid' | 'upcoming' | 'completed' | 'refunded';

interface PurchaseItem {
  id: string;
  proId?: string;
  proName: string;
  service: string;
  amount: number;
  eventDate: string;
  status: string;
  image: string;
  hasReview: boolean;
}

const STATUS_MAP: Record<string, { label: string; dot: string; icon: string }> = {
  paid: { label: '결제완료', dot: '#3182F6', icon: 'pay-card' },
  upcoming: { label: '행사 예정', dot: '#12B76A', icon: 'calendar-check' },
  completed: { label: '행사 완료', dot: '#B0B8C1', icon: 'check-circle' },
  refunded: { label: '환불됨', dot: '#F04452', icon: 'coin' },
};

/** 2026-12-19 → 2026.12.19 (토) */
function prettyDate(ymd: string) {
  const d = new Date(`${ymd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return ymd;
  return `${ymd.replace(/-/g, '.')} (${'일월화수목금토'[d.getDay()]})`;
}

// v2 — 사회자 id·사진을 서버 pro 로 채우기 시작(옛 캐시엔 없다)
const CACHE_KEY = 'freetiful-purchase-cache-v2';

function getCache(): PurchaseItem[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function setCache(data: PurchaseItem[]) {
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

export default function PurchaseHistoryPage() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const [filter, setFilter] = useState<Status>('all');

  // 캐시에서 즉시 표시
  const cached = useMemo(() => getCache(), []);
  const [purchases, setPurchases] = useState<PurchaseItem[] | null>(cached);
  const [isLoading, setIsLoading] = useState(cached === null);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (authUser) {
      apiClient.get('/api/v1/payment', { params: { limit: 50 } })
        .then((res) => {
          // 구매내역 = 실제 결제된 건만. pending(결제창까지만 가고 미완료/취소)·failed 는 제외해야
          // '결제완료' 오표시를 막는다. (결제대기는 마이페이지 '결제/환불내역'에서 확인)
          const data = (res.data?.data || []).filter((p: any) =>
            ['completed', 'escrowed', 'settled', 'refunded'].includes(p.status),
          );
          const mapped: PurchaseItem[] = data.map((p: any) => {
            const q = Array.isArray(p.quotations) ? p.quotations[0] : p.quotation;
            const eventDate = q?.eventDate ? new Date(q.eventDate) : new Date(p.createdAt);
            const now = new Date();
            let status: PurchaseItem['status'];
            if (p.status === 'refunded') status = 'refunded';
            else if (p.status === 'completed') status = eventDate < now ? 'completed' : 'upcoming';
            else status = 'paid'; // escrowed/settled = 결제완료 (pending/failed 는 위에서 제외됨)
            return {
              id: p.id,
              proId: p.pro?.id || p.proProfileId || q?.proProfile?.id || undefined,
              proName: p.pro?.name || q?.proProfile?.user?.name || '',
              service: p.description || q?.title || '결제',
              amount: Number(p.amount ?? 0),
              eventDate: eventDate.toISOString().slice(0, 10),
              status,
              // 서버가 채워 주는 pro.image(대표 사진 → 프로필 사진) 우선
              image: p.pro?.image || q?.proProfile?.images?.[0]?.imageUrl || q?.proProfile?.user?.profileImageUrl || '',
              hasReview: false,
            };
          });
          setPurchases(mapped);
          setCache(mapped);
        })
        .catch(() => { setPurchases([]); })
        .finally(() => setIsLoading(false));
    } else {
      setPurchases([]);
      setIsLoading(false);
    }
  }, [authUser]);

  // 결제 후 진입 시 WKWebView 히스토리에 외부 결제 URL/소비된 페이지가 남아, 뒤로 스와이프하면
  // 그 죽은 페이지로 가서 "페이지를 찾을 수 없습니다"(404)가 났다. 구매내역은 /my 의 하위 페이지이므로
  // 뒤로가기(스와이프)를 가로채 안전한 /my 로 보낸다.
  useEffect(() => {
    window.history.pushState(null, '', window.location.href);
    const onPop = () => { router.replace('/my'); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [router]);

  const all = purchases || [];
  const filtered = all.filter((p) => filter === 'all' || p.status === filter);
  const countOf = (st: Status) => (st === 'all' ? all.length : all.filter((p) => p.status === st).length);
  const options: TitleFilterOption<Status>[] = [
    { key: 'all', label: '전체', title: '구매 내역', icon: <TossMenuIcon name="list" />, count: countOf('all') },
    ...(['paid', 'upcoming', 'completed', 'refunded'] as const).map((st) => ({
      key: st,
      label: STATUS_MAP[st].label,
      title: STATUS_MAP[st].label,
      icon: <TossMenuIcon name={STATUS_MAP[st].icon} />,
      count: countOf(st),
    })),
  ];

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-white pb-10" style={{ letterSpacing: '-0.02em' }}>
      {/* 헤더 — 채팅 목록처럼 제목 ⌄ 를 누르면 거르기 메뉴(260928 사장). iOS 옛 앱은 네이티브 헤더가 덮어 숨김(data-native-back-header) */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-1 bg-white pl-2 pr-4" data-native-back-header>
        <button type="button" onClick={() => router.replace('/my')} aria-label="뒤로가기" className="qd-back">
          <QdBackIcon />
        </button>
        <TitleFilterMenu<Status> value={filter} options={options} onChange={setFilter} enterClassName="qd-a-title" />
      </header>

      {isLoading && !cached ? (
        <Skeleton />
      ) : (
        <div key={filter} className="qd-body space-y-3 px-5 pt-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
              <EmptyDocumentIcon size={64} className="mb-3" />
              <p className="text-[15px] font-bold text-[#2B313D]">{filter === 'all' ? '구매 내역이 없습니다' : `${STATUS_MAP[filter].label} 내역이 없어요`}</p>
              <p className="mt-1.5 text-[13px] text-[#A4ABBA]">사회자를 섭외하면 이곳에서 확인할 수 있어요.</p>
            </div>
          ) : (
            filtered.map((item, i) => {
              const st = STATUS_MAP[item.status] || STATUS_MAP.paid;
              return (
                <PaymentToneCard
                  key={item.id}
                  index={i}
                  href={item.proId ? `/pros/${item.proId}` : undefined}
                  image={item.image}
                  name={item.proName ? `${item.proName} 사회자` : '사회자'}
                  badge={{ label: st.label, dot: st.dot }}
                  meta={[
                    <span key="d" className="inline-flex items-center gap-1"><CalendarIcon size={13} className="shrink-0" />{prettyDate(item.eventDate)}</span>,
                    item.service,
                  ]}
                  rows={[{ label: '결제금액', value: `${item.amount.toLocaleString()}원` }]}
                />
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
