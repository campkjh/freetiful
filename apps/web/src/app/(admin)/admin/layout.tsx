'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuthStore } from '@/lib/store/auth.store';
import { HeaderBellIcon } from '@/components/icons/HeaderIcons';
import { AdminIssuePanel } from './_components/AdminIssuePanel';
import { AdminDialogHost } from './_components/adminDialog';
import { adminFetch } from './_components/adminFetch';

const ADMIN_EMAILS = ['admin@freetiful.com', 'freetiful2025@naver.com', 'freetiful2025@admin.com'];

function isAdminUser(user: { email?: string | null; role?: string | null } | null) {
  const email = user?.email?.toLowerCase();
  return !!user && (user.role === 'admin' || (!!email && ADMIN_EMAILS.includes(email)));
}

/* ─────────────────────────────────────────────────────────────
 * 어드민 2.0 껍데기 — 퀵매칭·앱과 같은 토스 톤(261004 사장 '어드민도 디자인·UI·인터랙션 격변').
 *  · 왼쪽 흰 사이드바(로고·메뉴·내 계정) + 회색 바탕 본문(흰 카드). 위 가로 메뉴줄은 없앴다.
 *  · 메뉴 = 쓰는 것만(사장: 업체 관리·Biz 문의·웨딩MC 설문/리드·배너·공지·FAQ·약관·친구초대 이벤트 필요 없음 —
 *    화면 파일은 그대로 두고 메뉴에서만 뺐다, 주소로는 들어가진다), 유저·사회자 = '회원 관리' 하나(탭: 유저 · 사회자 · 사회자 랭킹).
 *  · 고른 메뉴 = 연한 파랑 알약이 메뉴 사이를 스르르 옮겨 다닌다. 아이콘은 회색 mono SVG 를 마스크로 칠해 고른 것만 파랑.
 *  · 페이지 머리(제목·설명·탭)는 여기서 그린다 — 페이지는 본문만.
 * ──────────────────────────────────────────────────────────── */

type NavItem = {
  href: string;
  label: string;
  /** /admin-icons/<icon>.svg */
  icon: string;
  exact?: boolean;
  /** 이 메뉴로 칠 다른 주소들(통합 메뉴) */
  paths?: string[];
  /** 페이지 머리 설명 */
  desc: string;
};

const NAV: Array<{ label: string; items: NavItem[] }> = [
  {
    label: '',
    items: [{ href: '/admin', label: '홈', icon: 'home', exact: true, desc: '' }],
  },
  {
    label: '회원',
    items: [
      { href: '/admin/users', label: '회원 관리', icon: 'users', paths: ['/admin/users', '/admin/pros', '/admin/pro-ranking'], desc: '가입한 고객과 사회자를 한곳에서 관리해요' },
    ],
  },
  {
    label: '거래',
    items: [
      { href: '/admin/chat-connections', label: '채팅 매칭', icon: 'chat', desc: '고객과 사회자가 이어진 채팅방이에요' },
      { href: '/admin/payments', label: '결제 조회', icon: 'card', desc: '결제·환불 내역을 확인해요' },
      { href: '/admin/settlements', label: '정산 내역', icon: 'money-bag', desc: '사회자에게 보낼 정산과 그 행사 정보예요' },
    ],
  },
  {
    label: '분석 · 콘텐츠',
    items: [
      { href: '/admin/landing-analytics', label: '페이지별 유입 분석', icon: 'graph', desc: '퀵매칭·웨딩MC·비즈MC 페이지별 광고·UTM 유입과 견적 전환을 봐요' },
      { href: '/admin/reviews', label: '리뷰 관리', icon: 'star', desc: '고객 리뷰를 노출·삭제해요' },
      { href: '/admin/community', label: '커뮤니티 관리', icon: 'message-square-text', desc: '웨딩숲 글·댓글·신고·닉네임을 살피고 고쳐요' },
      { href: '/admin/operator', label: '운영 콘텐츠', icon: 'loudspeaker', desc: "운영팀 이름으로 웨딩숲 글을 쓰고 반응을 봐요 — 앱엔 늘 '운영팀' 표시가 붙어요" },
    ],
  },
];

/** 메뉴에서 뺀 화면 — 주소로 들어오면 머리 제목만 붙여 준다 */
/** 머리(제목·설명)를 화면이 직접 그리는 곳 */
const OWN_HEAD = ['/admin/landing-analytics'];

const HIDDEN_TITLES: Record<string, string> = {
  '/admin/partners': '업체 관리',
  '/admin/businesses': 'Biz 고객사',
  '/admin/inquiries': 'Biz 문의',
  '/admin/wedding-mc-leads': '웨딩MC 설문/리드',
  '/admin/banners': '배너 관리',
  '/admin/announcements': '공지사항',
  '/admin/faqs': 'FAQ',
  '/admin/policies': '약관 관리',
  '/admin/referral-event': '친구초대 이벤트',
  '/admin/bookings': '의뢰/예약 관리',
  '/admin/plan-templates': '서비스 플랜 템플릿',
};

/** 한 메뉴 안의 탭(통합 메뉴) — 목록 화면에서만 보인다 */
const TAB_GROUPS: { href: string; label: string }[][] = [
  [
    { href: '/admin/users', label: '유저' },
    { href: '/admin/pros', label: '사회자' },
    { href: '/admin/pro-ranking', label: '사회자 랭킹' },
  ],
  [
    { href: '/admin/community', label: '글' },
    { href: '/admin/community/comments', label: '댓글' },
    { href: '/admin/community/reports', label: '신고' },
    { href: '/admin/community/members', label: '닉네임' },
  ],
  [
    { href: '/admin/operator', label: '운영 글' },
    { href: '/admin/operator/profiles', label: '운영 프로필' },
    { href: '/admin/operator/metrics', label: '반응 수치' },
    { href: '/admin/operator/history', label: '변경 이력' },
  ],
];

const ALL_ITEMS = NAV.flatMap((s) => s.items);

function matchItem(item: NavItem, pathname: string) {
  if (item.exact) return pathname === item.href;
  return (item.paths || [item.href]).some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** 회색 mono 아이콘을 마스크로 — 색은 currentColor */
function NavIcon({ name }: { name: string }) {
  const url = `url(/admin-icons/${name}.svg)`;
  return <i aria-hidden className="adm-ic" style={{ WebkitMaskImage: url, maskImage: url }} />;
}

function SideNav({ pathname, badge, onNavigate }: {
  pathname: string;
  badge: { todayUsers: number; pendingPros: number };
  onNavigate?: () => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const activeHref = ALL_ITEMS.find((it) => matchItem(it, pathname))?.href || '';
  const [pill, setPill] = useState<{ y: number; h: number } | null>(null);
  // 고른 메뉴 알약 — 메뉴 사이를 스르르(처음 그릴 땐 제자리에 바로)
  const first = useRef(true);
  useLayoutEffect(() => {
    const el = wrap.current?.querySelector<HTMLElement>(`[data-href="${activeHref}"]`);
    setPill(el ? { y: el.offsetTop, h: el.offsetHeight } : null);
  }, [activeHref]);
  useEffect(() => { if (pill) first.current = false; }, [pill]);
  return (
    <nav ref={wrap} className="adm-nav" aria-label="관리자 메뉴">
      {pill && (
        <span
          className="adm-nav-pill"
          aria-hidden
          style={{ transform: `translateY(${pill.y}px)`, height: pill.h, transition: first.current ? 'none' : undefined }}
        />
      )}
      {NAV.map((section, si) => (
        <div key={section.label || si} className="adm-nav-sec">
          {section.label && <p className="adm-nav-label">{section.label}</p>}
          {section.items.map((item) => {
            const on = item.href === activeHref;
            return (
              <Link key={item.href} href={item.href} data-href={item.href} onClick={onNavigate} className={`adm-nav-item ${on ? 'on' : ''}`} aria-current={on ? 'page' : undefined}>
                <NavIcon name={item.icon} />
                <span className="adm-nav-text">{item.label}</span>
                {item.href === '/admin/users' && badge.pendingPros > 0 && <span className="adm-nav-badge warn">승인 {badge.pendingPros}</span>}
                {item.href === '/admin/users' && badge.pendingPros === 0 && badge.todayUsers > 0 && <span className="adm-nav-badge">+{badge.todayUsers}</span>}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/** 탭 — 고른 탭 바탕이 옆으로 미끄러진다 */
function HeadTabs({ tabs, pathname }: { tabs: { href: string; label: string }[]; pathname: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [ind, setInd] = useState<{ x: number; w: number } | null>(null);
  const activeHref = tabs.find((t) => pathname === t.href)?.href;
  useLayoutEffect(() => {
    const el = wrap.current?.querySelector<HTMLElement>(`[data-tab="${activeHref}"]`);
    setInd(el ? { x: el.offsetLeft, w: el.offsetWidth } : null);
  }, [activeHref]);
  return (
    <div ref={wrap} className="adm-tabs" role="tablist">
      {ind && <span className="adm-tab-ind" aria-hidden style={{ transform: `translateX(${ind.x}px)`, width: ind.w }} />}
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} data-tab={t.href} role="tab" aria-selected={t.href === activeHref} className={`adm-tab ${t.href === activeHref ? 'on' : ''}`}>
          {t.label}
        </Link>
      ))}
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const authUser = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [checked, setChecked] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hasAdminKey, setHasAdminKey] = useState(false);
  const [navBadge, setNavBadge] = useState<{ todayUsers: number; pendingPros: number }>({ todayUsers: 0, pendingPros: 0 });
  // 운영 이슈 서랍(종) — 빨간 점 = 서랍을 마지막으로 닫은 뒤 새로 생긴 이슈
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueCount, setIssueCount] = useState(0);

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
      setChecked(false);
      router.replace('/admin/login');
      return;
    }
    if (!isAdminUser(authUser)) {
      setChecked(false);
      router.replace('/admin/login');
      return;
    }
    setChecked(true);
  }, [hydrated, authUser, router, isLoginPage, hasAdminKey]);

  // 본문을 내리면 머리가 '떠 있는 머리'가 된다(261005 사장 '헤더에서 내리면 그라데이션으로 자연스럽게 고급스럽게').
  //  · data-scrolled = 조금이라도 내렸다 → 머리 아래 가장자리에 바탕색 → 투명 그라데이션이 서서히 깔린다(맨 위에선 없음)
  //  · data-titled  = 큰 제목이 머리 밑으로 들어갔다 → 머리 왼쪽에 작은 제목이 올라온다(데스크톱)
  //  스크롤마다 다시 그리지 않게 상태 대신 .adm-body 속성만 바꾼다(바뀔 때만).
  const mainRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const syncScrolled = useCallback(() => {
    const main = mainRef.current;
    const body = bodyRef.current;
    if (!main || !body) return;
    const scrolled = main.scrollTop > 1;
    const big = main.querySelector<HTMLElement>('.adm-title, .adm-hello-title');
    const titled = scrolled && (!big || big.getBoundingClientRect().bottom <= main.getBoundingClientRect().top + 6);
    if (body.hasAttribute('data-scrolled') !== scrolled) body.toggleAttribute('data-scrolled', scrolled);
    if (body.hasAttribute('data-titled') !== titled) body.toggleAttribute('data-titled', titled);
  }, []);

  // 메뉴를 옮기면 서랍 닫고 본문은 맨 위부터(본문이 자체 스크롤이라 브라우저가 안 올려 준다)
  useEffect(() => {
    setMobileOpen(false);
    if (mainRef.current) mainRef.current.scrollTop = 0;
    syncScrolled();
  }, [pathname, syncScrolled]);

  // 사이드바 뱃지 — 오늘 신규 유저 수 / 승인 대기 사회자 수
  useEffect(() => {
    if (!checked || isLoginPage) return;
    let stop = false;
    const load = async () => {
      try {
        const s: any = await adminFetch('GET', '/api/v1/admin/stats', undefined, { cache: false });
        if (stop) return;
        setNavBadge({
          todayUsers: Number(s?.newUsersToday || 0),
          pendingPros: Number(s?.pendingPros ?? s?.profiles?.proStatus?.pending ?? 0),
        });
      } catch {}
    };
    load();
    const t = setInterval(load, 60_000);
    return () => { stop = true; clearInterval(t); };
  }, [checked, isLoginPage]);

  // 페이지 머리 — 제목·설명·탭
  const head = useMemo(() => {
    const item = ALL_ITEMS.find((it) => matchItem(it, pathname));
    const hiddenKey = Object.keys(HIDDEN_TITLES).find((p) => pathname === p || pathname.startsWith(`${p}/`));
    const tabs = TAB_GROUPS.find((g) => g.some((t) => pathname === t.href)) || null;
    return {
      title: item?.label || (hiddenKey ? HIDDEN_TITLES[hiddenKey] : '관리자'),
      desc: item?.desc || '',
      tabs,
      home: pathname === '/admin',
      /** 화면이 제목을 직접 그린다(페이지별 유입 분석 = 제목 자리 큰 글씨 탭 퀵매칭·웨딩MC·비즈MC, 261005) */
      own: OWN_HEAD.includes(pathname),
    };
  }, [pathname]);

  const closeIssues = useCallback(() => setIssueOpen(false), []);

  const handleLogout = async () => {
    try {
      localStorage.removeItem('admin-key');
    } catch {}
    try {
      await logout?.();
    } catch {}
    router.replace('/admin/login');
  };

  if (isLoginPage) return <>{children}</>;

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F2F4F6]">
        <div className="adm-spinner" aria-label="불러오는 중" />
      </div>
    );
  }

  // 오른쪽 위 = 홈 헤더처럼 박스 없는 라인 아이콘(종). 새로고침 버튼은 뺐다(261005 사장 '새로고침 버튼 없애줘라') —
  // 화면들의 useAdminRefresh 는 남아도 이벤트가 안 와서 그냥 기다리기만 한다(사이드바 뱃지 60초 갱신은 따로 돈다).
  const utilIcons = (
    <>
      <button type="button" onClick={() => setIssueOpen(true)} className="adm-ubtn adm-ubtn-bell" aria-label={`운영 이슈${issueCount ? ` 새 이슈 ${issueCount}건` : ''}`} title="운영 이슈">
        <HeaderBellIcon dot={issueCount > 0} size={44} />
      </button>
    </>
  );

  const brand = (
    <Link href="/admin" className="adm-brand" aria-label="Freetiful 관리자 홈">
      <Image src="/images/logo-freetiful-wordmark.svg" alt="Freetiful" width={104} height={30} priority className="h-[22px] w-auto object-contain" />
      <span className="adm-brand-tag">관리자</span>
    </Link>
  );

  const account = (
    <div className="adm-account">
      <span className="adm-avatar">
        {authUser?.profileImageUrl ? (
          <span role="img" aria-label={authUser.name || '관리자'} style={{ backgroundImage: `url(${authUser.profileImageUrl})` }} />
        ) : (
          <Image src="/icon.svg" alt="" width={22} height={22} className="h-[22px] w-[22px] object-contain" />
        )}
      </span>
      <span className="adm-account-name">{authUser?.name || '관리자'}</span>
      <button type="button" onClick={handleLogout} className="adm-account-out">로그아웃</button>
    </div>
  );

  const sidebarBody = (onNavigate?: () => void) => (
    <>
      <SideNav pathname={pathname} badge={navBadge} onNavigate={onNavigate} />
      <div className="adm-side-foot">
        <Link href="/main" onClick={onNavigate} className="adm-nav-item">
          <NavIcon name="external-link" />
          <span className="adm-nav-text">서비스 홈</span>
        </Link>
        {account}
      </div>
    </>
  );

  return (
    <div className="admin-shell adm-shell">
      <aside className="adm-side">
        <div className="adm-side-top">{brand}</div>
        <div className="adm-side-scroll">{sidebarBody()}</div>
      </aside>

      <div ref={bodyRef} className="adm-body">
        {/* 모바일 머리 — 로고 + 메뉴(바탕색 = 본문 바탕, 261005 사장 '모바일은 헤더를 백그라운드 색상으로') */}
        <header className="adm-mtop">
          {brand}
          <div className="flex items-center">
            {utilIcons}
            <button type="button" onClick={() => setMobileOpen(true)} className="adm-mtop-btn" aria-label="관리자 메뉴 열기">
              <NavIcon name="menu" />
            </button>
          </div>
        </header>

        {/* 데스크톱 머리 — 본문 위 한 줄(스크롤 밖이라 늘 그 자리). 맨 위에선 바탕과 같은 색이라 안 보이고,
            내리면 아래 가장자리 그라데이션 + 작은 제목이 서서히 올라와 '떠 있는 머리'가 된다 */}
        <header className="adm-dtop">
          <div className="adm-dtop-in">
            <p className="adm-dtop-title" aria-hidden="true">{head.title}</p>
            <div className="adm-dtop-act">{utilIcons}</div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          <main ref={mainRef} className="admin-main adm-main" onScroll={syncScrolled}>
            <div className={`adm-frame ${head.home ? 'home' : ''}`}>
              {!head.home && !head.own && (
                <div className="adm-head">
                  {/* 제목은 바뀔 때만 다시 올라오고, 탭은 남아서 고른 바탕이 미끄러진다 */}
                  <div key={head.title}>
                    <h1 className="adm-title">{head.title}</h1>
                    {head.desc && <p className="adm-desc">{head.desc}</p>}
                  </div>
                  {head.tabs && <HeadTabs key={head.tabs[0].href} tabs={head.tabs} pathname={pathname} />}
                </div>
              )}
              <div className="admin-page-frame adm-content" key={pathname}>{children}</div>
            </div>
          </main>
          <AdminIssuePanel open={issueOpen} onClose={closeIssues} onUnseen={setIssueCount} />
          <AdminDialogHost />
        </div>
      </div>

      {mobileOpen && (
        <div className="adm-drawer-wrap" role="dialog" aria-modal="true" aria-label="관리자 메뉴">
          <div className="adm-drawer-dim" onClick={() => setMobileOpen(false)} />
          <aside className="adm-drawer">
            <div className="adm-side-top">
              {brand}
              <button type="button" onClick={() => setMobileOpen(false)} className="adm-mtop-btn" aria-label="관리자 메뉴 닫기">
                <NavIcon name="x" />
              </button>
            </div>
            <div className="adm-side-scroll">{sidebarBody(() => setMobileOpen(false))}</div>
          </aside>
        </div>
      )}
    </div>
  );
}
