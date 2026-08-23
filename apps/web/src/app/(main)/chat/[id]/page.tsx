'use client';

import { useState, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowBackIcon as ChevronLeft,
  MicIcon as Mic,
  XIcon as X,
  DotsVerticalIcon as MoreVertical,
  PlusIcon as Plus,
  PinLocationIcon as MapPin,
  DocumentIcon as FileText,
  ContractIcon as FileSignature,
  PlayIcon as Play,
  PauseIcon as Pause,
  PaperPlaneIcon,
  CalendarCheckIcon as CalendarCheck,
} from '@/components/icons/chat';
import { ChevronDownIcon } from '@/components/icons/mono';
import { useAuthStore } from '@/lib/store/auth.store';
import { useChatStore } from '@/lib/store/chat.store';
import { chatApi, type ChatRoomItem, type MessageItem } from '@/lib/api/chat.api';
import { preWarmChat, getPreWarmByProId, getPreWarmByRoomId } from '@/lib/chat-prewarm';
import type { Message, ChatPartner, SystemPayload } from './chat-types';
import { formatEventTime } from '@/lib/event-time';
import { renderTextWithMentions } from './chat-text';
import { isChatStickerUrl } from '@/lib/chat-stickers';

const ChatExtras = lazy(() => import('./ChatExtras'));
const SystemMessageCard = lazy(() => import('./ChatExtras').then((m) => ({ default: m.SystemMessageCard })));
const SafePaymentNotice = lazy(() => import('./ChatExtras').then((m) => ({ default: m.SafePaymentNotice })));

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
    autoReply: meta?.autoReply === true,
  };
}

function mapCachedMessage(m: MessageItem | Message): Message {
  if ('metadata' in m || 'roomId' in m || 'sender' in m) {
    return mapApiMessage(m as MessageItem);
  }
  return m as Message;
}

// 네이티브 메시지 리스트(B3)용: 상대경로 /uploads 이미지를 API 절대경로로 (네이티브 UIImage 로딩 가능하게)
function absChatUrl(u: string): string {
  if (!u) return '';
  // 이미지는 동일 출처(상대경로) 유지 — Vercel CDN 캐시 활용. (서버 CORP 는 cross-origin 으로 열려 있음)
  return u;
}

// 동영상 전용: Railway origin 직결 URL.
// Vercel CDN 경유 시 Range 요청이 200(전체 캐시)으로 뭉개져 iOS <video> 가 재생을 거부
// → "썸네일은 뜨는데 재생 안됨" QA 의 원인. origin 은 Range 206 + CORP cross-origin 지원.
const MEDIA_ORIGIN = process.env.NEXT_PUBLIC_DIRECT_API_URL || 'https://affectionate-smile-production-6535.up.railway.app';
function videoDirectUrl(u: string): string {
  if (!u) return '';
  if (u.startsWith('/uploads/')) return `${MEDIA_ORIGIN}${u}`;
  return u;
}

// 미디어 업로드 진행 오버레이 (원형 게이지 + % + 전송량/총용량 MB)
function MediaUploadOverlay({ progress, totalBytes }: { progress?: number; totalBytes?: number }) {
  if (progress == null || progress >= 100) return null;
  const R = 22;
  const C = 2 * Math.PI * R;
  const mb = (n: number) => (n / 1048576).toFixed(1);
  return (
    <div className="pointer-events-none absolute inset-0 z-[2] flex flex-col items-center justify-center rounded-2xl bg-black/45 backdrop-blur-[1px]">
      <svg width="54" height="54" viewBox="0 0 54 54" className="-rotate-90">
        <circle cx="27" cy="27" r={R} fill="none" stroke="rgba(255,255,255,0.30)" strokeWidth="4" />
        <circle cx="27" cy="27" r={R} fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - progress / 100)}
          style={{ transition: 'stroke-dashoffset 0.2s linear' }} />
      </svg>
      <span className="mt-1 text-[13px] font-bold text-white tabular-nums">{Math.round(progress)}%</span>
      {totalBytes ? (
        <span className="text-[10px] font-medium text-white/85 tabular-nums">{mb(totalBytes * progress / 100)} / {mb(totalBytes)}MB</span>
      ) : null}
    </div>
  );
}

// 업로드 실패 오버레이 — 사진/영상이 사라지는 대신 '전송 실패 · 탭하여 재시도'로 유지.
function FailedMediaOverlay({ onRetry }: { onRetry: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onRetry(); }}
      className="absolute inset-0 z-[3] flex flex-col items-center justify-center gap-0.5 rounded-2xl bg-black/55 text-white active:bg-black/65"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="1.6" />
        <path d="M12 7.5v5M12 16h.01" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="text-[12px] font-bold">전송 실패</span>
      <span className="text-[10px] font-medium opacity-90">탭하여 재시도</span>
    </button>
  );
}

// 서버 /uploads URL 이 일시적으로 안 뜰 때 빈칸(사라진 것처럼 보임) 대신 회색 자리표시
const BROKEN_IMG_PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="160"><rect width="100%" height="100%" rx="16" fill="#e5e7eb"/><text x="50%" y="50%" font-family="sans-serif" font-size="13" fill="#9ca3af" text-anchor="middle" dominant-baseline="middle">이미지를 불러올 수 없습니다</text></svg>',
  );

function formatDateDivider(dateStr: string) {
  const d = new Date(dateStr);
  // 안드 WebView 는 JS 타임존이 UTC 로 잡히는 경우가 있어 KST(Asia/Seoul) 고정으로 표시한다.
  const time = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Seoul' });
  // 오늘/어제 판정도 KST 날짜키(YYYY-MM-DD)로 — 자정 경계에서 라벨이 어긋나지 않게.
  const kstKey = (dt: Date) => dt.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  const now = new Date();
  const dKey = kstKey(d);
  if (dKey === kstKey(now)) return `(오늘) ${time}`;
  if (dKey === kstKey(new Date(now.getTime() - 86400000))) return `(어제) ${time}`;
  const [, mm, dd] = dKey.split('-');
  return `${Number(mm)}월 ${Number(dd)}일 ${time}`;
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

// 낙관적(옵티미스틱) 임시 메시지 식별 — 페이지(opt-)와 스토어(pending-) 두 컨벤션 모두.
// 실제 서버 메시지는 UUID라 프리픽스가 없어 절대 매칭되지 않는다.
function isOptimisticId(id: string) {
  return id.startsWith('opt-') || id.startsWith('pending-') || id.startsWith('tmp-');
}

// 같은 견적(quotationId)에 카드가 두 번(스토어 낙관적 + 로컬 insert) 들어오는 중복 제거.
// 낙관적(opt-/pending-) id 카드보다 실제(UUID) 카드를 우선 보존. 순서 유지.
function dedupeQuoteMessages(messages: Message[]): Message[] {
  const indexByQuote = new Map<string, number>();
  const result: Message[] = [];
  for (const m of messages) {
    const qid = m.type === 'system' && m.system?.kind === 'quote'
      ? ((m.system as { quotationId?: string })?.quotationId)
      : undefined;
    if (!qid) { result.push(m); continue; }
    const existingIdx = indexByQuote.get(qid);
    if (existingIdx === undefined) {
      indexByQuote.set(qid, result.length);
      result.push(m);
    } else if (isOptimisticId(result[existingIdx].id) && !isOptimisticId(m.id)) {
      result[existingIdx] = m; // 낙관적 카드를 실제 카드로 교체
    }
  }
  return result;
}

function hasFetchedEquivalent(message: Message, fetched: Message[]) {
  if (!isOptimisticId(message.id)) return false;
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
    if (isOptimisticId(message.id)) return true;
    // 방금 보낸(서버 저장 완료) 메시지가 getMessages 캐시 지연으로 목록에 아직 없을 때
    // 2초 창은 너무 좁아 이미지(업로드 수초 소요)가 잘려 사라지던 문제 → 60초로 확대.
    return messageTime(message) >= requestedAt - 60_000;
  });

  // 사진 "떴다 사라짐" 방지: 로컬에 이미 렌더 중인 data URL(확실히 보임) 이 있는 *이미지* 는,
  // 서버 재조회본의 /uploads 콘텐츠로 갈아끼우지 않고 로컬 data URL 을 유지한다.
  // (단 동영상은 제외 — data:video 는 iOS 가 재생 못해서 반드시 서버 /uploads(Range) 로 가야 함.)
  const localDataById = new Map(
    current
      .filter((m) => m.type === 'image' && typeof m.content === 'string' && m.content.startsWith('data:'))
      .map((m) => [m.id, m.content]),
  );
  const fetchedMerged = fetched.map((m) =>
    localDataById.has(m.id) ? { ...m, content: localDataById.get(m.id) as string } : m,
  );

  return [...fetchedMerged, ...preserved].sort((a, b) => messageTime(a) - messageTime(b));
}

// @멘션 하이라이트 + URL 링크화는 chat-text.tsx 공용 렌더러로 통일
// (예전엔 여기서 @멘션만 처리해 채팅 속 링크가 눌리지 않았다)

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

  // 행사일: naive 날짜(UTC 자정 직렬화) → 기기 타임존 무관 저장값 그대로(UTC) + 연도 표기
  const dateStr = dateSource
    ? new Date(dateSource).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short', timeZone: 'UTC' })
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

/**
 * 채팅방 화면.
 *
 * 기본은 /chat/[id] 라우트의 전체 화면이지만, PC 채팅 목록에서는 카톡 PC 처럼
 * 우측 패널에 그대로 끼워 넣는다(embedded). 그때는 방 id 를 prop 으로 받고
 * 전체화면 고정(fixed)·뒤로가기 버튼을 끈다.
 */
export default function ChatRoomPage({ roomId: roomIdProp, embedded = false }: { roomId?: string; embedded?: boolean } = {}) {
  const routeParams = useParams<{ id: string }>();
  const roomId = roomIdProp ?? routeParams?.id;
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
    // iOS Safari 도 포함 — 키보드 올라오면 컨테이너 자체를 보이는 영역(visualViewport)만큼 줄여
    // 메시지 목록이 키보드 위로 들어오게. (iOS 는 innerHeight 유지·vv.height 만 줄어 계산 동일)
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const next = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardOffset(next);
      // 키보드가 올라오면 마지막 메시지가 가리지 않게 맨 아래로 스크롤
      if (next > 0) {
        const c = scrollContainerRef.current;
        if (c) requestAnimationFrame(() => { c.scrollTop = c.scrollHeight; });
      }
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
  const [quoteInfoOpen, setQuoteInfoOpen] = useState(false);
  const isPro = iAmProInRoom === true;
  const partnerRoleKnown = iAmProInRoom !== null;
  const partnerIsPro = iAmProInRoom === false;
  const partnerProfileId = chatPartner?.proProfileId || chatPartner?.id;

  // 자동응답이 답을 준비하는 동안에도 '입력 중' 이 뜬다 — 사람이 치는 것처럼 보이게
  const typingUsers = useChatStore((state) => state.typingUsers);
  const partnerTyping = Array.from(typingUsers.entries()).some(([uid, on]) => on && uid !== MY_ID);

  const showQuoteInfo = isPro && roomMeta?.latestQuotation?.status !== 'paid' && Boolean(roomMeta?.matchRequest || roomMeta?.latestQuotation);

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
  const inputRef = useRef<HTMLTextAreaElement>(null);
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
    // 스토어 낙관적(pending-) 메시지는 로컬에 넣지 않음 — 페이지가 자체 opt-/insert 로 발신자 메시지를 관리.
    // (카운트 기반 동기화가 pending-→실제 교체를 놓쳐 pending- 가 남으면 발신자 화면에만 2개로 보이던 버그)
    const newWsMessages = wsMessages
      .slice(prevWsCountRef.current)
      .filter((m) => !String(m.id).startsWith('pending-'));
    prevWsCountRef.current = wsMessages.length;
    if (newWsMessages.length === 0) return;

    const mapped: Message[] = newWsMessages.map(mapApiMessage);
    setMessages((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const unique = mapped.filter((m) => !existingIds.has(m.id));
      if (unique.length === 0) return prev;
      // 낙관적 메시지(opt-) 중 같은 senderId+content인 것 제거
      const withoutOptimistic = prev.filter((m) => {
        if (!isOptimisticId(m.id)) return true;
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
  const handleSend = useCallback((textArg?: unknown) => {
    const text = (typeof textArg === 'string' ? textArg : input).trim();
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

  // ─── iOS 네이티브 채팅 헤더/푸터 연동 훅 ───
  const handleSendRef = useRef(handleSend);
  handleSendRef.current = handleSend;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const myIdRef = useRef(MY_ID);
  myIdRef.current = MY_ID;
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const api = {
      getMessages: () => {
        const list = dedupeQuoteMessages(messagesRef.current);
        const latestQuoteId = [...list]
          .filter((m) => m.type === 'system' && m.system?.kind === 'quote' && (m.system as { quotationId?: string })?.quotationId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.id || null;
        return list.map((m) => {
          const sys = m.system as (typeof m.system & { eventName?: string; planLabel?: string; proImage?: string }) | undefined;
          return {
        id: m.id,
        mine: m.senderId === myIdRef.current,
        content: m.content || '',
        imageUrl: (m.type === 'image' || m.type === 'video') ? absChatUrl(m.content || '') : '',
        type: m.type,
        createdAt: m.createdAt,
        isRead: !!m.isRead,
        replyName: m.replyTo?.name || '',
        replyContent: m.replyTo?.content || '',
        reaction: m.reaction || '',
        fileName: m.fileName || '',
        pending: m.id.startsWith('opt-') || m.id.startsWith('pending-') || m.id.startsWith('tmp-'),
        // 업로드 진행률(낙관적 미디어) — 네이티브 셀에서 카톡식 게이지+MB 표시용. -1 = 업로드 아님.
        uploadProgress: typeof m.uploadProgress === 'number' ? m.uploadProgress : -1,
        uploadBytesTotal: typeof m.uploadBytesTotal === 'number' ? m.uploadBytesTotal : 0,
        uploadFailed: !!m.uploadFailed,
        systemKind: m.system?.kind || '',
        quoteAmount: m.system?.amount || 0,
        quoteTitle: m.system?.title || '',
        quoteEventName: sys?.eventName || m.system?.title || '',
        quotePlanLabel: sys?.planLabel || '',
        quoteProImage: absChatUrl(sys?.proImage || ''),
        quoteIsLatest: m.id === latestQuoteId,
        quoteDate: m.system?.eventDate || '',
        quoteTime: m.system?.eventTime || '',
        quoteLocation: m.system?.eventLocation || m.system?.venue || '',
        quotationId: m.system?.quotationId || '',
          };
        });
      },
      // ─── 네이티브 롱프레스 글래스 메뉴 액션 (B3 Phase2) ───
      reactions: () => ['❤️', '👍', '😂', '😮', '😢', '🙏'],
      replyMessage: (id: string) => {
        const m = messagesRef.current.find((x) => x.id === id);
        if (m) setReplyTo({ id: m.id, name: m.senderId === myIdRef.current ? '나' : (chatPartner?.name || '상대방'), content: m.content });
      },
      announceMessage: (id: string) => {
        const m = messagesRef.current.find((x) => x.id === id);
        if (m && m.type === 'text') setPinnedMessage({ id: m.id, name: m.senderId === myIdRef.current ? '나' : (chatPartner?.name || '상대방'), content: m.content });
      },
      partialCopyMessage: (id: string) => {
        const m = messagesRef.current.find((x) => x.id === id);
        if (m && m.type === 'text') setPartialCopyMsg(m);
      },
      reactMessage: (id: string, emoji: string) => {
        try { useChatStore.getState().addReaction(id, emoji); } catch {}
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, reaction: m.reaction === emoji ? null : emoji } : m)));
      },
      // 업로드 실패 미디어 — 네이티브 셀의 재전송/삭제 버튼에서 호출
      retryMedia: (id: string) => {
        const m = messagesRef.current.find((x) => x.id === id);
        if (m) retryFailedMedia(m);
      },
      deleteMedia: (id: string) => {
        setMessages((prev) => prev.filter((x) => x.id !== id));
      },
      // 견적 카드 탭 → 결제 페이지로 (고객만; 사회자는 무시)
      openQuotePayment: (quotationId: string) => {
        if (isPro) return;
        const m = messagesRef.current.find((x) => x.system?.quotationId === quotationId);
        const sys = m?.system;
        const proId = (chatPartner as any)?.proProfileId || chatPartner?.id;
        const params = new URLSearchParams({
          price: String(sys?.amount || 0),
          plan: sys?.plan || 'premium',
          quotationId,
        });
        if (sys?.eventDate) params.set('eventDate', sys.eventDate);
        if (sys?.eventTime) params.set('slots', sys.eventTime);
        if (sys?.eventLocation) params.set('eventLocation', sys.eventLocation);
        router.push(proId ? `/pros/${proId}/checkout?${params.toString()}` : `/pros/checkout?${params.toString()}`);
      },
      getState: () => ({
        name: chatPartner?.name || '',
        imageUrl: chatPartner?.profileImageUrl || '',
        // 온/오프라인 상태는 노출하지 않는다(웹 헤더에서 제거된 것과 동일하게 네이티브도 비움)
        online: false,
        statusText: '',
        partnerIsPro: !!partnerIsPro,
        partnerRoleKnown: !!partnerRoleKnown,
        isPro: !!isPro,
        ready: !!chatPartner?.name,
        muted: !!muted,
      }),
      sendText: (t: string) => { handleSendRef.current?.(t); },
      openAttach: () => setShowAttach(true),
      openQuote: () => { if (isPro) setShowQuoteModal(true); },
      startVoice: () => { startRecordingRef.current?.(); },
      openProfile: () => openPartnerProfile(),
      openMenu: () => setShowHeaderMenu((v) => !v),
      back: () => {
        if (typeof window !== 'undefined' && window.history.length > 1) router.back();
        else router.replace('/chat');
      },
    };
    (window as any).__freetifulChat = api;
    window.dispatchEvent(new Event('freetiful:chat-state'));
    return () => {
      try { if ((window as any).__freetifulChat === api) delete (window as any).__freetifulChat; } catch {}
    };
  }, [chatPartner, partnerIsPro, partnerRoleKnown, isPro, muted, openPartnerProfile, router]);

  // 메시지 변화 → 네이티브 메시지 리스트 갱신 트리거 (B3 Phase1)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new Event('freetiful:chat-messages'));
  }, [messages]);

  // 입력창 자동 높이 — 내용이 가로폭을 넘으면 줄바꿈되며 height 가 늘어남(최대 120px 후 스크롤)
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, [input]);

  // 보낸 사진/영상이 방을 나갔다 재진입할 때 사라지지 않도록 — messages 변할 때마다 캐시 저장.
  // (기존엔 getMessages 응답 때만 저장돼서 방금 보낸 낙관적 미디어가 재진입 시 유실됐다.
  //  네이티브 채팅도 이 캐시/재조회 결과를 미러링하므로 동일하게 사라졌다.)
  useEffect(() => {
    if (!roomId || roomId.startsWith('pending-') || messages.length === 0) return;
    saveMsgCache(roomId, messages);
  }, [messages, roomId]);

  // ─── Input change + mention detection ───
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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

  // 업로드 실패(uploadFailed)한 사진/영상/파일 버블을 탭하면 재전송. 버블은 data URL 을
  // 유지하고 있으므로 그 내용을 그대로 다시 POST 한다. (사진 사라짐 대신 '재시도'로 복구)
  const retryFailedMedia = async (msg: Message) => {
    if (!msg.content) return;
    setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, uploadFailed: false, uploadProgress: 0 } : m));
    try {
      const resp = await chatApi.sendMessage(
        roomId,
        {
          type: msg.type,
          content: msg.content,
          ...(msg.type === 'file' ? { metadata: { fileName: msg.fileName } } : {}),
        },
        { timeout: 60000 },
      );
      const saved: any = resp.data;
      setMessages((prev) => prev.some((m) => m.id === saved.id)
        ? prev.filter((m) => m.id !== msg.id)
        : prev.map((m) => m.id === msg.id ? {
            ...m,
            id: saved.id,
            // 동영상은 서버 /uploads(Range 재생) 로 교체, 이미지는 data URL 유지
            content: msg.type === 'video' && saved.content ? saved.content : m.content,
            createdAt: saved.createdAt || m.createdAt,
            uploadProgress: undefined,
            uploadFailed: false,
          } : m));
      useChatStore.getState().fetchRooms({ limit: 50, force: true }).catch(() => {});
    } catch {
      setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, uploadProgress: undefined, uploadFailed: true } : m));
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
      <div className={`${embedded ? 'absolute' : 'fixed'} inset-0 flex flex-col overflow-hidden bg-white`}>
        {/* Top shimmer bar */}
        <div className="absolute top-0 left-0 right-0 h-[3px] z-50 overflow-hidden bg-gray-100">
          <div className="h-full bg-[#3180F7]/40 animate-[shimmerBar_1.4s_ease-in-out_infinite]" style={{ width: '60%' }} />
        </div>

        {/* Header skeleton */}
        <div className="absolute left-0 right-0 top-0 z-30 px-3 pt-3 pb-2 pt-safe">
          <div className="flex items-center gap-2 max-w-[680px] mx-auto">
            <button onClick={() => router.back()} className="w-12 h-12 rounded-full bg-white/90 shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-gray-200/60 flex items-center justify-center shrink-0">
              <ChevronLeft size={24} className="text-gray-600" />
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
              <div className={`${b.w} ${b.h} rounded-2xl ${b.mine ? 'rounded-br-sm bg-[#3180F7]/12' : 'rounded-bl-sm bg-[#F2F3F5]'} animate-pulse`} />
            </div>
          ))}
        </div>

        {/* Input skeleton */}
        <div className="px-3 pb-4 pb-safe pt-2 bg-white">
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
    <div
      className={`${embedded ? 'absolute' : 'fixed'} inset-0 flex flex-col overflow-hidden bg-white`}
      style={embedded ? undefined : { bottom: keyboardOffset }}
    >
      {/* 헤더가 불투명한 흰 바라 위쪽 그라데이션 블러는 더 필요 없다 (네이티브 측정용 자리만 유지) */}
      <div data-native-chat-gradient className="absolute left-0 right-0 top-0 h-0 z-20 pointer-events-none" />

      {/* ─── Header (Floating Pill) z-30 ─── */}
      <div data-native-chat-header className="absolute left-0 right-0 top-0 z-30 bg-white pt-safe px-safe">
        <div className="mx-auto flex h-14 w-full max-w-[680px] items-center gap-1 px-2">
          {/* 뒤로가기 — 푸시 알림 cold start 시 history 없으면 채팅 목록으로 */}
          {!embedded && (
            <button
              onClick={() => {
                if (typeof window !== 'undefined' && window.history.length > 1) {
                  router.back();
                } else {
                  router.replace('/chat');
                }
              }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#2B313D] transition-colors active:bg-[#F2F3F5]"
            >
              <ChevronLeft size={20} />
            </button>
          )}

          {/* 중앙 프로필 알약 (상대가 사회자일 때만 프로필 이동) */}
          <button
            type="button"
            onClick={openPartnerProfile}
            className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-[14px] px-1.5 transition-colors active:bg-[#F7F8FA]"
          >
            <div className="relative shrink-0">
              <img src={chatPartner?.profileImageUrl || '/images/default-profile.svg'} alt="" className="h-9 w-9 rounded-full bg-[#F2F3F5] object-cover" />
            </div>
            <div className="flex-1 min-w-0 leading-tight">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-[16px] font-bold text-[#2B313D]">{chatPartner?.name || '...'}</p>
                {chatPartner && partnerRoleKnown && (
                  <span
                    className="shrink-0 rounded-full px-2 py-[2px] text-[10px] font-bold"
                    style={{
                      color: partnerIsPro ? '#3182F6' : '#51535C',
                      backgroundColor: partnerIsPro ? '#EAF2FF' : '#F2F3F5',
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
              className="flex h-10 w-10 items-center justify-center rounded-full text-[#8B95A1] transition-colors active:bg-[#F2F3F5]"
            >
              <MoreVertical size={20} />
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

      {/* ─── 고객 견적 정보 (헤더 바로 아래 고정) ─── */}
      <div
        className="absolute left-3 right-3 pointer-events-auto"
        style={{ top: 'calc(env(safe-area-inset-top, 0px) + 64px)', zIndex: 25 }}
      >
        <div className="mx-auto w-full max-w-[680px]">
      {isPro && roomMeta?.latestQuotation?.status !== 'paid' && (roomMeta?.matchRequest || roomMeta?.latestQuotation) && (() => {
        const mr = roomMeta?.matchRequest;
        const raw: any = mr?.rawUserInput && typeof mr.rawUserInput === 'object' ? mr.rawUserInput : {};
        // 행사 시각은 벽시계 값이라 시간대 변환하면 안 됨(로컬 변환 시 KST 에서 +9h 밀림)
        const fmtTime = formatEventTime;
        const eventDate = mr?.eventDate || roomMeta.latestQuotation?.eventDate || raw.date;
        const eventTime = fmtTime(mr?.eventTime || roomMeta.latestQuotation?.eventTime || raw.timeStart);
        const eventLocation = mr?.eventLocation || (roomMeta.latestQuotation as any)?.eventLocation || raw.location;
        const eventName = roomMeta.latestQuotation?.title || raw.eventName || mr?.eventCategory?.name || '행사 정보 확인 필요';
        const planLabel: string | null = raw.planLabel || (raw.planKey === 'wedding_part12' ? '1부 + 2부' : raw.planKey === 'wedding_part1' ? '1부' : null);
        return (
        <div
          className=""
        >
          <div className="overflow-hidden rounded-[20px] border-[0.6px] border-[#E9EDF3] bg-white shadow-[0_6px_20px_rgba(15,23,42,0.06)]">
            {/* 접힌 상태에서도 무슨 행사·얼마인지는 보이게 */}
            <button
              type="button"
              onClick={() => setQuoteInfoOpen((prev) => !prev)}
              className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors active:bg-[#FBFCFD]"
            >
              <FileText size={17} className="shrink-0 text-[#3180F7]" />
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-bold text-[#8B95A1]">고객 견적 정보</span>
                <span className="mt-0.5 block truncate text-[14px] font-bold text-[#2B313D]">{eventName}</span>
              </span>
              {roomMeta.latestQuotation?.amount != null && (
                <span className="shrink-0 text-[15px] font-bold tabular-nums text-[#2B313D]">
                  {Number(roomMeta.latestQuotation.amount).toLocaleString('ko-KR')}원
                </span>
              )}
              <ChevronDownIcon
                size={18}
                className={`shrink-0 text-[#C8CEDA] transition-transform duration-300 ${quoteInfoOpen ? 'rotate-180' : ''}`}
              />
            </button>

            <div
              className="overflow-hidden transition-all duration-300 ease-out"
              style={{ maxHeight: quoteInfoOpen ? 240 : 0, opacity: quoteInfoOpen ? 1 : 0 }}
            >
              <div className="mx-4 border-t border-[#F2F4F7]" />
              <div className="space-y-2 px-4 pb-3.5 pt-3">
                <p className="flex items-start gap-2 text-[13px] font-medium text-[#4E5968]">
                  <CalendarCheck size={15} className="mt-[1px] shrink-0 text-[#C8CEDA]" />
                  <span className="min-w-0 flex-1">
                    {eventDate
                      ? `${new Date(eventDate).toLocaleDateString('ko-KR', { timeZone: 'UTC' })} ${eventTime}`.trim()
                      : '일정 미입력'}
                  </span>
                </p>
                {eventLocation && (
                  <p className="flex items-start gap-2 text-[13px] font-medium text-[#4E5968]">
                    <MapPin size={15} className="mt-[1px] shrink-0 text-[#C8CEDA]" />
                    <span className="min-w-0 flex-1 break-keep">{eventLocation}</span>
                  </p>
                )}
                {planLabel && (
                  <span className="inline-block rounded-full bg-[#EAF2FF] px-2.5 py-1 text-[12px] font-bold text-[#3182F6]">
                    {planLabel}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        );
      })()}
        </div>
      </div>

      {/* ─── Messages ─── */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-3"
        style={{
          // interactive-widget 미지원 구형 안드로이드 폴백 — 키보드 높이만큼 하단 패딩 추가해 마지막 메시지 가림 방지
          paddingBottom: 80,
          overscrollBehaviorX: 'contain',
          overscrollBehaviorY: 'none',
          paddingTop: roomMeta?.latestQuotation?.status === 'paid'
            ? (scheduleBannerCollapsed ? 134 : 220)
            : showQuoteInfo
              ? (quoteInfoOpen ? 250 : 136)
              : 80,
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
            // 견적 카드 중복(낙관적+실제) 제거 후 렌더 — 네이티브 getMessages 와 동일 기준
            const dedupedMessages = dedupeQuoteMessages(messages);
            // 가장 최근 견적 메시지의 id 를 미리 계산 — 그 견적에만 "결제하기" 버튼 활성화
            const latestQuoteId = [...dedupedMessages]
              .filter((m) => m.type === 'system' && m.system?.kind === 'quote' && m.system?.quotationId)
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.id || null;
            return dedupedMessages.map((msg, i) => {
            const showDate = shouldShowDateDivider(dedupedMessages, i);
            // 직접 결제 유도 주의 — 대화가 길어져도 잊지 않도록 중간중간 다시 깔아 준다
            const showSafetyNotice = i > 0 && i % 20 === 0;

            if (msg.type === 'system') {
              return (
                <div key={msg.id}>
                  {showSafetyNotice && (
                    <Suspense fallback={null}>
                      <SafePaymentNotice />
                    </Suspense>
                  )}
                  {showDate && (
                    <div className="text-center py-3">
                      <span className="text-[11px] text-gray-400">{formatDateDivider(msg.createdAt)}</span>
                    </div>
                  )}
                  {msg.system ? (
                    <Suspense fallback={<SystemMessageFallback msg={msg} />}>
                      <SystemMessageCard msg={msg} isPro={isPro} chatPartner={chatPartner} myProfileImage={authUser?.profileImageUrl || null} isLatestQuote={msg.id === latestQuoteId} refreshTick={dedupedMessages.length} />
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
                {showSafetyNotice && (
                  <Suspense fallback={null}>
                    <SafePaymentNotice />
                  </Suspense>
                )}
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
                    {msg.type === 'image' && isChatStickerUrl(msg.content) ? (
                      /* 이모티콘 — 사진과 달리 말풍선/전체보기 없이 이미지만 */
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
                          alt="이모티콘"
                          draggable={false}
                          className="w-[150px] h-[150px] object-contain select-none"
                          style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
                        />
                      </div>
                    ) : msg.type === 'image' ? (
                      <div
                        className={`relative select-none ${msg.isNew ? 'animate-[bubblePop_0.5s_cubic-bezier(0.34,1.56,0.64,1)]' : ''}`}
                        style={{ WebkitTouchCallout: 'none' }}
                        onPointerDown={(e) => handleLongPressStart(e, msg)}
                        onPointerUp={handleLongPressCancel}
                        onPointerLeave={handleLongPressCancel}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        <img
                          src={absChatUrl(msg.content)}
                          alt=""
                          draggable={false}
                          className="max-h-[340px] max-w-full rounded-2xl object-cover cursor-pointer select-none sm:max-w-[260px]"
                          style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', pointerEvents: 'auto' }}
                          onClick={(e) => { e.stopPropagation(); if (msg.uploadProgress == null && !msg.uploadFailed) setImagePreview(absChatUrl(msg.content)); }}
                          onError={(e) => { const t = e.currentTarget; if (!t.src.startsWith('data:') && !t.dataset.fb) { t.dataset.fb = '1'; t.src = BROKEN_IMG_PLACEHOLDER; } }}
                        />
                        <MediaUploadOverlay progress={msg.uploadProgress} totalBytes={msg.uploadBytesTotal} />
                        {msg.uploadFailed ? <FailedMediaOverlay onRetry={() => retryFailedMedia(msg)} /> : null}
                      </div>
                    ) : msg.type === 'video' ? (
                      <div
                        className={`relative select-none ${msg.isNew ? 'animate-[bubblePop_0.5s_cubic-bezier(0.34,1.56,0.64,1)]' : ''}`}
                        style={{ WebkitTouchCallout: 'none' }}
                        onPointerDown={(e) => handleLongPressStart(e, msg)}
                        onPointerUp={handleLongPressCancel}
                        onPointerLeave={handleLongPressCancel}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        <video
                          // #t=0.1 미디어프래그먼트 — 모바일(특히 iOS Safari)은 이게 없으면 첫 프레임을
                          // 디코드/표시 안 해 썸네일이 비어 보임. 0.1초 프레임으로 강제 시킹해 포스터 노출.
                          src={(() => { const u = videoDirectUrl(msg.content); return u && /^https?:/.test(u) && !u.includes('#') ? `${u}#t=0.1` : u; })()}
                          controls={msg.uploadProgress == null}
                          playsInline
                          preload="metadata"
                          className="max-h-[340px] max-w-full rounded-2xl object-cover sm:max-w-[260px]"
                          style={{ WebkitTouchCallout: 'none' }}
                        />
                        <MediaUploadOverlay progress={msg.uploadProgress} totalBytes={msg.uploadBytesTotal} />
                        {msg.uploadFailed ? <FailedMediaOverlay onRetry={() => retryFailedMedia(msg)} /> : null}
                      </div>
                    ) : msg.type === 'file' ? (() => {
                      // 옛 휘발성 fs 경로(/uploads/chat-xxx.ext)로 저장됐던 파일은 서버 재배포로 유실됨 → 404 대신 '만료' 표시
                      const expired = !!msg.content && /^\/uploads\/chat-.*\.[a-z0-9]+$/i.test(msg.content);
                      const href = !expired && msg.content && /^https?:|^\/uploads\//.test(msg.content) ? absChatUrl(msg.content) : undefined;
                      // 파일이 이미지면 새 탭(원본=엄청 확대) 대신 화면맞춤 뷰어로 연다
                      const isImageFile = /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test((msg.fileName || msg.content || '').toLowerCase());
                      return (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex max-w-full min-w-0 items-center gap-2 px-4 py-3 rounded-[20px] select-none no-underline ${mine ? 'bg-[#3180F7] text-white' : 'bg-[#F2F3F5] text-[#2B313D]'} ${expired ? 'opacity-60' : ''} ${msg.isNew ? 'animate-[bubblePop_0.5s_cubic-bezier(0.34,1.56,0.64,1)]' : ''}`}
                        style={{ WebkitTouchCallout: 'none' }}
                        onClick={async (e) => {
                          if (expired) { e.preventDefault(); return; }
                          if (isImageFile && href) { e.preventDefault(); setImagePreview(href); return; }
                          if (!href) return;
                          e.preventDefault();

                          // 안드로이드 앱(WebView)은 다운로드 리스너가 없어 blob 다운로드가 조용히 무시되고,
                          // 그냥 URL 을 열면 WebView 가 PDF 를 못 그려서 원문이 텍스트로 깨져 보인다.
                          // 앱이 intent:// 는 외부 앱으로 넘겨주므로(MainActivity.shouldOverrideUrlLoading)
                          // 그 경로로 시스템 뷰어에 넘긴다.
                          const inAndroidApp = typeof window !== 'undefined'
                            && !!(window as unknown as { Android?: unknown }).Android;
                          if (inAndroidApp) {
                            try {
                              const u = new URL(href, window.location.origin);
                              const mime = /\.pdf$/i.test(msg.fileName || '') ? 'application/pdf' : '*/*';
                              const intentUrl =
                                `intent://${u.host}${u.pathname}${u.search}` +
                                `#Intent;scheme=${u.protocol.replace(':', '')};` +
                                `action=android.intent.action.VIEW;type=${mime};end`;
                              window.location.href = intentUrl;
                              return;
                            } catch {
                              window.location.href = href;
                              return;
                            }
                          }

                          // href 가 cross-origin(Railway /uploads)이라 a[download] 가 무시됨 →
                          // fetch→blob(same-origin) 으로 다운로드 강제. 실패 시 새 탭 폴백.
                          try {
                            const resp = await fetch(href, { credentials: 'omit' });
                            if (!resp.ok) throw new Error(String(resp.status));
                            const blob = await resp.blob();
                            const objUrl = URL.createObjectURL(blob);
                            const dl = document.createElement('a');
                            dl.href = objUrl;
                            dl.download = msg.fileName || 'download';
                            document.body.appendChild(dl);
                            dl.click();
                            dl.remove();
                            setTimeout(() => URL.revokeObjectURL(objUrl), 60_000);
                          } catch {
                            window.open(href, '_blank', 'noopener');
                          }
                        }}
                        onPointerDown={(e) => handleLongPressStart(e, msg)}
                        onPointerUp={handleLongPressCancel}
                        onPointerLeave={handleLongPressCancel}
                        onContextMenu={(e) => e.preventDefault()}
                      >
                        <FileText size={18} />
                        <span className="min-w-0 break-all text-[15px]">{msg.fileName || msg.content}{expired ? ' · 만료됨' : ''}</span>
                        {msg.uploadProgress != null && msg.uploadProgress < 100 && (
                          <span className="shrink-0 text-[12px] font-bold tabular-nums opacity-80">{Math.round(msg.uploadProgress)}%</span>
                        )}
                      </a>
                      );
                    })() : msg.type === 'location' ? (
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
                          <div className={`flex max-w-full min-w-0 items-center gap-2 px-4 py-3 rounded-[20px] ${mine ? 'bg-[#3180F7] text-white' : 'bg-[#F2F3F5] text-[#2B313D]'}`}>
                            <MapPin size={18} />
                            <span className="min-w-0 break-words text-[15px]">{msg.content}</span>
                          </div>
                        ) : (
                          <div className={`flex max-w-full min-w-0 items-center gap-2 px-4 py-3 rounded-[20px] ${mine ? 'bg-[#3180F7] text-white' : 'bg-[#F2F3F5] text-[#2B313D]'}`}>
                            <MapPin size={18} />
                            <span className="min-w-0 break-words text-[15px]">{msg.content}</span>
                          </div>
                        )}
                      </div>
                    ) : msg.type === 'voice' ? (
                      <div
                        className={`flex max-w-full min-w-[min(180px,70vw)] items-center gap-3 pl-2 pr-4 py-2.5 rounded-[20px] select-none ${mine ? 'bg-[#3180F7] text-white' : 'bg-[#F2F3F5] text-[#2B313D]'} ${msg.isNew ? 'animate-[bubblePop_0.5s_cubic-bezier(0.34,1.56,0.64,1)]' : ''}`}
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
                          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 active:scale-90 transition-transform ${mine ? 'bg-white/20' : 'bg-[#3180F7]'}`}
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
                                    : (filled ? '#3180F7' : '#C8CEDA'),
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
                            ? 'bg-[#3180F7] text-white rounded-[20px] rounded-br-[6px]'
                            : 'bg-[#F2F3F5] text-[#2B313D] rounded-[20px] rounded-bl-[6px]'
                        } ${msg.isNew ? 'animate-[bubblePop_0.5s_cubic-bezier(0.34,1.56,0.64,1)]' : ''} ${actionMenu?.id === msg.id ? 'ring-2 ring-[#3180F7]/40' : ''}`}
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
          {partnerTyping && (
            <div className="mb-[6px] flex justify-start">
              <div className="flex items-center gap-[5px] rounded-[20px] rounded-bl-[6px] bg-[#F2F3F5] px-4 py-[14px]">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="block h-[7px] w-[7px] rounded-full bg-[#A4ABBA]"
                    style={{ animation: `typingDot 1.1s ease-in-out ${i * 0.16}s infinite` }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ─── 그라데이션 — z-20 (푸터 z-30 뒤에 위치) ─── */}
      <div
        className="absolute inset-x-0 h-16 pointer-events-none z-20"
        style={{
          bottom: 0,
          background: 'linear-gradient(to top, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0) 100%)',
        }}
      />

      {/* ─── Input Bar — z-30 (그라데이션 앞) ─── */}
      <div data-native-chat-footer className="absolute left-0 right-0 z-30 pb-safe px-safe" style={{ bottom: 0 }}>
        <div className="mx-auto flex w-full max-w-[680px] items-end gap-2 bg-white px-3 pointer-events-auto pb-1 pt-2 sm:px-0">
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
                  className="flex h-[50px] shrink-0 items-center justify-center gap-1.5 rounded-full border border-[#E4E7EB] bg-white px-4 text-[#51535C] transition-transform active:scale-[0.92]"
                  title="견적서 보내기"
                >
                  <FileSignature size={18} />
                  <span className="hidden sm:inline text-[13px] font-bold">견적</span>
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); setShowAttach(!showAttach); }}
                className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full bg-[#F2F3F5] text-[#51535C] transition-transform active:scale-[0.9]"
              >
                <Plus size={22} />
              </button>

              <div className="flex min-h-[50px] min-w-0 flex-1 items-end rounded-[22px] bg-[#F2F3F5] py-[7px] pl-4 pr-1.5">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={(e) => {
                    // Korean IME: composition 중 Enter 는 마지막 자모 결합 trigger 라 send 하면 글자 중복 발생
                    // (예: "테스트" + Enter → composition 의 "트" 가 한 번 더 인풋에 남아 다음 send 에 포함됨)
                    // Shift+Enter 는 줄바꿈(기본동작 유지), Enter 만 전송.
                    if (e.key !== 'Enter' || e.shiftKey) return;
                    if (e.nativeEvent.isComposing || (e as any).keyCode === 229) return;
                    e.preventDefault();
                    handleSend();
                  }}
                  placeholder="메시지 (@ 으로 멘션)"
                  className="flex-1 min-w-0 resize-none self-center bg-transparent py-[3px] text-[16px] leading-[1.35] focus:outline-none placeholder:text-gray-400 max-h-[120px] overflow-y-auto"
                />
                {input.trim() ? (
                  <button
                    onClick={handleSend}
                    className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#3180F7] text-white transition-transform active:scale-[0.88]"
                  >
                    <PaperPlaneIcon size={17} />
                  </button>
                ) : (
                  <button
                    onClick={() => startRecordingRef.current?.()}
                    className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#8B95A1] transition-all active:scale-[0.88]"
                    title="음성 메시지 녹음"
                  >
                    <Mic size={19} />
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
                      {eventDate ? new Date(eventDate).toLocaleDateString('ko-KR', { timeZone: 'UTC' }) : '미정'}
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
