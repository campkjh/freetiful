'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, MessageCircle, CalendarDays, Heart, User, Briefcase } from 'lucide-react';
import Footer from '@/components/Footer';
import FavoriteAnimation from '@/components/FavoriteAnimation';

const NAV_ITEMS = [
  { href: '/home',      icon: Home,          label: '홈' },
  { href: '/schedule',  icon: CalendarDays,  label: '스케줄' },
  { href: '/biz',       icon: Briefcase,     label: 'Biz' },
  { href: '/chat',      icon: MessageCircle, label: '채팅' },
  { href: '/favorites', icon: Heart,         label: '찜' },
  { href: '/my',        icon: User,          label: '마이' },
];

const HIDE_NAV_PATTERNS = [
  /^\/chat\/.+/,
  /^\/pros\/.+/,
  /^\/businesses\/.+/,
  /^\/my\/.+/,
  /^\/notifications/,
  /^\/pro-register/,
  /^\/pros$/,
  /^\/biz$/,
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

  // 비즈에서 돌아왔을 때 펼쳐지는 애니메이션
  useEffect(() => {
    if (hideNav) return;
    const from = sessionStorage.getItem('nav-transition');
    if (from === 'from-biz') {
      setNavExpanding(true);
      sessionStorage.removeItem('nav-transition');
      const t = setTimeout(() => setNavExpanding(false), 600);
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
            Prettyful
          </Link>

          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
              const active = pathname === href || (href !== '/home' && pathname.startsWith(href));
              const isBiz = href === '/biz';
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full text-[14px] font-medium ${
                    isBiz
                      ? 'text-gray-900 bg-gray-900/5 hover:bg-gray-900/10 font-bold'
                      : active
                      ? 'text-primary-600 bg-primary-50/80'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-surface-100/80'
                  }`}
                  style={{ transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
                >
                  <Icon size={18} strokeWidth={isBiz ? 2.4 : active ? 2.2 : 1.8} />
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
            data-nav-pill
            className={`max-w-lg mx-auto glass-strong rounded-full shadow-nav mb-1 overflow-hidden ${navExpanding ? 'animate-[navExpandFromLeft_0.5s_cubic-bezier(0.16,1,0.3,1)]' : ''} ${bizCollapsing ? 'animate-[navCollapseToLeft_0.4s_cubic-bezier(0.7,0,0.3,1)_forwards]' : ''}`}
          >
            <div className="flex items-center justify-around h-[60px]">
              {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
                const active = pathname === href || (href !== '/home' && pathname.startsWith(href));
                const isBiz = href === '/biz';
                return isBiz ? (
                  <button
                    key={href}
                    data-nav={label}
                    className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-2xl text-gray-900"
                    style={{ transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
                    onClick={(e) => {
                      e.preventDefault();
                      sessionStorage.setItem('nav-transition', 'from-platform');
                      setBizCollapsing(true);
                      setTimeout(() => {
                        router.push('/biz');
                      }, 350);
                    }}
                  >
                    <Icon size={20} strokeWidth={2.4} />
                    <span className="text-[9px] font-black">{label}</span>
                  </button>
                ) : (
                  <Link
                    key={href}
                    href={href}
                    data-nav={label}
                    className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-2xl ${
                      active ? 'text-primary-500' : 'text-gray-400'
                    }`}
                    style={{ transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}
                    onClick={() => {
                      const navPill = document.querySelector('[data-nav-pill]') as HTMLElement;
                      if (navPill) {
                        navPill.style.animation = 'none';
                        void navPill.offsetHeight;
                        navPill.style.animation = 'liquidTap 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
                      }
                    }}
                  >
                    <Icon size={20} strokeWidth={active ? 2.2 : 1.6} />
                    <span className={`text-[9px] ${active ? 'font-bold' : 'font-medium'}`}>{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Nav transition keyframes */}
          <style>{`
            @keyframes navExpandFromLeft {
              0% { transform: scaleX(0.15); transform-origin: left center; opacity: 0.5; border-radius: 9999px; }
              100% { transform: scaleX(1); transform-origin: left center; opacity: 1; border-radius: 9999px; }
            }
            @keyframes navCollapseToLeft {
              0% { transform: scaleX(1); transform-origin: left center; opacity: 1; }
              100% { transform: scaleX(0.15); transform-origin: left center; opacity: 0; }
            }
          `}</style>
        </nav>
      )}
      <FavoriteAnimation />
    </div>
  );
}
