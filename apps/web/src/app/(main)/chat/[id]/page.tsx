'use client';

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Phone, Video, Camera, Mic, ImageIcon, Smile, PlusCircle, Heart, Send } from 'lucide-react';

const MY_ID = 'user-1';

const PROS: Record<string, { id: string; name: string; username: string; profileImageUrl: string }> = {
  '1': { id: 'pro-1', name: '이우영', username: 'wooyoung_mc', profileImageUrl: 'https://i.pravatar.cc/150?img=1' },
  '2': { id: 'pro-2', name: '이승진', username: 'seungjin_mc', profileImageUrl: 'https://i.pravatar.cc/150?img=5' },
  '3': { id: 'pro-3', name: '김민준', username: 'minjun_mc', profileImageUrl: 'https://i.pravatar.cc/150?img=3' },
  '4': { id: 'pro-4', name: '박서연', username: 'seoyeon_mc', profileImageUrl: 'https://i.pravatar.cc/150?img=9' },
  '5': { id: 'pro-5', name: '정하린', username: 'harin_singer', profileImageUrl: 'https://i.pravatar.cc/150?img=12' },
};

interface Message {
  id: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'system';
  createdAt: string;
  isRead: boolean;
  liked: boolean;
}

function makeMockMessages(proId: string): Message[] {
  const now = Date.now();
  return [
    { id: 's1', senderId: 'system', content: '견적 요청으로 대화가 시작되었습니다', type: 'system', createdAt: new Date(now - 5 * 3600000).toISOString(), isRead: true, liked: false },
    { id: 'm1', senderId: MY_ID, content: '안녕하세요! 4월 5일 결혼식 MC 문의 드립니다.', type: 'text', createdAt: new Date(now - 4 * 3600000).toISOString(), isRead: true, liked: false },
    { id: 'm2', senderId: proId, content: '안녕하세요! 문의 감사합니다 😊\n4월 5일 토요일 맞으신가요?', type: 'text', createdAt: new Date(now - 3.5 * 3600000).toISOString(), isRead: true, liked: false },
    { id: 'm3', senderId: MY_ID, content: '네 맞습니다! 서울 강남 더시에나호텔에서 오후 2시에 시작이에요.', type: 'text', createdAt: new Date(now - 3 * 3600000).toISOString(), isRead: true, liked: false },
    { id: 'm4', senderId: proId, content: '좋습니다, 해당 날짜 가능합니다.\n견적서 보내드릴게요!', type: 'text', createdAt: new Date(now - 2.5 * 3600000).toISOString(), isRead: true, liked: true },
    { id: 'm5', senderId: proId, content: '웨딩 MC 패키지 견적: 50만원\n\n포함 사항:\n• 리허설 진행\n• 본식 MC\n• 피로연 진행\n\n행사일: 2026-04-05 (토)', type: 'text', createdAt: new Date(now - 2 * 3600000).toISOString(), isRead: true, liked: false },
    { id: 'm6', senderId: proId, content: 'https://i.pravatar.cc/400?img=60', type: 'image', createdAt: new Date(now - 1.8 * 3600000).toISOString(), isRead: true, liked: false },
    { id: 'divider', senderId: 'system', content: '새 메시지', type: 'system', createdAt: new Date(now - 1 * 3600000).toISOString(), isRead: true, liked: false },
    { id: 'm7', senderId: proId, content: '이전 진행 영상도 참고해주세요! 😊', type: 'text', createdAt: new Date(now - 0.5 * 3600000).toISOString(), isRead: false, liked: false },
    { id: 'm8', senderId: MY_ID, content: '감사합니다! 확인 후 결제하겠습니다.', type: 'text', createdAt: new Date(now - 0.3 * 3600000).toISOString(), isRead: true, liked: false },
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

  const [messages, setMessages] = useState<Message[]>(() => makeMockMessages(pro.id));
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, {
      id: Date.now().toString(),
      senderId: MY_ID,
      content: input.trim(),
      type: 'text',
      createdAt: new Date().toISOString(),
      isRead: false,
      liked: false,
    }]);
    setInput('');
    inputRef.current?.focus();
  };

  const toggleLike = (id: string) => {
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, liked: !m.liked } : m));
  };

  const isMine = (msg: Message) => msg.senderId === MY_ID;

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* ─── Header (인스타 DM 스타일) ─── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0 bg-white">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1">
            <ArrowLeft size={24} className="text-gray-900" />
          </button>
          <img src={pro.profileImageUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
          <div className="leading-tight">
            <p className="text-[15px] font-semibold text-gray-900 flex items-center gap-1">
              {pro.name}
              <svg width="6" height="10" viewBox="0 0 6 10" fill="none" className="text-gray-400"><path d="M1 1L5 5L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </p>
            <p className="text-[12px] text-gray-400">{pro.username}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="text-gray-900"><Phone size={22} /></button>
          <button className="text-gray-900"><Video size={22} /></button>
        </div>
      </div>

      {/* ─── Messages ─── */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-[600px] mx-auto space-y-1">
          {messages.map((msg, i) => {
            // 시스템/구분선
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
                {/* 아바타 (상대방만) */}
                {!mine && (
                  <div className="w-7 shrink-0">
                    {showAvatar && (
                      <img src={pro.profileImageUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                    )}
                  </div>
                )}

                <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'} max-w-[70%]`}>
                  {/* 이미지 메시지 */}
                  {msg.type === 'image' ? (
                    <div className="relative group">
                      <img src={msg.content} alt="" className="rounded-2xl max-w-[240px] object-cover" />
                      {/* 좋아요 버튼 */}
                      {!mine && (
                        <button
                          onClick={() => toggleLike(msg.id)}
                          className="absolute -right-8 bottom-1"
                        >
                          <Heart size={16} className={msg.liked ? 'fill-red-500 text-red-500' : 'text-gray-300'} />
                        </button>
                      )}
                    </div>
                  ) : (
                    /* 텍스트 메시지 */
                    <div className="relative group flex items-end gap-1.5">
                      {mine && showTime && (
                        <span className="text-[10px] text-gray-300 mb-1 shrink-0">{msg.isRead ? '읽음' : ''}</span>
                      )}
                      <div
                        className={`px-4 py-2.5 whitespace-pre-wrap text-[15px] leading-relaxed ${
                          mine
                            ? 'bg-[#3797F0] text-white rounded-[22px] rounded-br-md'
                            : 'bg-gray-100 text-gray-900 rounded-[22px] rounded-bl-md'
                        }`}
                      >
                        {msg.content}
                      </div>
                      {/* 좋아요 (상대 메시지) */}
                      {!mine && (
                        <button
                          onClick={() => toggleLike(msg.id)}
                          className="shrink-0 mb-1"
                        >
                          <Heart size={14} className={msg.liked ? 'fill-red-500 text-red-500' : 'text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity'} />
                        </button>
                      )}
                    </div>
                  )}

                  {/* 좋아요 표시 */}
                  {msg.liked && (
                    <div className={`flex ${mine ? 'justify-end' : ''} -mt-1.5 px-2`}>
                      <span className="text-[12px]">❤️</span>
                    </div>
                  )}

                  {/* 시간 */}
                  {showTime && (
                    <p className={`text-[10px] text-gray-400 mt-1 ${mine ? 'pr-1' : 'pl-1'}`}>
                      {formatTime(msg.createdAt)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ─── Input Bar (인스타 스타일) ─── */}
      <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3">
        <div className="flex items-center gap-3 max-w-[600px] mx-auto">
          {/* 카메라 버튼 */}
          <button className="w-10 h-10 rounded-full bg-[#3797F0] flex items-center justify-center shrink-0">
            <Camera size={20} className="text-white" />
          </button>

          {/* 입력 필드 */}
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
                <button><Mic size={20} className="text-gray-900" /></button>
                <button><ImageIcon size={20} className="text-gray-900" /></button>
                <button><Smile size={20} className="text-gray-900" /></button>
                <button><PlusCircle size={20} className="text-gray-900" /></button>
              </div>
            )}
          </div>

          {/* 전송 버튼 (텍스트 있을 때) */}
          {input && (
            <button onClick={handleSend} className="shrink-0">
              <Send size={22} className="text-[#3797F0]" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
