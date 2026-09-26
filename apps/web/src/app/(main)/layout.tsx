'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import Footer from '@/components/Footer';
import PageTransition from '@/components/PageTransition';
import { useAuthStore } from '@/lib/store/auth.store';
import { rememberAuthReturnTo, startOAuth } from '@/lib/auth/oauth';
import { requestNativeLoginSheet } from '@/lib/auth/native-login';
import VilladegdEventOverlay from '@/components/VilladegdEventOverlay';
import GuestLoginForm from '@/components/GuestLoginForm';
import { WEDDING_PARTNER_CATEGORIES, WEDDING_PARTNER_CATEGORY_ICONS } from '@/lib/business-categories';
import { LayoutGroup, motion } from 'framer-motion';
import NotificationDrawer from '@/components/NotificationDrawer';
import { getCachedUnreadCount } from '@/lib/api/notification.api';
import { AlarmIcon } from '@/components/icons/mono';

// ─── 하단 탭 아이콘(토스 하단바 어법, 사장 레퍼런스 260926) ───
// 평소엔 가는 선(1.6) 아이콘, 선택된 탭만 채운 아이콘. 색은 currentColor(탭에서 쿨그레이 #4E5968).
type TabIconProps = { active?: boolean; className?: string };

const HomeTabIcon = ({ active, className }: TabIconProps) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M4 10.3L12 4l8 6.3V19a1.6 1.6 0 0 1-1.6 1.6H15v-5a1.2 1.2 0 0 0-1.2-1.2h-3.6A1.2 1.2 0 0 0 9 15.6v5H5.6A1.6 1.6 0 0 1 4 19v-8.7z"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

// 웨딩숲(= 커뮤니티, 사장 지시 260926) — 사장 아이콘 세트 icon-tree-mono 나무. 선 버전은 같은 모양을 2.2px 로 그리고 86% 로 줄여 칸에 맞춤
const ForestTabIcon = ({ active, className }: TabIconProps) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      transform="translate(12 12) scale(0.86) translate(-12 -12)"
      d="M20.7439 15.865L16.7249 10.853H17.7679C18.7749 10.853 19.3339 9.68802 18.7039 8.90202L12.9359 1.70902C12.4559 1.11002 11.5439 1.11002 11.0639 1.70902L5.29594 8.90202C4.66594 9.68702 5.22494 10.853 6.23194 10.853H7.27494L3.25594 15.865C2.62594 16.651 3.18494 17.816 4.19194 17.816H10.3319V22.057C10.3319 22.379 10.5929 22.641 10.9159 22.641H13.0839C13.4059 22.641 13.6679 22.38 13.6679 22.057V17.816H19.8079C20.8149 17.815 21.3739 16.65 20.7439 15.865Z"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinejoin="round"
    />
  </svg>
);

const ListTabIcon = ({ active, className }: TabIconProps) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <rect x="4.5" y="3.5" width="15" height="17" rx="3" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" />
    <path d="M8.5 9h7M8.5 12.5h7M8.5 16h4" stroke={active ? '#fff' : 'currentColor'} strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

// 매칭(고객 탭, 사장 지시 260926 — 문의목록→매칭) — 사장 아이콘 세트 icon-lightning-mono 번개. 선 버전은 같은 모양을 2.3px 로 그리고 84% 로 줄여 칸에 맞춤
const MatchTabIcon = ({ active, className }: TabIconProps) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      transform="translate(12 12) scale(0.84) translate(-12 -12)"
      d="M19.0309 10.9337L14.3579 9.3017L15.7699 2.3297C15.9969 1.2057 14.6099 0.488704 13.8249 1.3227L4.51492 11.2107C4.38477 11.3489 4.29122 11.5174 4.24278 11.701C4.19434 11.8845 4.19255 12.0773 4.23756 12.2617C4.28257 12.4461 4.37296 12.6163 4.50052 12.7569C4.62807 12.8975 4.78874 13.004 4.96792 13.0667L9.63992 14.6987L8.22992 21.6707C8.00092 22.7937 9.38792 23.5107 10.1739 22.6777L19.4849 12.7877C20.0499 12.1877 19.8089 11.2047 19.0309 10.9337Z"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinejoin="round"
    />
  </svg>
);

const ChatTabIcon = ({ active, className }: TabIconProps) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path
      d="M12 4c4.8 0 8.6 3.2 8.6 7.3s-3.8 7.3-8.6 7.3c-.9 0-1.8-.1-2.6-.3L5.2 20.4l.9-3.8C4.4 15.2 3.4 13.4 3.4 11.3 3.4 7.2 7.2 4 12 4z"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

const MyTabIcon = ({ active, className }: TabIconProps) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    {active ? (
      <>
        <circle cx="12" cy="8.2" r="4" fill="currentColor" />
        <path d="M4.2 19.6c.6-3.8 3.8-6.3 7.8-6.3s7.2 2.5 7.8 6.3a.8.8 0 0 1-.8.9H5a.8.8 0 0 1-.8-.9z" fill="currentColor" />
      </>
    ) : (
      <>
        <circle cx="12" cy="8.2" r="3.6" stroke="currentColor" strokeWidth="1.6" />
        <path d="M5 20c.6-3.5 3.5-5.8 7-5.8s6.4 2.3 7 5.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </>
    )}
  </svg>
);

/**
 * 스크롤을 내리면 헤더에 붙는 카테고리 바.
 * 홈 히어로의 카테고리 아이콘 줄이 화면 밖으로 나가는 순간 헤더 안으로 이어붙어
 * 이동 경로가 끊기지 않게 한다. (PC 홈 전용)
 */
const HEADER_CATEGORIES: { name: string; img: string; href: string }[] = [
  { name: '결혼식사회자', img: '/images/category-icons/wedding-mc-icon.png', href: '/pros?category=%EA%B2%B0%ED%98%BC%EC%8B%9D%EC%82%AC%ED%9A%8C%EC%9E%90' },
  { name: '행사사회자', img: '/images/category-icons/event-mc-icon.png', href: '/pros?category=%EC%A0%84%EB%AC%B8%ED%96%89%EC%82%AC%EC%82%AC%ED%9A%8C%EC%9E%90' },
  { name: '외국어사회자', img: '/images/category-icons/foreign-mc.png', href: '/pros?category=%EC%99%B8%EA%B5%AD%EC%96%B4%EC%82%AC%ED%9A%8C%EC%9E%90' },
  ...WEDDING_PARTNER_CATEGORIES.filter((name) => name !== '가전').map((name) => ({
    name,
    img: `/images/category-icons/${WEDDING_PARTNER_CATEGORY_ICONS[name]}`,
    href: `/businesses?category=${encodeURIComponent(name)}`,
  })),
];

const USER_NAV_ITEMS = [
  { href: '/main',      icon: HomeTabIcon,      label: '홈' },
  { href: '/community', icon: ForestTabIcon,    label: '웨딩숲' },
  { href: '/inquiries', icon: MatchTabIcon,     label: '매칭' },
  { href: '/chat',      icon: ChatTabIcon,      label: '채팅' },
  { href: '/my',        icon: MyTabIcon,        label: '마이' },
];

const PRO_NAV_ITEMS = [
  { href: '/main',      icon: HomeTabIcon,       label: '홈' },
  { href: '/community', icon: ForestTabIcon,     label: '웨딩숲' },
  { href: '/pro-dashboard/inquiries', icon: ListTabIcon, label: '새요청' },
  { href: '/chat',      icon: ChatTabIcon,       label: '채팅' },
  { href: '/my',        icon: MyTabIcon,         label: '마이' },
];

const HIDE_NAV_PATTERNS = [
  /^\/chat\/.+/,
  /^\/pros\/.+/,
  /^\/businesses\/.+/,
  /^\/my\/.+/,
  /^\/notifications/,
  /^\/pro-register/,
  /^\/pro-dashboard\/auto-reply/,
  /^\/pros$/,
  /^\/businesses$/,
  /^\/biz/,
  /^\/careers$/,
  /^\/search/,
  /^\/community\/.+/,
];

const HIDE_FOOTER_PATTERNS = [
  /^\/community/,
  /^\/chat$/,
  /^\/my$/,
  /^\/pro-dashboard/,
];
// 하단 탭 화면(매칭·새요청·채팅·마이·웨딩숲)은 모바일에서 회사 정보 푸터를 안 둔다 — PC 는 그대로(260926 사장)
const MOBILE_HIDE_FOOTER_PATTERNS = [
  /^\/inquiries$/,
  /^\/pro-dashboard\/inquiries$/,
  /^\/chat$/,
  /^\/my$/,
  /^\/community$/,
];

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

function queueIdleTask(callback: () => void, delay = 0, timeout = 3000) {
  if (typeof window === 'undefined') return () => {};
  let cancelled = false;
  let idleId: number | null = null;
  const win = window as IdleWindow;
  const timer = window.setTimeout(() => {
    if (cancelled) return;
    if (win.requestIdleCallback) {
      idleId = win.requestIdleCallback(() => {
        if (!cancelled) callback();
      }, { timeout });
      return;
    }
    callback();
  }, delay);

  return () => {
    cancelled = true;
    window.clearTimeout(timer);
    if (idleId != null) win.cancelIdleCallback?.(idleId);
  };
}

export default function MainLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // 홈은 흰 배경. 목록 화면들은 카드 구분을 위해 기존 연회색(#FAFBFC)을 유지한다.
  const isHome = pathname === '/' || pathname === '/main';
  /** 사회자 상세는 화면 전체가 흰 카드라 뒤에 연회색이 깔리면 아래쪽이 회색으로 보인다 */
  const whiteBackground = isHome || /^\/pros\/[^/]+/.test(pathname);
  // 채팅은 모바일만 흰 바탕 — 목록 아래 여백(pb-24)으로 회색(surface-50)이 띠처럼 비치던 것. PC 는 회색 바탕 위 흰 카드 유지.
  const chatRoute = /^\/chat(\/|$)/.test(pathname);
  // 매칭·새요청 목록도 흰 종이 한 장 — 같은 이유로 모바일만 흰 바탕
  const requestListRoute = pathname === '/inquiries' || pathname === '/pro-dashboard/inquiries';
  // 마이페이지는 모바일에서 회색(#F4F6FA) 위 흰 카드 — 페이지 바탕과 같은 색이어야 아래 여백에 다른 회색 띠가 안 생긴다
  const myRoute = pathname === '/my';
  const router = useRouter();
  const hideNav = HIDE_NAV_PATTERNS.some((p) => p.test(pathname));
  // 커뮤니티는 하단 탭(모바일)만 같이 쓰고, PC 는 원래 자기 머리줄·사이드바 화면 그대로(겹치지 않게 PC 머리줄·폭 제한 없음)
  const communityRoute = /^\/community(\/|$)/.test(pathname);
  const [navVisible, setNavVisible] = useState(true);
  const [navMounted, setNavMounted] = useState(false); // 초기 등장 애니메이션 (한 번만)
  const [categoryDocked, setCategoryDocked] = useState(false);
  /** PC 사회자 미리보기처럼 iframe 안에 끼워 넣은 경우 — 오버레이/배너는 띄우지 않는다 */
  const [embedded, setEmbedded] = useState(false);
  useEffect(() => {
    let inFrame = true;
    try { inFrame = window.self !== window.top; } catch { inFrame = true; }
    setEmbedded(inFrame);
    // 좁은 칸에 끼워 넣은 화면은 가운데 정렬된 max-w 컨테이너 때문에 양옆이 비어 보인다.
    // 이 표시를 보고 globals.css 가 컨테이너를 펼친다.
    if (inFrame) document.documentElement.setAttribute('data-embedded', '1');
    return () => { if (inFrame) document.documentElement.removeAttribute('data-embedded'); };
  }, []);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifUnread, setNotifUnread] = useState(0);

  // 최초 마운트 시 한 번만 등장 애니메이션, 탭 전환 시 재실행 안함
  useEffect(() => {
    const t = setTimeout(() => setNavMounted(true), 30);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const ua = window.navigator.userAgent || '';
    const platform = /Android/i.test(ua)
      ? 'android'
      : /iPhone|iPad|iPod/i.test(ua)
        ? 'ios'
        : 'web';
    document.documentElement.dataset.platform = platform;
  }, []);

  const [showLoginModal, setShowLoginModal] = useState(false);
  const lastScrollY = useRef(0);
  const authUser = useAuthStore((s) => s.user);
  const authHydrated = useAuthStore((s) => s.hasHydrated);
  const isPro = useMemo(() => authUser?.role === 'pro', [authUser?.role]);
  // 회사 정보 푸터 — 보이는지(모든 폭) / 모바일에서도 보이는지
  const footerShown = !hideNav && !isPro && !HIDE_FOOTER_PATTERNS.some((p) => p.test(pathname));
  const mobileFooterShown = footerShown && !MOBILE_HIDE_FOOTER_PATTERNS.some((p) => p.test(pathname));
  const [newRequestCount, setNewRequestCount] = useState(0);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);

  // 로그인이 필요한 ��이지 패턴
  const AUTH_REQUIRED = [/^\/chat/, /^\/my/, /^\/pro-/, /^\/inquiries/];
  const needsAuth = AUTH_REQUIRED.some(p => p.test(pathname));

  useEffect(() => {
    if (!authHydrated) return;
    const isLoggedIn = authUser !== null;
    if (!isLoggedIn && needsAuth) {
      rememberAuthReturnTo();
      if (requestNativeLoginSheet({ reason: 'auth-required', returnTo: pathname })) {
        setShowLoginModal(false);
        // 시트가 덮기 전 로그아웃 마이페이지가 깜빡이던 문제 — 선이동을 시트 표시 이후로 지연
        setTimeout(() => { try { router.replace('/main'); } catch {} }, 700);
      } else {
        setShowLoginModal(true);
      }
    } else {
      setShowLoginModal(false);
    }
    // 최신 프로필 동기화는 첫 화면을 막지 않도록 idle 이후에만 수행한다.
    let cancelProfileSync = () => {};
    if (isLoggedIn && authUser) {
      cancelProfileSync = queueIdleTask(() => {
        import('@/lib/api/users.api').then(({ usersApi }) => {
          usersApi.getProfile()
            .then((res: any) => {
              const fresh = res?.data || res;
              if (!fresh?.id) return;
              const changed = fresh.id !== authUser.id || fresh.email !== authUser.email;
              if (changed) useAuthStore.getState().setUser(fresh);
            })
            .catch(() => {});
        });
      }, 3500, 7000);
    }
    return cancelProfileSync;
  }, [pathname, needsAuth, authUser, authHydrated]);

  useEffect(() => {
    if (!authHydrated || !authUser || authUser.role !== 'pro') {
      setNewRequestCount(0);
      return;
    }

    let cancelled = false;
    const refresh = () => {
      import('@/lib/api/match.api').then(({ matchApi }) => matchApi.getProRequests({ limit: 20 }))
        .then((data: any) => {
          if (cancelled) return;
          const items = Array.isArray(data) ? data : (data?.data || []);
          // 새요청 페이지를 마지막으로 본 시각 이후에 도착한 요청만 카운트 → 페이지 확인 후엔 0(이후 신규만 다시 증가)
          let viewedAt = 0;
          try { viewedAt = Number(localStorage.getItem('freetiful-pro-inquiries-viewed-at')) || 0; } catch {}
          setNewRequestCount(items.filter((m: any) => {
            if (m.status !== 'pending' && m.status !== 'viewed') return false;
            if (!viewedAt) return true;
            const t = m.deliveredAt ? new Date(m.deliveredAt).getTime() : 0;
            return t > viewedAt;
          }).length);
        })
        .catch(() => {
          if (!cancelled) setNewRequestCount(0);
        });
      // 새요청 전체 목록도 앱 로드 시 미리 캐시에 데워둠 → 탭 진입 즉시 표시(콜드 지연 제거)
      import('@/lib/api/pro-requests-prefetch').then(({ prefetchProRequests }) => prefetchProRequests(authUser.id)).catch(() => {});
    };

    const cancelInitialRefresh = queueIdleTask(refresh, pathname.startsWith('/pro-dashboard') ? 0 : 600, 2000);
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    window.addEventListener('freetiful:match-requests-changed', refresh);
    window.addEventListener('freetiful:dashboard-updated', refresh as EventListener);
    window.addEventListener('freetiful:inquiries-viewed', refresh);   // 새요청 페이지 확인 시 즉시 0으로
    return () => {
      cancelled = true;
      cancelInitialRefresh();
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('freetiful:match-requests-changed', refresh);
      window.removeEventListener('freetiful:dashboard-updated', refresh as EventListener);
      window.removeEventListener('freetiful:inquiries-viewed', refresh);
    };
  }, [authHydrated, authUser?.id, authUser?.role]);

  // iOS 네이티브 하단 nav 뱃지 브리지 — 카운트 변화 시 노출 + 네이티브 갱신 트리거
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).__freetifulNavBadges = { requests: newRequestCount, chat: chatUnreadCount };
    (window as any).__freetifulNativeNavPostState?.();
  }, [newRequestCount, chatUnreadCount]);

  // 네이티브 헤더/버튼에서 SPA 라우팅 (홈 검색/알림 등)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).__freetifulNavigate = (path: string, replace?: boolean) => { try { if (replace) router.replace(path); else router.push(path); } catch {} };
    return () => { try { delete (window as any).__freetifulNavigate; } catch {} };
  }, [router]);

  // 네이티브 새요청 → 채팅 열기 (전역 폴백) — 새요청 페이지가 아직 마운트 안 됐어도 동작.
  // 기존엔 페이지의 __freetifulInquiryList.invokeChat 에만 의존 → 네이티브가 캐시/직접조회로
  // 먼저 그려진 상태에서 탭하면 브리지 부재로 조용히 무반응(채팅창 안 뜸)이던 버그 수정.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).__freetifulInquiryOpenChat = async (id: string): Promise<string> => {
      try {
        // 1) 새요청 페이지가 떠 있고 해당 요청을 들고 있으면 그쪽이 정확(상태/캐시 갱신) — 우선 사용
        const pageList = (window as any).__freetifulInquiryList;
        if (pageList?.invokeChat) {
          const items = (pageList.getItems?.() || []) as any[];
          if (!items.length || items.some((x) => x?.id === id)) {
            pageList.invokeChat(id);
            return 'page';
          }
          // 페이지는 떠 있지만 목록에 없음(페이지네이션/필터 차이) → 폴백으로 진행
        }
        // 2) 폴백 — 캐시 또는 서버에서 delivery 해석 → 방 생성 → 이동
        const uid = useAuthStore.getState().user?.id;
        let customerId = '';
        let matchRequestId: string | undefined;
        try {
          const raw = (uid && localStorage.getItem(`freetiful-pro-simple-requests-cache-v1:${uid}`))
            || localStorage.getItem('freetiful-pro-simple-requests-cache-v1');
          if (raw) {
            const parsed = JSON.parse(raw);
            const arr = Array.isArray(parsed?.data) ? parsed.data : (Array.isArray(parsed) ? parsed : []);
            const row = arr.find((x: any) => x?.id === id);
            if (row) { customerId = row.customerId || ''; matchRequestId = row.matchRequestId; }
          }
        } catch {}
        if (!customerId) {
          // 캐시 미스 — 서버에서 직접 조회
          const { matchApi } = await import('@/lib/api/match.api');
          const res: any = await matchApi.getProRequests({ limit: 100, skip: 0 });
          const items: any[] = Array.isArray(res) ? res : (res?.items || res?.data || res?.requests || []);
          const d = items.find((x: any) => x?.id === id);
          if (d) { customerId = d.matchRequest?.user?.id || ''; matchRequestId = d.matchRequestId; }
        }
        if (!customerId) return 'fail:요청 정보를 찾을 수 없습니다. 새로고침 후 다시 시도해주세요.';
        const { chatApi } = await import('@/lib/api/chat.api');
        const cr: any = await chatApi.createRoomAsPro(customerId, matchRequestId);
        const roomId = cr?.data?.id || cr?.id;
        if (!roomId) return 'fail:채팅방 생성에 실패했습니다.';
        window.dispatchEvent(new Event('freetiful:match-requests-changed'));
        router.push(`/chat/${roomId}`);
        return 'ok';
      } catch (e: any) {
        return 'fail:' + (e?.response?.data?.message || e?.message || '채팅 연결에 실패했습니다.');
      }
    };
    return () => { try { delete (window as any).__freetifulInquiryOpenChat; } catch {} };
  }, [router]);

  // 웨딩숲(커뮤니티) 첫 화면 미리 데우기 — 앱이 뜨고 한가할 때 그룹·최신 글을 받아 캐시에 넣어 둔다.
  // 하단 탭을 누르면 기다림 없이 목록이 뜬다(260926 사장 '웨딩숲 뜨는 거 너무 느림'). 계정이 바뀌면 다시.
  useEffect(() => {
    if (pathname.startsWith('/community')) return; // 이미 커뮤니티 화면이면 화면이 직접 받는다
    const cancel = queueIdleTask(() => {
      import('@/lib/community/prefetch').then(({ prefetchCommunity }) => prefetchCommunity()).catch(() => {});
    }, 1200, 4000);
    return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id]);

  // 외부 컴포넌트에서 로그인 모달을 열 수 있도록 커스텀 이벤트 수신
  useEffect(() => {
    const handler = () => {
      // 웨딩숲은 자기 레이아웃의 CommunityLoginSheet 가 같은 신호를 받는다(닫으면 그 자리에 남는 시트).
      // /community 가 (main) 아래로 들어오며 두 창이 한꺼번에 떴고, 이 창의 취소는 /main 으로 보내 버렸다.
      if (/^\/community(\/|$)/.test(window.location.pathname)) return;
      rememberAuthReturnTo();
      if (requestNativeLoginSheet({ reason: 'manual' })) return;
      setShowLoginModal(true);
    };
    window.addEventListener('freetiful:show-login', handler);
    return () => window.removeEventListener('freetiful:show-login', handler);
  }, []);

  // 로그인 시 채팅 관련 무거운 번들은 채팅 화면에서만 즉시 로드한다.
  // 안드로이드 WebView에서 사회자 페이지 첫 진입을 막지 않도록 나머지는 idle 이후로 지연.
  useEffect(() => {
    const loggedIn = authUser !== null;
    if (!loggedIn) { setChatUnreadCount(0); return; }

    let cancelled = false;
    let unsubUnread = () => {};
    const onChatRoute = pathname.startsWith('/chat');
    const onRealtimeRoute = onChatRoute || pathname.startsWith('/pro-dashboard');

    const loadChatStore = async (withRooms: boolean) => {
      const { useChatStore } = await import('@/lib/store/chat.store');
      if (cancelled) return;
      const chatState = useChatStore.getState();
      chatState.connect();
      if (withRooms && chatState.rooms.length === 0 && !chatState.roomsLoading) {
        chatState.fetchRooms();
      }
      // 하단 탭 채팅 미읽음 뱃지 동기화 (룸 캐시 + 소켓 라이브 갱신)
      const computeUnread = () => {
        const rooms = useChatStore.getState().rooms;
        const total = rooms.reduce((sum, r) => sum + (r.unreadCount || 0), 0);
        setChatUnreadCount(total);
      };
      computeUnread();
      unsubUnread = useChatStore.subscribe(computeUnread);
    };

    let cancelChat = () => {};
    if (onRealtimeRoute) {
      loadChatStore(onChatRoute);
    } else {
      // Android WebView는 socket handshake가 늦게 시작되면 채팅 진입 후 첫 수신이 크게 밀린다.
      // 룸 조회는 채팅 화면에서만 하고, 소켓 연결만 아주 일찍 열어둔다.
      const isAndroid = document.documentElement.dataset.platform === 'android';
      cancelChat = queueIdleTask(() => { loadChatStore(false); }, isAndroid ? 120 : 900, isAndroid ? 1500 : 4000);
    }

    const cancelNotifications = queueIdleTask(() => {
      import('@/lib/api/notification.api').then(({ notificationApi }) => {
        if (!cancelled) notificationApi.prefetch();
      });
    }, pathname.startsWith('/pro-dashboard') ? 5500 : 3000, 9000);

    return () => {
      cancelled = true;
      unsubUnread();
      cancelChat();
      cancelNotifications();
    };
  }, [authUser?.id, pathname]);

  const NAV_ITEMS = isPro ? PRO_NAV_ITEMS : USER_NAV_ITEMS;
  const homeHref = '/main';

  useEffect(() => {
    const sync = () => setNotifUnread(getCachedUnreadCount());
    sync();
    window.addEventListener('freetiful:notifications-changed', sync);
    return () => window.removeEventListener('freetiful:notifications-changed', sync);
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY;
      // 홈 히어로의 카테고리 줄이 헤더 밑으로 지나간 뒤에 붙인다(왔다갔다 방지용 히스테리시스)
      setCategoryDocked((prev) => (prev ? currentY > 420 : currentY > 520));
      if (currentY > lastScrollY.current && currentY > 80) {
        setNavVisible(false);
      } else {
        setNavVisible(true);
      }
      lastScrollY.current = currentY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className={`min-h-screen ${whiteBackground ? 'bg-white' : chatRoute || requestListRoute ? 'bg-white lg:bg-surface-50' : myRoute ? 'bg-[#F4F6FA] lg:bg-surface-50' : 'bg-surface-50'}`}>
      {/* 빌라드지디 이벤트 — 앱 초기 진입 시 1회 노출(X로 닫기) */}
      {!embedded && <VilladegdEventOverlay />}
      {/* ─── Desktop Top Navigation (Glass → Pill on scroll) ─────────── */}
      <header className={`${hideNav || communityRoute ? 'hidden' : 'hidden lg:block'} sticky top-0 z-50 bg-white border-b border-gray-100`}>
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-8">
          <Link href={homeHref} className="flex items-center" aria-label="Freetiful 홈">
            <Image
              src="/images/logo-freetiful-wordmark.svg"
              alt="Freetiful"
              width={118}
              height={35}
              priority
              className="h-[26px] w-auto"
            />
          </Link>

          {/* 세그먼트 네비 — 회색 트랙 위에서 흰 알약이 탭 사이를 미끄러진다(제이씨랩 톤) */}
          <LayoutGroup id="pc-nav">
            <nav className="flex items-center gap-1 rounded-[14px] bg-[#F2F3F5] p-1">
              {NAV_ITEMS.map(({ href, label }) => {
                const active = pathname === href || (href !== homeHref && pathname.startsWith(href));
                const badge = label === '새요청' ? newRequestCount : label === '채팅' ? chatUnreadCount : 0;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`relative flex items-center gap-1.5 rounded-[13px] px-4 py-1.5 text-[13px] transition-colors duration-200 ${
                      active ? 'font-bold text-[#2B313D]' : 'font-semibold text-[#A4ABBA] hover:text-[#2B313D]'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="pc-nav-pill"
                        className="absolute inset-0 rounded-[13px] bg-white shadow-sm"
                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                      />
                    )}
                    <span className="relative">{label}</span>
                    {badge > 0 && (
                      <span className="relative min-w-[18px] h-[18px] rounded-full bg-[#3180F7] px-1 text-[10px] font-bold leading-[18px] text-white text-center">
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </LayoutGroup>

          <button
            type="button"
            onClick={() => setNotifOpen(true)}
            aria-label="알림 열기"
            className="relative flex items-center gap-1.5 rounded-[14px] bg-[#2B313D] px-4 py-2 text-[13px] font-bold text-white transition-all hover:bg-[#3A414F] active:scale-95"
          >
            <AlarmIcon size={16} />
            알림
            {notifUnread > 0 && (
              <span className="min-w-[18px] rounded-full bg-[#3180F7] px-1 text-[10px] font-bold leading-[18px] text-white">
                {notifUnread > 99 ? '99+' : notifUnread}
              </span>
            )}
          </button>
        </div>

        {/* 스크롤을 내리면 홈 카테고리가 헤더에 이어붙는다 */}
        {isHome && (
          <div
            className={`overflow-hidden border-t border-gray-100 transition-all duration-500 ease-out ${
              categoryDocked ? 'max-h-[64px] opacity-100' : 'max-h-0 border-t-transparent opacity-0'
            }`}
          >
            {/* 오른쪽 끝에서 칩이 잘려 보이지 않도록 페이드로 마감한다 */}
            <div
              className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-8 py-2 scrollbar-hide"
              style={{
                maskImage: 'linear-gradient(to right, #000 calc(100% - 56px), transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to right, #000 calc(100% - 56px), transparent 100%)',
              }}
            >
              {HEADER_CATEGORIES.map((c) => (
                <Link
                  key={c.name}
                  href={c.href}
                  className="flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold text-[#51535C] transition-colors hover:bg-[#F2F3F5] hover:text-[#2B313D]"
                >
                  <img src={c.img} alt="" className="h-6 w-6 shrink-0 rounded-full object-contain" />
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* PC 알림 서랍 — 화면 전환 없이 오른쪽만 덮는다.
          iframe 안에서는 띄우지 않는다: 닫혀 있어도 오른쪽 밖에 서 있는 서랍의
          왼쪽 그림자(-12px/40px blur)가 칸 안으로 번져 세로 그림자처럼 보인다. */}
      {!embedded && <NotificationDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />}

      {/* ─── Content ─────────────────────────────────────────────────── */}
      {/* 모바일에서 회사 정보 푸터가 보이는 화면은 푸터가 아래 탭바 자리(여백+끝 흰색 그라데이션)를 맡는다 → 본문 아래 여백은 조금만
          (예전 pb-24 가 푸터 위에 흰 빈칸 96px 을 더 만들었다, 260926) */}
      <main className={`${communityRoute ? '' : 'lg:max-w-7xl lg:mx-auto lg:px-8'} ${hideNav ? '' : communityRoute ? 'pb-24 lg:pb-0' : mobileFooterShown ? 'pb-4 lg:pb-12' : 'pb-24 lg:pb-12'}`}>
        <div className="lg:max-w-none">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>

      {/* ─── Footer ────────────────────────────────────────────────── */}
      {footerShown && (
        MOBILE_HIDE_FOOTER_PATTERNS.some((p) => p.test(pathname))
          ? <div className="hidden lg:block"><Footer /></div>
          : <Footer />
      )}

      {/* ─── Mobile Bottom Navigation — 토스 하단바(사장 레퍼런스 260926) ─────────
          흰 바 · 위쪽만 둥근 모서리(24) · 위 가는 선 · 평소 선 아이콘/선택 채운 아이콘 · 라벨 12px.
          안 읽은 채팅·새 요청은 숫자 대신 빨간 점. 스크롤 내리면 아래로 숨고 올리면 다시 나온다.
          iOS 앱은 네이티브 탭바를 쓰므로 data-ios-mobile-bottom-nav 로 이 바를 숨긴다.
          ⚠ 앱의 탭바는 이 표시가 있는 화면에서만 나타난다(260927 웹 전용 iOS 앱) — 표시를 지우거나 바꾸면 앱 탭바가 사라진다. */}
      {!hideNav && (
        <nav
          data-ios-mobile-bottom-nav
          className="lg:hidden fixed inset-x-0 bottom-0 z-50"
          style={{
            transform: navMounted && navVisible ? 'translateY(0)' : 'translateY(110%)',
            transition: 'transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <div
            data-nav-pill
            className="mx-auto max-w-[640px] rounded-t-[24px] bg-white pb-safe"
            style={{ boxShadow: '0 0 0 0.5px #E4E4E7, 0 -2px 12px rgba(0, 0, 0, 0.03)' }}
          >
            <div className="flex h-[58px] items-stretch px-3">
              {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
                const active = pathname === href || (href !== homeHref && pathname.startsWith(href));
                const dot = (label === '새요청' && newRequestCount > 0) || (label === '채팅' && chatUnreadCount > 0);
                return (
                  <Link
                    key={href}
                    href={href}
                    data-nav={label}
                    aria-current={active ? 'page' : undefined}
                    className="flex flex-1 flex-col items-center justify-center gap-[4px] text-[#4E5968]"
                    onPointerDown={(e) => {
                      // 누르는 순간 아이콘이 옆으로 쫀득하게 늘어났다 출렁이며 제자리(사장 지시 260926) — 같은 탭을 다시 눌러도 처음부터
                      const icon = e.currentTarget.querySelector<HTMLElement>('[data-tab-icon]');
                      if (!icon || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
                      icon.style.animation = 'none';
                      void icon.offsetWidth;
                      icon.style.animation = 'tabJelly 0.64s linear both';
                    }}
                  >
                    <span data-tab-icon className="relative block h-[26px] w-[26px]" style={{ transformOrigin: '50% 60%' }}>
                      <Icon active={active} className="h-[26px] w-[26px]" />
                      {dot && (
                        <span
                          aria-label="새 알림"
                          className="absolute -right-[4px] top-0 h-[6px] w-[6px] rounded-full bg-[#F04452]"
                        />
                      )}
                    </span>
                    <span className={`text-[11px] leading-[13px] tracking-[-0.2px] text-[#4E5968] ${active ? 'font-semibold' : 'font-medium'}`}>
                      {label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
          <style>{`
            /* 탭 누름 — 가로로 1.3배 늘며 세로는 눌렸다가, 반대로 한 번·또 한 번 작게 출렁이고 멈춘다(쫀득) */
            @keyframes tabJelly {
              0%   { transform: scale(1, 1); }
              22%  { transform: scale(1.3, 0.82); }
              40%  { transform: scale(0.88, 1.1); }
              56%  { transform: scale(1.1, 0.95); }
              70%  { transform: scale(0.96, 1.03); }
              84%  { transform: scale(1.02, 0.99); }
              100% { transform: scale(1, 1); }
            }
          `}</style>
        </nav>
      )}
      {/* Login Modal — 공통 모달(웨딩숲 톤 · 버튼 56/17/17), 하단 안전영역은 ft-sheet 가 처리 */}
      {showLoginModal && (
        <div className="ft-scrim" onClick={() => { setShowLoginModal(false); router.push('/main'); }}>
          <div
            className="ft-sheet"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ft-grab" aria-hidden="true" />
            <Image src="/images/logo-freetiful-wordmark.svg" alt="Freetiful" width={137} height={40} priority className="mx-auto mb-1.5 animate-[loginItemUp_0.4s_ease_0.05s_both]" style={{ height: 40, width: 'auto' }} />
            <p className="ft-desc text-center animate-[loginItemUp_0.4s_ease_0.1s_both]">나의 특별한 행사를 완성하는 사회자</p>
            {/* 세로 줄 버튼은 flex:1 이면 56px 이 눌려 납작해짐 → flex-none */}
            <div className="ft-actions col [&>.ft-btn]:flex-none">
              {[
                { provider: 'kakao', label: '카카오로 시작하기', brand: { background: '#FEE500', color: '#191919' }, icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M9 0C4.03 0 0 3.19 0 7.13c0 2.52 1.67 4.74 4.19 6.01L3.1 17.2a.3.3 0 0 0 .46.32L8.4 14a10.7 10.7 0 0 0 .6.02C13.97 14.02 18 10.83 18 6.89 18 2.94 13.97 0 9 0z" fill="#191919"/></svg>, delay: '0.15s' },
                { provider: 'naver', label: '네이버로 시작하기', brand: { background: '#03C75A', color: '#fff' }, icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M12.16 9.57L5.56 0H0v18h5.84V8.43L12.44 18H18V0h-5.84v9.57z" fill="white"/></svg>, delay: '0.2s' },
              ].map(({ provider, label, brand, icon, delay }) => (
                <button
                  key={provider}
                  onClick={() => {
                    setShowLoginModal(false);
                    rememberAuthReturnTo();
                    startOAuth(provider as 'kakao' | 'naver' | 'google');
                  }}
                  // 등장 애니는 backwards — 끝나면 빠져서 ft-btn 눌림(scale) 이 산다
                  className="ft-btn animate-[loginItemUp_0.4s_cubic-bezier(0.16,1,0.3,1)_backwards]"
                  style={{ ...brand, animationDelay: delay }}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
            {/* 비회원 로그인 — 랜딩에서 견적만 신청한 고객(소셜 계정 없음)용 */}
            <div className="mt-3 animate-[loginItemUp_0.4s_ease_0.28s_both]">
              <GuestLoginForm onSuccess={() => { setShowLoginModal(false); router.refresh(); }} />
            </div>

            <button onClick={() => { setShowLoginModal(false); router.push('/main'); }} className="ft-btn secondary mt-2 w-full animate-[loginItemUp_0.4s_ease_0.35s_backwards]">
              취소
            </button>
          </div>
          <style>{`
            @keyframes loginItemUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
          `}</style>
        </div>
      )}
    </div>
  );
}
