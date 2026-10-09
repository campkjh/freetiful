'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentType, type MouseEvent, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useT, type Translations } from '@/lib/biz/i18n';
import { BIZ_TABBAR_HOLD_EVENT, holdBizTabBar, prefersReducedMotion, scrollToY, setPendingBizSection } from './scroll-to';
import { BizCompanyTabIcon, BizHomeTabIcon, BizInquiryTabIcon, BizNewsTabIcon } from './BizTabIcons';

/*
 * 비즈 모바일 하단 탭바(261008 사장 '모바일 네비게이션바 홈 · 뉴스소식 · 문의하기 · 기업소개 — 디자인은 프리티풀 홈처럼').
 * 생김새 · 움직임은 프리티풀 홈 하단 탭바((main)/layout.tsx '토스 하단바')를 그대로 옮긴 것 — 흰 바 · 위만 둥근 24 · 가는 테두리 그림자,
 * 칸 58 · 아이콘 26(평소 선 / 선택 채움) · 라벨 11px, 누르면 쫀득(jelly), 스크롤 내리면 숨고 올리면 나온다.
 * 비즈 레이아웃(biz/layout.tsx)에서 한 번만 마운트 — 비즈 화면끼리 옮겨 다녀도 다시 그리지 않는다.
 * 바는 body 로 포털해 그린다 — (main) 레이아웃의 화면 전환 래퍼(PageTransition, 0.4s transform)가 fixed 기준을 바꿔
 * 앱 화면에서 비즈로 들어올 때 바가 문서 맨 끝(화면 밖)에 놓이고, 처음 한 번 올라오는 움직임이 화면 밖에서 끝나 버렸다.
 *
 * 탭 4개는 모두 비즈 안의 화면이다(261009 사장 '홈 누르면 프리티풀 홈이 아니라 비즈 홈 · 뉴스소식은 따로 뉴스 화면 ·
 * 문의하기는 문의 섹션으로 내려가지 말고 상담 채팅 · 기업소개는 CEO 인사말') —
 *   홈 = /biz(이미 /biz 면 맨 위로) · 뉴스·소식 = /biz/news · 문의하기 = /biz/inquiry(상담 채팅) · 기업소개 = /biz/ceo.
 *   (261009 사장 지시로 '문의하기' 탭 이름은 '비즈문의' — 칸 · 경로는 그대로)
 *   예전 '홈 = 프리티풀 앱 홈(/main)' · '문의하기 = /biz 문의 섹션으로 스크롤'은 없어졌다(문의 섹션 자체가 지워짐) —
 *   그래서 /biz 스크롤 위치로 선택을 바꾸던 스크롤 스파이도 걷어냈다. 앱으로 나가는 길은 비즈 머리줄 '프리티풀로' 글자 탭.
 *
 * 선택: /biz → 홈 · /biz/news → 뉴스·소식 · /biz/ceo · history · clients → 기업소개 · /biz/faq · complete → 문의하기.
 * 그리지 않는 화면: /biz/inquiry(상담 채팅 — 입력 줄이 바닥을 쓴다) · /biz/lab(개발용 장면 실험실).
 *
 * iOS 앱 연결(261009):
 *   · 바에 data-ios-biz-bottom-nav + data-active-tab(home|news|inquiry|company) — 새 iOS 빌드는 이 표시를 보면 네이티브 비즈 탭(같은 4개)을 띄우고
 *     html 에 data-native-biz-tabs="1" 을 달아 웹 바를 숨긴다(아래 CSS 도 같이 숨긴다 — 앱이 인라인 display:none 을 늦게 달아도 한 번 비치지 않게).
 *   · window.__freetifulBizTab(id) = 그 탭을 누른 것과 같은 동작. 네이티브 탭이 이걸 부른다(없으면 앱이 그 경로로 직접 이동).
 *   · data-native-biz-nav 는 옛 iOS 앱(네이티브 비즈 하단 네비)이 이 바를 찾는 표시라 남긴다(옛 앱은 CSS 로 숨긴다 — 포털이어도 그대로 먹는다).
 *   · ⚠ data-ios-mobile-bottom-nav 는 절대 붙이지 말 것 — 붙이면 iOS 앱 네이티브 탭바(홈 · 웨딩숲 …)가 비즈 위에 뜬다.
 *
 * 보이는 폭 = 1024 미만(lg:hidden). PC 는 비즈 머리줄(BizHeader)이 가운데 글자 링크(뉴스·소식 · 기업소개 · 문의하기)를 맡는다.
 */

// 붙잡기 · 섹션 이동은 의존성 없는 scroll-to.ts 에 있다 — 예전 import 경로(@/components/biz/BizTabBar)도 그대로 쓰이게 다시 내보낸다
export { holdBizTabBar };

export type BizTabKey = 'home' | 'news' | 'inquiry' | 'company';
type TabIcon = ComponentType<{ active?: boolean; className?: string }>;

const TABS: { key: BizTabKey; href: string; icon: TabIcon; label: Translations }[] = [
  { key: 'home', href: '/biz', icon: BizHomeTabIcon, label: { ko: '홈', en: 'Home', ja: 'ホーム', zh: '首页' } },
  { key: 'news', href: '/biz/news', icon: BizNewsTabIcon, label: { ko: '뉴스·소식', en: 'News', ja: 'ニュース', zh: '新闻资讯' } },
  // 261009 사장 '문의하기를 비즈문의로 바꿔줘 — 네비게이션바에 있는 거'(머리줄 가운데 메뉴도 같이. 바닥 링크는 범위 밖이라 '문의하기' 그대로)
  { key: 'inquiry', href: '/biz/inquiry', icon: BizInquiryTabIcon, label: { ko: '비즈문의', en: 'Biz inquiry', ja: 'ビズお問合せ', zh: '企业咨询' } },
  { key: 'company', href: '/biz/ceo', icon: BizCompanyTabIcon, label: { ko: '기업소개', en: 'About', ja: '会社紹介', zh: '公司介绍' } },
];
const TAB_HREF: Record<BizTabKey, string> = { home: '/biz', news: '/biz/news', inquiry: '/biz/inquiry', company: '/biz/ceo' };
const isTabKey = (v: unknown): v is BizTabKey => typeof v === 'string' && v in TAB_HREF;

/** 화면별 선택 탭 — 모르는 비즈 화면(없는 주소 등)은 아무것도 고르지 않는다 */
function tabForPath(pathname: string): BizTabKey | null {
  if (pathname === '/biz') return 'home';
  if (/^\/biz\/news(\/|$)/.test(pathname)) return 'news';
  if (/^\/biz\/(ceo|history|clients)(\/|$)/.test(pathname)) return 'company';
  if (/^\/biz\/(faq|complete|inquiry)(\/|$)/.test(pathname)) return 'inquiry';
  return null;
}

/** 탭바를 그리지 않는 화면 — 상담 채팅(자기 입력 줄이 바닥) · 개발용 장면 실험실 */
const isBarHidden = (pathname: string) => /^\/biz\/(inquiry|lab)(\/|$)/.test(pathname);

/** 새 탭 · 새 창으로 열기(⌘ · Ctrl · Shift · 가운데 단추)는 브라우저에 맡긴다 */
const isPlainClick = (e: MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** 붙잡기는 스크롤이 이어지는 동안 조금씩 늘어난다(줄인 움직임 · 느린 기기에서 마지막 scroll 이 붙잡기 끝난 뒤 와 바가 숨던 것) — 이 만큼까지만 */
const HOLD_MAX_EXTRA = 3000;

declare global {
  interface Window {
    /** iOS 네이티브 비즈 탭 → 웹 탭 누름과 같은 동작(261009) */
    __freetifulBizTab?: (id: string) => void;
  }
}

export default function BizTabBar() {
  const t = useT();
  const pathname = usePathname() || '';
  const router = useRouter();
  const hidden = isBarHidden(pathname);

  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  const [navVisible, setNavVisible] = useState(true);
  const [navMounted, setNavMounted] = useState(false); // 처음(또는 상담 채팅에서 돌아올 때) 한 번 아래에서 올라온다
  const lastScrollY = useRef(0);
  const holdUntil = useRef(0);
  const holdCap = useRef(0);

  /**
   * 다른 화면으로 가는 탭을 누르면 화면이 바뀔 때까지 그 탭을 먼저 선택해 둔다(누른 표시 — dev 는 이동에 2~5초).
   * 화면이 바뀌거나 지금 화면 탭(맨 위로)을 누르면 풀린다
   */
  const [pendingTab, setPendingTab] = useState<BizTabKey | null>(null);
  const pendingTimer = useRef<number | undefined>(undefined);
  const setPending = useCallback((key: BizTabKey | null) => {
    if (pendingTimer.current) { window.clearTimeout(pendingTimer.current); pendingTimer.current = undefined; }
    setPendingTab(key);
    if (key) pendingTimer.current = window.setTimeout(() => { setPendingTab(null); pendingTimer.current = undefined; }, 20_000); // 이동이 끝내 안 되면 풀기
  }, []);
  /** 탭으로 시작한 화면 이동이 아직 안 끝났는지(시작 시각, 0 = 없음) — 그 사이 지금 화면 탭을 누르면 그 이동을 덮어써 마지막 누름이 이기게 한다 */
  const navPendingAt = useRef(0);

  /** 붙잡기 — 이미 더 길게 붙잡혀 있으면 줄이지 않는다(뒤로가기 800 다음에 오는 화면 바뀜 500 처럼) */
  const hold = useCallback((ms: number) => {
    const now = performance.now();
    holdUntil.current = Math.max(holdUntil.current, now + ms);
    holdCap.current = Math.max(holdCap.current, now + ms + HOLD_MAX_EXTRA);
  }, []);

  useEffect(() => { setPortalEl(document.body); }, []);

  // 처음 한 번 아래에서 올라온다. 상담 채팅(바 없음)에서 다른 비즈 화면으로 돌아올 때도 같은 움직임으로 다시 올라오게 —
  // 숨는 화면에선 '아직 안 올라온' 상태로 되돌려 둔다
  useEffect(() => {
    if (hidden) { setNavMounted(false); return undefined; }
    const tm = window.setTimeout(() => setNavMounted(true), 30);
    return () => window.clearTimeout(tm);
  }, [hidden]);

  // 스크롤 내리면 숨고 올리면 나온다 — (main)/layout.tsx navVisible 계산 그대로(+ 탭이 스스로 스크롤하는 동안은 그대로 둔다)
  useEffect(() => {
    lastScrollY.current = window.scrollY;
    const onScroll = () => {
      // 모달이 문서를 잠근 동안(useBodyScrollLock = body fixed → scrollY 0) · 풀며 제자리로 돌아오는 순간은 사람의 스크롤이 아니다 —
      // 잠긴 동안 lastScrollY 를 잠그기 전 값으로 두면 풀 때 같은 자리로 돌아와 '변화 없음'으로 읽힌다(뉴스 카드 열고 닫으면 바가 숨던 것)
      if (document.body.style.position === 'fixed') return;
      const currentY = window.scrollY;
      const now = performance.now();
      if (now < holdUntil.current) {
        // 붙잡는 동안 스크롤이 이어지면(스스로 굴러가는 중) 조금 더 붙잡는다 — 끝 무렵 scroll 이 붙잡기 뒤에 와 바가 숨지 않게
        holdUntil.current = Math.min(holdCap.current, Math.max(holdUntil.current, now + 250));
        setNavVisible(true);
      } else if (currentY > lastScrollY.current && currentY > 80) {
        setNavVisible(false);
      } else {
        setNavVisible(true);
      }
      lastScrollY.current = currentY;
    };
    // 다른 화면(장면 CTA · 머리줄 등)이 스스로 스크롤하며 붙잡아 달라고 할 때. 예전 detail.tab(문의 섹션 선택 미리 고르기)은
    // 문의 섹션이 없어져(261009) 쓰지 않는다 — /biz 는 어디로 스크롤하든 '홈'
    const onHold = (e: Event) => {
      const { ms = 1500 } = ((e as CustomEvent<{ ms?: number }>).detail) || {};
      hold(ms);
      setNavVisible(true);
    };
    // 사람이 직접 움직이기 시작하면 붙잡기를 푼다
    const onUser = () => {
      holdUntil.current = 0;
      holdCap.current = 0;
    };
    // 뒤로 · 앞으로 — 브라우저가 스크롤을 원래 자리로 되살리는 점프는 '아래로 스크롤'이 아니다(손대지 않았는데 바가 숨은 채 시작하던 것).
    // 다른 화면이 /biz 섹션으로 가려고 맡겨 둔 이동(scroll-to 대기 섹션)도 여기서 버린다 — 돌아간 /biz 가 엉뚱하게 내려가지 않게
    const onPop = () => {
      hold(800);
      setNavVisible(true);
      setPendingBizSection(null);
      setPending(null);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener(BIZ_TABBAR_HOLD_EVENT, onHold);
    window.addEventListener('wheel', onUser, { passive: true });
    window.addEventListener('touchmove', onUser, { passive: true });
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener(BIZ_TABBAR_HOLD_EVENT, onHold);
      window.removeEventListener('wheel', onUser);
      window.removeEventListener('touchmove', onUser);
      window.removeEventListener('popstate', onPop);
    };
  }, [hold, setPending]);

  // 비즈 화면을 옮기면 바는 다시 보이게(숨은 채로 새 화면 맨 위에 서 있지 않게) — 잠깐 붙잡아 새 화면의 스크롤 되살리기 점프에도 숨지 않게.
  // layout effect — 화면 쪽 effect 보다 먼저 이동 끝을 알아야 누른 탭 표시가 새 화면 기준으로 한 번에 바뀐다
  useIsoLayoutEffect(() => {
    setNavVisible(true);
    lastScrollY.current = window.scrollY;
    hold(500);
    navPendingAt.current = 0;
    setPending(null);
    // /biz 가 아닌 화면에 닿았으면 아직 안 쓴 /biz 섹션 이동은 버린다
    if (pathname !== '/biz') setPendingBizSection(null);
  }, [pathname, hold, setPending]);

  useEffect(() => () => {
    if (pendingTimer.current) window.clearTimeout(pendingTimer.current);
  }, []);

  /**
   * 탭 누름 — 웹 탭 · iOS 네이티브 탭(window.__freetifulBizTab) 공통.
   * 지금 화면 탭이면 맨 위로(앞서 누른 다른 탭의 이동이 아직 안 끝났으면 그 이동을 덮어써 지금 누름이 이기게) → true(링크 이동 막기).
   * 다른 화면이면 누른 탭을 먼저 선택해 두고 false(이동은 링크 · 호출한 쪽이).
   */
  const activate = (key: BizTabKey): boolean => {
    // 어느 탭이든 누르면 다른 화면이 맡겨 둔 /biz 섹션 이동은 버린다(나중에 /biz 를 열 때 엉뚱하게 내려가지 않게)
    setPendingBizSection(null);
    const href = TAB_HREF[key];
    if (href === pathname) {
      setPending(null);
      const started = navPendingAt.current;
      navPendingAt.current = 0;
      if (started && performance.now() - started < 20_000) router.replace(pathname, { scroll: false });
      holdBizTabBar(1500);
      scrollToY(0);
      return true;
    }
    navPendingAt.current = performance.now();
    setPending(key);
    return false;
  };
  const activateRef = useRef(activate);
  activateRef.current = activate;

  // iOS 네이티브 비즈 탭이 부르는 다리 — 비즈 레이아웃에 붙어 있는 동안 늘 걸어 둔다(상담 채팅처럼 바를 안 그리는 화면에서 불려도 그 탭으로 간다)
  useEffect(() => {
    window.__freetifulBizTab = (id: string) => {
      if (!isTabKey(id)) return;
      try {
        if (!activateRef.current(id)) router.push(TAB_HREF[id]);
      } catch { /* noop */ }
    };
    return () => { try { delete window.__freetifulBizTab; } catch { /* noop */ } };
  }, [router]);

  if (hidden) return null;

  // 누른 탭(이동 중) > 화면 기준
  const active: BizTabKey | null = pendingTab || tabForPath(pathname);

  const onTabClick = (key: BizTabKey) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(e)) return;
    if (activate(key)) e.preventDefault();
  };

  const onTabPointerDown = (e: PointerEvent<HTMLAnchorElement>) => {
    // 누르는 순간 아이콘이 옆으로 쫀득하게 늘어났다 출렁이며 제자리 — 프리티풀 홈 탭바와 같은 움직임, 같은 탭을 다시 눌러도 처음부터
    const icon = e.currentTarget.querySelector<HTMLElement>('[data-tab-icon]');
    if (!icon || prefersReducedMotion()) return;
    icon.style.animation = 'none';
    void icon.offsetWidth;
    icon.style.animation = 'bizTabJelly 0.64s linear both';
  };

  // 탭바에 맨 아래 내용이 가리지 않게 같은 높이 빈칸 — /biz · /biz/ceo 는 어두운 바닥글(TossChrome BizFooter)이 스스로 아래 여백을 두고
  // (.tc-foot-in — 빈칸을 두면 남색 아래 흰 띠만 남았다, 261009 CEO 인사말 개편), 완료 화면은 스스로 아래 여백을 둔다
  const needsSpacer = pathname !== '/biz' && !/^\/biz\/(ceo|complete)(\/|$)/.test(pathname);

  const nav = (
    <nav
      data-native-biz-nav
      data-ios-biz-bottom-nav
      data-active-tab={active || undefined}
      data-no-natural-reveal
      aria-label={t({ ko: '비즈 메뉴', en: 'Business menu', ja: 'ビジネスメニュー', zh: '企业菜单' })}
      className="fixed inset-x-0 bottom-0 z-50 lg:hidden"
      style={{
        transform: navMounted && navVisible ? 'translateY(0)' : 'translateY(110%)',
        transition: 'transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)',
      }}
      // 키보드로 숨은 바에 초점이 오면 다시 꺼낸다(화면 밖 링크에 초점이 머물지 않게)
      onFocusCapture={() => setNavVisible(true)}
    >
      <div
        data-nav-pill
        className="mx-auto max-w-[640px] rounded-t-[24px] bg-white pb-safe"
        style={{ boxShadow: '0 0 0 0.5px #E4E4E7, 0 -2px 12px rgba(0, 0, 0, 0.03)' }}
      >
        <div className="flex h-[58px] items-stretch px-3">
          {TABS.map(({ key, href, icon: Icon, label }) => {
            const isActive = active === key;
            // 'page' 는 링크가 지금 화면 그 자체일 때만 — 묶음 선택(history 의 기업소개 · faq 의 문의하기 등)은 'true'
            const current = isActive ? (href === pathname ? 'page' : 'true') : undefined;
            return (
              <Link
                key={key}
                href={href}
                data-nav={key}
                aria-current={current}
                className="flex min-w-0 flex-1 flex-col items-center justify-center gap-[4px] text-[#4E5968]"
                onClick={onTabClick(key)}
                onPointerDown={onTabPointerDown}
              >
                <span data-tab-icon className="relative block h-[26px] w-[26px]" style={{ transformOrigin: '50% 60%' }}>
                  <Icon active={isActive} className="h-[26px] w-[26px]" />
                </span>
                <span className={`whitespace-nowrap text-[11px] leading-[13px] tracking-[-0.2px] text-[#4E5968] ${isActive ? 'font-semibold' : 'font-medium'}`}>
                  {t(label)}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );

  return (
    <>
      {needsSpacer && <div aria-hidden className="biz-tabbar-spacer bg-white lg:hidden" />}
      {portalEl && createPortal(nav, portalEl)}
      {/* dangerouslySetInnerHTML — 안의 따옴표(")를 서버가 &quot; 로 바꿔 내보내 하이드레이션이 어긋났다(<style> 은 엔티티를 안 푼다) */}
      <style dangerouslySetInnerHTML={{ __html: `
        /* 탭 누름 — (main)/layout.tsx 의 tabJelly 와 같은 값(그 바는 /biz 에서 안 그려져 keyframes 도 없다): 가로로 1.3배 늘며 세로는 눌렸다가, 반대로 한 번·또 한 번 작게 출렁이고 멈춘다 */
        @keyframes bizTabJelly {
          0%   { transform: scale(1, 1); }
          22%  { transform: scale(1.3, 0.82); }
          40%  { transform: scale(0.88, 1.1); }
          56%  { transform: scale(1.1, 0.95); }
          70%  { transform: scale(0.96, 1.03); }
          84%  { transform: scale(1.02, 0.99); }
          100% { transform: scale(1, 1); }
        }
        /* 탭바 높이(58 + .pb-safe) 만큼 */
        .biz-tabbar-spacer { height: calc(58px + max(0.5rem, env(safe-area-inset-bottom))); }
        html[data-platform="android"] .biz-tabbar-spacer { height: calc(58px + 0.5rem); }
        /* iOS 새 빌드가 네이티브 비즈 탭을 띄운 동안 웹 바는 숨긴다(앱이 인라인 display:none 도 다는데, 그보다 먼저 한 번 비치지 않게 — 261009) */
        html[data-native-biz-tabs="1"] [data-ios-biz-bottom-nav] { display: none !important; }
      ` }} />
    </>
  );
}
