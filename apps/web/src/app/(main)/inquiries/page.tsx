'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Clock, MessageCircle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { matchApi } from '@/lib/api/match.api';
import { useAuthStore } from '@/lib/store/auth.store';
import { getProfileImageUrl } from '@/lib/default-profile';

type InquiryStatus = '요청중' | '요청승인' | '거래완료';

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
  status: InquiryStatus;
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

function formatDate(value?: string | null) {
  if (!value) return '일자 미정';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '일자 미정';
  return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
}

function formatTime(value?: string | null) {
  if (!value) return '시간 미정';
  const time = value.includes('T') ? new Date(value).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : value.slice(0, 5);
  return time || '시간 미정';
}

function getStatusTone(status: InquiryStatus) {
  if (status === '거래완료') return 'bg-[#EAF7EF] text-[#159947]';
  if (status === '요청승인') return 'bg-[#EAF3FF] text-[#3180F7]';
  return 'bg-gray-100 text-gray-500';
}

function getStatusIcon(status: InquiryStatus) {
  if (status === '거래완료') return CheckCircle2;
  if (status === '요청승인') return MessageCircle;
  return Clock;
}

function buildCards(requests: any[]): InquiryCard[] {
  return requests.flatMap((request) => {
    const rooms = Array.isArray(request.chatRooms) ? request.chatRooms : [];
    const deliveries = Array.isArray(request.deliveries) ? request.deliveries : [];
    const base = {
      requestId: request.id,
      category: request.eventCategory?.name || request.category?.name || '사회자 문의',
      location: request.eventLocation || '장소 미정',
      eventDate: formatDate(request.eventDate),
      eventTime: formatTime(request.eventTime),
      createdAt: formatDate(request.createdAt),
    };

    const deliveryCards = deliveries.map((delivery: any) => {
      const room = rooms.find((item: any) => item.proProfileId === delivery.proProfileId);
      const latestQuotation = Array.isArray(room?.quotations) ? room.quotations[0] : null;
      const paid = latestQuotation?.payment?.status === 'completed' || latestQuotation?.status === 'paid';
      const approved = Boolean(room?.id) || delivery.status === 'replied';
      const proProfile = delivery.proProfile || room?.proProfile;
      const proUser = proProfile?.user;
      const proImage = proProfile?.images?.[0]?.imageUrl || proUser?.profileImageUrl || null;
      return {
        ...base,
        id: delivery.id,
        roomId: room?.id,
        proName: proUser?.name || '사회자',
        proImage,
        status: paid ? '거래완료' : approved ? '요청승인' : '요청중',
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

  const cards = useMemo(() => buildCards(requests), [requests]);

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

  const openInquiry = (item: InquiryCard) => {
    if (item.roomId) {
      router.push(`/chat/${item.roomId}`);
      return;
    }
    toast('사회자가 문의를 승인하면 채팅방이 열립니다');
  };

  return (
    <div className="min-h-screen bg-white pb-28 lg:mx-auto lg:max-w-3xl">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 bg-white/90 px-4 backdrop-blur">
        <button type="button" onClick={() => router.back()} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-gray-100" aria-label="뒤로가기">
          <ChevronLeft size={24} className="text-gray-800" />
        </button>
        <h1 className="text-[18px] font-bold text-gray-950">문의목록</h1>
      </header>

      <main className="px-4 pt-3">
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-[118px] animate-pulse rounded-3xl bg-gray-50" />
            ))}
          </div>
        ) : cards.length === 0 ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-50">
              <MessageCircle size={28} className="text-gray-300" />
            </div>
            <p className="text-[17px] font-bold text-gray-900">아직 문의한 사회자가 없습니다</p>
            <p className="mt-2 text-[14px] leading-6 text-gray-400">마음에 드는 사회자 상세페이지에서 문의를 보내면 이곳에 표시됩니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cards.map((item) => {
              const StatusIcon = getStatusIcon(item.status);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openInquiry(item)}
                  className="w-full rounded-3xl border border-[#F2F4F7] bg-white p-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.04)] active:scale-[0.99] transition-transform"
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={getProfileImageUrl(item.proImage, item.proName)}
                      alt=""
                      className="h-14 w-14 rounded-2xl object-cover bg-gray-50"
                      loading="lazy"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[16px] font-bold text-[#2B313D]">{item.proName}</p>
                          <p className="mt-0.5 truncate text-[13px] font-medium text-gray-400">{item.category}</p>
                        </div>
                        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold ${getStatusTone(item.status)}`}>
                          <StatusIcon size={13} />
                          {item.status}
                        </span>
                      </div>
                      <div className="mt-3 rounded-2xl bg-gray-50 px-3 py-2">
                        <p className="truncate text-[13px] font-semibold text-gray-700">{item.location}</p>
                        <p className="mt-0.5 text-[12px] font-medium text-gray-400">{item.eventDate} · {item.eventTime}</p>
                      </div>
                    </div>
                    <ChevronRight size={18} className="mt-9 shrink-0 text-gray-300" />
                  </div>
                </button>
              );
            })}
            {hasMore && (
              <div ref={loadMoreRef} className="flex h-12 items-center justify-center">
                {loadingMore && <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-gray-400" />}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
