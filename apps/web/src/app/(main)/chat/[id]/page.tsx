'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Phone, Video, Camera, Mic, Image as ImageIcon,
  Smile, PlusCircle, Heart, Send, X, Copy, Reply, Trash2,
  CornerUpRight, MapPin, FileText, Link as LinkIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';

const MY_ID = 'user-1';

const PROS: Record<string, { id: string; name: string; username: string; profileImageUrl: string; isActive: boolean }> = {
  '1': { id: 'pro-1', name: '이우영', username: 'wooyoung_mc', profileImageUrl: 'https://i.pravatar.cc/150?img=1', isActive: true },
  '2': { id: 'pro-2', name: '이승진', username: 'seungjin_mc', profileImageUrl: 'https://i.pravatar.cc/150?img=5', isActive: false },
  '3': { id: 'pro-3', name: '김민준', username: 'minjun_mc', profileImageUrl: 'https://i.pravatar.cc/150?img=3', isActive: true },
  '4': { id: 'pro-4', name: '박서연', username: 'seoyeon_mc', profileImageUrl: 'https://i.pravatar.cc/150?img=9', isActive: false },
  '5': { id: 'pro-5', name: '정하린', username: 'harin_singer', profileImageUrl: 'https://i.pravatar.cc/150?img=12', isActive: true },
};

const EMOJIS = ['😀', '😂', '🥰', '😎', '🤗', '😭', '🥺', '😡', '🎉', '👏', '💪', '🙏', '❤️', '🔥', '👍', '😮', '🤔', '😴', '🥳', '😇', '🤩', '😋', '🫶', '✨', '💯', '🙌', '😘', '🫡', '💀', '🤣'];

interface Message {
  id: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'location' | 'system';
  createdAt: string;
  isRead: boolean;
  liked: boolean;
  replyTo?: { name: string; content: string } | null;
  fileName?: string;
}

function makeMockMessages(proId: string, proName: string): Message[] {
  const now = Date.now();
  return [
    { id: 's1', senderId: 'system', content: '견적 요청으로 대화가 시작되었습니다', type: 'system', createdAt: new Date(now - 5 * 3600000).toISOString(), isRead: true, liked: false },
    { id: 'm1', senderId: MY_ID, content: '안녕하세요! 4월 5일 결혼식 MC 문의 드립니다.', type: 'text', createdAt: new Date(now - 4 * 3600000).toISOString(), isRead: true, liked: false },
    { id: 'm2', senderId: proId, content: '안녕하세요! 문의 감사합니다 😊\n4월 5일 토요일 맞으신가요?', type: 'text', createdAt: new Date(now - 3.5 * 3600000).toISOString(), isRead: true, liked: false },
    { id: 'm3', senderId: MY_ID, content: '네 맞습니다! 서울 강남 더시에나호텔에서 오후 2시에 시작이에요.', type: 'text', createdAt: new Date(now - 3 * 3600000).toISOString(), isRead: true, liked: false },
    { id: 'm4', senderId: proId, content: '좋습니다, 해당 날짜 가능합니다.\n견적서 보내드릴게요!', type: 'text', createdAt: new Date(now - 2.5 * 3600000).toISOString(), isRead: true, liked: true },
    { id: 'm5', senderId: proId, content: '웨딩 MC 패키지 견적: 50만원\n\n포함 사항:\n• 리허설 진행\n• 본식 MC\n• 피로연 진행\n\n행사일: 2026-04-05 (토)', type: 'text', createdAt: new Date(now - 2 * 3600000).toISOString(), isRead: true, liked: false },
    { id: 'm6', senderId: proId, content: 'https://picsum.photos/400/300?random=1', type: 'image', createdAt: new Date(now - 1.8 * 3600000).toISOString(), isRead: true, liked: false },
    { id: 'divider', senderId: 'system', content: '새 메시지', type: 'system', createdAt: new Date(now - 1 * 3600000).toISOString(), isRead: true, liked: false },
    { id: 'm7', senderId: proId, content: '이전 진행 영상도 참고해주세요! 😊', type: 'text', createdAt: new Date(now - 0.5 * 3600000).toISOString(), isRead: false, liked: false },
    { id: 'm8', senderId: MY_ID, content: '감사합니다! 확인 후 결제하겠습니다.', type: 'text', createdAt: new Date(now - 0.3 * 3600000).toISOString(), isRead: true, liked: false, replyTo: { name: proName, content: '이전 진행 영상도 참고해주세요! 😊' } },
  ];
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export default function ChatRoomPage() {
  const { id: roomId } = useParams<{ id: string }>();
  const router = useRouter();
  const pro = PROS[roomId] || PROS['1'];

  const [messages, setMessages] = useState<Message[]>(() => makeMockMessages(pro.id, pro.name));
  const [input, setInput] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [showActions, setShowActions] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string; content: string } | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 메시지 전송
  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    const newMsg: Message = {
      id: Date.now().toString(),
      senderId: MY_ID,
      content: input.trim(),
      type: 'text',
      createdAt: new Date().toISOString(),
      isRead: false,
      liked: false,
      replyTo: replyTo ? { name: replyTo.name, content: replyTo.content } : null,
    };
    setMessages((prev) => [...prev, newMsg]);
    setInput('');
    setReplyTo(null);
    setShowEmoji(false);
    inputRef.current?.focus();
  }, [input, replyTo]);

  // 이미지 전송
  const handleImageSend = (file: File) => {
    const url = URL.createObjectURL(file);
    setMessages((prev) => [...prev, {
      id: Date.now().toString(),
      senderId: MY_ID,
      content: url,
      type: 'image',
      createdAt: new Date().toISOString(),
      isRead: false,
      liked: false,
    }]);
  };

  // 파일 전송
  const handleFileSend = (file: File) => {
    setMessages((prev) => [...prev, {
      id: Date.now().toString(),
      senderId: MY_ID,
      content: file.name,
      type: 'file',
      createdAt: new Date().toISOString(),
      isRead: false,
      liked: false,
      fileName: file.name,
    }]);
    setShowAttach(false);
    toast.success(`${file.name} 전송 완료`);
  };

  // 위치 전송
  const handleLocationSend = () => {
    setMessages((prev) => [...prev, {
      id: Date.now().toString(),
      senderId: MY_ID,
      content: '내 위치를 공유했습니다',
      type: 'location',
      createdAt: new Date().toISOString(),
      isRead: false,
      liked: false,
    }]);
    setShowAttach(false);
    toast.success('위치 전송 완료');
  };

  // 좋아요 토글
  const toggleLike = (id: string) => {
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, liked: !m.liked } : m));
  };

  // 메시지 복사
  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('메시지가 복사되었습니다');
    setShowActions(null);
  };

  // 답장
  const handleReply = (msg: Message) => {
    const senderName = msg.senderId === MY_ID ? '나' : pro.name;
    setReplyTo({ id: msg.id, name: senderName, content: msg.content });
    setShowActions(null);
    inputRef.current?.focus();
  };

  // 삭제
  const handleDelete = (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    setShowActions(null);
    toast.success('메시지 삭제됨');
  };

  // 통화
  const handleCall = (type: 'audio' | 'video') => {
    toast(`${pro.name}님에게 ${type === 'audio' ? '음성' : '영상'} 통화를 요청합니다...`, { icon: type === 'audio' ? '📞' : '📹' });
  };

  const isMine = (msg: Message) => msg.senderId === MY_ID;

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0 bg-white">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1">
            <ArrowLeft size={24} className="text-gray-900" />
          </button>
          <Link href={`/pros/${pro.id}`} className="flex items-center gap-3">
            <div className="relative">
              <img src={pro.profileImageUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
              {pro.isActive && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-white rounded-full" />}
            </div>
            <div className="leading-tight">
              <p className="text-[15px] font-semibold text-gray-900 flex items-center gap-1">
                {pro.name}
                <svg width="6" height="10" viewBox="0 0 6 10" fill="none" className="text-gray-400"><path d="M1 1L5 5L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </p>
              <p className="text-[12px] text-gray-400">{pro.isActive ? '활동 중' : pro.username}</p>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => handleCall('audio')} className="text-gray-900"><Phone size={22} /></button>
          <button onClick={() => handleCall('video')} className="text-gray-900"><Video size={22} /></button>
        </div>
      </div>

      {/* ─── Messages ─── */}
      <div className="flex-1 overflow-y-auto px-4 py-4" onClick={() => { setShowActions(null); setShowEmoji(false); setShowAttach(false); }}>
        <div className="max-w-[600px] mx-auto space-y-1">
          {/* 프로필 카드 (최상단) */}
          <div className="flex flex-col items-center py-6 mb-4">
            <img src={pro.profileImageUrl} alt="" className="w-20 h-20 rounded-full object-cover mb-3" />
            <p className="text-[16px] font-bold text-gray-900">{pro.name}</p>
            <p className="text-[13px] text-gray-400">{pro.username}</p>
            <Link href={`/pros/${pro.id}`} className="mt-2 text-[13px] font-semibold text-[#3797F0]">프로필 보기</Link>
          </div>

          {messages.map((msg, i) => {
            if (msg.type === 'system') {
              return (
                <div key={msg.id} className="flex items-center gap-3 py-4">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-[12px] text-gray-400 shrink-0">{msg.content}</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
              );
            }

            const mine = isMine(msg);
            const showAvatar = !mine && (i === 0 || messages[i - 1]?.senderId !== msg.senderId || messages[i - 1]?.type === 'system');
            const showTime = i === messages.length - 1 || messages[i + 1]?.senderId !== msg.senderId || messages[i + 1]?.type === 'system';

            return (
              <div key={msg.id} className={`flex items-end gap-2 ${mine ? 'flex-row-reverse' : ''} ${showTime ? 'mb-3' : 'mb-0.5'}`}>
                {!mine && (
                  <div className="w-7 shrink-0">
                    {showAvatar && <img src={pro.profileImageUrl} alt="" className="w-7 h-7 rounded-full object-cover" />}
                  </div>
                )}

                <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'} max-w-[70%] relative group`}>
                  {/* 답장 표시 */}
                  {msg.replyTo && (
                    <div className={`text-[11px] text-gray-400 mb-1 px-3 py-1 rounded-lg bg-gray-50 border-l-2 border-gray-300 ${mine ? 'self-end' : 'self-start'}`}>
                      <span className="font-semibold">{msg.replyTo.name}</span>에게 답장
                      <p className="truncate max-w-[200px]">{msg.replyTo.content}</p>
                    </div>
                  )}

                  {/* 이미지 */}
                  {msg.type === 'image' ? (
                    <div className="relative">
                      <img
                        src={msg.content}
                        alt=""
                        className="rounded-2xl max-w-[240px] max-h-[320px] object-cover cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); setImagePreview(msg.content); }}
                      />
                    </div>
                  ) : msg.type === 'file' ? (
                    <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl ${mine ? 'bg-[#3797F0] text-white' : 'bg-gray-100 text-gray-900'}`}>
                      <FileText size={18} />
                      <span className="text-[14px]">{msg.fileName || msg.content}</span>
                    </div>
                  ) : msg.type === 'location' ? (
                    <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl ${mine ? 'bg-[#3797F0] text-white' : 'bg-gray-100 text-gray-900'}`}>
                      <MapPin size={18} />
                      <span className="text-[14px]">{msg.content}</span>
                    </div>
                  ) : (
                    <div className="flex items-end gap-1.5">
                      {mine && showTime && (
                        <span className="text-[10px] text-gray-300 mb-1 shrink-0">{msg.isRead ? '읽음' : ''}</span>
                      )}
                      <div
                        className={`px-4 py-2.5 whitespace-pre-wrap text-[15px] leading-relaxed cursor-pointer ${
                          mine
                            ? 'bg-[#3797F0] text-white rounded-[22px] rounded-br-md'
                            : 'bg-gray-100 text-gray-900 rounded-[22px] rounded-bl-md'
                        }`}
                        onClick={(e) => { e.stopPropagation(); setShowActions(showActions === msg.id ? null : msg.id); }}
                      >
                        {msg.content}
                      </div>
                      {!mine && (
                        <button onClick={(e) => { e.stopPropagation(); toggleLike(msg.id); }} className="shrink-0 mb-1">
                          <Heart size={14} className={msg.liked ? 'fill-red-500 text-red-500' : 'text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity'} />
                        </button>
                      )}
                    </div>
                  )}

                  {msg.liked && (
                    <div className={`flex ${mine ? 'justify-end' : ''} -mt-1.5 px-2`}>
                      <span className="text-[12px]">❤️</span>
                    </div>
                  )}

                  {showTime && (
                    <p className={`text-[10px] text-gray-400 mt-1 ${mine ? 'pr-1' : 'pl-1'}`}>{formatTime(msg.createdAt)}</p>
                  )}

                  {/* 메시지 액션 메뉴 */}
                  {showActions === msg.id && (
                    <div
                      className={`absolute ${mine ? 'right-0' : 'left-8'} top-full mt-1 z-20 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button onClick={() => handleReply(msg)} className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50 w-full">
                        <Reply size={15} /> 답장
                      </button>
                      <button onClick={() => handleCopy(msg.content)} className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50 w-full">
                        <Copy size={15} /> 복사
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); toggleLike(msg.id); setShowActions(null); }} className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-gray-700 hover:bg-gray-50 w-full">
                        <Heart size={15} /> {msg.liked ? '좋아요 취소' : '좋아요'}
                      </button>
                      {mine && (
                        <button onClick={() => handleDelete(msg.id)} className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-red-500 hover:bg-red-50 w-full">
                          <Trash2 size={15} /> 삭제
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ─── 답장 프리뷰 ─── */}
      {replyTo && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Reply size={14} className="text-gray-400 shrink-0" />
            <p className="text-[12px] text-gray-500 truncate">
              <span className="font-semibold">{replyTo.name}</span>에게 답장: {replyTo.content}
            </p>
          </div>
          <button onClick={() => setReplyTo(null)}><X size={16} className="text-gray-400" /></button>
        </div>
      )}

      {/* ─── 이모지 피커 ─── */}
      {showEmoji && (
        <div className="px-4 py-3 bg-white border-t border-gray-100">
          <div className="max-w-[600px] mx-auto grid grid-cols-10 gap-1">
            {EMOJIS.map((e) => (
              <button key={e} onClick={() => setInput((prev) => prev + e)} className="text-[22px] p-1 hover:bg-gray-100 rounded-lg transition-colors">
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── 첨부 메뉴 ─── */}
      {showAttach && (
        <div className="px-4 py-3 bg-white border-t border-gray-100">
          <div className="max-w-[600px] mx-auto flex gap-6 justify-center">
            <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-1">
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center"><ImageIcon size={22} className="text-purple-600" /></div>
              <span className="text-[11px] text-gray-500">사진</span>
            </button>
            <button onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.onchange = (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleFileSend(f); }; input.click(); }} className="flex flex-col items-center gap-1">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center"><FileText size={22} className="text-blue-600" /></div>
              <span className="text-[11px] text-gray-500">파일</span>
            </button>
            <button onClick={handleLocationSend} className="flex flex-col items-center gap-1">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center"><MapPin size={22} className="text-green-600" /></div>
              <span className="text-[11px] text-gray-500">위치</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── Input Bar ─── */}
      <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3">
        <div className="flex items-center gap-3 max-w-[600px] mx-auto">
          <button onClick={() => cameraInputRef.current?.click()} className="w-10 h-10 rounded-full bg-[#3797F0] flex items-center justify-center shrink-0 active:scale-95 transition-transform">
            <Camera size={20} className="text-white" />
          </button>
          <div className="flex-1 flex items-center bg-gray-100 rounded-full px-4 py-2.5 gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
              placeholder="메시지 보내기..."
              className="flex-1 bg-transparent text-[15px] focus:outline-none placeholder:text-gray-400"
            />
            {!input && (
              <div className="flex items-center gap-3 shrink-0">
                <button onClick={() => toast('음성 메시지 녹음 기능은 준비 중입니다', { icon: '🎙️' })}><Mic size={20} className="text-gray-900" /></button>
                <button onClick={() => fileInputRef.current?.click()}><ImageIcon size={20} className="text-gray-900" /></button>
                <button onClick={(e) => { e.stopPropagation(); setShowEmoji(!showEmoji); setShowAttach(false); }}><Smile size={20} className="text-gray-900" /></button>
                <button onClick={(e) => { e.stopPropagation(); setShowAttach(!showAttach); setShowEmoji(false); }}><PlusCircle size={20} className="text-gray-900" /></button>
              </div>
            )}
          </div>
          {input && (
            <button onClick={handleSend} className="shrink-0 active:scale-90 transition-transform">
              <Send size={22} className="text-[#3797F0]" />
            </button>
          )}
        </div>
      </div>

      {/* 숨겨진 파일 인풋 */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageSend(f); e.target.value = ''; }} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageSend(f); e.target.value = ''; }} />

      {/* 이미지 프리뷰 모달 */}
      {imagePreview && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setImagePreview(null)}>
          <button onClick={() => setImagePreview(null)} className="absolute top-4 right-4 text-white"><X size={28} /></button>
          <img src={imagePreview} alt="" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" />
        </div>
      )}
    </div>
  );
}
