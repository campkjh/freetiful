'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import Footer from '@/components/Footer';
import FavoriteAnimation from '@/components/FavoriteAnimation';
import RecommendedProBar from '@/components/RecommendedProBar';

const NAV_ITEMS = [
  { href: '/home',      iconSrc: '/images/홈 아이콘.svg',     label: '홈' },
  { href: '/schedule',  iconSrc: '/images/스케줄 아이콘.svg', label: '스케줄' },
  { href: '/biz',       iconSrc: '/images/비즈 아이콘.svg',   label: 'Biz' },
  { href: '/chat',      iconSrc: '/images/채팅 아이콘.svg',   label: '채팅' },
  { href: '/favorites', iconSrc: '/images/찜 아이콘.svg',     label: '찜' },
  { href: '/my',        iconSrc: '/images/마이 아이콘.svg',   label: '마이' },
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
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const hideNav = HIDE_NAV_PATTERNS.some((p) => p.test(pathname));
  const [navVisible, setNavVisible] = useState(true);
  const [navExpanding, setNavExpanding] = useState(false);
  const [bizCollapsing, setBizCollapsing] = useState(false);
  const lastScrollY = useRef(0);

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
          <Link href="/home" className="text-[22px] font-black text-primary-500 tracking-tight">
            Freetiful
          </Link>

          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map(({ href, iconSrc, label }) => {
              const active = pathname === href || (href !== '/home' && pathname.startsWith(href));
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
          {children}
        </div>
      </main>

      {/* ─── Footer ────────────────────────────────────────────────── */}
      {!hideNav && <Footer />}

      {/* ─── 추천 전문가 플로팅 (모바일 네비 위) ───────────────────── */}
      {!hideNav && <RecommendedProBar />}

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
                  const active = pathname === href || (href !== '/home' && pathname.startsWith(href));
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
      <FavoriteAnimation />
    </div>
  );
}
