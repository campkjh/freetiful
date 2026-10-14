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

/**
 * PC 상담 팝업(261013 사장 'pc버전에서 비즈 문의클릭하면 페이지로 이동하는게 아닌 팝업이 나오게끔') —
 * 비즈 레이아웃의 BizInquiryModalHost 가 이 신호를 듣고, PC(폭 1024 이상 + 마우스 · 트랙패드, 터치 태블릿 제외)면 팝업을 열고 신호를 '받았다'(preventDefault)고 표시한다.
 * 링크(<a href="/biz/inquiry">)는 Host 가 누름을 직접 가로채고, 코드로 가는 길(장면 CTA · 자료실 등)은 goBizInquiry 가 이걸 먼저 부른다.
 */
export const BIZ_INQUIRY_OPEN_EVENT = 'biz-inquiry-open';

/** 상담 팝업 열기 — 팝업이 열렸으면 true(폰 폭 · Host 없음 = false → 부른 쪽이 /biz/inquiry 로 이동) */
export function openBizInquiry(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return !window.dispatchEvent(new CustomEvent(BIZ_INQUIRY_OPEN_EVENT, { cancelable: true }));
  } catch {
    return false;
  }
}

/** 상담 채팅으로 — PC 면 팝업(261013), 아니면 push 를 주면 그걸로, 없으면 등록된 이동 함수, 그것도 없으면 주소 이동 */
export function goBizInquiry(push?: (href: string) => void) {
  pendingSection = null;
  if (openBizInquiry()) return;
  const nav = push || bizNavigate;
  if (nav) nav(BIZ_INQUIRY_PATH);
  else if (typeof window !== 'undefined') window.location.assign(BIZ_INQUIRY_PATH);
}

/* ───────────── /biz 섹션 ───────────── */

/**
 * 섹션 도착 자리 — 섹션 위 끝을 머리줄(BizHeader 모바일 56 · md 이상 64, 불투명 흰색이라 그 밑은 안 보인다) 바로 아래에.
 * 첫 장면(#회사소개)은 맨 위(0) — 장면이 머리줄 자리를 비워 두고 그려져 있다. 옛 문의 섹션 id 는 섹션이 없으니 null
 * 머리줄 높이는 그때그때 잰다 — iOS 앱(261014 화면 끝까지)은 상태바 칸(--ft-sat)만큼 길다. 못 재면 56 · 64
 */
export function bizSectionAnchor(id: string): { el: HTMLElement; offset: number } | null {
  if (isBizInquirySection(id)) return null;
  const el = document.getElementById(id);
  if (!el) return null;
  if (id === '회사소개') return { el, offset: 0 };
  let head = 64;
  try { if (window.matchMedia('(max-width: 767px)').matches) head = 56; } catch { /* noop */ }
  const hdr = document.querySelector<HTMLElement>('[data-biz-header]');
  const hh = hdr ? hdr.getBoundingClientRect().height : 0;
  if (hh > 0) head = hh;
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
/**
 * 방금 popstate 는 화면 이동이 아니었다 — PC 상담 팝업이 쌓은 항목만 오갔음(닫기 · 브라우저 뒤로 = 팝업 닫기 · 앞으로 = 다시 열기, 261013 리뷰).
 * 그대로 두면 3초 안에 다른 비즈 화면 링크를 눌렀을 때 그 화면이 '뒤로 와서 왔다'로 알고 맨 위로 안 올라간다
 */
export function forgetHistoryPop() {
  lastPopAt = -Infinity;
}
