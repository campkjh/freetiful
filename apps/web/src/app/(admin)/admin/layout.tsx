'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/auth.store';

// 어드민 권한을 가진 이메일 목록
const ADMIN_EMAILS = [
  'admin@freetiful.com',
];

const TABS = [
  { href: '/admin/users', label: '유저 관리' },
  { href: '/admin/pros', label: '프로 관리' },
  { href: '/admin/bookings', label: '의뢰/예약' },
  { href: '/admin/payments', label: '결제/정산' },
  { href: '/admin/businesses', label: 'Biz 고객사' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const authUser = useAuthStore((s) => s.user);
  const [checked, setChecked] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const isLoginPage = pathname === '/admin/login';

  // zustand persist 하이드레이션 완료까지 대기 — 새로고침 시 첫 렌더에선 user=null 이라 바로 체크하면 /admin/login 로 튕김
  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (isLoginPage) {
      setChecked(true);
      return;
    }
    if (!hydrated) return; // 하이드레이션 전엔 판단 보류
    if (!authUser) {
      router.replace('/admin/login');
      return;
    }
    if (!authUser.email || !ADMIN_EMAILS.includes(authUser.email)) {
      router.replace('/admin/login');
      return;
    }
    setChecked(true);
  }, [authUser, router, isLoginPage, hydrated]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/admin/users" className="text-[18px] font-black text-gray-900">
            Freetiful Admin
          </Link>
          <Link href="/main" className="text-[13px] text-gray-500 hover:text-gray-900">
            ← 홈으로
          </Link>
        </div>
        <nav className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-4 py-3 text-[13px] font-medium whitespace-nowrap border-b-2 transition-colors ${
                  active
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
