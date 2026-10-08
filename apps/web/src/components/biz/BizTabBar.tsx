'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentType, type MouseEvent, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useT, type Translations } from '@/lib/biz/i18n';
import {
  BIZ_TABBAR_HOLD_EVENT, hasPendingBizSection, holdBizTabBar, prefersReducedMotion, scrollToBizSection, scrollToElement, scrollToY,
  setPendingBizSection,
} from './scroll-to';
import { BizCompanyTabIcon, BizHomeTabIcon, BizInquiryTabIcon, BizNewsTabIcon } from './BizTabIcons';

/*
 * 비즈 모바일 하단 탭바(261008 사장 '모바일 네비게이션바 홈 · 뉴스소식 · 문의하기 · 기업소개 — 디자인은 프리티풀 홈처럼').
 * 생김새 · 움직임은 프리티풀 홈 하단 탭바((main)/layout.tsx '토스 하단바')를 그대로 옮긴 것 — 흰 바 · 위만 둥근 24 · 가는 테두리 그림자,
 * 칸 58 · 아이콘 26(평소 선 / 선택 채움) · 라벨 11px, 누르면 쫀득(jelly), 스크롤 내리면 숨고 올리면 나온다.
 * 비즈 레이아웃(biz/layout.tsx)에서 한 번만 마운트 — 비즈 화면끼리 옮겨 다녀도 다시 그리지 않는다.
 * 바는 body 로 포털해 그린다 — (main) 레이아웃의 화면 전환 래퍼(PageTransition, 0.4s transform)가 fixed 기준을 바꿔
 * 앱 화면에서 비즈로 들어올 때 바가 문서 맨 끝(화면 밖)에 놓이고, 처음 한 번 올라오는 움직임이 화면 밖에서 끝나 버렸다.
 *
 * ⚠ data-native-biz-nav 는 옛 iOS 앱(네이티브 비즈 하단 네비)이 이 바를 찾는 표시라 남긴다(옛 앱은 CSS 로 숨긴다 — 포털이어도 그대로 먹는다).
 *   data-ios-mobile-bottom-nav 는 절대 붙이지 말 것 — 붙이면 iOS 앱 네이티브 탭바(홈 · 웨딩숲 …)가 비즈 위에 뜬다.
 *
 * 보이는 폭 = 1024 미만(lg:hidden). 비즈 머리줄(TossChrome BizNav)이 햄버거로 바뀌는 폭(≤1023)과 같고,
 * 왼쪽 눈금(tc-dock)은 1024 이상에서만 나온다 → 탭바와 눈금이 같이 뜨는 폭도, 둘 다 없는 폭도 없다(옛 바 md:hidden 은 768~1023 이 비었다).
 */

// 붙잡기 · 섹션 이동은 의존성 없는 scroll-to.ts 에 있다 — 예전 import 경로(@/components/biz/BizTabBar)도 그대로 쓰이게 다시 내보낸다
export { holdBizTabBar };

type TabKey = 'home' | 'news' | 'inquiry' | 'company';
type TabIcon = ComponentType<{ active?: boolean; className?: string }>;

const TABS: { key: TabKey; href: string; icon: TabIcon; label: Translations }[] = [
  // 홈 = 프리티풀 앱 홈(옛 '홈으로' 뒤로 단추 자리 — 비즈에서 앱으로 나가는 길). 비즈 안에선 늘 비선택
  { key: 'home', href: '/main', icon: BizHomeTabIcon, label: { ko: '홈', en: 'Home', ja: 'ホーム', zh: '首页' } },
  { key: 'news', href: '/biz/news', icon: BizNewsTabIcon, label: { ko: '뉴스·소식', en: 'News', ja: 'ニュース', zh: '新闻资讯' } },
  // href 의 해시는 새 탭으로 열 때(가운데 클릭 · 길게 눌러 열기) 쓰인다 — 보통 누름은 onClick 이 처리
  { key: 'inquiry', href: '/biz#문의폼', icon: BizInquiryTabIcon, label: { ko: '문의하기', en: 'Contact', ja: 'お問合せ', zh: '咨询' } },
  { key: 'company', href: '/biz', icon: BizCompanyTabIcon, label: { ko: '기업소개', en: 'About', ja: '会社紹介', zh: '公司介绍' } },
];

/** /biz 에서 이 섹션이 화면 가운데 띠에 걸리면 '문의하기'가 선택된다(문의폼 section 안에 문의 div) */
const INQUIRY_SECTION_IDS = ['문의폼', '문의'];

/** 화면별 선택 탭 — /biz 는 스크롤 위치(문의 섹션이 가운데면 문의하기, 아니면 기업소개) */
function tabForPath(pathname: string, inquiryInView: boolean): TabKey {
  if (pathname === '/biz') return inquiryInView ? 'inquiry' : 'company';
  if (/^\/biz\/news(\/|$)/.test(pathname)) return 'news';
  if (/^\/biz\/(faq|complete)(\/|$)/.test(pathname)) return 'inquiry';
  return 'company'; // ceo · history · clients — 회사 소개 화면들
}

/** 새 탭 · 새 창으로 열기(⌘ · Ctrl · Shift · 가운데 단추)는 브라우저에 맡긴다 */
const isPlainClick = (e: MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** 붙잡기는 스크롤이 이어지는 동안 조금씩 늘어난다(줄인 움직임 · 느린 기기에서 마지막 scroll 이 붙잡기 끝난 뒤 와 바가 숨던 것) — 이 만큼까지만 */
const HOLD_MAX_EXTRA = 3000;

export default function BizTabBar() {
  const t = useT();
  const pathname = usePathname() || '';
  const router = useRouter();

  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  const [navVisible, setNavVisible] = useState(true);
  const [navMounted, setNavMounted] = useState(false); // 처음 한 번만 아래에서 올라온다
  const lastScrollY = useRef(0);
  const holdUntil = useRef(0);
  const holdCap = useRef(0);

  /** /biz 스크롤 위치로 고른 선택 — 문의 섹션이 가운데 띠에 걸렸는지 */
  const [inquiryInView, setInquiryInView] = useState(false);
  /** 탭을 누른 직후 스크롤이 도착할 때까지는 누른 탭을 먼저 선택해 둔다(가는 길에 지나는 섹션으로 선택이 깜빡이지 않게) */
  const [forcedTab, setForcedTab] = useState<TabKey | null>(null);
  const forcedTimer = useRef<number | undefined>(undefined);
  const forceTab = useCallback((key: TabKey | null, ms = 0) => {
    if (forcedTimer.current) { window.clearTimeout(forcedTimer.current); forcedTimer.current = undefined; }
    setForcedTab(key);
    if (key) forcedTimer.current = window.setTimeout(() => { setForcedTab(null); forcedTimer.current = undefined; }, ms);
  }, []);

  /**
   * 다른 화면으로 가는 탭을 누르면 화면이 바뀔 때까지 그 탭을 먼저 선택해 둔다(누른 표시 — dev 는 이동에 2~5초).
   * 화면이 바뀌거나 같은 화면 스크롤 탭을 누르면 풀린다
   */
  const [pendingTab, setPendingTab] = useState<TabKey | null>(null);
  const pendingTimer = useRef<number | undefined>(undefined);
  const setPending = useCallback((key: TabKey | null) => {
    if (pendingTimer.current) { window.clearTimeout(pendingTimer.current); pendingTimer.current = undefined; }
    setPendingTab(key);
    if (key) pendingTimer.current = window.setTimeout(() => { setPendingTab(null); pendingTimer.current = undefined; }, 20_000); // 이동이 끝내 안 되면 풀기
  }, []);
  /** 탭으로 시작한 화면 이동이 아직 안 끝났는지(시작 시각, 0 = 없음) — 그 사이 /biz 스크롤 탭을 누르면 그 이동을 덮어써 마지막 누름이 이기게 한다 */
  const navPendingAt = useRef(0);
  const pendingTabRef = useRef<TabKey | null>(null);
  pendingTabRef.current = pendingTab;

  /** 붙잡기 — 이미 더 길게 붙잡혀 있으면 줄이지 않는다(뒤로가기 800 다음에 오는 화면 바뀜 500 처럼) */
  const hold = useCallback((ms: number) => {
    const now = performance.now();
    holdUntil.current = Math.max(holdUntil.current, now + ms);
    holdCap.current = Math.max(holdCap.current, now + ms + HOLD_MAX_EXTRA);
  }, []);

  useEffect(() => {
    setPortalEl(document.body);
    const tm = window.setTimeout(() => setNavMounted(true), 30);
    return () => window.clearTimeout(tm);
  }, []);

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
    const onHold = (e: Event) => {
      const { ms = 1500, tab } = ((e as CustomEvent<{ ms?: number; tab?: TabKey }>).detail) || {};
      hold(ms);
      setNavVisible(true);
      if (tab) forceTab(tab, ms);
    };
    // 사람이 직접 움직이기 시작하면 붙잡기 · 먼저 고른 탭을 푼다
    const onUser = () => {
      holdUntil.current = 0;
      holdCap.current = 0;
      if (forcedTimer.current) forceTab(null);
    };
    // 뒤로 · 앞으로 — 브라우저가 스크롤을 원래 자리로 되살리는 점프는 '아래로 스크롤'이 아니다(손대지 않았는데 바가 숨은 채 시작하던 것).
    // 아직 /biz 에 닿지 않은 '문의하기' 이동도 여기서 버린다(돌아간 화면이 /biz 면 엉뚱하게 문의폼으로 내려가지 않게)
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
  }, [forceTab, hold, setPending]);

  // 비즈 화면을 옮기면 바는 다시 보이게(숨은 채로 새 화면 맨 위에 서 있지 않게) — 잠깐 붙잡아 새 화면의 스크롤 되살리기 점프에도 숨지 않게.
  // layout effect — /biz 페이지의 useEffect 가 대기 섹션을 읽어 지우기 전에 봐야 한다(형제 중 페이지가 앞이라 passive 끼리는 페이지가 먼저 돈다)
  useIsoLayoutEffect(() => {
    setNavVisible(true);
    lastScrollY.current = window.scrollY;
    hold(500);
    navPendingAt.current = 0;
    // '문의하기'로 /biz 에 닿은 순간부터 문의하기 선택(예전엔 페이지가 rAF 두 번 + 120ms 뒤 붙잡을 때까지 기업소개가 잠깐 보였다)
    if (pathname === '/biz' && pendingTabRef.current === 'inquiry' && hasPendingBizSection()) forceTab('inquiry', 2500);
    setPending(null);
    // /biz 가 아닌 화면에 닿았으면 아직 안 쓴 '문의하기' 이동은 버린다
    if (pathname !== '/biz') setPendingBizSection(null);
  }, [pathname, forceTab, hold, setPending]);

  useEffect(() => () => {
    if (forcedTimer.current) window.clearTimeout(forcedTimer.current);
    if (pendingTimer.current) window.clearTimeout(pendingTimer.current);
  }, []);

  // /biz 스크롤 스파이 — 문의 섹션이 화면 가운데 띠(위아래 45% 빼고 남는 10%)에 걸려 있는지.
  // 섹션이 늦게 생기거나 다시 그려져도 잡히게 DOM 변화를 보고 다시 붙인다
  useEffect(() => {
    if (pathname !== '/biz') { setInquiryInView(false); return undefined; }
    const hits = new Map<Element, boolean>();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => hits.set(en.target, en.isIntersecting));
      setInquiryInView(Array.from(hits.values()).some(Boolean));
    }, { rootMargin: '-45% 0px -45% 0px' });
    const attach = () => {
      hits.forEach((_, el) => {
        if (!el.isConnected) { io.unobserve(el); hits.delete(el); }
      });
      INQUIRY_SECTION_IDS.forEach((id) => {
        const el = document.getElementById(id);
        if (el && !hits.has(el)) { hits.set(el, false); io.observe(el); }
      });
    };
    attach();
    let queued = false;
    const mo = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; attach(); });
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, [pathname]);

  if (/^\/biz\/lab(\/|$)/.test(pathname)) return null; // 개발용 장면 실험실엔 띄우지 않는다

  // 누른 탭(이동 중) > 먼저 고른 탭(/biz 안에서만 — 다른 화면으로 옮겨 가면 그 화면 기준) > 화면 · 스크롤 기준
  const active: TabKey = pendingTab || (pathname === '/biz' && forcedTab) || tabForPath(pathname, inquiryInView);

  /** /biz 에서 같은 화면 스크롤 탭을 눌렀을 때 — 앞서 누른 탭의 화면 이동이 아직 진행 중이면 그 이동을 덮어써 지금 누른 게 이기게 */
  const cancelPendingNav = () => {
    setPending(null);
    const started = navPendingAt.current;
    navPendingAt.current = 0;
    if (!started || performance.now() - started > 20_000) return; // 20초 넘게 안 끝난 이동은 실패한 것으로 본다
    router.replace('/biz', { scroll: false });
  };

  const onTabClick = (key: TabKey, href: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(e)) return;
    // 다른 탭을 누르면 아직 /biz 에 닿지 않은 '문의하기' 이동은 버린다(나중에 /biz 를 열 때 엉뚱하게 문의폼으로 내려가지 않게)
    if (key !== 'inquiry') setPendingBizSection(null);
    if (key === 'inquiry') {
      e.preventDefault();
      if (pathname === '/biz') {
        cancelPendingNav();
        // Lenis 부드러운 스크롤과 섞이지 않게 — 페이지 메뉴 · 자료실 · 장면 CTA 와 같은 도우미(도착 자리 · 탭바 붙잡기 포함)
        scrollToBizSection('문의폼');
        return;
      }
      setPendingBizSection('문의폼');
      setPending('inquiry');
      navPendingAt.current = performance.now();
      router.push('/biz');
      return;
    }
    if (key === 'company' && pathname === '/biz') {
      e.preventDefault();
      cancelPendingNav();
      holdBizTabBar(1500, 'company');
      const el = document.getElementById('회사소개');
      if (el) scrollToElement(el);
      else scrollToY(0);
      return;
    }
    // 홈 · 뉴스 · (다른 비즈 화면에서) 기업소개 = 보통 링크 이동.
    // 지금 화면과 같은 곳이면(뉴스에서 뉴스) 새 이동이 앞서 누른 탭의 이동을 덮으므로 그 탭의 먼저 선택도 푼다
    if (href === pathname) {
      setPending(null);
      navPendingAt.current = 0;
      return;
    }
    navPendingAt.current = performance.now();
    if (key !== 'home') setPending(key); // 홈은 비즈 안에선 늘 비선택
  };

  const onTabPointerDown = (e: PointerEvent<HTMLAnchorElement>) => {
    // 누르는 순간 아이콘이 옆으로 쫀득하게 늘어났다 출렁이며 제자리 — 프리티풀 홈 탭바와 같은 움직임, 같은 탭을 다시 눌러도 처음부터
    const icon = e.currentTarget.querySelector<HTMLElement>('[data-tab-icon]');
    if (!icon || prefersReducedMotion()) return;
    icon.style.animation = 'none';
    void icon.offsetWidth;
    icon.style.animation = 'bizTabJelly 0.64s linear both';
  };

  // 탭바에 맨 아래 내용이 가리지 않게 같은 높이 빈칸 — /biz 는 어두운 바닥글이 스스로 아래 여백을 두고(TossChrome .tc-foot-in),
  // 완료 화면은 한 화면 가운데 정렬이라 가릴 게 없다(빈칸을 두면 괜히 스크롤만 생긴다)
  const needsSpacer = pathname !== '/biz' && !/^\/biz\/complete(\/|$)/.test(pathname);

  const nav = (
    <nav
      data-native-biz-nav
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
            const isActive = key !== 'home' && active === key;
            // 'page' 는 링크가 지금 화면 그 자체일 때만 — 섹션(문의 폼) · 묶음(ceo 의 기업소개 등) 선택은 'true'
            const current = isActive ? (href === pathname ? 'page' : 'true') : undefined;
            return (
              <Link
                key={key}
                href={href}
                data-nav={key}
                aria-current={current}
                className="flex min-w-0 flex-1 flex-col items-center justify-center gap-[4px] text-[#4E5968]"
                onClick={onTabClick(key, href)}
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
      ` }} />
    </>
  );
}
