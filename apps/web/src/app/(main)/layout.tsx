'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import Footer from '@/components/Footer';
import FavoriteAnimation from '@/components/FavoriteAnimation';
import RecommendedProBar from '@/components/RecommendedProBar';
import PageTransition from '@/components/PageTransition';
import { useAuthStore } from '@/lib/store/auth.store';

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
  const [navExpanding, setNavExpanding] = useState(false);
  const [bizCollapsing, setBizCollapsing] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showWebLoginModal, setShowWebLoginModal] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [showBizBubble, setShowBizBubble] = useState(true);
  const lastScrollY = useRef(0);
  const authUser = useAuthStore((s) => s.user);

  // Biz bubble stays visible (no auto-hide)

  // 로그인이 필요한 ��이지 패턴
  const AUTH_REQUIRED = [/^\/chat/, /^\/schedule/, /^\/favorites/, /^\/my/, /^\/quote/, /^\/pro-/];
  const needsAuth = AUTH_REQUIRED.some(p => p.test(pathname));

  useEffect(() => {
    const isLoggedIn = authUser !== null || localStorage.getItem('freetiful-logged-in') === 'true';
    if (!isLoggedIn && needsAuth) {
      // 인증 필요 페이지 접근 차단 — 무조건 /main(홈) 으로 이동
      router.replace('/main');
      // iOS면 네이티브 sheet 추가로 호출 (웹 브라우저는 그냥 /main에 머무름)
      const iosBridge = (window as any).webkit?.messageHandlers?.showNativeLogin;
      if (iosBridge) {
        iosBridge.postMessage({});
      }
    }
    setShowLoginModal(false);
    if (isLoggedIn) {
      setIsPro(authUser?.role === 'pro' || localStorage.getItem('userRole') === 'pro');
    }
  }, [pathname, needsAuth, authUser, router]);

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
      // 하단 네비게이션은 항상 보이도록 유지 — 스크롤에 따라 숨김/표시하지 않음
      setHeaderScrolled(currentY > 80);
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
              ? 'max-w-[700px] mt-2 px-6 rounded-full backdrop-blur-xl bg-white/70 shadow-lg border border-gray-200/50'
              : 'max-w-7xl px-8 glass border-b border-gray-100/50'
          }`}
        >
          <Link href={homeHref}>
            <Image src="/images/logo-prettyful.svg" alt="Freetiful" width={120} height={32} />
          </Link>

          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map(({ href, iconSrc, label }) => {
              const active = pathname === href || (href !== homeHref && pathname.startsWith(href));
              const isBiz = href === '/biz';
              return (
                <div key={href} className="relative">
                  {isBiz && showBizBubble && (
                    <div className="absolute top-full mt-4 left-1/2 -translate-x-1/2 whitespace-nowrap z-10 animate-[bizBubbleIn_0.6s_cubic-bezier(0.34,1.56,0.64,1)_0.3s_both]">
                      {/* 말풍선 본체 */}
                      <div className="relative bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] px-5 py-3.5">
                        {/* 꼬리 (위쪽 삼각형) */}
                        <div className="absolute left-1/2 -translate-x-1/2 -top-[8px] w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[8px] border-b-white" style={{ filter: 'drop-shadow(0 -2px 2px rgba(0,0,0,0.06))' }} />
                        <p className="text-[14px] font-bold text-[#3180F7]">품격 높은 전문 행사 사회자 찾기</p>
                      </div>
                    </div>
                  )}
                  <Link
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
                </div>
              );
            })}
          </nav>
        </div>
        <style>{`
          @keyframes bizBubbleIn {
            0% { opacity: 0; transform: translateX(-50%) translateY(8px) scale(0.9); }
            50% { opacity: 1; transform: translateX(-50%) translateY(-4px) scale(1.02); }
            100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
          }
        `}</style>
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
            bottom: navVisible ? 0 : -80,
            transform: navVisible ? 'scale(1)' : 'scale(0.95)',
            transition: 'bottom 0.45s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <div
            className="mx-auto mb-1"
            style={{ display: 'flex', justifyContent: 'flex-start', maxWidth: 512 }}
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
              <div className="flex items-center justify-around h-full overflow-hidden">
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
      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center animate-[loginFadeIn_0.25s_ease]" onClick={() => { setShowLoginModal(false); router.push('/main'); }}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white w-full max-w-md rounded-t-3xl px-6 pt-6 pb-8 animate-[loginSlideUp_0.35s_cubic-bezier(0.16,1,0.3,1)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-5" />
            <h2 className="text-[20px] font-bold text-gray-900 text-center mb-1 animate-[loginItemUp_0.4s_ease_0.1s_both]">로그인이 필요합니다</h2>
            <p className="text-[14px] text-gray-500 text-center mb-6 animate-[loginItemUp_0.4s_ease_0.15s_both]">이 기능을 사용하려면 로그인해주세요</p>
            <div className="space-y-2.5">
              {[
                { provider: 'kakao', label: '카카오로 계속하기', cls: 'bg-[#FEE500] text-[#191919]', icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path fillRule="evenodd" clipRule="evenodd" d="M9 0C4.03 0 0 3.19 0 7.13c0 2.52 1.67 4.74 4.19 6.01L3.1 17.2a.3.3 0 0 0 .46.32L8.4 14a10.7 10.7 0 0 0 .6.02C13.97 14.02 18 10.83 18 6.89 18 2.94 13.97 0 9 0z" fill="#191919"/></svg>, delay: '0.2s' },
                { provider: 'naver', label: '네이버로 계속하기', cls: 'bg-[#03C75A] text-white', icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M12.16 9.57L5.56 0H0v18h5.84V8.43L12.44 18H18V0h-5.84v9.57z" fill="white"/></svg>, delay: '0.25s' },
                { provider: 'google', label: 'Google로 계속하기', cls: 'bg-white text-gray-700 border border-gray-200', icon: <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/><path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/></svg>, delay: '0.3s' },
                { provider: 'apple', label: 'Apple로 계속하기', cls: 'bg-black text-white', icon: <svg width="16" height="18" viewBox="0 0 16 20" fill="white"><path d="M15.545 15.467c-.318.734-.692 1.41-1.124 2.033-.588.852-1.07 1.442-1.44 1.77-.577.539-1.194.815-1.856.832-.475 0-1.048-.135-1.714-.41-.669-.273-1.284-.408-1.848-.408-.588 0-1.22.135-1.893.408-.675.275-1.22.418-1.635.432-.636.027-1.267-.256-1.893-.852-.402-.356-.904-.967-1.507-1.832C.983 16.513.48 15.44.14 14.332c-.364-1.198-.547-2.357-.547-3.48 0-1.286.278-2.395.833-3.323A4.893 4.893 0 012.17 5.836a4.702 4.702 0 012.37-.67c.504 0 1.165.156 1.987.463.819.308 1.345.464 1.574.464.172 0 .753-.182 1.738-.545.932-.337 1.718-.476 2.364-.42 1.747.14 3.06.828 3.93 2.07-1.562.947-2.334 2.274-2.317 3.974.015 1.323.494 2.424 1.434 3.296.427.405.903.717 1.434.94-.115.334-.236.654-.364.96zM11.914.21c0 1.037-.379 2.005-1.133 2.9-.911 1.063-2.012 1.677-3.206 1.58a3.224 3.224 0 01-.024-.393c0-.995.433-2.06 1.203-2.93.384-.44.873-.806 1.467-1.097.593-.287 1.153-.446 1.68-.476.016.139.024.278.024.416z"/></svg>, delay: '0.35s' },
              ].map(({ provider, label, cls, icon, delay }) => (
                <button
                  key={provider}
                  onClick={() => {
                    const isWeb = typeof window !== 'undefined' && !(window as any).webkit?.messageHandlers?.showNativeLogin;
                    if (isWeb) {
                      setShowLoginModal(false);
                      setShowWebLoginModal(true);
                      return;
                    }
                    setShowLoginModal(false);
                    const origin = typeof window !== 'undefined' ? window.location.origin : '';
                    const KAKAO_KEY = 'dca1b472188890116c81a55eff590885';
                    const NAVER_KEY = 'R4WM7ZyC8hHuE_O7qLdy';
                    if (provider === 'kakao') {
                      window.location.href = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_KEY}&redirect_uri=${encodeURIComponent(origin + '/auth/kakao/callback')}&response_type=code`;
                    } else if (provider === 'naver') {
                      const state = Math.random().toString(36).substring(7);
                      sessionStorage.setItem('naver_state', state);
                      window.location.href = `https://nid.naver.com/oauth2.0/authorize?client_id=${NAVER_KEY}&redirect_uri=${encodeURIComponent(origin + '/auth/naver/callback')}&response_type=code&state=${state}`;
                    } else {
                      router.push('/main');
                    }
                  }}
                  className={`w-full flex items-center justify-center gap-3 ${cls} font-semibold py-3.5 rounded-xl active:scale-[0.96] transition-transform animate-[loginItemUp_0.4s_cubic-bezier(0.16,1,0.3,1)_both]`}
                  style={{ animationDelay: delay }}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
            <button onClick={() => { setShowLoginModal(false); router.push('/main'); }} className="w-full mt-4 text-[14px] text-gray-400 font-medium py-2 text-center animate-[loginItemUp_0.4s_ease_0.4s_both]">
              나중에 하기
            </button>
          </div>
          <style>{`
            @keyframes loginFadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes loginSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
            @keyframes loginItemUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
          `}</style>
        </div>
      )}
      {/* Web Social Login Guide Modal */}
      {showWebLoginModal && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center px-4 animate-[loginFadeIn_0.2s_ease]"
          onClick={() => setShowWebLoginModal(false)}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative bg-white w-full max-w-sm rounded-2xl px-6 pt-6 pb-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[18px] font-bold text-gray-900 text-center mb-2">소셜 로그인 안내</h3>
            <p className="text-[14px] text-gray-500 text-center leading-relaxed mb-5">
              현재 웹에서는 소셜 로그인 준비중입니다.<br />
              이메일로 간편 로그인/가입해주세요.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setShowWebLoginModal(false);
                  router.push('/login');
                }}
                className="w-full bg-[#4E8FFF] hover:bg-[#3D7FEF] text-white font-semibold py-3 rounded-xl transition-colors"
              >
                이메일로 계속하기
              </button>
              <button
                onClick={() => setShowWebLoginModal(false)}
                className="w-full text-[14px] text-gray-400 font-medium py-2"
              >
                닫기
              </button>
            </div>
          </div>
          <style>{`
            @keyframes loginFadeIn { from { opacity: 0; } to { opacity: 1; } }
          `}</style>
        </div>
      )}
      <FavoriteAnimation />
    </div>
  );
}
