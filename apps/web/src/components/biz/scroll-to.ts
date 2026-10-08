import type Lenis from 'lenis';

/*
 * 비즈 섹션 이동 · 하단 탭바 붙잡기 도우미(261008) — 의존성 없는 작은 모듈.
 * 하단 탭바(biz/layout 공통 = ceo · faq · news … 모든 비즈 화면)가 toss/scene.tsx(framer-motion · lenis)를 끌고 오지 않게 따로 뺐다.
 * scene.tsx 는 prefersReducedMotion · scrollToElement 를 여기서 다시 내보낸다(장면 파일들의 import 는 그대로).
 */

declare global {
  interface Window { __bizLenis?: Lenis }
}

export function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * 세로 위치로 이동 — Lenis 가 있으면 그걸로(네이티브 smooth 와 섞이면 끊긴다).
 * 줄인 움직임이면 애니메이션 없이 바로(Lenis 도 꺼져 있다 · html 이 scroll-behavior:smooth 라 'instant' — 'auto' 면 CSS 를 따라 2만 px 를 굴렸다)
 */
export function scrollToY(top: number) {
  if (prefersReducedMotion()) {
    window.scrollTo({ top, left: 0, behavior: 'instant' });
    return;
  }
  if (window.__bizLenis) window.__bizLenis.scrollTo(top, { duration: 1.2 });
  else window.scrollTo({ top, behavior: 'smooth' });
}

/** 섹션으로 이동(offset = 섹션 위 끝을 화면 위에서 얼마나 띄울지, 음수 = 아래로 띄움) */
export function scrollToElement(el: HTMLElement, offset = 0) {
  scrollToY(el.getBoundingClientRect().top + window.scrollY + offset);
}

/* ───────────── 하단 탭바 붙잡기 ───────────── */

export const BIZ_TABBAR_HOLD_EVENT = 'biz-tabbar-hold';

/**
 * 탭 · 페이지가 스스로 스크롤하는 동안(ms) 탭바를 내리지 않는다 — '스크롤 내리면 숨김' 규칙의 예외. 손가락 · 휠이 닿으면 바로 풀린다.
 * (예전 두 번째 인자 tab = 가는 동안 '문의하기' 먼저 고르기는 /biz 문의 섹션이 없어져 뺐다, 261009)
 */
export function holdBizTabBar(ms = 1500) {
  try { window.dispatchEvent(new CustomEvent(BIZ_TABBAR_HOLD_EVENT, { detail: { ms } })); } catch { /* noop */ }
}

/* ───────────── 상담 채팅(/biz/inquiry) ───────────── */

/**
 * 비즈 '문의하기'는 모두 상담 채팅 화면으로(261009 사장 '문의하기 누르면 문의 섹션으로 내려가지 말고, 문의 섹션은 삭제 —
 * 키키 상담처럼 채팅으로'). /biz 아래쪽 문의 폼(#문의폼 · #문의)은 없어졌다.
 */
export const BIZ_INQUIRY_PATH = '/biz/inquiry';

/** 옛 문의 섹션 id — 옛 링크(/biz#문의폼) · iOS 브리지 · 예전 코드가 이 id 로 부르면 섹션 대신 상담 채팅으로 보낸다 */
export const isBizInquirySection = (id: string) => id === '문의폼' || id === '문의';

let bizNavigate: ((href: string) => void) | null = null;
/**
 * 화면 이동 함수 등록 — /biz 페이지가 마운트 동안 router.push 를 건다.
 * 이 모듈은 의존성이 없어야 해서(하단 탭바가 같이 끌고 감) next/navigation 을 직접 쓰지 않는다
 */
export function setBizNavigator(fn: ((href: string) => void) | null) {
  bizNavigate = fn;
}

/** 상담 채팅으로 — push 를 주면 그걸로, 없으면 등록된 이동 함수, 그것도 없으면 주소 이동 */
export function goBizInquiry(push?: (href: string) => void) {
  pendingSection = null;
  const nav = push || bizNavigate;
  if (nav) nav(BIZ_INQUIRY_PATH);
  else if (typeof window !== 'undefined') window.location.assign(BIZ_INQUIRY_PATH);
}

/* ───────────── /biz 섹션 ───────────── */

/**
 * 섹션 도착 자리 — 섹션 위 끝을 머리줄(BizHeader 모바일 56 · md 이상 64, 불투명 흰색이라 그 밑은 안 보인다) 바로 아래에.
 * 첫 장면(#회사소개)은 맨 위(0) — 장면이 머리줄 자리를 비워 두고 그려져 있다. 옛 문의 섹션 id 는 섹션이 없으니 null
 */
export function bizSectionAnchor(id: string): { el: HTMLElement; offset: number } | null {
  if (isBizInquirySection(id)) return null;
  const el = document.getElementById(id);
  if (!el) return null;
  if (id === '회사소개') return { el, offset: 0 };
  let head = 64;
  try { if (window.matchMedia('(max-width: 767px)').matches) head = 56; } catch { /* noop */ }
  return { el, offset: -head };
}

/**
 * /biz 섹션으로 — 가는 동안 하단 탭바를 붙잡는다(스스로 내려가는 스크롤에 숨지 않게).
 * 자료실 · 장면 CTA · iOS 브리지가 모두 이 하나를 써서 동작이 같다. 옛 문의 섹션 id(#문의폼 · #문의)면 상담 채팅으로 간다(true)
 */
export function scrollToBizSection(id: string): boolean {
  if (isBizInquirySection(id)) {
    goBizInquiry();
    return true;
  }
  const a = bizSectionAnchor(id);
  if (!a) return false;
  holdBizTabBar(1500);
  scrollToElement(a.el, a.offset);
  return true;
}

/* ───────────── 다른 비즈 화면 → /biz 섹션 ───────────── */

/**
 * 다른 비즈 화면에서 /biz 의 한 섹션으로 보내고 싶을 때 여기에 섹션 id 를 두고 /biz 로 간다 — /biz 가 장면 배치가 끝난 뒤 읽고 지운다.
 * (예전 '문의하기' 탭이 쓰던 길. 문의는 이제 /biz/inquiry 화면이라 /biz 는 옛 문의 id 를 받으면 그리로 돌린다)
 * 모듈 변수(새로 고침이면 사라짐) + 20초가 지나면 버림 — sessionStorage 였을 땐 /biz 가 뜨기 전에 빠지면 키가 세션 내내 남아
 * 나중에 /biz 를 열 때마다 엉뚱한 섹션으로 내려갔다. 다른 탭을 누르거나 뒤로가기 · /biz 아닌 화면에 닿으면 탭바가 지운다.
 */
let pendingSection: { id: string; at: number } | null = null;
const PENDING_TTL = 20_000;

export function setPendingBizSection(id: string | null) {
  pendingSection = id ? { id, at: Date.now() } : null;
}
export function takePendingBizSection(): string | null {
  const p = pendingSection;
  pendingSection = null;
  return p && Date.now() - p.at < PENDING_TTL ? p.id : null;
}

/* ───────────── 뒤로 · 앞으로 ───────────── */

let lastPopAt = -Infinity;
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => { lastPopAt = performance.now(); });
}
/** 방금(ms 안) 뒤로 · 앞으로 가기로 온 화면인지 — 이때는 맨 위로 보내거나 섹션으로 끌고 가지 않는다 */
export function cameByHistory(ms = 3000) {
  return performance.now() - lastPopAt < ms;
}
