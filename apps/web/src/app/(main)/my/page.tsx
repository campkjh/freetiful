'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth.store';
import { useAuth } from '@/lib/hooks/useAuth';
import { usersApi } from '@/lib/api/users.api';
import { prosApi } from '@/lib/api/pros.api';
import { getProfileImageUrl } from '@/lib/default-profile';
import { useTabEntrance } from '@/lib/hooks/useTabEntrance';

/* ════════════════════════════════════════════════════════════════
 * 마이페이지 — 원라인솔루션 '일반바' 마이 탭 구성 그대로 (2026-09-25 사장 지시).
 * 토스 '전체' 탭 어법:
 *  · 위: 이름 크게 + 회색 한 줄 + 오른쪽 **글자 링크**(설정 | 로그아웃). 자주 안 쓰는 건 버튼을 안 준다.
 *  · 가운데: '자주 쓰는 것' **타일 판**(흰 둥근 사각 + 컬러 아이콘 + 아래 라벨).
 *  · 아래: 흰 카드 **목록**(왼쪽 회색 아이콘 칩 · 굵은 제목 · 오른쪽 회색 설명 — 들어가기 전에 뭘 하는지 안다).
 *  · 회색 바탕(#F4F6FA) 위 흰 면. 아이콘은 토스 컬러 원본(public/icons/toss) — 회색으로 깎으면 타일이 한 덩어리로 보인다.
 * 등장은 퀵매칭 어법: 제목 아래→위 페이드, 나머지 오른쪽→왼쪽 슬라이드(순차).
 * ⚠ iOS 앱의 /my 는 네이티브(NativeMyContent)라 이 화면은 웹·안드로이드에서만 보인다.
 * ════════════════════════════════════════════════════════════════ */

const PRO_CATEGORY_CACHE_KEY = 'freetiful-my-pro-category';

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

// 긴 이메일은 잘라 ... 붙임 (실제 이메일 그대로 보여주면 공간 넘침)
function truncateEmail(email: string, max = 24): string {
  if (!email) return '';
  return email.length <= max ? email : email.slice(0, max) + '...';
}

const TOSS = (name: string) => `/icons/toss/${name}.svg`;

/** '프로필 편집/설정' 아이콘 자리에 내 프로필 사진(사장 지시 260925) — 못 불러오면 원래 사람 아이콘 */
function ProfilePhotoIcon({ src, size, iconSize }: { src: string; size: number; iconSize: number }) {
  const [broken, setBroken] = useState(false);
  if (broken || !src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={TOSS('account')} alt="" style={{ width: iconSize, height: iconSize }} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      onError={() => setBroken(true)}
      className="rounded-full bg-[#F2F4F6] object-cover"
      style={{ width: size, height: size }}
    />
  );
}

type MyRow = {
  k: string;
  icon: string;
  title: string;
  desc?: string;
  href?: string;
  onClick?: () => void;
  badge?: string;
  disabled?: boolean;
  danger?: boolean;
};

const MY_CSS = `
@keyframes myFadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
@keyframes mySlideIn { from { opacity: 0; transform: translateX(22px); } to { opacity: 1; transform: translateX(0); } }
@keyframes myPaneIn { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
.my-a-title { animation: myFadeUp .5s cubic-bezier(.22,.61,.36,1) both; }
.my-a-sub { animation: myFadeUp .5s cubic-bezier(.22,.61,.36,1) .18s both; }
/* fill backwards — 끝나면 빠져서 눌림(active:scale) 효과가 산다 */
.my-a-item { animation: mySlideIn .46s cubic-bezier(.22,.61,.36,1) backwards; }
.my-noanim .my-a-title, .my-noanim .my-a-sub, .my-noanim .my-a-item { animation: none !important; }
@media (prefers-reduced-motion: reduce) { .my-a-title, .my-a-sub, .my-a-item { animation: none !important; } }
`;

export default function MyPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState({ name: '게스트', email: '', image: getProfileImageUrl(null, 'guest'), role: 'general' });
  const authUser = useAuthStore((s) => s.user);
  const { logout: authLogout } = useAuth();
  const router = useRouter();
  const [proProfileStatus, setProProfileStatus] = useState<'draft' | 'pending' | 'approved' | 'rejected' | null>(() => readStoredProProfileStatus());
  const [proRegistrationPending, setProRegistrationPending] = useState(() => readStoredProProfileStatus() === 'pending');

  // 등장 애니(퀵매칭)는 탭을 눌러 들어올 때만 — 하위 화면에서 뒤로 오거나 떠난 지 30초 안에 다시 오면 생략(새요청·웨딩숲·채팅과 같은 규칙)
  const skipAnim = !useTabEntrance('my');

  useEffect(() => {
    const loggedIn = authUser !== null;
    setIsLoggedIn(loggedIn);

    if (authUser) {
      setUser({
        name: authUser.name || '게스트',
        email: authUser.email || '',
        image: getProfileImageUrl(authUser.profileImageUrl, authUser.id || authUser.email || authUser.name),
        role: authUser.role,
      });
    } else {
      setProProfileStatus(null);
      setProRegistrationPending(false);
    }
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

  const showLogin = () => window.dispatchEvent(new Event('freetiful:show-login'));

  const handlePartnerApply = () => {
    if (!authUser) {
      showLogin();
      return;
    }

    if (proProfileStatus === 'approved') {
      router.push('/pro-dashboard/inquiries');
    } else {
      router.push('/pro-register/terms');
    }
  };

  /** PC 에서 오른쪽에 펼쳐 볼 하위 화면 — 페이지 이동 대신 반반으로 본다 */
  const [detailHref, setDetailHref] = useState<string | null>(null);
  const openDetailOnPC = (href: string) => (e: React.MouseEvent) => {
    if (typeof window === 'undefined' || window.innerWidth < 1024) return;
    e.preventDefault();
    setDetailHref(href);
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
    router.push('/main');   // '/'는 서버 redirect 바운스 — 직접 /main
  };

  // 네이티브 마이페이지 브리지 (프로필 데이터 + 로그아웃)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const post = () => {
      (window as any).webkit?.messageHandlers?.nativeMyProfile?.postMessage({
        loggedIn: isLoggedIn,
        name: user.name || '',
        email: user.email || '',
        image: getProfileImageUrl(user.image, user.email || user.name),
        proPending: Boolean(proRegistrationPending && proProfileStatus !== 'approved'),
      });
    };
    (window as any).__freetifulMyProfilePost = post;
    (window as any).__freetifulLogout = () => { try { executeLogout(); } catch {} };
    post();
    return () => { try { delete (window as any).__freetifulMyProfilePost; delete (window as any).__freetifulLogout; } catch {} };
  }, [isLoggedIn, user, proProfileStatus, proRegistrationPending]);

  // ─── 메뉴 구성 ───
  const isProUser = authUser?.role === 'pro' || proProfileStatus === 'approved';
  const profileHref = authUser?.role === 'pro' ? '/my/pro-edit' : '/my/settings';
  const roleLabel = user.role === 'pro' ? '사회자' : user.role === 'admin' ? '관리자' : '일반회원';

  // 자주 쓰는 것 — 한 줄 4칸
  const tiles: { k: string; icon: string; label: string; href: string }[] = isProUser
    ? [
        { k: 'profile', icon: 'account', label: '프로필 편집', href: profileHref },
        { k: 'autoreply', icon: 'chat', label: '자동응답', href: '/pro-dashboard/auto-reply' },
        { k: 'purchase', icon: 'ledger', label: '구매 내역', href: '/my/purchase-history' },
        { k: 'support', icon: 'headphone', label: '고객센터', href: '/my/support' },
      ]
    : [
        { k: 'purchase', icon: 'ledger', label: '구매 내역', href: '/my/purchase-history' },
        { k: 'payment', icon: 'pay-card', label: '결제·환불', href: '/my/payment-history' },
        { k: 'invite', icon: 'gift', label: '친구 초대', href: '/my/invite' },
        { k: 'support', icon: 'headphone', label: '고객센터', href: '/my/support' },
      ];

  // 파트너 신청 — 사회자 승인 전만. 심사 중이면 누를 수 없게
  const partnerRow: MyRow | null = (() => {
    if (authUser?.role === 'pro' && proProfileStatus === null) return null;
    if (proProfileStatus === 'approved') return null;
    if (proProfileStatus === 'pending') {
      return { k: 'partner', icon: 'crown-gold', title: '파트너 신청', desc: '심사를 기다리는 중', badge: '심사 중', disabled: true };
    }
    return { k: 'partner', icon: 'crown-gold', title: '파트너 신청', desc: '사회자로 활동하기', onClick: handlePartnerApply };
  })();

  const sections: { title: string; rows: MyRow[] }[] = [
    {
      title: '나의 활동',
      rows: [
        { k: 'purchase', icon: 'ledger', title: '구매 내역', desc: '구매한 서비스 · 견적', href: '/my/purchase-history' },
        { k: 'payment', icon: 'pay-card', title: '결제/환불 내역', desc: '결제 · 환불 기록', href: '/my/payment-history' },
      ],
    },
    {
      title: '설정',
      rows: [
        { k: 'profile', icon: 'account', title: '프로필 설정', desc: isProUser ? '사회자 프로필 · 소개' : '사진 · 이름 · 연락처', href: profileHref },
        ...(isProUser ? [{ k: 'autoreply', icon: 'chat', title: '자동응답 관리', desc: '견적 문의에 자동 답장', href: '/pro-dashboard/auto-reply' }] : []),
        { k: 'notif', icon: 'alarm', title: '알림 설정', desc: '푸시 · 소식 받기', href: '/my/notifications' },
      ],
    },
    {
      title: '고객지원',
      rows: [
        { k: 'support', icon: 'headphone', title: '고객센터', desc: '1:1 문의', href: '/my/support' },
        { k: 'faq', icon: 'question', title: 'FAQ', desc: '자주 묻는 질문', href: '/my/faq' },
        { k: 'notice', icon: 'loudspeaker', title: '공지사항', desc: '새 소식 · 업데이트', href: '/my/announcements' },
      ],
    },
    {
      title: '기타',
      rows: [
        { k: 'invite', icon: 'gift', title: '친구 초대', desc: '초대하고 혜택 받기', badge: '5,000원 이벤트', href: '/my/invite' },
        { k: 'terms', icon: 'document', title: '약관 및 정책', desc: '이용약관 · 개인정보', href: '/my/terms' },
        ...(partnerRow ? [partnerRow] : []),
      ],
    },
  ];

  // 순차 등장 — 위에서부터 차례로 번호를 매긴다
  let order = 0;
  const slide = () => ({ animationDelay: `${0.3 + (order++) * 0.04}s` });

  const rowInner = (row: MyRow) => (
    <>
      {row.k === 'profile' && isLoggedIn ? (
        <span className="flex h-[40px] w-[40px] shrink-0 items-center justify-center">
          <ProfilePhotoIcon src={user.image} size={40} iconSize={24} />
        </span>
      ) : (
        <span className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[12px] bg-[#F7F8FA]">
          {/* eslint-disable-next-line @next/next/no-img-element -- public 정적 SVG, 컬러 그대로 */}
          <img src={TOSS(row.icon)} alt="" className="h-[24px] w-[24px]" />
        </span>
      )}
      {/* 제목은 필요한 만큼 가져가고, 남는 폭은 설명이 받는다(모자라면 설명이 먼저 줄어든다) */}
      <span className="flex min-w-0 items-center gap-1.5">
        <span className={`truncate text-[16px] font-semibold ${row.danger ? 'text-[#F04452]' : 'text-[#191F28]'}`}>{row.title}</span>
        {row.badge && (
          <span className="shrink-0 rounded-full bg-[#E8F3FF] px-2 py-[2px] text-[11.5px] font-bold text-[#3182F6]">{row.badge}</span>
        )}
      </span>
      {row.desc && <span className="min-w-0 flex-1 truncate text-right text-[13px] text-[#A4ABBA]">{row.desc}</span>}
    </>
  );

  const renderRow = (row: MyRow, i: number, arr: MyRow[]) => {
    const line = i < arr.length - 1 ? 'border-b border-[#F2F4F6]' : '';
    const base = `flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors ${line}`;
    if (row.disabled) {
      return (
        <div key={row.k} className={`${base} cursor-not-allowed opacity-50`}>
          {rowInner(row)}
        </div>
      );
    }
    if (row.onClick || !isLoggedIn || !row.href) {
      return (
        <button
          key={row.k}
          type="button"
          onClick={() => (row.onClick ? row.onClick() : showLogin())}
          className={`${base} active:bg-[#F7F8FA] lg:hover:bg-[#F9FAFB]`}
        >
          {rowInner(row)}
        </button>
      );
    }
    return (
      <Link
        key={row.k}
        href={row.href}
        onClick={openDetailOnPC(row.href)}
        className={`${base} active:bg-[#F7F8FA] ${detailHref === row.href ? 'lg:bg-[#EAF2FF]' : 'lg:hover:bg-[#F9FAFB]'}`}
      >
        {rowInner(row)}
      </Link>
    );
  };

  return (
    <div
      className={`min-h-screen bg-[#F4F6FA] pb-28 lg:mx-auto lg:bg-transparent lg:pb-16 lg:pt-8 ${
        detailHref ? 'lg:max-w-none' : 'lg:max-w-[680px]'
      } ${skipAnim ? 'my-noanim' : ''}`}
      style={{ letterSpacing: '-0.02em' }}
    >
      <style dangerouslySetInnerHTML={{ __html: MY_CSS }} />
      <div className="lg:flex lg:items-start lg:gap-6">
        <div className={`lg:transition-[width] lg:duration-300 lg:ease-out ${detailHref ? 'lg:w-[440px] lg:shrink-0' : 'lg:w-full'}`}>
          {/* '마이페이지' 헤더는 없앴다(사장 지시) — 이름 줄이 곧 맨 위. 상태표시줄에 안 먹히게 위 안전여백만 준다 */}
          <div className="px-4 pb-4 pt-[calc(env(safe-area-inset-top,0px)+20px)] lg:px-0 lg:pt-0">
            {/* 이름 줄 — 토스는 여기에 버튼을 안 두고 글자 링크만 둔다 */}
            {isLoggedIn ? (
              <div className="flex items-start gap-3">
                <div className="my-a-title min-w-0 flex-1">
                  <div className="truncate text-[20px] font-bold leading-[32px] tracking-[-0.02em] text-[#191F28]">{user.name}</div>
                  <div className="mt-1 truncate text-[13.5px] text-[#A4ABBA]">
                    {[truncateEmail(user.email), roleLabel].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div className="my-a-sub flex shrink-0 items-center gap-2 pt-1 text-[14px] font-medium text-[#8B95A1]">
                  <Link href="/my/settings" onClick={openDetailOnPC('/my/settings')} className="active:text-[#4E5968]">설정</Link>
                  <span className="text-[#E5E8EB]">|</span>
                  <button type="button" onClick={handleLogout} className="active:text-[#4E5968]">로그아웃</button>
                </div>
              </div>
            ) : (
              <>
                <div className="my-a-title">
                  <div className="text-[20px] font-bold leading-[32px] tracking-[-0.02em] text-[#191F28]">로그인이 필요해요</div>
                  <div className="mt-1 text-[13.5px] text-[#A4ABBA]">로그인하고 프리티풀의 다양한 서비스를 이용해 보세요</div>
                </div>
                <button
                  type="button"
                  onClick={showLogin}
                  className="my-a-sub mt-4 h-[52px] w-full rounded-[16px] bg-[#3182F6] text-[16px] font-semibold text-white transition-colors active:bg-[#2272EB]"
                >
                  로그인 / 회원가입
                </button>
              </>
            )}

            {/* 사회자 신청 상태 — 흰 카드 한 줄 */}
            {isLoggedIn && proRegistrationPending && proProfileStatus !== 'approved' && (
              <div className="my-a-item mt-5 flex items-center gap-3 rounded-[18px] bg-white px-4 py-3.5" style={slide()}>
                <span className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[12px] bg-[#F7F8FA]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={TOSS('document')} alt="" className="h-[24px] w-[24px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-semibold text-[#191F28]">사회자 양식 제출 완료</span>
                  <span className="mt-0.5 block text-[12.5px] text-[#A4ABBA]">심사를 기다려 주세요 · 7일 이내 결과를 알려 드려요</span>
                </span>
                <span className="shrink-0 rounded-full bg-[#E8F3FF] px-2 py-[2px] text-[11.5px] font-bold text-[#3182F6]">심사 중</span>
              </div>
            )}
            {isLoggedIn && proProfileStatus === 'rejected' && (
              <div className="my-a-item mt-5 flex items-center gap-3 rounded-[18px] bg-white px-4 py-3.5" style={slide()}>
                <span className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[12px] bg-[#FFF2F3]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={TOSS('document')} alt="" className="h-[24px] w-[24px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-semibold text-[#F04452]">파트너 신청이 반려되었어요</span>
                  <span className="mt-0.5 block text-[12.5px] text-[#A4ABBA]">신청 조건을 확인하고 다시 신청해 주세요</span>
                </span>
              </div>
            )}

            {/* 자주 쓰는 것 — 타일 판 */}
            <div className="my-a-sub mt-6 text-[15px] font-semibold text-[#2B313D]">자주 쓰는 것</div>
            <div className="mt-2.5 grid grid-cols-4 gap-2">
              {tiles.map((t) => {
                const inner = (
                  <>
                    <span className="flex h-[58px] w-[58px] items-center justify-center rounded-[18px] bg-white">
                      {t.k === 'profile' && isLoggedIn ? (
                        <ProfilePhotoIcon src={user.image} size={38} iconSize={30} />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={TOSS(t.icon)} alt="" className="h-[30px] w-[30px]" />
                      )}
                    </span>
                    <span className="text-[12px] font-medium text-[#51535C]">{t.label}</span>
                  </>
                );
                const cls = 'my-a-item flex flex-col items-center gap-1.5 rounded-[16px] py-1 transition-transform active:scale-95';
                return isLoggedIn ? (
                  <Link key={t.k} href={t.href} onClick={openDetailOnPC(t.href)} className={cls} style={slide()}>
                    {inner}
                  </Link>
                ) : (
                  <button key={t.k} type="button" onClick={showLogin} className={cls} style={slide()}>
                    {inner}
                  </button>
                );
              })}
            </div>

            {/* 목록 — 오른쪽 회색 설명이 '들어가면 뭘 하는지'를 말한다 */}
            {sections.map((section) => (
              <div key={section.title}>
                <div className="my-a-item mt-6 text-[15px] font-semibold text-[#2B313D]" style={slide()}>{section.title}</div>
                <div className="my-a-item mt-2.5 overflow-hidden rounded-[18px] bg-white" style={slide()}>
                  {section.rows.map(renderRow)}
                </div>
              </div>
            ))}

            {isLoggedIn && (
              <>
                <div className="my-a-item mt-6 text-[15px] font-semibold text-[#2B313D]" style={slide()}>계정</div>
                <div className="my-a-item mt-2.5 overflow-hidden rounded-[18px] bg-white" style={slide()}>
                  {renderRow({ k: 'logout', icon: 'logout', title: '로그아웃', danger: true, onClick: handleLogout }, 0, [])}
                </div>
              </>
            )}
          </div>
        </div>

        {/* PC — 고른 항목을 오른쪽에서 그대로 연다(페이지 이동 없음).
            iframe 인 이유는 Tailwind 반응형이 뷰포트 기준이라, 좁은 칸에 그냥 끼우면
            하위 화면이 PC 레이아웃으로 잡혀 깨지기 때문. iframe 은 제 뷰포트를 가진다. */}
        {detailHref && (
          <div
            className="hidden lg:block lg:min-w-0 lg:flex-1"
            style={{ animation: 'myPaneIn 0.32s cubic-bezier(0.16, 1, 0.3, 1) both' }}
          >
            <div className="sticky top-[92px] h-[calc(100vh-150px)] overflow-hidden rounded-[24px] bg-white">
              <button
                type="button"
                onClick={() => setDetailHref(null)}
                aria-label="닫기"
                className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#F2F3F5] text-[#51535C] transition-colors hover:bg-[#E9EBEF]"
              >
                <X size={17} />
              </button>
              <iframe key={detailHref} src={detailHref} title="상세" className="h-full w-full border-0" />
            </div>
          </div>
        )}
      </div>

      {/* ─── 로그아웃 확인 모달 ─────────────────────────────────────── */}
      {showLogoutConfirm && (
        <div
          className="ft-scrim"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            className="ft-sheet"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ft-grab" aria-hidden="true" />
            <p className="ft-title">
              로그아웃 하시겠어요?
            </p>
            <div className="ft-actions">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="ft-btn secondary"
              >
                아니오
              </button>
              <button
                onClick={executeLogout}
                className="ft-btn primary"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
