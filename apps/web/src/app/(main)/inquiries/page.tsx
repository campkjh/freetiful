'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LayoutGroup, motion } from 'framer-motion';
import {
  ChevronRightIcon,
  ClockIcon,
  ChatBubbleIcon,
  CheckCircleIcon,
  XCircleIcon,
  CalendarIcon,
  PinLocationIcon,
  DocumentIcon,
} from '@/components/icons/mono';
import { EmptyDocumentIcon, DocumentColorIcon, PendingIcon, RepliedIcon, DoneIcon, DeclinedIcon } from '@/components/icons/color';
import toast from 'react-hot-toast';
import { matchApi } from '@/lib/api/match.api';
import { useAuthStore } from '@/lib/store/auth.store';
import { getProfileImageUrl } from '@/lib/default-profile';

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

// 행사일: @db.Date(UTC 자정 직렬화) → 기기 타임존과 무관하게 저장된 날짜 그대로(UTC) + 연도 표기
function formatEventDate(value?: string | null) {
  if (!value) return '일자 미정';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '일자 미정';
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short', timeZone: 'UTC' });
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

function getStatusTone(status: InquiryStatus) {
  if (status === '거래완료') return 'bg-[#EAF7EF] text-[#159947]';
  if (status === '요청승인') return 'bg-[#EAF2FF] text-[#3180F7]';
  if (status === '거절') return 'bg-[#FDECEC] text-[#E5484D]';
  return 'bg-[#F2F3F5] text-[#51535C]';
}

function getStatusIcon(status: InquiryStatus) {
  if (status === '거래완료') return CheckCircleIcon;
  if (status === '요청승인') return ChatBubbleIcon;
  if (status === '거절') return XCircleIcon;
  return ClockIcon;
}

/** 진행 현황 목록에 쓰는 컬러 아이콘 — 상태색이 아이콘 자체에 들어 있다 */
function getStatusColorIcon(status: InquiryStatus) {
  if (status === '거래완료') return DoneIcon;
  if (status === '요청승인') return RepliedIcon;
  if (status === '거절') return DeclinedIcon;
  return PendingIcon;
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
        if (!cancelled) toast.error('문의목록을 불러오지 못했습니다');
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

  return (
    <div className="min-h-screen bg-white pb-28 lg:pb-6">
      {/* 모바일 전용 헤더 — 새요청 탭과 같은 모양(흰 바탕·타이틀만). PC 는 전역 헤더가 있어 숨긴다 */}
      <header className="sticky top-0 z-20 flex h-14 items-center bg-white px-4 lg:hidden">
        <h1 className="text-[20px] font-bold text-[#2B313D]">문의목록</h1>
      </header>

      <div className="mx-auto grid max-w-[1120px] items-start gap-8 px-4 pt-3 lg:grid-cols-[1fr_340px] lg:px-0 lg:pt-8">
        <div className="min-w-0">
          {/* PC 타이틀 */}
          <div className="mb-6 hidden lg:block">
            <h1 className="text-[26px] font-bold tracking-tight text-[#2B313D]">문의목록</h1>
            <p className="mt-1 text-[14px] text-[#A4ABBA]">보낸 문의와 진행 상태를 한눈에 확인하세요</p>
          </div>

          {/* 상태 탭 — 스크롤해도 따라오도록 고정. 흰 알약이 탭 사이를 미끄러진다 */}
          {cards.length > 0 && (
            <div className="sticky top-14 z-10 -mx-4 mb-4 bg-white px-4 py-2 lg:top-[72px] lg:mx-0 lg:px-0 lg:py-3">
              <LayoutGroup id="inquiry-status-tabs">
                <div className="flex gap-1 overflow-x-auto rounded-2xl bg-[#F2F3F5] p-1 scrollbar-hide">
                  {STATUS_TABS.map((tab) => {
                    const on = statusTab === tab;
                    const count = statusCounts[tab] || 0;
                    if (tab !== '전체' && count === 0) return null;
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setStatusTab(tab)}
                        className={`relative flex shrink-0 flex-1 items-center justify-center gap-1.5 rounded-[13px] px-3 py-2 text-[13px] transition-colors ${
                          on ? 'font-bold text-[#2B313D]' : 'font-semibold text-[#A4ABBA] hover:text-[#51535C]'
                        }`}
                      >
                        {on && (
                          <motion.span
                            layoutId="inquiry-status-pill"
                            className="absolute inset-0 rounded-[13px] bg-white shadow-sm"
                            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                          />
                        )}
                        <span className="relative">{tab}</span>
                        <span className={`relative text-[12px] tabular-nums ${on ? 'text-[#3180F7]' : 'text-[#C8CEDA]'}`}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              </LayoutGroup>
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-[132px] animate-pulse rounded-[24px] bg-[#F7F8FA]" />
              ))}
            </div>
          ) : cards.length === 0 ? (
            <div className="flex min-h-[46vh] flex-col items-center justify-center px-6 py-16 text-center">
              <EmptyDocumentIcon size={72} className="mb-4" />
              <p className="text-[17px] font-bold text-[#2B313D]">아직 문의한 사회자가 없습니다</p>
              <p className="mt-2 text-[14px] leading-6 text-[#A4ABBA]">마음에 드는 사회자 상세페이지에서 문의를 보내면 이곳에 표시됩니다.</p>
              <Link
                href="/pros"
                className="mt-5 flex h-11 items-center justify-center rounded-[14px] bg-[#3180F7] px-6 text-[14px] font-bold text-white transition-colors hover:bg-[#2470E6] active:scale-[0.98]"
              >
                사회자 둘러보기
              </Link>
            </div>
          ) : visibleCards.length === 0 ? (
            <div className="px-6 py-24 text-center text-[13px] text-[#A4ABBA]">
              {statusTab} 상태인 문의가 없습니다
            </div>
          ) : (
            <div key={statusTab} className="space-y-3" style={{ animation: 'proPageExpand 0.34s cubic-bezier(0.16, 1, 0.3, 1) both' }}>
              {visibleCards.map((item) => {
                const StatusIcon = getStatusIcon(item.status);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openInquiry(item)}
                    className="group flex w-full flex-col gap-3 rounded-[24px] border-[0.6px] border-[#F1F3F6] bg-white px-5 py-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-colors duration-200 hover:bg-[#FBFCFD] lg:flex-row lg:items-center lg:gap-4"
                  >
                    {/* 윗줄 — 사회자 이름과 상태. 이름은 한 줄·한 폰트로 이어 쓴다 */}
                    <div className="flex items-center gap-3 lg:min-w-0 lg:flex-1">
                      <img
                        src={getProfileImageUrl(item.proImage, item.proName)}
                        alt=""
                        className="h-11 w-11 shrink-0 rounded-full bg-[#F2F3F5] object-cover lg:h-12 lg:w-12"
                        loading="lazy"
                      />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-bold text-[#2B313D]">
                          {item.proName} {item.category}
                        </p>

                        {/* PC 는 폭이 넉넉해 한 줄로 붙인다 */}
                        <p className="mt-1.5 hidden items-center gap-1.5 text-[13px] font-medium text-[#51535C] lg:flex">
                          <PinLocationIcon size={13} className="shrink-0 text-[#C8CEDA]" />
                          <span className="truncate">{item.location}</span>
                        </p>
                        <p className="mt-1 hidden items-center gap-1.5 text-[12px] text-[#A4ABBA] lg:flex">
                          <CalendarIcon size={13} className="shrink-0 text-[#C8CEDA]" />
                          <span className="truncate">{item.eventDate} · {item.eventTime}</span>
                          <span className="shrink-0 text-[#D8DDE4]">·</span>
                          <span className="shrink-0">{item.createdAt} 신청</span>
                        </p>
                        {item.status === '거절' && item.declineReason && (
                          <p className="mt-2 hidden truncate text-[12px] text-[#E5484D] lg:block">
                            거절 사유: {item.declineReason}
                          </p>
                        )}
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-2.5 py-[5px] text-[11.5px] font-bold lg:hidden ${getStatusTone(item.status)}`}
                      >
                        {item.status}
                      </span>
                    </div>

                    {/* 모바일 — 한 줄에 다 우겨넣으면 '00.00 신청' 이 잘려서, 줄을 쌓는다 */}
                    <div className="space-y-2 rounded-[16px] bg-[#F9FAFB] px-3.5 py-3 lg:hidden">
                      <p className="flex items-start gap-2 text-[13px] font-semibold text-[#51535C]">
                        <PinLocationIcon size={14} className="mt-[3px] shrink-0 text-[#C8CEDA]" />
                        <span className="min-w-0 flex-1 break-keep">{item.location}</span>
                      </p>
                      <p className="flex items-start gap-2 text-[13px] font-semibold text-[#51535C]">
                        <CalendarIcon size={14} className="mt-[3px] shrink-0 text-[#C8CEDA]" />
                        <span className="min-w-0 flex-1 break-keep">{item.eventDate} · {item.eventTime}</span>
                      </p>
                      <p className="flex items-start gap-2 text-[12px] text-[#A4ABBA]">
                        <ClockIcon size={14} className="mt-[2px] shrink-0 text-[#D8DDE4]" />
                        <span className="min-w-0 flex-1 break-keep">{item.createdAt} 신청</span>
                      </p>
                      {item.status === '거절' && item.declineReason && (
                        <p className="border-t border-[#EEF0F3] pt-2 text-[12px] leading-[1.6] text-[#E5484D]">
                          거절 사유: {item.declineReason}
                        </p>
                      )}
                    </div>

                    <div className="hidden shrink-0 items-center gap-2 lg:flex">
                      <span className={`rounded-full px-2.5 py-[5px] text-[11.5px] font-bold ${getStatusTone(item.status)}`}>
                        {item.status}
                      </span>
                      <ChevronRightIcon size={16} className="text-[#D8DDE4] transition-transform duration-200 group-hover:translate-x-0.5" />
                    </div>
                  </button>
                );
              })}
              {hasMore && (
                <div ref={loadMoreRef} className="flex h-12 items-center justify-center">
                  {loadingMore && <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#E9EBEF] border-t-[#A4ABBA]" />}
                </div>
              )}
            </div>
          )}
        </div>

        {/* PC 우측 요약 — 자가견적의 '견적 요약' 자리와 같은 위치·톤 */}
        {/* self-stretch 가 없으면 aside 높이가 내용과 같아져 sticky 가 붙을 자리가 없다 */}
        <aside className="hidden lg:block lg:self-stretch">
          <div className="sticky top-[92px] space-y-4">
            <div className="rounded-[24px] bg-white p-5">
              <div className="flex items-center gap-2">
                <DocumentColorIcon size={20} />
                <h2 className="text-[15px] font-bold text-[#2B313D]">진행 현황</h2>
                <span className="ml-auto rounded-full bg-[#F2F3F5] px-2 py-0.5 text-[11px] font-semibold text-[#51535C]">{cards.length}건</span>
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
                          statusTab === status ? 'bg-[#F2F3F5]' : 'hover:bg-[#F2F3F5]'
                        }`}
                      >
                        <Icon size={22} />
                        <span className="flex-1 text-left font-medium text-[#2B313D]">{status}</span>
                        <span className="tabular-nums font-semibold text-[#51535C]">{statusCounts[status] || 0}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="rounded-[24px] bg-white p-5">
              <p className="text-[13px] font-bold text-[#2B313D]">아직 답이 없나요?</p>
              <p className="mt-1 text-[12px] leading-5 text-[#A4ABBA]">
                사회자가 문의를 승인하면 채팅방이 열립니다. 여러 명에게 동시에 문의하면 더 빨리 답을 받을 수 있어요.
              </p>
              <Link
                href="/pros"
                className="mt-4 flex h-11 w-full items-center justify-center rounded-[14px] bg-[#3180F7] text-[14px] font-bold text-white transition-colors hover:bg-[#2470E6] active:scale-[0.98]"
              >
                사회자 더 찾아보기
              </Link>
              <Link
                href="/chat"
                className="mt-2 flex h-11 w-full items-center justify-center rounded-[14px] bg-[#F2F3F5] text-[13px] font-bold text-[#51535C] transition-colors hover:bg-[#E3E6EB]"
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
