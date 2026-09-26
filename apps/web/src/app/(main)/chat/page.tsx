'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pin, PinOff, Trash2, Archive, X, Eye, EyeOff, MessageCircle } from 'lucide-react';
import { SearchIcon, CloseIcon } from '@/components/icons/mono';
import { EmptySearchIcon } from '@/components/icons/color';
import ChatEmptyBubbles from '@/components/ChatEmptyBubbles';
import ChatRoomView from './[id]/page';
import { useAuthStore } from '@/lib/store/auth.store';
import { useChatStore } from '@/lib/store/chat.store';
import { popItemDelay } from '@/lib/pop-menu';
import ChatSwipeRow from '@/components/chat/ChatSwipeRow';
import toast from 'react-hot-toast';
import { chatApi } from '@/lib/api/chat.api';
import { preWarmExistingRoom } from '@/lib/chat-prewarm';
import { useEntranceWindow, useListEntrance, useTabEntrance } from '@/lib/hooks/useTabEntrance';
import TitleFilterMenu, { type TitleFilterOption } from '@/components/ui/TitleFilterMenu';

// ─── Types ────────────────────────────────────────────────

interface ChatRoom {
  id: string;
  otherUser: { id: string; name: string; role: string; profileImageUrl: string };
  iAmPro: boolean;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  isPinned: boolean;
  isArchived: boolean;
  isHidden?: boolean;
  /** 이 방 알림 끔(서버 저장) */
  isMuted?: boolean;
  matchRequestId?: string | null;
  latestQuotationStatus?: string | null;
  hasQuoteInquiry?: boolean;
  hasConfirmedBooking?: boolean;
  /** 목록 카드: 내가 보낸 마지막 메시지(굵게) / 상대가 보낸 마지막 메시지(그 아래) */
  myLast?: string | null;
  otherLast?: string | null;
  /** 진행 단계 태그(매칭·견적전송·견적수락·예약확정 …) */
  stage?: string | null;
  lastMessageAtRaw?: string | null;
}

type FilterTab = '전체' | '읽음' | '안 읽음' | '보관' | '숨김';

type ProFilterTab = '전체' | '읽음' | '안 읽음' | '견적문의' | '예약확정' | '숨김';

const ClientAvatar = ({ name }: { name: string }) => (
  <div className="w-[44px] h-[44px] rounded-full bg-gray-200 flex items-center justify-center shrink-0">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" fill="#9CA3AF" />
      <path d="M4 21C4 17 7.58 14 12 14C16.42 14 20 17 20 21H4Z" fill="#9CA3AF" />
    </svg>
  </div>
);

// 채팅 목록 미리보기 — 사진/영상/파일 등은 URL/base64 원문 대신 라벨로 표시
function lastMsgPreview(lm: { type?: string; content?: string | null } | null | undefined): string {
  if (!lm) return '';
  switch (lm.type) {
    case 'image': return '사진을 보냈습니다';
    case 'video': return '동영상을 보냈습니다';
    case 'file': return '파일을 보냈습니다';
    case 'audio':
    case 'voice': return '음성 메시지를 보냈습니다';
    case 'location': return '위치를 공유했습니다';
    case 'quotation':
    case 'quote': return '견적서를 보냈습니다';
    default: return lm.content || '';
  }
}

function mapApiRoomToChatRoom(r: any): ChatRoom {
  return {
    id: r.id,
    iAmPro: !!r.iAmPro,
    otherUser: {
      id: r.otherUser.id,
      name: r.otherUser.name,
      // 룸 기준 역할을 사용한다. 내가 프로 측이면 상대는 고객, 아니면 상대 프로의 카테고리.
      role: r.iAmPro ? '고객' : (r.otherUser.category || '사회자'),
      profileImageUrl: r.otherUser.profileImageUrl || '',
    },
    lastMessage: lastMsgPreview(r.lastMessage),
    lastMessageAt: r.lastMessageAt ? new Date(r.lastMessageAt).toLocaleDateString('ko-KR') : '',
    unreadCount: r.unreadCount,
    isMuted: !!r.isMuted,
    isPinned: false,
    isArchived: false,
    isHidden: false,
    matchRequestId: r.matchRequestId ?? null,
    latestQuotationStatus: r.latestQuotationStatus ?? null,
    hasQuoteInquiry: !!r.hasQuoteInquiry,
    hasConfirmedBooking: !!r.hasConfirmedBooking,
    myLast: r.myLastMessage ? lastMsgPreview(r.myLastMessage) || null : null,
    otherLast: r.otherLastMessage ? lastMsgPreview(r.otherLastMessage) || null : null,
    stage: r.stage ?? null,
    lastMessageAtRaw: r.lastMessageAt ? String(r.lastMessageAt) : null,
  };
}

// 목록 시간: 방금 / N분 전 / N시간 전(오늘) / 어제 / M월 D일 / YY.M.D
function chatTime(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const sec = (now.getTime() - d.getTime()) / 1000;
  if (sec < 60) return '방금';
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  if (d.toDateString() === now.toDateString()) return `${Math.floor(sec / 3600)}시간 전`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return '어제';
  if (d.getFullYear() === now.getFullYear()) return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  return `${String(d.getFullYear()).slice(2)}.${d.getMonth() + 1}.${d.getDate()}`;
}

// 진행 단계 태그 색
const STAGE_CLASS: Record<string, string> = {
  예약확정: 'bg-[#E6F6EC] text-[#1FA35B]',
  견적수락: 'bg-[#E8F3FF] text-[#3182F6]',
  견적전송: 'bg-[#FFF1E0] text-[#E67700]',
  매칭: 'bg-[#F2EEFF] text-[#7C4DFF]',
  환불: 'bg-[#FFEEEF] text-[#F04452]',
  견적취소: 'bg-[#FFEEEF] text-[#F04452]',
};
const stageClass = (stage: string) => STAGE_CLASS[stage] || 'bg-[#F2F4F6] text-[#6B7684]';

function getInitialRoomsForCurrentUser() {
  // chat.store 가 모듈 로드 시점에 localStorage 캐시를 hydrate 하므로
  // auth.hasHydrated 를 기다리지 않고 즉시 보여줄 수 있다.
  // userId 일치 여부는 store 내부에서 lastUserId 와 대조해 이미 차단됨.
  const chat = useChatStore.getState();
  return chat.rooms.map(mapApiRoomToChatRoom);
}

export default function ChatListPage() {
  const router = useRouter();
  const [proActiveTab, setProActiveTab] = useState<ProFilterTab>('전체');
  const initialRoomsRef = useRef<ChatRoom[] | null>(null);
  const lastRefreshAtRef = useRef(0);
  if (initialRoomsRef.current === null) initialRoomsRef.current = getInitialRoomsForCurrentUser();
  const [roomsLoading, setRoomsLoading] = useState(() => initialRoomsRef.current?.length === 0);
  const authUser = useAuthStore((s) => s.user);
  const authHydrated = useAuthStore((s) => s.hasHydrated);
  const connect = useChatStore((s) => s.connect);
  const disconnect = useChatStore((s) => s.disconnect);
  const fetchRooms = useChatStore((s) => s.fetchRooms);
  const deleteRoomFromStore = useChatStore((s) => s.deleteRoom);
  const apiRooms = useChatStore((s) => s.rooms);
  // 상대가 입력 중인 방(목록에 인스타 DM처럼 점 3개) — 만료 시각이 지나면 저절로 사라지게 1초마다 다시 본다.
  const typingRooms = useChatStore((s) => s.typingRooms);
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    setNowTick(Date.now());
    if (!Object.keys(typingRooms).length) return;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [typingRooms]);
  const storeRoomsLoading = useChatStore((s) => s.roomsLoading);
  const lastRoomsFetchAt = useChatStore((s) => s.lastRoomsFetchAt);
  // 한 번도 successful fetch 가 없었으면 + 과거에 채팅을 가진 적 없으면 → skeleton.
  // 한 번이라도 채팅이 있었던 사용자라면 빈 응답이 와도 절대 "채팅 없음" 띄우지 않음.
  const hasRoomsOnceFlag = (() => {
    if (typeof window === 'undefined' || !authUser?.id) return false;
    try { return localStorage.getItem('freetiful-chat-has-rooms-once') === authUser.id; } catch { return false; }
  })();
  const hasEverLoaded = lastRoomsFetchAt > 0 && !hasRoomsOnceFlag;
  const [rooms, setRooms] = useState<ChatRoom[]>(() => initialRoomsRef.current || []);
  // 앱에서 캐시 없을 때 Railway cold start로 로딩이 오래 걸리면 스켈레톤이 영원히 유지되는 문제.
  // 8초 후에도 rooms가 비어 있으면 재시도 버튼을 표시.
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  const isLoggedIn = authHydrated && authUser !== null;
  const isPro = authUser?.role === 'pro';

  useEffect(() => {
    if (!authHydrated) return;
    if (!authUser) {
      disconnect();
      setRooms([]);
      setRoomsLoading(false);
      return;
    }
    connect();
    if (useChatStore.getState().rooms.length === 0) setRoomsLoading(true);
    fetchRooms({ limit: 50 }).catch(() => {});
    return undefined;
  }, [authHydrated, authUser?.id, connect, disconnect, fetchRooms]);

  // 로딩 타임아웃 — 8초 후 rooms가 비어 있으면 재시도 버튼 표시
  useEffect(() => {
    if (!isLoggedIn || rooms.length > 0) { setLoadTimedOut(false); return; }
    const t = window.setTimeout(() => {
      if (useChatStore.getState().rooms.length === 0) setLoadTimedOut(true);
    }, 8000);
    return () => window.clearTimeout(t);
  }, [isLoggedIn, rooms.length]);

  useEffect(() => {
    if (!authHydrated || !authUser) return;
    const refreshRooms = () => {
      const now = Date.now();
      if (now - lastRefreshAtRef.current < 2_500) return;
      lastRefreshAtRef.current = now;
      // force 를 쓰지 않는다 — store 의 revalidate 쓰로틀(5s) + inflight 가드가 중복 호출 차단.
      // socket newMessage / roomUpdated 가 실시간 업데이트 담당. 여기서는 안전망 fetch.
      fetchRooms({ limit: 50 }).catch(() => {});
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshRooms();
    };
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') refreshRooms();
    }, 15000);
    window.addEventListener('focus', refreshRooms);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('freetiful:chat-room-activity', refreshRooms as EventListener);
    window.addEventListener('freetiful:chat-rooms-changed', refreshRooms as EventListener);
    window.addEventListener('freetiful:dashboard-updated', refreshRooms as EventListener);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshRooms);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('freetiful:chat-room-activity', refreshRooms as EventListener);
      window.removeEventListener('freetiful:chat-rooms-changed', refreshRooms as EventListener);
      window.removeEventListener('freetiful:dashboard-updated', refreshRooms as EventListener);
    };
  }, [authHydrated, authUser?.id, fetchRooms]);

  // Store의 apiRooms가 업데이트되면 local rooms state도 동기화
  // 중요: role은 room별 iAmPro에 따라 결정 (글로벌 isPro 가 아님)
  // 같은 유저가 한 룸에서는 고객, 다른 룸에서는 사회자일 수 있음
  useEffect(() => {
    if (!authUser) return;
    setRooms((prev) => {
      // 방어적 처리: apiRooms 가 일시적으로 [] 가 되는 동안 (백그라운드 리프레시 실패,
      // 토큰 재발급 중 등) 기존 채팅 리스트가 깜빡 사라지지 않게 유지한다.
      // store 가 명시적으로 로딩 종료 상태에서 0 개를 반환했을 때만 비운다.
      if (apiRooms.length === 0 && storeRoomsLoading) return prev;
      const localState = new Map(prev.map((room) => [room.id, {
        isPinned: room.isPinned,
        isArchived: room.isArchived,
        isHidden: room.isHidden,
      }]));
      return apiRooms.map((apiRoom) => {
        const mapped = mapApiRoomToChatRoom(apiRoom);
        return { ...mapped, ...(localState.get(mapped.id) || {}) };
      });
    });
    if (apiRooms.length > 0) setRoomsLoading(false);
  }, [apiRooms, authUser, storeRoomsLoading]);

  const [activeTab, setActiveTab] = useState<FilterTab>('전체');
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showSearch, setShowSearch] = useState(false);
  /** PC 우측 패널에 띄울 방 (카톡 PC 형태) */
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  // 모바일: 스크롤 내리면 고정 헤더 아래로 흰 그라데이션(목록이 헤더 밑으로 자연스럽게 사라지게)
  const [listScrolled, setListScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setListScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const [search, setSearch] = useState('');
  const [deleteConfirmRooms, setDeleteConfirmRooms] = useState<ChatRoom[]>([]);
  const [deletingRooms, setDeletingRooms] = useState(false);

  // 롱프레스 액션 메뉴
  const [actionMenu, setActionMenu] = useState<{ room: ChatRoom; x: number; y: number } | null>(null);
  // 미리보기 모달
  const [previewRoom, setPreviewRoom] = useState<ChatRoom | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggered = useRef(false);

  const currentTab = isPro ? proActiveTab : activeTab;

  useEffect(() => {
    setRoomsLoading(storeRoomsLoading && rooms.length === 0);
    if (rooms.length > 0) setLoadTimedOut(false);
  }, [storeRoomsLoading, rooms.length]);

  // ─── iOS 네이티브 채팅 리스트 연동 (헤더/탭 + 행 데이터) ───
  const chatRowsRef = useRef<any[]>([]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as any;
    w.__freetifulChatList = {
      getState: () => ({ tab: currentTab, tabs: ['전체', '읽음', '안 읽음', '숨김'] }),
      setTab: (t: string) => { if (isPro) setProActiveTab(t as ProFilterTab); else setActiveTab(t as FilterTab); },
      toggleSearch: () => setShowSearch((v) => !v),
      setSearch: (q: string) => { setSearch(q || ''); setShowSearch(!!q); },
      getRooms: () => chatRowsRef.current,
      openRoom: (id: string) => router.push(`/chat/${id}`),
      hideRoom: (id: string) => handleHideRoom(id),
    };
    window.dispatchEvent(new Event('freetiful:chatlist-state'));
    window.dispatchEvent(new Event('freetiful:chatlist-rows'));
    return () => { try { if (w.__freetifulChatList) delete w.__freetifulChatList; } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTab, isPro]);

  const filtered = useMemo(() => rooms.filter((r) => {
    // 숨김 탭에서는 숨겨진 채팅만, 다른 탭에서는 숨겨진 채팅 제외
    if (currentTab === '숨김') {
      if (!r.isHidden) return false;
    } else {
      if (r.isHidden) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      if (!r.otherUser.name.toLowerCase().includes(q) && !r.lastMessage.toLowerCase().includes(q)) return false;
    }
    if (isPro) {
      switch (proActiveTab) {
        case '읽음': return r.unreadCount === 0;
        case '안 읽음': return r.unreadCount > 0;
        case '견적문의': return !!r.hasQuoteInquiry;
        case '예약확정': return !!r.hasConfirmedBooking;
        case '숨김': return true;
        default: return true;
      }
    }
    switch (activeTab) {
      case '읽음': return r.unreadCount === 0 && !r.isArchived;
      case '안 읽음': return r.unreadCount > 0 && !r.isArchived;
      case '보관': return r.isArchived;
      case '숨김': return true;
      default: return !r.isArchived;
    }
  }), [rooms, currentTab, search, isPro, proActiveTab, activeTab]);

  // 상단 고정 → 새 메시지(안 읽음) 있는 방 → 나머지. 같은 묶음 안은 원래 순서(최근 대화 순, 안정 정렬) 유지.
  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    const aNew = a.unreadCount > 0;
    const bNew = b.unreadCount > 0;
    if (aNew !== bNew) return aNew ? -1 : 1;
    return 0;
  }), [filtered]);

  // 처음 들어올 때 퀵매칭 등장(제목↑·탭↑·대화방 줄 ←) — 방에서 뒤로 돌아오거나 30초 안 재진입이면 생략
  const entrance = useTabEntrance('chat');
  const enterStyle = useListEntrance(sorted.map((r) => r.id), entrance);
  const enterWindow = useEntranceWindow(entrance);

  // 네이티브 리스트용 행 데이터 갱신 + 통지
  useEffect(() => {
    chatRowsRef.current = sorted.map((r) => ({
      id: r.id,
      name: r.otherUser?.name || '',
      image: r.otherUser?.profileImageUrl || '',
      lastMessage: r.lastMessage || '',
      time: r.lastMessageAt || '',
      unread: r.unreadCount || 0,
    }));
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('freetiful:chatlist-rows'));
  }, [sorted]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePin = (id: string) => {
    setRooms((prev) => prev.map((r) => r.id === id ? { ...r, isPinned: !r.isPinned } : r));
  };

  const archiveSelected = () => {
    setRooms((prev) => prev.map((r) => selectedIds.has(r.id) ? { ...r, isArchived: true } : r));
    setSelectedIds(new Set());
    setEditMode(false);
  };

  const promptDeleteSelected = () => {
    const targets = rooms.filter((r) => selectedIds.has(r.id));
    if (targets.length === 0) return;
    setDeleteConfirmRooms(targets);
  };

  const promptDeleteRoom = (room: ChatRoom) => {
    setActionMenu(null);
    setDeleteConfirmRooms([room]);
  };

  const closeDeleteConfirm = () => {
    if (deletingRooms) return;
    setDeleteConfirmRooms([]);
  };

  const confirmDeleteRooms = async () => {
    const targets = deleteConfirmRooms;
    if (targets.length === 0 || deletingRooms) return;

    setDeletingRooms(true);
    const targetIds = new Set(targets.map((room) => room.id));
    try {
      await Promise.all(targets.map((room) => deleteRoomFromStore(room.id)));
      setRooms((prev) => prev.filter((room) => !targetIds.has(room.id)));
      setSelectedIds(new Set());
      setEditMode(false);
      setDeleteConfirmRooms([]);
      window.dispatchEvent(new Event('freetiful:chat-rooms-changed'));
    } catch {
      alert('채팅방 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.');
      fetchRooms({ limit: 50, force: true }).catch(() => {});
    } finally {
      setDeletingRooms(false);
    }
  };

  // 알림 끄기/켜기 — 목록 스토어(서버 값)를 바로 바꾸고 API 로 저장, 실패하면 되돌린다
  const handleToggleMute = (room: ChatRoom) => {
    const next = !room.isMuted;
    const apply = (value: boolean) =>
      useChatStore.setState((s) => ({ rooms: s.rooms.map((r) => (r.id === room.id ? { ...r, isMuted: value } : r)) }));
    apply(next);
    toast(next ? '이 채팅방 알림을 껐어요' : '이 채팅방 알림을 켰어요');
    chatApi.setRoomMuted(room.id, next).catch(() => {
      apply(!next);
      toast.error('알림 설정을 바꾸지 못했어요');
    });
  };

  // 모바일 밀기 — 한 번에 한 줄만 열린다. 스크롤하면 닫는다
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null);
  useEffect(() => {
    if (!openSwipeId) return;
    const close = () => setOpenSwipeId(null);
    window.addEventListener('scroll', close, { passive: true, once: true });
    return () => window.removeEventListener('scroll', close);
  }, [openSwipeId]);

  const handleHideRoom = (id: string) => {
    setRooms((prev) => prev.map((r) => r.id === id ? { ...r, isHidden: !r.isHidden } : r));
    setActionMenu(null);
  };

  const handleArchiveRoom = (id: string) => {
    setRooms((prev) => prev.map((r) => r.id === id ? { ...r, isArchived: !r.isArchived } : r));
    setActionMenu(null);
  };

  const handleTogglePinFromMenu = (id: string) => {
    togglePin(id);
    setActionMenu(null);
  };

  const handleOpenPreview = (room: ChatRoom) => {
    setPreviewRoom(room);
    setActionMenu(null);
  };

  // 롱프레스 핸들러
  const handleLongPressStart = (e: React.PointerEvent, room: ChatRoom) => {
    if (editMode) return;
    longPressTriggered.current = false;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(20); } catch {}
      }
      setActionMenu({
        room,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    }, 450);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleLinkClick = (e: React.MouseEvent) => {
    if (longPressTriggered.current) {
      e.preventDefault();
      longPressTriggered.current = false;
      return;
    }
  };

  const handlePrewarmRoom = (roomId: string) => {
    const room = useChatStore.getState().rooms.find((r) => r.id === roomId);
    if (room) preWarmExistingRoom(room);
  };

  // 제목 '채팅 ⌄'(사회자 '고객 문의 ⌄') — 새요청·매칭처럼 탭 대신 제목을 눌러 고른다(260926 사장). 개수는 위 filtered 와 같은 규칙
  const countFor = (tab: string) => rooms.filter((r) => {
    if (tab === '숨김') return r.isHidden;
    if (r.isHidden) return false;
    if (isPro) return tab === '읽음' ? r.unreadCount === 0 : tab === '안 읽음' ? r.unreadCount > 0 : true;
    if (tab === '읽음') return r.unreadCount === 0 && !r.isArchived;
    if (tab === '안 읽음') return r.unreadCount > 0 && !r.isArchived;
    return !r.isArchived;
  }).length;
  const tabIcon = (name: string) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/icons/toss/${name}.svg`} alt="" className="h-6 w-6" />
  );
  const chatFilterOptions: TitleFilterOption<string>[] = [
    { key: '전체', label: '전체', title: isPro ? '고객 문의' : '채팅', icon: tabIcon('list'), count: countFor('전체') },
    { key: '읽음', label: '읽음', title: '읽은 대화', icon: tabIcon('check-circle'), count: countFor('읽음') },
    { key: '안 읽음', label: '안 읽음', title: '안 읽은 대화', icon: tabIcon('chat'), count: countFor('안 읽음') },
    { key: '숨김', label: '숨김', title: '숨긴 대화', icon: tabIcon('eye-off'), count: countFor('숨김') },
  ];
  const pickChatTab = (tab: string) => {
    if (isPro) setProActiveTab(tab as ProFilterTab);
    else setActiveTab(tab as FilterTab);
    setEditMode(false);
    setSelectedIds(new Set());
  };

  // 채팅 목록 렌더 (모바일/PC 공용)
  const renderChatList = (isPC = false) => (
    <>
      <ul className="divide-y divide-[#F5F6F8]">
        <>
          {sorted.map((room) => {
            const hasUnread = room.unreadCount > 0;
            return (
              <li
                key={room.id}
                className="relative"
                style={isPC ? undefined : enterStyle(room.id)}
              >
                {(() => {
                const rowEl = (
                <div
                  className={`relative flex items-start gap-3 px-5 py-[18px] cursor-pointer transition-colors overflow-hidden ${
                    isPC && selectedRoomId === room.id
                      ? 'bg-[#EAF2FF]'
                      : hasUnread && isPC
                        ? 'bg-[#F5F9FF] hover:bg-[#EDF4FF]'
                        : 'bg-white lg:hover:bg-[#FBFCFD]'
                  }`}
                  style={{
                    WebkitTouchCallout: 'none',
                    WebkitUserSelect: 'none',
                    userSelect: 'none',
                  }}
                  onClick={() => {
                    if (editMode && !isPC) {
                      toggleSelect(room.id);
                      return;
                    }
                    // PC 는 카톡 PC 처럼 우측 패널에서 연다(페이지 이동 없음)
                    if (isPC) setSelectedRoomId(room.id);
                  }}
                  onMouseEnter={() => handlePrewarmRoom(room.id)}
                  onFocus={() => handlePrewarmRoom(room.id)}
                  onPointerDown={(e) => {
                    handlePrewarmRoom(room.id);
                    if (!isPC) handleLongPressStart(e, room);
                  }}
                  onTouchStart={() => handlePrewarmRoom(room.id)}
                  onPointerUp={handleLongPressEnd}
                  onPointerLeave={handleLongPressEnd}
                  onPointerCancel={handleLongPressEnd}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  {/* 안 읽은 메시지 - 은은한 파란 배경(PC만). 모바일은 흰 배경 — 안 읽음은 '새 메시지 N' 으로만 */}
                  {hasUnread && isPC && (
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{
                        background: 'linear-gradient(90deg, rgba(49,128,247,0.07) 0%, rgba(49,128,247,0.02) 100%)',
                      }}
                      aria-hidden="true"
                    />
                  )}
                  <>
                    {editMode && !isPC && (
                      <button
                        key="checkbox"
                        onClick={(e) => { e.stopPropagation(); toggleSelect(room.id); }}
                        className={`shrink-0 h-5 rounded-full border-2 flex items-center justify-center overflow-hidden ${
                          selectedIds.has(room.id) ? 'bg-gray-900 border-gray-900' : 'border-gray-300'
                        }`}
                      >
                        {selectedIds.has(room.id) && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        )}
                      </button>
                    )}
                  </>
                  {(() => {
                    const avatar = room.otherUser.profileImageUrl ? (
                      <img
                        src={room.otherUser.profileImageUrl}
                        alt={room.otherUser.name}
                        draggable={false}
                        className="h-[44px] w-[44px] shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <ClientAvatar name={room.otherUser.name} />
                    );
                    const partnerTyping = (typingRooms[room.id] || 0) > nowTick;
                    const body = (
                      <div className="min-w-0 flex-1">
                        {/* 한 줄 헤더: 이름 · 단계 태그 · | 새 메시지 N … 시간 */}
                        <div className="flex items-center gap-1.5">
                          <p className="min-w-0 truncate text-[16px] font-bold text-[#191F28]">{room.otherUser.name}</p>
                          {room.isMuted && (
                            <span
                              aria-label="알림 꺼짐"
                              className="h-[15px] w-[15px] shrink-0 bg-[#B0B8C1]"
                              style={{ WebkitMaskImage: 'url(/icons/chat-kr/bell-off.svg)', maskImage: 'url(/icons/chat-kr/bell-off.svg)', WebkitMaskSize: 'contain', maskSize: 'contain', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat' }}
                            />
                          )}
                          {room.stage && (
                            <span className={`shrink-0 rounded-[6px] px-1.5 py-[3px] text-[12px] font-semibold ${stageClass(room.stage)}`}>
                              {room.stage}
                            </span>
                          )}
                          {hasUnread && (
                            <>
                              <span className="h-3 w-px shrink-0 bg-[#E5E8EB]" aria-hidden="true" />
                              <span className="shrink-0 text-[14px] font-semibold text-[#3182F6]">새 메시지 {room.unreadCount}</span>
                            </>
                          )}
                          <span className="ml-auto shrink-0 pl-2 text-[13px] text-[#8B95A1]">{chatTime(room.lastMessageAtRaw)}</span>
                          {room.isPinned && <Pin size={13} className="shrink-0 fill-[#3180F7] text-[#3180F7]" />}
                        </div>
                        {/* 굵게 = 내가 보낸 마지막 메시지 */}
                        {room.myLast && (
                          <p className="mt-1.5 truncate text-[15px] font-bold leading-[1.45] text-[#191F28]">{room.myLast}</p>
                        )}
                        {/* 그 아래 = 상대가 보낸 마지막 메시지(입력 중이면 점 3개) */}
                        {partnerTyping ? (
                          <div className={`${room.myLast ? 'mt-1' : 'mt-1.5'} flex items-center gap-2`} aria-live="polite">
                            <span className="inline-flex items-center gap-[3px] rounded-full bg-[#F2F3F5] px-2.5 py-[7px]" aria-hidden="true">
                              {[0, 1, 2].map((i) => (
                                <span
                                  key={i}
                                  className="block h-[5px] w-[5px] rounded-full bg-[#8B95A1]"
                                  style={{ animation: `typingDot 1.1s ease-in-out ${i * 0.16}s infinite` }}
                                />
                              ))}
                            </span>
                            <span className="text-[13.5px] text-[#8B95A1]">입력 중</span>
                          </div>
                        ) : room.otherLast ? (
                          <p
                            className={`${room.myLast ? 'mt-0.5' : 'mt-1.5'} line-clamp-2 text-[14.5px] leading-[1.5] ${
                              hasUnread ? 'text-[#333D4B]' : 'text-[#6B7684]'
                            }`}
                          >
                            {room.otherLast}
                          </p>
                        ) : !room.myLast ? (
                          <p className="mt-1.5 truncate text-[14px] text-[#8B95A1]">{room.lastMessage || '아직 대화가 없어요'}</p>
                        ) : null}
                      </div>
                    );
                    return isPC ? (
                      <>
                        {avatar}
                        {body}
                      </>
                    ) : (
                      <>
                        <Link
                          href={editMode ? '#' : `/chat/${room.id}`}
                          className="shrink-0"
                          draggable={false}
                          onClick={(e) => { editMode ? e.preventDefault() : handleLinkClick(e); }}
                        >
                          {avatar}
                        </Link>
                        <Link
                          href={editMode ? '#' : `/chat/${room.id}`}
                          className="min-w-0 flex-1"
                          draggable={false}
                          onClick={(e) => { editMode ? e.preventDefault() : handleLinkClick(e); }}
                        >
                          {body}
                        </Link>
                      </>
                    );
                  })()}
                  {!editMode && (
                    <button
                      type="button"
                      aria-label={`${room.otherUser.name}님 채팅방 메뉴`}
                      className="-mr-2 -mt-1 shrink-0 rounded-full p-1.5 text-[#B0B8C1] transition-colors hover:bg-[#F2F4F6] hover:text-[#6B7684]"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const r = e.currentTarget.getBoundingClientRect();
                        setActionMenu({ room, x: r.left + r.width / 2, y: r.top + r.height / 2 });
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
                        <circle cx="10" cy="4" r="1.7" fill="currentColor" />
                        <circle cx="10" cy="10" r="1.7" fill="currentColor" />
                        <circle cx="10" cy="16" r="1.7" fill="currentColor" />
                      </svg>
                    </button>
                  )}
                </div>
                );
                // 모바일: 오른쪽→왼쪽으로 밀면 알림 끄기·삭제 동그라미가 순서대로 통통 튀며 나온다
                if (isPC || editMode) return rowEl;
                return (
                  <ChatSwipeRow
                    open={openSwipeId === room.id}
                    onOpenChange={(o) => setOpenSwipeId(o ? room.id : null)}
                    onSwipeStart={() => {
                      handleLongPressEnd();
                      if (openSwipeId && openSwipeId !== room.id) setOpenSwipeId(null);
                    }}
                    actions={[
                      {
                        key: 'mute',
                        label: room.isMuted ? '알림 켜기' : '알림 끄기',
                        bg: '#AFB2B9',
                        icon: room.isMuted ? '/icons/chat-kr/bell.svg' : '/icons/chat-kr/bell-off.svg',
                        onClick: () => handleToggleMute(room),
                      },
                      { key: 'delete', label: '채팅 삭제', bg: '#E84B3C', icon: '/icons/chat-kr/trash.svg', onClick: () => promptDeleteRoom(room) },
                    ]}
                  >
                    {rowEl}
                  </ChatSwipeRow>
                );
                })()}
              </li>
            );
          })}
        </>
      </ul>
    </>
  );

  return (
    <>
      {/* ═══ PC: 2-Panel Layout ═══ */}
      <div className="hidden h-full min-h-0 gap-4 py-5 lg:flex lg:h-[calc(100vh-140px)]">
        {/* 좌측: 채팅 목록 — 헤더에서 띄우고 모서리를 둥글린 카드 */}
        <div className="flex w-[360px] min-h-0 shrink-0 flex-col overflow-hidden rounded-[24px] bg-white">
          {/* PC 도 제목 '채팅 ⌄' 로 고르고(탭 대신), 그 아래 검색 */}
          <div className="px-5 pt-5 pb-3">
            <div className="mb-3">
              <TitleFilterMenu<string>
                value={isPro ? proActiveTab : activeTab}
                onChange={pickChatTab}
                options={chatFilterOptions}
              />
            </div>
            <div className="relative mb-3">
              <SearchIcon size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A4ABBA]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isPro ? '고객 이름 검색' : '이름 또는 대화 내용 검색'}
                className="h-10 w-full rounded-full bg-[#F2F3F5] pl-10 pr-9 text-[13px] text-[#2B313D] outline-none transition-colors placeholder:text-[#A4ABBA] focus:bg-[#E9EBEF]"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="검색어 지우기"
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#A4ABBA] transition-colors hover:text-[#51535C]"
                >
                  <CloseIcon size={14} />
                </button>
              )}
            </div>
          </div>
          <div
            key={`pc-${isPro ? proActiveTab : activeTab}`}
            className="min-h-0 flex-1 overflow-y-auto"
            style={{ animation: 'proPageExpand 0.32s cubic-bezier(0.16, 1, 0.3, 1) both' }}
          >
            {(roomsLoading || !hasEverLoaded) && rooms.length === 0 && isLoggedIn ? (
              loadTimedOut ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <p className="text-[13px] text-gray-400">채팅방을 불러오지 못했어요</p>
                  <button
                    onClick={() => {
                      setLoadTimedOut(false);
                      setRoomsLoading(true);
                      fetchRooms({ limit: 50, force: true }).catch(() => {});
                    }}
                    className="px-4 py-2 bg-gray-900 text-white text-[13px] font-semibold rounded-xl active:scale-95 transition-transform"
                  >
                    다시 시도
                  </button>
                </div>
              ) : (
                <div className="space-y-0">
                  {[1,2,3,4,5].map((i) => (
                    <div key={i} className="flex items-center gap-3 px-5 py-4">
                      <div className="w-12 h-12 rounded-[20px] bg-gray-100 animate-pulse shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="h-4 w-28 bg-gray-100 rounded animate-pulse mb-2" />
                        <div className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: `${46 + i * 8}%` }} />
                      </div>
                      <div className="h-3 w-10 bg-gray-100 rounded animate-pulse shrink-0" />
                    </div>
                  ))}
                </div>
              )
            ) : sorted.length === 0 ? (
              <div className="flex min-h-[280px] flex-col items-center justify-center py-10 text-center">
                {search ? <EmptySearchIcon size={56} className="mx-auto" /> : <ChatEmptyBubbles size={132} className="mx-auto" />}
                <p className="mt-3 text-[13px] text-[#A4ABBA]">{search ? '검색 결과가 없습니다' : '대화가 없습니다'}</p>
              </div>
            ) : renderChatList(true)}
          </div>
        </div>

        {/* 우측: 대화 영역 — 방을 고르면 그 자리에서 열린다 */}
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] bg-white">
          {selectedRoomId ? (
            <ChatRoomView key={selectedRoomId} roomId={selectedRoomId} embedded />
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <ChatEmptyBubbles size={190} className="mx-auto mb-5" />
                <p className="text-[16px] font-bold text-[#2B313D]">이어가던 대화를 다시 시작해 볼까요?</p>
                <p className="mt-1.5 text-[13px] text-[#A4ABBA]">대화를 선택하고 자유롭게 이야기해 보세요.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Mobile ═══ */}
      <div data-native-chatlist-root className="lg:hidden bg-white min-h-screen pb-24">
        <div data-native-chatlist-header className="sticky top-0 z-20 bg-white px-4 pb-2 pt-2">
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-x-0 top-full h-8 bg-gradient-to-b from-white via-white/70 to-white/0 transition-opacity duration-300 ${
              listScrolled ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <div className="flex h-14 items-center justify-between">
            <TitleFilterMenu<string>
              value={isPro ? proActiveTab : activeTab}
              onChange={pickChatTab}
              options={chatFilterOptions}
              enterClassName={entrance ? 'qd-a-title' : ''}
            />
            <button
              type="button"
              onClick={() => setShowSearch(!showSearch)}
              aria-label={showSearch ? '검색 닫기' : '검색'}
              className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors active:scale-90 ${
                showSearch ? 'bg-[#F2F3F5] text-[#2B313D]' : 'text-[#A4ABBA]'
              }`}
            >
              {showSearch ? <CloseIcon size={19} /> : <SearchIcon size={19} />}
            </button>
          </div>

          {showSearch && (
            <div className="relative mb-2">
              <SearchIcon size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#A4ABBA]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="이름 또는 대화 내용 검색"
                autoFocus
                className="h-12 w-full rounded-[14px] bg-[#F2F3F5] pl-11 pr-10 text-[16px] font-medium text-[#2B313D] outline-none transition-colors placeholder:font-normal placeholder:text-[#A4ABBA] focus:bg-[#EDEFF2]"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="검색어 지우기"
                  className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[#A4ABBA] active:bg-[#E4E7EB]"
                >
                  <CloseIcon size={15} />
                </button>
              )}
            </div>
          )}

        </div>
        <>
          {editMode && selectedIds.size > 0 && (
            <div
              key="bulk-bar"
              className="sticky top-0 z-10 flex items-center justify-between px-5 py-2.5 bg-gray-50 border-b border-gray-100 overflow-hidden"
            >
              <span className="text-[13px] text-gray-500">{selectedIds.size}개 선택됨</span>
              <div className="flex gap-3">
                <button onClick={archiveSelected} className="flex items-center gap-1 text-[13px] text-gray-600 font-medium active:scale-90 transition-transform"><Archive size={14} /> 보관</button>
                <button onClick={promptDeleteSelected} className="flex items-center gap-1 text-[13px] text-red-500 font-medium active:scale-90 transition-transform"><Trash2 size={14} /> 삭제</button>
              </div>
            </div>
          )}
        </>
        {(roomsLoading || !hasEverLoaded) && rooms.length === 0 && isLoggedIn ? (
          loadTimedOut ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <p className="text-center text-[15px] font-bold text-[#2B313D]">채팅방을 불러오지 못했어요</p>
              <button
                onClick={() => {
                  setLoadTimedOut(false);
                  setRoomsLoading(true);
                  fetchRooms({ limit: 50, force: true }).catch(() => {});
                }}
                className="h-11 rounded-[14px] bg-[#3180F7] px-6 text-[14px] font-bold text-white transition-transform active:scale-95"
              >
                다시 시도
              </button>
            </div>
          ) : (
            <div className="space-y-0">
              {[1,2,3,4,5].map((i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-4">
                  <div className="h-12 w-12 shrink-0 animate-pulse rounded-[20px] bg-[#F2F3F5]" />
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 h-4 w-24 animate-pulse rounded-full bg-[#F2F3F5]" />
                    <div className="h-3 animate-pulse rounded-full bg-[#F2F3F5]" style={{ width: `${50 + i * 10}%` }} />
                  </div>
                  <div className="h-3 w-10 shrink-0 animate-pulse rounded-full bg-[#F2F3F5]" />
                </div>
              ))}
            </div>
          )
        ) : sorted.length === 0 ? (
          // 남는 공간 한가운데로 — 위에 붙여 두면 스티키 탭에 애니메이션이 잘린다
          <div
            className={`flex min-h-[calc(100dvh-320px)] flex-col items-center justify-center px-6 pb-10 text-center ${enterWindow ? 'qd-a-item' : ''}`}
            style={enterWindow ? { animationDelay: '.3s' } : undefined}
          >
            {search
              ? <EmptySearchIcon size={64} className="mx-auto mb-4" />
              : <ChatEmptyBubbles size={176} className="mx-auto mb-6" />}
            <p className="text-[16px] font-bold text-[#2B313D]">{search ? '검색 결과가 없습니다' : !isLoggedIn ? '로그인 후 채팅을 시작하세요' : activeTab === '보관' ? '보관된 채팅이 없습니다' : '이어가던 대화를 다시 시작해 볼까요?'}</p>
            {!search && isLoggedIn && activeTab !== '보관' && (
              <p className="mt-1.5 text-[13px] text-[#A4ABBA]">마음에 드는 사회자에게 문의하면 여기에서 대화할 수 있어요.</p>
            )}
            {!search && activeTab === '전체' && <Link href="/pros" className="mt-3 inline-flex h-11 items-center justify-center rounded-[14px] bg-[#3180F7] px-6 text-[14px] font-bold text-white">사회자 찾아보기</Link>}
          </div>
        ) : renderChatList(false)}
      </div>

      {/* ─── 롱프레스 액션 메뉴 ─── */}
      {actionMenu && (
        <>
          <div
            className="fixed inset-0 z-[55] bg-black/30 animate-[chatActionFade_0.2s_ease]"
            style={{ backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
            onClick={() => setActionMenu(null)}
          />
          <div
            // 툴팁 메뉴 공통(globals .pop-menu) — 작게 시작해 정비율로 커지고, 항목은 오른쪽→왼쪽으로 촤라락
            className="pop-menu nt-menu fixed z-[60] overflow-hidden"
            style={{
              left: Math.min(Math.max(16, actionMenu.x - 110), typeof window !== 'undefined' ? window.innerWidth - 236 : 0),
              top: Math.min(actionMenu.y - 20, typeof window !== 'undefined' ? window.innerHeight - 320 : 0),
              transformOrigin: 'top center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {[
              // 알림 메뉴 어법 — 왼쪽 토스 컬러 아이콘(사장이 준 아이콘) · 이름 17
              { label: '미리보기', icon: 'eye', onClick: () => handleOpenPreview(actionMenu.room) },
              { label: actionMenu.room.isPinned ? '고정 해제' : '상단 고정', icon: 'pin', onClick: () => handleTogglePinFromMenu(actionMenu.room.id) },
              { label: actionMenu.room.isArchived ? '보관 해제' : '채팅 보관', icon: 'folder', onClick: () => handleArchiveRoom(actionMenu.room.id) },
              { label: actionMenu.room.isHidden ? '숨김 해제' : '채팅 숨기기', icon: actionMenu.room.isHidden ? 'eye' : 'eye-off', onClick: () => handleHideRoom(actionMenu.room.id) },
              { label: '채팅 삭제', icon: 'bin', onClick: () => promptDeleteRoom(actionMenu.room), danger: true },
            ].map((item, idx) => (
              <button
                key={item.label}
                onClick={item.onClick}
                className={`pop-menu-item nt-menu-item${item.danger ? ' danger' : ''}`}
                style={popItemDelay(idx)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/icons/toss/${item.icon}.svg`} alt="" />
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* ─── 미리보기 모달 (몰래 보기) — 공통 시트(ft-*) ─── */}
      {previewRoom && (
        <div className="ft-scrim" onClick={() => setPreviewRoom(null)}>
          <div
            className="ft-sheet flex flex-col"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ft-grab shrink-0" aria-hidden="true" />
            {/* 미리보기 헤더 */}
            <div className="flex items-center gap-3 shrink-0">
              {previewRoom.otherUser.profileImageUrl
                ? <img src={previewRoom.otherUser.profileImageUrl} alt="" draggable={false} className="w-10 h-10 rounded-full object-cover" />
                : <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center shrink-0"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" fill="#9CA3AF" /><path d="M4 21C4 17 7.58 14 12 14C16.42 14 20 17 20 21H4Z" fill="#9CA3AF" /></svg></div>
              }
              <div className="flex-1 min-w-0">
                <p className="ft-title break-words">{previewRoom.otherUser.role} {previewRoom.otherUser.name}님</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                    <EyeOff size={10} />
                    몰래 보기 · 읽음 표시 안 됨
                  </span>
                </div>
              </div>
              <button onClick={() => setPreviewRoom(null)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center active:scale-90 transition-transform">
                <X size={18} className="text-gray-500" />
              </button>
            </div>

            {/* 미리보기 — 마지막 메시지(흰 시트 위라 채팅방 받은 말풍선 색) */}
            <div className="mt-5 flex-1 overflow-y-auto space-y-2">
              {previewRoom.lastMessage && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] px-4 py-2 rounded-[18px] bg-[#F2F3F5] text-[#2B313D] rounded-bl-[6px]">
                    <p className="text-[14px] whitespace-pre-wrap">{previewRoom.lastMessage}</p>
                  </div>
                </div>
              )}
            </div>

            {/* 푸터 안내 */}
            <div className="mt-3 shrink-0">
              <p className="ft-desc">읽음 표시 없이 메시지를 확인할 수 있습니다</p>
              <div className="ft-actions">
                <button
                  onClick={() => setPreviewRoom(null)}
                  className="ft-btn secondary"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── 삭제 확인 모달 — 공통 시트(ft-*) ─── */}
      {deleteConfirmRooms.length > 0 && (
        <div className="ft-scrim" onClick={closeDeleteConfirm}>
          <div
            className="ft-sheet"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ft-grab" aria-hidden="true" />
            <div>
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
                <Trash2 size={22} className="text-red-500" />
              </div>
              <h2 className="ft-title">채팅방 삭제</h2>
              <p className="ft-desc">
                {deleteConfirmRooms.length === 1
                  ? `${deleteConfirmRooms[0].otherUser.name}님과의 채팅방을 삭제할까요?`
                  : `선택한 ${deleteConfirmRooms.length}개의 채팅방을 삭제할까요?`}
              </p>
              {deleteConfirmRooms.length > 1 && (
                <div className="mt-4 rounded-2xl bg-gray-50 px-4 py-3">
                  {deleteConfirmRooms.slice(0, 3).map((room) => (
                    <p key={room.id} className="truncate text-[13px] text-gray-600">
                      {room.otherUser.name}님
                    </p>
                  ))}
                  {deleteConfirmRooms.length > 3 && (
                    <p className="mt-1 text-[12px] text-gray-400">외 {deleteConfirmRooms.length - 3}개</p>
                  )}
                </div>
              )}
              <p className="mt-3 text-[13px] leading-5 text-[#8B95A1]">
                삭제하면 내 채팅 목록에서만 사라지고 상대방의 채팅방은 유지됩니다.
              </p>
            </div>
            <div className="ft-actions">
              <button
                type="button"
                onClick={closeDeleteConfirm}
                disabled={deletingRooms}
                className="ft-btn secondary"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmDeleteRooms}
                disabled={deletingRooms}
                className="ft-btn danger"
              >
                {deletingRooms ? '삭제 중...' : '삭제하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes chatActionFade {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
      `}} />

    </>
  );
}
