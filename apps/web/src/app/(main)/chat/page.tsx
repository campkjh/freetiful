'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pin, PinOff, Trash2, Archive, X, Eye, EyeOff, MessageCircle } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';
import { getCachedChatRoomsFast, getCachedChatRoomsForCurrentUser, useChatStore } from '@/lib/store/chat.store';
import { chatApi } from '@/lib/api/chat.api';
import { preWarmExistingRoom } from '@/lib/chat-prewarm';
import { getProfileImageUrl } from '@/lib/default-profile';

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
  matchRequestId?: string | null;
  latestQuotationStatus?: string | null;
}

type FilterTab = '전체' | '읽음' | '안 읽음' | '보관';

type ProFilterTab = '전체' | '읽음' | '안 읽음' | '보관';

const CHAT_LIST_LIMIT = 24;
const MESSAGE_PREWARM_LIMIT = 15;

const ClientAvatar = ({ name, id }: { name: string; id?: string }) => (
  <img
    src={getProfileImageUrl(null, id || name)}
    alt={name}
    draggable={false}
    className="w-[48px] h-[48px] rounded-[20px] object-cover shrink-0 bg-gray-100"
    onError={(e) => { e.currentTarget.src = getProfileImageUrl(null, name); }}
  />
);

function getLastMessagePreview(message?: { type?: string; content?: string | null } | null) {
  if (!message) return '';
  if (message.type === 'image') return '사진을 보냈습니다';
  if (message.type === 'file') return '파일을 보냈습니다';
  if (message.type === 'location') return '위치를 공유했습니다';
  if (message.type === 'sticker') return '이모티콘을 보냈습니다';
  if (message.type === 'system') return message.content || '안내 메시지를 보냈습니다';
  return message.content || '';
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
      profileImageUrl: getProfileImageUrl(r.otherUser.profileImageUrl, r.otherUser.id || r.otherUser.name),
    },
    lastMessage: getLastMessagePreview(r.lastMessage),
    lastMessageAt: r.lastMessageAt ? new Date(r.lastMessageAt).toLocaleDateString('ko-KR') : '',
    unreadCount: r.unreadCount,
    isPinned: false,
    isArchived: false,
    matchRequestId: r.matchRequestId ?? null,
    latestQuotationStatus: r.latestQuotationStatus ?? null,
  };
}

function getInitialRoomsForCurrentUser() {
  const auth = useAuthStore.getState();
  const chat = useChatStore.getState();
  if (!auth.hasHydrated || !auth.user) return getCachedChatRoomsFast().map(mapApiRoomToChatRoom);
  if (chat.roomsUserId === auth.user.id && chat.rooms.length > 0) {
    return chat.rooms.map(mapApiRoomToChatRoom);
  }
  return getCachedChatRoomsForCurrentUser().map(mapApiRoomToChatRoom);
}

export default function ChatListPage() {
  const router = useRouter();
  const [proActiveTab, setProActiveTab] = useState<ProFilterTab>('전체');
  const initialRoomsRef = useRef<ChatRoom[] | null>(null);
  const lastRefreshAtRef = useRef(0);
  const messagePrewarmRef = useRef(new Map<string, number>());
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
  const [rooms, setRooms] = useState<ChatRoom[]>(() => initialRoomsRef.current || []);
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
    fetchRooms({ limit: CHAT_LIST_LIMIT }).catch(() => {}).finally(() => setRoomsLoading(false));
  }, [authHydrated, authUser?.id, connect, disconnect, fetchRooms]);

  useEffect(() => {
    if (!authHydrated || !authUser) return;
    const refreshRooms = () => {
      const now = Date.now();
      if (now - lastRefreshAtRef.current < 10_000) return;
      lastRefreshAtRef.current = now;
      fetchRooms({ limit: CHAT_LIST_LIMIT, force: true }).catch(() => {});
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshRooms();
    };
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') refreshRooms();
    }, 15000);
    window.addEventListener('focus', refreshRooms);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('freetiful:chat-rooms-changed', refreshRooms as EventListener);
    window.addEventListener('freetiful:chat-socket-connected', refreshRooms as EventListener);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshRooms);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('freetiful:chat-rooms-changed', refreshRooms as EventListener);
      window.removeEventListener('freetiful:chat-socket-connected', refreshRooms as EventListener);
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
      if (apiRooms.length === 0 && prev.length > 0 && storeRoomsLoading) return prev;
      const localState = new Map(prev.map((room) => [room.id, {
        isPinned: room.isPinned,
        isArchived: room.isArchived,
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
  }, [storeRoomsLoading, rooms.length]);

  const filtered = useMemo(() => rooms.filter((r) => {
    if (isPro) {
      switch (proActiveTab) {
        case '읽음': return r.unreadCount === 0;
        case '안 읽음': return r.unreadCount > 0;
        case '보관': return r.isArchived;
        default: return !r.isArchived;
      }
    }
    switch (activeTab) {
      case '읽음': return r.unreadCount === 0 && !r.isArchived;
      case '안 읽음': return r.unreadCount > 0 && !r.isArchived;
      case '보관': return r.isArchived;
      default: return !r.isArchived;
    }
  }), [rooms, isPro, proActiveTab, activeTab]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return 0;
  }), [filtered]);
  const topRoomIdsKey = useMemo(() => sorted.slice(0, 3).map((room) => room.id).join('|'), [sorted]);

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
      fetchRooms({ limit: CHAT_LIST_LIMIT, force: true }).catch(() => {});
    } finally {
      setDeletingRooms(false);
    }
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

  const handlePrewarmRoom = (roomId: string, withMessages = false) => {
    const room = useChatStore.getState().rooms.find((r) => r.id === roomId);
    const warmed = room ? preWarmExistingRoom(room) : null;
    if (!withMessages) return;
    const store = useChatStore.getState();
    if (store.messageCache.get(roomId)?.length) return;
    if (warmed?.messages?.length) {
      store.messageCache.set(roomId, warmed.messages);
      return;
    }
    if (warmed?.messagesPromise) {
      warmed.messagesPromise.then((messages) => {
        if (messages.length > 0) useChatStore.getState().messageCache.set(roomId, messages);
      }).catch(() => {});
      return;
    }
    const last = messagePrewarmRef.current.get(roomId) || 0;
    if (Date.now() - last < 5000) return;
    messagePrewarmRef.current.set(roomId, Date.now());
    chatApi.getMessages(roomId, { limit: MESSAGE_PREWARM_LIMIT })
      .then((res) => {
        const messages = res.data?.data;
        if (Array.isArray(messages) && messages.length > 0) {
          useChatStore.getState().messageCache.set(roomId, messages);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (!topRoomIdsKey) return;
    const topRoomIds = topRoomIdsKey.split('|').filter(Boolean);
    const run = () => topRoomIds.forEach((roomId) => handlePrewarmRoom(roomId, true));
    if (document.documentElement.dataset.platform === 'android') {
      const timer = window.setTimeout(run, 80);
      return () => window.clearTimeout(timer);
    }
    const win = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (win.requestIdleCallback) {
      const id = win.requestIdleCallback(run, { timeout: 1200 });
      return () => win.cancelIdleCallback?.(id);
    }
    const timer = window.setTimeout(run, 350);
    return () => window.clearTimeout(timer);
  }, [topRoomIdsKey]);

  const TABS: FilterTab[] = ['전체', '읽음', '안 읽음', '보관'];
  const PRO_TABS: ProFilterTab[] = ['전체', '읽음', '안 읽음', '보관'];

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
                    hasUnread ? 'bg-blue-50/40' : ''
                  } ${
                    !hasUnread ? 'hover:bg-gray-50' : 'hover:bg-blue-100/40'
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
                    if (isPC) router.push(`/chat/${room.id}`);
                  }}
                  onMouseEnter={() => handlePrewarmRoom(room.id)}
                  onFocus={() => handlePrewarmRoom(room.id)}
                  onPointerDown={(e) => {
                    handlePrewarmRoom(room.id, true);
                    if (!isPC) handleLongPressStart(e, room);
                  }}
                  onTouchStart={() => handlePrewarmRoom(room.id, true)}
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
                      : <ClientAvatar name={room.otherUser.name} id={room.otherUser.id} />
                  ) : (
                    <Link href={editMode ? '#' : `/chat/${room.id}`} className="shrink-0" onClick={(e) => { editMode ? e.preventDefault() : handleLinkClick(e); }}>
                      {room.otherUser.profileImageUrl
                        ? <img src={room.otherUser.profileImageUrl} alt={room.otherUser.name} draggable={false} className="w-[48px] h-[48px] rounded-[20px] object-cover" />
                        : <ClientAvatar name={room.otherUser.name} id={room.otherUser.id} />
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
      <div className="hidden lg:flex h-screen bg-gray-100">
        {/* 좌측: 채팅 목록 */}
        <div className="w-[360px] bg-white border-r border-gray-200 flex flex-col shrink-0">
          <div className="px-5 pt-6 pb-3">
            <h1 className="text-[20px] font-extrabold text-gray-900 mb-3">{isPro ? '고객 문의' : '채팅'}</h1>
            <div className="flex gap-1.5 flex-wrap">
              {(isPro ? PRO_TABS : TABS).map((tab) => {
                const active = isPro ? proActiveTab === tab : activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => isPro ? setProActiveTab(tab as ProFilterTab) : setActiveTab(tab as FilterTab)}
                    className={`relative rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                      active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sorted.length === 0 ? (
              <div className="text-center py-16">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="mx-auto">
                  <path d="M20 12c0 4-3.6 7.5-8.5 7.5-1.4 0-2.7-.3-3.8-.8L3 20l1.2-3.5C3.4 15.3 3 13.7 3 12c0-4 3.6-7.5 8.5-7.5S20 8 20 12z" fill="#93C5FD"/>
                  <circle cx="8.5" cy="12" r="1.2" fill="white"/><circle cx="11.5" cy="12" r="1.2" fill="white"/><circle cx="14.5" cy="12" r="1.2" fill="white"/>
                </svg>
                <p className="text-gray-400 text-[13px] mt-3">대화가 없습니다</p>
              </div>
            ) : renderChatList(true)}
          </div>
        </div>

        {/* 우측: 대화 영역 */}
        <div className="flex-1 flex flex-col bg-white">
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-gray-100">
                <MessageCircle size={38} className="text-[#9DBEF9]" />
              </div>
              <p className="text-gray-500 text-[15px] font-semibold">대화방을 선택하세요</p>
              <p className="text-gray-400 text-[13px] mt-1">목록을 누르면 저장되는 실제 채팅방으로 이동합니다</p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Mobile ═══ */}
      <div className="lg:hidden bg-white min-h-screen pb-24">
        <div className="px-4 pt-3 pb-2">
          <div className="flex items-center justify-between h-[52px]">
            <h1 className="text-[18px] font-bold text-gray-900">{isPro ? '고객 문의' : '채팅'}</h1>
          </div>
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
                  className={`shrink-0 rounded-full px-4 py-2 text-[14px] font-medium transition-colors active:scale-95 ${active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}
                >
                  {tab}
                </button>
              );
            })}
          </div>
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
        {roomsLoading && rooms.length === 0 ? (
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
        ) : sorted.length === 0 ? (
          <div className="text-center py-20">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="mx-auto mb-4">
              <path d="M20 12c0 4-3.6 7.5-8.5 7.5-1.4 0-2.7-.3-3.8-.8L3 20l1.2-3.5C3.4 15.3 3 13.7 3 12c0-4 3.6-7.5 8.5-7.5S20 8 20 12z" fill="#93C5FD"/>
              <circle cx="8.5" cy="12" r="1.2" fill="white"/><circle cx="11.5" cy="12" r="1.2" fill="white"/><circle cx="14.5" cy="12" r="1.2" fill="white"/>
            </svg>
            <p className="text-gray-400 text-[14px]">{!isLoggedIn ? '로그인 후 채팅을 시작하세요' : currentTab === '보관' ? '보관된 채팅이 없습니다' : '아직 대화가 없습니다'}</p>
            {currentTab === '전체' && <Link href="/pros" className="text-gray-900 text-[14px] font-semibold mt-2 inline-block underline underline-offset-2">사회자 찾아보기</Link>}
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
