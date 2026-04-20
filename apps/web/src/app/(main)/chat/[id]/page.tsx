'use client';

import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, Mic, X, MoreVertical, Plus, MapPin, FileText,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';
import { useChatStore } from '@/lib/store/chat.store';
import { chatApi, type ChatRoomItem, type MessageItem } from '@/lib/api/chat.api';
import { preWarmChat, getPreWarmByProId, getPreWarmByRoomId } from '@/lib/chat-prewarm';
import type { Message, ChatPartner, SystemPayload } from './chat-types';

const ChatExtras = lazy(() => import('./ChatExtras'));
const SystemMessageCard = lazy(() => import('./ChatExtras').then((m) => ({ default: m.SystemMessageCard })));

/** Convert a MessageItem from the API into our local Message shape */
function mapApiMessage(m: MessageItem): Message {
  const meta = m.metadata as Record<string, any> | null;
  return {
    id: m.id,
    senderId: m.senderId,
    content: m.content || '',
    type: (m.type === 'link' || m.type === 'sticker') ? 'text' : m.type as Message['type'],
    createdAt: m.createdAt,
    isRead: m.isRead,
    replyTo: m.replyTo ? { id: m.replyTo.id, name: m.replyTo.senderId, content: m.replyTo.content || '' } : null,
    reaction: m.reactions?.[0]?.emoji ?? null,
    fileName: meta?.fileName as string | undefined,
    duration: meta?.duration as number | undefined,
    latitude: meta?.latitude as number | undefined,
    longitude: meta?.longitude as number | undefined,
    address: meta?.address as string | undefined,
    system: meta?.system as SystemPayload | undefined,
  };
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

// Simple inline text with @mention highlighting
function renderTextWithMentions(text: string) {
  const parts = text.split(/(@[\w가-힣]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return <span key={i} className="font-bold text-[#0A84FF] bg-[#0A84FF]/15 px-1 py-0.5 rounded">{part}</span>;
    }
    return <span key={i}>{part}</span>;
  });
}

// Lightweight system message fallback (text-only pill) until ChatExtras loads the rich card
function SystemMessageFallback({ msg }: { msg: Message }) {
  return (
    <div className="text-center py-3">
      <span className="inline-block text-[12px] text-gray-500 bg-gray-100 px-3.5 py-1.5 rounded-full">
        {msg.content}
      </span>
    </div>
  );
}

export default function ChatRoomPage() {
  const { id: roomId } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlProName = searchParams.get('name') ? decodeURIComponent(searchParams.get('name')!) : null;
  const urlProImg = searchParams.get('img') ? decodeURIComponent(searchParams.get('img')!) : null;
  const authUser = useAuthStore((s) => s.user);
  const MY_ID = authUser?.id || '';
  // isPro 판정: 아래 셋 중 하나라도 true 면 프로 측 — 견적서 발송 버튼 노출
  // 1) 이 채팅방에서 내가 프로 측 (백엔드 iAmPro 응답)
  // 2) 내가 ProProfile 을 보유 (일반모드로 UI 전환해도 견적 발송 가능)
  // 3) User.role 이 'pro'
  const [roomProUserId, setRoomProUserId] = useState<string | null>(null);
  const [hasMyProProfile, setHasMyProProfile] = useState<boolean>(false);
  useEffect(() => {
    if (!authUser) return;
    // 모든 유저가 draft ProProfile 을 자동 생성받기 때문에 단순히 존재만 보면 안됨.
    // approved/pending 상태(실제로 프로 등록을 마친 경우)만 pro 로 인정
    import('@/lib/api/pros.api').then(({ prosApi }) => {
      prosApi.getMyProfile()
        .then((p: any) => {
          const status = p?.status;
          if (p?.id && (status === 'approved' || status === 'pending')) setHasMyProProfile(true);
        })
        .catch(() => {});
    });
  }, [authUser]);
  // 이 채팅방에서 내가 pro 측인지 확정하는 주 신호:
  // 1) 백엔드가 알려주는 roomProUserId === MY_ID (가장 확실)
  // 2) 내 User.role === 'pro' (이미 어드민이 승인한 경우만 role 이 바뀜)
  // 3) 내 ProProfile 이 approved/pending (부차 신호)
  const isPro = Boolean(
    (roomProUserId && roomProUserId === MY_ID) ||
    authUser?.role === 'pro' ||
    hasMyProProfile
  );
  const { connect, joinRoom, leaveRoom, sendMessage: wsSendMessage, messages: wsMessages, setTyping } = useChatStore();

  // ─── Pre-warmed data 즉시 사용 (initial state만 계산) ───
  const initialPreWarmed = (() => {
    if (typeof window === 'undefined') return null;
    if (roomId.startsWith('pending-')) {
      return getPreWarmByProId(roomId.replace('pending-', ''));
    }
    return getPreWarmByRoomId(roomId);
  })();
  const initialPartner: ChatPartner | null = initialPreWarmed?.room ? {
    id: initialPreWarmed.room.otherUser.id,
    name: initialPreWarmed.room.otherUser.name,
    profileImageUrl: initialPreWarmed.room.otherUser.profileImageUrl || '/images/default-profile.svg',
    isActive: initialPreWarmed.room.otherUser.isActive ?? false,
  } : null;
  const initialMessages: Message[] = initialPreWarmed?.messages ? initialPreWarmed.messages.map(mapApiMessage) : [];

  // ─── Core state (needed for instant render) ───
  const [chatPartner, setChatPartner] = useState<ChatPartner | null>(initialPartner);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [messagesLoading, setMessagesLoading] = useState(initialMessages.length === 0);
  const [input, setInput] = useState('');

  // ─── Extra state (passed to ChatExtras) ───
  const [showAttach, setShowAttach] = useState(false);
  const [actionMenu, setActionMenu] = useState<{ id: string; x: number; y: number; mine: boolean } | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string; content: string } | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [muted, setMuted] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [voicePlayProgress, setVoicePlayProgress] = useState<Record<string, number>>({});
  const [pinnedMessage, setPinnedMessage] = useState<{ id: string; name: string; content: string } | null>(null);
  const [partialCopyMsg, setPartialCopyMsg] = useState<Message | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  // ─── Refs ───
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // ─── Data fetching ───
  useEffect(() => {
    let cancelled = false;

    async function loadRoom() {
      // Handle pending-{proId}: createRoom만 기다리고 URL 즉시 교체
      if (roomId.startsWith('pending-')) {
        const proId = roomId.replace('pending-', '');
        const pre = preWarmChat(proId); // idempotent
        const resolvedRoomId = await pre.roomIdPromise;
        if (cancelled) return;
        if (resolvedRoomId) {
          if (pre.room) {
            setChatPartner({
              id: pre.room.otherUser.id,
              name: pre.room.otherUser.name,
              profileImageUrl: pre.room.otherUser.profileImageUrl || '/images/default-profile.svg',
              isActive: pre.room.otherUser.isActive ?? false,
            });
          }
          const search = window.location.search;
          router.replace(`/chat/${resolvedRoomId}${search}`);
        } else {
          router.replace('/chat');
        }
        return;
      }

      // 이미 pre-warm에서 파트너를 받았으면 fetch 생략
      if (!chatPartner) {
        const storeRoom = useChatStore.getState().rooms.find((r) => r.id === roomId);
        if (storeRoom) {
          setChatPartner({
            id: storeRoom.otherUser.id,
            name: storeRoom.otherUser.name,
            profileImageUrl: storeRoom.otherUser.profileImageUrl || '/images/default-profile.svg',
            isActive: (storeRoom.otherUser as any).isActive ?? true,
          });
        }
      }
      try {
        const res = await chatApi.getRoom(roomId);
        if (cancelled) return;
        const room = res.data as ChatRoomItem & { iAmPro?: boolean; proProfileId?: string };
        setChatPartner({
          id: room.otherUser.id,
          name: room.otherUser.name,
          profileImageUrl: room.otherUser.profileImageUrl || '/images/default-profile.svg',
          isActive: room.otherUser.isActive ?? false,
        });
        // 이 채팅방에서 내가 프로(사회자) 측이면 견적서 발송 버튼 활성화
        if (room.iAmPro) setRoomProUserId(MY_ID);
      } catch (err) {
        console.error('Failed to load room info', err);
      }
    }

    async function loadMessages() {
      if (roomId.startsWith('pending-')) return;
      // pre-warm된 메시지를 이미 initial state로 넣어뒀다면 background refresh만
      if (initialMessages.length > 0) {
        chatApi.getMessages(roomId, { limit: 50 }).then((res) => {
          if (!cancelled) setMessages((res.data.data || []).map(mapApiMessage));
        }).catch(() => {});
        return;
      }
      const cachedMsgs = useChatStore.getState().messageCache.get(roomId);
      if (cachedMsgs && cachedMsgs.length > 0) {
        setMessages(cachedMsgs as any);
        setMessagesLoading(false);
        chatApi.getMessages(roomId, { limit: 50 }).then((res) => {
          if (!cancelled) setMessages((res.data.data || []).map(mapApiMessage));
        }).catch(() => {});
        return;
      }
      setMessagesLoading(true);
      try {
        const res = await chatApi.getMessages(roomId, { limit: 50 });
        if (cancelled) return;
        setMessages((res.data.data || []).map(mapApiMessage));
      } catch (err) {
        console.error('Failed to load messages', err);
      } finally {
        if (!cancelled) setMessagesLoading(false);
      }
    }

    loadRoom();
    loadMessages();
    return () => { cancelled = true; };
  }, [roomId]);

  // 언마운트 시 메시지 캐시 저장
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  useEffect(() => {
    return () => {
      if (messagesRef.current.length > 0) {
        useChatStore.getState().messageCache.set(roomId, messagesRef.current as any);
      }
    };
  }, [roomId]);

  // ─── WebSocket (첫 렌더 후 idle 시 연결) ───
  useEffect(() => {
    if (!authUser || roomId.startsWith('pending-')) return;
    const schedule = (typeof window !== 'undefined' && 'requestIdleCallback' in window)
      ? (window as any).requestIdleCallback
      : (cb: () => void) => setTimeout(cb, 50);
    const handle = schedule(() => {
      connect();
      joinRoom(roomId);
    });
    return () => {
      if (typeof window !== 'undefined' && 'cancelIdleCallback' in window && typeof handle === 'number') {
        (window as any).cancelIdleCallback(handle);
      }
      leaveRoom();
    };
  }, [authUser, roomId]);

  // Sync WebSocket messages
  const prevWsCountRef = useRef(0);
  useEffect(() => {
    if (wsMessages.length === 0) return;
    const newCount = wsMessages.length - prevWsCountRef.current;
    if (newCount <= 0) {
      prevWsCountRef.current = wsMessages.length;
      return;
    }
    const newWsMessages = wsMessages.slice(prevWsCountRef.current);
    prevWsCountRef.current = wsMessages.length;

    const mapped: Message[] = newWsMessages.map(mapApiMessage);
    setMessages((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const unique = mapped.filter((m) => !existingIds.has(m.id));
      if (unique.length === 0) return prev;
      // 낙관적 메시지(opt-) 중 같은 senderId+content인 것 제거
      const withoutOptimistic = prev.filter((m) => {
        if (!m.id.startsWith('opt-')) return true;
        return !unique.some((u) => u.senderId === m.senderId && u.content === m.content);
      });
      return [...withoutOptimistic, ...unique];
    });
  }, [wsMessages]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Send handler ───
  const handleSend = useCallback(() => {
    if (!input.trim()) return;

    if (authUser) {
      // 낙관적 업데이트: 즉시 화면에 표시
      const optimistic: Message = {
        id: `opt-${Date.now()}`,
        senderId: authUser.id,
        content: input.trim(),
        type: 'text',
        createdAt: new Date().toISOString(),
        isRead: false,
        replyTo: replyTo ? { id: replyTo.id, name: replyTo.name, content: replyTo.content } : null,
        isNew: true,
      };
      setMessages((prev) => [...prev, optimistic]);
      wsSendMessage({
        type: 'text',
        content: input.trim(),
        replyToId: replyTo?.id,
      });
      setInput('');
      setReplyTo(null);
      setMentionQuery(null);
      inputRef.current?.focus();
      setTimeout(() => {
        setMessages((prev) => prev.map((m) => m.id === optimistic.id ? { ...m, isNew: false } : m));
      }, 500);
      return;
    }

    // Fallback: local-only message for demo
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

    setTimeout(() => {
      setMessages((prev) => prev.map((m) => m.id === newMsg.id ? { ...m, isNew: false } : m));
    }, 700);
  }, [input, replyTo, authUser, wsSendMessage, MY_ID]);

  // ─── Input change + mention detection ───
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);

    const cursorPos = e.target.selectionStart || value.length;
    const textBeforeCursor = value.slice(0, cursorPos);
    const match = textBeforeCursor.match(/@([\w가-힣]*)$/);
    if (match) {
      setMentionQuery(match[1]);
    } else {
      setMentionQuery(null);
    }
  };

  // ─── Long press for action menu ───
  const handleLongPressStart = (e: React.PointerEvent | React.TouchEvent, msg: Message) => {
    if (msg.type === 'system') return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mine = msg.senderId === MY_ID;

    longPressTimer.current = setTimeout(() => {
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

  const scrollToMessage = (id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('animate-[replyHighlight_1.2s_ease-out]');
      setTimeout(() => el.classList.remove('animate-[replyHighlight_1.2s_ease-out]'), 1200);
    }
  };

  const isMine = (msg: Message) => msg.senderId === MY_ID;

  const formatVoiceDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Skeleton loading state — pre-warm 데이터가 이미 있으면 skip
  const hasData = !!chatPartner || messages.length > 0;
  const showSkeleton = !hasData && (roomId.startsWith('pending-') || (messagesLoading && messages.length === 0));
  const skeletonName = chatPartner?.name || urlProName;
  const skeletonImg = chatPartner?.profileImageUrl || urlProImg || '/images/default-profile.svg';

  if (showSkeleton) {
    return (
      <div className="fixed inset-0 flex flex-col bg-[#F2F2F7]" style={{ height: '100dvh' }}>
        {/* Top shimmer bar */}
        <div className="absolute top-0 left-0 right-0 h-[3px] z-50 overflow-hidden bg-gray-100">
          <div className="h-full bg-[#3180F7]/40 animate-[shimmerBar_1.4s_ease-in-out_infinite]" style={{ width: '60%' }} />
        </div>

        {/* Header skeleton */}
        <div className="absolute left-0 right-0 top-0 z-30 px-3 pt-3 pb-2 pt-safe">
          <div className="flex items-center gap-2 max-w-[680px] mx-auto">
            <button onClick={() => router.back()} className="w-12 h-12 rounded-full bg-white/90 shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-gray-200/60 flex items-center justify-center shrink-0">
              <ChevronLeft size={24} className="text-gray-600" strokeWidth={2.5} />
            </button>
            <div className="flex-1 flex items-center gap-3 bg-white/90 rounded-full shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-gray-200/60 pl-1.5 pr-4 h-12">
              <img src={skeletonImg} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
              <div className="flex-1 min-w-0">
                {skeletonName
                  ? <p className="text-[14px] font-bold text-gray-900 truncate">{skeletonName}</p>
                  : <div className="h-3.5 w-24 bg-gray-200 rounded-full animate-pulse" />
                }
                <div className="h-2.5 w-12 bg-gray-100 rounded-full mt-1 animate-pulse" />
              </div>
            </div>
            <div className="w-12 h-12 rounded-full bg-white/90 shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-gray-200/60" />
          </div>
        </div>

        {/* Message skeletons */}
        <div className="flex-1 overflow-hidden pt-[80px] pb-[80px] px-4 flex flex-col gap-5 justify-end">
          {[
            { mine: false, w: 'w-[60%]', h: 'h-14' },
            { mine: true, w: 'w-[45%]', h: 'h-10' },
            { mine: false, w: 'w-[70%]', h: 'h-20' },
            { mine: true, w: 'w-[55%]', h: 'h-10' },
            { mine: false, w: 'w-[50%]', h: 'h-12' },
          ].map((b, i) => (
            <div key={i} className={`flex items-end gap-2 ${b.mine ? 'flex-row-reverse' : 'flex-row'}`}>
              {!b.mine && <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse shrink-0" />}
              <div className={`${b.w} ${b.h} rounded-2xl ${b.mine ? 'rounded-br-sm bg-[#3180F7]/15' : 'rounded-bl-sm bg-white'} animate-pulse`} />
            </div>
          ))}
        </div>

        {/* Input skeleton */}
        <div className="px-3 pb-4 pb-safe pt-2 bg-[#F2F2F7]">
          <div className="flex items-center gap-2 bg-white rounded-full px-4 h-12 shadow-sm border border-gray-200/60">
            <div className="w-5 h-5 rounded-full bg-gray-200 animate-pulse" />
            <div className="flex-1 h-3 bg-gray-100 rounded-full animate-pulse" />
            <div className="w-5 h-5 rounded-full bg-gray-200 animate-pulse" />
          </div>
        </div>

        <style>{`
          @keyframes shimmerBar {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(266%); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-[#F2F2F7]" style={{ height: '100dvh' }}>
      {/* ─── 헤더 상단 그라데이션 블러 (z-20) ─── */}
      <div
        className="absolute left-0 right-0 top-0 h-[110px] z-20 pointer-events-none"
        style={{
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)',
          maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 100%)',
        }}
      />

      {/* ─── Header (Floating Pill) z-30 ─── */}
      <div className="absolute left-0 right-0 top-0 z-30 px-3 pt-3 pb-2 pt-safe pointer-events-none">
        <div className="flex items-center gap-2 max-w-[680px] mx-auto pointer-events-auto">
          {/* 뒤로가기 */}
          <button
            onClick={() => router.back()}
            className="w-12 h-12 rounded-full bg-white/90 backdrop-blur-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-gray-200/60 flex items-center justify-center shrink-0 active:scale-[0.88] transition-all hover:bg-white"
          >
            <ChevronLeft size={24} className="text-gray-600" strokeWidth={2.5} />
          </button>

          {/* 중앙 프로필 알약 (고객 채팅 시 클릭 없음) */}
          <Link
            href={isPro ? '#' : `/pros/${chatPartner?.id || ''}`}
            onClick={(e) => { if (isPro) e.preventDefault(); }}
            className="flex-1 flex items-center gap-3 bg-white/90 backdrop-blur-2xl rounded-full shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-gray-200/60 pl-1.5 pr-4 h-12 min-w-0 active:scale-[0.98] transition-transform hover:bg-white"
          >
            <div className="relative shrink-0">
              <img src={chatPartner?.profileImageUrl || '/images/default-profile.svg'} alt="" className="w-9 h-9 rounded-full object-cover" />
              {chatPartner?.isActive && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#34C759] border-2 border-white rounded-full" />}
            </div>
            <div className="flex-1 min-w-0 leading-tight">
              <div className="flex items-center gap-1.5">
                <p className="text-[14px] font-bold text-gray-900 truncate">{chatPartner?.name || '...'}</p>
                {chatPartner && (
                  <span
                    className="text-[9px] font-bold px-1.5 py-[1px] rounded shrink-0"
                    style={{
                      color: isPro ? '#6B7280' : '#3180F7',
                      backgroundColor: isPro ? '#F3F4F6' : '#EAF3FF',
                    }}
                  >
                    {isPro ? '고객' : '사회자'}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-gray-400">
                {chatPartner?.isActive ? '온라인' : chatPartner?.lastSeen ? `${chatPartner.lastSeen} 활동` : '오프라인'}
              </p>
            </div>
          </Link>

          {/* 메뉴 버튼 */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowHeaderMenu(!showHeaderMenu)}
              className="w-12 h-12 rounded-full bg-white/90 backdrop-blur-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-gray-200/60 flex items-center justify-center active:scale-[0.88] transition-all hover:bg-white"
            >
              <MoreVertical size={20} className="text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Messages ─── */}
      <div
        className="flex-1 overflow-y-auto px-3 pt-[80px] pb-[88px]"
        onClick={() => { setActionMenu(null); setShowAttach(false); }}
      >
        <div className="max-w-[680px] mx-auto">
          {messagesLoading && messages.length === 0 && (
            <div className="space-y-4 pt-4">
              {[1,2,3,4,5].map((i) => (
                <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : ''}`}>
                  <div className={`flex items-end gap-2 ${i % 2 === 0 ? 'flex-row-reverse' : ''}`}>
                    {i % 2 !== 0 && <div className="w-8 h-8 rounded-full bg-gray-100 animate-pulse shrink-0" />}
                    <div className="rounded-2xl bg-gray-100 animate-pulse" style={{ width: `${100 + i * 25}px`, height: 36 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {!messagesLoading && messages.length === 0 && chatPartner && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <img src={chatPartner.profileImageUrl} alt="" className="w-16 h-16 rounded-full object-cover mb-3" />
              <p className="text-[15px] font-bold text-gray-900">{chatPartner.name}</p>
              <p className="text-[13px] text-gray-400 mt-1">대화를 시작해보세요</p>
            </div>
          )}
          {messages.map((msg, i) => {
            const showDate = shouldShowDateDivider(messages, i);

            if (msg.type === 'system') {
              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="text-center py-3">
                      <span className="text-[11px] text-gray-400">{formatDateDivider(msg.createdAt)}</span>
                    </div>
                  )}
                  {msg.system ? (
                    <Suspense fallback={<SystemMessageFallback msg={msg} />}>
                      <SystemMessageCard msg={msg} isPro={isPro} chatPartner={chatPartner} />
                    </Suspense>
                  ) : (
                    <SystemMessageFallback msg={msg} />
                  )}
                </div>
              );
            }

            const mine = isMine(msg);

            return (
              <div key={msg.id} id={`msg-${msg.id}`}>
                {showDate && (
                  <div className="text-center py-3">
                    <span className="text-[11px] text-gray-400">{formatDateDivider(msg.createdAt)}</span>
                  </div>
                )}

                <div
                  className={`flex ${mine ? 'justify-end' : 'justify-start'} mb-[6px] relative select-none`}
                  style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <div className="max-w-[78%] relative">
                    {/* Message bubble */}
                    {msg.type === 'image' ? (
                      <div
                        className={`select-none ${msg.isNew ? 'animate-[bubblePop_0.5s_cubic-bezier(0.34,1.56,0.64,1)]' : ''}`}
                        style={{ WebkitTouchCallout: 'none' }}
                        onPointerDown={(e) => handleLongPressStart(e, msg)}
                        onPointerUp={handleLongPressCancel}
                        onPointerLeave={handleLongPressCancel}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        <img
                          src={msg.content}
                          alt=""
                          draggable={false}
                          className="rounded-2xl max-w-[260px] max-h-[340px] object-cover cursor-pointer select-none"
                          style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', pointerEvents: 'auto' }}
                          onClick={(e) => { e.stopPropagation(); setImagePreview(msg.content); }}
                        />
                      </div>
                    ) : msg.type === 'file' ? (
                      <div
                        className={`flex items-center gap-2 px-4 py-3 rounded-[20px] select-none ${mine ? 'bg-[#007AFF] text-white' : 'bg-white text-gray-900'} ${msg.isNew ? 'animate-[bubblePop_0.5s_cubic-bezier(0.34,1.56,0.64,1)]' : ''}`}
                        style={{ WebkitTouchCallout: 'none' }}
                        onPointerDown={(e) => handleLongPressStart(e, msg)}
                        onPointerUp={handleLongPressCancel}
                        onPointerLeave={handleLongPressCancel}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        <FileText size={18} />
                        <span className="text-[15px]">{msg.fileName || msg.content}</span>
                      </div>
                    ) : msg.type === 'location' ? (
                      <div
                        className={`select-none ${msg.isNew ? 'animate-[bubblePop_0.5s_cubic-bezier(0.34,1.56,0.64,1)]' : ''}`}
                        style={{ transformOrigin: mine ? 'right bottom' : 'left bottom', WebkitTouchCallout: 'none' }}
                        onPointerDown={(e) => handleLongPressStart(e, msg)}
                        onPointerUp={handleLongPressCancel}
                        onPointerLeave={handleLongPressCancel}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        {msg.latitude !== undefined && msg.longitude !== undefined ? (
                          // Simple fallback for location - just show coordinates until NaverMapPreview loads
                          <div className={`flex items-center gap-2 px-4 py-3 rounded-[20px] ${mine ? 'bg-[#007AFF] text-white' : 'bg-white text-gray-900'}`}>
                            <MapPin size={18} />
                            <span className="text-[15px]">{msg.content}</span>
                          </div>
                        ) : (
                          <div className={`flex items-center gap-2 px-4 py-3 rounded-[20px] ${mine ? 'bg-[#007AFF] text-white' : 'bg-white text-gray-900'}`}>
                            <MapPin size={18} />
                            <span className="text-[15px]">{msg.content}</span>
                          </div>
                        )}
                      </div>
                    ) : msg.type === 'voice' ? (
                      <div
                        className={`flex items-center gap-3 pl-3 pr-4 py-2.5 rounded-[20px] min-w-[180px] select-none ${mine ? 'bg-[#007AFF] text-white' : 'bg-white text-gray-900 shadow-[0_0.5px_1px_rgba(0,0,0,0.04)]'} ${msg.isNew ? 'animate-[bubblePop_0.5s_cubic-bezier(0.34,1.56,0.64,1)]' : ''}`}
                        style={{ WebkitTouchCallout: 'none' }}
                        onPointerDown={(e) => handleLongPressStart(e, msg)}
                        onPointerUp={handleLongPressCancel}
                        onPointerLeave={handleLongPressCancel}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${mine ? 'bg-white/20' : 'bg-[#007AFF]'}`}>
                          <Mic size={16} className="text-white" />
                        </div>
                        <div className="flex-1 flex items-center gap-0.5 h-7 min-w-[80px]">
                          {Array.from({ length: 22 }).map((_, idx) => {
                            const progress = voicePlayProgress[msg.id] || 0;
                            const filled = idx / 22 < progress;
                            const heights = [40, 65, 50, 80, 55, 70, 45, 90, 60, 75, 50, 85, 65, 55, 70, 45, 80, 60, 50, 75, 55, 65];
                            return (
                              <div
                                key={idx}
                                className="flex-1 rounded-full transition-colors"
                                style={{
                                  height: `${heights[idx]}%`,
                                  backgroundColor: mine
                                    ? (filled ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.4)')
                                    : (filled ? '#007AFF' : '#C7C7CC'),
                                }}
                              />
                            );
                          })}
                        </div>
                        <span className={`text-[12px] tabular-nums shrink-0 ${mine ? 'text-white/80' : 'text-gray-500'}`}>
                          {formatVoiceDuration(msg.duration || 0)}
                        </span>
                      </div>
                    ) : (
                      <div
                        className={`whitespace-pre-wrap text-[16px] leading-[1.4] cursor-pointer select-none overflow-hidden ${
                          mine
                            ? 'bg-[#007AFF] text-white rounded-[20px] rounded-br-[6px]'
                            : 'bg-white text-gray-900 rounded-[20px] rounded-bl-[6px] shadow-[0_0.5px_1px_rgba(0,0,0,0.04)]'
                        } ${msg.isNew ? 'animate-[bubblePop_0.5s_cubic-bezier(0.34,1.56,0.64,1)]' : ''} ${actionMenu?.id === msg.id ? 'ring-2 ring-[#007AFF]/40' : ''}`}
                        style={{
                          transformOrigin: mine ? 'right bottom' : 'left bottom',
                          WebkitTouchCallout: 'none',
                          WebkitUserSelect: 'none',
                          userSelect: 'none',
                        }}
                        onPointerDown={(e) => handleLongPressStart(e, msg)}
                        onPointerUp={handleLongPressCancel}
                        onPointerLeave={handleLongPressCancel}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        {/* Reply header */}
                        {msg.replyTo && (
                          <button
                            onClick={(e) => { e.stopPropagation(); scrollToMessage(msg.replyTo!.id); }}
                            className={`block w-full text-left px-4 pt-2.5 pb-2 border-b ${mine ? 'border-white/25' : 'border-gray-200'}`}
                          >
                            <p className={`text-[11px] font-bold ${mine ? 'text-white' : 'text-gray-900'}`}>
                              {msg.replyTo.name}
                            </p>
                            <p className={`text-[12px] truncate ${mine ? 'text-white/85' : 'text-gray-600'}`}>
                              {msg.replyTo.content}
                            </p>
                          </button>
                        )}
                        <div className="px-4 py-[10px]">
                          {renderTextWithMentions(msg.content)}
                        </div>
                      </div>
                    )}

                    {/* Reaction badge */}
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

      {/* ─── 입력바 하단 그라데이션 블러 (z-20) ─── */}
      <div
        className="absolute left-0 right-0 bottom-0 h-[120px] z-20 pointer-events-none"
        style={{
          WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)',
          maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          background: 'linear-gradient(to top, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 100%)',
        }}
      />

      {/* ─── Input Bar (Floating Pill) z-30 ─── */}
      <div className="absolute left-0 right-0 bottom-0 z-30 px-3 pb-3 pt-2 pb-safe pointer-events-none">
        <div className="flex items-end gap-2 max-w-[680px] mx-auto pointer-events-auto">
          {isRecording ? (
            // Recording UI
            <>
              <button
                onClick={() => setIsRecording(false)}
                className="w-12 h-12 rounded-full bg-white/90 backdrop-blur-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-gray-200/60 flex items-center justify-center shrink-0 active:scale-[0.88] transition-transform"
                title="취소"
              >
                <X size={22} className="text-gray-500" />
              </button>
              <div className="flex-1 flex items-center gap-3 bg-white/90 backdrop-blur-2xl rounded-full shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-red-200/80 px-5 h-12 animate-[slideUp_0.2s_ease]">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                </span>
                <span className="text-[14px] font-bold text-red-500 tabular-nums">
                  {formatVoiceDuration(recordingTime)}
                </span>
                <div className="flex-1 flex items-center gap-0.5 h-6">
                  {Array.from({ length: 22 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="flex-1 bg-red-300 rounded-full"
                      style={{
                        height: `${30 + Math.abs(Math.sin((recordingTime + idx) * 0.6)) * 70}%`,
                        animation: `voiceBar 0.6s ease-in-out ${idx * 0.04}s infinite alternate`,
                      }}
                    />
                  ))}
                </div>
                <button
                  onClick={() => setIsRecording(false)}
                  className="w-9 h-9 rounded-full bg-gray-700 hover:bg-gray-800 flex items-center justify-center shrink-0 active:scale-[0.88] transition-transform"
                  title="전송"
                >
                  <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><path d="M3 9L15 3L9 15L8 10L3 9Z" fill="white" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/></svg>
                </button>
              </div>
            </>
          ) : (
            // Normal input UI
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setShowAttach(!showAttach); }}
                className="w-12 h-12 rounded-full bg-white/90 backdrop-blur-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-gray-200/60 flex items-center justify-center shrink-0 active:scale-[0.88] transition-all hover:bg-white"
              >
                <Plus size={24} className="text-gray-600" />
              </button>

              <div className="flex-1 flex items-center bg-white/90 backdrop-blur-2xl rounded-full shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-gray-200/60 pl-5 pr-1.5 h-12">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="메시지 (@ 으로 멘션)"
                  className="flex-1 min-w-0 bg-transparent text-[16px] focus:outline-none placeholder:text-gray-400 leading-[1.3]"
                />
                {input.trim() ? (
                  <button
                    onClick={handleSend}
                    className="w-9 h-9 rounded-full bg-gray-800 hover:bg-gray-900 flex items-center justify-center shrink-0 active:scale-[0.88] transition-transform ml-1"
                  >
                    <svg width="16" height="16" viewBox="0 0 18 18" fill="none"><path d="M3 9L15 3L9 15L8 10L3 9Z" fill="white" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/></svg>
                  </button>
                ) : (
                  <button
                    onClick={() => setIsRecording(true)}
                    className="w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center shrink-0 active:scale-[0.88] transition-all ml-1"
                    title="음성 메시지 녹음"
                  >
                    <Mic size={20} className="text-gray-600" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── Lazy-loaded ChatExtras (modals, action menu, rich cards, etc.) ─── */}
      <Suspense fallback={null}>
        <ChatExtras
          messages={messages}
          setMessages={setMessages}
          chatPartner={chatPartner}
          MY_ID={MY_ID}
          isPro={isPro}
          actionMenu={actionMenu}
          setActionMenu={setActionMenu}
          replyTo={replyTo}
          setReplyTo={setReplyTo}
          imagePreview={imagePreview}
          setImagePreview={setImagePreview}
          showHeaderMenu={showHeaderMenu}
          setShowHeaderMenu={setShowHeaderMenu}
          muted={muted}
          setMuted={setMuted}
          showAttach={showAttach}
          setShowAttach={setShowAttach}
          showQuoteModal={showQuoteModal}
          setShowQuoteModal={setShowQuoteModal}
          showLocationPicker={showLocationPicker}
          setShowLocationPicker={setShowLocationPicker}
          pinnedMessage={pinnedMessage}
          setPinnedMessage={setPinnedMessage}
          partialCopyMsg={partialCopyMsg}
          setPartialCopyMsg={setPartialCopyMsg}
          isRecording={isRecording}
          setIsRecording={setIsRecording}
          recordingTime={recordingTime}
          setRecordingTime={setRecordingTime}
          playingVoice={playingVoice}
          setPlayingVoice={setPlayingVoice}
          voicePlayProgress={voicePlayProgress}
          setVoicePlayProgress={setVoicePlayProgress}
          mentionQuery={mentionQuery}
          setMentionQuery={setMentionQuery}
          inputRef={inputRef}
          fileInputRef={fileInputRef}
          cameraInputRef={cameraInputRef}
        />
      </Suspense>

      {/* Animation keyframes */}
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
        @keyframes voiceBar {
          0% { transform: scaleY(0.5); }
          100% { transform: scaleY(1); }
        }
        @keyframes attachItemUp {
          0% {
            opacity: 0;
            transform: translateY(16px) scale(0.96);
            filter: blur(8px);
          }
          60% {
            filter: blur(0);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }
      `}} />
    </div>
  );
}
