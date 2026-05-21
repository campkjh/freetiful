'use client';

import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronLeft, Mic, X, MoreVertical, Plus, MapPin, FileText, FileSignature,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';
import { cacheChatMessagesForRoom, getCachedChatMessagesForRoom, useChatStore } from '@/lib/store/chat.store';
import { chatApi, type ChatRoomItem, type MessageItem } from '@/lib/api/chat.api';
import { preWarmChat, getPreWarmByProId, getPreWarmByRoomId } from '@/lib/chat-prewarm';
import { getProfileImageUrl } from '@/lib/default-profile';
import type { Message, ChatPartner, SystemPayload } from './chat-types';

const ChatExtras = lazy(() => import('./ChatExtras'));
const SystemMessageCard = lazy(() => import('./ChatExtras').then((m) => ({ default: m.SystemMessageCard })));

const INITIAL_MESSAGE_LIMIT = 18;
const REFRESH_MESSAGE_LIMIT = 12;

/** Convert a MessageItem from the API into our local Message shape */
function mapApiMessage(m: MessageItem): Message {
  const meta = m.metadata as Record<string, any> | null;
  return {
    id: m.id,
    senderId: m.senderId,
    content: m.content || '',
    type: m.type === 'link' ? 'text' : m.type as Message['type'],
    createdAt: m.createdAt,
    clientMessageId: typeof meta?.clientMessageId === 'string' ? meta.clientMessageId : undefined,
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

function writeMessageCacheIfPresent(roomId: string, messages: MessageItem[]) {
  if (messages.length === 0) return;
  useChatStore.getState().messageCache.set(roomId, messages);
  cacheChatMessagesForRoom(roomId, messages);
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

function isTemporaryMessage(message: Message) {
  return message.id.startsWith('opt-') || message.id.startsWith('tmp-') || message.id.startsWith('pending-');
}

function hasFetchedEquivalent(message: Message, fetched: Message[]) {
  if (!isTemporaryMessage(message)) return false;
  const sentAt = messageTime(message);
  return fetched.some((item) => {
    if (message.clientMessageId && item.clientMessageId && message.clientMessageId === item.clientMessageId) {
      return true;
    }
    if (item.senderId !== message.senderId || item.type !== message.type) return false;
    if (message.type === 'text') {
      return item.content === message.content &&
        messageTime(item) >= sentAt - 2_000 &&
        Math.abs(messageTime(item) - sentAt) < 60_000;
    }
    return Math.abs(messageTime(item) - sentAt) < 20_000;
  });
}

function mergeFetchedMessages(current: Message[], fetched: Message[], _requestedAt: number) {
  if (fetched.length === 0 && current.length > 0) return current;

  const fetchedIds = new Set(fetched.map((message) => message.id));
  const preserved = current.filter((message) => {
    if (fetchedIds.has(message.id)) return false;
    if (hasFetchedEquivalent(message, fetched)) return false;
    return true;
  });

  return [...fetched, ...preserved].sort((a, b) => messageTime(a) - messageTime(b));
}

function sortMessagesAsc(messages: Message[]) {
  return [...messages].sort((a, b) => messageTime(a) - messageTime(b));
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

function mapRoomToPartner(room: ChatRoomItem & { proProfileId?: string }): ChatPartner {
  return {
    id: room.otherUser.id,
    proProfileId: room.proProfileId,
    name: room.otherUser.name,
    profileImageUrl: getProfileImageUrl(room.otherUser.profileImageUrl, room.otherUser.id || room.otherUser.name),
    isActive: room.otherUser.isActive ?? false,
  };
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
  const isSocketConnected = useChatStore((s) => s.isConnected);

  // ─── Pre-warmed data 즉시 사용 (initial state만 계산) ───
  const initialPreWarmed = (() => {
    if (typeof window === 'undefined') return null;
    if (roomId.startsWith('pending-')) {
      return getPreWarmByProId(roomId.replace('pending-', ''));
    }
    return getPreWarmByRoomId(roomId);
  })();
  const initialStoreRoom = (() => {
    if (typeof window === 'undefined' || roomId.startsWith('pending-')) return null;
    return useChatStore.getState().rooms.find((r) => r.id === roomId) || null;
  })();
  const initialRoom = initialPreWarmed?.room || initialStoreRoom;
  const initialIAmProInRoom = typeof initialRoom?.iAmPro === 'boolean'
    ? initialRoom.iAmPro
    : null;
  const initialPartner: ChatPartner | null = initialRoom ? mapRoomToPartner(initialRoom) : null;
  const initialCachedMessages = (() => {
    if (typeof window === 'undefined' || roomId.startsWith('pending-')) return [];
    return useChatStore.getState().messageCache.get(roomId) || getCachedChatMessagesForRoom(roomId);
  })();
  const initialMessages: Message[] = initialPreWarmed?.messages
    ? initialPreWarmed.messages.map(mapApiMessage)
    : initialCachedMessages.map(mapCachedMessage);

  // 채팅방 안에서는 결제 상태 판단에 필요한 최소 메타만 유지한다.
  const initialRoomMeta = (() => {
    if (typeof window === 'undefined') return null;
    const fromPrewarm: any = initialPreWarmed?.room;
    if (fromPrewarm?.latestQuotation || fromPrewarm?.matchRequest) {
      return {
        matchRequest: fromPrewarm.matchRequest ?? null,
        latestQuotation: fromPrewarm.latestQuotation ?? null,
      };
    }
    const fromStore: any = initialStoreRoom;
    if (fromStore?.latestQuotation || fromStore?.matchRequest) {
      return {
        matchRequest: fromStore.matchRequest ?? null,
        latestQuotation: fromStore.latestQuotation ?? null,
      };
    }
    return null;
  })();

  // ─── Core state (needed for instant render) ───
  const [chatPartner, setChatPartner] = useState<ChatPartner | null>(initialPartner);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [messagesLoading, setMessagesLoading] = useState(initialMessages.length === 0);
  const [hasAttemptedInitialLoad, setHasAttemptedInitialLoad] = useState(initialMessages.length > 0 || !!initialPartner);
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
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [voicePlayProgress, setVoicePlayProgress] = useState<Record<string, number>>({});
  const [pinnedMessage, setPinnedMessage] = useState<{ id: string; name: string; content: string } | null>(null);
  const [partialCopyMsg, setPartialCopyMsg] = useState<Message | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  // ─── Refs ───
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasInitialScrolledRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const lastSendRef = useRef<{ text: string; at: number } | null>(null);
  const lastRoomPollAtRef = useRef(0);

  // ─── Data fetching ───
  useEffect(() => {
    let cancelled = false;

    async function loadRoom() {
      setIAmProInRoom(initialIAmProInRoom);
      if (initialPartner) {
        setChatPartner(initialPartner);
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
              profileImageUrl: getProfileImageUrl(pre.room.otherUser.profileImageUrl, pre.room.otherUser.id || pre.room.otherUser.name),
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

      // 캐시/프리웜 파트너가 있으면 먼저 즉시 렌더하고, 네트워크 메타는 뒤에서 보정한다.
      if (!initialPartner) {
        const storeRoom = useChatStore.getState().rooms.find((r) => r.id === roomId);
        if (storeRoom) {
          setChatPartner(mapRoomToPartner(storeRoom));
          if (typeof storeRoom.iAmPro === 'boolean') {
            setIAmProInRoom(storeRoom.iAmPro);
          }
          setHasAttemptedInitialLoad(true);
        }
      } else {
        setHasAttemptedInitialLoad(true);
      }

      try {
        const res = await chatApi.getRoom(roomId);
        if (cancelled) return;
        const room = res.data as ChatRoomItem & { iAmPro?: boolean; proProfileId?: string };
        setChatPartner({
          id: room.otherUser.id,
          proProfileId: room.proProfileId,
          name: room.otherUser.name,
          profileImageUrl: getProfileImageUrl(room.otherUser.profileImageUrl, room.otherUser.id || room.otherUser.name),
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
      } finally {
        if (!cancelled) setHasAttemptedInitialLoad(true);
      }
    }

    async function loadMessages() {
      if (roomId.startsWith('pending-')) return;
      // pre-warm된 메시지를 이미 initial state로 넣어뒀다면 background refresh만
      if (initialMessages.length > 0) {
        setMessagesLoading(false);
        const requestedAt = Date.now();
        chatApi.getMessages(roomId, { limit: REFRESH_MESSAGE_LIMIT }).then((res) => {
          if (!cancelled) {
            const apiMessages = res.data.data || [];
            const mapped = apiMessages.map(mapApiMessage);
            writeMessageCacheIfPresent(roomId, apiMessages);
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
        chatApi.getMessages(roomId, { limit: REFRESH_MESSAGE_LIMIT }).then((res) => {
          if (!cancelled) {
            const apiMessages = res.data.data || [];
            const mapped = apiMessages.map(mapApiMessage);
            writeMessageCacheIfPresent(roomId, apiMessages);
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
          writeMessageCacheIfPresent(roomId, warmMessages);
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
        chatApi.getMessages(roomId, { limit: REFRESH_MESSAGE_LIMIT }).then((res) => {
          if (!cancelled) {
            const apiMessages = res.data.data || [];
            const mapped = apiMessages.map(mapApiMessage);
            writeMessageCacheIfPresent(roomId, apiMessages);
            setMessages((prev) => mergeFetchedMessages(prev, mapped, requestedAt));
          }
        }).catch(() => {});
        return;
      }
      setMessagesLoading(true);
      try {
        const requestedAt = Date.now();
        const res = await chatApi.getMessages(roomId, { limit: INITIAL_MESSAGE_LIMIT });
        if (cancelled) return;
        const apiMessages = res.data.data || [];
        const mapped = apiMessages.map(mapApiMessage);
        writeMessageCacheIfPresent(roomId, apiMessages);
        setMessages((prev) => mergeFetchedMessages(prev, mapped, requestedAt));
      } catch (err) {
        console.error('Failed to load messages', err);
      } finally {
        if (!cancelled) {
          setMessagesLoading(false);
          setHasAttemptedInitialLoad(true);
        }
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
  useEffect(() => {
    if (wsMessages.length === 0) return;
    const mapped: Message[] = wsMessages.map(mapApiMessage);
    setMessages((prev) => {
      const incoming = mapped.filter((m) => {
        if (!isTemporaryMessage(m) || !m.clientMessageId) return true;
        return !prev.some((p) => isTemporaryMessage(p) && p.clientMessageId === m.clientMessageId);
      });
      if (incoming.length === 0) return prev;
      const existingIds = new Set(prev.map((m) => m.id));
      const unique = incoming.filter((m) => !existingIds.has(m.id));
      if (unique.length === 0) {
        return mergeFetchedMessages(prev, incoming, Date.now());
      }
      // 낙관적 메시지(opt-/tmp-) 중 서버 확정 메시지와 대응되는 것 제거
      const withoutOptimistic = prev.filter((m) => {
        if (!isTemporaryMessage(m)) return true;
        return !unique.some((u) => {
          if (m.clientMessageId && u.clientMessageId && m.clientMessageId === u.clientMessageId) return true;
          if (u.senderId !== m.senderId || u.type !== m.type) return false;
          if (m.type === 'text') return u.content === m.content;
          return Math.abs(messageTime(u) - messageTime(m)) < 20_000;
        });
      });
      return sortMessagesAsc([...withoutOptimistic, ...unique]);
    });
  }, [wsMessages]);

  useEffect(() => {
    if (wsMessages.length === 0 || roomId.startsWith('pending-')) return;
    const latestSystem = [...wsMessages].reverse().find((m) => m.type === 'system');
    const kind = (latestSystem?.metadata as Record<string, any> | null)?.system?.kind;
    if (!kind || !['quote', 'payment_request', 'payment_pending_acceptance', 'payment_paid'].includes(kind)) return;
    chatApi.getRoom(roomId)
      .then((res) => {
        const room = res.data as ChatRoomItem;
        setRoomMeta({
          matchRequest: room.matchRequest ?? null,
          latestQuotation: room.latestQuotation ?? null,
        });
      })
      .catch(() => {});
  }, [wsMessages, roomId]);

  useEffect(() => {
    if (!authUser || roomId.startsWith('pending-')) return;
    let cancelled = false;

    const refreshRoomState = async (force = false) => {
      const now = Date.now();
      if (!force && now - lastRoomPollAtRef.current < 8_000) return;
      lastRoomPollAtRef.current = now;
      const requestedAt = Date.now();

      const [roomRes, messagesRes] = await Promise.allSettled([
        chatApi.getRoom(roomId),
        chatApi.getMessages(roomId, { limit: REFRESH_MESSAGE_LIMIT }),
      ]);

      if (cancelled) return;

      if (roomRes.status === 'fulfilled') {
        const room = roomRes.value.data as ChatRoomItem & { iAmPro?: boolean; proProfileId?: string };
        setChatPartner((prev) => ({
          id: room.otherUser.id,
          proProfileId: room.proProfileId,
          name: room.otherUser.name,
          profileImageUrl: getProfileImageUrl(room.otherUser.profileImageUrl || prev?.profileImageUrl, room.otherUser.id || room.otherUser.name || prev?.id || prev?.name),
          isActive: room.otherUser.isActive ?? prev?.isActive ?? false,
        }));
        setIAmProInRoom(Boolean(room.iAmPro));
        setRoomMeta({
          matchRequest: room.matchRequest ?? null,
          latestQuotation: room.latestQuotation ?? null,
        });
      }

      if (messagesRes.status === 'fulfilled') {
        const apiMessages = messagesRes.value.data.data || [];
        const mapped = apiMessages.map(mapApiMessage);
        writeMessageCacheIfPresent(roomId, apiMessages);
        setMessages((prev) => mergeFetchedMessages(prev, mapped, requestedAt));
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshRoomState(true);
      }
    };
    const onChatActivity = (event: Event) => {
      const detail = (event as CustomEvent<{ roomId?: string; systemKind?: string | null }>).detail;
      const shouldRefreshMeta =
        detail?.roomId === roomId &&
        !!detail.systemKind &&
        ['quote', 'payment_request', 'payment_pending_acceptance', 'payment_paid'].includes(detail.systemKind);
      if (shouldRefreshMeta) {
        void refreshRoomState(true);
      }
    };
    const onProfileUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string; name?: string | null; profileImageUrl?: string | null }>).detail;
      if (!detail?.userId) return;
      setChatPartner((prev) => {
        if (!prev || prev.id !== detail.userId) return prev;
        return {
          ...prev,
          ...(detail.name !== undefined ? { name: detail.name || prev.name } : {}),
          ...(detail.profileImageUrl !== undefined ? { profileImageUrl: getProfileImageUrl(detail.profileImageUrl, detail.userId || prev.name) } : {}),
        };
      });
    };

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshRoomState();
      }
    }, isSocketConnected ? 30000 : 8000);

    window.addEventListener('focus', onVisibility);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('freetiful:chat-room-activity', onChatActivity as EventListener);
    window.addEventListener('freetiful:chat-profile-updated', onProfileUpdated as EventListener);
    window.addEventListener('freetiful:dashboard-updated', onVisibility as EventListener);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', onVisibility);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('freetiful:chat-room-activity', onChatActivity as EventListener);
      window.removeEventListener('freetiful:chat-profile-updated', onProfileUpdated as EventListener);
      window.removeEventListener('freetiful:dashboard-updated', onVisibility as EventListener);
    };
  }, [authUser, roomId, isSocketConnected]);

  useEffect(() => {
    const latestPaid = [...messages].reverse().find((m) => m.type === 'system' && m.system?.kind === 'payment_paid');
    if (!latestPaid?.system) return;
    setRoomMeta((prev) => ({
      matchRequest: prev?.matchRequest ?? null,
      latestQuotation: {
        id: prev?.latestQuotation?.id || latestPaid.system?.quotationId || `local-paid-${latestPaid.id}`,
        amount: latestPaid.system?.amount ?? prev?.latestQuotation?.amount ?? 0,
        title: prev?.latestQuotation?.title ?? latestPaid.system?.eventName ?? null,
        status: 'paid',
        createdAt: prev?.latestQuotation?.createdAt ?? latestPaid.createdAt,
      },
    }));
  }, [messages]);

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
      const clientMessageId = `cm-${now}-${Math.random().toString(36).slice(2, 10)}`;
      const optimistic: Message = {
        id: `opt-${clientMessageId}`,
        senderId: authUser.id,
        content: text,
        type: 'text',
        createdAt: new Date().toISOString(),
        clientMessageId,
        isRead: false,
        replyTo: replyTo ? { id: replyTo.id, name: replyTo.name, content: replyTo.content } : null,
        isNew: true,
      };
      setMessages((prev) => sortMessagesAsc([...prev, optimistic]));
      void wsSendMessage({
        type: 'text',
        content: text,
        replyToId: replyTo?.id,
        metadata: { clientMessageId },
      }).then((saved) => {
        if (!saved) return;
        const persisted = { ...mapApiMessage(saved), isNew: false };
        setMessages((prev) => {
          const withoutOptimistic = prev.filter((m) => {
            if (m.id === persisted.id) return false;
            if (m.id === optimistic.id) return false;
            return !(isTemporaryMessage(m) && m.clientMessageId === clientMessageId);
          });
          if (withoutOptimistic.some((m) => m.id === persisted.id)) return withoutOptimistic;
          return sortMessagesAsc([...withoutOptimistic, persisted]);
        });
      }).catch(() => {
        setMessages((prev) => prev.map((m) => (
          m.id === optimistic.id || m.clientMessageId === clientMessageId ? { ...m, isNew: false } : m
        )));
      });
      setInput('');
      setReplyTo(null);
      setMentionQuery(null);
      inputRef.current?.focus();
      setTimeout(() => {
        setMessages((prev) => prev.map((m) => (
          m.id === optimistic.id || m.clientMessageId === clientMessageId ? { ...m, isNew: false } : m
        )));
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
    setMessages((prev) => sortMessagesAsc([...prev, newMsg]));
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
  const showSkeleton = !hasData && !hasAttemptedInitialLoad && (roomId.startsWith('pending-') || (messagesLoading && messages.length === 0));
  const skeletonName = chatPartner?.name || urlProName;
  const skeletonImg = getProfileImageUrl(chatPartner?.profileImageUrl || urlProImg, chatPartner?.id || skeletonName);

  if (showSkeleton) {
    return (
      <div className="fixed inset-0 flex h-[100dvh] w-full min-w-0 flex-col overflow-hidden bg-[#F2F2F7]">
        {/* Top shimmer bar */}
        <div className="absolute top-0 left-0 right-0 h-[3px] z-50 overflow-hidden bg-gray-100">
          <div className="h-full bg-[#3180F7]/40 animate-[shimmerBar_1.4s_ease-in-out_infinite]" style={{ width: '60%' }} />
        </div>

        {/* Header skeleton */}
        <div className="relative z-30 px-3 pb-2 pt-3 pt-safe">
          <div className="mx-auto flex w-full min-w-0 max-w-[680px] items-center gap-2">
            <button onClick={() => router.back()} className="w-12 h-12 rounded-full bg-white/90 shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-gray-200/60 flex items-center justify-center shrink-0">
              <ChevronLeft size={24} className="text-gray-600" strokeWidth={2.5} />
            </button>
            <div className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-full border border-gray-200/60 bg-white/90 pl-1.5 pr-4 shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
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
        <div className="flex min-h-0 flex-1 flex-col justify-end gap-5 overflow-hidden px-4 pb-6 pt-4">
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
        <div className="px-safe bg-[#F2F2F7] pb-4 pt-2">
          <div className="mx-auto flex w-full min-w-0 max-w-[680px] items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-white/90 shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-gray-200/60 shrink-0" />
            <div className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-full border border-gray-200/60 bg-white px-4 shadow-sm">
            <div className="w-5 h-5 rounded-full bg-gray-200 animate-pulse" />
            <div className="flex-1 h-3 bg-gray-100 rounded-full animate-pulse" />
            <div className="w-5 h-5 rounded-full bg-gray-200 animate-pulse" />
            </div>
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
    <div className="fixed inset-0 flex h-[100dvh] w-full min-w-0 flex-col overflow-hidden bg-[#F2F2F7]">
      {/* ─── Header (Floating Pill) ─── */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-30 px-safe pb-2 pt-3 pt-safe">
        <div className="mx-auto flex w-full min-w-0 max-w-[680px] items-center gap-2">
          {/* 뒤로가기 */}
          <button
            onClick={() => router.back()}
            className="pointer-events-auto w-12 h-12 rounded-full bg-white/75 backdrop-blur-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-white/70 flex items-center justify-center shrink-0 active:scale-[0.88] transition-all hover:bg-white"
          >
            <ChevronLeft size={24} className="text-gray-600" strokeWidth={2.5} />
          </button>

          {/* 중앙 프로필 알약 (상대가 사회자일 때만 프로필 이동) */}
          <button
            type="button"
            onClick={openPartnerProfile}
            className="pointer-events-auto flex-1 flex items-center gap-3 bg-white/75 backdrop-blur-2xl rounded-full shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-white/70 pl-1.5 pr-4 h-12 min-w-0 active:scale-[0.98] transition-transform hover:bg-white"
          >
            <div className="relative shrink-0">
              <img src={getProfileImageUrl(chatPartner?.profileImageUrl, chatPartner?.id || chatPartner?.name)} alt="" className="w-9 h-9 rounded-full object-cover" />
              {chatPartner?.isActive && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#34C759] border-2 border-white rounded-full" />}
            </div>
            <div className="flex-1 min-w-0 leading-tight">
              <div className="flex items-center gap-1.5">
                <p className="text-[17px] font-bold text-gray-900 truncate">{chatPartner?.name || '...'}</p>
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
            </div>
          </button>

          {/* 메뉴 버튼 */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowHeaderMenu(!showHeaderMenu)}
              className="pointer-events-auto w-12 h-12 rounded-full bg-white/75 backdrop-blur-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-white/70 flex items-center justify-center active:scale-[0.88] transition-all hover:bg-white"
            >
              <MoreVertical size={20} className="text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── Messages ─── */}
      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3"
        style={{
          overscrollBehaviorX: 'contain',
          overscrollBehaviorY: 'contain',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: '6px',
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 78px)',
        }}
        onClick={() => { setActionMenu(null); setShowAttach(false); }}
      >
        <div className="mx-auto w-full max-w-[680px]">
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
            const uploadProgress = Math.max(0, Math.min(100, Math.round(msg.uploadProgress ?? (msg.uploading ? 8 : 100))));
            const showUploadProgress = mine && msg.type === 'image' && (msg.uploading || uploadProgress < 100);

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
                        <div className="relative inline-block overflow-hidden rounded-2xl">
                          <img
                            src={msg.content}
                            alt=""
                            draggable={false}
                            className="block rounded-2xl max-w-[260px] max-h-[340px] object-cover cursor-pointer select-none"
                            style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', pointerEvents: 'auto' }}
                            onClick={(e) => { e.stopPropagation(); if (!showUploadProgress) setImagePreview(msg.content); }}
                          />
                          {showUploadProgress && (
                            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/35 backdrop-blur-[1px]">
                              <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-black/25">
                                <div
                                  className="absolute inset-0 rounded-full"
                                  style={{ background: `conic-gradient(#FFFFFF ${uploadProgress * 3.6}deg, rgba(255,255,255,0.24) 0deg)` }}
                                />
                                <div className="absolute inset-[4px] rounded-full bg-black/45" />
                                <span className="relative text-[12px] font-bold tabular-nums text-white">{uploadProgress}%</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : msg.type === 'sticker' ? (
                      <div
                        className={`select-none ${msg.isNew ? 'animate-[stickerPop_0.45s_cubic-bezier(0.34,1.56,0.64,1)]' : ''}`}
                        style={{ WebkitTouchCallout: 'none', transformOrigin: mine ? 'right bottom' : 'left bottom' }}
                        onPointerDown={(e) => handleLongPressStart(e, msg)}
                        onPointerUp={handleLongPressCancel}
                        onPointerLeave={handleLongPressCancel}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        <img
                          src={msg.content}
                          alt="이모티콘"
                          draggable={false}
                          className="h-[128px] w-[128px] object-contain sm:h-[148px] sm:w-[148px]"
                          style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
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
          });
          })()}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ─── Input Bar (Floating Pill) ─── */}
      <div className="relative px-safe bg-transparent pb-3 pt-2">
        <div className="pointer-events-none absolute inset-x-0 -top-10 h-12 bg-gradient-to-t from-[#F2F2F7] via-[#F2F2F7]/85 to-transparent" />
        <div className="mx-auto flex w-full min-w-0 max-w-[680px] items-end gap-1.5 sm:gap-2">
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
              <div className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-full border border-red-200/80 bg-white/90 px-5 shadow-[0_4px_24px_rgba(0,0,0,0.08)] backdrop-blur-2xl animate-[slideUp_0.2s_ease]">
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
              {isPro && (
                <button
                  onClick={() => setShowQuoteModal(true)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-blue-400/30 bg-[#3180F7] text-white shadow-[0_4px_24px_rgba(49,128,247,0.25)] active:scale-[0.92] transition-all hover:bg-[#1f6fe5] sm:h-12 sm:w-auto sm:gap-1.5 sm:px-4"
                  title="견적서 보내기"
                >
                  <FileSignature size={17} />
                  <span className="hidden text-[13px] font-bold sm:inline">견적</span>
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); setShowAttach(!showAttach); }}
                className="h-11 w-11 shrink-0 rounded-full border border-gray-200/60 bg-white/90 backdrop-blur-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] flex items-center justify-center active:scale-[0.88] transition-all hover:bg-white sm:h-12 sm:w-12"
              >
                <Plus size={22} className="text-gray-600" />
              </button>

              <div className="flex h-11 min-w-0 flex-1 items-center rounded-full border border-gray-200/60 bg-white/90 pl-3 pr-1 shadow-[0_4px_24px_rgba(0,0,0,0.08)] backdrop-blur-2xl sm:h-12 sm:pl-5 sm:pr-1.5">
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
                  className="min-w-0 flex-1 bg-transparent text-[14px] leading-[1.25] focus:outline-none placeholder:text-gray-400 sm:text-[16px]"
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
          roomMeta={roomMeta}
        />
      </Suspense>

      {showCustomerInfo && (() => {
        const mr = roomMeta?.matchRequest as any;
        const raw: any = mr?.rawUserInput && typeof mr.rawUserInput === 'object' ? mr.rawUserInput : {};
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
                  <img src={getProfileImageUrl(chatPartner?.profileImageUrl, chatPartner?.id || chatPartner?.name)} alt="" className="h-12 w-12 rounded-full object-cover" />
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
                <div className="grid grid-cols-1 gap-2">
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
        @keyframes stickerPop {
          0% { transform: translateY(10px) scale(0.55) rotate(-4deg); opacity: 0; }
          62% { transform: translateY(-2px) scale(1.04) rotate(1.5deg); opacity: 1; }
          100% { transform: translateY(0) scale(1) rotate(0); opacity: 1; }
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
