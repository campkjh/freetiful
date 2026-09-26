'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChatBubbleIcon, ChevronRightIcon, PinLocationIcon } from '@/components/icons/mono';
import { EmptyDocumentIcon, DocumentColorIcon, PendingIcon, RepliedIcon, DoneIcon, DeclinedIcon } from '@/components/icons/color';
import toast from 'react-hot-toast';
import { matchApi } from '@/lib/api/match.api';
import { chatApi } from '@/lib/api/chat.api';
import { preWarmExistingRoom } from '@/lib/chat-prewarm';
import { useAuthStore } from '@/lib/store/auth.store';
import { getProfileImageUrl } from '@/lib/default-profile';
import { useEntranceWindow, useListEntrance, useTabEntrance } from '@/lib/hooks/useTabEntrance';
import TitleFilterMenu, { type TitleFilterOption } from '@/components/ui/TitleFilterMenu';

type InquiryStatus = '요청중' | '요청승인' | '거래완료' | '거절';

type InquiryCard = {
  id: string;
  requestId: string;
  roomId?: string;
  proName: string;
  proImage?: string | null;
  /** 사회자 상세(/pros/[id])·채팅방 만들기에 쓴다 */
  proProfileId?: string;
  /** 사회자별 '요청 취소' 에 쓴다(전달분이 있는 카드만) */
  deliveryId?: string;
  category: string;
  location: string;
  eventDate: string;
  eventTime: string;
  createdAt: string;
  /** 화면 표기용 createdAt 과 별개로, 오래된 '요청중'을 걸러내기 위한 원본 시각 */
  createdAtIso?: string;
  status: InquiryStatus;
  declineReason?: string;
  /** 고객이 고른 조건(진행 부·분위기·선호 성별·권역·시간 협의) — 행사 칸 태그 */
  tags: string[];
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
  tags: string[];
  cards: InquiryCard[];
};

/** 행사 칸 제목 = 행사 일시 — 종류는 거의 전부 '사회자'라 구분이 안 돼서 뺐다(260926 사장 "사회자·공용 그림 필요없음") */
function eventTitle(g: { eventDate: string; eventTime: string }) {
  if (g.eventDate === '일자 미정') return '행사일 미정';
  return g.eventTime && g.eventTime !== '시간 미정' ? `${g.eventDate} ${g.eventTime}` : g.eventDate;
}

/** 고객이 고른 조건 → 태그(260926 사장 "1부 예식인지·어떤 분위기인지 내가 고른 게 안 보인다").
 *  rawUserInput 실키: eventPart('1부'·'1부예식'·'2부예식') · part('1부 (본식)', 퀵매칭) · mood · genderPref · region · timeStart('협의') */
function requestTags(request: any): string[] {
  const raw = request?.rawUserInput && typeof request.rawUserInput === 'object' ? request.rawUserInput : {};
  const tags: string[] = [];
  const add = (value?: unknown) => {
    const text = typeof value === 'string' ? value.trim() : '';
    if (text && !tags.includes(text)) tags.push(text);
  };
  [raw.eventPart, raw.part]
    .filter((v) => typeof v === 'string')
    .join(', ')
    .split(/\s*,\s*/)
    .forEach((part: string) => add(part.replace(/^(\d부)\s*(예식)$/, '$1 $2')));
  add(raw.mood);
  if (raw.genderPref === 'female') add('여성 사회자 선호');
  else if (raw.genderPref === 'male') add('남성 사회자 선호');
  add(raw.region);
  if (typeof raw.timeStart === 'string' && raw.timeStart.trim() === '협의') add('시간 협의');
  return tags;
}

/** 사회자별 진행 상태 태그 — 웨딩숲 배지 모양(h24 · 모서리 6 · 13.5), 상태색 */
function StatusTag({ status }: { status: InquiryStatus }) {
  return (
    <span className={`inline-flex h-6 shrink-0 items-center rounded-[6px] px-[7px] text-[13.5px] font-semibold tracking-[-0.2px] ${getStatusTone(status)}`}>
      {status}
    </span>
  );
}

function buildCards(requests: any[]): InquiryCard[] {
  return requests.flatMap((request) => {
    // 고객이 취소한 요청은 목록에서 뺀다(대화 중이던 방은 채팅 탭에 그대로 남는다)
    if (request?.status === 'cancelled') return [];
    const rooms = Array.isArray(request.chatRooms) ? request.chatRooms : [];
    const deliveries = (Array.isArray(request.deliveries) ? request.deliveries : []).filter((d: any) => d?.status !== 'cancelled');
    const base = {
      requestId: request.id,
      category: request.eventCategory?.name || request.category?.name || '사회자 문의',
      location: request.eventLocation || '장소 미정',
      eventDate: formatEventDate(request.eventDate),
      eventTime: formatTime(request.eventTime),
      createdAt: formatDate(request.createdAt),
      createdAtIso: request.createdAt,
      tags: requestTags(request),
    };

    const deliveryCards = deliveries.map((delivery: any) => {
      const room = rooms.find((item: any) => item.proProfileId === delivery.proProfileId);
      const latestQuotation = Array.isArray(room?.quotations) ? room.quotations[0] : null;
      const paid = latestQuotation?.payment?.status === 'completed' || latestQuotation?.status === 'paid';
      // 승인 = 사회자가 수락(replied)했을 때만. 예전엔 '방이 있으면 승인'이었는데, 이제 고객이 채팅 아이콘으로 먼저 방을 열 수 있어서
      // 방만 보고 판단하면 사회자가 안 받았는데도 '요청승인'이 된다(운영 데이터상 요청에 묶인 방은 전부 replied 라 기존 표시는 그대로)
      const approved = delivery.status === 'replied';
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
        proProfileId: delivery.proProfileId || proProfile?.id,
        deliveryId: delivery.id,
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
      proProfileId: room?.proProfileId || room?.proProfile?.id,
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

  // 프로필(사진·이름) 누름 — 요청중이거나 아직 방이 없으면 사회자 상세, 방이 있으면 그 대화로(260926 사장)
  const openProfile = (item: InquiryCard) => {
    if ((item.status === '요청중' || !item.roomId) && item.proProfileId) {
      router.push(`/pros/${item.proProfileId}`);
      return;
    }
    if (item.roomId) router.push(`/chat/${item.roomId}`);
  };

  // 요청 취소 — 사회자 한 명에게 보낸 요청만 거둔다(확인 시트 → API → 그 줄을 뺌, 행사에 남은 줄이 없으면 행사째 빠진다)
  const [cancelTarget, setCancelTarget] = useState<InquiryCard | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const confirmCancel = async () => {
    const target = cancelTarget;
    if (!target?.deliveryId || cancelling) return;
    setCancelling(true);
    try {
      await matchApi.cancelDelivery(target.deliveryId);
      setRequests((prev) => {
        const next = prev.map((r: any) => (r?.id === target.requestId
          ? { ...r, deliveries: (Array.isArray(r.deliveries) ? r.deliveries : []).map((d: any) => (d?.id === target.deliveryId ? { ...d, status: 'cancelled' } : d)) }
          : r));
        writeCustomerInquiriesCache(authUser?.id, next);
        return next;
      });
      setCancelTarget(null);
      toast.success('요청을 취소했어요');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || '요청을 취소하지 못했어요');
    } finally {
      setCancelling(false);
    }
  };

  // 오른쪽 채팅 아이콘 — 방이 있으면 바로, 없으면 이 요청으로 방을 만들어 바로 말을 남기게
  const [openingChatId, setOpeningChatId] = useState<string | null>(null);
  const startChat = async (item: InquiryCard) => {
    if (item.roomId) {
      router.push(`/chat/${item.roomId}`);
      return;
    }
    if (!item.proProfileId || openingChatId) return;
    setOpeningChatId(item.id);
    try {
      const res = await chatApi.createRoom(item.proProfileId, item.requestId);
      const room = (res as any)?.data;
      const roomId: string | undefined = room?.id || room?.roomId;
      if (!roomId) {
        toast.error('채팅방을 열지 못했어요');
        return;
      }
      if (room?.otherUser) preWarmExistingRoom(room);
      // 다음에 누르면 바로 열리게 목록에도 방을 붙여 둔다(상태는 사회자가 수락해야 '요청승인')
      setRequests((prev) => {
        const next = prev.map((r: any) => (r?.id === item.requestId
          ? { ...r, chatRooms: [...(Array.isArray(r.chatRooms) ? r.chatRooms : []), { id: roomId, proProfileId: item.proProfileId, quotations: [] }] }
          : r));
        writeCustomerInquiriesCache(authUser?.id, next);
        return next;
      });
      router.push(`/chat/${roomId}`);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || '채팅방을 열지 못했어요');
    } finally {
      setOpeningChatId(null);
    }
  };

  // 요청(행사) 단위로 묶는다 — 같은 행사 정보를 사회자마다 반복하지 않게(보낸 순서 유지)
  const groups = useMemo<InquiryGroup[]>(() => {
    const map = new Map<string, InquiryGroup>();
    for (const c of visibleCards) {
      let g = map.get(c.requestId);
      if (!g) {
        g = { requestId: c.requestId, category: c.category, location: c.location, eventDate: c.eventDate, eventTime: c.eventTime, createdAt: c.createdAt, tags: c.tags, cards: [] };
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

  // 제목 '매칭 ⌄' — 알림처럼 눌러서 진행 상태를 고른다(260926 사장 — 탭 대신). 개수는 메뉴 줄 오른쪽
  const statusOptions: TitleFilterOption<InquiryStatus | '전체'>[] = [
    { key: '전체', label: '전체', title: '매칭', icon: <img src="/icons/toss/list.svg" alt="" className="h-6 w-6" />, count: statusCounts['전체'] || 0 },
    { key: '요청중', label: '요청중', title: '요청중', icon: <PendingIcon size={24} />, count: statusCounts['요청중'] || 0 },
    { key: '요청승인', label: '요청승인', title: '요청승인', icon: <RepliedIcon size={24} />, count: statusCounts['요청승인'] || 0 },
    { key: '거래완료', label: '거래완료', title: '거래완료', icon: <DoneIcon size={24} />, count: statusCounts['거래완료'] || 0 },
    { key: '거절', label: '거절', title: '거절', icon: <DeclinedIcon size={24} />, count: statusCounts['거절'] || 0 },
  ];
  const pickStatus = (key: InquiryStatus | '전체') => { setStatusTab(key); setTabSwitched(true); };

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
          <TitleFilterMenu<InquiryStatus | '전체'>
            value={statusTab}
            onChange={pickStatus}
            options={statusOptions}
            enterClassName={entrance ? 'qd-a-title' : ''}
          />
          <Link
            href="/pros"
            className="flex h-9 items-center gap-1 rounded-full bg-[#F2F4F6] pl-3 pr-2.5 text-[13px] font-semibold text-[#4E5968] transition-transform active:scale-95"
          >
            사회자 찾기
            <ChevronRightIcon size={14} className="text-[#8B95A1]" />
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1120px] items-start gap-8 lg:grid-cols-[1fr_340px] lg:pt-8">
        <div className="min-w-0">
          {/* PC 타이틀 */}
          <div className="mb-5 hidden lg:block">
            <TitleFilterMenu<InquiryStatus | '전체'>
              value={statusTab}
              onChange={pickStatus}
              options={statusOptions}
              titleClassName="text-[26px]"
              enterClassName={entrance ? 'qd-a-title' : ''}
            />
            <p className="mt-1 text-[14px] text-[#8B95A1]">보낸 문의와 사회자별 진행 상태를 한눈에 확인하세요</p>
          </div>

          {loading ? (
            <div className="space-y-7 px-4 pt-5 lg:px-0">
              {[0, 1, 2].map((item) => (
                <div key={item} className="animate-pulse">
                  <div className="space-y-2.5 pt-1">
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
                // 웨딩숲 글 카드(.tcard) 계층 — 제목(16 굵게, 행사 일시)/메타(14 회색)/본문(16.5, 장소)/사회자 줄(댓글 계층).
                // 종류('사회자')와 공용 그림 칸은 칸마다 똑같아서 뺐다
                <section
                  key={g.requestId}
                  className="border-b border-[#F2F4F6] px-4 pb-4 pt-[18px] last:border-b-0 min-[601px]:pb-[18px] min-[601px]:pt-[22px] lg:px-0"
                  style={enterStyle(g.requestId)}
                >
                  <div className="min-w-0">
                    {/* 제목 — 행사 일시 */}
                    <p className="truncate pt-px text-[16px] font-bold tracking-[-0.3px] text-[#191F28] min-[601px]:text-[17px]">{eventTitle(g)}</p>
                    {/* 메타 — 신청일 · 몇 명에게 문의했는지(회색 14) */}
                    <p className="mt-1 text-[14px] tracking-[-0.2px] text-[#8B95A1] min-[601px]:text-[15px]">
                      {g.createdAt} 신청 · {g.cards.length}명에게 문의
                    </p>

                    {/* 본문(16.5) — 장소 */}
                    <p className="mt-3 flex items-center gap-1.5 text-[16.5px] leading-[1.5] tracking-[-0.3px] text-[#191F28] min-[601px]:text-[17.5px]">
                      <PinLocationIcon size={18} className="shrink-0 text-[#B0B8C1]" />
                      <span className="min-w-0 truncate">{g.location}</span>
                    </p>

                    {/* 내가 고른 조건 — 웨딩숲 카테고리 칩(회색 · 모서리 6 · 13) */}
                    {g.tags.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-x-2 gap-y-1.5">
                        {g.tags.map((tag) => (
                          <span key={tag} className="rounded-[6px] bg-[#F2F4F6] px-[9px] py-1 text-[13px] font-semibold text-[#6B7684]">{tag}</span>
                        ))}
                      </div>
                    )}

                    {/* 문의한 사회자 — 웨딩숲 댓글 줄 계층(프사 36 · 이름 15 굵게 · 상태 배지) */}
                    <ul className="mt-3.5 overflow-hidden rounded-[16px] bg-[#F9FAFB]">
                      {g.cards.map((item) => (
                        <li key={item.id} className="flex items-center border-b border-white last:border-b-0">
                          {/* 프로필 — 요청중이면 사회자 상세, 대화가 열려 있으면 그 대화로 */}
                          <button
                            type="button"
                            onClick={() => openProfile(item)}
                            className="flex min-w-0 flex-1 items-center gap-2.5 py-3 pl-3.5 pr-2 text-left transition-colors active:bg-[#F2F4F6] lg:hover:bg-[#F2F4F6]"
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
                                <span className="mt-1 line-clamp-2 break-words text-[14px] leading-[1.45] tracking-[-0.2px] text-[#191F28]">거절 사유 · {item.declineReason}</span>
                              )}
                            </span>
                          </button>
                          {/* 요청 취소 — 아직 답하지 않은 사회자에게만(사회자 옆) */}
                          {item.status === '요청중' && item.deliveryId && (
                            <button
                              type="button"
                              onClick={() => setCancelTarget(item)}
                              className="mr-2 h-9 shrink-0 rounded-full bg-white px-3 text-[13.5px] font-semibold tracking-[-0.2px] text-[#6B7684] transition active:scale-95"
                            >
                              요청 취소
                            </button>
                          )}
                          {/* 채팅 — 누르면 바로 대화(방이 없으면 이 요청으로 연다). 거절한 사회자에겐 없음 */}
                          {item.status !== '거절' && (
                            <button
                              type="button"
                              onClick={() => startChat(item)}
                              disabled={openingChatId === item.id}
                              aria-label={`${item.proName} 사회자와 채팅`}
                              className="mr-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#3182F6] transition active:scale-90 disabled:opacity-60"
                            >
                              {openingChatId === item.id
                                ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#D6E6FF] border-t-[#3182F6]" />
                                : <ChatBubbleIcon size={20} />}
                            </button>
                          )}
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

      {/* 요청 취소 확인 시트 — 공통 모달(웨딩숲 톤 · 버튼 56/17/17) */}
      {cancelTarget && (
        <div className="ft-scrim" onClick={() => !cancelling && setCancelTarget(null)}>
          <div className="ft-sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="ft-grab" aria-hidden="true" />
            <h2 className="ft-title">{cancelTarget.proName} 사회자에게 보낸{'\n'}요청을 취소할까요?</h2>
            <p className="ft-desc">취소하면 사회자의 새 요청 목록에서 빠져요.</p>
            <div className="ft-actions">
              <button type="button" className="ft-btn secondary" onClick={() => setCancelTarget(null)} disabled={cancelling}>닫기</button>
              <button type="button" className="ft-btn danger" onClick={confirmCancel} disabled={cancelling}>
                {cancelling ? '취소하는 중' : '요청 취소'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
