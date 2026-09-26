'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutGroup, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { CalendarIcon, ChatBubbleIcon, PinLocationIcon } from '@/components/icons/mono';
import { EmptyDocumentIcon } from '@/components/icons/color';
import { chatApi } from '@/lib/api/chat.api';
import { matchApi } from '@/lib/api/match.api';
import { useAuthStore } from '@/lib/store/auth.store';
import { preWarmExistingRoom } from '@/lib/chat-prewarm';
import { useEntranceWindow, useListEntrance, useTabEntrance } from '@/lib/hooks/useTabEntrance';

type Filter = 'all' | 'multi' | 'single' | 'archived';
type RequestKind = 'multi' | 'single';

const MATCH_DELIVERIES_CACHE_KEY = 'freetiful-pro-simple-requests-cache-v1';
// 캐시 보여주기 한도 — 예전엔 10분 지나면 버려서, 앱 켜고 조금 지나 새요청을 열면 매번 빈 화면에서 기다렸다(260926 사장 '너무 느림').
// 이제 3일 안의 캐시는 일단 바로 보여주고, 마운트 때 항상 새로 받아 바꾼다(stale-while-revalidate).
const MATCH_DELIVERIES_CACHE_TTL = 3 * 24 * 60 * 60_000;
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

// iOS 네이티브 행(dateText)용 — 네이티브 칸 폭에 맞춘 짧은 표기라 그대로 둔다
function formatDate(iso: string | null): string {
  if (!iso) return '일시 미정';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} (${weekdays[d.getDay()]})`;
}

// 웹 행사일: 매칭·채팅방 일정과 같은 '26년 12월 13일 (일)'. @db.Date 는 UTC 자정이라 UTC 로 읽는다
function formatEventDate(iso: string | null): string {
  if (!iso) return '일시 미정';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  return `${String(d.getUTCFullYear()).slice(2)}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${weekdays[d.getUTCDay()]})`;
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
  const [, setLoading] = useState(false);
  const [hasFetchedOnce, setHasFetchedOnce] = useState(cached !== null);
  const [initiatingChat, setInitiatingChat] = useState<string | null>(null);
  const requestsCountRef = useRef(cached?.length ?? 0);
  const requestsRef = useRef<MatchDeliveryView[]>(cached ?? []);
  const inquiryItemsRef = useRef<any[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  // 웹/안드 거절 사유 입력 모달 (iOS 는 NativeRejectModal 네이티브가 담당)
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const skipRef = useRef(0);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  // 화면에 그리는 개수 — 받은 건 100건이어도 20개씩(스크롤 닿으면 20개 더). 탭 바꾸면 처음부터
  const RENDER_STEP = 20;
  const [renderCount, setRenderCount] = useState(RENDER_STEP);
  const renderMoreRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => { setRenderCount(RENDER_STEP); }, [filter]);
  useEffect(() => {
    const target = renderMoreRef.current;
    if (!target) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setRenderCount((c) => c + RENDER_STEP);
    }, { rootMargin: '600px 0px' });
    io.observe(target);
    return () => io.disconnect();
  }, [renderCount, filtered.length]);

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

  // 처음 들어올 때 퀵매칭 등장(제목↑·탭↑·요청 칸 ←) — 탭 왕복·뒤로가기로 돌아올 땐 생략
  const entrance = useTabEntrance('pro-requests');
  const enterStyle = useListEntrance(filtered.slice(0, renderCount).map((r) => r.id), entrance);
  const enterWindow = useEntranceWindow(entrance);
  // 목록 통째 올라오는 효과는 탭을 바꿨을 때만(첫 진입은 칸별 등장이 대신한다)
  const [tabSwitched, setTabSwitched] = useState(false);

  return (
    <div className="pro-toss-page pro-fast-render min-h-screen bg-white pb-24 lg:mx-auto lg:max-w-[760px]">
      {/* 머리줄 — 매칭·채팅과 같은 결(흰 바탕·제목 20) + 종류 탭이 같이 붙어 다닌다 */}
      <div data-native-chatlist-header className="sticky top-0 z-10 bg-white px-4 pb-2">
        <div className="flex h-14 items-center">
          <h1 className={`text-[20px] font-bold text-[#191F28] ${entrance ? 'qd-a-title' : ''}`}>새 요청</h1>
        </div>
        {/* 탭 — 회색 트랙 위로 흰 알약이 미끄러진다(매칭·채팅 탭과 같은 모양) */}
        <LayoutGroup id="pro-inquiry-tabs">
          <div className={`scrollbar-hide flex gap-1 overflow-x-auto rounded-2xl bg-[#F2F3F5] p-1 ${entrance ? 'qd-a-sub' : ''}`}>
            {TABS.map((tab) => {
              const active = filter === tab.key;
              const count = tab.key === 'all'
                ? requests.filter((r) => r.status !== 'archived').length
                : tab.key === 'archived'
                  ? requests.filter((r) => r.status === 'archived').length
                  : requests.filter((r) => r.status !== 'archived' && r.requestKind === tab.key).length;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => { setFilter(tab.key); setTabSwitched(true); }}
                  className={`relative flex shrink-0 flex-1 items-center justify-center gap-1 rounded-[13px] px-3 py-2 text-[13px] transition-colors ${
                    active ? 'font-bold text-[#191F28]' : 'font-semibold text-[#8B95A1]'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="pro-inquiry-tab-pill"
                      className="absolute inset-0 rounded-[13px] bg-white shadow-sm"
                      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span className="relative whitespace-nowrap">{tab.label}</span>
                  {count > 0 && (
                    <span className={`relative text-[12px] tabular-nums ${active ? 'text-[#3182F6]' : 'text-[#B0B8C1]'}`}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </LayoutGroup>
      </div>

      <div key={filter} style={tabSwitched ? { animation: 'proPageExpand 0.32s cubic-bezier(0.16, 1, 0.3, 1) both' } : undefined}>
        {/* 첫 응답 전엔 '없어요' 대신 뼈대 — 캐시 없이 들어오면 빈 안내가 잠깐 비치던 것 */}
        {filtered.length === 0 && !hasFetchedOnce ? (
          <div className="space-y-7 px-4 pt-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex animate-pulse gap-2.5">
                <div className="h-[42px] w-[42px] shrink-0 rounded-full bg-[#F2F4F6]" />
                <div className="flex-1 space-y-2.5 pt-1">
                  <div className="h-4 w-1/3 rounded bg-[#F2F4F6]" />
                  <div className="h-3.5 w-1/5 rounded bg-[#F2F4F6]" />
                  <div className="h-4 w-3/4 rounded bg-[#F2F4F6]" />
                  <div className="h-11 rounded-[12px] bg-[#F9FAFB]" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div
            className={`flex min-h-[46vh] flex-col items-center justify-center px-6 py-16 text-center ${enterWindow ? 'qd-a-item' : ''}`}
            style={enterWindow ? { animationDelay: '.3s' } : undefined}
          >
            <EmptyDocumentIcon size={72} className="mb-4" />
            <p className="text-[17px] font-bold text-[#191F28]">{filter === 'archived' ? '보관한 요청이 없어요' : '새 요청이 없어요'}</p>
            <p className="mt-2 text-[14px] leading-6 text-[#8B95A1]">고객이 견적을 요청하면 여기에 바로 떠요.</p>
          </div>
        ) : (
          filtered.slice(0, renderCount).map((request) => {
            const single = request.requestKind === 'single';
            const parts = request.eventPart ? request.eventPart.split(', ').filter(Boolean) : [];
            const busy = initiatingChat === request.id;
            return (
              // 웨딩숲 글 카드(.tcard)와 같은 계층 — 왼쪽 프사 칸 · 오른쪽 이름줄/시간/본문/태그/버튼
              <article
                key={request.id}
                className="flex gap-2.5 border-b border-[#F2F4F6] px-4 pb-4 pt-[18px] last:border-b-0 min-[601px]:gap-3 min-[601px]:pb-[18px] min-[601px]:pt-[22px]"
                style={enterStyle(request.id)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={request.customerImage}
                  alt=""
                  className="h-[42px] w-[42px] shrink-0 rounded-full bg-[#F2F4F6] object-cover min-[601px]:h-12 min-[601px]:w-12"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1">
                  {/* 이름(16·굵게) + 종류 배지(웨딩숲 배지: 모서리 6·13.5) — 개인요청=나를 골라 보낸 요청(파랑) · 모두에게=여러 사회자에게 함께(회색) */}
                  <div className="flex items-center gap-1.5 pt-px">
                    <strong className="min-w-0 truncate text-[16px] font-bold tracking-[-0.3px] text-[#191F28] min-[601px]:text-[17px]">{request.customerName}</strong>
                    <span
                      className={`inline-flex h-6 shrink-0 items-center rounded-[6px] px-[7px] text-[13.5px] font-semibold tracking-[-0.2px] ${
                        single ? 'bg-[#E8F3FF] text-[#3182F6]' : 'bg-[#F2F4F6] text-[#6B7684]'
                      }`}
                    >
                      {single ? '개인요청' : '모두에게'}
                    </span>
                  </div>
                  {/* 메타 — 받은 시각(회색 14) */}
                  <p className="mt-1 text-[14px] tracking-[-0.2px] text-[#8B95A1] min-[601px]:text-[15px]">{timeAgo(request.deliveredAt)}</p>

                  {/* 본문(16.5) — 행사 일시·장소, 고객 메모 */}
                  <div className="mt-3 space-y-1 text-[16.5px] leading-[1.5] tracking-[-0.3px] text-[#191F28] min-[601px]:text-[17.5px]">
                    <p className="flex items-center gap-1.5">
                      <CalendarIcon size={18} className="shrink-0 text-[#B0B8C1]" />
                      <span className="min-w-0 truncate">{`${formatEventDate(request.eventDate)} ${formatTime(request.eventTime)}`.trim()}</span>
                    </p>
                    {request.eventLocation && (
                      <p className="flex items-center gap-1.5">
                        <PinLocationIcon size={18} className="shrink-0 text-[#B0B8C1]" />
                        <span className="min-w-0 truncate">{request.eventLocation}</span>
                      </p>
                    )}
                  </div>
                  {request.note && (
                    <p className="mt-2.5 whitespace-pre-line break-words text-[16.5px] leading-[1.65] tracking-[-0.3px] text-[#191F28] min-[601px]:text-[17.5px]">{request.note}</p>
                  )}

                  {/* 태그 — 웨딩숲 카테고리 칩(회색 · 모서리 6 · 13) */}
                  {parts.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-x-2 gap-y-1.5">
                      {parts.map((part) => (
                        <span key={part} className="rounded-[6px] bg-[#F2F4F6] px-[9px] py-1 text-[13px] font-semibold text-[#6B7684]">{part}</span>
                      ))}
                    </div>
                  )}

                  {/* 답하기 */}
                  <div className="mt-3.5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setRejectReason(''); setRejectTarget(request.id); }}
                      disabled={busy}
                      className="h-11 flex-1 rounded-[12px] bg-[#F2F4F6] text-[16px] font-semibold text-[#4E5968] transition active:scale-[0.97] disabled:opacity-50"
                    >
                      거절
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartChat(request)}
                      disabled={busy}
                      className="flex h-11 flex-[1.6] items-center justify-center gap-1.5 rounded-[12px] bg-[#3182F6] text-[16px] font-semibold text-white transition active:scale-[0.97] disabled:opacity-60"
                    >
                      <ChatBubbleIcon size={17} className="shrink-0" />
                      {busy ? '연결 중' : '채팅으로 답하기'}
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}
        {filtered.length > renderCount && <div ref={renderMoreRef} className="h-12" aria-hidden="true" />}
        {filtered.length <= renderCount && (hasMore || loadingMore) && (
          <div ref={loadMoreRef} className="flex h-12 items-center justify-center">
            {loadingMore && <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-gray-400" />}
          </div>
        )}
      </div>

      {rejectTarget && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setRejectTarget(null)}>
          <div className="w-full max-w-[440px] rounded-t-[24px] bg-white px-5 pb-8 pt-5 sm:rounded-[24px]" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#E5E8EB] sm:hidden" />
            <h2 className="text-[18px] font-bold text-[#191F28]">요청을 거절할까요?</h2>
            <p className="mt-1 text-[13.5px] text-[#8B95A1]">적은 사유는 고객에게 전달돼요. (선택)</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="예) 요청하신 날짜에 선약이 있어 진행이 어려워요."
              rows={3}
              maxLength={200}
              className="mt-3 w-full resize-none rounded-[16px] border-[1.5px] border-[#E5E8EB] bg-white px-4 py-3 text-[16px] text-[#191F28] outline-none placeholder:text-[#B0B8C1] focus:border-[#3182F6]"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="h-12 flex-1 rounded-[14px] bg-[#F2F4F6] text-[16px] font-semibold text-[#4E5968] transition active:scale-[0.97]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => { const id = rejectTarget; const msg = rejectReason.trim(); setRejectTarget(null); if (id) handleReject(id, msg || undefined); }}
                className="h-12 flex-1 rounded-[14px] bg-[#F04452] text-[16px] font-semibold text-white transition active:scale-[0.97]"
              >
                거절하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
