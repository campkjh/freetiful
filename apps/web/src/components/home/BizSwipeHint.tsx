'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import BizSwipePeek, { preloadBizPeek } from '@/components/home/BizSwipePeek';
import { QuickMatchBubbleGlass } from '@/components/home/TossBubble';

/*
 * 홈 첫 진입 '비즈 페이지가 추가되었어요' 안내(261009 사장 '홈에서 처음 딱 5초간 홈이 비즈 쪽으로 살짝 스와이프되는 느낌,
 * 보잉보잉 슬라이드로, 전체 화면 살짝 딤 + 말풍선 — 말풍선은 PC 비즈 말풍선 디자인·애니메이션 그대로, 꼬리만 왼쪽').
 *  · 모바일(lg 미만) 홈에서, 이 기기에서 처음 한 번만(localStorage HINT_KEY — 실제로 뜰 때 적는다. 뜨기 전에 나가면 다음에 뜬다).
 *  · 움직임: 화면 전체 딤(검정 14%, 엿보기까지 덮고 말풍선만 위에) → 왼쪽에서 비즈 첫 화면(BizSwipePeek)이 화면 폭 19%까지 '보잉' 튀어나왔다
 *    살짝 들어가고 다시 '보잉' 나와 18.5% 에 멈춘 채 말풍선 → 5초가 되면 말풍선이 접히고 비즈 화면이 들어가며 딤이 걷힌다.
 *    홈 본문도 비즈 화면의 30% 만큼 같은 쪽으로 밀린다(손으로 끌 때와 같은 깊이감).
 *    → 스프링은 rAF 로 직접 계산해 transform 만 바꾼다(React 다시 그리기 없음). 홈 본문은 그 칸(.home-shift-mobile-only)에 인라인 transform 을
 *      잠깐 얹었다 걷는다 — HomeSwipeTabs 의 --home-shift 변수를 매 프레임 바꾸면 문서 전체 스타일을 다시 계산해 저사양 폰에서 버벅인다.
 *      걷을 땐 그 칸의 transition(--home-shift-anim, 평소 0.34초)이 제자리로 미끄러뜨린다.
 *  · 닫힘: 5초 뒤 저절로 · 화면 아무 데나 누름(그 누름은 닫기만 하고 밑의 카드·링크는 안 눌린다 — 스크롤·가장자리 스와이프는 그대로 된다) · ×.
 *    말풍선이나 엿보인 비즈 화면을 누르면 비즈 화면이 끝까지 들어온 뒤 /biz 로(손으로 끌어 열 때와 같은 0.28초 · 같은 이동 함수 onOpen).
 *    엿보인 비즈 화면은 손가락으로 끌 수도 있다 — 오른쪽으로 많이(또는 휙) 끌면 열리고, 왼쪽으로 밀면 닫힌다.
 *  · 첫 화면 창(빌라드지디 · 가입 5천원 팝업 등 aria-modal 창)이 떠 있으면 다 닫히고 1.2초 조용할 때 시작(PC 비즈 말풍선과 같은 규칙) — 겹치지 않게.
 *  · 줄인 움직임: 튀는 움직임 없이 엿보기 자리에 바로 놓고 말풍선만(말풍선 애니도 globals 에서 꺼진다).
 *  · iOS 앱: 이 안내는 창(role=dialog)이 아니다 — 창으로 표시하면 앱이 네이티브 탭바를 숨긴다(ViewController overlayOpen). 탭바는 딤 위에 그대로 남는다.
 *  · 홈 퀵매칭 역말풍선(.qm-bubble — '맞춤 사회자, 1분 만에 찾아요')은 안내가 떠 있는 동안 숨긴다(html[data-biz-hint]) — 딤 아래로 말풍선 두 개가
 *    위아래로 겹쳐 보였다(261009 검증). 안내가 끝나면 스르르 돌아온다.
 *  · 안내 도중 늦게 뜬 창(aria-modal)이 있으면 안내를 접는다 — 그 창의 첫 누름이 '안내 닫기 + 누름 삼키기'에 먹히지 않게(창 안 누름은 삼키지 않는다).
 */
const HINT_KEY = 'ft-biz-swipe-hint-v1';
const BIZ_ICON = '/images/icons/biz-folder.png';
/** 딤 — 검정 14%(사장 '살짝 전체 화면이 딤드되면서'). 손으로 끌 때(HomeSwipeTabs)는 딤 없이 흰 그라데이션이지만, 안내는 말풍선을 띄우려고 살짝 어둡게 */
const DIM = 0.14;
/** 말풍선이 붙어 있는 동안 엿보이는 폭(화면 폭 비율) — 좁은 폰에선 말풍선 글이 안 잘리게 15% 까지 줄인다(restPx) */
const REST = 0.185;
const REST_MIN = 0.15;
/** 말풍선 제 폭(꼬리 13 + 아이콘 칸 64 + 제목 180 + × 칸 42, Pretendard 실측) — 엿보기 폭을 정할 때만 쓴다 */
const BUBBLE_W = 300;
/** 말풍선 오른쪽 끝 ~ 화면 끝 최소 여백 — 360 폭 폰에서도 제목이 안 잘리는 만큼만(360: 엿보기 54 + 2 + 말풍선 299 + 4) */
const EDGE_GAP = 4;
/** 홈 본문은 비즈 화면이 들어온 만큼의 30% 만 밀린다(손으로 끌 때와 같은 비율) */
const HOME_RATIO = 0.3;
/** 엿보인 화면 오른쪽 끝 ~ 꼬리 끝 */
const TAIL_GAP = 2;
/** 말풍선이 뜨는 때 · 저절로 닫히기 시작하는 때(첫 프레임부터 ms) — 닫힘이 다 끝나면 5초 */
const BUBBLE_AT = 1050;
const CLOSE_AT = 4540;
/** '보잉 보잉' — 정해진 때마다 스프링 목표를 바꾼다(to = 화면 폭 비율, w = 고유진동수, z = 감쇠비). z<1 이면 목표를 살짝 넘었다 돌아온다 */
const STEPS: { at: number; to: number | 'rest'; w: number; z: number }[] = [
  { at: 120, to: 0.19, w: 16, z: 0.5 }, // 보잉 ① — 22% 쯤까지 튀었다가
  { at: 520, to: 0.035, w: 18, z: 0.55 }, // 쏙 들어갔다가
  { at: 860, to: 'rest', w: 15, z: 0.45 }, // 보잉 ② — 그대로 엿보기 자리에
];
const OPEN_EASE = 'transform 0.28s cubic-bezier(0.22,0.61,0.36,1)';
/** 안내가 떠 있는 동안 html 에 다는 표시 — '1' = 퀵매칭 말풍선 숨김, 'back' = 돌아오는 중(스르르 나타남) */
const HINT_ATTR = 'data-biz-hint';
/** 퀵매칭 말풍선 숨김/돌아옴 — 왼쪽 꼬리 판(.side, 이 안내 말풍선)은 빼고. 바깥 칸의 투명도는 숨어 있는 동안만 건다(평소엔 1 이라 유리 흐림이 그대로 먹는다) */
const HIDE_QM_CSS = `html[${HINT_ATTR}="1"] .qm-bubble:not(.side){opacity:0;visibility:hidden;pointer-events:none;transition:opacity .2s ease,visibility 0s linear .2s}
html[${HINT_ATTR}="back"] .qm-bubble:not(.side){transition:opacity .4s ease .12s}`;
const isInModal = (t: EventTarget | null) => t instanceof Element && !!t.closest('[role="dialog"][aria-modal="true"]');

/** 저장소가 막힌 기기에서도 한 번 띄운 뒤엔 이 탭에서 다시 안 띄운다 */
let shownInThisTab = false;

/**
 * 닫으려고 누른 그 누름의 click 을 한 번 삼킨다 — 딤 아래 카드·링크가 같이 눌리지 않게.
 * 끌거나 스크롤하면(10px 넘게 움직이면) 안 삼킨다. 안내가 먼저 사라져도 동작하도록 혼자 산다(최대 0.9초).
 */
function swallowNextTap(x: number, y: number) {
  let done = false;
  const stop = () => {
    if (done) return;
    done = true;
    window.removeEventListener('click', onClick, true);
    window.removeEventListener('pointermove', onMove, true);
    window.removeEventListener('touchmove', onMove, true);
    window.clearTimeout(timer);
  };
  const onClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    stop();
  };
  const onMove = (e: PointerEvent | TouchEvent) => {
    const p = 'touches' in e ? e.touches[0] : e;
    if (p && Math.hypot(p.clientX - x, p.clientY - y) > 10) stop();
  };
  window.addEventListener('click', onClick, true);
  window.addEventListener('pointermove', onMove, true);
  window.addEventListener('touchmove', onMove, { capture: true, passive: true });
  const timer = window.setTimeout(stop, 900);
}

type Ctl = { open: () => void; close: () => void };

export default function BizSwipeHint({ canStart, onOpen }: {
  /** 지금 시작해도 되는지(전체 탭 · 손으로 비즈를 끄는 중 아님) — HomeSwipeTabs 가 ref 로 답한다 */
  canStart: () => boolean;
  /** 비즈 화면이 끝까지 들어온 뒤 /biz 로 — HomeSwipeTabs 의 손으로 끌어 열기와 같은 함수 */
  onOpen: () => void;
}) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [dim, setDim] = useState(false);
  const [bubble, setBubble] = useState<'hidden' | 'in' | 'out'>('hidden');
  const [maxW, setMaxW] = useState(320);
  const peekRef = useRef<HTMLDivElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const ctl = useRef<Ctl | null>(null);
  const canStartRef = useRef(canStart);
  canStartRef.current = canStart;
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  // 시작 — 첫 화면 창들이 다 닫히고(1.2초 조용) 손가락이 화면에 없을 때
  useEffect(() => {
    if (shownInThisTab) return;
    if (!window.matchMedia?.('(max-width: 1023px)').matches) return;
    // 예전 iOS 앱(네이티브 홈이 있던 2.1.x) — 웹 홈이 네이티브 홈에 가려 안 보인다(홈 팝업과 같은 가드)
    if ((window as any).webkit?.messageHandlers?.nativeHomeRows) return;
    try { if (localStorage.getItem(HINT_KEY)) return; } catch { /* 저장소 막힘 — 이 탭에서 한 번만(shownInThisTab) */ }
    // 엿보기 사진을 먼저 받아 둔다 — 사진 없는 회색 카드가 튀어나오면 '비즈' 로 안 보인다(받는 데 오래 걸리면 2.5초 더 기다린 뒤 그냥 띄운다)
    let ready = false;
    preloadBizPeek().then(() => { ready = true; });
    let touches = 0;
    const onTs = (e: TouchEvent) => { touches = e.touches.length; };
    window.addEventListener('touchstart', onTs, { passive: true });
    window.addEventListener('touchend', onTs, { passive: true });
    window.addEventListener('touchcancel', onTs, { passive: true });
    const t0 = Date.now();
    let quietSince = 0;
    let timer = 0;
    const tick = () => {
      const now = Date.now();
      const busy = !!document.querySelector('[role="dialog"][aria-modal="true"]')
        || document.visibilityState !== 'visible'
        || touches > 0
        || !canStartRef.current();
      if (busy) quietSince = 0;
      else if (!quietSince) quietSince = now;
      if (now - t0 >= 1000 && quietSince && now - quietSince >= 1200 && (ready || now - quietSince >= 3700)) {
        if (shownInThisTab) return;
        shownInThisTab = true;
        try { localStorage.setItem(HINT_KEY, String(Date.now())); } catch { /* 이 탭에서만 기억 */ }
        try { router.prefetch('/biz'); } catch { /* 미리 받기 실패 — 누르면 그때 받는다 */ }
        setShow(true);
        return;
      }
      if (now - t0 > 120_000) return; // 2분 넘게 창이 떠 있으면 이번엔 쉰다(다음 방문에)
      timer = window.setTimeout(tick, 200);
    };
    timer = window.setTimeout(tick, 200);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('touchstart', onTs);
      window.removeEventListener('touchend', onTs);
      window.removeEventListener('touchcancel', onTs);
    };
  }, [router]);

  // 움직임 — 마운트된 뒤 rAF 스프링으로 엿보기·말풍선 칸·홈 본문의 transform 을 직접 바꾼다
  useLayoutEffect(() => {
    if (!show) return;
    const peek = peekRef.current;
    const wrap = wrapRef.current;
    if (!peek || !wrap) return;
    const W = window.innerWidth;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const home = document.querySelector<HTMLElement>('.home-shift-mobile-only');
    const restPx = Math.max(W * REST_MIN, Math.min(W * REST, W - BUBBLE_W - TAIL_GAP - EDGE_GAP));
    setMaxW(Math.max(200, Math.floor(W - restPx - TAIL_GAP - EDGE_GAP)));

    let x = 0;
    let v = 0;
    let to = 0;
    let w = 16;
    let z = 0.5;
    let mode: 'script' | 'free' | 'drag' | 'closing' | 'open' | 'gone' = 'script';
    let t0 = 0;
    let last = 0;
    let raf = 0;
    let step = 0;
    let closeAt = CLOSE_AT;
    let closeTimer = 0;
    let bubbleShown = false;
    let homeHeld = false;
    const timers: number[] = [];

    const fade = fadeRef.current;
    const paintPeek = () => {
      const n = Math.max(0, Math.min(W, x));
      const px = n.toFixed(2);
      peek.style.transform = `translate3d(calc(-100% + ${px}px),0,0)`;
      wrap.style.transform = `translate3d(${px}px,-50%,0)`;
      // 오른쪽 흰 그라데이션(48)은 엿보기가 그만큼 나오기 전엔 옅게 — 다 들어갔을 때 왼쪽 끝에 흰 띠가 남지 않게
      if (fade) fade.style.opacity = Math.min(1, n / 48).toFixed(3);
    };
    const paintHome = () => {
      if (!home) return;
      homeHeld = true;
      home.style.transition = 'none';
      home.style.transform = `translate3d(${(Math.max(0, x) * HOME_RATIO).toFixed(2)}px,0,0)`;
    };
    // 홈 본문 놓아주기 — 인라인을 걷으면 그 칸의 transition(평소 0.34초)으로 제자리에 미끄러진다.
    // 손으로 끄는 중(HomeSwipeTabs)이면 그쪽 값으로 바로 이어진다.
    const releaseHome = () => {
      if (!home || !homeHeld) return;
      homeHeld = false;
      home.style.removeProperty('transform');
      home.style.removeProperty('transition');
    };
    // 퀵매칭 말풍선 숨김 — 안내가 끝나면 'back'(스르르 돌아옴) 뒤 표시를 걷는다
    const root = document.documentElement;
    root.setAttribute(HINT_ATTR, '1');
    let qmBackTimer = 0;
    const releaseQm = () => {
      if (root.getAttribute(HINT_ATTR) !== '1') return;
      root.setAttribute(HINT_ATTR, 'back');
      qmBackTimer = window.setTimeout(() => { if (root.getAttribute(HINT_ATTR) === 'back') root.removeAttribute(HINT_ATTR); }, 700);
    };
    const finish = () => {
      if (mode === 'gone') return;
      mode = 'gone';
      cancelAnimationFrame(raf);
      raf = 0;
      releaseHome();
      releaseQm();
      setShow(false);
      setBubble('hidden');
      setDim(false);
    };

    const elapsed = () => (t0 ? performance.now() - t0 : 0);
    const frame = (now: number) => {
      raf = 0;
      if (mode === 'gone' || mode === 'open' || mode === 'drag') return;
      if (!t0) t0 = now;
      const el = now - t0;
      if (mode === 'script') {
        while (step < STEPS.length && el >= STEPS[step].at) {
          const s = STEPS[step++];
          to = s.to === 'rest' ? restPx : s.to * W; w = s.w; z = s.z;
        }
        if (step === STEPS.length) mode = 'free';
      }
      // 말풍선은 엿보기가 살아 있을 때만(일찍 닫기 시작했으면 안 띄운다)
      if (!bubbleShown && el >= BUBBLE_AT && (mode === 'script' || mode === 'free')) { bubbleShown = true; setBubble('in'); }
      if (mode === 'free' && closeAt && el >= closeAt) { closeAt = 0; close(); }
      // 반암시적 오일러 8번 나눠 — 프레임이 늦어도(최대 50ms 까지 실제 시간대로) 튀지 않게. 더 늦으면 그만큼 느려진다
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
      last = now;
      for (let i = 0; i < 8; i++) {
        const h = dt / 8;
        const a = w * w * (to - x) - 2 * z * w * v;
        v += a * h;
        x += v * h;
      }
      paintPeek();
      if (mode === 'closing') {
        if (Math.abs(x) < 0.5 && Math.abs(v) < 30) { finish(); return; }
      } else paintHome();
      // 엿보기 자리에 멈췄고 말풍선도 떴으면 rAF 를 쉬고 닫힐 때만 기다린다(가만히 있는 3초 남짓 매 프레임 칠할 필요 없음)
      if (mode === 'free' && bubbleShown && closeAt && Math.abs(to - x) < 0.05 && Math.abs(v) < 0.5) {
        x = to; v = 0; paintPeek(); paintHome();
        window.clearTimeout(closeTimer);
        closeTimer = window.setTimeout(close, Math.max(0, closeAt - el));
        closeAt = 0;
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    const kick = () => { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } };

    function close() {
      if (mode === 'closing' || mode === 'open' || mode === 'gone') return;
      window.clearTimeout(closeTimer);
      // 들어가는 동안엔 손가락이 밑의 홈(왼쪽 끝 끌기 포함)에 바로 닿게
      peek.style.pointerEvents = 'none';
      setBubble((b) => (b === 'in' ? 'out' : b));
      setDim(false);
      if (reduce) { finish(); return; }
      mode = 'closing';
      to = 0; w = 15; z = 1; // 넘치지 않고 쏙(임계 감쇠, ~0.45초)
      releaseHome();
      kick();
    }
    function open() {
      if (mode === 'open' || mode === 'gone') return;
      mode = 'open';
      window.clearTimeout(closeTimer);
      cancelAnimationFrame(raf);
      raf = 0;
      setBubble((b) => (b === 'in' ? 'out' : b));
      // 딤은 걷는다 — 딤이 비즈 화면 위에 있어서, 남겨 두면 진짜 /biz 로 바뀌는 순간 화면이 툭 밝아진다
      setDim(false);
      // 손으로 끌어 열 때(HomeSwipeTabs)와 같은 0.28초 — 말풍선 칸도 엿보기 끝을 따라 오른쪽으로 빠진다
      peek.style.transition = OPEN_EASE;
      wrap.style.transition = OPEN_EASE;
      peek.style.transform = 'translate3d(0,0,0)';
      wrap.style.transform = `translate3d(${W}px,-50%,0)`;
      releaseHome();
      timers.push(window.setTimeout(() => onOpenRef.current(), 280));
      // 이동이 끝내 안 되면(오프라인 등) 12초 뒤 안내를 걷는다 — 화면이 비즈 그림에 덮인 채 멈추지 않게.
      // (느린 망에서 /biz 가 늦게 와도 그사이 홈으로 되돌아 번쩍이지 않게 넉넉히 — 손으로 끌어 열 때도 화면이 바뀔 때까지 덮어 둔다)
      timers.push(window.setTimeout(finish, 12000));
    }
    ctl.current = { open, close };

    // 바깥을 누르면 닫는다(캡처 단계 — 밑의 카드보다 먼저). 말풍선·엿보기(data-biz-hint-hot)는 제 손잡이가 처리한다
    const isHot = (t: EventTarget | null) => t instanceof Element && !!t.closest('[data-biz-hint-hot]');
    const onDown = (e: PointerEvent | TouchEvent) => {
      if (mode === 'closing' || mode === 'open' || mode === 'gone') return;
      if (isHot(e.target)) return;
      // 늦게 뜬 창(가입 팝업 등) 안을 누른 거면 안내만 접고 누름은 그 창에 그대로 준다
      if (isInModal(e.target)) { close(); return; }
      const p = 'touches' in e ? e.touches[0] : e;
      if (p) swallowNextTap(p.clientX, p.clientY);
      close();
    };
    // 안내 도중 창(aria-modal)이 뜨면 바로 접는다 — 창이 딤 · 안내 아래에 깔리거나 첫 누름이 먹히지 않게
    const modalWatch = window.setInterval(() => {
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) close();
    }, 300);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('touchstart', onDown, { capture: true, passive: true });
    window.addEventListener('keydown', onKey);

    // 엿보인 비즈 화면 끌기 — 홈의 왼쪽 끝 끌기(HomeSwipeTabs 의 window 손잡이)와 겹치지 않게 여기서 멈춘다
    let d: { sx: number; sy: number; x0: number; lx: number; lt: number; vx: number; moved: boolean } | null = null;
    const onPeekStart = (e: TouchEvent) => {
      if (mode === 'closing' || mode === 'open' || mode === 'gone') return;
      e.stopPropagation();
      const t = e.touches[0];
      d = { sx: t.clientX, sy: t.clientY, x0: x, lx: t.clientX, lt: performance.now(), vx: 0, moved: false };
    };
    const onPeekMove = (e: TouchEvent) => {
      if (!d || mode === 'closing' || mode === 'open' || mode === 'gone') return;
      e.stopPropagation();
      const t = e.touches[0];
      const dx = t.clientX - d.sx;
      if (!d.moved && Math.abs(dx) < 8 && Math.abs(t.clientY - d.sy) < 8) return;
      if (e.cancelable) e.preventDefault();
      if (!d.moved) { d.moved = true; mode = 'drag'; cancelAnimationFrame(raf); raf = 0; window.clearTimeout(closeTimer); }
      const now = performance.now();
      if (now > d.lt) { d.vx = (t.clientX - d.lx) / (now - d.lt); d.lx = t.clientX; d.lt = now; }
      x = Math.max(0, Math.min(W, d.x0 + (dx < 0 ? dx * 0.6 : dx)));
      v = 0;
      paintPeek();
      paintHome();
    };
    const onPeekEnd = (e: TouchEvent) => {
      const g = d;
      d = null;
      if (!g) return;
      e.stopPropagation();
      if (!g.moved || mode !== 'drag') return; // 그냥 누름 — click 이 연다
      const dx = x - g.x0;
      if (x > W * 0.45 || (dx > 30 && g.vx > 0.45)) { open(); return; }
      mode = 'free';
      if (dx < -24 || g.vx < -0.45) { close(); return; }
      // 제자리로 돌아가 조금 더(2.6초) 보여 준다
      to = restPx; w = 15; z = 0.6;
      closeAt = elapsed() + 2600;
      kick();
    };
    peek.addEventListener('touchstart', onPeekStart, { passive: true });
    peek.addEventListener('touchmove', onPeekMove, { passive: false });
    peek.addEventListener('touchend', onPeekEnd);
    peek.addEventListener('touchcancel', onPeekEnd);

    if (reduce) {
      // 줄인 움직임 — 튀지 않고 엿보기 자리에 바로, 말풍선만(5초 뒤 닫힘)
      x = restPx;
      paintPeek();
      setDim(true);
      setBubble('in');
      bubbleShown = true;
      mode = 'free';
      timers.push(window.setTimeout(close, 5000));
    } else {
      paintPeek();
      // 딤은 다음 프레임에 켠다(처음 그린 투명 상태에서 스르르)
      const r = requestAnimationFrame(() => { setDim(true); kick(); });
      timers.push(-r); // 음수 = rAF(정리 때 구분)
    }

    return () => {
      timers.forEach((id) => (id < 0 ? cancelAnimationFrame(-id) : window.clearTimeout(id)));
      window.clearTimeout(closeTimer);
      window.clearInterval(modalWatch);
      // 안내가 다 끝난 정리(gone)면 'back'(스르르 돌아옴) 타이머가 표시를 걷게 둔다.
      // 안내 도중에 화면을 떠나면(홈 → 다른 화면 · 비즈 열기) 표시를 바로 걷는다 — 다음에 홈에 왔을 때 퀵매칭 말풍선이 숨은 채로 남지 않게
      if (mode !== 'gone') {
        window.clearTimeout(qmBackTimer);
        if (root.getAttribute(HINT_ATTR)) root.removeAttribute(HINT_ATTR);
      }
      cancelAnimationFrame(raf);
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('touchstart', onDown, true);
      window.removeEventListener('keydown', onKey);
      peek.removeEventListener('touchstart', onPeekStart);
      peek.removeEventListener('touchmove', onPeekMove);
      peek.removeEventListener('touchend', onPeekEnd);
      peek.removeEventListener('touchcancel', onPeekEnd);
      releaseHome();
      ctl.current = null;
    };
  }, [show]);

  // 말풍선이 접히는 애니(0.18초) 뒤에 걷는다
  useEffect(() => {
    if (bubble !== 'out') return;
    const t = window.setTimeout(() => setBubble((b) => (b === 'out' ? 'hidden' : b)), 200);
    return () => window.clearTimeout(t);
  }, [bubble]);

  // 퀵매칭 말풍선 숨김 CSS 는 안내가 걷힌 뒤에도 잠깐('back') 필요해 늘 둔다(아주 작은 규칙 두 줄)
  const hideQmStyle = <style dangerouslySetInnerHTML={{ __html: `${HIDE_QM_CSS}
.biz-hint-open{position:absolute;inset:0;z-index:0;margin:0;padding:0;border:0;border-radius:24px;background:transparent;cursor:pointer;-webkit-tap-highlight-color:transparent}
.biz-hint-open:focus-visible{outline:2px solid rgba(49,130,246,.55);outline-offset:2px}` }} />;
  if (!show) return hideQmStyle;
  const open = () => ctl.current?.open();
  return (
    <>
      {hideQmStyle}
      {/* 엿보인 비즈 첫 화면 — 누르면 열기, 끌 수도 있다. 오른쪽 끝은 손으로 끌 때(HomeSwipeTabs)와 같은 흰 그라데이션 48 로 홈과 이어진다
          (261009 사장 '검은색 영역 말고 흰색 그라데이션으로 자연스럽게' — 그림자 없음) */}
      <div
        ref={peekRef}
        data-biz-hint-hot
        role="link"
        tabIndex={-1}
        aria-label="프리티풀 비즈 열기"
        onClick={open}
        className="lg:hidden fixed inset-0 z-[69] cursor-pointer"
        style={{ transform: 'translate3d(calc(-100% - 48px),0,0)', willChange: 'transform', touchAction: 'none', WebkitTapHighlightColor: 'transparent' }}
      >
        <BizSwipePeek />
        <div ref={fadeRef} className="absolute inset-y-0" style={{ left: '100%', width: 48, opacity: 0, background: 'linear-gradient(to right, #fff 0%, rgba(255,255,255,0) 100%)' }} />
      </div>
      {/* 딤 — 엿보기까지 화면 전체를 살짝(사장 '전체 화면이 딤드되면서'), 말풍선만 밝게 위에. 누름은 window 캡처 손잡이가 받는다
          (여기는 통과 — 엿보기 누르기·스크롤·가장자리 스와이프가 그대로 되게) */}
      <div
        aria-hidden="true"
        className="lg:hidden pointer-events-none fixed inset-0 z-[70] bg-black"
        style={{ opacity: dim ? DIM : 0, transition: 'opacity 0.36s cubic-bezier(0.22,0.61,0.36,1)' }}
      />
      {/* 말풍선 칸 — 엿보기 오른쪽 끝을 따라다닌다(세로는 화면 46%) */}
      <div
        ref={wrapRef}
        className="lg:hidden pointer-events-none fixed z-[71]"
        style={{ left: TAIL_GAP, top: '46%', transform: 'translate3d(0,-50%,0)', willChange: 'transform' }}
      >
        {bubble !== 'hidden' && (
          // 말풍선 칸은 역할 없는 묶음(role=group) — 예전엔 role=link 칸 안에 × 단추가 들어 있어(대화형 요소 겹침) Enter 만 먹고 Space 는 안 먹었다.
          // 손가락 · 마우스는 말풍선 어디를 눌러도 열리고(onClick), 키보드 · 화면 읽기는 안의 '비즈 열기' 단추(글씨 칸 전체를 덮는 투명 단추)와 × 를 따로 쓴다
          <div
            data-biz-hint-hot
            className={`qm-bubble biz side${bubble === 'out' ? ' is-out' : ''}`}
            style={{ position: 'relative', width: 'max-content', maxWidth: maxW, pointerEvents: 'auto', '--tail-y': '50%' } as CSSProperties}
            role="group"
            aria-label="비즈 페이지 안내"
            onClick={open}
          >
            {/* 그림자 → 유리(꼬리+몸통 한 장, 꼬리 왼쪽) → 글씨 — PC 비즈 말풍선과 같은 칸 */}
            <span className="qm-bubble-shadow" aria-hidden="true" />
            <QuickMatchBubbleGlass side="left" />
            <div className="qm-bubble-body">
              <button
                type="button"
                className="biz-hint-open"
                aria-label="비즈 페이지가 추가되었어요. 기업행사 · 웨딩홀 사회자 섭외 — 눌러서 열기(홈 왼쪽 끝을 밀어도 언제든 열려요)"
                onClick={(e) => { e.stopPropagation(); open(); }}
              />
              <span className="qm-bubble-ic" aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element -- PC 비즈 말풍선과 같은 파란 폴더 */}
                <img src={BIZ_ICON} alt="" width={28} height={28} />
              </span>
              <p className="qm-bubble-title" aria-hidden="true">비즈 페이지가 추가되었어요</p>
              <p className="qm-bubble-sub" aria-hidden="true">왼쪽 끝을 밀면 언제든 열려요</p>
              <button
                type="button"
                className="qm-bubble-x"
                aria-label="말풍선 닫기"
                onClick={(e) => { e.stopPropagation(); ctl.current?.close(); }}
              >
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
                  <path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
