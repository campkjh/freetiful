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

const USER_NAV_ITEMS = [
  { href: '/main',      iconSrc: '/images/icon-home.svg',      label: '홈' },
  { href: '/schedule',  iconSrc: '/images/icon-schedule.svg',  label: '스케줄' },
  { href: '/biz',       iconSrc: '/images/icon-biz.svg',       label: 'Biz' },
  { href: '/chat',      iconSrc: '/images/icon-chat.svg',      label: '채팅' },
  { href: '/favorites', iconSrc: '/images/icon-favorites.svg', label: '찜' },
  { href: '/my',        iconSrc: '/images/icon-my.svg',        label: '마이' },
];

const PRO_NAV_ITEMS = [
  { href: '/pro-dashboard', iconSrc: '/images/icon-home.svg',     label: '홈' },
  { href: '/schedule',      iconSrc: '/images/icon-schedule.svg', label: '스케줄' },
  { href: '/chat',          iconSrc: '/images/icon-chat.svg',     label: '채팅' },
  { href: '/my',            iconSrc: '/images/icon-my.svg',       label: '마이' },
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
    const isLoggedIn = authUser !== null || hasPersistedToken || localStorage.getItem('freetiful-logged-in') === 'true';
    if (!isLoggedIn && needsAuth) {
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
      const iosBridge = (window as any).webkit?.messageHandlers?.showNativeLogin;
      if (iosBridge) { iosBridge.postMessage({}); return; }
      setShowLoginModal(true);
    };
    window.addEventListener('freetiful:show-login', handler);
    return () => window.removeEventListener('freetiful:show-login', handler);
  }, []);

  // 로그인 시 채팅 소켓 즉시 연결 + 룸/알림 프리페치
  useEffect(() => {
    const loggedIn = authUser !== null || localStorage.getItem('freetiful-logged-in') === 'true';
    if (loggedIn) {
      useChatStore.getState().connect();
      useChatStore.getState().fetchRooms();
      import('@/lib/api/notification.api').then(({ notificationApi }) => {
        notificationApi.prefetch();
      });
    }
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
            {NAV_ITEMS.map(({ href, iconSrc, label }) => {
              const active = pathname === href || (href !== homeHref && pathname.startsWith(href));
              const isBiz = href === '/biz';
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
                  <Image src={iconSrc} alt={label} width={18} height={18} className={active ? 'opacity-100' : 'opacity-60'} />
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
                {NAV_ITEMS.map(({ href, iconSrc, label }, idx) => {
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
                      <Image src={iconSrc} alt={label} width={20} height={20} className="opacity-60" />
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
                      <Image src={iconSrc} alt={label} width={20} height={20} className={active ? 'opacity-100' : 'opacity-60'} />
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
                    const origin = typeof window !== 'undefined' ? window.location.origin : '';
                    const KAKAO_KEY = 'dca1b472188890116c81a55eff590885';
                    const NAVER_KEY = 'R4WM7ZyC8hHuE_O7qLdy';

                    // iOS/Android 네이티브 앱이면 네이티브 SDK로 라우팅
                    const w = typeof window !== 'undefined' ? (window as any) : undefined;
                    const ios = w?.webkit?.messageHandlers as Record<string, { postMessage: (msg: object) => void } | undefined> | undefined;
                    const and = w?.Android as Record<string, (() => void) | undefined> | undefined;
                    if (provider === 'kakao') {
                      if (ios?.kakaoLogin) { ios.kakaoLogin.postMessage({}); return; }
                      if (and?.kakaoLogin) { and.kakaoLogin(); return; }
                    } else if (provider === 'naver') {
                      if (ios?.naverLogin) { ios.naverLogin.postMessage({}); return; }
                      if (and?.naverLogin) { and.naverLogin(); return; }
                    } else if (provider === 'google') {
                      if (ios?.googleLogin) { ios.googleLogin.postMessage({}); return; }
                      if (and?.googleLogin) { and.googleLogin(); return; }
                    } else if (provider === 'apple') {
                      if (ios?.appleLogin) { ios.appleLogin.postMessage({}); return; }
                      // Android/웹: Apple 네이티브 없음 — 모달만 닫고 종료 (Apple은 iOS 전용)
                      return;
                    }

                    // 브라우저 fallback — 웹 OAuth URL (kakao/naver만 지원)
                    if (provider === 'kakao') {
                      window.location.href = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_KEY}&redirect_uri=${encodeURIComponent(origin + '/auth/kakao/callback')}&response_type=code`;
                    } else if (provider === 'naver') {
                      const state = Math.random().toString(36).substring(7);
                      sessionStorage.setItem('naver_state', state);
                      window.location.href = `https://nid.naver.com/oauth2.0/authorize?client_id=${NAVER_KEY}&redirect_uri=${encodeURIComponent(origin + '/auth/naver/callback')}&response_type=code&state=${state}`;
                    }
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
