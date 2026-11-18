// 시크릿 미션(261118) 열림 모달을 띄우는 신호 — 루트의 MissionTaskHost 가 받아서 그린다(SecretMissionReveal).
// 5,000원 미션을 다 하는 순간(첫 글 · 첫 견적 오버레이, 홈 · 미션 화면 출석 2일차)과 미션 화면에 들어올 때 부른다.
// 같은 기기에서 하루 한 번만(응모하면 더 안 뜬다). ?reveal=1 은 기록 없이 바로 띄우는 미리보기.
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
