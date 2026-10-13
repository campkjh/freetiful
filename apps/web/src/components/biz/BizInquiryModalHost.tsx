'use client';

import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { usePathname } from 'next/navigation';
import { XIcon } from '@/components/icons/chat';
import { useT, type Translations } from '@/lib/biz/i18n';
import { BIZ_INQUIRY_OPEN_EVENT, BIZ_INQUIRY_PATH, cameByHistory, forgetHistoryPop } from './scroll-to';

/*
 * PC 상담 팝업 여는 쪽(261013 사장 'pc버전에서 비즈 문의클릭하면 페이지로 이동하는게 아닌 팝업이 나오게끔 해줘라') — 비즈 레이아웃에 한 번.
 *  · PC(누르는 그 순간 matchMedia — 폭 1024 이상 + 마우스 · 트랙패드처럼 정밀한 포인터)에서 주소가 /biz/inquiry 인 링크를 누르면(캡처 단계)
 *    이동을 막고 팝업(BizInquiryModal)을 연다. 머리줄 '비즈문의' · 바닥 링크 · 장면 · 맺음말 · 뉴스 · FAQ · 연혁 · 고객사 CTA 가 전부 <a href="/biz/inquiry"> 라
 *    링크 파일(ceo/content.ts 등)은 손대지 않는다. 코드로 가는 길(장면 CTA · 자료실 '파트너 제안서')은 goBizInquiry → openBizInquiry 신호로 온다.
 *  · 새 탭 · 새 창(⌘ · Ctrl · Shift · Alt · 가운데 단추 · target=_blank)은 브라우저에 맡긴다. 폰 · 좁은 창(1024 미만)은 예전처럼 /biz/inquiry 화면으로.
 *    터치 태블릿(아이패드 가로 1024 이상)도 화면판으로 — 팝업은 키보드 계산이 없고 사회자 줄 화살표도 마우스에서만 보여서(261013 리뷰, 사장 요청은 'pc버전').
 *    /biz/inquiry 를 바로 열면(주소창 · 새로 고침) PC 도 화면 전체 채팅 그대로.
 *  · 팝업 묶음(채팅 · WebGL 비단 · 사회자 줄)은 무거워 비즈 모든 화면에 싣지 않고 따로 받는다 — PC 면 첫 화면이 쉰 뒤 미리, 링크에 마우스가 올라가도 미리.
 *    그 전에 누르면 같은 크기의 빈 패널(머리줄 + 도는 원)을 먼저 그리고(뒤 잠금 · Esc 도 그때부터) 묶음이 오면 움직임 없이 바꿔 끼운다.
 *    못 받았으면(배포 직후 묶음 어긋남 · 끊김) 아직 기다리는 중일 때만 /biz/inquiry 로 간다(취소했거나 화면을 옮겼으면 그대로).
 *  · 뒤로가기(261013 리뷰 — 프리티풀 시트 관례 AppLinkSheet · ChatExtras 와 같게): 열 때 history 항목을 하나 쌓는다({ bizInquiry: true }, 주소 그대로 —
 *    Next 가 pushState 를 감싸 라우터 상태를 복사해 준다). 브라우저 뒤로(마우스 뒤로 단추 · 스와이프) = 팝업만 닫힘, 앞으로 = 다시 열림.
 *    X · 바깥 · Esc 로 닫으면 쌓은 항목을 history.back() 으로 되돌린다(뒤로가기를 한 번 더 눌러야 화면이 넘어가는 빈 항목이 남지 않게).
 *    팝업이 떠 있는 채 화면을 떠나면(사회자 카드 '프로필' → /pros/…) 그 항목이 history 에 남아, 뒤로 오면 팝업이 하던 그대로 다시 뜬다
 *    (대화 · 고른 사람은 채팅 저장본이 되살린다). 새로 고침으로 그 항목에 다시 오면 띄우지 않고 표시만 지운다.
 *  · /biz/inquiry 화면에 오면 숨겨 둔 팝업 채팅을 내린다 — 두 채팅이 같은 저장본을 번갈아 덮어써 진행이 사라지거나
 *    화면판에서 접수한 걸 팝업이 모른 채 새 요청 번호로 다시 보낼 수 있었다(261013 리뷰). 다음에 열 때 저장본에서 새로 붙는다.
 */

const DESKTOP_MQ = '(min-width: 1024px) and (hover: hover) and (pointer: fine)';
const isDesktop = () => {
  try { return window.matchMedia(DESKTOP_MQ).matches; } catch { return false; }
};

/** 팝업 이름(aria-label) · 닫기 — 팝업과 받는 중 빈 패널이 같이 쓴다 */
export const BIZ_INQUIRY_LABEL: Translations = { ko: '비즈문의', en: 'Biz Inquiry', ja: 'ビズお問い合わせ', zh: '企业咨询' };
const CLOSE_LABEL: Translations = { ko: '닫기', en: 'Close', ja: '閉じる', zh: '关闭' };

/**
 * 패널 열림 스프링(AiQuoteFab 시트 스프링 k 380 · c 30 · m 0.9 를 CSS linear() 로 옮긴 곡선 — 1.3% 살짝 넘쳤다 제자리, 0.4초).
 * 팝업(BizInquiryModal)과 받는 중 빈 패널이 같은 곡선
 */
export const BIZ_INQUIRY_SPRING = 'linear(0, 0.0476 4.2%, 0.1581 8.3%, 0.2954 12.5%, 0.4361 16.7%, 0.5666 20.8%, 0.6798 25%, 0.7731 29.2%, 0.8468 33.3%, 0.9027 37.5%, 0.9435 41.7%, 0.972 45.8%, 0.9909 50%, 1.0026 54.2%, 1.0092 58.3%, 1.0122 62.5%, 1.0128 66.7%, 1.0121 70.8%, 1.0106 75%, 1.0088 79.2%, 1.007 83.3%, 1.0054 87.5%, 1.004 91.7%, 1.0028 95.8%, 1)';
/** 패널 크기 · 모서리 · 그림자 · 바탕(채팅 비단의 CSS 그러데이션 — 빈 패널 → 채팅으로 바꿔 끼울 때 색이 안 튀게) */
export const BIZ_INQUIRY_PANEL_CLASS = 'relative h-[min(780px,92vh)] max-h-full w-[440px] max-w-full overflow-hidden rounded-[24px] bg-white outline-none';
export const BIZ_INQUIRY_PANEL_SHADOW = '0 28px 80px rgba(15,23,42,0.28), 0 4px 16px rgba(15,23,42,0.10)';
const SILK_FALLBACK = 'radial-gradient(70% 55% at 16% 18%,rgba(255,255,255,.95) 0%,rgba(255,255,255,0) 70%),linear-gradient(166deg,rgba(255,255,255,0) 30%,rgba(255,255,255,.8) 43%,rgba(255,255,255,0) 56%),linear-gradient(158deg,#F8FAFF 0%,#EAF1FE 40%,#D7E5FC 72%,#BCD2F8 100%)';

/**
 * 뒤(어두운 막) 누름 — 더블클릭의 두 번째 누름 · 열린 직후(0.35초 안) 누름은 무시한다.
 * 링크를 두 번 누르면 두 번째가 막에 떨어져 열리자마자 닫혔다(261013 리뷰, 90 · 160ms 간격 재현)
 */
export function isStrayScrimClick(e: ReactMouseEvent, openedAt: number) {
  return e.detail > 1 || performance.now() - openedAt < 350;
}

/** 주소가 상담 채팅(/biz/inquiry)인 같은 사이트 링크인지 */
function isInquiryLink(a: HTMLAnchorElement): boolean {
  try {
    const u = new URL(a.href, window.location.href);
    return u.origin === window.location.origin && u.pathname.replace(/\/+$/, '') === BIZ_INQUIRY_PATH;
  } catch {
    return false;
  }
}

/* ── 팝업 묶음 따로 받기 ── */
type ModalComponent = typeof import('./BizInquiryModal').default;
let modalComponent: ModalComponent | null = null;
let modalPromise: Promise<ModalComponent> | null = null;
function loadModal(): Promise<ModalComponent> {
  if (!modalPromise) {
    modalPromise = import('./BizInquiryModal')
      .then((m) => (modalComponent = m.default))
      .catch((err) => {
        modalPromise = null; // 다음에 다시 시도
        throw err;
      });
  }
  return modalPromise;
}

/* ── history 항목(뒤로 = 닫기) ── */
const HIST = 'bizInquiry';
function onHist(): boolean {
  try { return !!(window.history.state as Record<string, unknown> | null)?.[HIST]; } catch { return false; }
}
function pushHist() {
  try { if (!onHist()) window.history.pushState({ [HIST]: true }, ''); } catch { /* 못 쌓으면 X · 바깥 · Esc 로만 닫힌다 */ }
}
/** 지금 항목의 팝업 표시만 지운다(새로 고침으로 왔을 때 — 다음에 뒤로 · 앞으로 오가다 엉뚱하게 뜨지 않게). Next 상태(__NA · 트리)는 그대로 */
function stripHist() {
  try {
    const s = window.history.state as Record<string, unknown> | null;
    if (!s || !s[HIST]) return;
    const rest = { ...s };
    delete rest[HIST];
    window.history.replaceState(rest, '');
  } catch { /* noop */ }
}

/* ── 묶음을 받는 중 — 같은 크기의 빈 패널(머리줄 + 도는 원) ── */
const SHELL_CSS = `
@keyframes bzimShellFade { from { opacity: 0 } to { opacity: 1 } }
@keyframes bzimShellMove { from { transform: translate3d(0,16px,0) scale(.96) } to { transform: none } }
.bzim-shell-scrim { animation: bzimShellFade .26s cubic-bezier(.22,1,.36,1) both; }
.bzim-shell-panel { animation: bzimShellFade .2s cubic-bezier(.22,1,.36,1) both, bzimShellMove .4s cubic-bezier(.2,.9,.3,1) both; }
@supports (animation-timing-function: linear(0, 1)) {
  .bzim-shell-panel { animation: bzimShellFade .2s cubic-bezier(.22,1,.36,1) both, bzimShellMove .4s ${BIZ_INQUIRY_SPRING} both; }
}
@media (prefers-reduced-motion: reduce) { .bzim-shell-panel { animation: bzimShellFade .18s ease both; } }
`;

function LoadingShell({ onClose }: { onClose: () => void }) {
  const t = useT();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const shownAt = useRef(0);

  // 뒤 화면 잠금 + Esc — 팝업과 같은 방식. 묶음이 와서 팝업으로 바뀌면 이 정리가 먼저 돌고(같은 커밋) 팝업이 다시 건다
  useEffect(() => {
    shownAt.current = performance.now();
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    const prevPad = html.style.paddingRight;
    const sbw = window.innerWidth - html.clientWidth;
    html.style.overflow = 'hidden';
    if (sbw > 0) html.style.paddingRight = `${sbw}px`;
    const lenis = window.__bizLenis;
    lenis?.stop();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      html.style.overflow = prevOverflow;
      html.style.paddingRight = prevPad;
      if (lenis && window.__bizLenis === lenis) lenis.start();
    };
  }, []);

  return (
    <div data-biz-inquiry-loading="" data-lenis-prevent="" className="fixed inset-0 z-[800] flex items-center justify-center p-6">
      <style dangerouslySetInnerHTML={{ __html: SHELL_CSS }} />
      <div
        aria-hidden="true"
        className="bzim-shell-scrim absolute inset-0 bg-[rgba(17,24,39,0.42)] backdrop-blur-[6px]"
        onClick={(e) => { if (!isStrayScrimClick(e, shownAt.current)) onCloseRef.current(); }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-busy="true"
        aria-label={t(BIZ_INQUIRY_LABEL)}
        tabIndex={-1}
        className={`bzim-shell-panel ${BIZ_INQUIRY_PANEL_CLASS}`}
        style={{ isolation: 'isolate', boxShadow: BIZ_INQUIRY_PANEL_SHADOW, background: SILK_FALLBACK }}
      >
        {/* 채팅 팝업 머리줄과 같은 자리 · 같은 글자(바꿔 끼울 때 안 튀게) */}
        <div className="absolute left-0 right-0 top-0 flex h-14 items-center justify-between gap-2 pl-5 pr-2">
          <h2 className="min-w-0 truncate text-[18px] font-bold tracking-[-0.3px] text-[#191F28]">{t(BIZ_INQUIRY_LABEL)}</h2>
          <button
            type="button"
            onClick={() => onCloseRef.current()}
            aria-label={t(CLOSE_LABEL)}
            className="relative z-[1] flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#191F28] transition-colors hover:bg-black/[0.04] active:bg-black/[0.07]"
          >
            <XIcon size={24} />
          </button>
        </div>
        <span aria-hidden="true" className="absolute left-1/2 top-1/2 -ml-4 -mt-4 h-8 w-8 animate-spin rounded-full border-[3px] border-[#E5E8EB] border-t-[#3182F6]" />
      </div>
    </div>
  );
}

export default function BizInquiryModalHost() {
  const pathname = usePathname() || '';
  const onInquiryPage = pathname === BIZ_INQUIRY_PATH || pathname.startsWith(`${BIZ_INQUIRY_PATH}/`);
  const [open, setOpen] = useState(false);
  /** 한 번이라도 열었는지 — 그 뒤로는 닫아도 대화를 내리지 않는다(숨김). /biz/inquiry 화면에 가면 내린다 */
  const [mounted, setMounted] = useState(false);
  const [Modal, setModal] = useState<ModalComponent | null>(() => modalComponent);
  const openRef = useRef(false);
  openRef.current = open;
  const modalReadyRef = useRef(false);
  modalReadyRef.current = !!Modal;
  /** 지금 화면 주소(usePathname) — popstate 때 '같은 화면 안에서 팝업 항목만 오갔는지' 가린다 */
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const onInquiryPageRef = useRef(onInquiryPage);
  onInquiryPageRef.current = onInquiryPage;
  /** 팝업을 연 화면 주소 — 묶음을 못 받았을 때 아직 그 화면에서 기다리는 중인지 */
  const openPathRef = useRef('');
  const returnFocusRef = useRef<HTMLElement | null>(null);
  /** 묶음을 받는 동안 빈 패널을 먼저 그렸는지(팝업이 첫 열림을 움직임 없이 바꿔 끼우게) */
  const shellShownRef = useRef(false);
  /** 닫으며 부른 history.back() 이 아직 안 끝남 */
  const backPendingRef = useRef(false);
  const backTimerRef = useRef(0);
  /** 팝업 항목 쌓기 예약(이번 누름 처리가 다 끝난 뒤) */
  const pushTimerRef = useRef(0);

  const openModal = useCallback((from: Element | null, viaHistory = false) => {
    const focusEl = from instanceof HTMLElement ? from : document.activeElement instanceof HTMLElement ? document.activeElement : null;
    returnFocusRef.current = focusEl && focusEl !== document.body ? focusEl : null;
    openPathRef.current = window.location.pathname;
    // 항목은 이번 누름 처리가 다 끝난 뒤에 쌓는다 — 같은 누름에서 화면이 주소를 고치면(뉴스 기사 창 CTA = 창 닫으며 #기사id 지움)
    // 그 뒤에 쌓아야 앞 항목 주소가 고쳐진 채로 남는다. 먼저 쌓으면 앞 항목에 #기사id 가 남아, 닫으며 돌아갈 때 hashchange 로 기사 창이 다시 열렸다
    if (!viaHistory && !pushTimerRef.current) {
      pushTimerRef.current = window.setTimeout(() => {
        pushTimerRef.current = 0;
        if (openRef.current) pushHist();
      }, 0);
    }
    if (!modalComponent) {
      shellShownRef.current = true;
      loadModal()
        .then((c) => setModal(() => c))
        .catch(() => {
          // 묶음을 못 받음 — 아직 이 팝업을 기다리는 중일 때만 화면판으로(새로 받기라 배포 어긋남도 풀린다).
          // 쌓은 팝업 항목은 화면판으로 바꿔 끼워 뒤로가기 한 번에 원래 화면으로. 취소했거나 다른 화면으로 옮겼으면 그대로(261013 리뷰)
          if (!openRef.current || window.location.pathname !== openPathRef.current) return;
          if (onHist()) window.location.replace(BIZ_INQUIRY_PATH);
          else window.location.assign(BIZ_INQUIRY_PATH);
        });
    } else {
      const c = modalComponent;
      setModal((m) => m || c); // 미리 받아 둔 묶음(이 컴포넌트가 붙은 뒤에 받아졌으면 state 엔 아직 없다)
    }
    openRef.current = true;
    setMounted(true);
    setOpen(true);
  }, []);

  /** X · 바깥 · Esc · 접수 뒤 '닫기' — 쌓은 history 항목도 되돌린다 */
  const close = useCallback(() => {
    if (!openRef.current) return;
    openRef.current = false;
    setOpen(false);
    if (!modalReadyRef.current) {
      // 받는 중 빈 패널을 닫음 — 초점을 누른 링크로(팝업이 오면 팝업이 돌려준다)
      const el = returnFocusRef.current;
      returnFocusRef.current = null;
      if (el && el.isConnected) { try { el.focus({ preventScroll: true }); } catch { /* noop */ } }
    }
    if (pushTimerRef.current) {
      // 아직 안 쌓음(열자마자 닫음) — 되돌릴 항목도 없다
      window.clearTimeout(pushTimerRef.current);
      pushTimerRef.current = 0;
    } else if (onHist() && !backPendingRef.current) {
      backPendingRef.current = true;
      try { window.history.back(); } catch { backPendingRef.current = false; }
      // popstate 가 끝내 안 오면(드묾) 다음 닫기를 막지 않게
      window.clearTimeout(backTimerRef.current);
      backTimerRef.current = window.setTimeout(() => { backPendingRef.current = false; }, 1500);
    }
  }, []);

  // 누름 가로채기(캡처 단계 — Next Link · 각 화면 onClick 보다 먼저) + 코드로 여는 신호(openBizInquiry)
  useEffect(() => {
    if (onInquiryPage) return undefined; // 상담 화면 자체에선 팝업을 겹쳐 띄우지 않는다
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
      if (!(a instanceof HTMLAnchorElement)) return;
      if ((a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      if (!isInquiryLink(a) || !isDesktop()) return;
      e.preventDefault();
      if (openRef.current) return; // 더블클릭의 두 번째 누름이 아직 링크에 떨어짐 — 이미 열렸다
      openModal(a);
    };
    const onOpen = (e: Event) => {
      if (!isDesktop()) return; // 신호를 받지 않음 → 부른 쪽(goBizInquiry)이 화면 이동
      e.preventDefault();
      if (!openRef.current) openModal(null);
    };
    // 링크에 마우스가 올라가면 묶음을 미리(첫 화면 쉴 때 못 받았어도 누를 즈음엔 와 있게)
    const onOver = (e: PointerEvent) => {
      if (modalComponent || e.pointerType !== 'mouse') return;
      const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
      if (a instanceof HTMLAnchorElement && isInquiryLink(a) && isDesktop()) void loadModal().catch(() => {});
    };
    window.addEventListener('click', onClick, true);
    window.addEventListener(BIZ_INQUIRY_OPEN_EVENT, onOpen);
    window.addEventListener('pointerover', onOver, { capture: true, passive: true });
    return () => {
      window.removeEventListener('click', onClick, true);
      window.removeEventListener(BIZ_INQUIRY_OPEN_EVENT, onOpen);
      window.removeEventListener('pointerover', onOver, { capture: true });
    };
  }, [onInquiryPage, openModal]);

  // PC 면 첫 화면이 쉰 뒤(2.5초 + 한가할 때) 팝업 묶음을 미리 받아 둔다 — 누르자마자 뜨게
  useEffect(() => {
    if (modalComponent || !isDesktop()) return undefined;
    let idle = 0;
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (h: number) => void };
    const tm = window.setTimeout(() => {
      const run = () => { void loadModal().catch(() => {}); };
      if (w.requestIdleCallback) idle = w.requestIdleCallback(run, { timeout: 4000 });
      else run();
    }, 2500);
    return () => {
      window.clearTimeout(tm);
      if (idle && w.cancelIdleCallback) w.cancelIdleCallback(idle);
    };
  }, []);

  // 브라우저 뒤로 · 앞으로 — 같은 화면 안에서 팝업 항목만 오갔으면: 뒤로 = 닫기, 앞으로 = 다시 열기.
  // 다른 화면으로 오간 건(주소가 아직 안 바뀐 채 여기 먼저 옴) 아래 주소 effect 가 맡는다
  useEffect(() => {
    const onPop = () => {
      if (backPendingRef.current) {
        // 닫으며 부른 history.back() — 화면들이 '뒤로 와서 왔다'로 착각하지 않게
        backPendingRef.current = false;
        forgetHistoryPop();
        if (openRef.current && !onHist()) pushHist(); // 닫자마자 다시 열었음 — 항목을 다시 쌓는다
        return;
      }
      const samePage = window.location.pathname === pathnameRef.current;
      if (openRef.current && !onHist()) {
        if (samePage) forgetHistoryPop();
        openRef.current = false;
        setOpen(false);
        return;
      }
      if (!openRef.current && onHist() && samePage && !onInquiryPageRef.current && isDesktop()) {
        forgetHistoryPop();
        openModal(null, true);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [openModal]);

  // 화면이 바뀜 — 팝업이 떠 있었으면 닫는다(그 항목은 history 에 남아 뒤로 오면 다시 뜬다).
  // 처음 붙음 · 화면이 바뀜에 팝업 항목 위면: 뒤로 · 앞으로 가기로 왔으면 다시 띄우고(사회자 상세 → 뒤로), 새로 고침이면 표시만 지운다
  const prevPathRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = pathname;
    if (prev !== null && prev !== pathname && openRef.current) {
      openRef.current = false;
      setOpen(false);
      return;
    }
    if (openRef.current || !onHist()) return;
    if (cameByHistory() && !onInquiryPage && isDesktop() && window.location.pathname === pathname) openModal(null, true);
    else stripHist();
  }, [pathname, onInquiryPage, openModal]);

  // 상담 화면(/biz/inquiry)에 오면 숨겨 둔 팝업 채팅을 내린다(두 채팅이 같은 저장본을 덮어쓰지 않게, 261013 리뷰)
  useEffect(() => {
    if (onInquiryPage) setMounted(false);
  }, [onInquiryPage]);

  if (!mounted || onInquiryPage) return null;
  if (Modal) return <Modal open={open} onClose={close} returnFocusRef={returnFocusRef} shellShownRef={shellShownRef} />;
  return open ? <LoadingShell onClose={close} /> : null;
}
