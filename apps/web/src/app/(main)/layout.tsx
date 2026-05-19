'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import Footer from '@/components/Footer';
import PageTransition from '@/components/PageTransition';
import { useAuthStore } from '@/lib/store/auth.store';
import { rememberAuthReturnTo, startOAuth } from '@/lib/auth/oauth';
import { requestNativeLoginSheet } from '@/lib/auth/native-login';

type NavIconProps = { className?: string };

const HomeNavIcon = ({ className }: NavIconProps) => (
  <svg width="20" height="20" viewBox="0 0 30 30" fill="none" className={className} aria-hidden="true">
    <path d="M13.7124 5.93065C14.4843 5.38575 15.5157 5.38575 16.2876 5.93065L23.4399 10.9795C24.0323 11.3978 24.3851 12.0775 24.3853 12.8027V22.2461C24.385 23.479 23.3848 24.4785 22.1519 24.4785H18.2791C18.0324 24.4785 17.8325 24.2786 17.8325 24.032V19.1897C17.8325 18.9431 17.6326 18.7432 17.386 18.7432H12.6131C12.3664 18.7432 12.1665 18.9431 12.1665 19.1897V24.032C12.1665 24.2786 11.9666 24.4785 11.72 24.4785H7.84717C6.61427 24.4784 5.61497 23.479 5.61475 22.2461V12.8027C5.61487 12.0774 5.96748 11.3978 6.56006 10.9795L13.7124 5.93065Z" fill="currentColor" />
  </svg>
);

const BizNavIcon = ({ className }: NavIconProps) => (
  <svg width="20" height="20" viewBox="0 0 30 30" fill="none" className={className} aria-hidden="true">
    <path fillRule="evenodd" clipRule="evenodd" d="M12.3433 4.72301H17.6562C17.9342 4.72299 18.1989 4.72296 18.4219 4.74118C18.665 4.76105 18.9439 4.80739 19.2227 4.94942C19.6136 5.14858 19.9313 5.46636 20.1305 5.85723C20.2725 6.13599 20.3189 6.41491 20.3387 6.65807C20.357 6.88106 20.3569 7.14569 20.3569 7.42374L20.3569 8.54958L21.3796 8.54958C21.9589 8.54956 22.4522 8.54955 22.8571 8.58264C23.2826 8.6174 23.6965 8.69353 24.0922 8.89515C24.6888 9.19912 25.1738 9.68416 25.4778 10.2807C25.6794 10.6764 25.7556 11.0904 25.7903 11.5158C25.8234 11.9208 25.8234 12.4141 25.8234 12.9933V20.8333C25.8234 21.4126 25.8234 21.9059 25.7903 22.3109C25.7556 22.7363 25.6794 23.1502 25.4778 23.5459C25.1738 24.1425 24.6888 24.6276 24.0922 24.9315C23.6965 25.1332 23.2826 25.2093 22.8571 25.2441C22.4522 25.2771 21.9589 25.2771 21.3797 25.2771H8.61989C8.04062 25.2771 7.54729 25.2771 7.14232 25.2441C6.71685 25.2093 6.30293 25.1332 5.90723 24.9315C5.31065 24.6276 4.82562 24.1425 4.52164 23.5459C4.32002 23.1502 4.24389 22.7363 4.20913 22.3109C4.17604 21.9059 4.17606 21.4126 4.17607 20.8334V12.9934C4.17606 12.4141 4.17604 11.9208 4.20913 11.5158C4.24389 11.0904 4.32002 10.6764 4.52164 10.2807C4.82562 9.68416 5.31065 9.19912 5.90723 8.89515C6.30293 8.69353 6.71685 8.6174 7.14232 8.58264C7.54731 8.54955 8.04059 8.54956 8.6199 8.54958L9.64257 8.54958L9.64257 7.42374C9.64255 7.14569 9.64252 6.88106 9.66074 6.65807C9.68061 6.41491 9.72695 6.13599 9.86898 5.85723C10.0681 5.46636 10.3859 5.14858 10.7768 4.94942C11.0556 4.80739 11.3345 4.76105 11.5776 4.74118C11.8006 4.72296 12.0652 4.72299 12.3433 4.72301ZM11.6104 8.54965H18.3888V6.80023C18.3888 6.73985 18.3399 6.6909 18.2795 6.6909H11.7197C11.6593 6.6909 11.6104 6.73985 11.6104 6.80023V8.54965ZM11.7197 13.4695C11.1763 13.4695 10.7358 13.91 10.7358 14.4534C10.7358 14.9969 11.1763 15.4374 11.7197 15.4374H18.2795C18.823 15.4374 19.2635 14.9969 19.2635 14.4534C19.2635 13.91 18.823 13.4695 18.2795 13.4695H11.7197Z" fill="currentColor" />
  </svg>
);

const ChatNavIcon = ({ className }: NavIconProps) => (
  <svg width="20" height="20" viewBox="0 0 30 30" fill="none" className={className} aria-hidden="true">
    <path d="M15.0005 5.3501C20.3298 5.35016 24.6497 9.67022 24.6499 14.9995C24.6499 16.5379 24.2898 17.9952 23.6479 19.2876L24.1421 21.1001C24.2539 21.5101 24.3537 21.8758 24.4067 22.1763C24.4605 22.4808 24.4973 22.8668 24.3501 23.2524C24.1572 23.7577 23.7577 24.1572 23.2524 24.3501C22.8669 24.4971 22.4807 24.4605 22.1763 24.4067C21.8758 24.3537 21.5101 24.2539 21.1001 24.1421L19.2876 23.6479C17.9952 24.2897 16.5387 24.6499 15.0005 24.6499C9.67096 24.6499 5.3501 20.3291 5.3501 14.9995C5.35035 9.67018 9.67111 5.3501 15.0005 5.3501ZM10.9429 13.5864C10.1622 13.5864 9.52881 14.2198 9.52881 15.0005C9.52907 15.781 10.1623 16.4136 10.9429 16.4136C11.7234 16.4136 12.3567 15.781 12.3569 15.0005C12.3569 14.2198 11.7236 13.5864 10.9429 13.5864ZM15.0005 13.5864C14.2198 13.5864 13.5874 14.2198 13.5874 15.0005C13.5877 15.781 14.22 16.4136 15.0005 16.4136C15.781 16.4136 16.4143 15.781 16.4146 15.0005C16.4146 14.2198 15.7812 13.5864 15.0005 13.5864ZM19.0581 13.5864C18.2774 13.5864 17.645 14.2198 17.645 15.0005C17.6453 15.781 18.2776 16.4136 19.0581 16.4136C19.8386 16.4136 20.4719 15.781 20.4722 15.0005C20.4722 14.2198 19.8388 13.5864 19.0581 13.5864Z" fill="currentColor" />
  </svg>
);

const NewRequestNavIcon = ({ className }: NavIconProps) => (
  <svg width="20" height="20" viewBox="0 0 30 30" fill="none" className={className} aria-hidden="true">
    <path d="M9.3 4.9h11.4c1.6 0 2.9 1.3 2.9 2.9v14.4c0 1.6-1.3 2.9-2.9 2.9H9.3c-1.6 0-2.9-1.3-2.9-2.9V7.8c0-1.6 1.3-2.9 2.9-2.9Z" fill="currentColor" opacity="0.18" />
    <path d="M10.7 9.6h8.6M10.7 14.1h8.6M10.7 18.6h5.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M20.8 4.9h-3.1a2.7 2.7 0 0 0-5.4 0H9.2v4.3h11.6V4.9Z" fill="currentColor" />
  </svg>
);

const MyNavIcon = ({ className }: NavIconProps) => (
  <svg width="20" height="20" viewBox="0 0 30 30" fill="none" className={className} aria-hidden="true">
    <rect x="1.3" y="4.96992" width="27.4" height="20.06" rx="10.03" stroke="currentColor" strokeWidth="1.6" />
    <path d="M7.004 19V10.24H8.624L11.276 13.924L14.036 10.24H15.584V19H13.952V12.856L11.264 16.48L8.636 12.916V19H7.004ZM17.433 22.24L18.909 18.652L16.029 11.98H17.757L19.713 16.708L21.561 11.98H23.265L19.077 22.24H17.433Z" fill="currentColor" />
  </svg>
);

const USER_NAV_ITEMS = [
  { href: '/main',      icon: HomeNavIcon,      label: '홈' },
  { href: '/biz',       icon: BizNavIcon,       label: 'Biz' },
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

export default function MainLayout({ children }: { children: React.ReactNode }) {
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

  const [isPro, setIsPro] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const lastScrollY = useRef(0);
  const authUser = useAuthStore((s) => s.user);
  const authHydrated = useAuthStore((s) => s.hasHydrated);
  const [newRequestCount, setNewRequestCount] = useState(0);

  // 로그인이 필요한 ��이지 패턴
  const AUTH_REQUIRED = [/^\/chat/, /^\/my/, /^\/pro-/];
  const needsAuth = AUTH_REQUIRED.some(p => p.test(pathname));

  useEffect(() => {
    if (!authHydrated) return;
    const isLoggedIn = authUser !== null;
    if (!isLoggedIn && needsAuth) {
      rememberAuthReturnTo();
      if (requestNativeLoginSheet({ reason: 'auth-required', returnTo: pathname })) {
        setShowLoginModal(false);
        // 네이티브 모달은 취소 이벤트를 웹으로 전달하지 않을 수 있음 → 취소 시 홈에 남도록 선제 이동
        router.replace('/main');
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
    if (isLoggedIn) {
      setIsPro(authUser?.role === 'pro');
    } else {
      setIsPro(false);
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
          setNewRequestCount(items.filter((m: any) => m.status === 'pending' || m.status === 'viewed').length);
        })
        .catch(() => {
          if (!cancelled) setNewRequestCount(0);
        });
    };

    const cancelInitialRefresh = queueIdleTask(refresh, pathname.startsWith('/pro-dashboard') ? 3500 : 1200, 6000);
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    window.addEventListener('freetiful:match-requests-changed', refresh);
    window.addEventListener('freetiful:dashboard-updated', refresh as EventListener);
    return () => {
      cancelled = true;
      cancelInitialRefresh();
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('freetiful:match-requests-changed', refresh);
      window.removeEventListener('freetiful:dashboard-updated', refresh as EventListener);
    };
  }, [authHydrated, authUser?.id, authUser?.role]);

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
    if (!loggedIn) return;

    let cancelled = false;
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
    };

    const cancelChat = onRealtimeRoute
      ? queueIdleTask(() => { loadChatStore(onChatRoute); }, 0, 1500)
      : queueIdleTask(() => { loadChatStore(false); }, 2500, 8000);

    const cancelNotifications = queueIdleTask(() => {
      import('@/lib/api/notification.api').then(({ notificationApi }) => {
        if (!cancelled) notificationApi.prefetch();
      });
    }, pathname.startsWith('/pro-dashboard') ? 5500 : 3000, 9000);

    return () => {
      cancelled = true;
      cancelChat();
      cancelNotifications();
    };
  }, [authUser?.id, pathname]);

  const NAV_ITEMS = isPro ? PRO_NAV_ITEMS : USER_NAV_ITEMS;
  const homeHref = '/main';

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
              const badge = label === '새요청' ? newRequestCount : 0;
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
                  <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'opacity-100' : 'opacity-60'}`} />
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
                overflow: 'hidden',
                transition: bizCollapsing
                  ? 'width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
                  : 'none',
                ...(navExpanding ? { animation: 'platformPillExpand 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' } : {}),
              }}
            >
              <div className="flex items-center h-full overflow-hidden p-[3px]">
                <div className="flex-1 flex items-center justify-around">
                {NAV_ITEMS.map(({ href, icon: Icon, label }, idx) => {
                  const active = pathname === href || (href !== homeHref && pathname.startsWith(href));
                  const isBiz = href === '/biz';
                  const badge = label === '새요청' ? newRequestCount : 0;
                  const itemStyle: React.CSSProperties = {
                    opacity: bizCollapsing ? 0 : 1,
                    transform: bizCollapsing ? 'scale(0.5)' : 'scale(1)',
                    transition: bizCollapsing
                      ? `opacity 0.2s ease ${idx * 0.03}s, transform 0.2s ease ${idx * 0.03}s`
                      : 'opacity 0.28s ease, transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), color 0.2s ease',
                    ...(navExpanding ? { animation: `platformIconAppear 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${0.25 + idx * 0.06}s both` } : {}),
                  };
                  return isBiz ? (
                    <button
                      key={href}
                      data-nav={label}
                      className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-2xl text-gray-400"
                      style={itemStyle}
                      onClick={(e) => {
                        e.preventDefault();
                        sessionStorage.setItem('nav-transition', 'from-platform');
                        setBizCollapsing(true);
                        setTimeout(() => router.push('/biz'), 500);
                      }}
                    >
                      <Icon className="h-5 w-5 shrink-0 opacity-60" />
                      <span className="text-[9px] font-medium">{label}</span>
                    </button>
                  ) : (
                    <Link
                      key={href}
                      href={href}
                      data-nav={label}
                      className={`relative flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-2xl ${
                        active ? 'text-gray-900' : 'text-gray-400'
                      }`}
                      style={itemStyle}
                      onClick={() => {
                        const navPill = document.querySelector('[data-nav-pill]') as HTMLElement;
                        if (navPill) {
                          navPill.style.animation = 'none';
                          void navPill.offsetHeight;
                          navPill.style.animation = 'liquidTap 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
                        }
                      }}
                    >
                      <Icon className={`h-5 w-5 shrink-0 ${active ? 'opacity-100' : 'opacity-60'}`} />
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
            <button onClick={() => { setShowLoginModal(false); router.push('/main'); }} className="w-full mt-3 text-[14px] text-gray-400 font-medium py-2 text-center animate-[loginItemUp_0.4s_ease_0.35s_both]">
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
