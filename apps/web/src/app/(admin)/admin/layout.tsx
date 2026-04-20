'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  UserCog,
  Users,
  ClipboardList,
  CreditCard,
  Star,
  Building2,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  ExternalLink,
  Package,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';

const ADMIN_EMAILS = ['admin@freetiful.com'];

const NAV_ITEMS = [
  { href: '/admin', label: '대시보드', icon: LayoutDashboard, exact: true },
  { href: '/admin/pros', label: '전문가 관리', icon: UserCog },
  { href: '/admin/plan-templates', label: '서비스 플랜', icon: Package },
  { href: '/admin/users', label: '유저 관리', icon: Users },
  { href: '/admin/bookings', label: '의뢰/예약', icon: ClipboardList },
  { href: '/admin/payments', label: '결제/정산', icon: CreditCard },
  { href: '/admin/reviews', label: '리뷰', icon: Star },
  { href: '/admin/businesses', label: 'Biz 고객사', icon: Building2 },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const authUser = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [checked, setChecked] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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
    if (!hydrated) return;
    if (isLoginPage) { setChecked(true); return; }
    if (!authUser) { router.replace('/admin/login'); return; }
    if (!authUser.email || !ADMIN_EMAILS.includes(authUser.email)) {
      router.replace('/admin/login');
      return;
    }
    setChecked(true);
  }, [hydrated, authUser, router, isLoginPage]);

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
    try { await logout?.(); } catch {}
    router.replace('/admin/login');
  };

  const isActive = (item: typeof NAV_ITEMS[number]) => {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  };

  const NavList = ({ onClickItem }: { onClickItem?: () => void }) => (
    <nav className="flex-1 space-y-0.5 p-1.5">
      {NAV_ITEMS.map((item) => {
        const active = isActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClickItem}
            className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors ${
              active
                ? 'bg-[#E8F3FF] text-[#3182F6]'
                : 'text-[#6B7684] hover:bg-white hover:text-[#191F28]'
            } ${collapsed && !onClickItem ? 'justify-center px-0' : ''}`}
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {(!collapsed || onClickItem) && <span>{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );

  const BottomActions = ({ onClickItem }: { onClickItem?: () => void }) => (
    <div className="border-t p-1.5 space-y-0.5">
      <Link
        href="/main"
        onClick={onClickItem}
        className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 ${collapsed && !onClickItem ? 'justify-center px-0' : ''}`}
        title={collapsed ? '홈으로' : undefined}
      >
        <ExternalLink className="h-4 w-4 shrink-0" />
        {(!collapsed || onClickItem) && <span>홈으로</span>}
      </Link>
      <button
        onClick={handleLogout}
        className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-red-500 ${collapsed && !onClickItem ? 'justify-center px-0' : ''}`}
        title={collapsed ? '로그아웃' : undefined}
      >
        <LogOut className="h-4 w-4 shrink-0" />
        {(!collapsed || onClickItem) && <span>로그아웃</span>}
      </button>
    </div>
  );

  return (
    <div className="flex h-screen bg-white">
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col border-r border-[#F2F4F6] bg-[#F9FAFB] transition-all duration-200 ${
          collapsed ? 'w-14' : 'w-56'
        }`}
      >
        <div className="flex h-12 items-center justify-between border-b border-[#F2F4F6] px-3">
          {!collapsed && (
            <h1 className="text-[13px] font-extrabold tracking-tight text-[#191F28]">
              Admin Console
            </h1>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex h-7 w-7 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-900"
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
        <div className="flex md:hidden h-12 items-center justify-between border-b border-gray-200 bg-gray-50 px-3">
          <h1 className="text-[13px] font-extrabold tracking-tight text-gray-900">Admin Console</h1>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="flex h-8 w-8 items-center justify-center rounded text-gray-600 hover:bg-gray-200"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
            <aside className="absolute left-0 top-0 bottom-0 w-64 flex flex-col bg-white shadow-xl animate-[slideRight_0.2s_ease-out]">
              <div className="flex h-12 items-center justify-between border-b border-gray-200 px-3">
                <h1 className="text-[13px] font-extrabold tracking-tight text-gray-900">Admin Console</h1>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:bg-gray-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <NavList onClickItem={() => setMobileOpen(false)} />
              <BottomActions onClickItem={() => setMobileOpen(false)} />
            </aside>
          </div>
        )}

        <main className="flex-1 overflow-auto bg-[#F9FAFB]">
          <div className="max-w-6xl mx-auto px-4 py-6 md:px-6 md:py-8">{children}</div>
        </main>
      </div>

      <style jsx global>{`
        @keyframes slideRight { from { transform: translateX(-100%); } to { transform: translateX(0); } }
      `}</style>
    </div>
  );
}
