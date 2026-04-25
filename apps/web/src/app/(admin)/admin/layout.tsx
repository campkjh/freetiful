'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  LayoutDashboard,
  UserCog,
  Users,
  ClipboardList,
  CreditCard,
  Star,
  Building2,
  Heart,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  ExternalLink,
  Package,
  Image as ImageIcon,
  Megaphone,
  HelpCircle,
  Command,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';

const ADMIN_EMAILS = ['admin@freetiful.com'];

function isAdminUser(user: { email?: string | null; role?: string | null } | null) {
  return !!user && (user.role === 'admin' || (!!user.email && ADMIN_EMAILS.includes(user.email)));
}

const NAV_ITEMS = [
  { href: '/admin', label: '대시보드', icon: LayoutDashboard, exact: true },
  { href: '/admin/pros', label: '전문가 관리', icon: UserCog },
  { href: '/admin/partners', label: '웨딩 파트너 업체', icon: Heart },
  { href: '/admin/plan-templates', label: '서비스 플랜', icon: Package },
  { href: '/admin/banners', label: '배너 관리', icon: ImageIcon },
  { href: '/admin/users', label: '유저 관리', icon: Users },
  { href: '/admin/bookings', label: '의뢰/예약', icon: ClipboardList },
  { href: '/admin/payments', label: '결제/정산', icon: CreditCard },
  { href: '/admin/reviews', label: '리뷰', icon: Star },
  { href: '/admin/businesses', label: 'Biz 고객사', icon: Building2 },
  { href: '/admin/announcements', label: '공지사항', icon: Megaphone },
  { href: '/admin/faqs', label: 'FAQ', icon: HelpCircle },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const authUser = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [checked, setChecked] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarReady, setSidebarReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hasAdminKey, setHasAdminKey] = useState(false);

  const isLoginPage = pathname === '/admin/login';

  // zustand persist 하이드레이션 완료 대기 — localStorage 복원 전에 로그인 체크가 먼저 돌면
  // 새로고침마다 /admin/login 으로 튕기는 문제 방지
  useEffect(() => {
    const store: any = useAuthStore as any;
    if (store.persist?.hasHydrated?.()) {
      setHydrated(true);
      return;
    }
    const unsub = store.persist?.onFinishHydration?.(() => setHydrated(true));
    // 안전장치: 하이드레이션 이벤트가 오지 않는 환경을 대비해 다음 tick 에도 한 번 확인
    const tm = setTimeout(() => setHydrated(true), 250);
    return () => { unsub?.(); clearTimeout(tm); };
  }, []);

  useEffect(() => {
    try {
      setHasAdminKey(!!localStorage.getItem('admin-key'));
      const saved = localStorage.getItem('freetiful-admin-sidebar-collapsed');
      if (saved === '1' || saved === '0') setCollapsed(saved === '1');
    } catch {}
    setSidebarReady(true);
  }, []);

  useEffect(() => {
    if (!sidebarReady) return;
    try { localStorage.setItem('freetiful-admin-sidebar-collapsed', collapsed ? '1' : '0'); } catch {}
  }, [collapsed, sidebarReady]);

  useEffect(() => {
    if (!hydrated) return;
    if (isLoginPage) { setChecked(true); return; }
    if (hasAdminKey) { setChecked(true); return; }
    if (!authUser) { router.replace('/admin/login'); return; }
    if (!isAdminUser(authUser)) {
      router.replace('/admin/login');
      return;
    }
    setChecked(true);
  }, [hydrated, authUser, router, isLoginPage, hasAdminKey]);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  if (isLoginPage) return <>{children}</>;

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  const handleLogout = async () => {
    try { localStorage.removeItem('admin-key'); } catch {}
    try { await logout?.(); } catch {}
    router.replace('/admin/login');
  };

  const isActive = (item: typeof NAV_ITEMS[number]) => {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  };
  const activeNav = NAV_ITEMS.find((item) => isActive(item));

  const NavList = ({ onClickItem }: { onClickItem?: () => void }) => (
    <nav className="flex-1 space-y-1.5 p-2.5">
      {NAV_ITEMS.map((item) => {
        const active = isActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClickItem}
            className={`admin-nav-item group relative flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-[13px] font-bold ${
              active
                ? 'active bg-[#F2F7FF] text-[#3182F6]'
                : 'text-[#6B7684] hover:bg-[#F7F8FA] hover:text-[#191F28]'
            } ${collapsed && !onClickItem ? 'justify-center px-0' : ''}`}
            title={collapsed ? item.label : undefined}
          >
            {active && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-[#3182F6]" />}
            <item.icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-110" />
            {(!collapsed || onClickItem) && <span>{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );

  const BottomActions = ({ onClickItem }: { onClickItem?: () => void }) => (
    <div className="border-t border-[#F2F4F6] p-2.5 space-y-1">
      <Link
        href="/main"
        onClick={onClickItem}
        className={`admin-nav-item flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-[13px] font-bold text-[#6B7684] hover:bg-[#F7F8FA] hover:text-[#191F28] ${collapsed && !onClickItem ? 'justify-center px-0' : ''}`}
        title={collapsed ? '홈으로' : undefined}
      >
        <ExternalLink className="h-4 w-4 shrink-0" />
        {(!collapsed || onClickItem) && <span>홈으로</span>}
      </Link>
      <button
        onClick={handleLogout}
        className={`admin-nav-item flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-[13px] font-bold text-[#6B7684] hover:bg-[#FFF2F3] hover:text-[#F04452] ${collapsed && !onClickItem ? 'justify-center px-0' : ''}`}
        title={collapsed ? '로그아웃' : undefined}
      >
        <LogOut className="h-4 w-4 shrink-0" />
        {(!collapsed || onClickItem) && <span>로그아웃</span>}
      </button>
    </div>
  );

  const AdminBrandLogo = ({ compact = false }: { compact?: boolean }) => (
    <span className="flex items-center gap-2.5">
      <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-[0_8px_18px_rgba(2,32,71,0.06)] ring-1 ring-[#E5E8EB] ${compact ? 'h-9 w-9' : 'h-10 w-10'}`}>
        <Image
          src="/icon.svg"
          alt="Freetiful"
          width={compact ? 30 : 34}
          height={compact ? 30 : 34}
          priority
          className="h-7 w-7 object-contain"
        />
      </span>
      {!compact && (
        <span className="min-w-0">
          <Image
            src="/images/logo-freetiful-wordmark.svg"
            alt="Freetiful"
            width={116}
            height={34}
            priority
            className="h-[24px] w-auto object-contain"
          />
          <span className="mt-0.5 block text-[11px] font-bold text-[#8B95A1]">Admin Console</span>
        </span>
      )}
    </span>
  );

  return (
    <div className="admin-shell flex h-screen bg-[#F7F8FA] text-[#191F28]">
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col border-r border-black/[0.04] bg-white/95 shadow-[8px_0_30px_rgba(2,32,71,0.03)] backdrop-blur-xl transition-[width] duration-300 ease-out ${
          collapsed ? 'w-16' : 'w-64'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-[#F2F4F6] px-3">
          {!collapsed && (
            <Link href="/admin" className="flex min-w-0 items-center gap-2.5">
              <AdminBrandLogo />
            </Link>
          )}
          {collapsed && (
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="mx-auto rounded-2xl transition-transform hover:scale-105"
              aria-label="사이드바 열기"
              title="사이드바 열기"
            >
              <AdminBrandLogo compact />
            </button>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`admin-icon-button flex h-9 w-9 items-center justify-center rounded-2xl text-[#6B7684] hover:bg-[#F2F4F6] hover:text-[#191F28] ${collapsed ? 'hidden' : ''}`}
            aria-label={collapsed ? '사이드바 열기' : '사이드바 접기'}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
        <NavList />
        <BottomActions />
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="flex md:hidden h-14 items-center justify-between border-b border-[#F2F4F6] bg-white/90 px-4 backdrop-blur-xl">
          <Link href="/admin" className="flex items-center gap-2">
            <Image
              src="/images/logo-freetiful-wordmark.svg"
              alt="Freetiful"
              width={112}
              height={33}
              priority
              className="h-[24px] w-auto"
            />
            <span className="rounded-full bg-[#F2F7FF] px-2 py-0.5 text-[10px] font-black text-[#3182F6]">Admin</span>
          </Link>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="admin-icon-button flex h-9 w-9 items-center justify-center rounded-2xl text-[#6B7684] hover:bg-[#F2F4F6]"
            aria-label="관리자 메뉴 열기"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-[#191F28]/35 backdrop-blur-[2px]" onClick={() => setMobileOpen(false)} />
            <aside className="absolute left-0 top-0 bottom-0 w-72 flex flex-col bg-white shadow-2xl animate-[slideRight_0.22s_var(--spring)]">
              <div className="flex h-14 items-center justify-between border-b border-[#F2F4F6] px-4">
                <div className="flex items-center gap-2">
                  <Image
                    src="/images/logo-freetiful-wordmark.svg"
                    alt="Freetiful"
                    width={112}
                    height={33}
                    priority
                    className="h-[24px] w-auto"
                  />
                  <span className="rounded-full bg-[#F2F7FF] px-2 py-0.5 text-[10px] font-black text-[#3182F6]">Admin</span>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="admin-icon-button flex h-9 w-9 items-center justify-center rounded-2xl text-[#6B7684] hover:bg-[#F2F4F6]"
                  aria-label="관리자 메뉴 닫기"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <NavList onClickItem={() => setMobileOpen(false)} />
              <BottomActions onClickItem={() => setMobileOpen(false)} />
            </aside>
          </div>
        )}

        <main className="admin-main flex-1 overflow-auto bg-[#F7F8FA]">
          <div className="sticky top-0 z-20 hidden border-b border-black/[0.04] bg-white/75 px-6 py-3 backdrop-blur-xl md:block">
            <div className="mx-auto flex max-w-6xl items-center gap-3">
              <Image
                src="/images/logo-freetiful-wordmark.svg"
                alt="Freetiful"
                width={96}
                height={28}
                priority
                className="h-[21px] w-auto"
              />
              <span className="h-6 w-px bg-[#E5E8EB]" />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#B0B8C1]">Freetiful Ops</p>
                <p className="text-[15px] font-black text-[#191F28]">{activeNav?.label || '관리자'}</p>
              </div>
              <div className="ml-auto flex items-center gap-2 rounded-full bg-[#F2F4F6] px-3 py-2 text-[12px] font-bold text-[#6B7684]">
                <Command className="h-3.5 w-3.5" />
                빠른 운영 모드
              </div>
            </div>
          </div>
          <div key={pathname} className="admin-page-frame mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-7">
            {children}
          </div>
        </main>
      </div>

      <style jsx global>{`
        @keyframes slideRight { from { transform: translateX(-100%); } to { transform: translateX(0); } }
      `}</style>
    </div>
  );
}
