'use client';

import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/auth.store';
import { notificationApi, getCachedNotifications } from '@/lib/api/notification.api';
import { popItemDelay } from '@/lib/pop-menu';

/* ════════════════════════════════════════════════════════════════
 * 알림 — 토스 알림 화면 그대로 (2026-09-25 사장 지시), 등장은 퀵매칭 어법.
 *  · 위: ‹ 뒤로 … '알림 설정'(글자 링크). 그 아래 큰 제목 '알림 ⌄' — 누르면 종류 거르기 · 모두 읽음 · 전체 삭제.
 *  · 새 알림은 맨 위 연한 파랑 바탕, 그 아래 '지난 알림'.
 *  · 한 줄 = 둥근 아이콘 칸 · 제목(진하게) · 본문(회색, 3줄까지) · 오른쪽 시간 + 같은 곳에서 여럿 오면 'N건'.
 *    같은 종류·같은 곳·같은 제목은 한 줄로 묶는다(토스 'N건').
 *  · 등장: 제목 아래→위 페이드, 줄은 오른쪽→왼쪽 순차 슬라이드. 왼쪽으로 밀면 삭제(원래 기능 유지).
 * ⚠ iOS 앱 알림 화면은 네이티브(nativeNotifications) — 이 화면은 웹·안드로이드.
 * ════════════════════════════════════════════════════════════════ */

type NotifType = 'chat' | 'booking' | 'payment' | 'review' | 'system' | 'marketing';

interface Notification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  date: string;
  link?: string;
}

type Group = { key: string; head: Notification; items: Notification[]; unread: boolean };

// 토스 컬러 아이콘(public/icons/toss) — 종류마다 색이 달라야 한눈에 갈린다
const TYPE_ICON: Record<NotifType, string> = {
  chat: 'chat',
  booking: 'calendar-check',
  payment: 'coin',
  review: 'star',
  system: 'loudspeaker',
  marketing: 'gift',
};

// '알림 ⌄' 메뉴 — 토스처럼 컬러 아이콘 + 이름 한 줄씩
const FILTERS: { k: string; label: string; title: string; icon: string; types: NotifType[] | null }[] = [
  { k: 'all', label: '전체', title: '알림', icon: 'list', types: null },
  { k: 'chat', label: '채팅', title: '채팅 알림', icon: 'chat', types: ['chat'] },
  { k: 'booking', label: '예약', title: '예약 알림', icon: 'calendar-check', types: ['booking'] },
  { k: 'payment', label: '결제', title: '결제 알림', icon: 'coin', types: ['payment'] },
  { k: 'review', label: '리뷰', title: '리뷰 알림', icon: 'star', types: ['review'] },
  { k: 'notice', label: '공지 · 이벤트', title: '공지 · 이벤트', icon: 'loudspeaker', types: ['system', 'marketing'] },
];

const UNREAD_BG = '#F2F6FC';

// 서버에선 useEffect(경고 없음), 브라우저에선 그리기 전에 도는 useLayoutEffect
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const NT_CSS = `
@keyframes ntFadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
@keyframes ntSlideIn { from { opacity: 0; transform: translateX(22px); } to { opacity: 1; transform: translateX(0); } }
.nt-a-title { animation: ntFadeUp .5s cubic-bezier(.22,.61,.36,1) both; }
.nt-a-sub { animation: ntFadeUp .5s cubic-bezier(.22,.61,.36,1) .18s both; }
/* fill backwards — 끝나면 빠져서 눌림 효과·밀기(transform)가 산다 */
.nt-a-item { animation: ntSlideIn .46s cubic-bezier(.22,.61,.36,1) backwards; }
@media (prefers-reduced-motion: reduce) { .nt-a-title, .nt-a-sub, .nt-a-item { animation: none !important; } }
`;

function resolveNotifLink(type: NotifType, data: any): string | undefined {
  const explicitLink = data?.link || data?.url || data?.deepLink || data?.deeplink || data?.launchURL;
  if (typeof explicitLink === 'string' && explicitLink.trim()) return explicitLink;
  if (data?.link) return data.link;
  const chatRoomId = data?.chatRoomId || data?.roomId || data?.chat_room_id || data?.room_id;
  if (chatRoomId) return `/chat/${chatRoomId}`;
  if (data?.quotationId) return '/my/purchase-history';
  if (data?.paymentId) return '/my/payment-history';
  if (data?.reviewId && data?.proProfileId) return `/pros/${data.proProfileId}/reviews`;
  if (data?.proProfileId) return `/pros/${data.proProfileId}`;
  if (type === 'chat') return '/chat';
  if (type === 'booking') return '/main';
  if (type === 'payment') return '/my/payment-history';
  if (type === 'review') return '/my/purchase-history';
  if (type === 'marketing') return '/my';
  if (type === 'system') return '/my/announcements';
  return undefined;
}

function mapNotif(n: any): Notification {
  const createdAt = n.createdAt || '';
  return {
    id: n.id,
    type: (TYPE_ICON[n.type as NotifType] ? n.type : 'system') as NotifType,
    title: n.title || '',
    body: n.body || '',
    isRead: n.isRead,
    createdAt,
    date: createdAt ? new Date(createdAt).toLocaleDateString('ko-KR') : '',
    link: resolveNotifLink(n.type as NotifType, n.data),
  };
}

/** 토스식 시간 — 방금 전 · N분 전 · N시간 전 · M월 D일(올해가 아니면 YY년 M월 D일) */
function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const [y, m, d] = new Date(t).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }).split('-').map(Number);
  const thisYear = Number(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }).slice(0, 4));
  return y === thisYear ? `${m}월 ${d}일` : `${String(y).slice(-2)}년 ${m}월 ${d}일`;
}

/** 같은 종류·같은 곳·같은 제목은 한 줄로(최신이 머리). 목록은 최신순으로 들어온다고 보지 않고 직접 정렬한다 */
function groupNotifs(list: Notification[], prefix: string): Group[] {
  const map = new Map<string, Group>();
  const out: Group[] = [];
  for (const n of list) {
    const key = `${prefix}${n.type}|${n.link || ''}|${n.title}`;
    const g = map.get(key);
    if (g) g.items.push(n);
    else {
      const ng: Group = { key, head: n, items: [n], unread: !n.isRead };
      map.set(key, ng);
      out.push(ng);
    }
  }
  return out;
}

export default function NotificationsPage() {
  const router = useRouter();
  // 캐시된 알림을 즉시 표시 — 단, 첫 렌더(하이드레이션)는 서버와 같게 비워 두고 그리기 직전에 채운다.
  // (useState 초기값에서 localStorage 를 읽으면 서버 HTML 과 어긋나 문서 전체를 브라우저가 다시 그린다)
  const [items, setItems] = useState<Notification[]>([]);
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useIsoLayoutEffect(() => {
    const cached: any = getCachedNotifications();
    if (cached && Array.isArray(cached.data) && cached.data.length > 0) setItems(cached.data.map(mapNotif));
    setReady(true);
  }, []);
  const authUser = useAuthStore((s) => s.user);

  const loadNotifications = useCallback(async () => {
    if (!authUser) {
      setItems([]);
      return;
    }
    const res: any = await notificationApi.getList({ limit: 50 });
    const nextItems = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
    setItems(nextItems.map(mapNotif));
  }, [authUser]);

  useEffect(() => {
    loadNotifications().catch(() => {}).finally(() => setLoaded(true));
  }, [loadNotifications]);

  const [filter, setFilter] = useState('all');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const current = FILTERS.find((f) => f.k === filter) || FILTERS[0];

  // 위 고정 바 — 스크롤 내리면 아래로 흰 그라데이션
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const { unreadGroups, readGroups } = useMemo(() => {
    const visible = items
      .filter((n) => !current.types || current.types.includes(n.type))
      .sort((a, b) => (new Date(b.createdAt).getTime() || 0) - (new Date(a.createdAt).getTime() || 0));
    return {
      unreadGroups: groupNotifs(visible.filter((n) => !n.isRead), 'u:'),
      readGroups: groupNotifs(visible.filter((n) => n.isRead), 'r:'),
    };
  }, [items, current]);

  // 왼쪽으로 밀어서 삭제 — 줄(묶음)마다 얼마나 밀렸나
  const [swipeStates, setSwipeStates] = useState<Record<string, number>>({});
  const touchStartX = useRef<Record<string, number>>({});
  const touchCurrentX = useRef<Record<string, number>>({});
  const mouseDown = useRef<Record<string, boolean>>({});

  const handleDeleteAll = async () => {
    const previousItems = items;
    setItems([]);
    setShowDeleteConfirm(false);
    try {
      await notificationApi.deleteAll();
    } catch {
      setItems(previousItems);
      loadNotifications().catch(() => {});
    }
  };

  const handleDelete = async (id: string) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
    await notificationApi.deleteOne(id);
  };

  const handleDeleteGroup = (g: Group) => {
    const ids = new Set(g.items.map((n) => n.id));
    setItems((prev) => prev.filter((n) => !ids.has(n.id)));
    setSwipeStates((prev) => { const next = { ...prev }; delete next[g.key]; return next; });
    g.items.forEach((n) => { notificationApi.deleteOne(n.id).catch(() => {}); });
  };

  const markGroupRead = (g: Group) => {
    const unreadIds = g.items.filter((n) => !n.isRead).map((n) => n.id);
    if (!unreadIds.length) return;
    const ids = new Set(unreadIds);
    setItems((prev) => prev.map((x) => (ids.has(x.id) ? { ...x, isRead: true } : x)));
    unreadIds.forEach((id) => { notificationApi.markAsRead(id).catch(() => {}); });
  };

  const markAllRead = () => {
    setMenuOpen(false);
    if (!items.some((n) => !n.isRead)) return;
    setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
    notificationApi.markAllAsRead().catch(() => {});
  };

  // 네이티브 알림 화면 브리지
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const post = () => {
      (window as any).webkit?.messageHandlers?.nativeNotifications?.postMessage({
        items: items.map((n) => ({ id: n.id, title: n.title, body: n.body, date: n.date, isRead: n.isRead, url: n.link || '' })),
      });
    };
    (window as any).__freetifulNotifications = {
      post,
      invokeDelete: (id: string) => { handleDelete(id); },
      invokeRead: (id: string) => { notificationApi.markAsRead(id).catch(() => {}); },
    };
    post();
    return () => { try { delete (window as any).__freetifulNotifications; } catch {} };
  }, [items]);

  // ─── 왼쪽으로 밀어서 삭제 (줄 = 묶음 단위) ───

  const handleTouchStart = useCallback((key: string, e: React.TouchEvent) => {
    touchStartX.current[key] = e.touches[0].clientX;
    touchCurrentX.current[key] = e.touches[0].clientX;
  }, []);
  const handleTouchMove = useCallback((key: string, e: React.TouchEvent) => {
    touchCurrentX.current[key] = e.touches[0].clientX;
    const diff = touchStartX.current[key] - touchCurrentX.current[key];
    setSwipeStates((prev) => ({ ...prev, [key]: Math.max(0, Math.min(diff, 100)) }));
  }, []);
  const handleTouchEnd = useCallback((key: string) => {
    const diff = touchStartX.current[key] - touchCurrentX.current[key];
    setSwipeStates((prev) => ({ ...prev, [key]: diff > 80 ? 84 : 0 }));
  }, []);
  const handleMouseDown = useCallback((key: string, e: React.MouseEvent) => {
    mouseDown.current[key] = true;
    touchStartX.current[key] = e.clientX;
    touchCurrentX.current[key] = e.clientX;
  }, []);
  const handleMouseMove = useCallback((key: string, e: React.MouseEvent) => {
    if (!mouseDown.current[key]) return;
    touchCurrentX.current[key] = e.clientX;
    const diff = touchStartX.current[key] - touchCurrentX.current[key];
    setSwipeStates((prev) => ({ ...prev, [key]: Math.max(0, Math.min(diff, 100)) }));
  }, []);
  const handleMouseUp = useCallback((key: string) => {
    if (!mouseDown.current[key]) return;
    mouseDown.current[key] = false;
    const diff = touchStartX.current[key] - (touchCurrentX.current[key] ?? touchStartX.current[key]);
    setSwipeStates((prev) => ({ ...prev, [key]: diff > 80 ? 84 : 0 }));
  }, []);

  let order = 0;
  const renderGroup = (g: Group) => {
    const n = g.head;
    const count = g.items.length;
    const swipeX = swipeStates[g.key] ?? 0;
    const delay = `${0.3 + Math.min(order++, 12) * 0.06}s`;
    return (
      <div key={g.key} className="relative overflow-hidden">
        {/* 뒤에 깔린 삭제 */}
        <div className="absolute inset-y-0 right-0 flex w-[84px] items-stretch bg-[#F04452]">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteGroup(g); }}
            className="w-full text-[15px] font-semibold text-white"
          >
            삭제
          </button>
        </div>
        <div
          className="relative"
          style={{
            transform: `translateX(-${swipeX}px)`,
            transition: swipeX === 0 ? 'transform 0.3s ease' : 'none',
            backgroundColor: g.unread ? UNREAD_BG : '#FFFFFF',
            pointerEvents: swipeX > 60 ? 'none' : 'auto',
          }}
          onTouchStart={(e) => handleTouchStart(g.key, e)}
          onTouchMove={(e) => handleTouchMove(g.key, e)}
          onTouchEnd={() => handleTouchEnd(g.key)}
          onMouseDown={(e) => handleMouseDown(g.key, e)}
          onMouseMove={(e) => handleMouseMove(g.key, e)}
          onMouseUp={() => handleMouseUp(g.key)}
          onMouseLeave={() => handleMouseUp(g.key)}
        >
          <Link
            href={n.link || '#'}
            draggable={false}
            onClick={(e) => {
              if (swipeX > 20) {
                e.preventDefault();
                setSwipeStates((prev) => ({ ...prev, [g.key]: 0 }));
                return;
              }
              markGroupRead(g);
              if (!n.link) e.preventDefault();
            }}
            className="nt-a-item flex gap-3 px-5 py-3.5 transition-colors active:bg-black/[0.03]"
            style={{ animationDelay: delay }}
          >
            <span className={`mt-[2px] flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] ${g.unread ? 'bg-white' : 'bg-[#F2F4F6]'}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- public 정적 SVG, 컬러 그대로 */}
              <img src={`/icons/toss/${TYPE_ICON[n.type]}.svg`} alt="" draggable={false} className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-semibold leading-[1.45] text-[#333D4B]">{n.title || '알림'}</span>
              {n.body && (
                <span className={`mt-0.5 line-clamp-3 whitespace-pre-line text-[16px] leading-[1.5] ${g.unread ? 'text-[#4E5968]' : 'text-[#6B7684]'}`}>
                  {n.body}
                </span>
              )}
            </span>
            <span className="flex shrink-0 flex-col items-end gap-2 pt-[3px]">
              <span className="text-[13px] leading-none text-[#B0B8C1]">{relTime(n.createdAt)}</span>
              {count > 1 && (
                <span className="rounded-[6px] bg-[#E8F3FF] px-1.5 py-[2px] text-[14px] font-semibold leading-[1.3] text-[#3182F6]">{count}건</span>
              )}
            </span>
          </Link>
        </div>
      </div>
    );
  };

  const empty = unreadGroups.length === 0 && readGroups.length === 0;
  // '알림이 없어요'는 불러오기가 끝났거나 로그인 전일 때만 — 불러오는 중에 빈 화면 문구가 번쩍이지 않게
  const showEmpty = ready && empty && (loaded || !authUser);

  return (
    <div className="min-h-screen bg-white pb-16 lg:mx-auto lg:max-w-[680px] lg:pb-12 lg:pt-6" style={{ letterSpacing: '-0.02em' }}>
      <style dangerouslySetInnerHTML={{ __html: NT_CSS }} />

      {/* 위 바 — ‹ 뒤로 … 알림 설정 */}
      <header className="sticky top-0 z-30 bg-white pt-safe lg:static lg:pt-0">
        <div className="flex h-[52px] items-center justify-between px-2">
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? router.back() : router.replace('/main'))}
            aria-label="뒤로"
            className="flex h-11 w-11 items-center justify-center rounded-full transition-colors active:bg-[#F2F4F6]"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" stroke="#191F28" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <Link href="/my/notifications" className="rounded-[10px] px-3 py-2 text-[16px] font-medium text-[#333D4B] transition-colors active:bg-[#F2F4F6]">
            알림 설정
          </Link>
        </div>
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 top-full h-6 bg-gradient-to-b from-white to-white/0 transition-opacity duration-300 lg:hidden ${
            scrolled ? 'opacity-100' : 'opacity-0'
          }`}
        />
      </header>

      {/* 큰 제목 '알림 ⌄' — 종류 거르기 · 모두 읽음 · 전체 삭제 */}
      <div className="relative px-5 pb-3 pt-1">
        <h1 className="nt-a-title">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          className="flex items-center gap-1.5 rounded-[10px] text-[26px] font-bold tracking-[-0.02em] text-[#191F28] active:opacity-70"
        >
          {current.title}
          <svg
            width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"
            className="mt-[3px] transition-transform duration-200"
            style={{ transform: menuOpen ? 'rotate(180deg)' : 'none' }}
          >
            <path d="M6 9l6 6 6-6" stroke="#8B95A1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        </h1>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            {/* 토스 '알림 ⌄' 메뉴 — 작게 시작해 정비율로 커지고(제목 쪽에서), 항목은 오른쪽→왼쪽으로 촤라락 (globals .pop-menu) */}
            <div className="pop-menu absolute left-2 top-full z-50 w-max min-w-[184px] py-2" style={{ transformOrigin: '32px 0' }} role="menu">
              {FILTERS.map((f, i) => {
                const on = filter === f.k;
                return (
                  <button
                    key={f.k}
                    type="button"
                    role="menuitemradio"
                    aria-checked={on}
                    onClick={() => { setFilter(f.k); setMenuOpen(false); }}
                    className="pop-menu-item flex w-full items-center gap-3.5 py-[9px] pl-5 pr-7 text-left transition-colors active:bg-[#F2F4F6] lg:hover:bg-[#F9FAFB]"
                    style={popItemDelay(i)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/icons/toss/${f.icon}.svg`} alt="" className="h-6 w-6 shrink-0" />
                    <span className={`text-[17px] leading-[24px] ${on ? 'font-semibold text-[#191F28]' : 'text-[#333D4B]'}`}>{f.label}</span>
                  </button>
                );
              })}
              <div className="pop-menu-item mx-5 my-1.5 h-px bg-[#F2F4F6]" style={popItemDelay(FILTERS.length)} />
              <button
                type="button"
                role="menuitem"
                onClick={markAllRead}
                className="pop-menu-item flex w-full items-center gap-3.5 py-[9px] pl-5 pr-7 text-left transition-colors active:bg-[#F2F4F6] lg:hover:bg-[#F9FAFB]"
                style={popItemDelay(FILTERS.length + 1)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/toss/check-circle.svg" alt="" className="h-6 w-6 shrink-0" />
                <span className="text-[17px] leading-[24px] text-[#333D4B]">모두 읽음</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => { setMenuOpen(false); setShowDeleteConfirm(true); }}
                className="pop-menu-item flex w-full items-center gap-3.5 py-[9px] pl-5 pr-7 text-left transition-colors active:bg-[#FFF5F6] lg:hover:bg-[#FFF8F8]"
                style={popItemDelay(FILTERS.length + 2)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/toss/bin.svg" alt="" className="h-6 w-6 shrink-0" />
                <span className="text-[17px] leading-[24px] text-[#F04452]">전체 삭제</span>
              </button>
            </div>
          </>
        )}
      </div>

      {!ready || (empty && !showEmpty) ? null : showEmpty ? (
        <div className="nt-a-sub flex flex-col items-center px-5 pt-24 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#F2F4F6]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/toss/alarm.svg" alt="" className="h-9 w-9" />
          </span>
          <p className="mt-4 text-[17px] font-semibold text-[#333D4B]">
            {!authUser ? '로그인하면 알림을 볼 수 있어요' : filter === 'all' ? '새로운 알림이 없어요' : `${current.label} 알림이 없어요`}
          </p>
          <p className="mt-1.5 text-[14px] text-[#8B95A1]">새 소식이 오면 여기에서 알려 드릴게요</p>
        </div>
      ) : (
        <>
          {/* 새 알림 — 연한 파랑 바탕 */}
          {unreadGroups.length > 0 && <div className="pt-1">{unreadGroups.map(renderGroup)}</div>}

          {readGroups.length > 0 && (
            <>
              <h2
                className={`nt-a-item px-5 pb-1 text-[17px] font-bold text-[#191F28] ${unreadGroups.length > 0 ? 'pt-8' : 'pt-3'}`}
                style={{ animationDelay: `${0.3 + Math.min(order++, 12) * 0.06}s` }}
              >
                지난 알림
              </h2>
              <div>{readGroups.map(renderGroup)}</div>
            </>
          )}
        </>
      )}

      {/* 전체 삭제 확인 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-6" onClick={() => setShowDeleteConfirm(false)}>
          <div className="w-full max-w-[340px] rounded-[24px] bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[20px] font-bold text-[#191F28]">알림을 모두 지울까요?</h3>
            <p className="mt-1.5 text-[15px] text-[#6B7684]">지운 알림은 다시 볼 수 없어요.</p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="h-[52px] flex-1 rounded-[16px] bg-[#F2F4F6] text-[16px] font-semibold text-[#4E5968] transition-transform active:scale-[0.98]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDeleteAll}
                className="h-[52px] flex-1 rounded-[16px] bg-[#F04452] text-[16px] font-semibold text-white transition-transform active:scale-[0.98]"
              >
                모두 지우기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
