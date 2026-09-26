'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LayoutGroup, motion } from 'framer-motion';
import { ChevronRightIcon, CalendarIcon, PinLocationIcon } from '@/components/icons/mono';
import { EmptyDocumentIcon, DocumentColorIcon, PendingIcon, RepliedIcon, DoneIcon, DeclinedIcon } from '@/components/icons/color';
import toast from 'react-hot-toast';
import { matchApi } from '@/lib/api/match.api';
import { useAuthStore } from '@/lib/store/auth.store';
import { getProfileImageUrl } from '@/lib/default-profile';
import { useEntranceWindow, useListEntrance, useTabEntrance } from '@/lib/hooks/useTabEntrance';

type InquiryStatus = '요청중' | '요청승인' | '거래완료' | '거절';

type InquiryCard = {
  id: string;
  requestId: string;
  roomId?: string;
  proName: string;
  proImage?: string | null;
  category: string;
  location: string;
  eventDate: string;
  eventTime: string;
  createdAt: string;
  /** 화면 표기용 createdAt 과 별개로, 오래된 '요청중'을 걸러내기 위한 원본 시각 */
  createdAtIso?: string;
  status: InquiryStatus;
  declineReason?: string;
};

const CUSTOMER_INQUIRIES_CACHE_PREFIX = 'freetiful-customer-inquiries-cache-v1';
const CUSTOMER_INQUIRIES_CACHE_TTL = 10 * 60_000;
let memoryCustomerInquiriesCache: { userId?: string | null; ts: number; data: any[] } | null = null;

function getCustomerInquiriesCacheKey(userId?: string | null) {
  return `${CUSTOMER_INQUIRIES_CACHE_PREFIX}:${userId || 'anonymous'}`;
}

function readCustomerInquiriesCache(userId?: string | null) {
  if (memoryCustomerInquiriesCache && memoryCustomerInquiriesCache.userId === userId && Date.now() - memoryCustomerInquiriesCache.ts < CUSTOMER_INQUIRIES_CACHE_TTL) {
    return memoryCustomerInquiriesCache.data;
  }
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(getCustomerInquiriesCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || Date.now() - parsed.ts > CUSTOMER_INQUIRIES_CACHE_TTL) return null;
    if (parsed.userId !== userId) return null;
    const data = Array.isArray(parsed.data) ? parsed.data : [];
    memoryCustomerInquiriesCache = { userId, ts: parsed.ts, data };
    return data;
  } catch {
    return null;
  }
}

function writeCustomerInquiriesCache(userId: string | undefined | null, data: any[]) {
  const normalized = Array.isArray(data) ? data : [];
  memoryCustomerInquiriesCache = { userId, ts: Date.now(), data: normalized };
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getCustomerInquiriesCacheKey(userId), JSON.stringify({ userId, ts: Date.now(), data: normalized }));
  } catch {}
}

// 행사일: @db.Date(UTC 자정 직렬화) → 기기 타임존과 무관하게 저장된 날짜 그대로(UTC).
// 표기는 채팅방 일정과 같은 '26년 12월 13일 (일)'(연도 앞 20 뺌) — toLocaleDateString 은 '2026년 12월 13일 일'처럼 요일이 붙어 어색했다
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
function formatEventDate(value?: string | null) {
  if (!value) return '일자 미정';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '일자 미정';
  const yy = String(date.getUTCFullYear()).slice(2);
  return `${yy}년 ${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일 (${WEEKDAYS[date.getUTCDay()]})`;
}

// 신청일(createdAt): 진짜 타임스탬프 → KST 고정 (안드 웹뷰 UTC 타임존 대응)
function formatDate(value?: string | null) {
  if (!value) return '일자 미정';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '일자 미정';
  return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' });
}

// 행사 시간: @db.Time(naive, "1970-01-01T13:00:00Z" 직렬화) → 기기 타임존 변환 없이 저장된 리터럴 그대로
function formatTime(value?: string | null) {
  if (!value) return '시간 미정';
  const iso = value.includes('T') ? value.match(/T(\d{2}:\d{2})/)?.[1] : null;
  const time = iso || (value.includes('T') ? '' : value.slice(0, 5));
  return time || '시간 미정';
}

// 웨딩숲 배지 색(.tcard-badge tone-*)과 같은 값
function getStatusTone(status: InquiryStatus) {
  if (status === '거래완료') return 'bg-[#E6F7EE] text-[#03A94D]';
  if (status === '요청승인') return 'bg-[#E8F3FF] text-[#3182F6]';
  if (status === '거절') return 'bg-[#FFEEEF] text-[#F04452]';
  return 'bg-[#F2F4F6] text-[#6B7684]';
}

/** 진행 현황 목록에 쓰는 컬러 아이콘 — 상태색이 아이콘 자체에 들어 있다 */
function getStatusColorIcon(status: InquiryStatus) {
  if (status === '거래완료') return DoneIcon;
  if (status === '요청승인') return RepliedIcon;
  if (status === '거절') return DeclinedIcon;
  return PendingIcon;
}

/** 한 요청(행사)과 그 요청을 받은 사회자들 — 화면 계층: 행사 정보 한 번 → 아래에 사회자별 진행 상태 */
type InquiryGroup = {
  requestId: string;
  category: string;
  location: string;
  eventDate: string;
  eventTime: string;
  createdAt: string;
  cards: InquiryCard[];
};

/** 행사 머리 타일의 일러스트 — 홈 카테고리 칸과 같은 그림(연회색 둥근 타일 위) */
function categoryIllust(category: string) {
  const c = (category || '').replace(/\s/g, '');
  if (/외국어|통역|번역|영어/.test(c)) return '/images/category-icons/foreign-mc.png';
  if (/행사|기업|체육|돌잔치|컨퍼런스|세미나|송년|워크숍/.test(c)) return '/images/category-icons/event-mc-icon.png';
  return '/images/category-icons/wedding-mc-icon.png';
}

/** 사회자별 진행 상태 태그 — 웨딩숲 배지 모양(h24 · 모서리 6 · 13.5), 상태색 */
function StatusTag({ status }: { status: InquiryStatus }) {
  return (
    <span className={`inline-flex h-6 shrink-0 items-center rounded-[6px] px-[7px] text-[13.5px] font-semibold tracking-[-0.2px] ${getStatusTone(status)}`}>
      {status}
    </span>
  );
}

/** 상태 필터 탭 — '전체' 는 개수 합계 */
const STATUS_TABS: (InquiryStatus | '전체')[] = ['전체', '요청중', '요청승인', '거래완료', '거절'];

function buildCards(requests: any[]): InquiryCard[] {
  return requests.flatMap((request) => {
    const rooms = Array.isArray(request.chatRooms) ? request.chatRooms : [];
    const deliveries = Array.isArray(request.deliveries) ? request.deliveries : [];
    const base = {
      requestId: request.id,
      category: request.eventCategory?.name || request.category?.name || '사회자 문의',
      location: request.eventLocation || '장소 미정',
      eventDate: formatEventDate(request.eventDate),
      eventTime: formatTime(request.eventTime),
      createdAt: formatDate(request.createdAt),
      createdAtIso: request.createdAt,
    };

    const deliveryCards = deliveries.map((delivery: any) => {
      const room = rooms.find((item: any) => item.proProfileId === delivery.proProfileId);
      const latestQuotation = Array.isArray(room?.quotations) ? room.quotations[0] : null;
      const paid = latestQuotation?.payment?.status === 'completed' || latestQuotation?.status === 'paid';
      const approved = Boolean(room?.id) || delivery.status === 'replied';
      const declined = delivery.status === 'declined';
      const proProfile = delivery.proProfile || room?.proProfile;
      const proUser = proProfile?.user;
      const proImage = proProfile?.images?.[0]?.imageUrl || proUser?.profileImageUrl || null;
      return {
        ...base,
        id: delivery.id,
        roomId: room?.id,
        proName: proUser?.name || '사회자',
        proImage,
        status: paid ? '거래완료' : approved ? '요청승인' : declined ? '거절' : '요청중',
        declineReason: declined ? (delivery.declineReason || undefined) : undefined,
      } as InquiryCard;
    });

    if (deliveryCards.length > 0) return deliveryCards;

    const room = rooms[0];
    const latestQuotation = Array.isArray(room?.quotations) ? room.quotations[0] : null;
    const paid = latestQuotation?.payment?.status === 'completed' || latestQuotation?.status === 'paid';
    const proUser = room?.proProfile?.user;
    return [{
      ...base,
      id: request.id,
      roomId: room?.id,
      proName: proUser?.name || '사회자',
      proImage: room?.proProfile?.images?.[0]?.imageUrl || proUser?.profileImageUrl || null,
      status: paid ? '거래완료' : room?.id ? '요청승인' : '요청중',
    } as InquiryCard];
  });
}

/**
 * 사회자가 일주일이 지나도록 답이 없는 '요청중'은 목록에서 내린다.
 * 승인·거래완료·거절은 결과가 남아야 하므로 기간과 무관하게 유지한다.
 */
const PENDING_VISIBLE_DAYS = 7;
function isFreshEnough(card: InquiryCard) {
  if (card.status !== '요청중') return true;
  const at = card.createdAtIso ? new Date(card.createdAtIso).getTime() : NaN;
  if (!Number.isFinite(at)) return true; // 시각을 모르면 숨기지 않는다
  return Date.now() - at < PENDING_VISIBLE_DAYS * 24 * 60 * 60 * 1000;
}

const ARCHIVED_INQUIRIES_KEY = 'freetiful_archived_inquiries';
function readArchivedInquiryIds(): string[] {
  if (typeof window === 'undefined') return [];
  try { const raw = localStorage.getItem(ARCHIVED_INQUIRIES_KEY); const arr = raw ? JSON.parse(raw) : []; return Array.isArray(arr) ? arr : []; } catch { return []; }
}
function writeArchivedInquiryIds(ids: string[]) {
  try { localStorage.setItem(ARCHIVED_INQUIRIES_KEY, JSON.stringify(ids.slice(0, 500))); } catch {}
}

export default function CustomerInquiriesPage() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const initialCachedRequests = readCustomerInquiriesCache(authUser?.id);
  // 요청 단위 페이지네이션(초기 4요청) — 스크롤 시 다음 페이지를 추가 로드
  const REQUEST_PAGE = 4;
  const [requests, setRequests] = useState<any[]>(() => (initialCachedRequests || []).slice(0, REQUEST_PAGE));
  const [loading, setLoading] = useState(() => !initialCachedRequests);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const requestSkipRef = useRef(0);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cached = readCustomerInquiriesCache(authUser?.id);
    if (cached) {
      setRequests(cached.slice(0, REQUEST_PAGE));
      setLoading(false);
    } else {
      setLoading(true);
    }
    requestSkipRef.current = 0;
    seenIdsRef.current = new Set();
    setHasMore(true);
    matchApi.getMyRequests({ skip: 0, take: REQUEST_PAGE })
      .then((data) => {
        if (cancelled) return;
        const page = Array.isArray(data) ? data : [];
        seenIdsRef.current = new Set(page.map((r: any) => r?.id));
        setRequests(page);
        requestSkipRef.current = page.length;
        setHasMore(page.length >= REQUEST_PAGE);
        writeCustomerInquiriesCache(authUser?.id, page);
      })
      .catch(() => {
        if (!cancelled) toast.error('매칭 목록을 불러오지 못했습니다');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [authUser?.id]);

  const fetchMoreRequests = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    matchApi.getMyRequests({ skip: requestSkipRef.current, take: REQUEST_PAGE })
      .then((data) => {
        const page = Array.isArray(data) ? data : [];
        requestSkipRef.current += page.length;
        // 중복 아닌 새 요청만 추가 — 백엔드가 skip을 무시해 같은 페이지를 줘도 무한루프 방지
        const fresh = page.filter((r: any) => r && !seenIdsRef.current.has(r.id));
        if (fresh.length === 0 || page.length < REQUEST_PAGE) setHasMore(false);
        if (fresh.length > 0) {
          fresh.forEach((r: any) => seenIdsRef.current.add(r.id));
          setRequests((prev) => [...prev, ...fresh]);
        }
      })
      .catch(() => setHasMore(false))
      .finally(() => setLoadingMore(false));
  }, [loadingMore, hasMore]);

  const cards = useMemo(() => buildCards(requests).filter(isFreshEnough), [requests]);

  const [statusTab, setStatusTab] = useState<InquiryStatus | '전체'>('전체');
  const [archivedIds, setArchivedIds] = useState<Set<string>>(() => new Set(readArchivedInquiryIds()));
  const activeCards = useMemo(() => cards.filter((c) => !archivedIds.has(c.id)), [cards, archivedIds]);
  const archivedCards = useMemo(() => cards.filter((c) => archivedIds.has(c.id)), [cards, archivedIds]);

  // 네이티브 고객 문의목록 브리지
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mapCard = (c: InquiryCard) => ({
      id: c.id,
      proName: c.proName,
      proImage: getProfileImageUrl(c.proImage, c.proName),
      status: c.status,
      category: c.category,
      date: c.createdAt || '',
      location: c.location || '',
      declineReason: c.declineReason || '',
      link: c.roomId ? `/chat/${c.roomId}` : '',
      hasRoom: Boolean(c.roomId),
    });
    const post = () => {
      (window as any).webkit?.messageHandlers?.nativeCustomerInquiries?.postMessage({
        active: activeCards.map(mapCard),
        archived: archivedCards.map(mapCard),
      });
    };
    (window as any).__freetifulInquiries = {
      post,
      invokeArchive: (id: string) => {
        setArchivedIds((prev) => { const next = new Set(prev); next.add(id); writeArchivedInquiryIds([...next]); return next; });
      },
      invokeUnarchive: (id: string) => {
        setArchivedIds((prev) => { const next = new Set(prev); next.delete(id); writeArchivedInquiryIds([...next]); return next; });
      },
    };
    post();
    return () => { try { delete (window as any).__freetifulInquiries; } catch {} };
  }, [activeCards, archivedCards]);

  // 바닥 도달 시 다음 요청 페이지 fetch
  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && hasMore && !loadingMore) {
        fetchMoreRequests();
      }
    }, { rootMargin: '200px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, fetchMoreRequests]);

  const statusCounts = useMemo(() => {
    const base: Record<string, number> = { 전체: cards.length, 요청중: 0, 요청승인: 0, 거래완료: 0, 거절: 0 };
    cards.forEach((c) => { base[c.status] = (base[c.status] || 0) + 1; });
    return base;
  }, [cards]);

  const visibleCards = useMemo(
    () => (statusTab === '전체' ? cards : cards.filter((c) => c.status === statusTab)),
    [cards, statusTab],
  );

  const openInquiry = (item: InquiryCard) => {
    if (item.roomId) {
      router.push(`/chat/${item.roomId}`);
      return;
    }
    toast('사회자가 문의를 승인하면 채팅방이 열립니다');
  };

  // 요청(행사) 단위로 묶는다 — 같은 행사 정보를 사회자마다 반복하지 않게(보낸 순서 유지)
  const groups = useMemo<InquiryGroup[]>(() => {
    const map = new Map<string, InquiryGroup>();
    for (const c of visibleCards) {
      let g = map.get(c.requestId);
      if (!g) {
        g = { requestId: c.requestId, category: c.category, location: c.location, eventDate: c.eventDate, eventTime: c.eventTime, createdAt: c.createdAt, cards: [] };
        map.set(c.requestId, g);
      }
      g.cards.push(c);
    }
    return [...map.values()];
  }, [visibleCards]);

  // 처음 들어올 때 퀵매칭 등장(제목↑·탭↑·행사 칸 ←) — 뒤로가기·30초 안 재진입은 생략(새요청·웨딩숲·채팅·마이와 같은 규칙)
  const entrance = useTabEntrance('matching');
  const enterStyle = useListEntrance(groups.map((g) => g.requestId), entrance);
  const enterWindow = useEntranceWindow(entrance);
  // 목록 통째 올라오는 효과는 상태 탭을 바꿨을 때만(첫 진입은 칸별 등장이 대신한다)
  const [tabSwitched, setTabSwitched] = useState(false);

  // 스크롤하면 머리줄 아래로 흰 그라데이션(채팅 목록과 같은 결)
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // 상태 탭 — 회색 트랙 위로 흰 알약이 미끄러진다(채팅 탭과 같은 모양). 개수가 0인 상태는 숨긴다
  const statusTabs = (
    <LayoutGroup id="inquiry-status-tabs">
      <div className={`scrollbar-hide flex gap-1 overflow-x-auto rounded-2xl bg-[#F2F3F5] p-1 ${entrance ? 'qd-a-sub' : ''}`}>
        {STATUS_TABS.map((tab) => {
          const on = statusTab === tab;
          const count = statusCounts[tab] || 0;
          if (tab !== '전체' && count === 0) return null;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => { setStatusTab(tab); setTabSwitched(true); }}
              className={`relative flex shrink-0 flex-1 items-center justify-center gap-1 rounded-[13px] px-3 py-2 text-[13px] transition-colors ${
                on ? 'font-bold text-[#191F28]' : 'font-semibold text-[#8B95A1]'
              }`}
            >
              {on && (
                <motion.span
                  layoutId="inquiry-status-pill"
                  className="absolute inset-0 rounded-[13px] bg-white shadow-sm"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative whitespace-nowrap">{tab}</span>
              <span className={`relative text-[12px] tabular-nums ${on ? 'text-[#3182F6]' : 'text-[#B0B8C1]'}`}>{count}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );

  return (
    <div className="min-h-screen bg-white pb-28 lg:pb-6">
      {/* 모바일 머리줄 — 채팅·웨딩숲과 같은 결(흰 바탕·제목 20·오른쪽 동작 하나), 상태 탭까지 같이 붙어 다닌다 */}
      <header className="sticky top-0 z-20 bg-white px-4 pb-2 lg:hidden">
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 top-full h-6 bg-gradient-to-b from-white via-white/70 to-white/0 transition-opacity duration-300 ${
            scrolled ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <div className="flex h-14 items-center justify-between">
          <h1 className={`text-[20px] font-bold text-[#191F28] ${entrance ? 'qd-a-title' : ''}`}>매칭</h1>
          <Link
            href="/pros"
            className="flex h-9 items-center gap-1 rounded-full bg-[#F2F4F6] pl-3 pr-2.5 text-[13px] font-semibold text-[#4E5968] transition-transform active:scale-95"
          >
            사회자 찾기
            <ChevronRightIcon size={14} className="text-[#8B95A1]" />
          </Link>
        </div>
        {cards.length > 0 && statusTabs}
      </header>

      <div className="mx-auto grid max-w-[1120px] items-start gap-8 lg:grid-cols-[1fr_340px] lg:pt-8">
        <div className="min-w-0">
          {/* PC 타이틀 */}
          <div className="mb-5 hidden lg:block">
            <h1 className={`text-[26px] font-bold tracking-tight text-[#191F28] ${entrance ? 'qd-a-title' : ''}`}>매칭</h1>
            <p className="mt-1 text-[14px] text-[#8B95A1]">보낸 문의와 사회자별 진행 상태를 한눈에 확인하세요</p>
          </div>
          {cards.length > 0 && <div className="sticky top-[72px] z-10 hidden bg-white py-3 lg:block">{statusTabs}</div>}

          {loading ? (
            <div className="space-y-7 px-4 pt-5 lg:px-0">
              {[0, 1, 2].map((item) => (
                <div key={item} className="flex animate-pulse gap-2.5">
                  <div className="h-[42px] w-[42px] shrink-0 rounded-[14px] bg-[#F2F4F6]" />
                  <div className="flex-1 space-y-2.5 pt-1">
                    <div className="h-4 w-1/4 rounded bg-[#F2F4F6]" />
                    <div className="h-3.5 w-2/5 rounded bg-[#F2F4F6]" />
                    <div className="h-4 w-3/4 rounded bg-[#F2F4F6]" />
                    <div className="h-[60px] rounded-[16px] bg-[#F9FAFB]" />
                  </div>
                </div>
              ))}
            </div>
          ) : cards.length === 0 ? (
            <div
              className={`flex min-h-[46vh] flex-col items-center justify-center px-6 py-16 text-center ${enterWindow ? 'qd-a-item' : ''}`}
              style={enterWindow ? { animationDelay: '.3s' } : undefined}
            >
              <EmptyDocumentIcon size={72} className="mb-4" />
              <p className="text-[17px] font-bold text-[#191F28]">아직 문의한 사회자가 없어요</p>
              <p className="mt-2 text-[14px] leading-6 text-[#8B95A1]">마음에 드는 사회자에게 문의를 보내면 이곳에서 진행 상태를 볼 수 있어요.</p>
              <Link
                href="/pros"
                className="mt-5 flex h-11 items-center justify-center rounded-[14px] bg-[#3182F6] px-6 text-[14px] font-bold text-white transition-colors hover:bg-[#2272EB] active:scale-[0.98]"
              >
                사회자 둘러보기
              </Link>
            </div>
          ) : groups.length === 0 ? (
            <div className="px-6 py-24 text-center text-[13px] text-[#8B95A1]">
              {statusTab} 상태인 문의가 없어요
            </div>
          ) : (
            <div key={statusTab} style={tabSwitched ? { animation: 'proPageExpand 0.34s cubic-bezier(0.16, 1, 0.3, 1) both' } : undefined}>
              {groups.map((g) => (
                // 웨딩숲 글 카드(.tcard)와 같은 계층 — 왼쪽 그림 칸 · 오른쪽 제목(16 굵게)/신청일(14 회색)/본문(16.5)/사회자 줄(댓글 계층)
                <section
                  key={g.requestId}
                  className="flex gap-2.5 border-b border-[#F2F4F6] px-4 pb-4 pt-[18px] last:border-b-0 min-[601px]:gap-3 min-[601px]:pb-[18px] min-[601px]:pt-[22px] lg:px-0"
                  style={enterStyle(g.requestId)}
                >
                  <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px] bg-[#F6F6F6] min-[601px]:h-12 min-[601px]:w-12 min-[601px]:rounded-[16px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={categoryIllust(g.category)} alt="" className="h-8 w-8 object-contain min-[601px]:h-9 min-[601px]:w-9" loading="lazy" />
                  </span>
                  <div className="min-w-0 flex-1">
                    {/* 제목 — 행사 종류 */}
                    <p className="truncate pt-px text-[16px] font-bold tracking-[-0.3px] text-[#191F28] min-[601px]:text-[17px]">{g.category}</p>
                    {/* 메타 — 신청일 · 문의한 사회자 수(회색 14) */}
                    <p className="mt-1 text-[14px] tracking-[-0.2px] text-[#8B95A1] min-[601px]:text-[15px]">
                      {g.createdAt} 신청 · 사회자 {g.cards.length}명
                    </p>

                    {/* 본문(16.5) — 행사 일시 · 장소 */}
                    <div className="mt-3 space-y-1 text-[16.5px] leading-[1.5] tracking-[-0.3px] text-[#191F28] min-[601px]:text-[17.5px]">
                      <p className="flex items-center gap-1.5">
                        <CalendarIcon size={18} className="shrink-0 text-[#B0B8C1]" />
                        <span className="min-w-0 truncate">{g.eventDate} · {g.eventTime}</span>
                      </p>
                      <p className="flex items-center gap-1.5">
                        <PinLocationIcon size={18} className="shrink-0 text-[#B0B8C1]" />
                        <span className="min-w-0 truncate">{g.location}</span>
                      </p>
                    </div>

                    {/* 문의한 사회자 — 웨딩숲 댓글 줄 계층(프사 36 · 이름 15 굵게 · 상태 배지) */}
                    <ul className="mt-3.5 overflow-hidden rounded-[16px] bg-[#F9FAFB]">
                      {g.cards.map((item) => (
                        <li key={item.id} className="border-b border-white last:border-b-0">
                          <button
                            type="button"
                            onClick={() => openInquiry(item)}
                            className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left transition-colors active:bg-[#F2F4F6] lg:hover:bg-[#F2F4F6]"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={getProfileImageUrl(item.proImage, item.proName)}
                              alt=""
                              className="h-9 w-9 shrink-0 rounded-full bg-[#F2F3F5] object-cover"
                              loading="lazy"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex min-w-0 items-center gap-1.5">
                                <span className="min-w-0 truncate text-[15px] font-bold tracking-[-0.2px] text-[#333D4B]">{item.proName}</span>
                                <StatusTag status={item.status} />
                              </span>
                              {item.status === '거절' && item.declineReason && (
                                <span className="mt-1 line-clamp-2 break-words text-[14px] leading-[1.45] tracking-[-0.2px] text-[#F04452]">거절 사유 · {item.declineReason}</span>
                              )}
                            </span>
                            {item.roomId ? (
                              <ChevronRightIcon size={18} className="shrink-0 text-[#C9CED6]" />
                            ) : (
                              <span className="w-[18px] shrink-0" aria-hidden="true" />
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>
              ))}
              {hasMore && (
                <div ref={loadMoreRef} className="flex h-12 items-center justify-center">
                  {loadingMore && <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#E9EBEF] border-t-[#A4ABBA]" />}
                </div>
              )}
            </div>
          )}
        </div>

        {/* PC 우측 요약 — 상태별 개수(누르면 그 상태만) + 다음 행동 */}
        {/* self-stretch 가 없으면 aside 높이가 내용과 같아져 sticky 가 붙을 자리가 없다 */}
        <aside className="hidden lg:block lg:self-stretch">
          <div className="sticky top-[92px] space-y-4">
            <div className="rounded-[24px] bg-[#F9FAFB] p-5">
              <div className="flex items-center gap-2">
                <DocumentColorIcon size={20} />
                <h2 className="text-[15px] font-bold text-[#191F28]">진행 현황</h2>
                <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#4E5968]">{cards.length}건</span>
              </div>
              <ul className="mt-3 flex flex-col gap-1">
                {(['요청중', '요청승인', '거래완료', '거절'] as InquiryStatus[]).map((status) => {
                  const Icon = getStatusColorIcon(status);
                  return (
                    <li key={status}>
                      <button
                        type="button"
                        onClick={() => setStatusTab(statusTab === status ? '전체' : status)}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] transition-colors ${
                          statusTab === status ? 'bg-white' : 'hover:bg-white'
                        }`}
                      >
                        <Icon size={22} />
                        <span className="flex-1 text-left font-medium text-[#191F28]">{status}</span>
                        <span className="tabular-nums font-semibold text-[#4E5968]">{statusCounts[status] || 0}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="rounded-[24px] bg-[#F9FAFB] p-5">
              <p className="text-[13px] font-bold text-[#191F28]">아직 답이 없나요?</p>
              <p className="mt-1 text-[12px] leading-5 text-[#8B95A1]">
                사회자가 문의를 승인하면 채팅방이 열려요. 여러 명에게 함께 문의하면 더 빨리 답을 받을 수 있어요.
              </p>
              <Link
                href="/pros"
                className="mt-4 flex h-11 w-full items-center justify-center rounded-[14px] bg-[#3182F6] text-[14px] font-bold text-white transition-colors hover:bg-[#2272EB] active:scale-[0.98]"
              >
                사회자 더 찾아보기
              </Link>
              <Link
                href="/chat"
                className="mt-2 flex h-11 w-full items-center justify-center rounded-[14px] bg-white text-[13px] font-bold text-[#4E5968] transition-colors hover:bg-[#F2F4F6]"
              >
                채팅으로 이동
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
