'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Footer from '@/components/Footer';
import FavoriteAnimation from '@/components/FavoriteAnimation';
import RecommendedProBar from '@/components/RecommendedProBar';
import PageTransition from '@/components/PageTransition';
import { useAuthStore } from '@/lib/store/auth.store';
import { useChatStore } from '@/lib/store/chat.store';
import { rememberAuthReturnTo, startOAuth } from '@/lib/auth/oauth';

type NavIconProps = { className?: string };

const HomeNavIcon = ({ className }: NavIconProps) => (
  <svg width="20" height="20" viewBox="0 0 30 30" fill="none" className={className} aria-hidden="true">
    <path d="M13.7124 5.93065C14.4843 5.38575 15.5157 5.38575 16.2876 5.93065L23.4399 10.9795C24.0323 11.3978 24.3851 12.0775 24.3853 12.8027V22.2461C24.385 23.479 23.3848 24.4785 22.1519 24.4785H18.2791C18.0324 24.4785 17.8325 24.2786 17.8325 24.032V19.1897C17.8325 18.9431 17.6326 18.7432 17.386 18.7432H12.6131C12.3664 18.7432 12.1665 18.9431 12.1665 19.1897V24.032C12.1665 24.2786 11.9666 24.4785 11.72 24.4785H7.84717C6.61427 24.4784 5.61497 23.479 5.61475 22.2461V12.8027C5.61487 12.0774 5.96748 11.3978 6.56006 10.9795L13.7124 5.93065Z" fill="currentColor" />
  </svg>
);

const ScheduleNavIcon = ({ className }: NavIconProps) => (
  <svg width="20" height="20" viewBox="0 0 30 30" fill="none" className={className} aria-hidden="true">
    <path d="M20.3737 4.79883C20.9363 4.79883 21.3929 5.25481 21.3932 5.81738V7.87402H21.5914C22.5494 7.87413 23.3588 8.5845 23.484 9.53418L25.2614 23.043C25.4116 24.1864 24.5211 25.2012 23.3678 25.2012H6.6305C5.49825 25.201 4.6153 24.221 4.73206 23.0947L6.13245 9.58691C6.23342 8.61407 7.05284 7.87422 8.03089 7.87402H8.6139V5.81738C8.61416 5.25509 9.0702 4.79928 9.63245 4.79883C10.1951 4.79883 10.6517 5.25481 10.652 5.81738V7.87402H13.984V5.81738C13.9843 5.25493 14.4411 4.79902 15.0035 4.79883C15.566 4.79899 16.0218 5.25491 16.0221 5.81738V7.87402H19.3551V5.81738C19.3554 5.25509 19.8114 4.79928 20.3737 4.79883ZM17.6696 12.2559C17.0394 12.2559 16.4729 12.3893 15.9791 12.6641L15.7721 12.79C15.2346 13.1474 14.8286 13.6654 14.5485 14.3262L14.5475 14.3271C14.2702 14.9883 14.1375 15.7752 14.1373 16.6777C14.1346 17.5838 14.2666 18.3769 14.5436 19.0459V19.0469C14.8231 19.7148 15.2288 20.2399 15.7653 20.6055H15.7662C16.3067 20.9716 16.9454 21.1505 17.6686 21.1533H17.6696C18.3931 21.1533 19.0314 20.9762 19.57 20.6094C20.1065 20.2438 20.5108 19.7188 20.7877 19.0508C21.0676 18.3817 21.2018 17.5874 21.2018 16.6787C21.204 15.8886 21.1027 15.1875 20.8893 14.583L20.7907 14.3291C20.5105 13.6685 20.1026 13.1497 19.5631 12.79H19.5621C19.0244 12.4302 18.389 12.2559 17.6696 12.2559ZM10.8571 12.4092L8.86683 13.6689L8.73402 13.7539V15.9365L9.17249 15.6611L10.6217 14.752V20.9766H12.8942V12.3652H10.9274L10.8571 12.4092ZM17.6696 14.2217C17.905 14.2217 18.1023 14.2985 18.2741 14.4541L18.275 14.4551C18.4513 14.6131 18.605 14.8657 18.7184 15.2393V15.2412C18.8326 15.61 18.8941 16.0869 18.8942 16.6787V16.6797C18.8967 17.5867 18.7615 18.22 18.526 18.6172C18.2925 19.0107 18.0102 19.1719 17.6696 19.1719C17.4929 19.1718 17.3367 19.1286 17.1959 19.041L17.0602 18.9385C16.884 18.7777 16.7297 18.5214 16.6139 18.1436C16.5016 17.7656 16.4411 17.2797 16.441 16.6797C16.4437 15.7863 16.5807 15.1618 16.816 14.7695C17.0491 14.3813 17.3308 14.2218 17.6696 14.2217Z" fill="currentColor" />
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

const FavoritesNavIcon = ({ className }: NavIconProps) => (
  <svg width="20" height="20" viewBox="0 0 30 30" fill="none" className={className} aria-hidden="true">
    <path d="M15 24.5333L6.22971 16.1939C3.95859 13.7403 3.95859 9.76001 6.22971 7.30647C8.50083 4.85292 12.1887 4.85292 14.4598 7.30647L15 7.88867L15.5402 7.30647C17.8113 4.85292 21.4992 4.85292 23.7703 7.30647C26.0414 9.76001 26.0414 13.7403 23.7703 16.1939L15 24.5333Z" fill="currentColor" />
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
  { href: '/schedule',  icon: ScheduleNavIcon,  label: '스케줄' },
  { href: '/biz',       icon: BizNavIcon,       label: 'Biz' },
  { href: '/chat',      icon: ChatNavIcon,      label: '채팅' },
  { href: '/favorites', icon: FavoritesNavIcon, label: '찜' },
  { href: '/my',        icon: MyNavIcon,        label: '마이' },
];

const PRO_NAV_ITEMS = [
  { href: '/pro-dashboard', icon: HomeNavIcon,     label: '홈' },
  { href: '/schedule',      icon: ScheduleNavIcon, label: '스케줄' },
  { href: '/chat',          icon: ChatNavIcon,     label: '채팅' },
  { href: '/my',            icon: MyNavIcon,       label: '마이' },
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
  /^\/quote/,
  /^\/careers$/,
  /^\/schedule\/.+/,
  /^\/search/,
];

const HIDE_FOOTER_PATTERNS = [
  /^\/chat$/,
  /^\/favorites$/,
  /^\/schedule$/,
  /^\/my$/,
  /^\/pro-dashboard/,
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const hideNav = HIDE_NAV_PATTERNS.some((p) => p.test(pathname));
  const [navVisible, setNavVisible] = useState(true);
  const [navMounted, setNavMounted] = useState(false); // 초기 등장 애니메이션 (한 번만)
  const [navExpanding, setNavExpanding] = useState(false);
  const [bizCollapsing, setBizCollapsing] = useState(false);

  // 최초 마운트 시 한 번만 등장 애니메이션, 탭 전환 시 재실행 안함
  useEffect(() => {
    const t = setTimeout(() => setNavMounted(true), 30);
    return () => clearTimeout(t);
  }, []);
  const [isPro, setIsPro] = useState(false);
  // 프로가 "일반 유저 모드로 보기" 를 토글한 상태 (localStorage 유지)
  const [viewAsUser, setViewAsUser] = useState(false);
  // 실제 계정 role이 pro인지 (viewAsUser 무관)
  const [actualIsPro, setActualIsPro] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const lastScrollY = useRef(0);
  const authUser = useAuthStore((s) => s.user);

  // 로그인이 필요한 ��이지 패턴
  const AUTH_REQUIRED = [/^\/chat/, /^\/schedule/, /^\/favorites/, /^\/my/, /^\/quote/, /^\/pro-/];
  const needsAuth = AUTH_REQUIRED.some(p => p.test(pathname));

  useEffect(() => {
    // localStorage의 zustand persist 데이터에 user/accessToken이 있으면 로그인된 것으로 간주
    // (authUser가 hydration 전에 null일 수 있으므로 persist 원본도 확인)
    let hasPersistedToken = false;
    try {
      const raw = localStorage.getItem('prettyful-auth');
      if (raw) {
        const parsed = JSON.parse(raw);
        hasPersistedToken = !!(parsed?.state?.accessToken || parsed?.state?.user);
      }
    } catch {}
    const isLoggedIn = authUser !== null || hasPersistedToken;
    if (!isLoggedIn && needsAuth) {
      rememberAuthReturnTo();
      const iosBridge = (window as any).webkit?.messageHandlers?.showNativeLogin;
      if (iosBridge) {
        iosBridge.postMessage({});
        setShowLoginModal(false);
        // iOS 네이티브 모달은 취소 이벤트를 웹으로 전달하지 않음 → 취소 시 홈에 남도록 선제 이동
        router.replace('/main');
      } else {
        setShowLoginModal(true);
      }
    } else {
      setShowLoginModal(false);
    }
    if (isLoggedIn) {
      const realPro = authUser?.role === 'pro' || localStorage.getItem('userRole') === 'pro';
      const viewing = localStorage.getItem('viewAsUser') === 'true';
      setActualIsPro(realPro);
      setViewAsUser(viewing);
      // 실제 pro 이지만 일반 유저 뷰 토글이 켜져있으면 네비를 user로
      setIsPro(realPro && !viewing);
    }
  }, [pathname, needsAuth, authUser]);

  // 외부 컴포넌트에서 로그인 모달을 열 수 있도록 커스텀 이벤트 수신
  useEffect(() => {
    const handler = () => {
      rememberAuthReturnTo();
      const iosBridge = (window as any).webkit?.messageHandlers?.showNativeLogin;
      if (iosBridge) { iosBridge.postMessage({}); return; }
      setShowLoginModal(true);
    };
    window.addEventListener('freetiful:show-login', handler);
    return () => window.removeEventListener('freetiful:show-login', handler);
  }, []);

  // 로그인 시 채팅 소켓 즉시 연결 + 룸/알림 프리페치
  useEffect(() => {
    const loggedIn = authUser !== null;
    if (!loggedIn) return;

    useChatStore.getState().connect();
    const runPrefetch = () => {
      const chatState = useChatStore.getState();
      if (chatState.rooms.length === 0 && !chatState.roomsLoading) {
        chatState.fetchRooms();
      }
      import('@/lib/api/notification.api').then(({ notificationApi }) => {
        notificationApi.prefetch();
      });
    };

    const win = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (win.requestIdleCallback) {
      const id = win.requestIdleCallback(runPrefetch, { timeout: 2500 });
      return () => win.cancelIdleCallback?.(id);
    }
    const timeout = window.setTimeout(runPrefetch, 800);
    return () => window.clearTimeout(timeout);
  }, [authUser]);

  const NAV_ITEMS = isPro ? PRO_NAV_ITEMS : USER_NAV_ITEMS;
  const homeHref = isPro ? '/pro-dashboard' : '/main';

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
      {/* ─── Desktop Top Navigation (Glass) ──────────────────────────── */}
      <header className={`${hideNav ? 'hidden' : 'hidden lg:block'} sticky top-0 z-50 glass border-b border-gray-100/50`}>
        <div className="max-w-7xl mx-auto px-8 h-[72px] flex items-center justify-between">
          <Link href={homeHref} className="text-[22px] font-black text-primary-500 tracking-tight">
            Freetiful
          </Link>

          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
              const active = pathname === href || (href !== homeHref && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full text-[14px] font-medium ${
                    active
                      ? 'text-gray-900 bg-gray-100/80 font-bold'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-surface-100/80'
                  }`}
                  style={{ transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
                >
                  <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'opacity-100' : 'opacity-60'}`} />
                  {label}
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

      {/* ─── 추천 전문가 플로팅 (모바일 네비 위, 일반유저만) ──────── */}
      {!hideNav && !isPro && <RecommendedProBar />}

      {/* ─── Mobile Bottom Nav Gradient Blur ───────────────────── */}
      {!hideNav && (
        <div className="lg:hidden fixed left-0 right-0 bottom-0 h-20 z-40 pointer-events-none"
          style={{
            background: 'linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0.8) 50%, rgba(255,255,255,0) 100%)',
          }}
        />
      )}

      {/* ─── Mobile Bottom Navigation (Glass Pill) ───────────────────── */}
      {!hideNav && (
        <nav
          className="lg:hidden fixed left-0 right-0 z-50 px-4 pb-safe"
          style={{
            bottom: navMounted && navVisible ? 0 : -80,
            transform: navMounted && navVisible ? 'scale(1) translateY(0)' : 'scale(0.88) translateY(8px)',
            opacity: navMounted && navVisible ? 1 : 0,
            filter: navMounted && navVisible ? 'blur(0)' : 'blur(6px)',
            transition: 'bottom 0.55s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.35s ease, filter 0.4s ease',
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
                height: 60,
                borderRadius: 9999,
                overflow: 'hidden',
                transition: bizCollapsing
                  ? 'width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
                  : 'none',
                ...(navExpanding ? { animation: 'platformPillExpand 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' } : {}),
              }}
            >
              <div className="flex items-center h-full overflow-hidden px-1">
                {/* 프로↔일반유저 뷰 토글 chevron (실제 계정 role이 pro일 때만 노출) */}
                {actualIsPro && (
                  <button
                    aria-label={isPro ? '일반 유저로 보기' : '프로 모드로 돌아가기'}
                    onClick={() => {
                      if (isPro) {
                        localStorage.setItem('viewAsUser', 'true');
                        setViewAsUser(true);
                        setIsPro(false);
                        router.push('/main');
                      } else {
                        localStorage.removeItem('viewAsUser');
                        setViewAsUser(false);
                        setIsPro(true);
                        router.push('/pro-dashboard');
                      }
                    }}
                    className="shrink-0 w-[40px] h-[40px] rounded-full flex items-center justify-center text-gray-500 bg-gray-100/80 active:scale-90 transition-transform mr-1"
                  >
                    {isPro ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                  </button>
                )}
                <div className="flex-1 flex items-center justify-around">
                {NAV_ITEMS.map(({ href, icon: Icon, label }, idx) => {
                  const active = pathname === href || (href !== homeHref && pathname.startsWith(href));
                  const isBiz = href === '/biz';
                  const itemStyle: React.CSSProperties = {
                    opacity: bizCollapsing ? 0 : 1,
                    transform: bizCollapsing ? 'scale(0.5)' : 'scale(1)',
                    filter: bizCollapsing ? 'blur(4px)' : 'blur(0px)',
                    transition: bizCollapsing
                      ? `opacity 0.25s ease ${idx * 0.03}s, transform 0.25s ease ${idx * 0.03}s, filter 0.25s ease ${idx * 0.03}s`
                      : 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
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
                      className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-2xl ${
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
              0% { width: 60px; filter: blur(0px); }
              15% { filter: blur(3px); }
              50% { filter: blur(1px); }
              70% { width: 105%; filter: blur(0px); }
              100% { width: 100%; filter: blur(0px); }
            }
            @keyframes platformIconAppear {
              0% { opacity: 0; transform: scale(0.3) translateY(4px); filter: blur(4px); }
              60% { opacity: 1; transform: scale(1.1) translateY(-1px); filter: blur(0px); }
              100% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0px); }
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
            <p className="text-[13px] text-gray-500 text-center mb-7 animate-[loginItemUp_0.4s_ease_0.1s_both]">나의 특별한 행사를 완성하는 전문가</p>
            <div className="space-y-2.5">
              {[
                { provider: 'kakao', label: '카카오로 시작하기', cls: 'bg-[#FEE500] text-[#191919]', icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M9 0C4.03 0 0 3.19 0 7.13c0 2.52 1.67 4.74 4.19 6.01L3.1 17.2a.3.3 0 0 0 .46.32L8.4 14a10.7 10.7 0 0 0 .6.02C13.97 14.02 18 10.83 18 6.89 18 2.94 13.97 0 9 0z" fill="#191919"/></svg>, delay: '0.15s' },
                { provider: 'naver', label: '네이버로 시작하기', cls: 'bg-[#03C75A] text-white', icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M12.16 9.57L5.56 0H0v18h5.84V8.43L12.44 18H18V0h-5.84v9.57z" fill="white"/></svg>, delay: '0.2s' },
                { provider: 'google', label: 'Google로 시작하기', cls: 'bg-white text-gray-700 border border-gray-200', icon: <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/><path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/></svg>, delay: '0.25s' },
                { provider: 'apple', label: 'Apple로 시작하기', cls: 'bg-black text-white', icon: <svg width="16" height="18" viewBox="0 0 16 20" fill="white"><path d="M15.545 15.467c-.318.734-.692 1.41-1.124 2.033-.588.852-1.07 1.442-1.44 1.77-.577.539-1.194.815-1.856.832-.475 0-1.048-.135-1.714-.41-.669-.273-1.284-.408-1.848-.408-.588 0-1.22.135-1.893.408-.675.275-1.22.418-1.635.432-.636.027-1.267-.256-1.893-.852-.402-.356-.904-.967-1.507-1.832C.983 16.513.48 15.44.14 14.332c-.364-1.198-.547-2.357-.547-3.48 0-1.286.278-2.395.833-3.323A4.893 4.893 0 012.17 5.836a4.702 4.702 0 012.37-.67c.504 0 1.165.156 1.987.463.819.308 1.345.464 1.574.464.172 0 .753-.182 1.738-.545.932-.337 1.718-.476 2.364-.42 1.747.14 3.06.828 3.93 2.07-1.562.947-2.334 2.274-2.317 3.974.015 1.323.494 2.424 1.434 3.296.427.405.903.717 1.434.94-.115.334-.236.654-.364.96zM11.914.21c0 1.037-.379 2.005-1.133 2.9-.911 1.063-2.012 1.677-3.206 1.58a3.224 3.224 0 01-.024-.393c0-.995.433-2.06 1.203-2.93.384-.44.873-.806 1.467-1.097.593-.287 1.153-.446 1.68-.476.016.139.024.278.024.416z"/></svg>, delay: '0.3s' },
              ].map(({ provider, label, cls, icon, delay }) => (
                <button
                  key={provider}
                  onClick={() => {
                    setShowLoginModal(false);
                    rememberAuthReturnTo();
                    if (provider === 'apple') {
                      const ios = (window as any)?.webkit?.messageHandlers as Record<string, { postMessage: (msg: object) => void } | undefined> | undefined;
                      if (ios?.appleLogin) { ios.appleLogin.postMessage({}); return; }
                      // Android/웹: Apple 네이티브 없음 — 모달만 닫고 종료 (Apple은 iOS 전용)
                      return;
                    }
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
      <FavoriteAnimation />
    </div>
  );
}
