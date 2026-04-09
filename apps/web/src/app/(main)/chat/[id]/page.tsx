'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, Phone, Video, Camera, Mic, Image as ImageIcon,
  Send, X, Copy, Reply, Trash2, MoreVertical,
  MapPin, FileText, Music, Smile, Plus, Search, Bell, BellOff,
} from 'lucide-react';
import toast from 'react-hot-toast';

const MY_ID = 'user-1';

const PROS: Record<string, { id: string; name: string; username: string; profileImageUrl: string; isActive: boolean; lastSeen?: string }> = {
  '1': { id: 'pro-1', name: '이우영', username: 'wooyoung_mc', profileImageUrl: 'https://i.pravatar.cc/150?img=1', isActive: true },
  '2': { id: 'pro-2', name: '이승진', username: 'seungjin_mc', profileImageUrl: 'https://i.pravatar.cc/150?img=5', isActive: false, lastSeen: '5분 전' },
  '3': { id: 'pro-3', name: '김민준', username: 'minjun_mc', profileImageUrl: 'https://i.pravatar.cc/150?img=3', isActive: true },
  '4': { id: 'pro-4', name: '박서연', username: 'seoyeon_mc', profileImageUrl: 'https://i.pravatar.cc/150?img=9', isActive: false, lastSeen: '1시간 전' },
  '5': { id: 'pro-5', name: '정하린', username: 'harin_singer', profileImageUrl: 'https://i.pravatar.cc/150?img=12', isActive: true },
};

const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

interface Message {
  id: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'location' | 'system';
  createdAt: string;
  isRead: boolean;
  fileName?: string;
  replyTo?: { id: string; name: string; content: string } | null;
  reaction?: string | null;
  isNew?: boolean;
}

function makeMockMessages(proId: string, proName: string): Message[] {
  const now = Date.now();
  const yesterday = now - 24 * 3600000;
  return [
    { id: 's1', senderId: 'system', content: '견적 요청으로 대화가 시작되었습니다', type: 'system', createdAt: new Date(yesterday).toISOString(), isRead: true },
    { id: 'm1', senderId: MY_ID, content: '안녕하세요! 4월 5일 결혼식 MC 문의 드립니다.', type: 'text', createdAt: new Date(yesterday + 600000).toISOString(), isRead: true },
    { id: 'm2', senderId: proId, content: '안녕하세요! 문의 감사합니다 😊\n4월 5일 토요일 맞으신가요?', type: 'text', createdAt: new Date(yesterday + 1200000).toISOString(), isRead: true },
    { id: 'm3', senderId: MY_ID, content: '네 맞습니다! 서울 강남 더시에나호텔에서 오후 2시에 시작이에요.', type: 'text', createdAt: new Date(yesterday + 1800000).toISOString(), isRead: true },
    { id: 'm4', senderId: proId, content: '좋습니다, 해당 날짜 가능합니다.\n견적서 보내드릴게요!', type: 'text', createdAt: new Date(yesterday + 2400000).toISOString(), isRead: true },
    { id: 'm5', senderId: proId, content: '웨딩 MC 패키지 견적: 50만원\n\n포함 사항:\n• 리허설 진행\n• 본식 MC\n• 피로연 진행\n\n행사일: 2026-04-05 (토)\n\n궁금하신 점 있으시면 편하게 말씀해주세요!', type: 'text', createdAt: new Date(now - 3 * 3600000).toISOString(), isRead: true },
    { id: 'm6', senderId: MY_ID, content: '감사합니다! 확인 후 결제하겠습니다.', type: 'text', createdAt: new Date(now - 2 * 3600000).toISOString(), isRead: true, replyTo: { id: 'm5', name: proName, content: '웨딩 MC 패키지 견적: 50만원' } },
    { id: 'm7', senderId: proId, content: '네, 편하게 말씀해주세요. 궁금한 점 있으시면 언제든 연락 주세요! 😊', type: 'text', createdAt: new Date(now - 1 * 3600000).toISOString(), isRead: true, reaction: '❤️' },
  ];
}

function formatDateDivider(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const isYesterday = d.toDateString() === new Date(now.getTime() - 86400000).toDateString();

  const time = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true });
  if (isToday) return `(오늘) ${time}`;
  if (isYesterday) return `(어제) ${time}`;
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${time}`;
}

function shouldShowDateDivider(messages: Message[], index: number) {
  if (index === 0) return true;
  const prev = new Date(messages[index - 1].createdAt);
  const curr = new Date(messages[index].createdAt);
  return curr.getTime() - prev.getTime() > 30 * 60 * 1000;
}

// Highlight @mentions in text
function renderTextWithMentions(text: string) {
  const parts = text.split(/(@[\w가-힣]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return <span key={i} className="font-bold text-[#0A84FF] bg-[#0A84FF]/15 px-1 py-0.5 rounded">{part}</span>;
    }
    return <span key={i}>{part}</span>;
  });
}

export default function ChatRoomPage() {
  const { id: roomId } = useParams<{ id: string }>();
  const router = useRouter();
  const pro = PROS[roomId] || PROS['1'];

  const [messages, setMessages] = useState<Message[]>(() => makeMockMessages(pro.id, pro.name));
  const [input, setInput] = useState('');
  const [showAttach, setShowAttach] = useState(false);
  const [actionMenu, setActionMenu] = useState<{ id: string; x: number; y: number; mine: boolean } | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string; content: string } | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [muted, setMuted] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionList] = useState([
    { id: pro.id, name: pro.name, username: pro.username },
    ...Object.values(PROS).filter((p) => p.id !== pro.id).slice(0, 4),
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    const newMsg: Message = {
      id: Date.now().toString(),
      senderId: MY_ID,
      content: input.trim(),
      type: 'text',
      createdAt: new Date().toISOString(),
      isRead: false,
      replyTo: replyTo ? { id: replyTo.id, name: replyTo.name, content: replyTo.content } : null,
      isNew: true,
    };
    setMessages((prev) => [...prev, newMsg]);
    setInput('');
    setReplyTo(null);
    setMentionQuery(null);
    inputRef.current?.focus();

    // 새 메시지 플래그 제거
    setTimeout(() => {
      setMessages((prev) => prev.map((m) => m.id === newMsg.id ? { ...m, isNew: false } : m));
    }, 700);
  }, [input, replyTo]);

  // 입력 변경 + 멘션 감지
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);

    // @ 직후의 텍스트 추출
    const cursorPos = e.target.selectionStart || value.length;
    const textBeforeCursor = value.slice(0, cursorPos);
    const match = textBeforeCursor.match(/@([\w가-힣]*)$/);
    if (match) {
      setMentionQuery(match[1]);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (name: string) => {
    if (mentionQuery === null) return;
    const cursorPos = inputRef.current?.selectionStart || input.length;
    const textBefore = input.slice(0, cursorPos);
    const textAfter = input.slice(cursorPos);
    const newTextBefore = textBefore.replace(/@([\w가-힣]*)$/, `@${name} `);
    const newValue = newTextBefore + textAfter;
    setInput(newValue);
    setMentionQuery(null);
    setTimeout(() => {
      inputRef.current?.focus();
      const newCursor = newTextBefore.length;
      inputRef.current?.setSelectionRange(newCursor, newCursor);
    }, 0);
  };

  const handleImageSend = (file: File) => {
    const url = URL.createObjectURL(file);
    setMessages((prev) => [...prev, {
      id: Date.now().toString(),
      senderId: MY_ID,
      content: url,
      type: 'image',
      createdAt: new Date().toISOString(),
      isRead: false,
      isNew: true,
    }]);
    setShowAttach(false);
  };

  const handleFileSend = (file: File) => {
    setMessages((prev) => [...prev, {
      id: Date.now().toString(),
      senderId: MY_ID,
      content: file.name,
      type: 'file',
      createdAt: new Date().toISOString(),
      isRead: false,
      fileName: file.name,
      isNew: true,
    }]);
    setShowAttach(false);
    toast.success(`${file.name} 전송 완료`);
  };

  const handleLocationSend = () => {
    setMessages((prev) => [...prev, {
      id: Date.now().toString(),
      senderId: MY_ID,
      content: '내 위치를 공유했습니다',
      type: 'location',
      createdAt: new Date().toISOString(),
      isRead: false,
      isNew: true,
    }]);
    setShowAttach(false);
    toast.success('위치 전송 완료');
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('복사됨');
    setActionMenu(null);
  };

  const handleReply = (msg: Message) => {
    setReplyTo({ id: msg.id, name: msg.senderId === MY_ID ? '나' : pro.name, content: msg.content });
    setActionMenu(null);
    inputRef.current?.focus();
  };

  const handleDelete = (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    setActionMenu(null);
  };

  const handleReaction = (msgId: string, emoji: string) => {
    setMessages((prev) => prev.map((m) =>
      m.id === msgId ? { ...m, reaction: m.reaction === emoji ? null : emoji } : m
    ));
    setActionMenu(null);
  };

  // 길게 누르기 - 액션 메뉴 표시
  const handleLongPressStart = (e: React.PointerEvent | React.TouchEvent, msg: Message) => {
    if (msg.type === 'system') return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mine = msg.senderId === MY_ID;

    longPressTimer.current = setTimeout(() => {
      // 진동 (지원 시)
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        try { navigator.vibrate(20); } catch {}
      }
      setActionMenu({
        id: msg.id,
        x: mine ? rect.right : rect.left,
        y: rect.top,
        mine,
      });
    }, 450);
  };

  const handleLongPressCancel = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // 답장 클릭 시 원본 메시지로 스크롤
  const scrollToMessage = (id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('animate-[replyHighlight_1.2s_ease-out]');
      setTimeout(() => el.classList.remove('animate-[replyHighlight_1.2s_ease-out]'), 1200);
    }
  };

  const isMine = (msg: Message) => msg.senderId === MY_ID;

  const ATTACH_ITEMS = [
    { icon: <Camera size={24} className="text-white" />, bg: 'bg-gradient-to-br from-gray-700 to-gray-900', label: '카메라', action: () => cameraInputRef.current?.click() },
    { icon: <ImageIcon size={24} className="text-white" />, bg: 'bg-gradient-to-br from-green-400 to-teal-500', label: '사진', action: () => fileInputRef.current?.click() },
    { icon: <Smile size={24} className="text-white" />, bg: 'bg-gradient-to-br from-blue-400 to-blue-600', label: '스티커', action: () => { setShowAttach(false); toast('스티커 기능 준비 중', { icon: '😊' }); } },
    { icon: <FileText size={24} className="text-white" />, bg: 'bg-gradient-to-br from-purple-400 to-purple-600', label: '파일', action: () => { const inp = document.createElement('input'); inp.type = 'file'; inp.onchange = (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleFileSend(f); }; inp.click(); } },
    { icon: <MapPin size={24} className="text-white" />, bg: 'bg-gradient-to-br from-red-400 to-red-600', label: '위치', action: handleLocationSend },
    { icon: <Music size={24} className="text-white" />, bg: 'bg-gradient-to-br from-orange-400 to-red-500', label: '오디오', action: () => { setShowAttach(false); toast('오디오 기능 준비 중', { icon: '🎵' }); } },
  ];

  // 멘션 필터링된 리스트
  const filteredMentions = mentionQuery !== null
    ? mentionList.filter((m) =>
        m.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
        m.username.toLowerCase().includes(mentionQuery.toLowerCase())
      )
    : [];

  return (
    <div className="flex flex-col h-screen bg-[#F2F2F7]">
      {/* ─── Header ─── */}
      <div className="shrink-0 bg-white/90 backdrop-blur-2xl border-b border-gray-200/60 sticky top-0 z-20">
        <div className="flex items-center justify-between px-2 py-2.5">
          {/* 좌측: 뒤로가기 */}
          <button onClick={() => router.back()} className="flex items-center justify-center w-10 h-10 text-[#007AFF] active:scale-90 transition-transform">
            <ChevronLeft size={28} strokeWidth={2.5} />
          </button>

          {/* 중앙: 프로필 + 이름 + 상태 */}
          <Link href={`/pros/${pro.id}`} className="flex flex-col items-center flex-1 min-w-0 active:scale-95 transition-transform">
            <div className="relative">
              <img src={pro.profileImageUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
              {pro.isActive && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#34C759] border-2 border-white rounded-full" />}
            </div>
            <p className="text-[13px] font-bold text-gray-900 mt-1 truncate max-w-[200px]">{pro.name}</p>
            <p className="text-[10px] text-gray-400 leading-tight">
              {pro.isActive ? '온라인' : pro.lastSeen ? `${pro.lastSeen} 활동` : '오프라인'}
            </p>
          </Link>

          {/* 우측: 통화/메뉴 */}
          <div className="flex items-center gap-0.5 pr-1">
            <button onClick={() => toast(`${pro.name}님에게 통화 요청`, { icon: '📞' })} className="w-9 h-9 rounded-full flex items-center justify-center text-[#007AFF] active:scale-90 transition-transform">
              <Phone size={20} />
            </button>
            <button onClick={() => toast(`${pro.name}님에게 영상통화 요청`, { icon: '📹' })} className="w-9 h-9 rounded-full flex items-center justify-center text-[#007AFF] active:scale-90 transition-transform">
              <Video size={20} />
            </button>
            <button onClick={() => setShowHeaderMenu(!showHeaderMenu)} className="w-9 h-9 rounded-full flex items-center justify-center text-[#007AFF] active:scale-90 transition-transform">
              <MoreVertical size={20} />
            </button>
          </div>
        </div>

        {/* 헤더 드롭다운 메뉴 */}
        {showHeaderMenu && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setShowHeaderMenu(false)} />
            <div className="absolute right-2 top-[60px] z-40 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/60 overflow-hidden min-w-[180px] animate-[scaleIn_0.2s_ease-out]">
              <button onClick={() => { toast('대화 검색 준비 중', { icon: '🔍' }); setShowHeaderMenu(false); }} className="flex items-center gap-3 px-4 py-3 text-[14px] text-gray-800 hover:bg-gray-50 w-full">
                <Search size={16} className="text-gray-500" /> 대화 내용 검색
              </button>
              <button onClick={() => { setMuted(!muted); toast(muted ? '알림 켜짐' : '알림 꺼짐'); setShowHeaderMenu(false); }} className="flex items-center gap-3 px-4 py-3 text-[14px] text-gray-800 hover:bg-gray-50 w-full border-t border-gray-100">
                {muted ? <Bell size={16} className="text-gray-500" /> : <BellOff size={16} className="text-gray-500" />}
                {muted ? '알림 켜기' : '알림 끄기'}
              </button>
              <Link href={`/pros/${pro.id}`} className="flex items-center gap-3 px-4 py-3 text-[14px] text-gray-800 hover:bg-gray-50 w-full border-t border-gray-100">
                <Smile size={16} className="text-gray-500" /> 프로필 보기
              </Link>
              <button onClick={() => { if (confirm('대화 내용을 삭제하시겠습니까?')) { setMessages([]); toast.success('대화 삭제됨'); } setShowHeaderMenu(false); }} className="flex items-center gap-3 px-4 py-3 text-[14px] text-red-500 hover:bg-red-50 w-full border-t border-gray-100">
                <Trash2 size={16} /> 대화 삭제
              </button>
            </div>
          </>
        )}
      </div>

      {/* ─── Messages ─── */}
      <div
        className="flex-1 overflow-y-auto px-3 py-3"
        onClick={() => { setActionMenu(null); setShowAttach(false); }}
      >
        <div className="max-w-[680px] mx-auto">
          {messages.map((msg, i) => {
            const showDate = shouldShowDateDivider(messages, i);

            if (msg.type === 'system') {
              return (
                <div key={msg.id} className="text-center py-3">
                  <span className="text-[12px] text-gray-400 bg-gray-200/60 px-3 py-1 rounded-full">{msg.content}</span>
                </div>
              );
            }

            const mine = isMine(msg);

            return (
              <div key={msg.id} id={`msg-${msg.id}`}>
                {/* 날짜/시간 구분선 */}
                {showDate && (
                  <div className="text-center py-3">
                    <span className="text-[11px] text-gray-400">{formatDateDivider(msg.createdAt)}</span>
                  </div>
                )}

                <div className={`flex ${mine ? 'justify-end' : 'justify-start'} mb-[6px] relative`}>
                  <div className="max-w-[78%] relative">
                    {/* 메시지 버블 */}
                    {msg.type === 'image' ? (
                      <div
                        className={msg.isNew ? 'animate-[bubblePop_0.5s_cubic-bezier(0.34,1.56,0.64,1)]' : ''}
                        onPointerDown={(e) => handleLongPressStart(e, msg)}
                        onPointerUp={handleLongPressCancel}
                        onPointerLeave={handleLongPressCancel}
                      >
                        <img
                          src={msg.content}
                          alt=""
                          className="rounded-2xl max-w-[260px] max-h-[340px] object-cover cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); setImagePreview(msg.content); }}
                        />
                      </div>
                    ) : msg.type === 'file' ? (
                      <div
                        className={`flex items-center gap-2 px-4 py-3 rounded-[20px] ${mine ? 'bg-[#007AFF] text-white' : 'bg-white text-gray-900'} ${msg.isNew ? 'animate-[bubblePop_0.5s_cubic-bezier(0.34,1.56,0.64,1)]' : ''}`}
                        onPointerDown={(e) => handleLongPressStart(e, msg)}
                        onPointerUp={handleLongPressCancel}
                        onPointerLeave={handleLongPressCancel}
                      >
                        <FileText size={18} />
                        <span className="text-[15px]">{msg.fileName || msg.content}</span>
                      </div>
                    ) : msg.type === 'location' ? (
                      <div
                        className={`flex items-center gap-2 px-4 py-3 rounded-[20px] ${mine ? 'bg-[#007AFF] text-white' : 'bg-white text-gray-900'} ${msg.isNew ? 'animate-[bubblePop_0.5s_cubic-bezier(0.34,1.56,0.64,1)]' : ''}`}
                        onPointerDown={(e) => handleLongPressStart(e, msg)}
                        onPointerUp={handleLongPressCancel}
                        onPointerLeave={handleLongPressCancel}
                      >
                        <MapPin size={18} />
                        <span className="text-[15px]">{msg.content}</span>
                      </div>
                    ) : (
                      <div
                        className={`whitespace-pre-wrap text-[16px] leading-[1.4] cursor-pointer select-text overflow-hidden ${
                          mine
                            ? 'bg-[#007AFF] text-white rounded-[20px] rounded-br-[6px]'
                            : 'bg-white text-gray-900 rounded-[20px] rounded-bl-[6px] shadow-[0_0.5px_1px_rgba(0,0,0,0.04)]'
                        } ${msg.isNew ? 'animate-[bubblePop_0.5s_cubic-bezier(0.34,1.56,0.64,1)]' : ''} ${actionMenu?.id === msg.id ? 'ring-2 ring-[#007AFF]/40' : ''}`}
                        style={{ transformOrigin: mine ? 'right bottom' : 'left bottom' }}
                        onPointerDown={(e) => handleLongPressStart(e, msg)}
                        onPointerUp={handleLongPressCancel}
                        onPointerLeave={handleLongPressCancel}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        {/* 답장 - 말풍선 안에 통합 */}
                        {msg.replyTo && (
                          <button
                            onClick={(e) => { e.stopPropagation(); scrollToMessage(msg.replyTo!.id); }}
                            className={`block w-full text-left px-3 pt-2 pb-1.5 ${mine ? 'bg-white/15' : 'bg-gray-100'} border-l-[3px] ${mine ? 'border-white/60' : 'border-[#007AFF]'}`}
                          >
                            <p className={`text-[11px] font-bold ${mine ? 'text-white/90' : 'text-[#007AFF]'}`}>
                              {msg.replyTo.name}
                            </p>
                            <p className={`text-[12px] truncate ${mine ? 'text-white/75' : 'text-gray-500'}`}>
                              {msg.replyTo.content}
                            </p>
                          </button>
                        )}
                        <div className="px-4 py-[10px]">
                          {renderTextWithMentions(msg.content)}
                        </div>
                      </div>
                    )}

                    {/* 리액션 표시 */}
                    {msg.reaction && (
                      <div className={`absolute -bottom-3 ${mine ? 'right-2' : 'left-2'} bg-white shadow-md rounded-full px-1.5 py-0.5 text-[14px] border border-gray-100 animate-[reactionPop_0.4s_cubic-bezier(0.34,1.56,0.64,1)]`}>
                        {msg.reaction}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ─── 액션 메뉴 (롱프레스) ─── */}
      {actionMenu && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] animate-[fadeIn_0.2s_ease]" onClick={() => setActionMenu(null)} />
          <div
            className="fixed z-50 animate-[menuPop_0.3s_cubic-bezier(0.34,1.56,0.64,1)]"
            style={{
              left: actionMenu.mine ? undefined : Math.max(12, actionMenu.x),
              right: actionMenu.mine ? Math.max(12, window.innerWidth - actionMenu.x) : undefined,
              top: Math.max(80, actionMenu.y - 110),
              transformOrigin: actionMenu.mine ? 'right bottom' : 'left bottom',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 리액션 픽커 */}
            <div className="bg-white/95 backdrop-blur-xl rounded-full shadow-xl border border-gray-200/60 px-2 py-1.5 mb-2 flex items-center gap-1">
              {REACTIONS.map((r, idx) => (
                <button
                  key={r}
                  onClick={() => handleReaction(actionMenu.id, r)}
                  className="text-[24px] w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 active:scale-125 transition-transform"
                  style={{ animation: `reactionFade 0.3s ease ${idx * 0.04}s both` }}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* 액션 메뉴 */}
            <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/60 overflow-hidden min-w-[180px]">
              <button
                onClick={() => {
                  const msg = messages.find((m) => m.id === actionMenu.id);
                  if (msg) handleReply(msg);
                }}
                className="flex items-center justify-between gap-3 px-4 py-3 text-[15px] text-gray-800 hover:bg-gray-50 w-full"
              >
                답장 <Reply size={18} className="text-gray-500" />
              </button>
              <button
                onClick={() => {
                  const msg = messages.find((m) => m.id === actionMenu.id);
                  if (msg) handleCopy(msg.content);
                }}
                className="flex items-center justify-between gap-3 px-4 py-3 text-[15px] text-gray-800 hover:bg-gray-50 w-full border-t border-gray-100"
              >
                복사 <Copy size={18} className="text-gray-500" />
              </button>
              {actionMenu.mine && (
                <button
                  onClick={() => handleDelete(actionMenu.id)}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-[15px] text-red-500 hover:bg-red-50 w-full border-t border-gray-100"
                >
                  삭제 <Trash2 size={18} />
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* ─── 답장 프리뷰 ─── */}
      {replyTo && (
        <div className="px-4 py-2.5 bg-white/90 backdrop-blur border-t border-gray-200/40 flex items-center justify-between animate-[slideUp_0.2s_ease]">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-1 h-9 rounded-full bg-[#007AFF] shrink-0" />
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-[#007AFF]">{replyTo.name}에게 답장</p>
              <p className="text-[12px] text-gray-400 truncate">{replyTo.content}</p>
            </div>
          </div>
          <button onClick={() => setReplyTo(null)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100">
            <X size={16} className="text-gray-400" />
          </button>
        </div>
      )}

      {/* ─── 멘션 자동완성 ─── */}
      {mentionQuery !== null && filteredMentions.length > 0 && (
        <div className="px-4 pb-2 bg-white/95 backdrop-blur border-t border-gray-200/40 animate-[slideUp_0.2s_ease]">
          <p className="text-[10px] font-bold tracking-wider text-gray-400 pt-2 pb-1">멘션</p>
          <div className="space-y-1">
            {filteredMentions.map((m) => (
              <button
                key={m.id}
                onClick={() => insertMention(m.name)}
                className="flex items-center gap-3 w-full p-2 rounded-xl hover:bg-gray-100 active:scale-[0.98] transition-all"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-[13px] font-bold shrink-0">
                  {m.name.charAt(0)}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-[14px] font-semibold text-gray-900 truncate">{m.name}</p>
                  <p className="text-[11px] text-gray-400 truncate">@{m.username}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── 첨부 메뉴 (iMessage 스타일) ─── */}
      {showAttach && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowAttach(false)} />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-2xl rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] pb-safe"
            style={{ animation: 'sheetUp 0.3s ease-out' }}
          >
            <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mt-3 mb-4" />
            <div className="px-4 pb-6 max-h-[50vh] overflow-y-auto">
              {ATTACH_ITEMS.map((item) => (
                <button
                  key={item.label}
                  onClick={(e) => { e.stopPropagation(); item.action(); setShowAttach(false); }}
                  className="flex items-center gap-4 w-full py-3.5 px-2 hover:bg-gray-100/60 rounded-xl transition-colors"
                >
                  <div className={`w-11 h-11 rounded-full ${item.bg} flex items-center justify-center shrink-0`}>
                    {item.icon}
                  </div>
                  <span className="text-[17px] text-gray-900">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ─── Input Bar ─── */}
      <div className="shrink-0 bg-[#F8F8FA] border-t border-gray-200/60 px-3 py-2 pb-safe">
        <div className="flex items-end gap-2 max-w-[680px] mx-auto">
          <button
            onClick={(e) => { e.stopPropagation(); setShowAttach(!showAttach); }}
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mb-0.5 active:scale-90 transition-transform"
          >
            <Plus size={26} className="text-[#007AFF]" />
          </button>

          <div className="flex-1 flex items-end bg-white rounded-[20px] border border-gray-300/60 px-3 py-1.5 min-h-[36px]">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="메시지 (@ 으로 멘션)"
              className="flex-1 bg-transparent text-[16px] focus:outline-none placeholder:text-gray-400 leading-[1.3] py-0.5"
            />
          </div>

          {input.trim() ? (
            <button onClick={handleSend} className="w-9 h-9 rounded-full bg-[#007AFF] flex items-center justify-center shrink-0 mb-0.5 active:scale-90 transition-transform hover:bg-[#0066d9]">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M3 9L15 3L9 15L8 10L3 9Z" fill="white" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/></svg>
            </button>
          ) : (
            <button
              onClick={() => toast('음성 메시지 준비 중', { icon: '🎙️' })}
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mb-0.5"
            >
              <Mic size={22} className="text-[#007AFF]" />
            </button>
          )}
        </div>
      </div>

      {/* 숨겨진 파일 인풋 */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageSend(f); e.target.value = ''; }} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageSend(f); e.target.value = ''; }} />

      {/* 이미지 프리뷰 */}
      {imagePreview && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setImagePreview(null)}>
          <button onClick={() => setImagePreview(null)} className="absolute top-4 right-4 text-white"><X size={28} /></button>
          <img src={imagePreview} alt="" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" />
        </div>
      )}

      {/* 애니메이션 keyframes */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes sheetUp {
          0% { transform: translateY(100%); }
          100% { transform: translateY(0); }
        }
        @keyframes bubblePop {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.08); opacity: 1; }
          70% { transform: scale(0.96); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes menuPop {
          0% { transform: scale(0.4); opacity: 0; }
          60% { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes reactionPop {
          0% { transform: scale(0); }
          60% { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
        @keyframes reactionFade {
          0% { opacity: 0; transform: translateY(8px) scale(0.5); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes scaleIn {
          0% { opacity: 0; transform: scale(0.92) translateY(-4px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes slideUp {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes replyHighlight {
          0%, 100% { background-color: transparent; }
          30% { background-color: rgba(0, 122, 255, 0.12); }
        }
      `}} />
    </div>
  );
}
