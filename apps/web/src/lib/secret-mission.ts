// 시크릿 미션(261118) 열림 모달을 띄우는 신호 — 루트의 MissionTaskHost 가 받아서 그린다(SecretMissionReveal).
// 5,000원 미션을 다 하는 순간(첫 글 · 첫 견적 오버레이 · 홈 출석 2일차)엔 maybeRevealSecret = 기기에서 하루 한 번.
// 미션 화면(이벤트 화면)은 들어올 때마다 revealSecret — 응모할 때까지 계속(261118 사장 '이벤트페이지 들어가면 이행할 때까지 계속 뜨게').
// 응모(반려 빼고)하면 어디서도 안 뜬다. 미션 화면 ?reveal=1 = 응모 여부와 상관없이 미리보기.
import { missionLocalKey, type WelcomeMissionStatus } from '@/lib/api/mission.api';
import { useAuthStore } from '@/lib/store/auth.store';

export const SECRET_REVEAL_EVENT = 'freetiful:secret-reveal';
export const SECRET_PRIZE = '4만원 상당 화장품 세트';
export const SECRET_INSTAGRAM = 'freetiful_';

const seenKey = (today: string) => missionLocalKey('secret', `${useAuthStore.getState().user?.id || 'guest'}:${today}`);

/** 응모 전이고 열린 상태인가 — 옛 API(secret 없음)면 completed 로 판단 */
export function secretReady(st: Pick<WelcomeMissionStatus, 'eligible' | 'completed' | 'secret'> | null | undefined) {
  if (!st?.eligible || !st.completed) return false;
  const e = st.secret?.entry;
  return !e || e.status === 'rejected';
}

/** 오늘 이 기기에서 아직 안 띄웠으면 띄운다. 띄웠으면 true */
export function maybeRevealSecret(st: Pick<WelcomeMissionStatus, 'eligible' | 'completed' | 'secret' | 'today'> | null | undefined, delay = 0) {
  if (typeof window === 'undefined' || !secretReady(st)) return false;
  const key = seenKey(st!.today);
  try {
    if (localStorage.getItem(key)) return false;
    localStorage.setItem(key, '1');
  } catch {}
  window.setTimeout(() => window.dispatchEvent(new Event(SECRET_REVEAL_EVENT)), delay);
  return true;
}

/** 기록 없이 바로(미리보기 · 카드에서 다시 보기) */
export function revealSecret() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SECRET_REVEAL_EVENT));
}
