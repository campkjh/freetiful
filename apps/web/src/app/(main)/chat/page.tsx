'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pin, PinOff, Trash2, Archive, Search, X, Eye, EyeOff, MessageCircle } from 'lucide-react';
import { SearchIcon, CloseIcon } from '@/components/icons/mono';
import { EmptySearchIcon, MailBoxIcon } from '@/components/icons/color';
import ChatRoomView from './[id]/page';
import { motion, LayoutGroup } from 'framer-motion';
import { useAuthStore } from '@/lib/store/auth.store';
import { useChatStore } from '@/lib/store/chat.store';
import { preWarmExistingRoom } from '@/lib/chat-prewarm';

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
  matchRequestId?: string | null;
  latestQuotationStatus?: string | null;
  hasQuoteInquiry?: boolean;
  hasConfirmedBooking?: boolean;
}

type FilterTab = '전체' | '읽음' | '안 읽음' | '보관' | '숨김';

type ProFilterTab = '전체' | '읽음' | '안 읽음' | '견적문의' | '예약확정' | '숨김';

const ClientAvatar = ({ name }: { name: string }) => (
  <div className="w-[48px] h-[48px] rounded-[20px] bg-gray-200 flex items-center justify-center shrink-0">
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
    isPinned: false,
    isArchived: false,
    isHidden: false,
    matchRequestId: r.matchRequestId ?? null,
    latestQuotationStatus: r.latestQuotationStatus ?? null,
    hasQuoteInquiry: !!r.hasQuoteInquiry,
    hasConfirmedBooking: !!r.hasConfirmedBooking,
  };
}

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

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return 0;
  }), [filtered]);

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

  const TABS: FilterTab[] = ['전체', '읽음', '안 읽음', '숨김'];
  const PRO_TABS: ProFilterTab[] = ['전체', '읽음', '안 읽음', '숨김'];

  // 채팅 목록 렌더 (모바일/PC 공용)
  const renderChatList = (isPC = false) => (
    <>
      <ul className="divide-y divide-gray-100">
        <>
          {sorted.map((room) => {
            const hasUnread = room.unreadCount > 0;
            return (
              <li
                key={room.id}
                className="relative"
              >
                <div
                  className={`relative flex items-center gap-3 px-5 py-4 cursor-pointer transition-colors overflow-hidden ${
                    isPC && selectedRoomId === room.id
                      ? 'bg-[#EAF2FF]'
                      : hasUnread
                        ? 'bg-blue-50/40 hover:bg-blue-100/40'
                        : 'hover:bg-gray-50'
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
                  {/* 안 읽은 메시지 - 은은한 파란 배경 */}
                  {hasUnread && (
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{
                        background: 'linear-gradient(90deg, rgba(59,130,246,0.08) 0%, rgba(59,130,246,0.03) 100%)',
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
                  {isPC ? (
                    room.otherUser.profileImageUrl
                      ? <img src={room.otherUser.profileImageUrl} alt={room.otherUser.name} className="w-[48px] h-[48px] rounded-[20px] object-cover shrink-0" />
                      : <ClientAvatar name={room.otherUser.name} />
                  ) : (
                    <Link href={editMode ? '#' : `/chat/${room.id}`} className="shrink-0" onClick={(e) => { editMode ? e.preventDefault() : handleLinkClick(e); }}>
                      {room.otherUser.profileImageUrl
                        ? <img src={room.otherUser.profileImageUrl} alt={room.otherUser.name} draggable={false} className="w-[48px] h-[48px] rounded-[20px] object-cover" />
                        : <ClientAvatar name={room.otherUser.name} />
                      }
                    </Link>
                  )}
                  {isPC ? (
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                          room.iAmPro ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                        }`}>
                          {room.iAmPro ? '고객' : 'PRO'}
                        </span>
                        <p className={`text-[14px] ${hasUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-800'}`}>
                          {room.otherUser.role} {room.otherUser.name}님
                        </p>
                        <span className="text-[11px] text-gray-400">{room.lastMessageAt}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className={`text-[12px] truncate pr-2 ${hasUnread ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>{room.lastMessage}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          {hasUnread && <span className="bg-[#007AFF] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center">{room.unreadCount}</span>}
                          {room.isPinned && <Pin size={12} className="text-gray-400 fill-gray-400" />}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Link href={editMode ? '#' : `/chat/${room.id}`} className="flex-1 min-w-0" onClick={(e) => { editMode ? e.preventDefault() : handleLinkClick(e); }}>
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                            room.iAmPro ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                          }`}>
                            {room.iAmPro ? '고객' : 'PRO'}
                          </span>
                          <p className="truncate text-[16px] font-semibold text-[#2B313D]">{room.otherUser.name}</p>
                          <span className="ml-auto shrink-0 text-[14px] font-normal text-[#A4ABBA]">{room.lastMessageAt}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className={`truncate pr-2 text-[14px] ${hasUnread ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>{room.lastMessage}</p>
                          <div className="flex items-center gap-2 shrink-0">
                            {hasUnread && <span className="bg-[#007AFF] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{room.unreadCount}</span>}
                          </div>
                        </div>
                      </Link>
                      <>
                        {!editMode && room.isPinned && (
                          <button
                            key="pin"
                            onClick={(e) => { e.stopPropagation(); togglePin(room.id); }}
                            className="shrink-0 p-1 overflow-hidden"
                            aria-label="고정 해제"
                          >
                            <Pin size={16} className="text-gray-900 fill-gray-900" />
                          </button>
                        )}
                      </>
                    </>
                  )}
                </div>
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
      <div className="hidden h-full min-h-0 gap-4 py-5 lg:flex lg:min-h-[calc(100vh-140px)]">
        {/* 좌측: 채팅 목록 — 헤더에서 띄우고 모서리를 둥글린 카드 */}
        <div className="flex w-[360px] shrink-0 flex-col overflow-hidden rounded-[24px] bg-white">
          {/* 제목은 전역 헤더(홈·Biz·채팅…)와 겹쳐서 PC 에선 빼고, 검색·탭만 남긴다 */}
          <div className="px-5 pt-5 pb-3">
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
            <LayoutGroup id="chat-tabs-desktop">
              <div className="flex w-full gap-1 rounded-2xl bg-[#F2F3F5] p-1">
                {(isPro ? PRO_TABS : TABS).map((tab) => {
                  const active = isPro ? proActiveTab === tab : activeTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => isPro ? setProActiveTab(tab as ProFilterTab) : setActiveTab(tab as FilterTab)}
                      className={`relative flex-1 rounded-[13px] px-3 py-2 text-[13px] font-semibold transition-colors ${
                        active ? 'text-[#2B313D]' : 'text-[#A4ABBA] hover:text-[#51535C]'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="chat-tab-pill-desktop"
                          className="absolute inset-0 rounded-[13px] bg-white shadow-sm"
                          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                        />
                      )}
                      <span className="relative">{tab}</span>
                    </button>
                  );
                })}
              </div>
            </LayoutGroup>
          </div>
          <div
            key={`pc-${isPro ? proActiveTab : activeTab}`}
            className="flex-1 overflow-y-auto"
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
              <div className="py-16 text-center">
                {search ? <EmptySearchIcon size={56} className="mx-auto" /> : <MailBoxIcon size={56} className="mx-auto" />}
                <p className="mt-3 text-[13px] text-[#A4ABBA]">{search ? '검색 결과가 없습니다' : '대화가 없습니다'}</p>
              </div>
            ) : renderChatList(true)}
          </div>
        </div>

        {/* 우측: 대화 영역 — 방을 고르면 그 자리에서 열린다 */}
        <div className="relative flex flex-1 flex-col overflow-hidden rounded-[24px] bg-white">
          {selectedRoomId ? (
            <ChatRoomView key={selectedRoomId} roomId={selectedRoomId} embedded />
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <MailBoxIcon size={76} className="mx-auto mb-4" />
                <p className="text-[15px] font-semibold text-[#51535C]">대화방을 선택하세요</p>
                <p className="mt-1 text-[13px] text-[#A4ABBA]">왼쪽 목록에서 대화를 고르면 여기에 열립니다</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Mobile ═══ */}
      <div data-native-chatlist-root className="lg:hidden bg-white min-h-screen pb-24">
        <div data-native-chatlist-header className="px-4 pt-3 pb-2">
          <div className="flex items-center justify-between h-[52px]">
            <h1 className="text-[18px] font-bold text-gray-900">{isPro ? '고객 문의' : '채팅'}</h1>
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`p-2 rounded-full transition-colors active:scale-90 ${showSearch ? 'bg-gray-100' : ''}`}
            >
              <>
                {showSearch ? (
                  <span
                    key="x"
                    className="block"
                  >
                    <X size={20} className="text-gray-500" />
                  </span>
                ) : (
                  <span
                    key="search"
                    className="block"
                  >
                    <Search size={20} className="text-gray-500" />
                  </span>
                )}
              </>
            </button>
          </div>
          <>
            {showSearch && (
              <div
                key="search-input"
                className="relative"
              >
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="이름 또는 대화 내용 검색" className="w-full bg-gray-100 rounded-2xl pl-9 pr-9 py-2.5 text-[16px] focus:outline-none focus:ring-2 focus:ring-gray-300" autoFocus />
                {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X size={14} className="text-gray-400" /></button>}
              </div>
            )}
          </>
          <LayoutGroup id="chat-tabs-mobile">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
              {(isPro ? PRO_TABS : TABS).map((tab) => {
                const active = isPro ? proActiveTab === tab : activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => {
                      if (isPro) {
                        setProActiveTab(tab as ProFilterTab);
                      } else {
                        setActiveTab(tab as FilterTab);
                      }
                      setEditMode(false);
                      setSelectedIds(new Set());
                    }}
                    className={`relative shrink-0 px-4 py-2 rounded-full text-[14px] font-medium isolate active:scale-95 ${active ? 'text-white' : 'text-gray-500 bg-gray-100'}`}
                    style={{ transition: 'color 0.25s ease, transform 0.15s ease' }}
                  >
                    {active && (
                      <motion.span
                        layoutId="chat-tab-pill-mobile"
                        className="absolute inset-0 bg-gray-900 rounded-full"
                        style={{ zIndex: -1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      />
                    )}
                    <span className="relative">{tab}</span>
                  </button>
                );
              })}
            </div>
          </LayoutGroup>
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <p
            key={currentTab}
            className="text-[13px] text-gray-400"
          >
            {currentTab} 채팅방 <span className="font-semibold text-gray-500">{sorted.length}</span>
          </p>
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
              <p className="text-[14px] text-gray-400 text-center">채팅방을 불러오지 못했어요</p>
              <button
                onClick={() => {
                  setLoadTimedOut(false);
                  setRoomsLoading(true);
                  fetchRooms({ limit: 50, force: true }).catch(() => {});
                }}
                className="px-5 py-2.5 bg-gray-900 text-white text-[14px] font-semibold rounded-2xl active:scale-95 transition-transform"
              >
                다시 시도
              </button>
            </div>
          ) : (
            <div className="space-y-0">
              {[1,2,3,4,5].map((i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-12 h-12 rounded-full bg-gray-100 animate-pulse shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="h-4 w-24 bg-gray-100 rounded animate-pulse mb-2" />
                    <div className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: `${50 + i * 10}%` }} />
                  </div>
                  <div className="h-3 w-10 bg-gray-100 rounded animate-pulse shrink-0" />
                </div>
              ))}
            </div>
          )
        ) : sorted.length === 0 ? (
          <div className="text-center py-20">
            {search
              ? <EmptySearchIcon size={64} className="mx-auto mb-4" />
              : <MailBoxIcon size={64} className="mx-auto mb-4" />}
            <p className="text-gray-400 text-[14px]">{search ? '검색 결과가 없습니다' : !isLoggedIn ? '로그인 후 채팅을 시작하세요' : activeTab === '보관' ? '보관된 채팅이 없습니다' : '아직 대화가 없습니다'}</p>
            {!search && activeTab === '전체' && <Link href="/pros" className="text-gray-900 text-[14px] font-semibold mt-2 inline-block underline underline-offset-2">사회자 찾아보기</Link>}
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
            className="fixed z-[60] bg-white/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-gray-200/60 overflow-hidden min-w-[220px]"
            style={{
              left: Math.min(Math.max(16, actionMenu.x - 110), typeof window !== 'undefined' ? window.innerWidth - 236 : 0),
              top: Math.min(actionMenu.y - 20, typeof window !== 'undefined' ? window.innerHeight - 320 : 0),
              transformOrigin: 'top center',
              animation: 'chatActionPop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {[
              { label: '미리보기', icon: <Eye size={18} className="text-gray-500" />, onClick: () => handleOpenPreview(actionMenu.room), className: 'text-gray-800' },
              { label: actionMenu.room.isPinned ? '고정 해제' : '상단 고정', icon: actionMenu.room.isPinned ? <PinOff size={18} className="text-gray-500" /> : <Pin size={18} className="text-gray-500" />, onClick: () => handleTogglePinFromMenu(actionMenu.room.id), className: 'text-gray-800' },
              { label: actionMenu.room.isArchived ? '보관 해제' : '채팅 보관', icon: <Archive size={18} className="text-gray-500" />, onClick: () => handleArchiveRoom(actionMenu.room.id), className: 'text-gray-800' },
              { label: actionMenu.room.isHidden ? '숨김 해제' : '채팅 숨기기', icon: actionMenu.room.isHidden ? <Eye size={18} className="text-gray-500" /> : <EyeOff size={18} className="text-gray-500" />, onClick: () => handleHideRoom(actionMenu.room.id), className: 'text-gray-800' },
              { label: '채팅 삭제', icon: <Trash2 size={18} />, onClick: () => promptDeleteRoom(actionMenu.room), className: 'text-red-500' },
            ].map((item, idx) => (
              <button
                key={item.label}
                onClick={item.onClick}
                className={`flex items-center justify-between gap-3 px-4 py-3.5 text-[15px] hover:bg-gray-50 active:bg-gray-100 w-full font-medium ${idx > 0 ? 'border-t border-gray-100' : ''} ${item.className} ${item.className === 'text-red-500' ? 'hover:bg-red-50 active:bg-red-100' : ''}`}
                style={{
                  animation: `chatActionItemFade 0.3s cubic-bezier(0.16, 1, 0.3, 1) ${0.25 + idx * 0.04}s both`,
                }}
              >
                {item.label}
                {item.icon}
              </button>
            ))}
          </div>
        </>
      )}

      {/* ─── 미리보기 모달 (몰래 보기) ─── */}
      {previewRoom && (
        <div
          className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-[chatActionFade_0.25s_ease]"
          onClick={() => setPreviewRoom(null)}
        >
          <div
            className="w-full max-w-[420px] max-h-[80vh] bg-[#F2F2F7] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-[previewPop_0.4s_cubic-bezier(0.34,1.56,0.64,1)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 미리보기 헤더 */}
            <div className="px-5 pt-5 pb-3 bg-white border-b border-gray-100 flex items-center gap-3 shrink-0">
              {previewRoom.otherUser.profileImageUrl
                ? <img src={previewRoom.otherUser.profileImageUrl} alt="" draggable={false} className="w-10 h-10 rounded-full object-cover" />
                : <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center shrink-0"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" fill="#9CA3AF" /><path d="M4 21C4 17 7.58 14 12 14C16.42 14 20 17 20 21H4Z" fill="#9CA3AF" /></svg></div>
              }
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-gray-900 truncate">{previewRoom.otherUser.role} {previewRoom.otherUser.name}님</p>
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

            {/* 미리보기 — 마지막 메시지 */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
              {previewRoom.lastMessage && (
                <div className="flex justify-start">
                  <div className="max-w-[80%] px-4 py-2 rounded-[18px] bg-white text-gray-900 rounded-bl-[6px] shadow-sm">
                    <p className="text-[14px] whitespace-pre-wrap">{previewRoom.lastMessage}</p>
                  </div>
                </div>
              )}
            </div>

            {/* 푸터 안내 */}
            <div className="px-5 py-4 bg-white border-t border-gray-100 shrink-0">
              <p className="text-[11px] text-gray-400 text-center mb-3">읽음 표시 없이 메시지를 확인할 수 있습니다</p>
              <button
                onClick={() => setPreviewRoom(null)}
                className="w-full h-11 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[14px] font-bold rounded-2xl active:scale-[0.98] transition-transform"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 삭제 확인 모달 ─── */}
      {deleteConfirmRooms.length > 0 && (
        <div
          className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-center justify-center px-5 animate-[chatActionFade_0.2s_ease]"
          onClick={closeDeleteConfirm}
        >
          <div
            className="w-full max-w-[360px] rounded-[24px] bg-white shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-6 pb-4">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
                <Trash2 size={22} className="text-red-500" />
              </div>
              <h2 className="text-center text-[18px] font-extrabold text-gray-900">채팅방 삭제</h2>
              <p className="mt-2 text-center text-[14px] leading-6 text-gray-500">
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
              <p className="mt-3 text-center text-[12px] leading-5 text-gray-400">
                삭제하면 내 채팅 목록에서만 사라지고 상대방의 채팅방은 유지됩니다.
              </p>
            </div>
            <div className="grid grid-cols-2 border-t border-gray-100">
              <button
                type="button"
                onClick={closeDeleteConfirm}
                disabled={deletingRooms}
                className="h-14 text-[15px] font-bold text-gray-600 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmDeleteRooms}
                disabled={deletingRooms}
                className="h-14 border-l border-gray-100 text-[15px] font-bold text-red-500 disabled:opacity-50"
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
        @keyframes chatActionPop {
          0% {
            opacity: 0;
            transform: scale(0.4) translateY(-16px);
            filter: blur(12px);
          }
          35% {
            opacity: 1;
            filter: blur(4px);
          }
          60% {
            opacity: 1;
            transform: scale(1.08) translateY(2px);
            filter: blur(0);
          }
          80% {
            transform: scale(0.97) translateY(0);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
            filter: blur(0);
          }
        }
        @keyframes chatActionItemFade {
          0% { opacity: 0; transform: translateX(-6px); filter: blur(4px); }
          100% { opacity: 1; transform: translateX(0); filter: blur(0); }
        }
        @keyframes previewPop {
          0% { opacity: 0; transform: scale(0.9); filter: blur(8px); }
          60% { transform: scale(1.02); filter: blur(0); }
          100% { opacity: 1; transform: scale(1); filter: blur(0); }
        }
      `}} />

    </>
  );
}
