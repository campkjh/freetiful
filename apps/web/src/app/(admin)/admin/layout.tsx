'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ChevronDown,
  ExternalLink,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';

const ADMIN_EMAILS = ['admin@freetiful.com'];

function isAdminUser(user: { email?: string | null; role?: string | null } | null) {
  return !!user && (user.role === 'admin' || (!!user.email && ADMIN_EMAILS.includes(user.email)));
}

type AdminNavItem = {
  href: string;
  label: string;
  exact?: boolean;
};

const TOP_NAV = [
  { href: '/admin', label: '홈', exact: true, paths: ['/admin'] },
  { href: '/admin/users', label: '유저 센터', paths: ['/admin/users'] },
  { href: '/admin/pros', label: '전문가 센터', paths: ['/admin/pros', '/admin/partners', '/admin/businesses'] },
  { href: '/admin/bookings', label: '예약 센터', paths: ['/admin/bookings'] },
  { href: '/admin/inquiries', label: '문의 센터', paths: ['/admin/inquiries'] },
  { href: '/admin/payments', label: '페이먼츠 센터', paths: ['/admin/payments', '/admin/settlements'] },
  { href: '/admin/banners', label: '콘텐츠 센터', paths: ['/admin/banners', '/admin/reviews', '/admin/announcements', '/admin/faqs', '/admin/policies', '/admin/plan-templates'] },
];

const NAV_SECTIONS: Array<{ label: string; items: AdminNavItem[] }> = [
  {
    label: '운영 홈',
    items: [
      { href: '/admin', label: '관리자 홈', exact: true },
    ],
  },
  {
    label: '유저 센터',
    items: [
      { href: '/admin/users', label: '유저 관리' },
      { href: '/admin/pros', label: '전문가 관리' },
      { href: '/admin/partners', label: '웨딩 파트너 업체' },
      { href: '/admin/businesses', label: 'Biz 고객사' },
    ],
  },
  {
    label: '거래 센터',
    items: [
      { href: '/admin/bookings', label: '의뢰/예약' },
      { href: '/admin/payments', label: '결제조회' },
      { href: '/admin/settlements', label: '정산내역' },
    ],
  },
  {
    label: '문의 센터',
    items: [
      { href: '/admin/inquiries', label: 'Biz 문의' },
    ],
  },
  {
    label: '콘텐츠 센터',
    items: [
      { href: '/admin/banners', label: '배너 관리' },
      { href: '/admin/reviews', label: '리뷰 관리' },
      { href: '/admin/announcements', label: '공지사항' },
      { href: '/admin/faqs', label: 'FAQ' },
      { href: '/admin/policies', label: '약관 관리' },
      { href: '/admin/plan-templates', label: '서비스 플랜' },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const authUser = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [checked, setChecked] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hasAdminKey, setHasAdminKey] = useState(false);

  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    const store: any = useAuthStore as any;
    if (store.persist?.hasHydrated?.()) {
      setHydrated(true);
      return;
    }
    const unsubscribe = store.persist?.onFinishHydration?.(() => setHydrated(true));
    const timeout = setTimeout(() => setHydrated(true), 250);
    return () => {
      unsubscribe?.();
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    const refreshAdminKey = () => {
      try {
        setHasAdminKey(!!localStorage.getItem('admin-key'));
      } catch {
        setHasAdminKey(false);
      }
    };
    refreshAdminKey();
    window.addEventListener('storage', refreshAdminKey);
    window.addEventListener('freetiful:admin-key-changed', refreshAdminKey);
    return () => {
      window.removeEventListener('storage', refreshAdminKey);
      window.removeEventListener('freetiful:admin-key-changed', refreshAdminKey);
    };
  }, [pathname]);

  useEffect(() => {
    if (!hydrated) return;
    if (isLoginPage) {
      setChecked(true);
      return;
    }
    if (hasAdminKey) {
      setChecked(true);
      return;
    }
    if (!authUser) {
      router.replace('/admin/login');
      return;
    }
    if (!isAdminUser(authUser)) {
      router.replace('/admin/login');
      return;
    }
    setChecked(true);
  }, [hydrated, authUser, router, isLoginPage, hasAdminKey]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const activeLabel = useMemo(() => {
    for (const section of NAV_SECTIONS) {
      const item = section.items.find((nav) => (nav.exact ? pathname === nav.href : pathname.startsWith(nav.href)));
      if (item) return item.label;
    }
    return '관리자';
  }, [pathname]);

  const handleLogout = async () => {
    try {
      localStorage.removeItem('admin-key');
    } catch {}
    try {
      await logout?.();
    } catch {}
    router.replace('/admin/login');
  };

  const isTopActive = (item: typeof TOP_NAV[number]) => {
    if (item.exact) return pathname === item.href;
    return item.paths.some((path) => pathname.startsWith(path));
  };

  const isSideActive = (item: AdminNavItem) => {
    if (item.exact) return pathname === item.href;
    return pathname.startsWith(item.href);
  };

  const AdminBrand = () => (
    <Link href="/admin" className="flex min-w-0 items-center gap-4" aria-label="Freetiful 관리자 홈">
      <Image
        src="/images/logo-freetiful-wordmark.svg"
        alt="Freetiful"
        width={118}
        height={34}
        priority
        className="h-[24px] w-auto object-contain"
      />
      <span className="hidden h-4 w-px bg-[#E5E8EB] sm:block" />
      <span className="hidden whitespace-nowrap text-[16px] font-bold leading-none text-[#191F28] sm:block">관리자 센터</span>
    </Link>
  );

  const Sidebar = ({ onClickItem }: { onClickItem?: () => void }) => (
    <nav className="space-y-5">
      {NAV_SECTIONS.map((section) => (
        <section key={section.label} className="space-y-1">
          <div className="flex w-full items-center justify-between px-6 pb-1 text-left text-[13px] font-medium text-[#8B95A1]">
            <span>{section.label}</span>
            <ChevronDown className="h-3.5 w-3.5 text-[#B0B8C1]" />
          </div>
          <div className="space-y-1">
            {section.items.map((item) => {
              const active = isSideActive(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClickItem}
                  className={`admin-nav-item block min-h-[54px] rounded-lg px-6 py-[17px] text-[14px] font-semibold leading-5 ${
                    active
                      ? 'active bg-[#F7F9FC] text-[#3180F7]'
                      : 'text-[#8B95A1] hover:bg-[#F7F9FC] hover:text-[#191F28]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );

  if (isLoginPage) return <>{children}</>;

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#E5E8EB] border-t-[#3180F7]" />
      </div>
    );
  }

  return (
    <div className="admin-shell flex h-screen flex-col overflow-hidden bg-white text-[#191F28]">
      <header className="admin-topbar flex h-[68px] shrink-0 items-center border-b border-[#E5E8EB] bg-white px-5 md:px-8 xl:px-[60px]">
        <AdminBrand />

        <nav className="ml-12 hidden h-full items-center gap-7 lg:flex">
          {TOP_NAV.map((item) => {
            const active = isTopActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`admin-topnav-link flex h-full items-center text-[14px] font-medium ${
                  active ? 'text-[#3180F7]' : 'text-[#4E5968] hover:text-[#3180F7]'
                }`}
              >
                <span className="relative flex h-full items-center">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto hidden items-center gap-3 md:flex">
          <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#F2F7FF]">
            {authUser?.profileImageUrl ? (
              <span
                role="img"
                aria-label={authUser.name || '관리자'}
                className="h-full w-full bg-cover bg-center"
                style={{ backgroundImage: `url(${authUser.profileImageUrl})` }}
              />
            ) : (
              <Image src="/icon.svg" alt="관리자" width={24} height={24} className="h-6 w-6 object-contain" />
            )}
          </span>
          <span className="max-w-[120px] truncate text-[13px] font-semibold text-[#191F28]">
            {authUser?.name || '관리자'}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="admin-icon-button flex items-center gap-1.5 rounded-md px-2.5 py-2 text-[12px] font-normal text-[#8B95A1] hover:bg-[#F7F8FA] hover:text-[#3180F7]"
          >
            <LogOut className="h-4 w-4" />
            로그아웃
          </button>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="admin-icon-button ml-auto flex h-10 w-10 items-center justify-center rounded-md text-[#4E5968] hover:bg-[#F7F8FA] md:hidden"
          aria-label="관리자 메뉴 열기"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[304px] shrink-0 overflow-y-auto border-r border-[#F2F4F6] bg-white px-6 py-8 md:block">
          <Sidebar />
          <div className="mt-8 border-t border-[#F2F4F6] pt-5">
            <Link
              href="/main"
              className="admin-nav-item flex min-h-[54px] items-center gap-2 rounded-lg px-6 py-[17px] text-[14px] font-semibold text-[#8B95A1] hover:bg-[#F7F9FC] hover:text-[#191F28]"
            >
              <ExternalLink className="h-4 w-4" />
              홈으로
            </Link>
          </div>
        </aside>

        <main className="admin-main min-w-0 flex-1 overflow-auto bg-white">
          <div className="admin-page-frame w-full px-5 py-8 md:px-9 lg:px-12 xl:px-14 2xl:px-[54px]" key={pathname}>
            <div className="mb-7 flex items-center justify-between border-b border-transparent md:hidden">
              <div>
                <p className="text-[12px] font-normal text-[#B0B8C1]">관리자 센터</p>
                <h1 className="mt-1 text-[16px] font-bold text-[#191F28]">{activeLabel}</h1>
              </div>
            </div>
            {children}
          </div>
        </main>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-[#191F28]/35 backdrop-blur-[2px]" onClick={() => setMobileOpen(false)} />
          <aside className="admin-mobile-drawer absolute bottom-0 left-0 top-0 flex w-[320px] max-w-[86vw] flex-col bg-white shadow-2xl">
            <div className="flex h-[68px] items-center justify-between border-b border-[#E5E8EB] px-5">
              <AdminBrand />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="admin-icon-button flex h-10 w-10 items-center justify-center rounded-md text-[#4E5968] hover:bg-[#F7F8FA]"
                aria-label="관리자 메뉴 닫기"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-6">
              <Sidebar onClickItem={() => setMobileOpen(false)} />
              <div className="mt-8 border-t border-[#F2F4F6] pt-5">
                <Link
                  href="/main"
                  onClick={() => setMobileOpen(false)}
                  className="admin-nav-item flex min-h-[54px] items-center gap-2 rounded-lg px-6 py-[17px] text-[14px] font-semibold text-[#8B95A1] hover:bg-[#F7F9FC] hover:text-[#191F28]"
                >
                  <ExternalLink className="h-4 w-4" />
                  홈으로
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="admin-nav-item mt-1 flex min-h-[54px] w-full items-center gap-2 rounded-lg px-6 py-[17px] text-[14px] font-semibold text-[#8B95A1] hover:bg-[#F7F9FC] hover:text-[#3180F7]"
                >
                  <LogOut className="h-4 w-4" />
                  로그아웃
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
