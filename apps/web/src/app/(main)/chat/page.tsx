'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, X, Heart, Trash2, Calendar, SlidersHorizontal } from 'lucide-react';

// ─── 더미 데이터 (API 연동 전 테스트용) ───────────────────────────────────────

const MOCK_ROOMS = [
  {
    id: '1',
    otherUser: { id: 'pro-1', name: '김민준 MC', profileImageUrl: 'https://i.pravatar.cc/150?img=1', isActive: true },
    lastMessage: { id: 'm1', type: 'text', content: '네, 4월 5일 결혼식 MC 가능합니다. 세부 사항 안내 드리겠습니다.', createdAt: new Date().toISOString() },
    lastMessageAt: new Date().toISOString(),
    unreadCount: 3,
    isFavorited: true,
  },
  {
    id: '2',
    otherUser: { id: 'pro-2', name: '이서연 MC', profileImageUrl: 'https://i.pravatar.cc/150?img=5', isActive: false },
    lastMessage: { id: 'm2', type: 'text', content: '견적서를 보내드렸습니다. 확인 부탁드립니다 😊', createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() },
    lastMessageAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    unreadCount: 1,
    isFavorited: false,
  },
  {
    id: '3',
    otherUser: { id: 'pro-3', name: '박준혁 가수', profileImageUrl: 'https://i.pravatar.cc/150?img=3', isActive: true },
    lastMessage: { id: 'm3', type: 'text', content: '축가 3곡 기본이고, 추가 곡은 곡당 5만원입니다.', createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
    lastMessageAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    unreadCount: 0,
    isFavorited: false,
  },
  {
    id: '4',
    otherUser: { id: 'pro-4', name: '최지은 쇼호스트', profileImageUrl: 'https://i.pravatar.cc/150?img=9', isActive: false },
    lastMessage: { id: 'm4', type: 'text', content: '감사합니다! 좋은 하루 되세요.', createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
    lastMessageAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    unreadCount: 0,
    isFavorited: false,
  },
  {
    id: '5',
    otherUser: { id: 'pro-5', name: '정하린 플로리스트', profileImageUrl: 'https://i.pravatar.cc/150?img=12', isActive: true },
    lastMessage: { id: 'm5', type: 'image', content: '부케 시안 보내드립니다 💐', createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
    lastMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    unreadCount: 5,
    isFavorited: true,
  },
];

function formatTime(dateStr: string | null) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays === 1) return '어제';
  if (diffDays < 7) return `${diffDays}일 전`;
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

export default function ChatListPage() {
  const [rooms, setRooms] = useState(MOCK_ROOMS);
  const [search, setSearch] = useState('');
  const [swipedId, setSwipedId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchType, setSearchType] = useState<'text' | 'date'>('text');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // 검색 필터링
  const filtered = rooms.filter((r) => {
    if (searchType === 'text' && search) {
      return (
        r.otherUser.name.includes(search) ||
        (r.lastMessage?.content || '').includes(search)
      );
    }
    if (searchType === 'date' && dateFrom) {
      const msgDate = r.lastMessageAt || '';
      if (dateFrom && msgDate < new Date(dateFrom).toISOString()) return false;
      if (dateTo && msgDate > new Date(dateTo + 'T23:59:59').toISOString()) return false;
    }
    return true;
  });

  const toggleFavorite = (id: string) => {
    setRooms((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isFavorited: !r.isFavorited } : r))
    );
    setSwipedId(null);
  };

  const deleteRoom = (id: string) => {
    setRooms((prev) => prev.filter((r) => r.id !== id));
    setSwipedId(null);
  };

  const totalUnread = rooms.reduce((acc, r) => acc + r.unreadCount, 0);

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="px-4 pt-12 pb-3 sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">채팅</h1>
            {totalUnread > 0 && (
              <span className="bg-primary-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {totalUnread}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`p-2 rounded-lg transition-colors ${showSearch ? 'bg-primary-50 text-primary-500' : 'text-gray-600'}`}
            >
              <Search size={20} />
            </button>
          </div>
        </div>

        {/* Search Panel */}
        {showSearch && (
          <div className="space-y-2 pb-2">
            <div className="flex gap-2">
              <button
                onClick={() => setSearchType('text')}
                className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  searchType === 'text' ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                <SlidersHorizontal size={10} /> 텍스트 검색
              </button>
              <button
                onClick={() => setSearchType('date')}
                className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  searchType === 'date' ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                <Calendar size={10} /> 날짜 검색
              </button>
            </div>

            {searchType === 'text' ? (
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="이름 또는 대화 내용 검색"
                  className="w-full bg-gray-100 rounded-xl pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  autoFocus
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X size={14} className="text-gray-400" />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex gap-2 items-center">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="flex-1 bg-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
                <span className="text-xs text-gray-400">~</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="flex-1 bg-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
                {(dateFrom || dateTo) && (
                  <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="p-1">
                    <X size={16} className="text-gray-400" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Empty */}
      {filtered.length === 0 && (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">💬</span>
          </div>
          <p className="text-gray-500 text-sm">
            {search || dateFrom ? '검색 결과가 없습니다' : '아직 대화가 없습니다'}
          </p>
          {!search && !dateFrom && (
            <Link href="/pros" className="text-primary-500 text-sm font-semibold mt-2 inline-block">
              전문가 찾아보기
            </Link>
          )}
        </div>
      )}

      {/* Chat List */}
      {filtered.length > 0 && (
        <div className="divide-y divide-gray-50">
          {filtered.map((room) => (
            <div key={room.id} className="relative overflow-hidden">
              {/* Swipe Actions */}
              <div className="absolute right-0 top-0 bottom-0 flex">
                <button
                  onClick={(e) => { e.stopPropagation(); toggleFavorite(room.id); }}
                  className="w-20 bg-yellow-400 flex flex-col items-center justify-center gap-0.5"
                >
                  <Heart size={18} className={room.isFavorited ? 'fill-white text-white' : 'text-white'} />
                  <span className="text-[10px] text-white font-medium">{room.isFavorited ? '해제' : '즐겨찾기'}</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteRoom(room.id); }}
                  className="w-20 bg-red-500 flex flex-col items-center justify-center gap-0.5"
                >
                  <Trash2 size={18} className="text-white" />
                  <span className="text-[10px] text-white font-medium">삭제</span>
                </button>
              </div>

              {/* Chat Item */}
              <Link
                href={`/chat/${room.id}`}
                className={`relative flex items-center gap-3 px-4 py-3.5 bg-white transition-transform duration-200 ${
                  swipedId === room.id ? '-translate-x-40' : 'translate-x-0'
                }`}
                onTouchStart={(e) => {
                  const startX = e.touches[0].clientX;
                  const handleMove = (ev: TouchEvent) => {
                    const diff = startX - ev.touches[0].clientX;
                    if (diff > 50) setSwipedId(room.id);
                    else if (diff < -30) setSwipedId(null);
                  };
                  const handleEnd = () => {
                    document.removeEventListener('touchmove', handleMove);
                    document.removeEventListener('touchend', handleEnd);
                  };
                  document.addEventListener('touchmove', handleMove);
                  document.addEventListener('touchend', handleEnd);
                }}
                onClick={(e) => { if (swipedId === room.id) { e.preventDefault(); setSwipedId(null); } }}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <img
                    src={room.otherUser.profileImageUrl}
                    alt={room.otherUser.name}
                    className="w-[52px] h-[52px] rounded-full object-cover"
                  />
                  {room.otherUser.isActive && (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-400 border-2 border-white rounded-full" />
                  )}
                  {room.isFavorited && (
                    <span className="absolute -top-1 -right-1 text-xs">⭐</span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className={`text-sm ${room.unreadCount > 0 ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                      {room.otherUser.name}
                    </p>
                    <span className="text-[10px] text-gray-400 shrink-0">
                      {formatTime(room.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className={`text-xs truncate pr-2 ${room.unreadCount > 0 ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                      {room.lastMessage?.content || '대화를 시작하세요'}
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {room.unreadCount > 0 && (
                        <span className="bg-primary-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                          {room.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
