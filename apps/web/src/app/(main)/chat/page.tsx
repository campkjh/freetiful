'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Pin, PinOff, Trash2, Archive, Search, X } from 'lucide-react';

// ─── 더미 데이터 ────────────────────────────────────────────────

const MOCK_ROOMS = [
  {
    id: '1',
    otherUser: { id: 'pro-1', name: '이우영', role: '사회자', profileImageUrl: 'https://i.pravatar.cc/150?img=1' },
    lastMessage: '견적 정보를 보냈습니다.',
    lastMessageAt: '2026-03-26',
    unreadCount: 0,
    isPinned: true,
    isArchived: false,
  },
  {
    id: '2',
    otherUser: { id: 'pro-2', name: '이승진', role: '사회자', profileImageUrl: 'https://i.pravatar.cc/150?img=5' },
    lastMessage: '견적 정보를 보냈습니다.',
    lastMessageAt: '2026-03-26',
    unreadCount: 0,
    isPinned: true,
    isArchived: false,
  },
  {
    id: '3',
    otherUser: { id: 'pro-3', name: '김민준', role: 'MC', profileImageUrl: 'https://i.pravatar.cc/150?img=3' },
    lastMessage: '네, 4월 5일 결혼식 MC 가능합니다.',
    lastMessageAt: '2026-03-25',
    unreadCount: 3,
    isPinned: false,
    isArchived: false,
  },
  {
    id: '4',
    otherUser: { id: 'pro-4', name: '박서연', role: '사회자', profileImageUrl: 'https://i.pravatar.cc/150?img=9' },
    lastMessage: '견적서를 보내드렸습니다. 확인 부탁드립니다 😊',
    lastMessageAt: '2026-03-24',
    unreadCount: 1,
    isPinned: false,
    isArchived: false,
  },
  {
    id: '5',
    otherUser: { id: 'pro-5', name: '정하린', role: '가수', profileImageUrl: 'https://i.pravatar.cc/150?img=12' },
    lastMessage: '축가 3곡 기본이고, 추가 곡은 곡당 5만원입니다.',
    lastMessageAt: '2026-03-20',
    unreadCount: 0,
    isPinned: false,
    isArchived: true,
  },
];

type FilterTab = '전체' | '읽음' | '안 읽음' | '보관';

export default function ChatListPage() {
  const [rooms, setRooms] = useState(MOCK_ROOMS);
  const [activeTab, setActiveTab] = useState<FilterTab>('전체');
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = rooms.filter((r) => {
    // 검색 필터
    if (search) {
      const q = search.toLowerCase();
      if (!r.otherUser.name.toLowerCase().includes(q) && !r.lastMessage.toLowerCase().includes(q)) return false;
    }
    // 탭 필터
    switch (activeTab) {
      case '읽음': return r.unreadCount === 0 && !r.isArchived;
      case '안 읽음': return r.unreadCount > 0 && !r.isArchived;
      case '보관': return r.isArchived;
      default: return !r.isArchived;
    }
  });

  // 핀 고정된 것 먼저
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

  const [pcSelectedRoom, setPcSelectedRoom] = useState<string | null>(null);
  const [pcInput, setPcInput] = useState('');

  const TABS: FilterTab[] = ['전체', '읽음', '안 읽음', '보관'];

  const pcSelectedData = pcSelectedRoom ? rooms.find((r) => r.id === pcSelectedRoom) : null;

  // 채팅 목록 렌더 (모바일/PC 공용)
  const renderChatList = (isPC = false) => (
    <div className="divide-y divide-gray-100">
      {sorted.map((room) => (
        <div key={room.id} className="relative">
          <div
            className={`flex items-center gap-3 px-5 py-4 cursor-pointer transition-colors ${
              isPC && pcSelectedRoom === room.id ? 'bg-gray-50' : 'hover:bg-gray-50'
            }`}
            onClick={() => isPC && setPcSelectedRoom(room.id)}
          >
            {editMode && !isPC && (
              <button
                onClick={(e) => { e.stopPropagation(); toggleSelect(room.id); }}
                className={`shrink-0 w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center ${
                  selectedIds.has(room.id) ? 'bg-gray-900 border-gray-900' : 'border-gray-300'
                }`}
              >
                {selectedIds.has(room.id) && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                )}
              </button>
            )}
            {isPC ? (
              <img src={room.otherUser.profileImageUrl} alt={room.otherUser.name} className="w-[48px] h-[48px] rounded-full object-cover shrink-0" />
            ) : (
              <Link href={editMode ? '#' : `/chat/${room.id}`} className="shrink-0" onClick={(e) => editMode && e.preventDefault()}>
                <img src={room.otherUser.profileImageUrl} alt={room.otherUser.name} className="w-[48px] h-[48px] rounded-full object-cover" />
              </Link>
            )}
            {isPC ? (
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className={`text-[14px] ${room.unreadCount > 0 ? 'font-bold text-gray-900' : 'font-medium text-gray-800'}`}>
                    {room.otherUser.role} {room.otherUser.name}님
                  </p>
                  <span className="text-[11px] text-gray-400">{room.lastMessageAt}</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className={`text-[12px] truncate pr-2 ${room.unreadCount > 0 ? 'text-gray-600' : 'text-gray-400'}`}>{room.lastMessage}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    {room.unreadCount > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] text-center">{room.unreadCount}</span>}
                    {room.isPinned && <Pin size={12} className="text-gray-400 fill-gray-400" />}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <Link href={editMode ? '#' : `/chat/${room.id}`} className="flex-1 min-w-0" onClick={(e) => editMode && e.preventDefault()}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className={`text-[15px] ${room.unreadCount > 0 ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}>{room.otherUser.role} {room.otherUser.name}님</p>
                    <span className="text-[12px] text-gray-400">{room.lastMessageAt}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className={`text-[13px] truncate pr-2 ${room.unreadCount > 0 ? 'text-gray-700' : 'text-gray-400'}`}>{room.lastMessage}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      {room.unreadCount > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">{room.unreadCount}</span>}
                    </div>
                  </div>
                </Link>
                {!editMode && (
                  <button onClick={() => togglePin(room.id)} className="shrink-0 p-1">
                    {room.isPinned ? <Pin size={16} className="text-gray-900 fill-gray-900" /> : <PinOff size={16} className="text-gray-300" />}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <>
      {/* ═══ PC: 2-Panel Layout (카카오톡/디스코드 스타일) ═══ */}
      <div className="hidden lg:flex h-screen bg-gray-100">
        {/* 좌측: 채팅 목록 */}
        <div className="w-[360px] bg-white border-r border-gray-200 flex flex-col shrink-0">
          <div className="px-5 pt-6 pb-3">
            <h1 className="text-[20px] font-extrabold text-gray-900 mb-3">채팅</h1>
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
            <div className="flex gap-1.5">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
                    activeTab === tab ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sorted.length === 0 ? (
              <div className="text-center py-16">
                <span className="text-3xl">💬</span>
                <p className="text-gray-400 text-[13px] mt-3">대화가 없습니다</p>
              </div>
            ) : renderChatList(true)}
          </div>
        </div>

        {/* 우측: 대화 영역 */}
        <div className="flex-1 flex flex-col bg-white">
          {pcSelectedData ? (
            <>
              {/* 대화 상대 헤더 */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-3">
                <img src={pcSelectedData.otherUser.profileImageUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                <div>
                  <p className="text-[15px] font-bold text-gray-900">{pcSelectedData.otherUser.role} {pcSelectedData.otherUser.name}님</p>
                  <p className="text-[12px] text-gray-400">마지막 메시지: {pcSelectedData.lastMessageAt}</p>
                </div>
              </div>

              {/* 메시지 영역 */}
              <div className="flex-1 overflow-y-auto px-6 py-6 bg-gray-50">
                <div className="max-w-[700px] mx-auto space-y-4">
                  {/* 시스템 메시지 */}
                  <div className="flex justify-center">
                    <span className="bg-gray-200 text-gray-500 text-[11px] px-3 py-1 rounded-full">견적 요청으로 대화가 시작되었습니다</span>
                  </div>
                  {/* 내 메시지 */}
                  <div className="flex justify-end">
                    <div className="bg-gray-900 text-white px-4 py-2.5 rounded-2xl rounded-br-md max-w-[400px]">
                      <p className="text-[14px]">안녕하세요! 문의 드립니다.</p>
                      <p className="text-[10px] text-gray-400 mt-1 text-right">읽음</p>
                    </div>
                  </div>
                  {/* 상대 메시지 */}
                  <div className="flex gap-2.5">
                    <img src={pcSelectedData.otherUser.profileImageUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[12px] text-gray-500 mb-1">{pcSelectedData.otherUser.name}</p>
                      <div className="bg-white border border-gray-200 px-4 py-2.5 rounded-2xl rounded-bl-md max-w-[400px] shadow-sm">
                        <p className="text-[14px] text-gray-900">{pcSelectedData.lastMessage}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 입력 영역 */}
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

      {/* ═══ Mobile: 기존 디자인 ═══ */}
      <div className="lg:hidden bg-white min-h-screen pb-24">
        <div className="px-5 pt-14 pb-2">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-[22px] font-extrabold text-gray-900">채팅</h1>
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`p-2 rounded-full transition-colors ${showSearch ? 'bg-gray-100' : ''}`}
            >
              {showSearch ? <X size={20} className="text-gray-500" /> : <Search size={20} className="text-gray-500" />}
            </button>
          </div>
          {showSearch && (
            <div className="relative mb-3">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="이름 또는 대화 내용 검색" className="w-full bg-gray-100 rounded-full pl-9 pr-9 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-gray-300" autoFocus />
              {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X size={14} className="text-gray-400" /></button>}
            </div>
          )}
          <div className="flex gap-2">
            {TABS.map((tab) => (
              <button key={tab} onClick={() => { setActiveTab(tab); setEditMode(false); setSelectedIds(new Set()); }} className={`px-4 py-2 rounded-full text-[14px] font-medium transition-all ${activeTab === tab ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}>{tab}</button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <p className="text-[13px] text-gray-400">{activeTab} 채팅방 <span className="font-semibold text-gray-500">{sorted.length}</span></p>
          <button onClick={() => { setEditMode(!editMode); setSelectedIds(new Set()); }} className="text-[13px] font-medium text-gray-500">{editMode ? '완료' : '편집'}</button>
        </div>
        {editMode && selectedIds.size > 0 && (
          <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-2.5 bg-gray-50 border-b border-gray-100">
            <span className="text-[13px] text-gray-500">{selectedIds.size}개 선택됨</span>
            <div className="flex gap-3">
              <button onClick={archiveSelected} className="flex items-center gap-1 text-[13px] text-gray-600 font-medium"><Archive size={14} /> 보관</button>
              <button onClick={deleteSelected} className="flex items-center gap-1 text-[13px] text-red-500 font-medium"><Trash2 size={14} /> 삭제</button>
            </div>
          </div>
        )}
        {sorted.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4"><span className="text-3xl">💬</span></div>
            <p className="text-gray-400 text-[14px]">{search ? '검색 결과가 없습니다' : activeTab === '보관' ? '보관된 채팅이 없습니다' : '아직 대화가 없습니다'}</p>
            {!search && activeTab === '전체' && <Link href="/pros" className="text-gray-900 text-[14px] font-semibold mt-2 inline-block underline underline-offset-2">전문가 찾아보기</Link>}
          </div>
        ) : renderChatList(false)}
      </div>
    </>
  );
}
