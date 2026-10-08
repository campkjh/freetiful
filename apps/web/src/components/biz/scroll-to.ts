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
 * tab 을 주면 그동안 그 탭을 먼저 선택해 둔다(가는 길에 지나는 섹션으로 선택이 깜빡이지 않게)
 */
export function holdBizTabBar(ms = 1500, tab?: 'inquiry' | 'company') {
  try { window.dispatchEvent(new CustomEvent(BIZ_TABBAR_HOLD_EVENT, { detail: { ms, tab } })); } catch { /* noop */ }
}

/* ───────────── /biz 섹션 ───────────── */

const isInquiry = (id: string) => id === '문의폼' || id === '문의';

/**
 * 섹션 도착 자리. 문의 폼은 section(#문의폼) 위 여백이 120(md 160)이라 그 위 끝에 맞추면 위엔 빈칸만 보이고
 * 폼 아래 끝(제출 단추 · 안내문)이 하단 탭바에 가렸다(360×740 은 제출 단추가 통째로) →
 * 안쪽 칸(#문의 = 'INQUIRY FORM' 제목부터)을 머리줄(모바일 56 · md 이상 64) 아래 16px 에 맞춘다.
 */
export function bizSectionAnchor(id: string): { el: HTMLElement; offset: number } | null {
  if (isInquiry(id)) {
    const el = document.getElementById('문의') || document.getElementById('문의폼');
    if (!el) return null;
    let head = 64;
    try { if (window.matchMedia('(max-width: 767px)').matches) head = 56; } catch { /* noop */ }
    return { el, offset: -(head + 16) };
  }
  const el = document.getElementById(id);
  return el ? { el, offset: 0 } : null;
}

/**
 * /biz 섹션으로 — 가는 동안 하단 탭바를 붙잡고(스스로 내려가는 스크롤에 숨지 않게), 문의 폼이면 '문의하기'를 먼저 선택.
 * 탭 · 햄버거 메뉴 · 자료실 · 머리줄 CTA · 장면 CTA · iOS 브리지가 모두 이 하나를 써서 동작이 같다(예전엔 탭만 붙잡아 메뉴로 가면 바가 숨은 채 도착)
 */
export function scrollToBizSection(id: string): boolean {
  const a = bizSectionAnchor(id);
  if (!a) return false;
  holdBizTabBar(1500, isInquiry(id) ? 'inquiry' : undefined);
  scrollToElement(a.el, a.offset);
  return true;
}

/* ───────────── 다른 비즈 화면 → /biz 섹션 ───────────── */

/**
 * 다른 비즈 화면에서 '문의하기'를 누르면 /biz 로 가면서 여기에 섹션 id 를 둔다 — /biz 가 장면 배치가 끝난 뒤 읽고 지운다.
 * 예전엔 sessionStorage 였는데, /biz 가 뜨기 전에 다른 탭 · 뒤로가기로 빠지면 키가 세션 내내 남아
 * 나중에 /biz 를 열 때마다(기업소개 탭 · 로고 · 새로 고침) 엉뚱하게 문의폼으로 내려갔다 →
 * 모듈 변수(새로 고침이면 사라짐) + 20초가 지나면 버림(느린 망에서 /biz 가 늦게 떠도 닿게) + 다른 탭을 누르거나 뒤로가기 · /biz 아닌 화면에 닿으면 탭바가 지운다.
 */
let pendingSection: { id: string; at: number } | null = null;
const PENDING_TTL = 20_000;

export function setPendingBizSection(id: string | null) {
  pendingSection = id ? { id, at: Date.now() } : null;
}
export function hasPendingBizSection() {
  return !!pendingSection && Date.now() - pendingSection.at < PENDING_TTL;
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
