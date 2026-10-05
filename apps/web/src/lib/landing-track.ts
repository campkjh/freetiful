// 랜딩 유입(UTM) 추적 — wedding-mc / corporate-mc 공용 + 홈·퀵매칭 방문(어드민 전환 퍼널 첫 두 단계).
// 방문 시 utm/referrer 를 sessionStorage 에 보존하고 방문 1건을 서버에 기록,
// 폼 제출 시 같은 세션의 방문을 전환(converted)으로 표시한다. (익명, fire-and-forget)

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

/** 랜딩 2개(유입 분석) + 홈·퀵매칭(어드민 홈 전환 퍼널, 261005) */
export type LandingPage = 'wedding-mc' | 'corporate-mc' | 'home' | 'quick-match';

function ss(): Storage | null {
  try { return window.sessionStorage; } catch { return null; }
}

/** URL 쿼리의 utm_* / referrer / 랜딩 URL 을 세션에 보존(최초 진입 값 유지). */
export function captureUtm() {
  const store = ss();
  if (!store) return;
  try {
    const sp = new URLSearchParams(window.location.search);
    UTM_KEYS.forEach((k) => { const v = sp.get(k); if (v) store.setItem(k, v); });
    if (document.referrer && !store.getItem('referrer')) store.setItem('referrer', document.referrer);
    if (!store.getItem('landing_url')) store.setItem('landing_url', window.location.href);
  } catch {}
}

/** 현재 세션에 보존된 utm 값 묶음. */
export function readUtm() {
  const store = ss();
  const get = (k: string) => (store?.getItem(k) || '') || undefined;
  return {
    utm_source: get('utm_source'),
    utm_medium: get('utm_medium'),
    utm_campaign: get('utm_campaign'),
    utm_term: get('utm_term'),
    utm_content: get('utm_content'),
    referrer: get('referrer'),
  };
}

function sessionKey(): string {
  const store = ss();
  if (!store) return Math.random().toString(36).slice(2);
  let k = store.getItem('landing_sk');
  if (!k) {
    k = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    store.setItem('landing_sk', k);
  }
  return k;
}

/** 어디서 열었나 — 앱 껍데기(iOS WKWebView 메시지 다리 · 안드로이드 다리)면 앱, 아니면 웹(모바일 웹 포함) */
function visitPlatform(): 'web' | 'ios-app' | 'android-app' {
  try {
    const w = window as any;
    if (w.webkit?.messageHandlers) return 'ios-app';
    if (w.FreetifulAndroid || w.Android) return 'android-app';
  } catch {}
  return 'web';
}

/** 랜딩 방문 1건 기록(세션·페이지당 1회). utm 캡처 후 호출. */
export function trackLandingVisit(page: LandingPage) {
  const store = ss();
  const once = `landing_visit_${page}`;
  if (store?.getItem(once)) return; // 세션 내 새로고침 중복 방지
  const u = readUtm();
  const body = {
    page,
    sessionKey: sessionKey(),
    landingPath: (() => { try { return window.location.pathname + window.location.search; } catch { return undefined; } })(),
    platform: visitPlatform(),
    ...u,
  };
  fetch('/api/v1/landing/visit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
  }).then(() => { store?.setItem(once, '1'); }).catch(() => {});
}

/** 폼 제출 성공 시 이 세션의 방문을 전환으로 표시. */
export function trackLandingConversion(page: LandingPage) {
  fetch('/api/v1/landing/convert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page, sessionKey: sessionKey() }),
    keepalive: true,
  }).catch(() => {});
}
