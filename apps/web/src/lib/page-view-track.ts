// 페이지별 인사이트(261007 사장 '페이지별 방문자 수·잔류시간') — 화면을 열 때 조회 1건, 떠날 때 그 화면이 보이던 시간.
//  · 체류시간 = 실제로 보이던 시간만(앱·탭이 뒤로 가면 멈추고, 돌아오면 이어 센다). 숨을 때·닫을 때·다른 화면으로 갈 때 누적값을 보낸다(서버는 큰 값만 남김).
//  · 방문자 = 기기(브라우저)마다 만든 무작위 값(localStorage). 개인 정보는 보내지 않는다.
//  · 세지 않는 곳 = 관리자·로그인 콜백·루트(바로 /main)·다른 화면 안 iframe(홈 미리보기 등)·개발 서버(ft_pv_debug=1 이면 셈).
import { landingSessionKey, visitPlatform } from './landing-track';

const EP = '/api/v1/landing/pageview';
const VID_KEY = 'ft_vid';
const ENTRY_KEY = 'ft_pv_entry_done';

type View = { id: string; activeMs: number; visibleSince: number | null; sentMs: number };
let cur: View | null = null;
let listening = false;

function uuid(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* 보안 컨텍스트가 아님 — 아래 대체 */ }
  const b = new Uint8Array(16);
  try { crypto.getRandomValues(b); } catch { for (let i = 0; i < 16; i += 1) b[i] = Math.floor(Math.random() * 256); }
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function visitorId(): string {
  try {
    let v = localStorage.getItem(VID_KEY);
    if (!v) {
      v = uuid();
      localStorage.setItem(VID_KEY, v);
    }
    return v;
  } catch {
    return landingSessionKey(); // 저장소 막힘 — 탭 세션 키로 대신
  }
}

export function shouldTrackPath(pathname: string): boolean {
  if (!pathname || pathname === '/') return false;
  if (/^\/(admin|auth|api)(\/|$)/.test(pathname)) return false;
  try {
    if (window.self !== window.top) return false;
    const h = window.location.hostname;
    const local = h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local');
    if (local && localStorage.getItem('ft_pv_debug') !== '1') return false;
    if ((navigator as Navigator & { webdriver?: boolean }).webdriver) return false;
  } catch {
    return false;
  }
  return true;
}

function post(url: string, body: unknown) {
  try {
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).catch(() => {});
  } catch { /* 기록 실패는 화면에 영향 없음 */ }
}

const activeOf = (v: View) => v.activeMs + (v.visibleSince != null ? Date.now() - v.visibleSince : 0);

/** 지금까지 보이던 시간(누적)을 보낸다 — 지난번보다 0.3초 넘게 늘었을 때만 */
function flush() {
  if (!cur) return;
  const ms = Math.round(activeOf(cur));
  if (ms - cur.sentMs < 300) return;
  cur.sentMs = ms;
  post(`${EP}/duration`, { id: cur.id, ms });
}

function pause() {
  if (cur && cur.visibleSince != null) {
    cur.activeMs += Date.now() - cur.visibleSince;
    cur.visibleSince = null;
  }
}

function listen() {
  if (listening) return;
  listening = true;
  document.addEventListener('visibilitychange', () => {
    if (!cur) return;
    if (document.visibilityState === 'hidden') {
      pause();
      flush();
    } else if (cur.visibleSince == null) {
      cur.visibleSince = Date.now();
    }
  });
  window.addEventListener('pagehide', () => {
    pause();
    flush();
  });
}

/** 화면이 바뀔 때 — 앞 화면 체류시간을 마무리하고 새 조회를 연다 */
export function startPageView(pathname: string) {
  endPageView();
  if (!shouldTrackPath(pathname)) return;
  listen();
  let entry = false;
  try {
    entry = !sessionStorage.getItem(ENTRY_KEY);
    sessionStorage.setItem(ENTRY_KEY, '1');
  } catch { /* 저장소 막힘 — 첫 화면 표시 없이 */ }
  const id = uuid();
  cur = { id, activeMs: 0, visibleSince: document.visibilityState === 'visible' ? Date.now() : null, sentMs: 0 };
  post(EP, {
    id,
    path: pathname,
    visitorId: visitorId(),
    sessionKey: landingSessionKey(),
    platform: visitPlatform(),
    device: window.innerWidth >= 1024 ? 'desktop' : 'mobile',
    entry,
    referrer: entry ? document.referrer || undefined : undefined,
  });
}

export function endPageView() {
  pause();
  flush();
  cur = null;
}
