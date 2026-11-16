// Campaign boundaries are fixed to Korea time, independent of the device timezone.
export const RECEPTION_START = Date.parse('2026-11-23T00:00:00+09:00');
export const RECEPTION_END = Date.parse('2026-11-24T00:00:00+09:00');

// 송년회 첫 팝업은 송년회 당일(11/23 KST)에만 — 261111 사장 '앱 화면에 뜨는 모든 송년회 배너 송년회 당일만'.
// 홈 위 넘김 배너는 261116 사장 '송년회 홈에 있는 배너는 지금도 뜨게끔'으로 따로 → orderHomeBanners.
export function orderHomePromos<T extends { id: string }>(promos: T[], now = Date.now()): T[] {
  if (now < RECEPTION_START || now >= RECEPTION_END) return promos.filter((promo) => promo.id !== 'reception-2026');
  return [...promos.filter((promo) => promo.id === 'reception-2026'), ...promos.filter((promo) => promo.id !== 'reception-2026')];
}

/** 홈 위 넘김 배너(모바일 8:3 · PC 첫 화면) — 행사 전에도 제자리(가입 5천원 다음)에 보이고, 당일엔 맨 앞, 11/24 0시(KST)부터 빠진다 */
export function orderHomeBanners<T extends { id: string }>(banners: T[], now = Date.now()): T[] {
  if (now < RECEPTION_START) return banners;
  return orderHomePromos(banners, now);
}

export function homePopupSessionKey(now = Date.now()) {
  const phase = now < RECEPTION_START ? 'before' : now < RECEPTION_END ? 'event-day' : 'ended';
  return `freetiful-popup-seen-session:reception-2026:${phase}`;
}

export function nextHomePromoBoundary(now = Date.now()) {
  return [RECEPTION_START, RECEPTION_END].find((boundary) => boundary > now) ?? null;
}
