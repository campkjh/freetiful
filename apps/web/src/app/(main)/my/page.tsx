'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, LogOut, Star } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';
import { useAuth } from '@/lib/hooks/useAuth';
import { usersApi } from '@/lib/api/users.api';
import { prosApi } from '@/lib/api/pros.api';
import { getProfileImageUrl } from '@/lib/default-profile';

/* ─── 플랫 컬러 아이콘 (첨부 이미지 톤앤매너) ─── */
// 이미지 기반 아이콘 헬퍼
const ImgIcon = ({ src }: { src: string }) => (
  <img src={src} alt="" width={20} height={20} className="shrink-0" style={{ objectFit: 'contain' }} />
);

const IconCard = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" className="shrink-0">
    <rect x="2" y="5" width="20" height="14" rx="3" fill="#3B82F6"/>
    <rect x="2" y="9" width="20" height="3" fill="#2563EB"/>
    <rect x="5" y="15" width="6" height="2" rx="1" fill="white" opacity="0.7"/>
  </svg>
);
const IconHistory = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" className="shrink-0">
    <circle cx="12" cy="12" r="10" fill="#3B82F6"/>
    <path d="M12 7v5l3.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);
const IconWallet = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" className="shrink-0">
    <rect x="2" y="6" width="20" height="14" rx="3" fill="#10B981"/>
    <path d="M2 6h20V4a2 2 0 00-2-2H4a2 2 0 00-2 2v2z" fill="#059669"/>
    <text x="8" y="16" fill="white" fontSize="9" fontWeight="bold" fontFamily="system-ui">₩</text>
  </svg>
);
const IconTicket = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" className="shrink-0">
    <rect x="2" y="5" width="20" height="14" rx="3" fill="#F59E0B"/>
    <circle cx="2" cy="12" r="3" fill="white"/>
    <circle cx="22" cy="12" r="3" fill="white"/>
    <rect x="10" y="8" width="4" height="8" rx="1" fill="white" opacity="0.5"/>
  </svg>
);
const IconSettings = () => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" className="shrink-0">
    <path d="M2 7.5A4.5 4.5 0 016.5 3h11A4.5 4.5 0 0122 7.5v9a4.5 4.5 0 01-4.5 4.5h-11A4.5 4.5 0 012 16.5v-9z" fill="#4B5563"/>
    <circle cx="12" cy="12.5" r="4" stroke="white" strokeWidth="2" fill="none"/>
    <circle cx="12" cy="12.5" r="1.5" fill="white"/>
    <path d="M9 3h6v1.5a1.5 1.5 0 01-1.5 1.5h-3A1.5 1.5 0 019 4.5V3z" fill="#4B5563"/>
  </svg>
);
const IconBell = () => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" className="shrink-0">
    <path d="M12 2.5c-4 0-7 3.2-7 7v4.5L3 16.5V18h18v-1.5L19 14V9.5c0-3.8-3-7-7-7z" fill="#F6C754"/>
    <circle cx="12" cy="19.5" r="2.5" fill="#E8A23E"/>
  </svg>
);
const IconHeadphones = () => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" className="shrink-0">
    <path d="M4 13v-1a8 8 0 0116 0v1" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round"/>
    <rect x="2" y="13" width="5" height="7" rx="2.5" fill="#4B8DF8"/>
    <rect x="17" y="13" width="5" height="7" rx="2.5" fill="#4B8DF8"/>
  </svg>
);
const IconHelp = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" className="shrink-0">
    <circle cx="12" cy="12" r="10" fill="#F59E0B"/>
    <text x="12" y="16.5" textAnchor="middle" fill="white" fontSize="13" fontWeight="bold" fontFamily="system-ui">?</text>
  </svg>
);
const IconMegaphone = () => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" className="shrink-0">
    <path d="M7 14v5.5a2 2 0 002 2h0a2 2 0 002-2V14" fill="#F87171"/>
    <rect x="3" y="8" width="7" height="8" rx="2" fill="#FCA5A5"/>
    <path d="M10 9c0 0 5-3 9-4.5v15c-4-1.5-9-4.5-9-4.5V9z" fill="#EF4444"/>
    <rect x="19" y="9" width="3" height="6" rx="1.5" fill="#DC2626"/>
  </svg>
);
const IconUsers = () => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" className="shrink-0">
    <circle cx="9" cy="7" r="4" fill="#818CF8"/>
    <rect x="2" y="14" width="14" height="8" rx="4" fill="#818CF8"/>
    <circle cx="18" cy="8" r="3" fill="#C4B5FD"/>
    <rect x="12" y="15" width="11" height="7" rx="3.5" fill="#C4B5FD"/>
  </svg>
);
const IconFile = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" className="shrink-0">
    <path d="M6 2h8l6 6v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z" fill="#D1D5DB"/>
    <path d="M14 2l6 6h-4a2 2 0 01-2-2V2z" fill="#9CA3AF"/>
    <rect x="7" y="12" width="10" height="1.5" rx="0.75" fill="white"/>
    <rect x="7" y="15" width="7" height="1.5" rx="0.75" fill="white"/>
  </svg>
);
const IconBriefcase = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" className="shrink-0">
    <rect x="2" y="7" width="20" height="13" rx="3" fill="#6366F1"/>
    <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" stroke="#4F46E5" strokeWidth="2"/>
    <rect x="10" y="11" width="4" height="3" rx="1" fill="white" opacity="0.6"/>
  </svg>
);
const IconUser = () => (
  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" className="shrink-0">
    <path d="M7.5 4A7.5 7.5 0 0119.3 8" stroke="#4B8DF8" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M19.3 8l1.2-3.2M19.3 8l-3.3-.8" stroke="#4B8DF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16.5 20A7.5 7.5 0 014.7 16" stroke="#4B8DF8" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M4.7 16l-1.2 3.2M4.7 16l3.3.8" stroke="#4B8DF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const PRO_CATEGORY_CACHE_KEY = 'freetiful-my-pro-category';

function readStoredProCategory() {
  if (typeof window === 'undefined') return '사회자';
  try {
    return localStorage.getItem(PRO_CATEGORY_CACHE_KEY) || '사회자';
  } catch {
    return '사회자';
  }
}

function writeStoredProProfileStatus(status: 'draft' | 'pending' | 'approved' | 'rejected' | null) {
  if (typeof window === 'undefined') return;
  try {
    if (status) localStorage.setItem('proRegistrationComplete', status);
    else localStorage.removeItem('proRegistrationComplete');
  } catch {}
}

function readStoredProProfileStatus(): 'draft' | 'pending' | 'approved' | 'rejected' | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('proRegistrationComplete');
    if (raw === 'draft' || raw === 'pending' || raw === 'approved' || raw === 'rejected') return raw;
  } catch {}
  return null;
}

function clearStoredProModeForCurrentAccount() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('proRegistrationComplete');
    localStorage.removeItem('freetiful-my-pro-id');
    localStorage.removeItem(PRO_CATEGORY_CACHE_KEY);
    localStorage.removeItem('freetiful-pro-dashboard-cache-v2');
    localStorage.removeItem('pro-quotes');
    if (localStorage.getItem('userRole') === 'pro') {
      localStorage.setItem('userRole', 'general');
    }
  } catch {}
}

const MENU_SECTIONS = [
  {
    title: '설정',
    items: [
      { href: '/my/settings', icon: () => <ImgIcon src="/images/profile-settings.svg" />, label: '프로필 설정' },
    ],
  },
  {
    title: '나의 활동',
    items: [
      { href: '/my/purchase-history', icon: () => <ImgIcon src="/images/purchase-history.svg" />, label: '구매 내역' },
      { href: '/my/payment-history', icon: IconHistory, label: '결제/환불 내역' },
    ],
  },
  {
    title: '고객지원',
    items: [
      { href: '/my/support', icon: () => <ImgIcon src="/images/support.svg" />, label: '고객센터' },
      { href: '/my/faq', icon: () => <ImgIcon src="/images/faq-icon.svg" />, label: 'FAQ' },
      { href: '/my/announcements', icon: () => <ImgIcon src="/images/announcements.svg" />, label: '공지사항' },
    ],
  },
  {
    title: '기타',
    items: [
      { href: '/my/invite', icon: () => <ImgIcon src="/images/invite-friend.svg" />, label: '친구 초대', badge: '5,000원 이벤트' },
      { href: '/my/terms', icon: IconFile, label: '약관 및 정책' },
      { href: '/pro-register/terms', icon: () => <ImgIcon src="/images/partners-apply.svg" />, label: '파트너 신청', action: 'partner' },
    ],
  },
];

// 긴 이메일은 20자에서 잘라 ... 붙임 (실제 이메일 그대로 보여주면 공간 넘침)
function truncateEmail(email: string, max = 20): string {
  if (!email) return '';
  return email.length <= max ? email : email.slice(0, max) + '...';
}

export default function MyPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState({ name: '게스트', email: '', image: getProfileImageUrl(null, 'guest'), linkedAccounts: [] as string[], role: 'general' });
  const authUser = useAuthStore((s) => s.user);
  const authHydrated = useAuthStore((s) => s.hasHydrated);
  const { logout: authLogout } = useAuth();
  const router = useRouter();
  const [proProfileStatus, setProProfileStatus] = useState<'draft' | 'pending' | 'approved' | 'rejected' | null>(() => readStoredProProfileStatus());
  const [proRegistrationPending, setProRegistrationPending] = useState(() => readStoredProProfileStatus() === 'pending');

  // 최근 30초 이내 방문 시 진입 애니메이션 스킵 (하위 페이지 뒤로가기 중복 방지)
  const skipAnim = (() => {
    if (typeof window === 'undefined') return false;
    try {
      const last = Number(sessionStorage.getItem('my-page-visited-at') || '0');
      const skip = last && Date.now() - last < 30000;
      sessionStorage.setItem('my-page-visited-at', String(Date.now()));
      return !!skip;
    } catch { return false; }
  })();
  const animOrNone = (base: React.CSSProperties) => skipAnim ? undefined : base;

  useEffect(() => {
    let cancelled = false;
    const loggedIn = authUser !== null;
    setIsLoggedIn(loggedIn);

    if (authUser) {
      // Use real API data
      setUser({
        name: authUser.name || '게스트',
        email: authUser.email || '',
        image: getProfileImageUrl(authUser.profileImageUrl, authUser.id || authUser.email || authUser.name),
        linkedAccounts: [],
        role: authUser.role,
      });
    } else {
      setProProfileStatus(null);
      setProRegistrationPending(false);
    }

    return () => { cancelled = true; };
  }, [authUser]);

  useEffect(() => {
    if (!isLoggedIn || !authUser) {
      setProRegistrationPending(false);
      setProProfileStatus(null);
      return;
    }

    let cancelled = false;

    // 백엔드의 "현재 로그인 계정" 상태를 기준으로 프로 신청/승인 상태를 동기화한다.
    // localStorage는 빠른 캐시일 뿐 권한 판정의 원천으로 사용하지 않는다.
    usersApi.getProfile()
      .then(async (profileUser: any) => {
        if (cancelled) return;
        const status = (profileUser?.proProfile?.status || null) as 'draft' | 'pending' | 'approved' | 'rejected' | null;
        const serverRole = profileUser?.role || authUser.role || 'general';

        setProProfileStatus(status);
        setProRegistrationPending(status === 'pending');
        writeStoredProProfileStatus(status);

        if (!profileUser?.proProfile) {
          clearStoredProModeForCurrentAccount();
        } else if (profileUser.proProfile.id) {
          try { localStorage.setItem('freetiful-my-pro-id', profileUser.proProfile.id); } catch {}
        }

        const shouldSyncBaseProfileImage = !profileUser?.proProfile;
        if (
          profileUser?.id === authUser.id &&
          (
            profileUser.role !== authUser.role ||
            profileUser.name !== authUser.name ||
            (shouldSyncBaseProfileImage && profileUser.profileImageUrl !== authUser.profileImageUrl)
          )
        ) {
          useAuthStore.getState().setUser({
            ...authUser,
            role: serverRole,
            name: profileUser.name,
            profileImageUrl: shouldSyncBaseProfileImage ? profileUser.profileImageUrl : authUser.profileImageUrl,
          });
        }

        if (status) {
          const profile = await prosApi.getMyProfile().catch(() => null);
          if (cancelled || !profile) return;
          const primary = (profile as any)?.images?.find((img: any) => img.isPrimary) || (profile as any)?.images?.[0];
          const effectiveImage = primary?.imageUrl || (profile as any)?.user?.profileImageUrl;
          if (effectiveImage && effectiveImage !== useAuthStore.getState().user?.profileImageUrl) {
            const currentUser = useAuthStore.getState().user || authUser;
            useAuthStore.getState().setUser({
              ...currentUser,
              profileImageUrl: effectiveImage,
            });
            if (currentUser.id === authUser.id) {
              setUser((prev) => ({ ...prev, image: effectiveImage }));
            }
          }
        }
      })
      .catch(() => {
        if (!cancelled && authUser.role !== 'pro') {
          setProProfileStatus(null);
          setProRegistrationPending(false);
        }
      });

    return () => { cancelled = true; };
  }, [isLoggedIn, authUser]);

  const handlePartnerApply = () => {
    if (!authUser) {
      window.dispatchEvent(new Event('freetiful:show-login'));
      return;
    }

    if (proProfileStatus === 'approved') {
      router.push('/pro-dashboard/inquiries');
    } else {
      router.push('/pro-register/terms');
    }
  };

  // 로그아웃 확인 모달
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const handleLogout = () => setShowLogoutConfirm(true);
  const executeLogout = () => {
    setShowLogoutConfirm(false);
    if (authUser) {
      authLogout();
    }
    localStorage.removeItem('freetiful-logged-in');
    localStorage.removeItem('freetiful-user');
    localStorage.removeItem('userRole');
    router.push('/');
  };


  return (
    <div className="bg-white min-h-screen pb-24" style={{ letterSpacing: '-0.02em' }}>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white px-4">
        <div className="h-[52px] flex items-center">
          <h1 className="text-[18px] font-bold text-gray-900">마이페이지</h1>
        </div>
      </div>

      {/* Profile — 로그인 안 되었으면 로그인 유도 */}
      {!isLoggedIn ? (
        <div className="px-4 pb-4 pt-2" style={animOrNone({ animation: 'myFadeUp 0.5s ease forwards' })}>
          <div className="rounded-2xl bg-gray-50 p-5 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-3">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="8" r="4" fill="#9CA3AF" />
                <path d="M4 21C4 17 7.58 14 12 14C16.42 14 20 17 20 21H4Z" fill="#9CA3AF" />
              </svg>
            </div>
            <p className="text-[16px] font-bold text-gray-900 mb-1">로그인이 필요합니다</p>
            <p className="text-[13px] text-gray-400 mb-4">로그인하고 다양한 서비스를 이용해보세요</p>
            <button
              onClick={() => {
                window.dispatchEvent(new Event('freetiful:show-login'));
              }}
              className="inline-block bg-gray-900 text-white font-semibold text-[14px] px-6 py-2.5 rounded-xl active:scale-[0.97] transition-transform"
            >
              로그인 / 회원가입
            </button>
          </div>
        </div>
      ) : (
      <div className="px-4 pb-3" style={animOrNone({ animation: 'myFadeUp 0.5s ease forwards' })}>
        <Link href="/my/settings" className="flex items-center gap-3.5 active:opacity-80 transition-opacity">
          <div className="relative">
            <img src={getProfileImageUrl(user.image, user.email || user.name)} alt={user.name} onError={(e) => { (e.target as HTMLImageElement).src = getProfileImageUrl(null, user.email || user.name); }} className="w-[56px] h-[56px] rounded-full object-cover bg-gray-100" />
            <div className="absolute -bottom-0.5 -right-0.5 bg-white rounded-full p-0.5">
              <div className="w-4.5 h-4.5 bg-[#2B313D] rounded-full flex items-center justify-center" style={{ width: 18, height: 18 }}>
                <Star size={9} className="text-white fill-white" />
              </div>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[17px] font-bold text-gray-900">{user.name}</p>
              {user.linkedAccounts.includes('kakao') && (
                <span className="w-[20px] h-[20px] rounded-full bg-[#FEE500] flex items-center justify-center shrink-0">
                  <svg width="11" height="10" viewBox="0 0 24 22" fill="#3C1E1E"><path d="M12 1C5.37 1 0 5.13 0 10.2c0 3.26 2.17 6.12 5.44 7.74l-1.1 4.07c-.1.36.31.65.63.44l4.83-3.2c.72.1 1.46.15 2.2.15 6.63 0 12-4.13 12-9.2S18.63 1 12 1z"/></svg>
                </span>
              )}
              {user.linkedAccounts.includes('google') && (
                <span className="w-[20px] h-[20px] rounded-full bg-white border border-gray-200 flex items-center justify-center shrink-0">
                  <svg width="12" height="12" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                </span>
              )}
              {user.linkedAccounts.includes('naver') && (
                <span className="w-[20px] h-[20px] rounded-full bg-[#03C75A] flex items-center justify-center shrink-0">
                  <svg width="10" height="10" viewBox="0 0 20 20" fill="white"><path d="M13.56 10.7L6.17 0H0v20h6.44V9.3L13.83 20H20V0h-6.44z"/></svg>
                </span>
              )}
              {user.linkedAccounts.includes('apple') && (
                <span className="w-[20px] h-[20px] rounded-full bg-black flex items-center justify-center shrink-0">
                  <svg width="10" height="12" viewBox="0 0 17 20" fill="white"><path d="M13.25 10.06c-.02-2.08 1.7-3.08 1.78-3.13-1-1.42-2.5-1.62-3.04-1.64-1.28-.13-2.53.76-3.18.76-.66 0-1.66-.75-2.74-.73A4.05 4.05 0 002.63 7.5C.86 10.53 2.18 14.95 3.88 17.38c.85 1.2 1.85 2.53 3.16 2.48 1.28-.05 1.76-.8 3.3-.8s1.98.8 3.32.77c1.37-.02 2.23-1.2 3.06-2.41.98-1.38 1.38-2.73 1.4-2.8-.03-.01-2.67-1.02-2.7-4.06-.02-2.55 2.08-3.78 2.18-3.84-1.2-1.76-3.06-1.96-3.72-2z"/></svg>
                </span>
              )}
            </div>
            <p className="text-[13px] text-gray-400 mt-0.5">{truncateEmail(user.email)}</p>
          </div>
          <ChevronRight size={20} className="text-gray-300 shrink-0" />
        </Link>

        {/* Pro Registration Pending Banner */}
        {proRegistrationPending && proProfileStatus !== 'approved' && (
          <div
            className="mt-3 rounded-xl bg-blue-50 border border-blue-100 px-4 py-3.5"
            style={animOrNone({ animation: 'myFadeUp 0.5s ease 0.08s both' })}
          >
            <div className="flex items-center gap-1.5">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="4" y="2" width="16" height="20" rx="2.5" fill="#93C5FD"/>
                <rect x="4" y="2" width="16" height="6" rx="2.5" fill="#60A5FA"/>
                <rect x="7.5" y="11" width="9" height="1.5" rx="0.75" fill="white" opacity="0.7"/>
                <rect x="7.5" y="14.5" width="6" height="1.5" rx="0.75" fill="white" opacity="0.5"/>
                <circle cx="18" cy="18" r="5" fill="#3B82F6"/>
                <path d="M15.5 18l1.5 1.5 3-3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p className="text-[14px] font-bold text-blue-700">사회자 양식 제출완료!</p>
            </div>
            <p className="text-[12px] text-blue-500 mt-1 ml-[26px]">심사를 기다려주세요. 7일 이내에 결과를 알려드립니다.</p>
          </div>
        )}

        {/* Pro Rejected Banner */}
        {proProfileStatus === 'rejected' && (
          <div
            className="mt-3 rounded-xl bg-red-50 border border-red-100 px-4 py-3.5"
            style={animOrNone({ animation: 'myFadeUp 0.5s ease 0.08s both' })}
          >
            <p className="text-[14px] font-bold text-red-700">파트너 신청이 반려되었습니다</p>
            <p className="text-[12px] text-red-500 mt-1">신청 조건을 재확인 후 다시 신청해 주세요.</p>
          </div>
        )}

      </div>
      )}

      {/* Menu Sections */}
      {MENU_SECTIONS.map((section, si) => (
        <div key={section.title} style={animOrNone({ animation: `myFadeUp 0.4s ease ${0.2 + si * 0.08}s both` })}>
          {si > 0 && <div className="h-1.5 bg-gray-50" />}
          <div className="px-4 pt-3 pb-0.5">
            <p className="text-[12px] font-bold text-gray-400">{section.title}</p>
          </div>
          {section.items.map(({ href, icon: Icon, label, badge, action }: { href: string; icon: () => JSX.Element; label: string; badge?: string; action?: string }) => {
            // Partner registration conditional logic
            if (action === 'partner') {
              if (authUser?.role === 'pro' && proProfileStatus === null) return null;
              if (proProfileStatus === 'approved') return null;
              if (proProfileStatus === 'pending') {
                return (
                  <div key={label} className="flex items-center gap-3 px-4 py-2.5 w-full opacity-50 cursor-not-allowed">
                    <Icon />
                    <span className="flex-1 text-[14px] text-gray-400">{label}</span>
                    <span className="text-[11px] text-white font-medium px-2.5 py-0.5 rounded-full bg-blue-500">심사 중</span>
                    <ChevronRight size={16} className="text-gray-300 shrink-0" />
                  </div>
                );
              }
              // Not submitted, show normally
              return (
                <button key={label} onClick={handlePartnerApply} className="flex items-center gap-3 px-4 py-2.5 w-full text-left active:bg-gray-50 transition-colors">
                  <Icon />
                  <span className="flex-1 text-[14px] text-gray-900">{label}</span>
                  {badge && <span className="text-[11px] text-white font-medium px-2.5 py-0.5 rounded-full" style={{ backgroundColor: '#2B313D' }}>{badge}</span>}
                  <ChevronRight size={16} className="text-gray-300 shrink-0" />
                </button>
              );
            }

            const displayBadge = badge;
            const inner = (
              <>
                <Icon />
                <span className="flex-1 text-[14px] text-gray-900">{label}</span>
                {displayBadge && <span className="text-[11px] text-white font-medium px-2.5 py-0.5 rounded-full" style={{ backgroundColor: '#2B313D' }}>{displayBadge}</span>}
                <ChevronRight size={16} className="text-gray-300 shrink-0" />
              </>
            );

            // 미로그인 상태에서 메뉴 항목 클릭 시 → 네이티브 로그인 팝업 (또는 웹 모달)
            if (!isLoggedIn) {
              return (
                <button
                  key={label}
                  onClick={(e) => {
                    e.preventDefault();
                    window.dispatchEvent(new Event('freetiful:show-login'));
                  }}
                  className="flex items-center gap-3 px-4 py-2.5 w-full text-left active:bg-gray-50 transition-colors"
                >
                  {inner}
                </button>
              );
            }
            return (
              <Link key={label} href={href} className="flex items-center gap-3 px-4 py-2.5 active:bg-gray-50 transition-colors">
                {inner}
              </Link>
            );
          })}
        </div>
      ))}

      {/* Logout */}
      <div className="h-1.5 bg-gray-50" />
      <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 w-full active:bg-gray-50 transition-colors">
        <LogOut size={18} className="text-gray-400 shrink-0" />
        <span className="text-[14px] text-gray-400">로그아웃</span>
      </button>

      <div className="px-4 pt-1 pb-8 flex justify-end">
        {isLoggedIn ? (
          <Link href="/my/notifications" className="text-[11px] font-medium text-gray-300 active:text-gray-400 transition-colors">
            알림 설정
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('freetiful:show-login'))}
            className="text-[11px] font-medium text-gray-300 active:text-gray-400 transition-colors"
          >
            알림 설정
          </button>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes myFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />

      {/* ─── 로그아웃 확인 모달 ─────────────────────────────────────── */}
      {showLogoutConfirm && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center px-6"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[16px] font-bold text-gray-900 text-center mb-5">
              로그아웃 하시겠어요?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 font-semibold text-[14px] active:scale-95 transition-transform"
              >
                아니오
              </button>
              <button
                onClick={executeLogout}
                className="flex-1 py-3 rounded-xl bg-gray-900 text-white font-semibold text-[14px] active:scale-95 transition-transform"
              >
                예
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
