'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronRight, Settings, CreditCard, Ticket, HeadphonesIcon,
  Users, FileText, Bell, LogOut, Star, Megaphone,
  Wallet, History, HelpCircle, Briefcase, UserCircle
} from 'lucide-react';

const MOCK_USER = {
  name: '홍길동',
  email: 'hong@gmail.com',
  image: 'https://i.pravatar.cc/150?img=32',
  linkedAccounts: ['kakao', 'google'],
  points: 1500,
  coupons: 2,
  role: 'general',
};

const MENU_SECTIONS = [
  {
    title: '나의 활동',
    items: [
      { href: '/my/purchase-history', icon: CreditCard, label: '구매 내역', badge: '' },
      { href: '/my/payment-history', icon: History, label: '결제/환불 내역', badge: '' },
      { href: '/my/points', icon: Wallet, label: '포인트', badge: '1,500P' },
      { href: '/my/coupons', icon: Ticket, label: '쿠폰', badge: '2장' },
    ],
  },
  {
    title: '설정',
    items: [
      { href: '/my/settings', icon: Settings, label: '프로필 설정', badge: '' },
      { href: '/my/notifications', icon: Bell, label: '알림 설정', badge: '' },
    ],
  },
  {
    title: '고객지원',
    items: [
      { href: '/my/support', icon: HeadphonesIcon, label: '고객센터', badge: '' },
      { href: '/my/faq', icon: HelpCircle, label: 'FAQ', badge: '' },
      { href: '/my/announcements', icon: Megaphone, label: '공지사항', badge: '' },
    ],
  },
  {
    title: '기타',
    items: [
      { href: '/my/invite', icon: Users, label: '친구 초대', badge: '500P 적립' },
      { href: '/my/terms', icon: FileText, label: '약관 및 정책', badge: '' },
      { href: '/pro-dashboard', icon: Briefcase, label: '파트너 신청', badge: '' },
      { href: '/general-mode', icon: UserCircle, label: '일반회원 전환', badge: '' },
    ],
  },
];

export default function MyPage() {
  const user = MOCK_USER;
  const router = useRouter();

  const handlePartnerApply = () => {
    const alreadyRegistered = localStorage.getItem('proRegistrationComplete') === 'true';
    if (alreadyRegistered) {
      localStorage.setItem('userRole', 'pro');
      window.location.reload();
    } else {
      router.push('/pro-register/terms');
    }
  };

  const handleGeneralMode = () => {
    // 일반 유저로 변경
    localStorage.setItem('userRole', 'general');
    // 홈으로 이동
    router.push('/home');
    // 페이지 새로고침하여 네비게이션 업데이트
    window.location.reload();
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white px-4 pt-12 pb-5">
        <h1 className="text-xl font-bold mb-5">마이</h1>

        {/* Profile Card */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <img src={user.image} alt={user.name} className="w-16 h-16 rounded-full object-cover" />
            <div className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5">
              <div className="w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center">
                <Star size={10} className="text-white fill-white" />
              </div>
            </div>
          </div>
          <div className="flex-1">
            <p className="text-lg font-bold text-gray-900">{user.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
            <div className="flex items-center gap-2 mt-1.5">
              {user.linkedAccounts.includes('kakao') && (
                <span className="text-[10px] bg-[#FEE500] text-[#191919] px-2 py-0.5 rounded-full font-bold">카카오</span>
              )}
              {user.linkedAccounts.includes('google') && (
                <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-bold">Google</span>
              )}
            </div>
          </div>
          <Link href="/my/settings" className="p-2">
            <ChevronRight size={20} className="text-gray-400" />
          </Link>
        </div>

        {/* Quick Stats */}
        <div className="flex mt-5 bg-gray-50 rounded-2xl overflow-hidden">
          <Link href="/my/points" className="flex-1 py-4 text-center border-r border-gray-100">
            <p className="text-lg font-black text-primary-500">{user.points.toLocaleString()}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">포인트</p>
          </Link>
          <Link href="/my/coupons" className="flex-1 py-4 text-center border-r border-gray-100">
            <p className="text-lg font-black text-primary-500">{user.coupons}</p>
            <p className="text-[10px] text-gray-500 mt-0.5">쿠폰</p>
          </Link>
          <Link href="/favorites" className="flex-1 py-4 text-center">
            <p className="text-lg font-black text-primary-500">3</p>
            <p className="text-[10px] text-gray-500 mt-0.5">찜</p>
          </Link>
        </div>
      </div>

      {/* Menu Sections */}
      <div className="mt-2">
        {MENU_SECTIONS.map((section) => (
          <div key={section.title} className="bg-white mb-2">
            <p className="px-4 pt-4 pb-2 text-xs font-bold text-gray-400 uppercase">{section.title}</p>
            {section.items.map(({ href, icon: Icon, label, badge }) => {
              // 파트너 신청은 버튼으로 처리
              if (label === '파트너 신청') {
                return (
                  <button
                    key={href}
                    onClick={handlePartnerApply}
                    className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors w-full text-left"
                  >
                    <Icon size={18} className="text-gray-500 shrink-0" />
                    <span className="flex-1 text-sm text-gray-900">{label}</span>
                    {badge && (
                      <span className="text-xs text-primary-500 font-bold">{badge}</span>
                    )}
                    <ChevronRight size={16} className="text-gray-300 shrink-0" />
                  </button>
                );
              }

              // 일반회원 전환은 버튼으로 처리
              if (label === '일반회원 전환') {
                return (
                  <button
                    key={href}
                    onClick={handleGeneralMode}
                    className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors w-full text-left"
                  >
                    <Icon size={18} className="text-gray-500 shrink-0" />
                    <span className="flex-1 text-sm text-gray-900">{label}</span>
                    {badge && (
                      <span className="text-xs text-primary-500 font-bold">{badge}</span>
                    )}
                    <ChevronRight size={16} className="text-gray-300 shrink-0" />
                  </button>
                );
              }

              return (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  <Icon size={18} className="text-gray-500 shrink-0" />
                  <span className="flex-1 text-sm text-gray-900">{label}</span>
                  {badge && (
                    <span className="text-xs text-primary-500 font-bold">{badge}</span>
                  )}
                  <ChevronRight size={16} className="text-gray-300 shrink-0" />
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {/* Logout */}
      <div className="bg-white mb-8">
        <button className="flex items-center gap-3 px-4 py-3.5 w-full hover:bg-gray-50 transition-colors text-left">
          <LogOut size={18} className="text-gray-400 shrink-0" />
          <span className="text-sm text-gray-400">로그아웃</span>
        </button>
      </div>
    </div>
  );
}
