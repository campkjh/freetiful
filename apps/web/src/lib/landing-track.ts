// 랜딩 유입(UTM) 추적 — wedding-mc / corporate-mc 공용.
// 방문 시 utm/referrer 를 sessionStorage 에 보존하고 방문 1건을 서버에 기록,
// 폼 제출 시 같은 세션의 방문을 전환(converted)으로 표시한다. (익명, fire-and-forget)

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

export type LandingPage = 'wedding-mc' | 'corporate-mc';

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
