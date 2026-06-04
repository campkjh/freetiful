'use client';

import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronLeft, Mic, X, MoreVertical, Plus, MapPin, FileText, FileSignature, Play, Pause,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';
import { useChatStore } from '@/lib/store/chat.store';
import { chatApi, type ChatRoomItem, type MessageItem } from '@/lib/api/chat.api';
import { preWarmChat, getPreWarmByProId, getPreWarmByRoomId } from '@/lib/chat-prewarm';
import type { Message, ChatPartner, SystemPayload } from './chat-types';

const ChatExtras = lazy(() => import('./ChatExtras'));
const SystemMessageCard = lazy(() => import('./ChatExtras').then((m) => ({ default: m.SystemMessageCard })));

// ── 채팅 메시지 localStorage 캐시 (딥링크·앱 재시작 후 즉시 표시) ─────────────
const MSG_CACHE_PREFIX = 'freetiful-chat-msg-cache-v1-';
const MSG_CACHE_LIMIT = 30;

function saveMsgCache(roomId: string, messages: Message[]) {
  if (typeof window === 'undefined') return;
  try {
    const recent = messages.slice(-MSG_CACHE_LIMIT);
    localStorage.setItem(MSG_CACHE_PREFIX + roomId, JSON.stringify(recent));
  } catch {}
}

function loadMsgCache(roomId: string): Message[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(MSG_CACHE_PREFIX + roomId);
    if (!raw) return [];
    return JSON.parse(raw) as Message[];
  } catch { return []; }
}

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

function mapCachedMessage(m: MessageItem | Message): Message {
  if ('metadata' in m || 'roomId' in m || 'sender' in m) {
    return mapApiMessage(m as MessageItem);
  }
  return m as Message;
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

function messageTime(message: Pick<Message, 'createdAt'>) {
  const time = new Date(message.createdAt).getTime();
  return Number.isFinite(time) ? time : 0;
}

function hasFetchedEquivalent(message: Message, fetched: Message[]) {
  if (!message.id.startsWith('opt-')) return false;
  const sentAt = messageTime(message);
  return fetched.some((item) => (
    item.senderId === message.senderId &&
    item.content === message.content &&
    messageTime(item) >= sentAt - 2_000 &&
    Math.abs(messageTime(item) - sentAt) < 60_000
  ));
}

function mergeFetchedMessages(current: Message[], fetched: Message[], requestedAt: number) {
  // API가 빈 배열을 반환하면 기존 메시지를 지우지 않는다 (서버 이상/일시적 빈 응답 방어)
  if (fetched.length === 0 && current.length > 0) return current;
  const fetchedIds = new Set(fetched.map((message) => message.id));
  const preserved = current.filter((message) => {
    if (fetchedIds.has(message.id)) return false;
    if (hasFetchedEquivalent(message, fetched)) return false;
    if (message.id.startsWith('opt-')) return true;
    return messageTime(message) >= requestedAt - 2_000;
  });

  return [...fetched, ...preserved].sort((a, b) => messageTime(a) - messageTime(b));
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

// eventTime 은 DB 에서 `1970-01-01T${HH:MM}` 형태 Date 로 저장돼 ISO 문자열로 직렬화되므로
// 그대로 표시하면 "1970-01-01T..." 가 노출된다. 항상 HH:MM 만 추출해서 보여준다.
function formatEventTimeShort(t: string | Date | null | undefined): string {
  if (!t) return '';
  if (typeof t === 'string' && /^\d{1,2}:\d{2}/.test(t)) {
    const [hh, mm] = t.split(':');
    return `${hh.padStart(2, '0')}:${mm.slice(0, 2)}`;
  }
  if (typeof t === 'string') {
    const isoTime = t.match(/T(\d{2}:\d{2})/);
    if (isoTime) return isoTime[1];
  }
  try {
    const d = typeof t === 'string' ? new Date(t) : t;
    if (Number.isNaN(d.getTime())) return '';
    const h = d.getHours().toString().padStart(2, '0');
    const m = d.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  } catch {
    return '';
  }
}

// 채팅 헤더 바로 아래 fixed 위치에 도킹되는 스케줄 공지 — 결제 완료 시 노출.
// 톤앤매너: 흰 배경 + 블루(#3180F7) 액센트, 백드롭 블러로 헤더와 같은 결.
function ScheduleBanner({
  roomMeta,
  isPro,
  chatPartner,
  collapsed,
  onToggle,
}: {
  roomMeta: Pick<ChatRoomItem, 'matchRequest' | 'latestQuotation'> | null;
  isPro: boolean;
  chatPartner: ChatPartner | null;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const q = roomMeta?.latestQuotation;
  if (!q || q.status !== 'paid') return null;

  const mr = roomMeta?.matchRequest as any;
  const raw: any = mr?.rawUserInput && typeof mr.rawUserInput === 'object' ? mr.rawUserInput : {};
  const dateSource = mr?.eventDate || raw.date || q.eventDate;
  const timeSource = mr?.eventTime || raw.timeStart || q.eventTime;
  const location = mr?.eventLocation || raw.location || (q as any).eventLocation;
  const eventTitle = raw.eventName || q.title || mr?.eventCategory?.name || '행사 진행';

  const dateStr = dateSource
    ? new Date(dateSource).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
    : '일정 미정';
  const timeShort = formatEventTimeShort(timeSource);
  const timeSuffix = timeShort ? ` · ${timeShort}` : '';

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        border: '1px solid rgba(49,128,247,0.18)',
        boxShadow: '0 8px 24px rgba(49,128,247,0.10), 0 1px 0 rgba(0,0,0,0.02)',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 active:bg-[#3180F7]/[0.04] transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
            <rect x="3" y="5" width="18" height="16" rx="2.5" stroke="#3180F7" strokeWidth="1.8" />
            <path d="M3 10h18" stroke="#3180F7" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M8 3v4M16 3v4" stroke="#3180F7" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <p className="text-[12.5px] font-bold text-gray-900 truncate">
            확정된 일정 · {dateStr}{timeSuffix}
          </p>
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          className="shrink-0 transition-transform"
          style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}
        >
          <path d="M6 9l6 6 6-6" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {!collapsed && (
        <div className="px-4 pb-3 pt-2 border-t border-gray-100 space-y-1">
          <p className="text-[13.5px] font-semibold text-gray-900">{eventTitle}</p>
          {location && <p className="text-[12px] text-gray-500 truncate">장소 · {location}</p>}
          {q.amount != null && (
            <p className="text-[12px] text-gray-600 tabular-nums">결제 완료 · {Number(q.amount).toLocaleString('ko-KR')}원</p>
          )}
          <p className="text-[11px] text-gray-400 mt-1">
            {isPro ? '고객과 세부 진행 사항을 채팅으로 논의해주세요' : '사회자와 세부 진행 사항을 채팅으로 논의해주세요'}
          </p>
        </div>
      )}
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
  const { connect, joinRoom, leaveRoom, sendMessage: wsSendMessage, messages: wsMessages, setTyping } = useChatStore();

  // ─── Pre-warmed data 즉시 사용 (initial state만 계산) ───
  const initialPreWarmed = (() => {
    if (typeof window === 'undefined') return null;
    if (roomId.startsWith('pending-')) {
      return getPreWarmByProId(roomId.replace('pending-', ''));
    }
    return getPreWarmByRoomId(roomId);
  })();
  const initialIAmProInRoom = typeof initialPreWarmed?.room?.iAmPro === 'boolean'
    ? initialPreWarmed.room.iAmPro
    : null;
  const initialPartner: ChatPartner | null = initialPreWarmed?.room ? {
    id: initialPreWarmed.room.otherUser.id,
    proProfileId: (initialPreWarmed.room as any).proProfileId,
    name: initialPreWarmed.room.otherUser.name,
    profileImageUrl: initialPreWarmed.room.otherUser.profileImageUrl || '/images/default-profile.svg',
    isActive: initialPreWarmed.room.otherUser.isActive ?? false,
  } : null;
  const initialMessages: Message[] = initialPreWarmed?.messages ? initialPreWarmed.messages.map(mapApiMessage) : [];

  // 헤더 아래 스케줄 배너가 즉시 뜨도록, prewarm 또는 store rooms 에 들어있는
  // matchRequest / latestQuotation 을 초기값으로 사용. (이전엔 chatApi.getRoom 응답을
  // 기다려야 해서 채팅방 진입 후 한참 뒤에야 배너가 떴음)
  const initialRoomMeta = (() => {
    if (typeof window === 'undefined') return null;
    const fromPrewarm: any = initialPreWarmed?.room;
    if (fromPrewarm?.latestQuotation || fromPrewarm?.matchRequest) {
      return {
        matchRequest: fromPrewarm.matchRequest ?? null,
        latestQuotation: fromPrewarm.latestQuotation ?? null,
      };
    }
    const fromStore: any = useChatStore.getState().rooms.find((r) => r.id === roomId);
    if (fromStore?.latestQuotation || fromStore?.matchRequest) {
      return {
        matchRequest: fromStore.matchRequest ?? null,
        latestQuotation: fromStore.latestQuotation ?? null,
      };
    }
    return null;
  })();

  // ─── Keyboard offset (Android WebView 키보드 감지) ───
  // interactive-widget=resizes-content 지원 시: window.innerHeight 가 이미 줄어들어 vv.height ≈ innerHeight → offset≈0
  // 미지원 시: innerHeight 유지, vv.height만 줄어 → offset = 키보드 높이
  // iOS WKWebView: fixed 요소가 visual viewport 자동 추적하므로 스킵
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  useEffect(() => {
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      setKeyboardOffset(Math.max(0, window.innerHeight - vv.height));
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  // ─── Core state (needed for instant render) ───
  const [chatPartner, setChatPartner] = useState<ChatPartner | null>(initialPartner);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [messagesLoading, setMessagesLoading] = useState(initialMessages.length === 0);
  const [messagesLoadFailed, setMessagesLoadFailed] = useState(false);
  const [messagesLoadError, setMessagesLoadError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [iAmProInRoom, setIAmProInRoom] = useState<boolean | null>(initialIAmProInRoom);
  const [roomMeta, setRoomMeta] = useState<Pick<ChatRoomItem, 'matchRequest' | 'latestQuotation'> | null>(initialRoomMeta);
  const [showCustomerInfo, setShowCustomerInfo] = useState(false);
  const isPro = iAmProInRoom === true;
  const partnerRoleKnown = iAmProInRoom !== null;
  const partnerIsPro = iAmProInRoom === false;
  const partnerProfileId = chatPartner?.proProfileId || chatPartner?.id;
  const openPartnerProfile = useCallback(() => {
    if (partnerIsPro && partnerProfileId) {
      router.push(`/pros/${partnerProfileId}`);
      return;
    }
    if (isPro) setShowCustomerInfo(true);
  }, [isPro, partnerIsPro, partnerProfileId, router]);

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
  const startRecordingRef = useRef<(() => void) | null>(null);
  const stopRecordingRef = useRef<((cancel: boolean) => void) | null>(null);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [voicePlayProgress, setVoicePlayProgress] = useState<Record<string, number>>({});
  const [pinnedMessage, setPinnedMessage] = useState<{ id: string; name: string; content: string } | null>(null);
  const [partialCopyMsg, setPartialCopyMsg] = useState<Message | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [scheduleBannerCollapsed, setScheduleBannerCollapsed] = useState(true);

  // ─── Refs ───
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasInitialScrolledRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const lastSendRef = useRef<{ text: string; at: number } | null>(null);

  // ─── Data fetching ───
  useEffect(() => {
    let cancelled = false;

    async function loadRoom() {
      setIAmProInRoom(initialIAmProInRoom);
      if (initialPartner) {
        setChatPartner(initialPartner);
      } else if (!roomId.startsWith('pending-')) {
        setChatPartner(null);
      }

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
              proProfileId: proId,                  // pending-{proId} 의 proId 가 곧 pro profile ID
              name: pre.room.otherUser.name,
              profileImageUrl: pre.room.otherUser.profileImageUrl || '/images/default-profile.svg',
              isActive: pre.room.otherUser.isActive ?? false,
            });
            if (typeof pre.room.iAmPro === 'boolean') {
              setIAmProInRoom(pre.room.iAmPro);
            }
          }
          const search = window.location.search;
          router.replace(`/chat/${resolvedRoomId}${search}`);
        } else {
          router.replace('/chat');
        }
        return;
      }

      // 이미 pre-warm에서 파트너를 받았으면 fetch 생략
      if (!initialPartner) {
        const storeRoom = useChatStore.getState().rooms.find((r) => r.id === roomId);
        if (storeRoom) {
          setChatPartner({
            id: storeRoom.otherUser.id,
            proProfileId: (storeRoom as any).proProfileId,
            name: storeRoom.otherUser.name,
            profileImageUrl: storeRoom.otherUser.profileImageUrl || '/images/default-profile.svg',
            isActive: (storeRoom.otherUser as any).isActive ?? true,
          });
          if (typeof storeRoom.iAmPro === 'boolean') {
            setIAmProInRoom(storeRoom.iAmPro);
          }
        }
      }
      try {
        const res = await chatApi.getRoom(roomId);
        if (cancelled) return;
        const room = res.data as ChatRoomItem & { iAmPro?: boolean; proProfileId?: string };
        setChatPartner({
          id: room.otherUser.id,
          proProfileId: room.proProfileId,
          name: room.otherUser.name,
          profileImageUrl: room.otherUser.profileImageUrl || '/images/default-profile.svg',
          isActive: room.otherUser.isActive ?? false,
        });
        // 현재 유저의 전역 role 이 아니라, 이 채팅방 안에서의 역할만 신뢰한다.
        setIAmProInRoom(Boolean(room.iAmPro));
        setRoomMeta({
          matchRequest: room.matchRequest ?? null,
          latestQuotation: room.latestQuotation ?? null,
        });
      } catch (err) {
        console.error('Failed to load room info', err);
      }
    }

    async function loadMessages() {
      if (roomId.startsWith('pending-')) return;
      // pre-warm된 메시지를 이미 initial state로 넣어뒀다면 background refresh만
      if (initialMessages.length > 0) {
        setMessagesLoading(false);
        const requestedAt = Date.now();
        chatApi.getMessages(roomId, { limit: 50 }).then((res) => {
          if (!cancelled) {
            const apiMessages = res.data.data || [];
            const mapped = apiMessages.map(mapApiMessage);
            useChatStore.getState().messageCache.set(roomId, apiMessages);
            saveMsgCache(roomId, mapped);
            setMessages((prev) => mergeFetchedMessages(prev, mapped, requestedAt));
          }
        }).catch(() => {});
        return;
      }
      // ── localStorage 캐시 (딥링크·앱 재시작 후 즉시 표시) ──────────────────
      const lsCache = loadMsgCache(roomId);
      if (lsCache.length > 0) {
        setMessages(lsCache);
        setMessagesLoading(false);
        // 백그라운드 갱신
        const requestedAt = Date.now();
        chatApi.getMessages(roomId, { limit: 50 }).then((res) => {
          if (!cancelled) {
            const apiMessages = res.data.data || [];
            const mapped = apiMessages.map(mapApiMessage);
            useChatStore.getState().messageCache.set(roomId, apiMessages);
            saveMsgCache(roomId, mapped);
            setMessages((prev) => mergeFetchedMessages(prev, mapped, requestedAt));
          }
        }).catch(() => {});
        return;
      }
      const prewarmed = getPreWarmByRoomId(roomId);
      if (prewarmed?.messages?.length) {
        setMessages(prewarmed.messages.map(mapApiMessage));
        setMessagesLoading(false);
        const requestedAt = Date.now();
        chatApi.getMessages(roomId, { limit: 50 }).then((res) => {
          if (!cancelled) {
            const apiMessages = res.data.data || [];
            const mapped = apiMessages.map(mapApiMessage);
            useChatStore.getState().messageCache.set(roomId, apiMessages);
            setMessages((prev) => mergeFetchedMessages(prev, mapped, requestedAt));
          }
        }).catch(() => {});
        return;
      }
      if (prewarmed?.messagesPromise) {
        setMessagesLoading(messages.length === 0);
        const requestedAt = Date.now();
        const warmMessages = await prewarmed.messagesPromise;
        if (cancelled) return;
        if (warmMessages?.length) {
          useChatStore.getState().messageCache.set(roomId, warmMessages);
          const mapped = warmMessages.map(mapApiMessage);
          setMessages((prev) => mergeFetchedMessages(prev, mapped, requestedAt));
          setMessagesLoading(false);
          return;
        }
      }
      const cachedMsgs = useChatStore.getState().messageCache.get(roomId);
      if (cachedMsgs && cachedMsgs.length > 0) {
        setMessages(cachedMsgs.map(mapCachedMessage));
        setMessagesLoading(false);
        const requestedAt = Date.now();
        chatApi.getMessages(roomId, { limit: 50 }).then((res) => {
          if (!cancelled) {
            const apiMessages = res.data.data || [];
            const mapped = apiMessages.map(mapApiMessage);
            useChatStore.getState().messageCache.set(roomId, apiMessages);
            setMessages((prev) => mergeFetchedMessages(prev, mapped, requestedAt));
          }
        }).catch(() => {});
        return;
      }
      setMessagesLoading(true);
      try {
        const requestedAt = Date.now();
        const res = await chatApi.getMessages(roomId, { limit: 50 });
        if (cancelled) return;
        const apiMessages = res.data.data || [];
        const mapped = apiMessages.map(mapApiMessage);
        useChatStore.getState().messageCache.set(roomId, apiMessages);
        saveMsgCache(roomId, mapped);
        setMessages((prev) => mergeFetchedMessages(prev, mapped, requestedAt));
        setMessagesLoadFailed(false);
      } catch (err: any) {
        console.error('Failed to load messages', err);
        if (!cancelled) {
          setMessagesLoadFailed(true);
          const status = err?.response?.status;
          setMessagesLoadError(status ? `${status}` : (err?.code || err?.message || '알 수 없음'));
        }
      } finally {
        if (!cancelled) setMessagesLoading(false);
      }
    }

    loadRoom();
    loadMessages();
    return () => { cancelled = true; };
  }, [roomId]);

  // ─── WebSocket (즉시 연결 — 지연 시 실시간성 저하) ───
  useEffect(() => {
    if (!authUser || roomId.startsWith('pending-')) return;
    connect();
    joinRoom(roomId);
    return () => {
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

  // Auto-scroll — 최초 로드 시엔 instant 로 맨 밑으로, 이후엔 smooth
  useEffect(() => {
    if (messages.length === 0) return;
    const container = scrollContainerRef.current;
    const scrollToBottom = (smooth: boolean) => {
      if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' });
      }
    };
    if (!hasInitialScrolledRef.current) {
      // 최초 1회: 레이아웃 반영 후 즉시 스크롤. 이미지 로드에 따라 scrollHeight 변하니 다음 프레임에서도 한번 더 보정
      requestAnimationFrame(() => {
        scrollToBottom(false);
        requestAnimationFrame(() => scrollToBottom(false));
      });
      hasInitialScrolledRef.current = true;
    } else {
      scrollToBottom(true);
    }
  }, [messages]);

  // 채팅방 교체/언마운트 시 초기 스크롤 플래그 리셋
  useEffect(() => {
    hasInitialScrolledRef.current = false;
  }, [roomId]);

  // 이미지 로드 완료 시 scrollHeight 확장을 반영해 한번 더 맨 밑으로 당겨줌 (초기 진입시만)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handler = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target?.tagName !== 'IMG') return;
      // 사용자가 스크롤을 이미 올려둔 상태라면 방해하지 않음
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      if (distanceFromBottom < 200) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'auto' });
      }
    };
    container.addEventListener('load', handler, true);
    return () => container.removeEventListener('load', handler, true);
  }, []);

  // ─── Send handler ───
  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    const now = Date.now();
    if (lastSendRef.current?.text === text && now - lastSendRef.current.at < 1200) return;
    lastSendRef.current = { text, at: now };

    if (authUser) {
      // 낙관적 업데이트: 즉시 화면에 표시
      const optimistic: Message = {
        id: `opt-${Date.now()}`,
        senderId: authUser.id,
        content: text,
        type: 'text',
        createdAt: new Date().toISOString(),
        isRead: false,
        replyTo: replyTo ? { id: replyTo.id, name: replyTo.name, content: replyTo.content } : null,
        isNew: true,
      };
      setMessages((prev) => [...prev, optimistic]);
      void wsSendMessage({
        type: 'text',
        content: text,
        replyToId: replyTo?.id,
      }).then((saved) => {
        if (!saved) return;
        const persisted = { ...mapApiMessage(saved), isNew: false };
        setMessages((prev) => {
          const withoutOptimistic = prev.filter((m) => m.id !== optimistic.id);
          if (withoutOptimistic.some((m) => m.id === persisted.id)) return withoutOptimistic;
          return [...withoutOptimistic, persisted];
        });
      }).catch(() => {
        setMessages((prev) => prev.map((m) => (
          m.id === optimistic.id ? { ...m, isNew: false } : m
        )));
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
      content: text,
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

  const handleVoicePlay = (msg: Message) => {
    if (playingVoice === msg.id) {
      voiceAudioRef.current?.pause();
      setPlayingVoice(null);
      return;
    }
    voiceAudioRef.current?.pause();
    const audio = new Audio(msg.content);
    voiceAudioRef.current = audio;
    audio.addEventListener('timeupdate', () => {
      if (!audio.duration) return;
      setVoicePlayProgress((prev) => ({ ...prev, [msg.id]: audio.currentTime / audio.duration }));
    });
    audio.addEventListener('ended', () => {
      setPlayingVoice(null);
      setVoicePlayProgress((prev) => ({ ...prev, [msg.id]: 0 }));
    });
    audio.play().catch(() => {});
    setPlayingVoice(msg.id);
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
      <div className="fixed inset-0 flex flex-col overflow-hidden bg-[#F2F2F7]">
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
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-[#F2F2F7]">
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
      <div className="absolute left-0 right-0 top-0 z-30 pt-3 pb-2 pt-safe px-safe pointer-events-none">
        <div className="mx-auto flex w-full max-w-[680px] items-center gap-2 px-3 pointer-events-auto sm:px-0">
          {/* 뒤로가기 — 푸시 알림 cold start 시 history 없으면 채팅 목록으로 */}
          <button
            onClick={() => {
              if (typeof window !== 'undefined' && window.history.length > 1) {
                router.back();
              } else {
                router.replace('/chat');
              }
            }}
            className="w-12 h-12 rounded-full bg-white/90 backdrop-blur-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-gray-200/60 flex items-center justify-center shrink-0 active:scale-[0.88] transition-all hover:bg-white"
          >
            <ChevronLeft size={24} className="text-gray-600" strokeWidth={2.5} />
          </button>

          {/* 중앙 프로필 알약 (상대가 사회자일 때만 프로필 이동) */}
          <button
            type="button"
            onClick={openPartnerProfile}
            className="flex-1 flex items-center gap-3 bg-white/90 backdrop-blur-2xl rounded-full shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-gray-200/60 pl-1.5 pr-4 h-12 min-w-0 active:scale-[0.98] transition-transform hover:bg-white"
          >
            <div className="relative shrink-0">
              <img src={chatPartner?.profileImageUrl || '/images/default-profile.svg'} alt="" className="w-9 h-9 rounded-full object-cover" />
              {chatPartner?.isActive && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#34C759] border-2 border-white rounded-full" />}
            </div>
            <div className="flex-1 min-w-0 leading-tight">
              <div className="flex items-center gap-1.5">
                <p className="text-[14px] font-bold text-gray-900 truncate">{chatPartner?.name || '...'}</p>
                {chatPartner && partnerRoleKnown && (
                  <span
                    className="text-[9px] font-bold px-1.5 py-[1px] rounded shrink-0"
                    style={{
                      color: partnerIsPro ? '#3180F7' : '#6B7280',
                      backgroundColor: partnerIsPro ? '#EAF3FF' : '#F3F4F6',
                    }}
                  >
                    {partnerIsPro ? '사회자' : '고객'}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-gray-400">
                {chatPartner?.isActive ? '온라인' : chatPartner?.lastSeen ? `${chatPartner.lastSeen} 활동` : '오프라인'}
              </p>
            </div>
          </button>

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

      {/* ─── 스케줄 공지 배너 (헤더 바로 아래 fixed) ─── */}
      {roomMeta?.latestQuotation?.status === 'paid' && (
        <div
          className="absolute left-3 right-3 pointer-events-auto"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 68px)', zIndex: 25 }}
        >
          <div className="mx-auto w-full max-w-[680px]">
            <ScheduleBanner
              roomMeta={roomMeta}
              isPro={isPro}
              chatPartner={chatPartner}
              collapsed={scheduleBannerCollapsed}
              onToggle={() => setScheduleBannerCollapsed((v) => !v)}
            />
          </div>
        </div>
      )}

      {/* ─── Messages ─── */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-3"
        style={{
          paddingBottom: 80,
          overscrollBehaviorX: 'contain',
          overscrollBehaviorY: 'none',
          paddingTop: roomMeta?.latestQuotation?.status === 'paid'
            ? (scheduleBannerCollapsed ? 134 : 220)
            : 80,
        }}
        onClick={() => { setActionMenu(null); setShowAttach(false); }}
      >
        <div className="mx-auto w-full max-w-[680px]">
          {isPro && roomMeta?.latestQuotation?.status !== 'paid' && (roomMeta?.matchRequest || roomMeta?.latestQuotation) && (() => {
            const mr = roomMeta?.matchRequest;
            const raw: any = mr?.rawUserInput && typeof mr.rawUserInput === 'object' ? mr.rawUserInput : {};
            const fmtTime = (v: any) => {
              if (!v) return '';
              if (typeof v === 'string' && /^\d{1,2}:\d{2}/.test(v)) return v.slice(0, 5);
              try {
                const d = new Date(v);
                return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
              } catch { return ''; }
            };
            const eventDate = mr?.eventDate || roomMeta.latestQuotation?.eventDate || raw.date;
            const eventTime = fmtTime(mr?.eventTime || roomMeta.latestQuotation?.eventTime || raw.timeStart);
            const eventLocation = mr?.eventLocation || (roomMeta.latestQuotation as any)?.eventLocation || raw.location;
            const eventName = roomMeta.latestQuotation?.title || raw.eventName || mr?.eventCategory?.name || '행사 정보 확인 필요';
            const planLabel: string | null = raw.planLabel || (raw.planKey === 'wedding_part12' ? '1부 + 2부' : raw.planKey === 'wedding_part1' ? '1부' : null);
            return (
            <div className="mb-4 rounded-2xl border border-blue-100 bg-white px-4 py-3 shadow-[0_8px_24px_rgba(49,128,247,0.08)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-bold text-[#3180F7]">고객 견적 정보</p>
                  <p className="mt-1 text-[14px] font-semibold text-gray-900 truncate">
                    {eventName}
                  </p>
                  <p className="mt-1 text-[12px] text-gray-500">
                    📅 {eventDate ? `${new Date(eventDate).toLocaleDateString('ko-KR')} ${eventTime}`.trim() : '일정 미입력'}
                  </p>
                  {eventLocation && (
                    <p className="mt-0.5 text-[12px] text-gray-500 truncate">📍 {eventLocation}</p>
                  )}
                  {planLabel && (
                    <span className="mt-1 inline-block text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#3180F7]/10 text-[#3180F7]">
                      {planLabel}
                    </span>
                  )}
                </div>
                {roomMeta.latestQuotation?.amount != null && (
                  <div className="shrink-0 rounded-xl bg-blue-50 px-3 py-2 text-right">
                    <p className="text-[11px] text-blue-500">최근 견적</p>
                    <p className="text-[14px] font-bold text-[#3180F7]">{Number(roomMeta.latestQuotation.amount).toLocaleString('ko-KR')}원</p>
                  </div>
                )}
              </div>
            </div>
            );
          })()}
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
          {!messagesLoading && messages.length === 0 && messagesLoadFailed && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <p className="text-[14px] text-gray-400 text-center">메시지를 불러오지 못했어요{messagesLoadError ? ` (${messagesLoadError})` : ''}</p>
              <button
                onClick={() => {
                  setMessagesLoadFailed(false);
                  setMessagesLoading(true);
                  const requestedAt = Date.now();
                  chatApi.getMessages(roomId, { limit: 50 })
                    .then((res) => {
                      const apiMessages = res.data.data || [];
                      const mapped = apiMessages.map(mapApiMessage);
                      useChatStore.getState().messageCache.set(roomId, apiMessages);
                      saveMsgCache(roomId, mapped);
                      setMessages((prev) => mergeFetchedMessages(prev, mapped, requestedAt));
                      setMessagesLoadFailed(false);
                    })
                    .catch((e: any) => {
                      setMessagesLoadFailed(true);
                      const s = e?.response?.status;
                      setMessagesLoadError(s ? `${s}` : (e?.code || e?.message || '알 수 없음'));
                    })
                    .finally(() => setMessagesLoading(false));
                }}
                className="px-5 py-2.5 bg-gray-900 text-white text-[14px] font-semibold rounded-2xl active:scale-95 transition-transform"
              >
                다시 시도
              </button>
            </div>
          )}
          {!messagesLoading && messages.length === 0 && !messagesLoadFailed && chatPartner && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <img src={chatPartner.profileImageUrl} alt="" className="w-16 h-16 rounded-full object-cover mb-3" />
              <p className="text-[15px] font-bold text-gray-900">{chatPartner.name}</p>
              <p className="text-[13px] text-gray-400 mt-1">대화를 시작해보세요</p>
            </div>
          )}
          {(() => {
            // 가장 최근 견적 메시지의 id 를 미리 계산 — 그 견적에만 "결제하기" 버튼 활성화
            const latestQuoteId = [...messages]
              .filter((m) => m.type === 'system' && m.system?.kind === 'quote' && m.system?.quotationId)
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.id || null;
            return messages.map((msg, i) => {
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
                      <SystemMessageCard msg={msg} isPro={isPro} chatPartner={chatPartner} myProfileImage={authUser?.profileImageUrl || null} isLatestQuote={msg.id === latestQuoteId} refreshTick={messages.length} />
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
                  <div className="relative min-w-0 max-w-[78%]">
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
                          className="max-h-[340px] max-w-full rounded-2xl object-cover cursor-pointer select-none sm:max-w-[260px]"
                          style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', pointerEvents: 'auto' }}
                          onClick={(e) => { e.stopPropagation(); setImagePreview(msg.content); }}
                        />
                      </div>
                    ) : msg.type === 'file' ? (
                      <div
                        className={`flex max-w-full min-w-0 items-center gap-2 px-4 py-3 rounded-[20px] select-none ${mine ? 'bg-[#007AFF] text-white' : 'bg-white text-gray-900'} ${msg.isNew ? 'animate-[bubblePop_0.5s_cubic-bezier(0.34,1.56,0.64,1)]' : ''}`}
                        style={{ WebkitTouchCallout: 'none' }}
                        onPointerDown={(e) => handleLongPressStart(e, msg)}
                        onPointerUp={handleLongPressCancel}
                        onPointerLeave={handleLongPressCancel}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        <FileText size={18} />
                        <span className="min-w-0 break-all text-[15px]">{msg.fileName || msg.content}</span>
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
                          <div className={`flex max-w-full min-w-0 items-center gap-2 px-4 py-3 rounded-[20px] ${mine ? 'bg-[#007AFF] text-white' : 'bg-white text-gray-900'}`}>
                            <MapPin size={18} />
                            <span className="min-w-0 break-words text-[15px]">{msg.content}</span>
                          </div>
                        ) : (
                          <div className={`flex max-w-full min-w-0 items-center gap-2 px-4 py-3 rounded-[20px] ${mine ? 'bg-[#007AFF] text-white' : 'bg-white text-gray-900'}`}>
                            <MapPin size={18} />
                            <span className="min-w-0 break-words text-[15px]">{msg.content}</span>
                          </div>
                        )}
                      </div>
                    ) : msg.type === 'voice' ? (
                      <div
                        className={`flex max-w-full min-w-[min(180px,70vw)] items-center gap-3 pl-2 pr-4 py-2.5 rounded-[20px] select-none ${mine ? 'bg-[#007AFF] text-white' : 'bg-white text-gray-900 shadow-[0_0.5px_1px_rgba(0,0,0,0.04)]'} ${msg.isNew ? 'animate-[bubblePop_0.5s_cubic-bezier(0.34,1.56,0.64,1)]' : ''}`}
                        style={{ WebkitTouchCallout: 'none' }}
                        onPointerDown={(e) => handleLongPressStart(e, msg)}
                        onPointerUp={handleLongPressCancel}
                        onPointerLeave={handleLongPressCancel}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        {/* 재생/일시정지 버튼 */}
                        <button
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => { e.stopPropagation(); handleVoicePlay(msg); }}
                          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 active:scale-90 transition-transform ${mine ? 'bg-white/20' : 'bg-[#007AFF]'}`}
                        >
                          {playingVoice === msg.id
                            ? <Pause size={16} className="text-white" />
                            : <Play size={16} className="text-white ml-0.5" />
                          }
                        </button>
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
                        className={`max-w-full whitespace-pre-wrap break-words text-[16px] leading-[1.4] cursor-pointer select-none overflow-hidden [overflow-wrap:anywhere] ${
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
          });
          })()}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ─── 그라데이션 — z-20 (푸터 z-30 뒤에 위치) ─── */}
      <div
        className="absolute inset-x-0 h-16 pointer-events-none z-20"
        style={{
          bottom: keyboardOffset,
          background: 'linear-gradient(to top, rgba(242,242,247,0.97) 0%, rgba(242,242,247,0) 100%)',
        }}
      />

      {/* ─── Input Bar — z-30 (그라데이션 앞) ─── */}
      <div className="absolute left-0 right-0 z-30 pb-safe px-safe" style={{ bottom: keyboardOffset }}>
        <div className="mx-auto flex w-full max-w-[680px] items-end gap-2 px-3 pointer-events-auto pt-1 sm:px-0">
          {isRecording ? (
            // Recording UI
            <>
              <button
                onClick={() => stopRecordingRef.current?.(true)}
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
                  onClick={() => stopRecordingRef.current?.(false)}
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
              {isPro && (
                <button
                  onClick={() => setShowQuoteModal(true)}
                  className="h-12 px-4 rounded-full bg-[#3180F7] text-white shadow-[0_4px_24px_rgba(49,128,247,0.25)] border border-blue-400/30 flex items-center justify-center gap-1.5 shrink-0 active:scale-[0.92] transition-all hover:bg-[#1f6fe5]"
                  title="견적서 보내기"
                >
                  <FileSignature size={18} />
                  <span className="hidden sm:inline text-[13px] font-bold">견적</span>
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); setShowAttach(!showAttach); }}
                className="w-12 h-12 rounded-full bg-white/90 backdrop-blur-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-gray-200/60 flex items-center justify-center shrink-0 active:scale-[0.88] transition-all hover:bg-white"
              >
                <Plus size={24} className="text-gray-600" />
              </button>

              <div className="flex h-12 min-w-0 flex-1 items-center rounded-full border border-gray-200/60 bg-white/90 pl-5 pr-1.5 shadow-[0_4px_24px_rgba(0,0,0,0.08)] backdrop-blur-2xl">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={(e) => {
                    // Korean IME: composition 중 Enter 는 마지막 자모 결합 trigger 라 send 하면 글자 중복 발생
                    // (예: "테스트" + Enter → composition 의 "트" 가 한 번 더 인풋에 남아 다음 send 에 포함됨)
                    if (e.key !== 'Enter' || e.shiftKey) return;
                    if (e.nativeEvent.isComposing || (e as any).keyCode === 229) return;
                    e.preventDefault();
                    handleSend();
                  }}
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
                    onClick={() => startRecordingRef.current?.()}
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
          onRegisterRecording={({ start, stop }) => { startRecordingRef.current = start; stopRecordingRef.current = stop; }}
          playingVoice={playingVoice}
          setPlayingVoice={setPlayingVoice}
          voicePlayProgress={voicePlayProgress}
          setVoicePlayProgress={setVoicePlayProgress}
          mentionQuery={mentionQuery}
          setMentionQuery={setMentionQuery}
          inputRef={inputRef}
          fileInputRef={fileInputRef}
          cameraInputRef={cameraInputRef}
          roomMeta={roomMeta}
        />
      </Suspense>

      {showCustomerInfo && (() => {
        const mr = roomMeta?.matchRequest as any;
        const raw: any = mr?.rawUserInput && typeof mr.rawUserInput === 'object' ? mr.rawUserInput : {};
        const eventDate = mr?.eventDate || raw.date || roomMeta?.latestQuotation?.eventDate;
        const eventTime = formatEventTimeShort(mr?.eventTime || raw.timeStart || roomMeta?.latestQuotation?.eventTime);
        const eventTimeEnd = formatEventTimeShort(raw.timeEnd);
        const eventLocation = mr?.eventLocation || raw.location || (roomMeta?.latestQuotation as any)?.eventLocation;
        const eventName = raw.eventName || roomMeta?.latestQuotation?.title || mr?.eventCategory?.name || '의뢰 정보';
        const moods = Array.isArray(raw.moods) ? raw.moods.filter(Boolean) : [];
        const note = raw.note || raw.request || raw.requirements || '';
        const budget = mr?.budgetMin || mr?.budgetMax
          ? `${mr?.budgetMin ? Number(mr.budgetMin).toLocaleString('ko-KR') : '0'}원 ~ ${mr?.budgetMax ? Number(mr.budgetMax).toLocaleString('ko-KR') : '협의'}`
          : '';
        return (
          <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/35 px-0 sm:items-center sm:px-4" onClick={() => setShowCustomerInfo(false)}>
            <div
              className="w-full max-w-[520px] rounded-t-3xl bg-white px-5 pb-8 pt-5 shadow-2xl sm:rounded-3xl"
              onClick={(e) => e.stopPropagation()}
              style={{ animation: 'sheetUp 0.24s cubic-bezier(0.16,1,0.3,1)' }}
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <img src={chatPartner?.profileImageUrl || '/images/default-profile.svg'} alt="" className="h-12 w-12 rounded-full object-cover" />
                  <div className="min-w-0">
                    <p className="truncate text-[17px] font-bold text-gray-900">{chatPartner?.name || '고객'}</p>
                    <p className="text-[12px] font-semibold text-[#3180F7]">고객 의뢰 정보</p>
                  </div>
                </div>
                <button type="button" onClick={() => setShowCustomerInfo(false)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100">
                  <X size={16} className="text-gray-500" />
                </button>
              </div>

              <div className="mt-5 space-y-3">
                <div className="rounded-2xl bg-blue-50 px-4 py-3">
                  <p className="text-[12px] font-bold text-[#3180F7]">행사</p>
                  <p className="mt-1 text-[15px] font-bold text-gray-900">{eventName}</p>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl bg-gray-50 px-4 py-3">
                    <p className="text-[11px] font-bold text-gray-400">일정</p>
                    <p className="mt-1 text-[14px] font-semibold text-gray-900">
                      {eventDate ? new Date(eventDate).toLocaleDateString('ko-KR') : '미정'}
                      {eventTime ? ` ${eventTime}${eventTimeEnd ? ` ~ ${eventTimeEnd}` : ''}` : ''}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-gray-50 px-4 py-3">
                    <p className="text-[11px] font-bold text-gray-400">예산</p>
                    <p className="mt-1 text-[14px] font-semibold text-gray-900">{budget || '협의'}</p>
                  </div>
                </div>
                {eventLocation && (
                  <div className="rounded-2xl bg-gray-50 px-4 py-3">
                    <p className="text-[11px] font-bold text-gray-400">장소</p>
                    <p className="mt-1 text-[14px] font-semibold text-gray-900">{eventLocation}</p>
                  </div>
                )}
                {moods.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {moods.map((mood: string) => (
                      <span key={mood} className="rounded-[10px] bg-gray-100 px-2.5 py-1 text-[12px] font-semibold text-gray-700">{mood}</span>
                    ))}
                  </div>
                )}
                {note && (
                  <div className="rounded-2xl bg-gray-50 px-4 py-3">
                    <p className="text-[11px] font-bold text-gray-400">요청사항</p>
                    <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-gray-700">{note}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

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
