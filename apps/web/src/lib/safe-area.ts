'use client';

// 앱 전용 안전영역 값 읽기 + 상태바 글자색(261014 iOS 앱 화면 끝까지)
//  · CSS 토큰 --ft-sat(위)·--ft-sab(아래)는 globals.css — iOS 앱(html[data-ios-app])에서만 env 값, 나머지는 0.
//  · 토큰 문자열(getPropertyValue)은 'env(...)' 그대로라 px 를 모른다 → body 에 붙여 둔 숨은 자(probe)의
//    padding 을 getComputedStyle 로 그때그때 읽는다. 한 번 재서 저장하지 말 것(회전·키보드·하이드레이션 뒤 값이 바뀐다).
//  · 서버(SSR)·첫 그림 전에는 0.
import { useEffect } from 'react';

const PROBE_ID = 'ft-safe-probe';

function getProbe(): HTMLElement | null {
  if (typeof document === 'undefined' || !document.body) return null;
  const found = document.getElementById(PROBE_ID);
  if (found) return found;
  // 첫 호출 때 한 번 붙인다(body 끝에 남는 노드는 하이드레이션이 문제 삼지 않는다). 지워져도 다음 호출에 다시 붙는다.
  const el = document.createElement('div');
  el.id = PROBE_ID;
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none;box-sizing:content-box;padding:var(--ft-sat,0px) 0 var(--ft-sab,0px) 0;';
  document.body.appendChild(el);
  return el;
}

function readPad(side: 'top' | 'bottom'): number {
  try {
    const el = getProbe();
    if (!el) return 0;
    const cs = window.getComputedStyle(el);
    const v = parseFloat(side === 'top' ? cs.paddingTop : cs.paddingBottom);
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}

/** 위 안전영역(상태바·다이내믹 아일랜드) px — iOS 앱에서만 0 보다 크다. 부를 때마다 새로 읽는다. */
export function readSafeTop(): number {
  return readPad('top');
}

/** 아래 안전영역(홈 표시줄) px — iOS 앱에서만, 키보드가 떠 있으면(data-kb) 0. 부를 때마다 새로 읽는다. */
export function readSafeBottom(): number {
  return readPad('bottom');
}

// ─── 상태바 글자색 ──────────────────────────────────────────────────────────
// 사진·영상·어두운 바탕이 상태바 뒤로 깔리는 동안 흰 글자(light). 화면 여럿이 동시에 켤 수 있어 켠 개수를 센다.
// html[data-status-bar="light"] 를 달고 떼면 네이티브(nativeNavState)가 읽어 상태바 스타일을 바꾼다. 앱 밖에선 표시만 붙고 아무 일 없다.
let lightCount = 0;

function applyStatusBar() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const want = lightCount > 0;
  const has = root.getAttribute('data-status-bar') === 'light';
  if (want === has) return;
  if (want) root.setAttribute('data-status-bar', 'light');
  else root.removeAttribute('data-status-bar');
  try {
    (window as unknown as { __freetifulNativeNavPostState?: (force?: boolean) => void }).__freetifulNativeNavPostState?.(false);
  } catch {
    /* 앱 밖 */
  }
}

/** light=true 인 동안 상태바를 흰 글자로. 끄거나 언마운트되면 원래(검은 글자)로 — 켠 곳이 모두 꺼져야 돌아간다. */
export function useNativeStatusBar(light: boolean): void {
  useEffect(() => {
    if (!light) return;
    lightCount += 1;
    applyStatusBar();
    return () => {
      lightCount = Math.max(0, lightCount - 1);
      applyStatusBar();
    };
  }, [light]);
}
