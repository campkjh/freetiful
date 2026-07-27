'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import Footer from '@/components/Footer';
import PageTransition from '@/components/PageTransition';
import { useAuthStore } from '@/lib/store/auth.store';
import { rememberAuthReturnTo, startOAuth } from '@/lib/auth/oauth';
import { requestNativeLoginSheet } from '@/lib/auth/native-login';
import VilladegdEventOverlay from '@/components/VilladegdEventOverlay';

type NavIconProps = { className?: string };

const HomeNavIcon = ({ className }: NavIconProps) => (
  <svg width="24" height="24" viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
    <path fillRule="evenodd" clipRule="evenodd" d="M28.0924 10.9387L16.8297 1.98268C16.5941 1.79489 16.3017 1.69263 16.0004 1.69263C15.6991 1.69263 15.4067 1.79489 15.1711 1.98268L3.90706 10.9387C3.59312 11.1884 3.33957 11.5057 3.16528 11.867C2.99098 12.2283 2.90044 12.6242 2.90039 13.0253V25.5827C2.90039 26.4314 3.23753 27.2453 3.83765 27.8454C4.43777 28.4455 5.2517 28.7827 6.10039 28.7827H13.3337V22.4467C13.3337 22.0931 13.4742 21.7539 13.7242 21.5039C13.9743 21.2538 14.3134 21.1133 14.6671 21.1133H17.3337C17.6873 21.1133 18.0265 21.2538 18.2765 21.5039C18.5266 21.7539 18.6671 22.0931 18.6671 22.4467V28.7827H25.8991C26.7478 28.7827 27.5617 28.4455 28.1618 27.8454C28.7619 27.2453 29.0991 26.4314 29.0991 25.5827V13.0267C29.099 12.6255 29.0085 12.2296 28.8342 11.8683C28.6599 11.507 28.4063 11.1884 28.0924 10.9387Z" fill="currentColor" />
  </svg>
);

const BizNavIcon = ({ className }: NavIconProps) => (
  <svg width="24" height="24" viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
    <path d="M27.9065 7.91995L17.3865 1.97328C16.5332 1.49328 15.4798 1.49328 14.6265 1.97328L4.09317 7.91995C3.21317 8.41328 2.6665 9.34661 2.6665 10.3599V26.6533C2.6665 28.1999 3.91984 29.4666 5.47984 29.4666H26.5332C28.0798 29.4666 29.3465 28.2133 29.3465 26.6533V10.3599C29.3332 9.34661 28.7865 8.41328 27.9065 7.91995ZM16.9732 24.12H12.2532C11.9172 24.12 11.595 23.9865 11.3575 23.749C11.12 23.5114 10.9865 23.1892 10.9865 22.8533V10.7333C10.9865 10.0266 11.5598 9.46661 12.2532 9.46661H16.3732C19.6132 9.46661 21.5465 10.8399 21.5465 13.3199C21.5465 14.7333 20.5865 16.1466 18.8265 16.4666C20.8932 16.7066 22.1332 18.1199 22.1332 19.9466C22.1332 22.5866 20.3198 24.12 16.9732 24.12Z" fill="currentColor" />
    <path d="M16.8666 17.9333H14.1333V21.5867H16.8666C18.2666 21.5867 18.9466 20.8 18.9466 19.76C18.9466 18.72 18.2933 17.9333 16.8666 17.9333ZM18.36 13.6667C18.36 12.6 17.6266 12 16.2533 12H14.1333V15.4H16.2533C17.68 15.4 18.36 14.7067 18.36 13.6667Z" fill="currentColor" />
  </svg>
);

const ChatNavIcon = ({ className }: NavIconProps) => (
  <svg width="24" height="24" viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
    <path d="M16.0001 2.66663C8.57078 2.66663 2.55078 8.17463 2.55078 14.8346C2.55078 18.0373 3.96011 20.9826 6.26545 23.16L5.11211 28.54C4.98411 29.052 5.49611 29.436 6.00811 29.308L12.0281 26.4906C13.3094 26.8746 14.5894 27.0026 15.9988 27.0026C23.4281 27.0026 29.4481 21.4946 29.4481 14.8346C29.4481 8.17463 23.4294 2.66663 16.0001 2.66663Z" fill="currentColor" />
  </svg>
);

const NewRequestNavIcon = ({ className }: NavIconProps) => (
  <svg width="24" height="24" viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
    <path d="M28.4798 9.19998C27.1998 8.87998 25.9198 9.59998 25.5198 10.88L23.9998 14.4L22.3998 11.6L17.9998 3.43998C17.4398 2.39998 16.2398 1.99998 15.1998 2.55998C14.1598 3.11998 13.8398 4.31998 14.3998 5.35998L18.1598 12.4L17.2798 12.88L12.3998 5.03998C11.7598 4.07998 10.4798 3.75998 9.59981 4.31998C8.63981 4.87998 8.39981 6.15998 8.95981 7.19998L13.7598 14.96L13.1198 15.6L7.99981 9.59998C7.27981 8.71998 5.99981 8.63998 5.11981 9.35998C4.23981 10.08 4.15981 11.36 4.87981 12.24L10.1598 18.56L9.35981 19.36L5.27981 15.12C4.47981 14.32 3.19981 14.24 2.31981 15.04C1.43981 15.84 1.51981 17.12 2.31981 18L9.99981 26C13.0398 29.84 18.4798 31.04 22.7998 28.48C25.1998 27.12 26.7998 24.88 27.4398 22.4L30.1598 12.24C30.5598 10.88 29.7598 9.59998 28.4798 9.19998ZM20.5598 21.84L20.0798 21.04C19.1998 19.52 19.7598 17.52 21.2798 16.64L23.1198 15.52C21.8398 17.44 20.9598 19.6 20.5598 21.84Z" fill="currentColor" />
  </svg>
);

const MyNavIcon = ({ className }: NavIconProps) => (
  <svg width="24" height="24" viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
    <path fillRule="evenodd" clipRule="evenodd" d="M16.0002 23.252C12.4482 23.252 9.48416 21.1706 8.80683 18.4053C8.65483 17.7813 9.25616 17.2026 10.0295 17.2026H21.9708C22.7442 17.2026 23.3455 17.7813 23.1935 18.4053C22.5162 21.1706 19.5522 23.252 16.0002 23.252ZM12.3815 10.1C12.9049 10.0996 13.4069 10.3072 13.7772 10.677C14.1476 11.0468 14.3558 11.5486 14.3562 12.072C14.3565 12.5953 14.149 13.0974 13.7791 13.4677C13.4093 13.838 12.9075 14.0463 12.3842 14.0466C12.125 14.0468 11.8684 13.9959 11.6289 13.8969C11.3894 13.7979 11.1718 13.6527 10.9884 13.4696C10.6181 13.0998 10.4099 12.598 10.4095 12.0746C10.4091 11.5513 10.6167 11.0492 10.9865 10.6789C11.3564 10.3086 11.8581 10.1003 12.3815 10.1ZM19.8948 10.1C20.1599 10.09 20.4242 10.1337 20.6721 10.2282C20.9199 10.3227 21.1461 10.4663 21.3372 10.6502C21.5283 10.8342 21.6803 11.0548 21.7843 11.2988C21.8882 11.5429 21.9418 11.8053 21.942 12.0706C21.9422 12.3358 21.8889 12.5984 21.7853 12.8426C21.6817 13.0868 21.53 13.3076 21.3391 13.4918C21.1483 13.676 20.9222 13.8198 20.6745 13.9147C20.4269 14.0096 20.1626 14.0535 19.8975 14.044C19.387 14.0255 18.9036 13.8099 18.5488 13.4424C18.1941 13.0748 17.9957 12.5841 17.9953 12.0733C17.995 11.5625 18.1927 11.0714 18.547 10.7034C18.9012 10.3354 19.3844 10.1191 19.8948 10.1ZM16.0002 1.30664C7.90016 1.30664 1.3335 7.87197 1.3335 15.9733C1.3335 24.0733 7.90016 30.64 16.0002 30.64C24.1002 30.64 30.6668 24.0733 30.6668 15.9733C30.6668 7.87197 24.1002 1.30664 16.0002 1.30664Z" fill="currentColor" />
  </svg>
);

const USER_NAV_ITEMS = [
  { href: '/main',      icon: HomeNavIcon,      label: '홈' },
  { href: '/biz',       icon: BizNavIcon,       label: 'Biz' },
  { href: '/inquiries', icon: NewRequestNavIcon, label: '문의목록' },
  { href: '/chat',      icon: ChatNavIcon,      label: '채팅' },
  { href: '/my',        icon: MyNavIcon,        label: '마이' },
];

const PRO_NAV_ITEMS = [
  { href: '/main',      icon: HomeNavIcon,       label: '홈' },
  { href: '/biz',       icon: BizNavIcon,        label: 'Biz' },
  { href: '/pro-dashboard/inquiries', icon: NewRequestNavIcon, label: '새요청' },
  { href: '/chat',      icon: ChatNavIcon,       label: '채팅' },
  { href: '/my',        icon: MyNavIcon,         label: '마이' },
];

const HIDE_NAV_PATTERNS = [
  /^\/chat\/.+/,
  /^\/pros\/.+/,
  /^\/businesses\/.+/,
  /^\/my\/.+/,
  /^\/notifications/,
  /^\/pro-register/,
  /^\/pros$/,
  /^\/businesses$/,
  /^\/biz/,
  /^\/careers$/,
  /^\/search/,
];

const HIDE_FOOTER_PATTERNS = [
  /^\/chat$/,
  /^\/my$/,
  /^\/pro-dashboard/,
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
  const router = useRouter();
  const hideNav = HIDE_NAV_PATTERNS.some((p) => p.test(pathname));
  const [navVisible, setNavVisible] = useState(true);
  const [navMounted, setNavMounted] = useState(false); // 초기 등장 애니메이션 (한 번만)
  const [navExpanding, setNavExpanding] = useState(false);
  const [bizCollapsing, setBizCollapsing] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);

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
  // 비회원 로그인 — 랜딩(견적 신청)으로만 가입해 소셜 계정이 없는 고객용
  const [guestMode, setGuestMode] = useState(false);
  const [guestPhone, setGuestPhone] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestBusy, setGuestBusy] = useState(false);
  const [guestError, setGuestError] = useState('');

  const submitGuestLogin = async () => {
    if (guestBusy) return;
    setGuestError('');
    if (!guestPhone.replace(/[^0-9]/g, '') || !guestName.trim()) {
      setGuestError('전화번호와 이름을 모두 입력해주세요');
      return;
    }
    setGuestBusy(true);
    try {
      const res = await fetch('/api/v1/auth/login/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: guestPhone, name: guestName, platform: 'web' }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setGuestError(data?.message || '전화번호 또는 이름이 일치하지 않습니다');
        return;
      }
      useAuthStore.getState().setAuth(data.user, data.accessToken, data.refreshToken);
      setShowLoginModal(false);
      setGuestMode(false);
      setGuestPhone(''); setGuestName('');
      router.refresh();
    } catch {
      setGuestError('로그인에 실패했습니다. 잠시 후 다시 시도해주세요');
    } finally {
      setGuestBusy(false);
    }
  };
  const lastScrollY = useRef(0);
  const authUser = useAuthStore((s) => s.user);
  const authHydrated = useAuthStore((s) => s.hasHydrated);
  const isPro = useMemo(() => authUser?.role === 'pro', [authUser?.role]);
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

  // 외부 컴포넌트에서 로그인 모달을 열 수 있도록 커스텀 이벤트 수신
  useEffect(() => {
    const handler = () => {
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
  const activeNavIndex = Math.max(
    0,
    NAV_ITEMS.findIndex(({ href }) => pathname === href || (href !== homeHref && pathname.startsWith(href))),
  );

  // pathname 변경 시 collapsing 리셋
  useEffect(() => {
    setBizCollapsing(false);
  }, [pathname]);

  // 비즈에서 돌아왔을 때 펼쳐지는 애니메이션
  useEffect(() => {
    if (hideNav) return;
    const from = sessionStorage.getItem('nav-transition');
    if (from === 'from-biz') {
      setNavExpanding(true);
      sessionStorage.removeItem('nav-transition');
      const t = setTimeout(() => setNavExpanding(false), 700);
      return () => clearTimeout(t);
    }
  }, [pathname, hideNav]);

  useEffect(() => {
    const onScroll = () => {
      const currentY = window.scrollY;
      setHeaderScrolled(currentY > 12);
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
    <div className="min-h-screen bg-surface-50">
      {/* 빌라드지디 이벤트 — 앱 초기 진입 시 1회 노출(X로 닫기) */}
      <VilladegdEventOverlay />
      {/* ─── Desktop Top Navigation (Glass → Pill on scroll) ─────────── */}
      <header className={`${hideNav ? 'hidden' : 'hidden lg:block'} sticky top-0 z-50`}>
        <div
          className={`mx-auto h-[72px] flex items-center justify-between transition-all duration-500 ease-out ${
            headerScrolled
              ? 'max-w-[760px] mt-2 px-6 rounded-full backdrop-blur-xl bg-white/75 shadow-[0_12px_40px_rgba(15,23,42,0.10)] border border-gray-200/60'
              : 'max-w-7xl px-8 bg-white/80 backdrop-blur-xl border-b border-gray-100'
          }`}
        >
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

          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
              const active = pathname === href || (href !== homeHref && pathname.startsWith(href));
              const badge = label === '새요청' ? newRequestCount : label === '채팅' ? chatUnreadCount : 0;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative flex items-center gap-2.5 px-5 py-2.5 rounded-full text-[14px] font-medium ${
                    active
                      ? 'text-gray-900 bg-gray-100/80 font-bold'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-surface-100/80'
                  }`}
                  style={{ transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
                >
                  <Icon className={`h-5 w-5 shrink-0 ${active ? 'opacity-100' : 'opacity-60'}`} />
                  {label}
                  {badge > 0 && (
                    <span className="min-w-[18px] h-[18px] rounded-full bg-[#3180F7] px-1 text-[10px] font-bold leading-[18px] text-white text-center">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* ─── Content ─────────────────────────────────────────────────── */}
      <main className={`lg:max-w-7xl lg:mx-auto lg:px-8 ${hideNav ? '' : 'pb-24 lg:pb-12'}`}>
        <div className="lg:max-w-none">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>

      {/* ─── Footer ────────────────────────────────────────────────── */}
      {!hideNav && !isPro && !HIDE_FOOTER_PATTERNS.some((p) => p.test(pathname)) && <Footer />}

      {/* ─── Mobile Bottom Nav Gradient Blur ───────────────────── */}
      {!hideNav && (
        <div
          data-ios-mobile-bottom-nav-blur
          className="lg:hidden fixed left-0 right-0 bottom-0 h-20 z-40 pointer-events-none"
          style={{
            background: 'linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0.8) 50%, rgba(255,255,255,0) 100%)',
          }}
        />
      )}

      {/* ─── Mobile Bottom Navigation (Glass Pill) ───────────────────── */}
      {!hideNav && (
        <nav
          data-ios-mobile-bottom-nav
          className="lg:hidden fixed left-0 right-0 z-50 px-4 pb-safe"
          style={{
            bottom: navMounted && navVisible ? 0 : -80,
            transform: navMounted && navVisible ? 'scale(1) translateY(0)' : 'scale(0.88) translateY(8px)',
            opacity: navMounted && navVisible ? 1 : 0,
            transition: 'bottom 0.42s cubic-bezier(0.34, 1.2, 0.64, 1), transform 0.42s cubic-bezier(0.34, 1.2, 0.64, 1), opacity 0.25s ease',
          }}
        >
          <div
            className="mx-auto mb-1"
            style={{ display: 'flex', justifyContent: 'center', width: '100%', maxWidth: 512 }}
          >
            <div
              data-nav-pill
              className="glass-strong shadow-nav"
              style={{
                width: bizCollapsing ? 60 : '100%',
                height: 66,
                borderRadius: 9999,
                // 평소엔 visible — press 시 fill 알약이 네비바보다 더 크게 넘쳐 보이도록.
                // biz 접힘 애니메이션 때만 hidden(아이콘 클리핑).
                overflow: bizCollapsing ? 'hidden' : 'visible',
                transition: bizCollapsing
                  ? 'width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
                  : 'none',
                ...(navExpanding ? { animation: 'platformPillExpand 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' } : {}),
              }}
            >
              <div className={`relative flex items-center h-full ${bizCollapsing ? 'overflow-hidden' : 'overflow-visible'} px-[8px] py-[3px]`}>
                <span
                  data-fill-pill
                  aria-hidden="true"
                  className="pointer-events-none absolute top-[6px] bottom-[6px] rounded-full shadow-[0_8px_22px_rgba(15,23,42,0.08)]"
                  style={{
                    left: `calc(8px + ${activeNavIndex} * ((100% - 16px) / ${NAV_ITEMS.length}))`,
                    width: `calc((100% - 16px) / ${NAV_ITEMS.length})`,
                    backgroundColor: 'rgba(15, 23, 42, 0.07)',
                    border: '0.4px solid transparent',
                    boxSizing: 'border-box',
                    transformOrigin: 'center',
                    transition: 'left 0.34s cubic-bezier(0.16, 1, 0.3, 1), width 0.34s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
                <div className="flex-1 flex items-center justify-around">
                {NAV_ITEMS.map(({ href, icon: Icon, label }, idx) => {
                  const active = pathname === href || (href !== homeHref && pathname.startsWith(href));
                  const isBiz = href === '/biz';
                  const badge = label === '새요청' ? newRequestCount : label === '채팅' ? chatUnreadCount : 0;
                  const itemStyle: CSSProperties = {
                    opacity: bizCollapsing ? 0 : 1,
                    transform: bizCollapsing ? 'scale(0.5)' : 'scale(1)',
                    transition: bizCollapsing
                      ? `opacity 0.2s ease ${idx * 0.03}s, transform 0.2s ease ${idx * 0.03}s`
                      : 'opacity 0.28s ease, transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), color 0.2s ease',
                    ...(navExpanding ? { animation: `platformIconAppear 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${0.25 + idx * 0.06}s both` } : {}),
                  };
                  return (
                    <Link
                      key={href}
                      href={href}
                      data-nav={label}
                      className={`relative z-10 flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-2xl ${
                        active ? 'text-gray-900' : 'text-gray-400'
                      }`}
                      style={itemStyle}
                      onClick={(event) => {
                        if (isBiz) {
                          event.preventDefault();
                          sessionStorage.setItem('nav-transition', 'from-platform');
                          setBizCollapsing(false);
                          router.push('/biz');
                          return;
                        }
                        // press 피드백: 네비바 크기는 그대로, fill 알약만 살짝 더 크게 스케일업
                        // (배경 5% + 0.4px 보더) 바운스 후 복귀. 슬라이드(left) 애니메이션은 유지.
                        const fillPill = document.querySelector('[data-fill-pill]') as HTMLElement;
                        if (fillPill) {
                          fillPill.style.animation = 'none';
                          void fillPill.offsetHeight;
                          fillPill.style.animation = 'pillPress 0.52s cubic-bezier(0.34, 1.56, 0.64, 1)';
                        }
                      }}
                    >
                      <Icon className={`h-6 w-6 shrink-0 ${active ? 'opacity-100' : 'opacity-60'}`} />
                      {badge > 0 && (
                        <span className="absolute right-1 top-0 min-w-[16px] h-[16px] rounded-full bg-[#3180F7] px-1 text-[9px] font-bold leading-[16px] text-white text-center shadow-sm">
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                      <span className={`text-[9px] ${active ? 'font-bold' : 'font-medium'}`}>{label}</span>
                    </Link>
                  );
                })}
                </div>
              </div>
            </div>
          </div>

          {/* Nav transition keyframes */}
          <style>{`
            @keyframes platformPillExpand {
              0% { width: 60px; }
              70% { width: 105%; }
              100% { width: 100%; }
            }
            @keyframes platformIconAppear {
              0% { opacity: 0; transform: scale(0.3) translateY(4px); }
              60% { opacity: 1; transform: scale(1.06) translateY(-1px); }
              100% { opacity: 1; transform: scale(1) translateY(0); }
            }
            /* press 시 fill 알약: 네비바보다 살짝 크게 스케일업 + 배경 5% + 0.4px 보더, 바운스 후 복귀 */
            @keyframes pillPress {
              0%   { transform: scale(1);   background-color: rgba(15,23,42,0.07); border-color: rgba(15,23,42,0); }
              45%  { transform: scale(1.4); background-color: rgba(15,23,42,0.02); border-color: rgba(15,23,42,0.18); }
              100% { transform: scale(1);   background-color: rgba(15,23,42,0.07); border-color: rgba(15,23,42,0); }
            }
          `}</style>
        </nav>
      )}
      {/* Login Modal — iOS NativeLoginView 디자인 통일 (Android safe-area 보정) */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center animate-[loginFadeIn_0.25s_ease]" onClick={() => { setShowLoginModal(false); router.push('/main'); }}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white w-full max-w-md rounded-t-3xl px-6 pt-5 animate-[loginSlideUp_0.35s_cubic-bezier(0.16,1,0.3,1)]"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-6" />
            <Image src="/images/logo-freetiful-wordmark.svg" alt="Freetiful" width={137} height={40} priority className="mx-auto mb-1.5 animate-[loginItemUp_0.4s_ease_0.05s_both]" style={{ height: 40, width: 'auto' }} />
            <p className="text-[13px] text-gray-500 text-center mb-7 animate-[loginItemUp_0.4s_ease_0.1s_both]">나의 특별한 행사를 완성하는 사회자</p>
            <div className="space-y-2.5">
              {[
                { provider: 'kakao', label: '카카오로 시작하기', cls: 'bg-[#FEE500] text-[#191919]', icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M9 0C4.03 0 0 3.19 0 7.13c0 2.52 1.67 4.74 4.19 6.01L3.1 17.2a.3.3 0 0 0 .46.32L8.4 14a10.7 10.7 0 0 0 .6.02C13.97 14.02 18 10.83 18 6.89 18 2.94 13.97 0 9 0z" fill="#191919"/></svg>, delay: '0.15s' },
                { provider: 'naver', label: '네이버로 시작하기', cls: 'bg-[#03C75A] text-white', icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M12.16 9.57L5.56 0H0v18h5.84V8.43L12.44 18H18V0h-5.84v9.57z" fill="white"/></svg>, delay: '0.2s' },
              ].map(({ provider, label, cls, icon, delay }) => (
                <button
                  key={provider}
                  onClick={() => {
                    setShowLoginModal(false);
                    rememberAuthReturnTo();
                    startOAuth(provider as 'kakao' | 'naver' | 'google');
                  }}
                  className={`w-full flex items-center justify-center gap-3 ${cls} font-bold py-3.5 rounded-2xl active:scale-[0.96] transition-transform animate-[loginItemUp_0.4s_cubic-bezier(0.16,1,0.3,1)_both]`}
                  style={{ animationDelay: delay }}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
            {/* 비회원 로그인 — 랜딩에서 견적만 신청한 고객(소셜 계정 없음)용 */}
            {!guestMode ? (
              <button
                onClick={() => { setGuestMode(true); setGuestError(''); }}
                className="mt-3 w-full py-3 text-center text-[14px] font-semibold text-gray-500 underline underline-offset-4 animate-[loginItemUp_0.4s_ease_0.28s_both]"
              >
                비회원 로그인 (견적 신청하신 분)
              </button>
            ) : (
              <div className="mt-4 animate-[loginItemUp_0.3s_ease_both]">
                <p className="mb-2.5 text-[13px] leading-relaxed text-gray-500">
                  견적 신청 때 입력하신 <b className="text-gray-700">전화번호와 이름</b>을 그대로 입력해주세요.
                </p>
                <input
                  type="tel" inputMode="numeric" value={guestPhone}
                  onChange={(e) => { setGuestPhone(e.target.value); setGuestError(''); }}
                  placeholder="전화번호 (예: 01012345678)"
                  className="mb-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-[16px] outline-none focus:border-[#3182F6]"
                />
                <input
                  type="text" value={guestName}
                  onChange={(e) => { setGuestName(e.target.value); setGuestError(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitGuestLogin(); }}
                  placeholder="이름"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-[16px] outline-none focus:border-[#3182F6]"
                />
                {guestError && <p className="mt-2 text-[13px] font-medium text-[#F04452]">{guestError}</p>}
                <button
                  onClick={submitGuestLogin} disabled={guestBusy}
                  className="mt-3 w-full rounded-2xl bg-[#3182F6] py-3.5 text-[15px] font-bold text-white transition active:scale-[0.98] disabled:opacity-60"
                >
                  {guestBusy ? '확인 중…' : '로그인'}
                </button>
                <button
                  onClick={() => { setGuestMode(false); setGuestError(''); }}
                  className="mt-2 w-full py-2 text-center text-[13px] font-medium text-gray-400"
                >
                  소셜 로그인으로 돌아가기
                </button>
              </div>
            )}

            <button onClick={() => { setShowLoginModal(false); setGuestMode(false); router.push('/main'); }} className="w-full mt-3 text-[14px] text-gray-400 font-medium py-2 text-center animate-[loginItemUp_0.4s_ease_0.35s_both]">
              취소
            </button>
          </div>
          <style>{`
            @keyframes loginFadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes loginSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
            @keyframes loginItemUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
          `}</style>
        </div>
      )}
    </div>
  );
}
