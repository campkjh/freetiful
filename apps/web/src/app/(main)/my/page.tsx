'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, LogOut, Star, Clock, MapPin } from 'lucide-react';
import { getPoints } from '@/lib/points';
import { useAuthStore } from '@/lib/store/auth.store';
import { useAuth } from '@/lib/hooks/useAuth';
import { usersApi } from '@/lib/api/users.api';
import { prosApi } from '@/lib/api/pros.api';
import { apiClient } from '@/lib/api/client';

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

const UPCOMING_SCHEDULES: { id: string; proName: string; category: string; date: string; time: string; location: string; proImage: string }[] = [];

type ProStats = { revenue: number; reviews: number; pudding: number; rank: number | null };

const PRO_STATS_EMPTY: ProStats = { revenue: 0, reviews: 0, pudding: 0, rank: null };
const MY_PRO_STATS_CACHE_KEY = 'freetiful-my-pro-stats-cache-v1';
const PUDDING_STORAGE_KEY = 'freetiful-pudding';
const PRO_CATEGORY_CACHE_KEY = 'freetiful-my-pro-category';

function readStoredPudding() {
  if (typeof window === 'undefined') return 0;
  try {
    return Number(localStorage.getItem(PUDDING_STORAGE_KEY) || 0);
  } catch {
    return 0;
  }
}

function readCachedProStats(): ProStats | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(MY_PRO_STATS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const rank = parsed.rank == null ? null : Number(parsed.rank);
    return {
      revenue: Number(parsed.revenue || 0),
      reviews: Number(parsed.reviews || 0),
      pudding: Number(parsed.pudding ?? readStoredPudding()),
      rank: rank != null && Number.isFinite(rank) ? rank : null,
    };
  } catch {
    return null;
  }
}

function writeCachedProStats(stats: ProStats) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(MY_PRO_STATS_CACHE_KEY, JSON.stringify({ ...stats, ts: Date.now() }));
    localStorage.setItem(PUDDING_STORAGE_KEY, String(stats.pudding));
  } catch {}
}

function readStoredProProfileStatus(): 'draft' | 'pending' | 'approved' | 'rejected' | null {
  if (typeof window === 'undefined') return null;
  try {
    const status = localStorage.getItem('proRegistrationComplete');
    if (status === 'true' || status === 'approved') return 'approved';
    if (status === 'pending') return 'pending';
    if (status === 'rejected') return 'rejected';
    if (status === 'draft') return 'draft';
  } catch {}
  return null;
}

function readStoredProCategory() {
  if (typeof window === 'undefined') return '사회자';
  try {
    return localStorage.getItem(PRO_CATEGORY_CACHE_KEY) || '사회자';
  } catch {
    return '사회자';
  }
}

function getUserFromStorage() {
  if (typeof window === 'undefined') return { name: '사용자', email: '', image: '', linkedAccounts: [], points: 0, coupons: 0, role: 'general' };
  try {
    const stored = JSON.parse(localStorage.getItem('freetiful-user') || '{}');
    return {
      name: stored.name || '사용자',
      email: stored.email || '',
      image: stored.image || '',
      linkedAccounts: stored.provider ? [stored.provider] : [],
      points: getPoints(),
      coupons: 2,
      role: localStorage.getItem('userRole') || 'general',
    };
  } catch { return { name: '사용자', email: '', image: '', linkedAccounts: [], points: 0, coupons: 0, role: 'general' }; }
}

/* ─── Pro (사회자) Icons ─── */
const ProIconRevenue = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" className="shrink-0">
    <rect x="2" y="4" width="20" height="16" rx="3" fill="#10B981"/>
    <path d="M2 10h20" stroke="#059669" strokeWidth="1.5"/>
    <text x="12" y="18" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" fontFamily="system-ui">₩</text>
  </svg>
);
const ProIconSettle = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" className="shrink-0">
    <rect x="3" y="3" width="18" height="18" rx="3" fill="#3B82F6"/>
    <path d="M8 12l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const ProIconBank = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" className="shrink-0">
    <path d="M3 21h18v-2H3v2zm0-4h4v-6H3v6zm6 0h4v-6H9v6zm6 0h4v-6h-4v6zM12 2L2 7v2h20V7L12 2z" fill="#6366F1"/>
  </svg>
);
const ProIconProfile = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" className="shrink-0">
    <circle cx="12" cy="8" r="5" fill="#818CF8"/>
    <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" fill="#818CF8"/>
    <circle cx="18" cy="6" r="4" fill="#3B82F6"/>
    <path d="M16.5 6h3M18 4.5v3" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const ProIconPortfolio = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" className="shrink-0">
    <rect x="2" y="3" width="20" height="18" rx="3" fill="#F59E0B"/>
    <rect x="5" y="6" width="6" height="5" rx="1" fill="white" opacity="0.6"/>
    <rect x="13" y="6" width="6" height="5" rx="1" fill="white" opacity="0.6"/>
    <rect x="5" y="13" width="6" height="5" rx="1" fill="white" opacity="0.6"/>
    <rect x="13" y="13" width="6" height="5" rx="1" fill="white" opacity="0.6"/>
  </svg>
);
const ProIconFAQ = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" className="shrink-0">
    <circle cx="12" cy="12" r="10" fill="#F59E0B"/>
    <text x="12" y="16.5" textAnchor="middle" fill="white" fontSize="13" fontWeight="bold" fontFamily="system-ui">?</text>
  </svg>
);
const ProIconPudding = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" className="shrink-0">
    <ellipse cx="12" cy="8" rx="9" ry="4" fill="#FBBF24"/>
    <path d="M3 8v8c0 2.2 4 4 9 4s9-1.8 9-4V8" fill="#F59E0B"/>
    <ellipse cx="12" cy="8" rx="9" ry="4" fill="#FBBF24"/>
    <ellipse cx="12" cy="8" rx="5" ry="2" fill="#FDE68A"/>
  </svg>
);
const ProIconRanking = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" className="shrink-0">
    <rect x="3" y="14" width="5" height="8" rx="1" fill="#9CA3AF"/>
    <rect x="9.5" y="6" width="5" height="16" rx="1" fill="#FBBF24"/>
    <rect x="16" y="10" width="5" height="12" rx="1" fill="#F97316"/>
    <circle cx="12" cy="3.5" r="2" fill="#FBBF24"/>
  </svg>
);
const ProIconPhone = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" className="shrink-0">
    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1C10.07 21 3 13.93 3 4c0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.1.31.03.7-.25 1.02l-2.2 2.2z" fill="#4B8DF8"/>
  </svg>
);
const ProIconEmail = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" className="shrink-0">
    <rect x="2" y="4" width="20" height="16" rx="3" fill="#6366F1"/>
    <path d="M2 7l10 6 10-6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const ProIconSwitch = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" className="shrink-0">
    <path d="M7.5 4A7.5 7.5 0 0119.3 8" stroke="#4B8DF8" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M19.3 8l1.2-3.2M19.3 8l-3.3-.8" stroke="#4B8DF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16.5 20A7.5 7.5 0 014.7 16" stroke="#4B8DF8" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M4.7 16l-1.2 3.2M4.7 16l3.3.8" stroke="#4B8DF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const PRO_MENU_SECTIONS = [
  {
    title: '수익 관리',
    items: [
      { href: '/my/revenue', icon: () => <ImgIcon src="/images/pro-mypage-icons/revenue.svg" />, label: '매출 내역' },
      { href: '/my/settlement', icon: () => <ImgIcon src="/images/pro-mypage-icons/settlement.svg" />, label: '정산 내역' },
      { href: '/my/bank', icon: () => <ImgIcon src="/images/pro-mypage-icons/bank-account.svg" />, label: '계좌 관리' },
    ],
  },
  {
    title: '프로필 관리',
    items: [
      { href: '/my/pro-edit', icon: () => <ImgIcon src="/images/profile-settings.svg" />, label: '프로필 수정' },
    ],
  },
  {
    title: '푸딩',
    items: [
      { href: '/my/pudding-history', icon: () => <ImgIcon src="/images/pro-mypage-icons/pudding-history.svg" />, label: '푸딩 내역' },
      { href: '/my/pudding-ranking', icon: () => <ImgIcon src="/images/pro-mypage-icons/ranking.svg" />, label: '랭킹 보기' },
    ],
  },
  {
    title: '고객센터',
    items: [
      { href: 'tel:02-1234-5678', icon: () => <ImgIcon src="/images/pro-mypage-icons/phone-inquiry.svg" />, label: '전화문의' },
    ],
  },
  {
    title: '기타',
    items: [
      { href: '/my/terms', icon: () => <ImgIcon src="/images/pro-mypage-icons/terms.svg" />, label: '약관 및 정책' },
      { href: '#', icon: () => <ImgIcon src="/images/pro-mypage-icons/switch-role.svg" />, label: '일반유저 전환', action: 'switchToGeneral' },
    ],
  },
];

const MENU_SECTIONS = [
  {
    title: '나의 활동',
    items: [
      { href: '/my/purchase-history', icon: () => <ImgIcon src="/images/purchase-history.svg" />, label: '구매 내역' },
      { href: '/my/payment-history', icon: IconHistory, label: '결제/환불 내역' },
      { href: '/my/points', icon: () => <ImgIcon src="/images/point.svg" />, label: '포인트', badge: '' },
      { href: '/my/coupons', icon: () => <ImgIcon src="/images/coupon.svg" />, label: '쿠폰' },
    ],
  },
  {
    title: '설정',
    items: [
      { href: '/my/settings', icon: () => <ImgIcon src="/images/profile-settings.svg" />, label: '프로필 설정' },
      { href: '/my/notifications', icon: () => <ImgIcon src="/images/notification-settings.svg" />, label: '알림 설정' },
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
      { href: '/my/invite', icon: () => <ImgIcon src="/images/invite-friend.svg" />, label: '친구 초대', badge: '500P 적립' },
      { href: '/my/terms', icon: IconFile, label: '약관 및 정책' },
      { href: '/pro-register/terms', icon: () => <ImgIcon src="/images/partners-apply.svg" />, label: '파트너 신청', action: 'partner' },
      { href: '#', icon: () => <ImgIcon src="/images/pro-mypage-icons/switch-role.svg" />, label: '프로유저 전환', action: 'switchToPro' },
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
  const [user, setUser] = useState({ name: '게스트', email: '', image: '/images/default-profile.svg', linkedAccounts: [] as string[], points: 0, coupons: 0, role: 'general' });
  const authUser = useAuthStore((s) => s.user);
  const { logout: authLogout } = useAuth();
  const router = useRouter();
  const [proRegistrationPending, setProRegistrationPending] = useState(false);
  const [proProfileStatus, setProProfileStatus] = useState<'draft' | 'pending' | 'approved' | 'rejected' | null>(() => readStoredProProfileStatus());
  const [proCategoryName, setProCategoryName] = useState<string>(() => readStoredProCategory());
  const [isPro, setIsPro] = useState(false);
  const [couponCount, setCouponCount] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);
  // 프로 통계 (이번달 매출 / 총 리뷰 / 푸딩)
  const [proStats, setProStats] = useState<ProStats>(() => {
    const cached = readCachedProStats();
    return cached || { ...PRO_STATS_EMPTY, pudding: readStoredPudding() };
  });

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

    const updateProStats = (patch: Partial<ProStats>) => {
      if (cancelled) return;
      setProStats((prev) => {
        const next = { ...prev, ...patch };
        writeCachedProStats(next);
        return next;
      });
    };

    if (authUser) {
      const cachedStats = readCachedProStats();
      if (cachedStats) {
        setProStats(cachedStats);
      } else {
        setProStats((prev) => ({ ...prev, pudding: readStoredPudding() }));
      }

      // Use real API data
      setUser({
        name: authUser.name || '게스트',
        email: authUser.email || '',
        image: authUser.profileImageUrl || '/images/default-profile.svg',
        linkedAccounts: [],
        points: authUser.pointBalance || 0,
        coupons: 0,
        role: authUser.role,
      });
      setIsPro(authUser.role === 'pro');
      // Fetch point balance from API
      usersApi.getPointBalance().then((res) => {
        if (!cancelled) setUser((prev) => ({ ...prev, points: res.balance }));
      }).catch(() => {});

      // 프로 통계는 서로 기다리지 않고 각각 도착하는 즉시 갱신한다.
      apiClient.get('/api/v1/pro/pudding', { params: { _t: Date.now() }, timeout: 5000 })
        .then((res) => {
          const data = (res as any)?.data || {};
          const pudding = Number(data.balance ?? data.puddingCount ?? 0);
          const rank = data.rank == null && data.puddingRank == null ? null : Number(data.rank ?? data.puddingRank);
          updateProStats({ pudding, rank: rank != null && Number.isFinite(rank) ? rank : null });
        })
        .catch(() => {});

      apiClient.get('/api/v1/pro/revenue', { timeout: 7000 })
        .then((res) => {
          updateProStats({ revenue: Number((res as any)?.data?.thisMonth || 0) });
        })
        .catch(() => {});

      apiClient.get('/api/v1/review/mine', { params: { page: 1, limit: 1 }, timeout: 7000 })
        .then((res) => {
          updateProStats({ reviews: Number((res as any)?.data?.total || 0) });
        })
        .catch(() => {});
    } else if (loggedIn) {
      setUser(getUserFromStorage());
    }

    return () => { cancelled = true; };
  }, [authUser]);

  useEffect(() => {
    if (!isLoggedIn) return;
    setProRegistrationPending(localStorage.getItem('proRegistrationComplete') === 'pending');
    if (!authUser) setIsPro(localStorage.getItem('userRole') === 'pro');

    // 백엔드에서 실제 pro profile 상태 동기화 (어드민이 승인/반려한 경우 반영)
    if (authUser) {
      prosApi.getMyProfile()
        .then((profile: any) => {
          const status = profile?.status as 'draft' | 'pending' | 'approved' | 'rejected' | undefined;
          if (!status) return;
          setProProfileStatus(status);
          // 프로가 설정한 카테고리를 추출 (categories 관계에서)
          const catName = profile?.categories?.[0]?.category?.name;
          if (catName) {
            setProCategoryName(catName);
            try { localStorage.setItem(PRO_CATEGORY_CACHE_KEY, catName); } catch {}
          }
          // User.profileImageUrl 을 프로 대표 이미지로 동기화 (카카오 기본 → 프로 대표 사진)
          const primary = profile?.images?.find((img: any) => img.isPrimary) || profile?.images?.[0];
          const effectiveImage = primary?.imageUrl || profile?.user?.profileImageUrl;
          if (effectiveImage && authUser && effectiveImage !== authUser.profileImageUrl) {
            useAuthStore.getState().setUser({ ...authUser, profileImageUrl: effectiveImage });
          }
          if (status === 'approved') {
            localStorage.setItem('proRegistrationComplete', 'approved');
            setProRegistrationPending(false);
          } else if (status === 'rejected') {
            localStorage.setItem('proRegistrationComplete', 'rejected');
            setProRegistrationPending(false);
          } else if (status === 'pending') {
            localStorage.setItem('proRegistrationComplete', 'pending');
            setProRegistrationPending(true);
          }
        })
        .catch(() => {});
    }
    try {
      const coupons = JSON.parse(localStorage.getItem('freetiful-coupons') || '[]');
      setCouponCount(Array.isArray(coupons) ? coupons.length : 0);
    } catch { setCouponCount(0); }
    try {
      const favs = JSON.parse(localStorage.getItem('freetiful-favorites') || '[]');
      setFavoritesCount(Array.isArray(favs) ? favs.length : 0);
    } catch { setFavoritesCount(0); }
  }, [isLoggedIn, authUser]);

  const handlePartnerApply = () => {
    const reg = localStorage.getItem('proRegistrationComplete');
    const alreadyRegistered = reg === 'true' || reg === 'approved';
    if (alreadyRegistered) {
      if (authUser) {
        usersApi.switchRole('pro').then(() => {
          useAuthStore.getState().setUser({ ...authUser, role: 'pro' as any });
          window.location.reload();
        }).catch(() => {});
      } else {
        localStorage.setItem('userRole', 'pro');
        window.location.reload();
      }
    } else {
      router.push('/pro-register/terms');
    }
  };

  const handleGeneralMode = () => {
    if (authUser) {
      usersApi.switchRole('general').then(() => {
        useAuthStore.getState().setUser({ ...authUser, role: 'general' as any });
        router.push('/main');
        window.location.reload();
      }).catch(() => {});
    } else {
      localStorage.setItem('userRole', 'general');
      router.push('/main');
      window.location.reload();
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

  const handleSwitchToGeneral = () => {
    if (authUser) {
      usersApi.switchRole('general').then(() => {
        useAuthStore.getState().setUser({ ...authUser, role: 'general' as any });
        window.location.reload();
      }).catch(() => {});
    } else {
      localStorage.setItem('userRole', 'general');
      window.location.reload();
    }
  };

  // 승인된 프로만 PRO 뷰로 분기. role=pro 이지만 ProProfile 미승인인 경우는 일반 뷰로 폴백.
  const isApprovedPro = isPro && proProfileStatus === 'approved';
  if (isApprovedPro) {
    const isTopRank = (proStats.rank != null && proStats.rank <= 10) || proStats.pudding >= 100;
    return (
      <div className="bg-white min-h-screen pb-24" style={{ letterSpacing: '-0.02em' }}>
        {/* Header */}
        <div className="sticky top-0 z-20 bg-white px-4">
          <div className="h-[52px] flex items-center">
            <h1 className="text-[18px] font-bold text-gray-900">마이페이지</h1>
            <span className="ml-2 text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">PRO</span>
          </div>
        </div>

        {/* Pro Profile */}
        <div className="px-4 pb-3" style={animOrNone({ animation: 'myFadeUp 0.5s ease forwards' })}>
          <Link href="/my/settings" className="flex items-center gap-3.5 active:opacity-80 transition-opacity">
            <div className="relative">
              <img src={user.image || '/images/default-profile.svg'} alt={user.name} onError={(e) => { (e.target as HTMLImageElement).src = '/images/default-profile.svg'; }} className="w-[56px] h-[56px] rounded-full object-cover bg-gray-100" />
              <div className="absolute -bottom-0.5 -right-0.5 bg-blue-500 rounded-full flex items-center justify-center" style={{ width: 20, height: 20 }}>
                <svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="white"/>
                </svg>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[17px] font-bold text-gray-900">{proCategoryName} {user.name}</p>
                <span className="text-[10px] font-bold text-white bg-blue-500 px-1.5 py-0.5 rounded" style={{ lineHeight: 1.2 }}>PRO</span>
              </div>
              <p className="text-[13px] text-gray-400 mt-0.5">{truncateEmail(user.email)}</p>
            </div>
            <ChevronRight size={20} className="text-gray-300 shrink-0" />
          </Link>

          {/* Pro Quick Stats */}
          <div className="flex mt-3 rounded-xl overflow-hidden bg-gray-50" style={animOrNone({ animation: 'myFadeUp 0.5s ease 0.1s both' })}>
            <Link href="/my/revenue" className="flex-1 py-2 text-center">
              <p className="text-[17px] font-bold text-gray-900">₩{proStats.revenue.toLocaleString()}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">이번달 매출</p>
            </Link>
            <div className="w-px bg-gray-100" />
            <Link href="/my/reviews" className="flex-1 py-2 text-center">
              <p className="text-[17px] font-bold text-gray-900">{proStats.reviews}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">총 리뷰</p>
            </Link>
            <div className="w-px bg-gray-100" />
            <Link href="/my/pudding-charge" className="flex-1 py-2 text-center">
              <p className="text-[17px] font-bold text-gray-900">{proStats.pudding}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">푸딩</p>
            </Link>
          </div>

          {/* Pudding ranking info */}
          <div className="mt-3 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3" style={animOrNone({ animation: 'myFadeUp 0.5s ease 0.15s both' })}>
            <div className="flex items-center gap-2 mb-1">
              <ProIconPudding />
              <p className="text-[13px] font-bold text-amber-800">푸딩 랭킹 시스템</p>
            </div>
            <p className="text-[12px] text-amber-600 ml-[28px]">
              현재 보유: <strong>{proStats.pudding.toLocaleString()}개</strong>
              {proStats.rank != null && <> · <strong>{proStats.rank}위</strong></>}
              {isTopRank ? ' (상위권)' : ''}
            </p>
            <p className="text-[11px] text-amber-500 ml-[28px] mt-0.5">푸딩을 사용하면 프로필이 상단에 노출됩니다</p>
          </div>
        </div>

        {/* Pro Menu Sections */}
        {PRO_MENU_SECTIONS.map((section, si) => (
          <div key={section.title} style={animOrNone({ animation: `myFadeUp 0.4s ease ${0.2 + si * 0.08}s both` })}>
            {si > 0 && <div className="h-1.5 bg-gray-50" />}
            <div className="px-4 pt-3 pb-0.5">
              <p className="text-[12px] font-bold text-gray-400">{section.title}</p>
            </div>
            {section.items.map(({ href, icon: Icon, label, action }: { href: string; icon: () => JSX.Element; label: string; badge?: string; action?: string }) => {
              const inner = (
                <>
                  <Icon />
                  <span className="flex-1 text-[14px] text-gray-900">{label}</span>
                  <ChevronRight size={16} className="text-gray-300 shrink-0" />
                </>
              );

              if (action === 'switchToGeneral') {
                return (
                  <button key={label} onClick={handleSwitchToGeneral} className="flex items-center gap-3 px-4 py-2.5 w-full text-left active:bg-gray-50 transition-colors">
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

        <div className="px-4 pt-2 pb-4 text-center">
          <p className="text-[11px] text-gray-300">Freetiful v1.0.0</p>
        </div>

        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes myFadeUp {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}} />
      </div>
    );
  }

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
            <img src={user.image || '/images/default-profile.svg'} alt={user.name} onError={(e) => { (e.target as HTMLImageElement).src = '/images/default-profile.svg'; }} className="w-[56px] h-[56px] rounded-full object-cover bg-gray-100" />
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
              <p className="text-[14px] font-bold text-blue-700">전문가 양식 제출완료!</p>
            </div>
            <p className="text-[12px] text-blue-500 mt-1 ml-[26px]">심사를 기다려주세요. 7일 이내에 결과를 알려드립니다.</p>
          </div>
        )}

        {/* Pro Approved — 파트너스 전환 버튼 */}
        {proProfileStatus === 'approved' && !isPro && (
          <button
            onClick={handlePartnerApply}
            className="mt-3 w-full rounded-xl bg-gradient-to-r from-[#3180F7] to-[#5B9AFE] px-4 py-4 flex items-center gap-3 shadow-[0_4px_16px_rgba(49,128,247,0.3)] active:scale-[0.98] transition-transform"
            style={animOrNone({ animation: 'myFadeUp 0.5s ease 0.08s both' })}
          >
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8L12 2Z" fill="white"/>
              </svg>
            </div>
            <div className="flex-1 text-left">
              <p className="text-[15px] font-bold text-white">파트너스로 전환하기 🎉</p>
              <p className="text-[12px] text-white/80 mt-0.5">파트너 승인 완료! 지금 바로 전문가 모드로 시작하세요</p>
            </div>
            <ChevronRight size={20} className="text-white shrink-0" />
          </button>
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

        {/* Quick Stats */}
        <div className="flex mt-3 rounded-xl overflow-hidden bg-gray-50" style={animOrNone({ animation: 'myFadeUp 0.5s ease 0.1s both' })}>
          <Link href="/my/points" className="flex-1 py-2 text-center">
            <p className="text-[17px] font-bold text-gray-900">{user.points.toLocaleString()}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">포인트</p>
          </Link>
          <div className="w-px bg-gray-100" />
          <Link href="/my/coupons" className="flex-1 py-2 text-center">
            <p className="text-[17px] font-bold text-gray-900">{couponCount}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">쿠폰</p>
          </Link>
          <div className="w-px bg-gray-100" />
          <Link href="/favorites" className="flex-1 py-2 text-center">
            <p className="text-[17px] font-bold text-gray-900">{favoritesCount}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">찜</p>
          </Link>
        </div>
      </div>
      )}

      {/* Upcoming Schedules */}
      {isLoggedIn && typeof window !== 'undefined' && localStorage.getItem('freetiful-has-demo-data') === 'true' && UPCOMING_SCHEDULES.length > 0 && (
        <div className="px-4 pt-2 pb-1" style={animOrNone({ animation: 'myFadeUp 0.5s ease 0.15s both' })}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[12px] font-bold text-gray-400">다가오는 일정</p>
            <Link href="/schedule" className="text-[12px] text-gray-400">전체보기</Link>
          </div>
          <div className="space-y-2">
            {UPCOMING_SCHEDULES.map((s) => (
              <Link key={s.id} href={`/schedule/${s.id}`} className="flex items-center gap-2.5 border border-gray-100 active:bg-gray-50 transition-colors" style={{ padding: 5, borderRadius: 12 }}>
                <img src={s.proImage} alt={s.proName} className="w-10 h-[52px] rounded-lg object-cover shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[16px] font-bold text-gray-900">{s.category} {s.proName}</p>
                  <div className="flex gap-1.5 mt-1.5">
                    <span className="px-2 py-0.5 bg-gray-50 text-[11px] font-medium text-gray-600" style={{ borderRadius: 6 }}>{s.date} {s.time}</span>
                    <span className="px-2 py-0.5 bg-gray-50 text-[11px] font-medium text-gray-600" style={{ borderRadius: 6 }}>{s.location}</span>
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-300 shrink-0" />
              </Link>
            ))}
          </div>
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
              const regStatus = typeof window !== 'undefined' ? localStorage.getItem('proRegistrationComplete') : null;
              // If approved, hide entirely
              if (regStatus === 'true' || regStatus === 'approved') return null;
              // If pending, show disabled with badge
              if (regStatus === 'pending') {
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

            const displayBadge = label === '포인트' ? `${user.points.toLocaleString()}P` : badge;
            const inner = (
              <>
                <Icon />
                <span className="flex-1 text-[14px] text-gray-900">{label}</span>
                {displayBadge && <span className="text-[11px] text-white font-medium px-2.5 py-0.5 rounded-full" style={{ backgroundColor: '#2B313D' }}>{displayBadge}</span>}
                <ChevronRight size={16} className="text-gray-300 shrink-0" />
              </>
            );

            if (action === 'switchToPro') {
              // 프로 권한이 있는 경우에만 표시
              const hasProRights = (typeof window !== 'undefined' && localStorage.getItem('proRegistrationComplete') === 'true') || authUser?.role === 'pro';
              if (!hasProRights) return null;
              return (
                <button key={label} onClick={handlePartnerApply} className="flex items-center gap-3 px-4 py-2.5 w-full text-left active:bg-gray-50 transition-colors">
                  {inner}
                </button>
              );
            }
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
