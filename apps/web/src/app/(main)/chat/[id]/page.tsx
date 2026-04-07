'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Send, Plus, Image as ImageIcon, FileText,
  MapPin, Smile, MoreVertical, ChevronDown,
  Check, CheckCheck, Search, X, Clock,
  Copy, Reply, Edit3, Trash2, Link as LinkIcon,
  BookmarkPlus, Grid,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageType = 'text' | 'image' | 'file' | 'location' | 'link' | 'sticker' | 'system';

interface MessageItem {
  id: string;
  roomId: string;
  senderId: string;
  type: MessageType;
  content: string | null;
  metadata: Record<string, unknown> | null;
  replyToId: string | null;
  replyTo: { id: string; content: string | null; senderId: string; type: string } | null;
  isEdited: boolean;
  isDeleted: boolean;
  isRead: boolean;
  createdAt: string;
  sender: { id: string; name: string; profileImageUrl: string | null };
  reactions: { emoji: string; count: number; userIds: string[] }[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MY_ID = 'user-1';

const REACTION_EMOJIS = [
  { emoji: '❤️', label: '하트' },
  { emoji: '😢', label: '슬퍼요' },
  { emoji: '👍', label: '최고에요' },
  { emoji: '😂', label: '웃겨요' },
  { emoji: '😮', label: '놀라워요' },
  { emoji: '🔥', label: '불이야' },
];

const STICKERS = ['😀', '😂', '🥰', '😎', '🤗', '😭', '🥺', '😡', '🎉', '👏', '💪', '🙏', '❤️', '💔', '🌟', '🎵'];

const PROS: Record<string, { id: string; name: string; profileImageUrl: string; isActive: boolean }> = {
  '1': { id: 'pro-1', name: '김민준 MC', profileImageUrl: 'https://i.pravatar.cc/150?img=1', isActive: true },
  '2': { id: 'pro-2', name: '이서연 MC', profileImageUrl: 'https://i.pravatar.cc/150?img=5', isActive: false },
  '3': { id: 'pro-3', name: '박준혁 가수', profileImageUrl: 'https://i.pravatar.cc/150?img=3', isActive: true },
  '4': { id: 'pro-4', name: '최지은 쇼호스트', profileImageUrl: 'https://i.pravatar.cc/150?img=9', isActive: false },
  '5': { id: 'pro-5', name: '정하린 플로리스트', profileImageUrl: 'https://i.pravatar.cc/150?img=12', isActive: true },
};

function makeMockMessages(roomId: string, proId: string): MessageItem[] {
  const pro = PROS[roomId] || PROS['1'];
  const now = Date.now();
  return [
    { id: 's1', roomId, senderId: 'system', type: 'system', content: '견적 요청으로 대화가 시작되었습니다.', metadata: null, replyToId: null, replyTo: null, isEdited: false, isDeleted: false, isRead: true, createdAt: new Date(now - 5 * 60 * 60 * 1000).toISOString(), sender: { id: 'system', name: '시스템', profileImageUrl: null }, reactions: [] },
    { id: 'm1', roomId, senderId: MY_ID, type: 'text', content: '안녕하세요! 4월 5일 결혼식 문의 드립니다.', metadata: null, replyToId: null, replyTo: null, isEdited: false, isDeleted: false, isRead: true, createdAt: new Date(now - 4 * 60 * 60 * 1000).toISOString(), sender: { id: MY_ID, name: '나', profileImageUrl: null }, reactions: [] },
    { id: 'm2', roomId, senderId: proId, type: 'text', content: '안녕하세요! 문의 감사합니다 😊 4월 5일 토요일 맞으신가요?', metadata: null, replyToId: null, replyTo: null, isEdited: false, isDeleted: false, isRead: true, createdAt: new Date(now - 3.5 * 60 * 60 * 1000).toISOString(), sender: { id: proId, name: pro.name, profileImageUrl: pro.profileImageUrl }, reactions: [{ emoji: '❤️', count: 1, userIds: [MY_ID] }] },
    { id: 'm3', roomId, senderId: MY_ID, type: 'text', content: '네 맞습니다! 서울 강남 더시에나호텔에서 오후 2시에 시작이에요.', metadata: null, replyToId: null, replyTo: null, isEdited: false, isDeleted: false, isRead: true, createdAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(), sender: { id: MY_ID, name: '나', profileImageUrl: null }, reactions: [] },
    { id: 'm4', roomId, senderId: proId, type: 'text', content: '좋습니다, 해당 날짜 가능합니다. 견적서 보내드릴게요!', metadata: null, replyToId: null, replyTo: null, isEdited: false, isDeleted: false, isRead: true, createdAt: new Date(now - 2.5 * 60 * 60 * 1000).toISOString(), sender: { id: proId, name: pro.name, profileImageUrl: pro.profileImageUrl }, reactions: [] },
    { id: 'm5', roomId, senderId: proId, type: 'text', content: '웨딩 MC 패키지 견적: 50만원\n리허설 + 본식 진행 + 피로연 포함입니다.\n행사일: 2026-04-05', metadata: null, replyToId: null, replyTo: null, isEdited: false, isDeleted: false, isRead: true, createdAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(), sender: { id: proId, name: pro.name, profileImageUrl: pro.profileImageUrl }, reactions: [{ emoji: '👍', count: 1, userIds: [MY_ID] }] },
    { id: 'm6', roomId, senderId: MY_ID, type: 'text', content: '감사합니다! 확인 후 결제하겠습니다.', metadata: null, replyToId: 'm5', replyTo: { id: 'm5', content: '웨딩 MC 패키지 견적: 50만원', senderId: proId, type: 'text' }, isEdited: false, isDeleted: false, isRead: true, createdAt: new Date(now - 1.5 * 60 * 60 * 1000).toISOString(), sender: { id: MY_ID, name: '나', profileImageUrl: null }, reactions: [] },
    { id: 'm7', roomId, senderId: proId, type: 'text', content: '네, 편하게 말씀해주세요. 궁금한 점 있으시면 언제든 연락 주세요!', metadata: null, replyToId: null, replyTo: null, isEdited: true, isDeleted: false, isRead: false, createdAt: new Date(now - 30 * 60 * 1000).toISOString(), sender: { id: proId, name: pro.name, profileImageUrl: pro.profileImageUrl }, reactions: [] },
  ];
}

const MOCK_FREQUENT_MESSAGES = [
  { id: 'f1', content: '안녕하세요, 문의 드립니다!' },
  { id: 'f2', content: '감사합니다! 확인하겠습니다.' },
  { id: 'f3', content: '혹시 다른 날짜도 가능하신가요?' },
  { id: 'f4', content: '견적서 확인했습니다. 결제 진행할게요!' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChatRoomPage() {
  const { id: roomId } = useParams<{ id: string }>();
  const router = useRouter();
  const myId = MY_ID;
  const pro = PROS[roomId] || PROS['1'];

  // Messages state (local mock)
  const [messages, setMessages] = useState<MessageItem[]>(() => makeMockMessages(roomId, pro.id));

  // UI state
  const [input, setInput] = useState('');
  const [showAttach, setShowAttach] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showFrequentMessages, setShowFrequentMessages] = useState(false);

  // Message actions
  const [selectedMessage, setSelectedMessage] = useState<MessageItem | null>(null);
  const [showMessageActions, setShowMessageActions] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<MessageItem | null>(null);
  const [editingMessage, setEditingMessage] = useState<MessageItem | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MessageItem[]>([]);
  const [searchType, setSearchType] = useState<'text' | 'date'>('text');
  const [searchDateFrom, setSearchDateFrom] = useState('');
  const [searchDateTo, setSearchDateTo] = useState('');

  // Schedule
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleContent, setScheduleContent] = useState('');
  const [scheduledMessages, setScheduledMessages] = useState<{ id: string; content: string; scheduledAt: string }[]>([]);

  // Frequent messages
  const [frequentMessages, setFrequentMessages] = useState(MOCK_FREQUENT_MESSAGES);
  const [newFrequentMsg, setNewFrequentMsg] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const createMessage = (overrides: Partial<MessageItem> & { type: MessageType; content: string | null }): MessageItem => ({
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    roomId,
    senderId: myId,
    metadata: null,
    replyToId: replyTo?.id || null,
    replyTo: replyTo ? { id: replyTo.id, content: replyTo.content, senderId: replyTo.senderId, type: replyTo.type } : null,
    isEdited: false,
    isDeleted: false,
    isRead: false,
    createdAt: new Date().toISOString(),
    sender: { id: myId, name: '나', profileImageUrl: null },
    reactions: [],
    ...overrides,
  });

  const handleSend = () => {
    if (!input.trim()) return;

    if (editingMessage) {
      setMessages((prev) =>
        prev.map((m) => m.id === editingMessage.id ? { ...m, content: input.trim(), isEdited: true } : m)
      );
      setEditingMessage(null);
    } else {
      const newMsg = createMessage({ type: 'text', content: input.trim() });
      setMessages((prev) => [...prev, newMsg]);
    }

    setInput('');
    setReplyTo(null);
    setShowAttach(false);
    setShowEmoji(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSendSticker = (emoji: string) => {
    setMessages((prev) => [...prev, createMessage({ type: 'sticker', content: emoji })]);
    setShowStickers(false);
    setShowEmoji(false);
  };

  const handleSendLocation = () => {
    setMessages((prev) => [...prev, createMessage({
      type: 'location',
      content: '내 위치',
      metadata: { lat: 37.5665, lng: 126.978 },
    })]);
    setShowAttach(false);
  };

  const handleLinkSend = () => {
    const url = prompt('전송할 링크를 입력하세요');
    if (url) {
      setMessages((prev) => [...prev, createMessage({ type: 'link', content: url, metadata: { url } })]);
      setShowAttach(false);
    }
  };

  const handleFileUpload = (type: 'image' | 'file') => {
    // 더미: 실제로는 파일 업로드 후 URL 받아서 전송
    const fakeName = type === 'image' ? '사진.jpg' : '서류.pdf';
    setMessages((prev) => [...prev, createMessage({
      type,
      content: type === 'image' ? 'https://picsum.photos/300/200?random=' + Date.now() : fakeName,
      metadata: { fileName: fakeName, fileSize: 1024000 },
    })]);
    setShowAttach(false);
  };

  // Long press
  const handleMessageLongPress = (msg: MessageItem) => {
    if (msg.type === 'system' || msg.isDeleted) return;
    setSelectedMessage(msg);
    setShowMessageActions(true);
  };

  const handleCopyMessage = () => {
    if (selectedMessage?.content) navigator.clipboard.writeText(selectedMessage.content);
    setShowMessageActions(false);
  };

  const handleReplyMessage = () => {
    setReplyTo(selectedMessage);
    setShowMessageActions(false);
    inputRef.current?.focus();
  };

  const handleEditMessage = () => {
    if (selectedMessage && selectedMessage.senderId === myId) {
      setEditingMessage(selectedMessage);
      setInput(selectedMessage.content || '');
      inputRef.current?.focus();
    }
    setShowMessageActions(false);
  };

  const handleDeleteMessage = () => {
    if (selectedMessage && selectedMessage.senderId === myId) {
      setMessages((prev) =>
        prev.map((m) => m.id === selectedMessage.id ? { ...m, isDeleted: true, content: '삭제된 메시지입니다' } : m)
      );
    }
    setShowMessageActions(false);
  };

  const handleAddReaction = (messageId: string, emoji: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const reactions = [...m.reactions];
        const idx = reactions.findIndex((r) => r.emoji === emoji);
        if (idx >= 0) {
          const has = reactions[idx].userIds.includes(myId);
          if (has) {
            if (reactions[idx].count <= 1) reactions.splice(idx, 1);
            else reactions[idx] = { ...reactions[idx], count: reactions[idx].count - 1, userIds: reactions[idx].userIds.filter((id) => id !== myId) };
          } else {
            reactions[idx] = { ...reactions[idx], count: reactions[idx].count + 1, userIds: [...reactions[idx].userIds, myId] };
          }
        } else {
          reactions.push({ emoji, count: 1, userIds: [myId] });
        }
        return { ...m, reactions };
      })
    );
    setShowReactionPicker(null);
    setShowMessageActions(false);
  };

  // Search
  const handleSearchMessages = () => {
    if (searchType === 'text' && searchQuery) {
      setSearchResults(messages.filter((m) => m.content?.includes(searchQuery)));
    } else if (searchType === 'date' && (searchDateFrom || searchDateTo)) {
      setSearchResults(messages.filter((m) => {
        if (searchDateFrom && m.createdAt < new Date(searchDateFrom).toISOString()) return false;
        if (searchDateTo && m.createdAt > new Date(searchDateTo + 'T23:59:59').toISOString()) return false;
        return m.type !== 'system';
      }));
    }
  };

  // Schedule
  const handleCreateScheduled = () => {
    if (!scheduleContent || !scheduleDate || !scheduleTime) return;
    setScheduledMessages((prev) => [...prev, {
      id: Date.now().toString(),
      content: scheduleContent,
      scheduledAt: `${scheduleDate} ${scheduleTime}`,
    }]);
    setShowScheduleModal(false);
    setScheduleContent('');
    setScheduleDate('');
    setScheduleTime('');
    alert('예약 메시지가 등록되었습니다!');
  };

  // Frequent
  const handleAddFrequent = () => {
    if (!newFrequentMsg) return;
    setFrequentMessages((prev) => [...prev, { id: Date.now().toString(), content: newFrequentMsg }]);
    setNewFrequentMsg('');
  };

  const handleUseFrequent = (content: string) => {
    setInput(content);
    setShowFrequentMessages(false);
    inputRef.current?.focus();
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const formatMsgTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateDivider = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  };

  // Group messages by date
  const groupedMessages = messages.reduce<{ date: string; messages: MessageItem[] }[]>((acc, msg) => {
    const date = new Date(msg.createdAt).toDateString();
    const last = acc[acc.length - 1];
    if (last && last.date === date) {
      last.messages.push(msg);
    } else {
      acc.push({ date, messages: [msg] });
    }
    return acc;
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <div className="bg-white px-4 h-14 flex items-center gap-3 border-b border-gray-100 shrink-0 sticky top-0 z-20">
        <button onClick={() => router.back()} className="p-1">
          <ArrowLeft size={22} />
        </button>
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="relative shrink-0">
            <img src={pro.profileImageUrl} alt={pro.name} className="w-9 h-9 rounded-full object-cover" />
            {pro.isActive && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-white rounded-full" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{pro.name}</p>
            {pro.isActive ? (
              <p className="text-[10px] text-green-500">접속중</p>
            ) : (
              <p className="text-[10px] text-gray-400">오프라인</p>
            )}
          </div>
        </div>
        <button onClick={() => { setShowSearch(!showSearch); setShowMoreMenu(false); }} className="p-2">
          <Search size={18} className={showSearch ? 'text-primary-500' : 'text-gray-600'} />
        </button>
        <button onClick={() => { setShowMoreMenu(!showMoreMenu); setShowSearch(false); }} className="p-2">
          <MoreVertical size={18} className="text-gray-600" />
        </button>
      </div>

      {/* More Menu */}
      {showMoreMenu && (
        <div className="absolute right-4 top-14 z-30 bg-white rounded-xl shadow-lg border border-gray-100 py-1 w-44">
          <button onClick={() => { setShowPhotoGallery(true); setShowMoreMenu(false); }} className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
            <Grid size={16} /> 사진첩
          </button>
          <button onClick={() => { setShowScheduleModal(true); setShowMoreMenu(false); }} className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
            <Clock size={16} /> 예약 메시지
          </button>
          <button onClick={() => { setShowFrequentMessages(true); setShowMoreMenu(false); }} className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
            <BookmarkPlus size={16} /> 자주 쓰는 메시지
          </button>
        </div>
      )}

      {/* Search Bar */}
      {showSearch && (
        <div className="bg-white border-b border-gray-100 px-4 py-3 space-y-2">
          <div className="flex gap-2">
            <button onClick={() => setSearchType('text')} className={`text-xs px-3 py-1 rounded-full border ${searchType === 'text' ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-500 border-gray-200'}`}>
              텍스트
            </button>
            <button onClick={() => setSearchType('date')} className={`text-xs px-3 py-1 rounded-full border ${searchType === 'date' ? 'bg-primary-500 text-white border-primary-500' : 'bg-white text-gray-500 border-gray-200'}`}>
              날짜
            </button>
          </div>
          {searchType === 'text' ? (
            <div className="flex gap-2">
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearchMessages()} placeholder="메시지 내용 검색" className="flex-1 bg-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" autoFocus />
              <button onClick={handleSearchMessages} className="px-3 py-2 bg-primary-500 text-white rounded-xl text-sm">검색</button>
            </div>
          ) : (
            <div className="flex gap-2 items-center">
              <input type="date" value={searchDateFrom} onChange={(e) => setSearchDateFrom(e.target.value)} className="flex-1 bg-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none" />
              <span className="text-xs text-gray-400">~</span>
              <input type="date" value={searchDateTo} onChange={(e) => setSearchDateTo(e.target.value)} className="flex-1 bg-gray-100 rounded-xl px-3 py-2 text-sm focus:outline-none" />
              <button onClick={handleSearchMessages} className="px-3 py-2 bg-primary-500 text-white rounded-xl text-sm">검색</button>
            </div>
          )}
          {searchResults.length > 0 && (
            <div className="max-h-40 overflow-y-auto space-y-1">
              {searchResults.map((r) => (
                <div key={r.id} className="text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                  <span className="text-gray-400">{formatMsgTime(r.createdAt)}</span> {r.content}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {groupedMessages.map((group) => (
          <div key={group.date}>
            <div className="flex justify-center py-3">
              <span className="text-[10px] text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                {formatDateDivider(group.messages[0].createdAt)}
              </span>
            </div>

            {group.messages.map((msg) => {
              if (msg.type === 'system') {
                return (
                  <div key={msg.id} className="flex justify-center py-1">
                    <span className="text-[10px] text-gray-400 bg-gray-100 px-3 py-1 rounded-full">{msg.content}</span>
                  </div>
                );
              }

              if (msg.isDeleted) {
                return (
                  <div key={msg.id} className="flex justify-center py-1">
                    <span className="text-[10px] text-gray-300 italic">삭제된 메시지입니다</span>
                  </div>
                );
              }

              const isMine = msg.senderId === myId;

              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} gap-2 py-1 group`}>
                  {!isMine && (
                    <img src={pro.profileImageUrl} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 self-end" />
                  )}
                  <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[75%]`}>
                    {/* Reply preview */}
                    {msg.replyTo && (
                      <div className="text-[10px] text-gray-400 bg-gray-100 px-2 py-1 rounded-lg mb-0.5 max-w-full truncate">
                        ↩ {msg.replyTo.content}
                      </div>
                    )}

                    {/* Bubble */}
                    <div
                      className={`relative px-3.5 py-2.5 text-sm leading-relaxed cursor-pointer ${
                        msg.type === 'image' ? 'p-1 rounded-2xl overflow-hidden'
                        : msg.type === 'sticker' ? 'text-3xl bg-transparent'
                        : isMine ? 'bg-primary-500 text-white rounded-2xl rounded-br-md'
                        : 'bg-white text-gray-900 rounded-2xl rounded-bl-md shadow-sm'
                      }`}
                      onContextMenu={(e) => { e.preventDefault(); handleMessageLongPress(msg); }}
                      onTouchStart={() => {
                        const timer = setTimeout(() => handleMessageLongPress(msg), 500);
                        const clear = () => { clearTimeout(timer); document.removeEventListener('touchend', clear); document.removeEventListener('touchmove', clear); };
                        document.addEventListener('touchend', clear, { once: true });
                        document.addEventListener('touchmove', clear, { once: true });
                      }}
                    >
                      {msg.type === 'image' && <img src={msg.content || ''} alt="" className="max-w-[240px] rounded-xl" />}
                      {msg.type === 'sticker' && <span>{msg.content}</span>}
                      {msg.type === 'file' && <div className="flex items-center gap-2"><FileText size={18} /><span className="text-xs truncate">{String(msg.metadata?.fileName || msg.content)}</span></div>}
                      {msg.type === 'location' && <div className="flex items-center gap-2"><MapPin size={16} /><span>내 위치</span></div>}
                      {msg.type === 'link' && <div><LinkIcon size={14} className="inline mr-1" /><a href={msg.content || '#'} target="_blank" rel="noopener noreferrer" className="underline break-all">{msg.content}</a></div>}
                      {msg.type === 'text' && (
                        <span dangerouslySetInnerHTML={{ __html: (msg.content || '').replace(/@(\S+)/g, '<span class="font-bold text-primary-200">@$1</span>').replace(/\n/g, '<br/>') }} />
                      )}

                      {/* Hover reaction button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowReactionPicker(showReactionPicker === msg.id ? null : msg.id); }}
                        className={`absolute ${isMine ? '-left-8' : '-right-8'} top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1`}
                      >
                        <Smile size={16} className="text-gray-300" />
                      </button>
                    </div>

                    {/* Reaction picker */}
                    {showReactionPicker === msg.id && (
                      <div className="flex gap-1 bg-white rounded-full shadow-lg px-2 py-1 mt-1 border border-gray-100">
                        {REACTION_EMOJIS.map((r) => (
                          <button key={r.emoji} onClick={() => handleAddReaction(msg.id, r.emoji)} className="text-lg hover:scale-125 transition-transform p-0.5" title={r.label}>
                            {r.emoji}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Reactions display */}
                    {msg.reactions.length > 0 && (
                      <div className="flex gap-1 mt-0.5 flex-wrap">
                        {msg.reactions.map((r) => (
                          <button key={r.emoji} onClick={() => handleAddReaction(msg.id, r.emoji)} className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full border ${r.userIds.includes(myId) ? 'bg-primary-50 border-primary-200' : 'bg-gray-50 border-gray-200'}`}>
                            <span>{r.emoji}</span>
                            <span className="text-[10px] text-gray-500">{r.count}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Meta */}
                    <div className={`flex items-center gap-1 mt-0.5 ${isMine ? 'flex-row-reverse' : ''}`}>
                      <span className="text-[10px] text-gray-400">{formatMsgTime(msg.createdAt)}</span>
                      {isMine && (msg.isRead ? <CheckCheck size={12} className="text-primary-300" /> : <Check size={12} className="text-gray-300" />)}
                      {msg.isEdited && <span className="text-[10px] text-gray-300">(수정됨)</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Actions Modal */}
      {showMessageActions && selectedMessage && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-end justify-center" onClick={() => setShowMessageActions(false)}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg pb-safe" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-2" />
            <div className="p-2">
              <div className="flex justify-center gap-3 py-3 border-b border-gray-100">
                {REACTION_EMOJIS.map((r) => (
                  <button key={r.emoji} onClick={() => handleAddReaction(selectedMessage.id, r.emoji)} className="flex flex-col items-center gap-0.5">
                    <span className="text-2xl">{r.emoji}</span>
                    <span className="text-[9px] text-gray-400">{r.label}</span>
                  </button>
                ))}
              </div>
              <div className="py-1">
                <button onClick={handleCopyMessage} className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-700"><Copy size={18} className="text-gray-400" /> 복사</button>
                <button onClick={handleReplyMessage} className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-700"><Reply size={18} className="text-gray-400" /> 답장</button>
                {selectedMessage.senderId === myId && (
                  <>
                    <button onClick={handleEditMessage} className="flex items-center gap-3 w-full px-4 py-3 text-sm text-gray-700"><Edit3 size={18} className="text-gray-400" /> 수정</button>
                    <button onClick={handleDeleteMessage} className="flex items-center gap-3 w-full px-4 py-3 text-sm text-red-500"><Trash2 size={18} /> 삭제</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo Gallery Modal */}
      {showPhotoGallery && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col">
          <div className="flex items-center px-4 h-14 border-b border-gray-100">
            <button onClick={() => setShowPhotoGallery(false)} className="p-1"><ArrowLeft size={22} /></button>
            <h2 className="text-base font-bold ml-3">사진첩</h2>
            <span className="text-xs text-gray-400 ml-2">(20일 후 자동 삭제)</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {(() => {
              const photos = messages.filter((m) => m.type === 'image' && !m.isDeleted);
              return photos.length === 0 ? (
                <div className="text-center py-20 text-gray-400 text-sm">사진이 없습니다</div>
              ) : (
                <div className="grid grid-cols-3 gap-1">
                  {photos.map((photo) => (
                    <div key={photo.id} className="aspect-square relative">
                      <img src={photo.content || ''} alt="" className="w-full h-full object-cover rounded-lg" />
                      <div className="absolute bottom-1 right-1 text-[9px] text-white bg-black/50 px-1.5 py-0.5 rounded-full">{formatMsgTime(photo.createdAt)}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setShowScheduleModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold">예약 메시지</h3>
            <textarea value={scheduleContent} onChange={(e) => setScheduleContent(e.target.value)} placeholder="메시지 내용" className="w-full bg-gray-100 rounded-xl px-4 py-3 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-primary-300" />
            <div className="flex gap-2">
              <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className="flex-1 bg-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none" />
              <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="flex-1 bg-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none" />
            </div>
            {scheduledMessages.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-gray-400">예약된 메시지</p>
                {scheduledMessages.map((sm) => (
                  <div key={sm.id} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg text-xs">
                    <span className="truncate">{sm.content}</span>
                    <span className="text-gray-400 shrink-0 ml-2">{sm.scheduledAt}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowScheduleModal(false)} className="flex-1 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl">취소</button>
              <button onClick={handleCreateScheduled} className="flex-1 py-2.5 text-sm text-white bg-primary-500 rounded-xl">예약하기</button>
            </div>
          </div>
        </div>
      )}

      {/* Frequent Messages Modal */}
      {showFrequentMessages && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-end justify-center" onClick={() => setShowFrequentMessages(false)}>
          <div className="bg-white rounded-t-2xl w-full max-w-lg max-h-[60vh] flex flex-col pb-safe" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-2" />
            <h3 className="text-base font-bold px-4 pb-2">자주 쓰는 메시지</h3>
            <div className="flex-1 overflow-y-auto px-4">
              {frequentMessages.map((fm) => (
                <button key={fm.id} onClick={() => handleUseFrequent(fm.content)} className="w-full text-left px-4 py-3 text-sm text-gray-700 border-b border-gray-50 hover:bg-gray-50 flex items-center justify-between">
                  <span className="truncate">{fm.content}</span>
                  <span onClick={(e) => { e.stopPropagation(); setFrequentMessages((prev) => prev.filter((f) => f.id !== fm.id)); }} className="text-gray-300 hover:text-red-400 p-1 cursor-pointer"><X size={14} /></span>
                </button>
              ))}
            </div>
            <div className="flex gap-2 p-4 border-t border-gray-100">
              <input type="text" value={newFrequentMsg} onChange={(e) => setNewFrequentMsg(e.target.value)} placeholder="새 메시지 추가" className="flex-1 bg-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none" />
              <button onClick={handleAddFrequent} className="px-4 py-2.5 bg-primary-500 text-white rounded-xl text-sm">추가</button>
            </div>
          </div>
        </div>
      )}

      {/* Reply bar */}
      {replyTo && (
        <div className="bg-primary-50 px-4 py-2 flex items-center justify-between border-t border-primary-100">
          <div className="flex items-center gap-2 text-xs text-primary-600 min-w-0">
            <Reply size={14} />
            <span className="truncate">{replyTo.content}</span>
          </div>
          <button onClick={() => setReplyTo(null)} className="p-1"><X size={14} className="text-primary-400" /></button>
        </div>
      )}

      {/* Edit bar */}
      {editingMessage && (
        <div className="bg-yellow-50 px-4 py-2 flex items-center justify-between border-t border-yellow-100">
          <div className="flex items-center gap-2 text-xs text-yellow-700">
            <Edit3 size={14} />
            <span>메시지 수정 중</span>
          </div>
          <button onClick={() => { setEditingMessage(null); setInput(''); }} className="p-1"><X size={14} className="text-yellow-500" /></button>
        </div>
      )}

      {/* Attachment Panel */}
      {showAttach && (
        <div className="bg-white border-t border-gray-100 px-4 py-4">
          <div className="grid grid-cols-5 gap-3">
            {[
              { icon: ImageIcon, label: '사진', color: 'bg-green-500', action: () => handleFileUpload('image') },
              { icon: FileText, label: '파일', color: 'bg-blue-500', action: () => handleFileUpload('file') },
              { icon: MapPin, label: '내 위치', color: 'bg-orange-500', action: handleSendLocation },
              { icon: LinkIcon, label: '링크', color: 'bg-indigo-500', action: handleLinkSend },
              { icon: Smile, label: '스티커', color: 'bg-purple-500', action: () => { setShowStickers(true); setShowAttach(false); } },
            ].map(({ icon: Icon, label, color, action }) => (
              <button key={label} onClick={action} className="flex flex-col items-center gap-1.5">
                <div className={`w-12 h-12 ${color} rounded-2xl flex items-center justify-center`}>
                  <Icon size={22} className="text-white" />
                </div>
                <span className="text-[10px] text-gray-600">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sticker Panel */}
      {showStickers && (
        <div className="bg-white border-t border-gray-100 px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500">이모티콘</span>
            <button onClick={() => setShowStickers(false)}><X size={16} className="text-gray-400" /></button>
          </div>
          <div className="grid grid-cols-8 gap-2">
            {STICKERS.map((s) => (
              <button key={s} onClick={() => handleSendSticker(s)} className="text-2xl hover:scale-110 transition-transform p-1">{s}</button>
            ))}
          </div>
        </div>
      )}

      {/* Emoji Panel */}
      {showEmoji && (
        <div className="bg-white border-t border-gray-100 px-4 py-4">
          <div className="grid grid-cols-8 gap-2">
            {['😀', '😂', '😍', '🥰', '😎', '🤗', '😭', '🥺', '😡', '🤔', '👍', '👎', '❤️', '🔥', '🎉', '💯'].map((e) => (
              <button key={e} onClick={() => setInput((prev) => prev + e)} className="text-2xl hover:scale-110 transition-transform p-1">{e}</button>
            ))}
          </div>
        </div>
      )}

      {/* Input Bar */}
      <div className="bg-white border-t border-gray-100 px-3 py-2 shrink-0">
        <div className="flex items-end gap-2">
          <button
            onClick={() => { setShowAttach(!showAttach); setShowEmoji(false); setShowStickers(false); }}
            className={`p-2 rounded-full transition-colors ${showAttach ? 'bg-primary-100 text-primary-500' : 'text-gray-400'}`}
          >
            {showAttach ? <ChevronDown size={22} /> : <Plus size={22} />}
          </button>
          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={editingMessage ? '수정할 내용을 입력하세요' : '메시지를 입력하세요'}
              rows={1}
              className="w-full bg-gray-100 rounded-2xl px-4 py-2.5 text-sm resize-none max-h-24 focus:outline-none focus:ring-2 focus:ring-primary-300"
              style={{ minHeight: '40px' }}
            />
          </div>
          <button
            onClick={() => { setShowEmoji(!showEmoji); setShowAttach(false); setShowStickers(false); }}
            className={`p-2 rounded-full transition-colors ${showEmoji ? 'text-primary-500' : 'text-gray-400'}`}
          >
            <Smile size={22} />
          </button>
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className={`p-2.5 rounded-full transition-colors ${input.trim() ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-300'}`}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
