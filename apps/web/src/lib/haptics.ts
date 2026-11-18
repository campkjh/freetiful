// 진동(햅틱) — 261118 사장 '시크릿 미션 모달 뜰 때 진동도 추가해줘'.
// 길이 되는 곳부터 차례로 하나만 쓴다:
//  ① iOS 앱 네이티브(webkit.messageHandlers.haptic — 앱 새 빌드부터, UINotificationFeedbackGenerator 등)
//  ② 안드 앱 네이티브(window.Android.haptic — 앱 새 빌드부터)
//  ③ navigator.vibrate — 안드 크롬 · 안드 앱(VIBRATE 권한이 있을 때)
//  ④ iOS 18+ 사파리 · 웹뷰 — 숨긴 <input type="checkbox" switch> 를 누르면 시스템이 '딸깍' 햅틱을 낸다(웹에서 iOS 진동을 내는 유일한 길)
// 어느 것도 안 되면 조용히 넘어간다(화면 동작에는 영향 없음).
export type HapticKind = 'success' | 'light' | 'medium';

const VIBRATE: Record<HapticKind, number | number[]> = {
  success: [14, 70, 22],
  light: 10,
  medium: 20,
};

type W = Window & {
  webkit?: { messageHandlers?: { haptic?: { postMessage: (v: unknown) => void } } };
  Android?: { haptic?: (kind: string) => void };
};

function iosSwitchTick(times: number) {
  const label = document.createElement('label');
  label.setAttribute('aria-hidden', 'true');
  label.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.tabIndex = -1;
  label.appendChild(input);
  document.body.appendChild(label);
  for (let i = 0; i < times; i++) {
    if (i === 0) label.click();
    else window.setTimeout(() => label.click(), i * 90);
  }
  window.setTimeout(() => label.remove(), times * 90 + 200);
}

export function haptic(kind: HapticKind = 'light') {
  if (typeof window === 'undefined') return;
  const w = window as W;
  try {
    const ios = w.webkit?.messageHandlers?.haptic;
    if (ios) { ios.postMessage(kind); return; }
  } catch {}
  try {
    if (typeof w.Android?.haptic === 'function') { w.Android.haptic(kind); return; }
  } catch {}
  try {
    if (typeof navigator.vibrate === 'function' && navigator.vibrate(VIBRATE[kind])) return;
  } catch {}
  try {
    const ua = navigator.userAgent;
    const apple = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    if (apple) iosSwitchTick(kind === 'success' ? 2 : 1);
  } catch {}
}
