'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, Phone, Video, Camera, Mic, Image as ImageIcon,
  Heart, Send, X, Copy, Reply, Trash2,
  MapPin, FileText, Music, Smile, Plus,
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

interface Message {
  id: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'location' | 'system';
  createdAt: string;
  isRead: boolean;
  fileName?: string;
  replyTo?: { name: string; content: string } | null;
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
    { id: 'm6', senderId: MY_ID, content: '감사합니다! 확인 후 결제하겠습니다.', type: 'text', createdAt: new Date(now - 2 * 3600000).toISOString(), isRead: true, replyTo: { name: proName, content: '웨딩 MC 패키지 견적: 50만원' } },
    { id: 'm7', senderId: proId, content: '네, 편하게 말씀해주세요. 궁금한 점 있으시면 언제든 연락 주세요! 😊', type: 'text', createdAt: new Date(now - 1 * 3600000).toISOString(), isRead: true },
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
  // 30분 이상 차이나면 시간 표시
  return curr.getTime() - prev.getTime() > 30 * 60 * 1000;
}

export default function ChatRoomPage() {
  const { id: roomId } = useParams<{ id: string }>();
  const router = useRouter();
  const pro = PROS[roomId] || PROS['1'];

  const [messages, setMessages] = useState<Message[]>(() => makeMockMessages(pro.id, pro.name));
  const [input, setInput] = useState('');
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

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, {
      id: Date.now().toString(),
      senderId: MY_ID,
      content: input.trim(),
      type: 'text',
      createdAt: new Date().toISOString(),
      isRead: false,
      replyTo: replyTo ? { name: replyTo.name, content: replyTo.content } : null,
    }]);
    setInput('');
    setReplyTo(null);
    inputRef.current?.focus();
  }, [input, replyTo]);

  const handleImageSend = (file: File) => {
    const url = URL.createObjectURL(file);
    setMessages((prev) => [...prev, {
      id: Date.now().toString(),
      senderId: MY_ID,
      content: url,
      type: 'image',
      createdAt: new Date().toISOString(),
      isRead: false,
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
    }]);
    setShowAttach(false);
    toast.success('위치 전송 완료');
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('복사됨');
    setShowActions(null);
  };

  const handleReply = (msg: Message) => {
    setReplyTo({ id: msg.id, name: msg.senderId === MY_ID ? '나' : pro.name, content: msg.content });
    setShowActions(null);
    inputRef.current?.focus();
  };

  const handleDelete = (id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    setShowActions(null);
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

  return (
    <div className="flex flex-col h-screen bg-[#F2F2F7]">
      {/* ─── Header (iMessage 스타일) ─── */}
      <div className="shrink-0 bg-[#F8F8FA] border-b border-gray-200/60">
        <div className="flex items-center justify-between px-2 py-2">
          <button onClick={() => router.back()} className="flex items-center gap-0 text-[#007AFF] pl-1">
            <ChevronLeft size={28} strokeWidth={2.5} />
          </button>
          <Link href={`/pros/${pro.id}`} className="flex flex-col items-center">
            <div className="relative">
              <img src={pro.profileImageUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
              {pro.isActive && <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-[#F8F8FA] rounded-full" />}
            </div>
            <p className="text-[13px] font-semibold text-gray-900 mt-1">{pro.name}</p>
            <p className="text-[11px] text-gray-400">{pro.username}</p>
          </Link>
          <div className="flex items-center gap-2 pr-2">
            <button onClick={() => toast(`${pro.name}님에게 통화 요청`, { icon: '📞' })} className="w-8 h-8 rounded-full flex items-center justify-center">
              <Phone size={20} className="text-[#007AFF]" />
            </button>
            <button onClick={() => toast(`${pro.name}님에게 영상통화 요청`, { icon: '📹' })} className="w-8 h-8 rounded-full flex items-center justify-center">
              <Video size={20} className="text-[#007AFF]" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Messages ─── */}
      <div
        className="flex-1 overflow-y-auto px-3 py-3"
        onClick={() => { setShowActions(null); setShowAttach(false); }}
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
              <div key={msg.id}>
                {/* 날짜/시간 구분선 */}
                {showDate && (
                  <div className="text-center py-3">
                    <span className="text-[11px] text-gray-400">{formatDateDivider(msg.createdAt)}</span>
                  </div>
                )}

                <div className={`flex ${mine ? 'justify-end' : 'justify-start'} mb-[3px] relative group`}>
                  <div className={`max-w-[75%] relative`}>
                    {/* 답장 표시 */}
                    {msg.replyTo && (
                      <div className={`text-[11px] text-gray-400 mb-1 px-3 py-1.5 rounded-lg bg-black/5 border-l-2 ${mine ? 'border-[#007AFF]' : 'border-gray-400'}`}>
                        <span className="font-semibold">{msg.replyTo.name}</span>
                        <p className="truncate">{msg.replyTo.content}</p>
                      </div>
                    )}

                    {/* 메시지 버블 */}
                    {msg.type === 'image' ? (
                      <img
                        src={msg.content}
                        alt=""
                        className="rounded-2xl max-w-[260px] max-h-[340px] object-cover cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); setImagePreview(msg.content); }}
                      />
                    ) : msg.type === 'file' ? (
                      <div className={`flex items-center gap-2 px-4 py-3 rounded-[20px] ${mine ? 'bg-[#007AFF] text-white' : 'bg-white text-gray-900'}`}>
                        <FileText size={18} />
                        <span className="text-[15px]">{msg.fileName || msg.content}</span>
                      </div>
                    ) : msg.type === 'location' ? (
                      <div className={`flex items-center gap-2 px-4 py-3 rounded-[20px] ${mine ? 'bg-[#007AFF] text-white' : 'bg-white text-gray-900'}`}>
                        <MapPin size={18} />
                        <span className="text-[15px]">{msg.content}</span>
                      </div>
                    ) : (
                      <div
                        className={`px-4 py-[10px] whitespace-pre-wrap text-[16px] leading-[1.4] cursor-pointer select-text ${
                          mine
                            ? 'bg-[#007AFF] text-white rounded-[20px] rounded-br-[6px]'
                            : 'bg-white text-gray-900 rounded-[20px] rounded-bl-[6px] shadow-[0_0.5px_1px_rgba(0,0,0,0.04)]'
                        }`}
                        onClick={(e) => { e.stopPropagation(); setShowActions(showActions === msg.id ? null : msg.id); }}
                      >
                        {msg.content}
                      </div>
                    )}

                    {/* 액션 메뉴 */}
                    {showActions === msg.id && (
                      <div
                        className={`absolute ${mine ? 'right-0' : 'left-0'} top-full mt-1 z-30 bg-white/95 backdrop-blur-xl rounded-xl shadow-lg border border-gray-200/60 overflow-hidden min-w-[140px]`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button onClick={() => handleReply(msg)} className="flex items-center gap-3 px-4 py-3 text-[14px] text-gray-800 hover:bg-gray-50 w-full">
                          <Reply size={16} className="text-gray-500" /> 답장
                        </button>
                        <button onClick={() => handleCopy(msg.content)} className="flex items-center gap-3 px-4 py-3 text-[14px] text-gray-800 hover:bg-gray-50 w-full border-t border-gray-100">
                          <Copy size={16} className="text-gray-500" /> 복사
                        </button>
                        {mine && (
                          <button onClick={() => handleDelete(msg.id)} className="flex items-center gap-3 px-4 py-3 text-[14px] text-red-500 hover:bg-red-50 w-full border-t border-gray-100">
                            <Trash2 size={16} /> 삭제
                          </button>
                        )}
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

      {/* ─── 답장 프리뷰 ─── */}
      {replyTo && (
        <div className="px-4 py-2.5 bg-white/80 backdrop-blur border-t border-gray-200/40 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-1 h-8 rounded-full bg-[#007AFF] shrink-0" />
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-[#007AFF]">{replyTo.name}에게 답장</p>
              <p className="text-[12px] text-gray-400 truncate">{replyTo.content}</p>
            </div>
          </div>
          <button onClick={() => setReplyTo(null)}><X size={18} className="text-gray-400" /></button>
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

      {/* ─── Input Bar (iMessage 스타일) ─── */}
      <div className="shrink-0 bg-[#F8F8FA] border-t border-gray-200/60 px-3 py-2 pb-safe">
        <div className="flex items-end gap-2 max-w-[680px] mx-auto">
          {/* + 버튼 */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowAttach(!showAttach); }}
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 mb-0.5 active:scale-90 transition-transform"
          >
            <Plus size={26} className="text-[#007AFF]" />
          </button>

          {/* 입력 필드 */}
          <div className="flex-1 flex items-end bg-white rounded-[20px] border border-gray-300/60 px-3 py-1.5 min-h-[36px]">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="메시지"
              className="flex-1 bg-transparent text-[16px] focus:outline-none placeholder:text-gray-400 leading-[1.3] py-0.5"
            />
          </div>

          {/* 전송 / 마이크 */}
          {input.trim() ? (
            <button onClick={handleSend} className="w-9 h-9 rounded-full bg-[#007AFF] flex items-center justify-center shrink-0 mb-0.5 active:scale-90 transition-transform">
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

      {/* 애니메이션 */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes sheetUp {
          0% { transform: translateY(100%); }
          100% { transform: translateY(0); }
        }
      `}} />
    </div>
  );
}
