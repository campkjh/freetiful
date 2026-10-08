"use client";

// 시트·모달이 떠 있는 동안 뒤 화면이 절대 움직이지 않게 잠근다(261008 사장 '댓글 모달에서 뒤 요소가 계속 스크롤되는데 안 되게').
//
//  · 문서 잠금 = lib/hooks/useBodyScrollLock(body position:fixed + top:-스크롤값, 풀 때 그 자리로 즉시 복귀, 개수로 세기) 그대로.
//    시트 안에서 여는 웨딩숲 프로필 시트(IdentitySheet)·에디터 이름 시트도 같은 잠금을 쓴다 — 계수기가 하나여야
//    겹쳐 열고 닫을 때 뒤 화면이 맨 위로 튀지 않는다(따로 잠그면 두 번째 잠금이 scrollY 0 을 저장해 튄다).
//  · 여기서 더하는 것
//    1) 터치 가드: 손가락이 움직일 때 '그 방향으로 실제로 스크롤할 수 있는 칸' 안이 아니면 기본 동작을 막는다.
//       - iOS(사파리·WKWebView)는 body 가 fixed 여도 딤·시트 머리를 끌면 웹뷰 전체가 고무줄처럼 늘어나고,
//         목록 끝에서 계속 끌면 바깥으로 스크롤이 샌다(overscroll-behavior 를 모르는 iOS 15 이하 포함).
//       - 안드 크롬은 맨 위에서 아래로 끌면 브라우저 '당겨서 새로고침'이 걸린다.
//       - 목록·입력칸 안의 스크롤은 그대로(끝에 닿으면 거기서 멈춤 = 바깥으로 넘기지 않음).
//       - 입력칸(textarea) 위 끌기도 같다 — 입력칸이 그 방향으로 실제로 스크롤될 때만 통과(키보드 뜬 채 뒤 웹뷰가 밀리던 것, 261008).
//         길게 누른 뒤 끌기(iOS 돋보기·커서 옮기기, 안드 글자 고르기)와 글자를 고른 채 끄는 건 그대로 둔다.
//    2) window 터치 리스너 차단: 잠긴 동안 window 에 붙은 페이지 제스처(웨딩숲 PullToRefresh 등)가 손가락을 못 보게.
//       body 가 fixed 면 scrollY 가 0 이라 PullToRefresh 가 '맨 위'로 착각해, 목록을 올려 보려는 손가락을 가로챘다.
//       (React 는 document 에서 이벤트를 받으므로 시트 안 onTouch* 는 그대로 동작한다)
//    3) 문서 scroll 이벤트 차단: 잠글 때(0 으로)·풀 때(원래 자리로) 나는 가짜 scroll 이벤트를 페이지가 못 보게 —
//       웨딩숲 머리줄 접힘·무한 로딩·스크롤 위치 저장이 오작동하지 않는다.
//    4) html·body overscroll-behavior:none, 데스크톱은 사라진 스크롤바 폭만큼 오른쪽 여백(폭 흔들림 방지).
//    5) 잠근 채 다른 화면으로 이동(유니버설 링크·푸시·안드 기록 없는 뒤로 = router.push)하면 풀 때 옛 화면 스크롤값으로
//       새 화면을 밀지 않는다 — 도착한 화면이 맨 아래(footer)에서 열리던 것(261008). 뒤로가기(popstate)는 예전 그대로.
import { useEffect, useLayoutEffect } from "react";
import { useBodyScrollLock } from "@/lib/hooks/useBodyScrollLock";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** 이 속성이 붙은 칸(과 그 안)은 터치 가드가 손대지 않는다 — 가로 캐러셀처럼 직접 제스처를 처리하는 칸용 */
export const SCROLL_LOCK_ALLOW_ATTR = "data-scroll-lock-allow";

const TOUCH_TYPES = ["touchstart", "touchmove", "touchend", "touchcancel"] as const;
/** 입력칸 길게 누르기로 보는 시간 — iOS 돋보기(약 0.5초)·안드 글자 고르기보다 조금 짧게 */
const EDIT_HOLD_MS = 350;
/** 이만큼 움직이기 전(손떨림)은 판정을 미룬다 — 스크롤은 이보다 더 움직여야 시작한다 */
const EDIT_SLOP_PX = 8;

let lockCount = 0;
let teardown: (() => void) | null = null;
let shieldTimer = 0;
let pendingRestore: (() => void) | null = null; // 풀리는 중에 다시 잠그면 먼저 되돌릴 오른쪽 여백
/** 잠근 채 다른 화면으로 이동했을 때 — y: 문서 잠금이 풀리기 직전(= Next 가 새 화면에 정한) 스크롤값 */
let routeLeave: { y: number | null } | null = null;

function isEditable(el: Element | null): boolean {
  if (!el) return false;
  if (el.tagName === "TEXTAREA") return true;
  if (el.tagName === "INPUT") {
    const type = (el as HTMLInputElement).type;
    return !["button", "checkbox", "radio", "submit", "reset", "range", "color", "file"].includes(type);
  }
  return (el as HTMLElement).isContentEditable === true;
}

/** 입력칸 안에서 글자를 고른 상태(손잡이 끌기 중일 수 있음) */
function hasSelection(el: Element): boolean {
  if (document.activeElement !== el) return false;
  if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
    try {
      const f = el as HTMLTextAreaElement;
      return f.selectionStart != null && f.selectionEnd != null && f.selectionStart !== f.selectionEnd;
    } catch {
      return false; // selectionStart 를 못 읽는 input 종류
    }
  }
  const sel = window.getSelection();
  return !!sel && !sel.isCollapsed && el.contains(sel.anchorNode);
}

/** start 부터 위로 올라가며 axis 방향(delta 부호)으로 실제 스크롤할 수 있는 칸을 찾는다.
 *  스크롤 칸을 만났는데 그쪽 끝에 닿아 있으면 거기서 false — 바깥 칸·문서로 새지 않게. */
function canScrollToward(start: EventTarget | null, axis: "x" | "y", delta: number): boolean {
  let el = start instanceof Element ? start : null;
  while (el && el !== document.body && el !== document.documentElement) {
    if (el.hasAttribute(SCROLL_LOCK_ALLOW_ATTR)) return true;
    if (el instanceof HTMLElement) {
      const cs = window.getComputedStyle(el);
      if (axis === "y") {
        const oy = cs.overflowY;
        if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 1) {
          // 손가락이 아래로(delta>0) = 내용은 위로 → 위에 남은 게 있어야
          return delta > 0 ? el.scrollTop > 0.5 : el.scrollTop + el.clientHeight < el.scrollHeight - 0.5;
        }
      } else {
        const ox = cs.overflowX;
        if ((ox === "auto" || ox === "scroll") && el.scrollWidth > el.clientWidth + 1) {
          return delta > 0 ? el.scrollLeft > 0.5 : el.scrollLeft + el.clientWidth < el.scrollWidth - 0.5;
        }
      }
    }
    el = el.parentElement;
  }
  return false;
}

function installTouchGuards(): () => void {
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastY = 0;
  let startAt = 0;
  let axis: "x" | "y" | null = null;
  // 입력칸 위에서 시작한 손가락: pending(아직 손떨림 범위) → hold(길게 누른 뒤 끌기 = 커서·글자 고르기) / drag(그냥 끌기)
  let edit: "none" | "pending" | "hold" | "drag" = "none";
  const onStart = (e: TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    startX = lastX = t.clientX;
    startY = lastY = t.clientY;
    startAt = performance.now();
    axis = null;
    edit = e.touches.length === 1 && isEditable(e.target as Element | null) ? "pending" : "none";
  };
  const onMove = (e: TouchEvent) => {
    const t = e.touches[0];
    if (!t || !e.cancelable) return;
    if (e.touches.length > 1) {
      e.preventDefault(); // 두 손가락 = 뒤 화면 확대·이동도 막는다
      return;
    }
    // 방향은 처음 움직인 쪽(누적)으로 정하고, 끝에 닿았는지는 이번 움직임 부호로 본다(중간에 방향을 바꿔도 맞게)
    if (!axis) axis = Math.abs(t.clientY - startY) >= Math.abs(t.clientX - startX) ? "y" : "x";
    const delta = axis === "y" ? t.clientY - lastY : t.clientX - lastX;
    lastX = t.clientX;
    lastY = t.clientY;
    if (delta === 0) return;
    const target = e.target as Element | null;
    if (canScrollToward(target, axis, delta)) return; // 입력칸·목록이 그 방향으로 실제로 스크롤된다
    if (edit !== "none" && isEditable(target)) {
      if (hasSelection(target as Element)) return; // 글자를 고른 채 끄는 중(손잡이)
      if (edit === "pending") {
        if (Math.hypot(t.clientX - startX, t.clientY - startY) < EDIT_SLOP_PX) return; // 손떨림 — 아직 아무것도 스크롤되지 않는다
        edit = performance.now() - startAt >= EDIT_HOLD_MS ? "hold" : "drag";
      }
      if (edit === "hold") return; // 길게 누른 뒤 끌기 = iOS 돋보기·커서 옮기기, 안드 글자 고르기
    }
    e.preventDefault();
  };
  // document 단계에서 전파를 끊는다 — React(document 위임)는 이미 받은 뒤라 시트 안 핸들러는 그대로 돈다
  const shield = (e: Event) => e.stopPropagation();
  document.addEventListener("touchstart", onStart, { capture: true, passive: true });
  document.addEventListener("touchmove", onMove, { capture: true, passive: false });
  for (const type of TOUCH_TYPES) document.addEventListener(type, shield, false);
  return () => {
    document.removeEventListener("touchstart", onStart, { capture: true });
    document.removeEventListener("touchmove", onMove, { capture: true });
    for (const type of TOUCH_TYPES) document.removeEventListener(type, shield, false);
  };
}

// 문서 scroll 이벤트(대상 = document)만 막는다 — 칸 안 스크롤 이벤트는 그대로 흘려보낸다.
function stopDocumentScroll(e: Event) {
  const t = e.target;
  if (t === document || t === document.documentElement || t === document.body || t === window) e.stopImmediatePropagation();
}

const BODY_KEYS = ["position", "top", "left", "right", "width", "overflow"] as const;

function lockExtras(): () => void {
  const html = document.documentElement;
  const body = document.body;
  window.cancelAnimationFrame(shieldTimer);
  pendingRestore?.();
  pendingRestore = null;
  window.removeEventListener("scroll", stopDocumentScroll, true);
  window.addEventListener("scroll", stopDocumentScroll, true);
  const saved = {
    htmlOverscroll: html.style.overscrollBehavior,
    bodyOverscroll: body.style.overscrollBehavior,
    paddingRight: body.style.paddingRight,
  };
  // 문서 잠금(useBodyScrollLock, 패시브 이펙트)이 걸기 전 body 모습 — 잠근 채 다른 화면으로 가면 이걸로 먼저 푼다
  const bodyBefore = body.style.position === "fixed" ? null : BODY_KEYS.map((k) => [k, body.style[k]] as const);
  const lockedY = window.scrollY;
  const lockedPath = window.location.pathname;
  let popped = false;
  const onPop = () => {
    popped = true;
  };
  window.addEventListener("popstate", onPop);
  html.style.overscrollBehavior = "none";
  body.style.overscrollBehavior = "none";
  // 데스크톱: body 가 fixed 가 되면 스크롤바가 사라져 폭이 늘어난다 — 그만큼 오른쪽을 채운다(모바일은 0)
  const scrollbar = window.innerWidth - html.clientWidth;
  if (scrollbar > 0 && body.style.position !== "fixed") {
    const base = parseFloat(window.getComputedStyle(body).paddingRight) || 0;
    body.style.paddingRight = `${base + scrollbar}px`;
  }
  const removeTouch = installTouchGuards();
  return () => {
    removeTouch();
    window.removeEventListener("popstate", onPop);
    html.style.overscrollBehavior = saved.htmlOverscroll;
    body.style.overscrollBehavior = saved.bodyOverscroll;
    // 잠근 채 앱 안 이동(router.push)으로 화면이 바뀌었다 — 이 정리는 새 화면 커밋 중(Next 가 맨 위로 올리기 전)에 돈다.
    // body 를 지금 풀어 두면 Next 가 새 화면을 제자리(맨 위)에 놓고, 아래 패시브 정리가 옛 스크롤값으로 미는 걸 되돌린다.
    if (!popped && window.location.pathname !== lockedPath) {
      routeLeave = { y: null };
      if (bodyBefore && body.style.position === "fixed" && body.style.top === `-${lockedY}px`) {
        for (const [k, v] of bodyBefore) body.style[k] = v;
      }
      body.style.paddingRight = saved.paddingRight;
      window.removeEventListener("scroll", stopDocumentScroll, true); // 새 화면의 scroll 이벤트는 막지 않는다
      return;
    }
    // body 잠금은 이 다음(패시브 이펙트)에 풀리고, 원래 자리로 돌려놓는 scrollTo 의 scroll 이벤트는 그다음 프레임에 온다 —
    // body 가 풀린 걸 본 뒤(오른쪽 여백도 그때 되돌림 — 먼저 빼면 한 프레임 폭이 흔들림) 두 프레임 더 기다렸다 방패를 내린다(최대 1초)
    const started = performance.now();
    let after = -1;
    pendingRestore = () => {
      body.style.paddingRight = saved.paddingRight;
    };
    const tick = () => {
      if (lockCount > 0) return; // 그 사이 다시 잠겼으면 새 잠금이 이어받는다(pendingRestore)
      const timedOut = performance.now() - started > 1000;
      if (after < 0 && (body.style.position !== "fixed" || timedOut)) {
        after = 0;
        pendingRestore?.();
        pendingRestore = null;
      }
      if (after >= 0) after += 1;
      if (after >= 3 || timedOut) {
        window.removeEventListener("scroll", stopDocumentScroll, true);
        return;
      }
      shieldTimer = window.requestAnimationFrame(tick);
    };
    shieldTimer = window.requestAnimationFrame(tick);
  };
}

/** 뒤 화면 잠금(겹쳐 써도 안전 — 마지막이 풀릴 때 원래대로) */
export function useScrollLock(active: boolean) {
  // 1) 문서 잠금보다 먼저(레이아웃 이펙트): 스크롤바 폭 재기·scroll 이벤트 방패·터치 가드
  useIsoLayoutEffect(() => {
    if (!active || typeof document === "undefined") return;
    if (lockCount === 0) teardown = lockExtras();
    lockCount += 1;
    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount > 0) return;
      teardown?.();
      teardown = null;
    };
  }, [active]);

  // 2) 화면 이동 대비 — 아래 문서 잠금 정리(scrollTo 옛 자리) 바로 앞에서 지금 스크롤값을 적어 둔다.
  //    (같은 컴포넌트의 패시브 정리는 선언 순서대로 돈다: 이것 → 문서 잠금 → 3)
  useEffect(() => {
    if (!active) return;
    return () => {
      if (routeLeave && routeLeave.y === null) routeLeave.y = window.scrollY;
    };
  }, [active]);

  // 3) 문서 잠금(body fixed + top) — 공용 계수기
  useBodyScrollLock(active);

  // 4) 화면이 바뀌었으면 문서 잠금이 옛 화면 자리로 민 스크롤을 새 화면 자리로 되돌린다
  useEffect(() => {
    if (!active) return;
    return () => {
      const leave = routeLeave;
      if (!leave) return;
      routeLeave = null;
      const y = leave.y ?? 0;
      const back = () => window.scrollTo({ top: y, left: 0, behavior: "instant" as ScrollBehavior });
      // 다른 잠금(시트 안 프로필 시트 등)이 아직 남아 있으면 그 정리가 끝난 뒤(같은 태스크 안 — 그려지기 전)
      if (document.body.style.position === "fixed") queueMicrotask(back);
      else back();
    };
  }, [active]);
}
