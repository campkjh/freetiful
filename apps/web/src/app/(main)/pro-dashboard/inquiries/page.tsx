'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Calendar, MapPin } from 'lucide-react';
import { chatApi } from '@/lib/api/chat.api';
import { matchApi } from '@/lib/api/match.api';
import { useAuthStore } from '@/lib/store/auth.store';
import { preWarmExistingRoom } from '@/lib/chat-prewarm';

type Filter = 'all' | 'multi' | 'single' | 'archived';
type RequestKind = 'multi' | 'single';

const MATCH_DELIVERIES_CACHE_KEY = 'freetiful-pro-simple-requests-cache-v1';
const MATCH_DELIVERIES_CACHE_TTL = 10 * 60_000;
const MATCH_REQUEST_LIMIT = 100; // 한꺼번에 로드 (스크롤 추가 로드 제거)
const VIEWED_AT_KEY = 'freetiful-pro-inquiries-viewed-at';
let memoryDeliveriesCache: { userId?: string | null; data: MatchDeliveryView[]; ts: number } | null = null;

interface MatchDeliveryView {
  id: string;
  matchRequestId: string;
  customerId: string;
  customerName: string;
  customerImage: string;
  requestKind: RequestKind;
  status: string;
  categoryName: string;
  eventCategoryName: string;
  eventDate: string | null;
  eventTime: string | null;
  eventLocation: string | null;
  eventPart: string | null;
  note: string;
  deliveredAt: string;
}

function cacheKey(userId?: string | null) {
  return userId ? `${MATCH_DELIVERIES_CACHE_KEY}:${userId}` : MATCH_DELIVERIES_CACHE_KEY;
}

function readCache(userId?: string | null): MatchDeliveryView[] | null {
  if (typeof window === 'undefined') return null;
  if (
    memoryDeliveriesCache
    && Date.now() - memoryDeliveriesCache.ts <= MATCH_DELIVERIES_CACHE_TTL
    && (!userId || memoryDeliveriesCache.userId === userId)
  ) {
    return memoryDeliveriesCache.data;
  }
  try {
    const raw = localStorage.getItem(cacheKey(userId)) || sessionStorage.getItem(MATCH_DELIVERIES_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (!Array.isArray(parsed?.data) || !parsed.ts) return null;
    if (Date.now() - parsed.ts > MATCH_DELIVERIES_CACHE_TTL) {
      localStorage.removeItem(cacheKey(userId));
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function readLatestCache(): MatchDeliveryView[] | null {
  if (typeof window === 'undefined') return null;
  const currentUserId = useAuthStore.getState().user?.id;
  if (
    currentUserId
    && memoryDeliveriesCache
    && memoryDeliveriesCache.userId === currentUserId
    && Date.now() - memoryDeliveriesCache.ts <= MATCH_DELIVERIES_CACHE_TTL
  ) {
    return memoryDeliveriesCache.data;
  }
  const direct = readCache(currentUserId) || readCache(null);
  if (direct) return direct;
  try {
    let latest: { data: MatchDeliveryView[]; ts: number } | null = null;
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith(`${MATCH_DELIVERIES_CACHE_KEY}:`)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed?.data) || !parsed.ts) continue;
      if (Date.now() - parsed.ts > MATCH_DELIVERIES_CACHE_TTL) continue;
      if (!latest || parsed.ts > latest.ts) {
        latest = { data: parsed.data, ts: parsed.ts };
      }
    }
    return latest?.data ?? null;
  } catch {
    return null;
  }
}

function writeCache(data: MatchDeliveryView[], userId?: string | null) {
  memoryDeliveriesCache = { data, userId, ts: Date.now() };
  if (typeof window === 'undefined') return;
  try {
    const payload = JSON.stringify({ data, ts: Date.now() });
    localStorage.setItem(cacheKey(userId), payload);
    sessionStorage.setItem(MATCH_DELIVERIES_CACHE_KEY, JSON.stringify(data));
  } catch {}
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}일 전`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '일시 미정';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} (${weekdays[d.getDay()]})`;
}

function formatTime(value: string | null): string {
  if (!value) return '';
  if (/^\d{2}:\d{2}$/.test(value)) return value;
  const isoTime = value.match(/T(\d{2}:\d{2})/);
  if (isoTime) return isoTime[1];
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function mapMatchDeliveries(items: any[]): MatchDeliveryView[] {
  return items
    .filter((d: any) => ['pending', 'viewed', 'archived'].includes(d.status))
    .map((d: any) => {
      const raw = typeof d.matchRequest?.rawUserInput === 'object' && d.matchRequest?.rawUserInput
        ? d.matchRequest.rawUserInput
        : {};
      const requestKind = d.matchRequest?.type === 'single' ? 'single' : 'multi';
      return {
        id: d.id,
        matchRequestId: d.matchRequestId,
        customerId: d.matchRequest?.user?.id || '',
        customerName: d.matchRequest?.user?.name || '고객',
        customerImage: d.matchRequest?.user?.profileImageUrl || '/images/default-profile.png',
        requestKind,
        status: d.status || 'pending',
        categoryName: d.matchRequest?.category?.name || raw.categoryName || '사회자 요청',
        eventCategoryName: d.matchRequest?.eventCategory?.name || raw.eventType || '',
        eventDate: d.matchRequest?.eventDate || raw.date || null,
        eventTime: raw.timeStart || d.matchRequest?.eventTime || null,
        eventLocation: d.matchRequest?.eventLocation || raw.location || null,
        eventPart: raw.eventPart || null,
        note: raw.note || '',
        deliveredAt: d.deliveredAt,
      };
    });
}

const TABS: { key: Filter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'multi', label: '모두에게' },
  { key: 'single', label: '개인요청' },
  { key: 'archived', label: '보관' },
];

export default function ProRequestsPage() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const cached = useMemo(() => readLatestCache(), []);
  const [filter, setFilter] = useState<Filter>('all');
  const [requests, setRequests] = useState<MatchDeliveryView[]>(cached ?? []);
  const [loading, setLoading] = useState(false);
  const [hasFetchedOnce, setHasFetchedOnce] = useState(cached !== null);
  const [initiatingChat, setInitiatingChat] = useState<string | null>(null);
  const requestsCountRef = useRef(cached?.length ?? 0);
  const requestsRef = useRef<MatchDeliveryView[]>(cached ?? []);
  const inquiryItemsRef = useRef<any[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const skipRef = useRef(0);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // ─── iOS 네이티브 새요청 헤더/탭 연동 ───
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as any;
    const KEY_TO_LABEL: Record<string, string> = { all: '전체', multi: '모두에게', single: '개인요청', archived: '보관' };
    const LABEL_TO_KEY: Record<string, Filter> = { '전체': 'all', '모두에게': 'multi', '개인요청': 'single', '보관': 'archived' };
    w.__freetifulInquiryList = {
      getState: () => ({ tab: KEY_TO_LABEL[filter] || '전체', tabs: ['전체', '모두에게', '개인요청', '보관'] }),
      setTab: (label: string) => setFilter(LABEL_TO_KEY[label] || 'all'),
      getItems: () => inquiryItemsRef.current,
      invokeReject: (id: string, message?: string) => { handleReject(id, message); },
      invokeArchive: (id: string) => { handleArchive(id); },
      invokeChat: (id: string) => {
        const r = requestsRef.current.find((x) => x.id === id);
        if (r) handleStartChat(r);
      },
    };
    window.dispatchEvent(new Event('freetiful:chatlist-state'));
    return () => { try { if (w.__freetifulInquiryList) delete w.__freetifulInquiryList; } catch {} };
  }, [filter]);

  useEffect(() => {
    requestsCountRef.current = requests.length;
  }, [requests.length]);

  const refreshRequests = useCallback((showLoading = false) => {
    if (!authUser) {
      setLoading(false);
      setHasFetchedOnce(true);
      return;
    }
    if (showLoading && requestsCountRef.current === 0 && !hasFetchedOnce) setLoading(true);
    matchApi.getProRequests({ limit: MATCH_REQUEST_LIMIT, skip: 0 })
      .then((data: any) => {
        const items = Array.isArray(data) ? data : (data?.data || []);
        const mapped = mapMatchDeliveries(items);
        setRequests(mapped);
        seenIdsRef.current = new Set(mapped.map((r) => r.id));
        skipRef.current = items.length;
        setHasMore(items.length >= MATCH_REQUEST_LIMIT);
        writeCache(mapped, authUser.id);
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
        setHasFetchedOnce(true);
      });
  }, [authUser, hasFetchedOnce]);

  // 스크롤 도달 시 다음 페이지(6개) 추가 로드 — append
  const fetchMoreRequests = useCallback(() => {
    if (!authUser || loadingMore || !hasMore) return;
    setLoadingMore(true);
    matchApi.getProRequests({ limit: MATCH_REQUEST_LIMIT, skip: skipRef.current })
      .then((data: any) => {
        const items = Array.isArray(data) ? data : (data?.data || []);
        const mapped = mapMatchDeliveries(items);
        skipRef.current += items.length;
        // 중복 아닌 새 항목만 추가 — 백엔드가 skip을 무시해 같은 페이지를 줘도 무한루프 방지
        const fresh = mapped.filter((r) => r && !seenIdsRef.current.has(r.id));
        if (fresh.length === 0 || items.length < MATCH_REQUEST_LIMIT) setHasMore(false);
        if (fresh.length > 0) {
          fresh.forEach((r) => seenIdsRef.current.add(r.id));
          setRequests((prev) => [...prev, ...fresh]);
        }
      })
      .catch(() => setHasMore(false))
      .finally(() => setLoadingMore(false));
  }, [authUser, loadingMore, hasMore]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && hasMore && !loadingMore) fetchMoreRequests();
    }, { rootMargin: '200px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, fetchMoreRequests]);

  useEffect(() => {
    if (!authUser || requests.length > 0) return;
    const cachedForUser = readCache(authUser.id);
    if (!cachedForUser) return;
    setRequests(cachedForUser);
    setLoading(false);
    setHasFetchedOnce(true);
  }, [authUser?.id, requests.length]);

  useEffect(() => {
    try {
      localStorage.setItem(VIEWED_AT_KEY, String(Date.now()));
      window.dispatchEvent(new Event('freetiful:inquiries-viewed'));
    } catch {}
  }, []);

  useEffect(() => {
    refreshRequests(true);
    const refresh = () => refreshRequests(false);
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, 3500);
    window.addEventListener('focus', refresh);
    window.addEventListener('freetiful:match-requests-changed', refresh as EventListener);
    window.addEventListener('freetiful:dashboard-updated', refresh as EventListener);
    window.addEventListener('freetiful:chat-socket-connected', refresh as EventListener);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('freetiful:match-requests-changed', refresh as EventListener);
      window.removeEventListener('freetiful:dashboard-updated', refresh as EventListener);
      window.removeEventListener('freetiful:chat-socket-connected', refresh as EventListener);
    };
  }, [refreshRequests]);

  const filtered = useMemo(() => {
    if (filter === 'archived') return requests.filter((r) => r.status === 'archived');
    const active = requests.filter((r) => r.status !== 'archived');
    if (filter === 'all') return active;
    return active.filter((request) => request.requestKind === filter);
  }, [filter, requests]);

  // ─── iOS 네이티브 새요청 행 데이터 브리지 ───
  useEffect(() => {
    if (typeof window === 'undefined') return;
    requestsRef.current = requests;
    inquiryItemsRef.current = filtered.map((r) => ({
      id: r.id,
      customerId: r.customerId,
      matchRequestId: r.matchRequestId,
      name: r.customerName,
      image: r.customerImage,
      kind: r.requestKind,
      isMulti: r.requestKind === 'multi',
      kindLabel: r.requestKind === 'multi' ? '모두에게' : '개인요청',
      timeAgo: timeAgo(r.deliveredAt),
      category: [r.categoryName, r.eventCategoryName].filter(Boolean).join(' · '),
      parts: r.eventPart ? r.eventPart.split(', ').filter(Boolean) : [],
      dateText: `${formatDate(r.eventDate)} ${formatTime(r.eventTime)}`.trim(),
      location: r.eventLocation || '',
      note: r.note || '',
    }));
    window.dispatchEvent(new Event('freetiful:inquiry-rows'));
  }, [filtered, requests]);

  async function handleReject(deliveryId: string, message?: string) {
    try {
      await matchApi.respond(deliveryId, 'reject', message);
      setRequests((prev) => {
        const next = prev.filter((request) => request.id !== deliveryId);
        writeCache(next, authUser?.id);
        return next;
      });
      window.dispatchEvent(new Event('freetiful:match-requests-changed'));
      toast.success('요청을 거절했습니다');
    } catch (e: any) {
      toast.error(`거절 실패: ${e?.response?.data?.message || e?.message || ''}`);
    }
  }

  async function handleArchive(deliveryId: string) {
    try {
      await matchApi.respond(deliveryId, 'archive');
      setRequests((prev) => {
        const next = prev.map((request) => request.id === deliveryId ? { ...request, status: 'archived' } : request);
        writeCache(next, authUser?.id);
        return next;
      });
      window.dispatchEvent(new Event('freetiful:match-requests-changed'));
      toast.success('요청을 보관했습니다');
    } catch (e: any) {
      toast.error(`보관 실패: ${e?.response?.data?.message || e?.message || ''}`);
    }
  }

  async function handleStartChat(request: MatchDeliveryView) {
    if (initiatingChat) return;
    setInitiatingChat(request.id);
    try {
      const res = await chatApi.createRoomAsPro(request.customerId, request.matchRequestId);
      const roomId = (res as any)?.data?.id || (res as any)?.id;
      if (!roomId) {
        toast.error('채팅방 생성에 실패했습니다');
        return;
      }
      if ((res as any)?.data?.otherUser) {
        preWarmExistingRoom((res as any).data);
      }
      setRequests((prev) => {
        const next = prev.filter((item) => item.id !== request.id);
        writeCache(next, authUser?.id);
        return next;
      });
      window.dispatchEvent(new Event('freetiful:match-requests-changed'));
      router.push(`/chat/${roomId}`);
    } catch (e: any) {
      toast.error(`채팅 연결 실패: ${e?.response?.data?.message || e?.message || ''}`);
    } finally {
      setInitiatingChat(null);
    }
  }

  return (
    <div className="pro-toss-page pro-fast-render pb-24">
      <div data-native-chatlist-header className="pro-toss-header sticky top-0 z-10 px-4 pb-3 pt-3">
        <div className="flex h-[52px] items-center justify-between">
          <h1 className="text-[20px] font-bold text-[#2B313D]">새 요청</h1>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {TABS.map((tab) => {
            const active = filter === tab.key;
            const count = tab.key === 'all'
              ? requests.length
              : requests.filter((request) => request.requestKind === tab.key).length;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={`shrink-0 rounded-full px-4 py-2 text-[14px] font-semibold transition active:scale-95 ${
                  active ? 'bg-[#3180F7] text-white' : 'bg-[#F2F4F8] text-[#6B7684]'
                }`}
              >
                {tab.label}
                {count > 0 && <span className="ml-1.5 text-[11px]">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 px-4 pt-3">
        {loading && filtered.length === 0 && !hasFetchedOnce ? (
          <div className="py-24 text-center">
            <p className="text-[15px] font-semibold text-[#8B95A1]">새 요청을 확인 중입니다</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-24 text-center">
            <p className="text-[15px] font-semibold text-[#8B95A1]">새 요청이 없습니다</p>
          </div>
        ) : (
          filtered.map((request) => (
            <article
              key={request.id}
              className="rounded-[24px] border-[0.6px] border-[#F9F9F9] bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
            >
              <div className="flex items-start gap-3">
                <img
                  src={request.customerImage}
                  alt=""
                  className="h-11 w-11 shrink-0 rounded-[20px] object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      request.requestKind === 'multi'
                        ? 'bg-[#EAF2FF] text-[#3180F7]'
                        : 'bg-[#F2F4F8] text-[#4E5968]'
                    }`}>
                      {request.requestKind === 'multi' ? '모두에게' : '개인요청'}
                    </span>
                    <strong className="truncate text-[16px] font-bold text-[#2B313D]">{request.customerName}</strong>
                    <span className="ml-auto shrink-0 text-[12px] font-normal text-[#A4ABBA]">{timeAgo(request.deliveredAt)}</span>
                  </div>
                  <p className="text-[14px] font-semibold text-[#4E5968]">
                    {[request.categoryName, request.eventCategoryName].filter(Boolean).join(' · ')}
                  </p>
                  {request.eventPart && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {request.eventPart.split(', ').map((part) => (
                        <span key={part} className="rounded-full bg-[#EAF3FF] px-2.5 py-0.5 text-[12px] font-bold text-[#3180F7]">{part}</span>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[13px] font-medium text-[#6B7684]">
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={13} />
                      {formatDate(request.eventDate)} {formatTime(request.eventTime)}
                    </span>
                    {request.eventLocation && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={13} />
                        {request.eventLocation}
                      </span>
                    )}
                  </div>
                  {request.note && (
                    <p className="mt-3 rounded-[16px] bg-[#F8FAFC] px-3.5 py-3 text-[13px] leading-5 text-[#4E5968]">
                      {request.note}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleReject(request.id)}
                  disabled={initiatingChat === request.id}
                  className="h-12 flex-1 rounded-[12px] bg-[#F2F4F8] text-[18px] font-semibold text-[#4E5968] transition active:scale-95 disabled:opacity-50"
                >
                  거절
                </button>
                <button
                  type="button"
                  onClick={() => handleStartChat(request)}
                  disabled={initiatingChat === request.id}
                  className="h-12 flex-1 rounded-[12px] bg-[#3180F7] text-[18px] font-semibold text-white shadow-[0_10px_20px_rgba(49,128,247,0.16)] transition active:scale-95 disabled:opacity-60"
                >
                  {initiatingChat === request.id ? '연결 중' : '채팅'}
                </button>
              </div>
            </article>
          ))
        )}
        {(hasMore || loadingMore) && (
          <div ref={loadMoreRef} className="flex h-12 items-center justify-center">
            {loadingMore && <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-gray-400" />}
          </div>
        )}
      </div>
    </div>
  );
}
