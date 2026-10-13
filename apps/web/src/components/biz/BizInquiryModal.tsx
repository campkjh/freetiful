'use client';

import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useT } from '@/lib/biz/i18n';
import BizInquiryChat from './BizInquiryChat';
import { BIZ_INQUIRY_LABEL, BIZ_INQUIRY_PANEL_CLASS, BIZ_INQUIRY_PANEL_SHADOW, BIZ_INQUIRY_SPRING, isStrayScrimClick } from './BizInquiryModalHost';

/*
 * PC 상담 팝업(261013 사장 'pc버전에서 비즈 문의클릭하면 페이지로 이동하는게 아닌 팝업이 나오게끔 해줘라').
 *  · 여는 쪽 = BizInquiryModalHost(비즈 레이아웃에 한 번) — PC(폭 1024 이상 + 마우스 · 트랙패드)에서 '비즈문의' 링크 · 문의 CTA 누름을 가로채 이 창을 연다.
 *    이 파일은 상담 채팅(BizInquiryChat · 비단 WebGL · 사회자 줄)을 끌고 오는 무거운 묶음이라 Host 가 처음 쉴 때 · 처음 열 때 따로 받는다.
 *  · 생김새 = 프리티풀 모달 어법(globals .ft-* · AiQuoteFab): 뒤는 어둡게 + 살짝 흐리게, 가운데 패널 440 × min(780, 92vh) · 모서리 24 · 부드러운 그림자.
 *    열 땐 스프링으로 커지며 떠오르고(AiQuoteFab 시트 스프링 380 · 30 · 0.9 를 CSS linear() 로 옮긴 곡선), 닫을 땐 짧게 거꾸로 — '뚝' 사라지지 않게.
 *    움직임은 CSS 전환(data-state) — framer-motion 으로 했더니 닫힘 끝에 패널이 한 프레임 다시 불투명하게 깜빡였다(가속 투명도 애니가 끝나며
 *    값이 되돌아간 틈, 261013 프레임 표본으로 확인). 이 창은 내리지 않고 숨겨 두는 창이라 끝 상태를 CSS 가 쥐고 있는 쪽이 맞다.
 *  · 닫기 = 뒤 누르기 · Esc · 채팅 머리줄 X · 접수 뒤 '닫기' · 브라우저 뒤로(Host 가 쌓은 history 항목). Esc 는 채팅이 먼저(문의유형 · 희망 사회자 ·
 *    답 고치는 중이면 그 취소가 먼저, 다음 Esc 에 닫힘). 뒤 누르기는 더블클릭의 두 번째 · 열린 직후 0.35초 안 누름을 무시한다(링크 더블클릭 = 열자마자 닫힘, 261013 리뷰).
 *  · 묶음을 받기 전에 눌렀으면 Host 가 같은 크기의 빈 패널을 먼저 그려 둔다 — 그때 첫 열림은 움직임 없이 그 자리에 바꿔 끼운다(data-instant).
 *  · 뒤 화면 잠금 = 비즈 화면들이 쓰는 방식 그대로(파일 미리보기 · 영상 창): html overflow 숨김 + 스크롤바 폭만큼 오른쪽 여백 + Lenis 멈춤 + 패널 밖 손가락 스크롤 막기.
 *    (useBodyScrollLock 은 body 를 fixed 로 붙잡았다 풀 때 예전 스크롤로 되돌리는데, 팝업 안에서 사회자 상세로 넘어가면 새 화면이 그 자리로
 *     내려가 버리고 · Lenis 와도 엇갈려서 이 창은 문서 스크롤을 건드리지 않는 쪽으로)
 *    패널은 data-lenis-prevent — 비즈 홈의 Lenis 가 휠을 가로채면 대화 · 사회자 줄이 휠로 안 굴렀다.
 *  · 한 번 열면 닫아도 대화를 내리지 않고 숨겨 둔다(visibility) — 다시 열면 쓰던 글(보내기 전 입력 칸) · 대화 위치 · 사회자 줄 위치 · '입력 중'까지 그대로.
 *    숨은 동안 비단 바탕(WebGL)은 내려 두고(active=false), 대화 자체는 화면판과 같은 sessionStorage 저장본(30분)이라 새로 고침 · /biz/inquiry 에서도 이어진다.
 *  · 초점: 열면 입력 칸(쓸 수 있을 때) 아니면 패널로, Tab 은 패널 안에서만 돈다(가벼운 가두기), 닫으면 누른 링크로 돌려준다.
 */

/**
 * 움직임(CSS) — 열림: 패널 = 스프링(k 380 · c 30 · m 0.9, 감쇠비 0.81 → 1.3% 살짝 넘쳤다 제자리, 0.4초) + 투명도 0.2초, 뒤 = 0.26초.
 * 닫힘: 0.18초 거꾸로(패널) · 0.2초(뒤), 다 사라진 뒤(0.22초) 통째로 visibility:hidden. 닫힘 곡선은 처음부터 바로 움직이는 (.4,0,.6,1) —
 * ease-in(.4,0,1,1)이었을 땐 X 를 누르고 처음 45ms 가 거의 그대로라 한 박자 늦게 반응하는 느낌이었다(261013 리뷰).
 * linear() 를 모르는 브라우저는 비슷한 cubic-bezier. 동작 줄이기 = 옅어짐만. data-instant = 빈 패널에서 바꿔 끼우는 첫 열림(전환 없음).
 */
const CLOSE_MS = 220;
const CSS = `
.bzim { visibility: hidden; pointer-events: none; transition: visibility 0s linear ${CLOSE_MS}ms; }
.bzim[data-state="open"] { visibility: visible; pointer-events: auto; transition-delay: 0s; }
.bzim-scrim { opacity: 0; transition: opacity .2s cubic-bezier(.4,0,.6,1); }
.bzim[data-state="open"] .bzim-scrim { opacity: 1; transition: opacity .26s cubic-bezier(.22,1,.36,1); }
.bzim-panel { opacity: 0; transform: translate3d(0,16px,0) scale(.96); transition: opacity .16s cubic-bezier(.4,0,.6,1), transform .18s cubic-bezier(.4,0,.6,1); }
.bzim[data-state="open"] .bzim-panel { opacity: 1; transform: none; transition: opacity .2s cubic-bezier(.22,1,.36,1), transform .4s cubic-bezier(.2,.9,.3,1); }
@supports (transition-timing-function: linear(0, 1)) {
  .bzim[data-state="open"] .bzim-panel { transition: opacity .2s cubic-bezier(.22,1,.36,1), transform .4s ${BIZ_INQUIRY_SPRING}; }
}
@media (prefers-reduced-motion: reduce) {
  .bzim-panel, .bzim[data-state="open"] .bzim-panel { transform: none; transition: opacity .18s ease; }
}
.bzim[data-instant], .bzim[data-instant] .bzim-scrim, .bzim[data-instant] .bzim-panel { transition: none !important; }
`;

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
function focusablesIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
    if (el.getAttribute('aria-hidden') === 'true' || el.closest('[aria-hidden="true"]')) return false;
    return el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  });
}

type Props = {
  open: boolean;
  onClose: () => void;
  /** 닫으면 초점을 돌려줄 곳(누른 링크) */
  returnFocusRef: MutableRefObject<HTMLElement | null>;
  /** 이 묶음을 받는 동안 Host 가 빈 패널(어두운 뒤 + 같은 크기 패널)을 먼저 그려 뒀으면 true — 첫 열림을 움직임 없이 바꿔 끼운다 */
  shellShownRef: MutableRefObject<boolean>;
};

export default function BizInquiryModal({ open, onClose, returnFocusRef, shellShownRef }: Props) {
  const t = useT();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  /** Host 가 묶음을 받는 동안 빈 패널을 먼저 그려 뒀으면 첫 열림만 처음부터 열린 그림으로(전환 없이 — 다시 0 에서 떠오르면 두 번 열리는 것처럼 보였다) */
  const [instant, setInstant] = useState(() => shellShownRef.current && open);
  /** 그리는 상태 — 열 땐 닫힌 그림을 한 번 그린 다음 프레임에 'open'(그래야 전환이 돈다), 닫을 땐 바로 'closed' */
  const [state, setState] = useState<'open' | 'closed'>(() => (shellShownRef.current && open ? 'open' : 'closed'));
  /** 보이는 중(열림 + 닫히는 0.22초) — 숨으면 비단 바탕(WebGL)을 내린다 */
  const [visible, setVisible] = useState(open);
  useEffect(() => { shellShownRef.current = false; }, [shellShownRef]);
  /** 열린 그림이 된 시각 — 뒤 누르기가 더블클릭의 두 번째 누름인지 가린다 */
  const openedAtRef = useRef(0);
  useEffect(() => {
    if (state === 'open') openedAtRef.current = performance.now();
  }, [state]);

  useEffect(() => {
    if (open) {
      setVisible(true);
      let r2 = 0;
      const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setState('open')); });
      return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
    }
    setState('closed');
    setInstant(false); // 닫힘부터는 보통 움직임
    const tm = window.setTimeout(() => setVisible(false), CLOSE_MS + 40);
    return () => window.clearTimeout(tm);
  }, [open]);

  // 뒤 화면 잠금(비즈 파일 미리보기 · 영상 창과 같은 방식) — 휠 = Lenis 멈춤, 터치 = 문서 overflow + 패널 밖 touchmove 막기
  useEffect(() => {
    if (!open) return undefined;
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    const prevPad = html.style.paddingRight;
    const sbw = window.innerWidth - html.clientWidth;
    html.style.overflow = 'hidden';
    if (sbw > 0) html.style.paddingRight = `${sbw}px`;
    const lenis = window.__bizLenis;
    lenis?.stop();
    const onTouchMove = (e: TouchEvent) => {
      if (e.target instanceof Node && panelRef.current?.contains(e.target)) return; // 패널 안(대화 · 사회자 줄)은 그대로
      if (e.cancelable) e.preventDefault();
    };
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      document.removeEventListener('touchmove', onTouchMove);
      html.style.overflow = prevOverflow;
      html.style.paddingRight = prevPad;
      // 그 사이 화면을 옮겼으면(Lenis 가 바뀌었거나 없어짐) 손대지 않는다
      if (lenis && window.__bizLenis === lenis) lenis.start();
    };
  }, [open]);

  // Esc 닫기 + Tab 가두기
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (e.isComposing || e.keyCode === 229) return;
        // 채팅이 먼저 — 고치는 중 취소(입력 칸 · 화면 Esc)가 이 Esc 를 썼으면(preventDefault) 닫지 않는다.
        // 채팅의 window 듣기가 이것보다 늦게 붙을 수 있어 이번 키 처리가 다 끝난 뒤에 본다
        window.setTimeout(() => { if (!e.defaultPrevented) onCloseRef.current(); }, 0);
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = focusablesIn(panel);
      const active = document.activeElement;
      if (!items.length) { e.preventDefault(); panel.focus({ preventScroll: true }); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (!active || !panel.contains(active)) { e.preventDefault(); (e.shiftKey ? last : first).focus({ preventScroll: true }); return; }
      if (e.shiftKey && (active === first || active === panel)) { e.preventDefault(); last.focus({ preventScroll: true }); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus({ preventScroll: true }); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // 초점 — 열면(보이기 시작한 그림부터) 입력 칸(지금 쓸 수 있으면) 아니면 패널, 닫으면 누른 링크로
  const wasOpen = useRef(false);
  const shown = open && state === 'open';
  useEffect(() => {
    if (shown) {
      wasOpen.current = true;
      const panel = panelRef.current;
      if (!panel || panel.contains(document.activeElement)) return undefined;
      const input = panel.querySelector<HTMLTextAreaElement>('textarea:not([disabled])');
      (input || panel).focus({ preventScroll: true });
      return undefined;
    }
    if (open || !wasOpen.current) return undefined;
    wasOpen.current = false;
    const panel = panelRef.current;
    const a = document.activeElement;
    const el = returnFocusRef.current;
    returnFocusRef.current = null;
    // 초점이 패널 안(또는 어디에도 없음)일 때만 — 닫히는 사이 다른 곳을 눌렀으면 그대로 둔다
    if (el && el.isConnected && (!a || a === document.body || (panel && panel.contains(a)))) {
      try { el.focus({ preventScroll: true }); } catch { /* noop */ }
    }
    return undefined;
  }, [shown, open, returnFocusRef]);

  return (
    <div
      data-biz-inquiry-modal=""
      data-lenis-prevent=""
      data-state={state}
      data-instant={instant ? '' : undefined}
      aria-hidden={open ? undefined : true}
      className="bzim fixed inset-0 z-[800] flex items-center justify-center p-6"
    >
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {/* 뒤 — 어둡게 + 살짝 흐리게(흐림 칸은 그대로 두고 투명도만 움직인다 — 흐림 값을 움직이면 큰 화면에서 무겁다) */}
      <div
        aria-hidden="true"
        className="bzim-scrim absolute inset-0 bg-[rgba(17,24,39,0.42)] backdrop-blur-[6px]"
        // 더블클릭의 두 번째 누름이 뒤에 떨어져 열리자마자 닫히던 것(261013 리뷰)
        onClick={(e) => { if (!isStrayScrimClick(e, openedAtRef.current)) onClose(); }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t(BIZ_INQUIRY_LABEL)}
        tabIndex={-1}
        className={`bzim-panel ${BIZ_INQUIRY_PANEL_CLASS}`}
        // isolation — 비단 캔버스 · 머리줄 흐림이 모서리 24 밖으로 새지 않게(사파리)
        style={{ isolation: 'isolate', boxShadow: BIZ_INQUIRY_PANEL_SHADOW }}
      >
        <BizInquiryChat variant="modal" onClose={onClose} active={visible} />
      </div>
    </div>
  );
}
