'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Pin, PinOff, Trash2, Archive, Search, X, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';
import { useChatStore } from '@/lib/store/chat.store';

// ─── Types ────────────────────────────────────────────────

interface ChatRoom {
  id: string;
  otherUser: { id: string; name: string; role: string; profileImageUrl: string };
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  isPinned: boolean;
  isArchived: boolean;
  isHidden?: boolean;
}

type FilterTab = '전체' | '읽음' | '안 읽음' | '보관' | '숨김';

type ProFilterTab = '전체' | '읽음' | '안 읽음' | '견적문의' | '예약확정' | '숨김';

const ClientAvatar = ({ name }: { name: string }) => (
  <div className="w-[48px] h-[48px] rounded-full bg-gray-200 flex items-center justify-center shrink-0">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" fill="#9CA3AF" />
      <path d="M4 21C4 17 7.58 14 12 14C16.42 14 20 17 20 21H4Z" fill="#9CA3AF" />
    </svg>
  </div>
);

export default function ChatListPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [proActiveTab, setProActiveTab] = useState<ProFilterTab>('전체');
  const authUser = useAuthStore((s) => s.user);
  const { connect, disconnect, fetchRooms, rooms: apiRooms } = useChatStore();

  useEffect(() => {
    const loggedIn = authUser !== null || localStorage.getItem('freetiful-logged-in') === 'true';
    setIsLoggedIn(loggedIn);
    setIsPro(authUser?.role === 'pro' || localStorage.getItem('userRole') === 'pro');

    // Connect to WebSocket and fetch real rooms if authenticated via API
    if (authUser) {
      connect();
      fetchRooms().then(() => {
        // If API returns rooms, use them; otherwise fall back to mock data
        const storeRooms = useChatStore.getState().rooms;
        if (storeRooms.length > 0) {
          setRooms(storeRooms.map((r) => ({
            id: r.id,
            otherUser: {
              id: r.otherUser.id,
              name: r.otherUser.name,
              role: '사회자',
              profileImageUrl: r.otherUser.profileImageUrl || '',
            },
            lastMessage: r.lastMessage?.content || '',
            lastMessageAt: r.lastMessageAt ? new Date(r.lastMessageAt).toLocaleDateString('ko-KR') : '',
            unreadCount: r.unreadCount,
            isPinned: false,
            isArchived: false,
            isHidden: false,
          })));
          return;
        }
      }).catch(() => {});
    }

    return () => { disconnect(); };
  }, [authUser]);

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab>('전체');
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState('');

  // 롱프레스 액션 메뉴
  const [actionMenu, setActionMenu] = useState<{ room: ChatRoom; x: number; y: number } | null>(null);
  // 미리보기 모달
  const [previewRoom, setPreviewRoom] = useState<ChatRoom | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggered = useRef(false);

  const currentTab = isPro ? proActiveTab : activeTab;

  const filtered = rooms.filter((r) => {
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
        case '견적문의': return r.lastMessage.includes('견적') || r.lastMessage.includes('문의');
        case '예약확정': return r.lastMessage.includes('확정') || r.lastMessage.includes('진행');
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
  });

  const sorted = [...filtered].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return 0;
  });

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

  const deleteSelected = () => {
    setRooms((prev) => prev.filter((r) => !selectedIds.has(r.id)));
    setSelectedIds(new Set());
    setEditMode(false);
  };

  // 단일 액션
  const handleDeleteRoom = (id: string) => {
    if (confirm('이 채팅방을 삭제하시겠습니까?')) {
      setRooms((prev) => prev.filter((r) => r.id !== id));
    }
    setActionMenu(null);
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
    }
  };

  const [pcSelectedRoom, setPcSelectedRoom] = useState<string | null>(null);
  const [pcInput, setPcInput] = useState('');

  const TABS: FilterTab[] = ['전체', '읽음', '안 읽음', '보관', '숨김'];
  const PRO_TABS: ProFilterTab[] = ['전체', '읽음', '안 읽음', '견적문의', '예약확정', '숨김'];

  const pcSelectedData = pcSelectedRoom ? rooms.find((r) => r.id === pcSelectedRoom) : null;

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
                    isPC && pcSelectedRoom === room.id ? 'bg-gray-50' : !hasUnread ? 'hover:bg-gray-50' : 'hover:bg-blue-100/40'
                  }`}
                  style={{
                    WebkitTouchCallout: 'none',
                    WebkitUserSelect: 'none',
                    userSelect: 'none',
                  }}
                  onClick={() => isPC && setPcSelectedRoom(room.id)}
                  onPointerDown={(e) => !isPC && handleLongPressStart(e, room)}
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
                      ? <img src={room.otherUser.profileImageUrl} alt={room.otherUser.name} className="w-[48px] h-[48px] rounded-full object-cover shrink-0" />
                      : <ClientAvatar name={room.otherUser.name} />
                  ) : (
                    <Link href={editMode ? '#' : `/chat/${room.id}`} className="shrink-0" onClick={(e) => { editMode ? e.preventDefault() : handleLinkClick(e); }}>
                      {room.otherUser.profileImageUrl
                        ? <img src={room.otherUser.profileImageUrl} alt={room.otherUser.name} draggable={false} className="w-[48px] h-[48px] rounded-full object-cover" />
                        : <ClientAvatar name={room.otherUser.name} />
                      }
                    </Link>
                  )}
                  {isPC ? (
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
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
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className={`text-[15px] ${hasUnread ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}>{room.otherUser.role} {room.otherUser.name}님</p>
                          <span className="text-[12px] text-gray-400">{room.lastMessageAt}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className={`text-[13px] truncate pr-2 ${hasUnread ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>{room.lastMessage}</p>
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
            <div className="relative mb-3">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="검색"
                className="w-full bg-gray-100 rounded-lg pl-9 pr-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-gray-300"
              />
            </div>
            <>
              <div className="flex gap-1.5 flex-wrap">
                {(isPro ? PRO_TABS : TABS).map((tab) => {
                  const active = isPro ? proActiveTab === tab : activeTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => isPro ? setProActiveTab(tab as ProFilterTab) : setActiveTab(tab as FilterTab)}
                      className={`relative px-3 py-1.5 rounded-full text-[12px] font-medium isolate transition-colors ${
                        active ? 'text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {active && (
                        <span
                          className="absolute inset-0 bg-gray-900 rounded-full"
                          style={{ zIndex: -1 }}
                        />
                      )}
                      <span className="relative">{tab}</span>
                    </button>
                  );
                })}
              </div>
            </>
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
          {pcSelectedData ? (
            <>
              <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
                {pcSelectedData.otherUser.profileImageUrl
                  ? <img src={pcSelectedData.otherUser.profileImageUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                  : <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center shrink-0"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" fill="#9CA3AF" /><path d="M4 21C4 17 7.58 14 12 14C16.42 14 20 17 20 21H4Z" fill="#9CA3AF" /></svg></div>
                }
                <div>
                  <p className="text-[15px] font-bold text-gray-900">{pcSelectedData.otherUser.role} {pcSelectedData.otherUser.name}님</p>
                  <p className="text-[12px] text-gray-400">마지막 메시지: {pcSelectedData.lastMessageAt}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6 bg-gray-50">
                <div className="max-w-[700px] mx-auto space-y-4">
                  <div className="flex justify-center">
                    <span className="bg-gray-200 text-gray-500 text-[11px] px-3 py-1 rounded-full">견적 요청으로 대화가 시작되었습니다</span>
                  </div>
                  <div className="flex justify-end">
                    <div className="bg-gray-900 text-white px-4 py-2.5 rounded-2xl rounded-br-md max-w-[400px]">
                      <p className="text-[14px]">안녕하세요! 문의 드립니다.</p>
                      <p className="text-[10px] text-gray-400 mt-1 text-right">읽음</p>
                    </div>
                  </div>
                  <div className="flex gap-2.5">
                    {pcSelectedData.otherUser.profileImageUrl
                      ? <img src={pcSelectedData.otherUser.profileImageUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 mt-0.5" />
                      : <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0 mt-0.5"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" fill="#9CA3AF" /><path d="M4 21C4 17 7.58 14 12 14C16.42 14 20 17 20 21H4Z" fill="#9CA3AF" /></svg></div>
                    }
                    <div>
                      <p className="text-[12px] text-gray-500 mb-1">{pcSelectedData.otherUser.name}</p>
                      <div className="bg-white border border-gray-200 px-4 py-2.5 rounded-2xl rounded-bl-md max-w-[400px] shadow-sm">
                        <p className="text-[14px] text-gray-900">{pcSelectedData.lastMessage}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-200 bg-white">
                <div className="flex items-center gap-3 max-w-[700px] mx-auto">
                  <input
                    type="text"
                    value={pcInput}
                    onChange={(e) => setPcInput(e.target.value)}
                    placeholder="메시지를 입력하세요..."
                    className="flex-1 bg-gray-100 rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-gray-300"
                    onKeyDown={(e) => { if (e.key === 'Enter' && pcInput.trim()) setPcInput(''); }}
                  />
                  <button className="bg-gray-900 text-white px-5 py-3 rounded-xl text-[14px] font-medium hover:bg-gray-800 transition-colors shrink-0">
                    전송
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-4xl">💬</span>
                </div>
                <p className="text-gray-400 text-[15px] font-medium">대화를 선택하세요</p>
                <p className="text-gray-300 text-[13px] mt-1">좌측 목록에서 채팅방을 클릭하면 대화가 표시됩니다</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ Mobile ═══ */}
      <div className="lg:hidden bg-white min-h-screen pb-24">
        <div className="px-4 pt-3 pb-2">
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
          <>
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
                    className={`relative shrink-0 px-4 py-2 rounded-full text-[14px] font-medium isolate transition-colors active:scale-95 ${active ? 'text-white' : 'text-gray-500 bg-gray-100'}`}
                  >
                    {active && (
                      <span
                        className="absolute inset-0 bg-gray-900 rounded-full"
                        style={{ zIndex: -1 }}
                      />
                    )}
                    <span className="relative">{tab}</span>
                  </button>
                );
              })}
            </div>
          </>
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <p
            key={activeTab}
            className="text-[13px] text-gray-400"
          >
            {activeTab} 채팅방 <span className="font-semibold text-gray-500">{sorted.length}</span>
          </p>
          <button onClick={() => { setEditMode(!editMode); setSelectedIds(new Set()); }} className="text-[13px] font-medium text-gray-500 active:scale-90 transition-transform">{editMode ? '완료' : '편집'}</button>
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
                <button onClick={deleteSelected} className="flex items-center gap-1 text-[13px] text-red-500 font-medium active:scale-90 transition-transform"><Trash2 size={14} /> 삭제</button>
              </div>
            </div>
          )}
        </>
        {sorted.length === 0 ? (
          <div className="text-center py-20">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className="mx-auto mb-4">
              <path d="M20 12c0 4-3.6 7.5-8.5 7.5-1.4 0-2.7-.3-3.8-.8L3 20l1.2-3.5C3.4 15.3 3 13.7 3 12c0-4 3.6-7.5 8.5-7.5S20 8 20 12z" fill="#93C5FD"/>
              <circle cx="8.5" cy="12" r="1.2" fill="white"/><circle cx="11.5" cy="12" r="1.2" fill="white"/><circle cx="14.5" cy="12" r="1.2" fill="white"/>
            </svg>
            <p className="text-gray-400 text-[14px]">{search ? '검색 결과가 없습니다' : !isLoggedIn ? '로그인 후 채팅을 시작하세요' : activeTab === '보관' ? '보관된 채팅이 없습니다' : '아직 대화가 없습니다'}</p>
            {!search && activeTab === '전체' && <Link href="/pros" className="text-gray-900 text-[14px] font-semibold mt-2 inline-block underline underline-offset-2">전문가 찾아보기</Link>}


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
              { label: '채팅 삭제', icon: <Trash2 size={18} />, onClick: () => handleDeleteRoom(actionMenu.room.id), className: 'text-red-500' },
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
