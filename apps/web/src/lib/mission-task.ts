import { useAuthStore } from '@/lib/store/auth.store';
import { isAdminUser } from '@/lib/admin-access';
import { missionApi, WELCOME_MISSION_START, type WelcomeMissionStatus } from '@/lib/api/mission.api';

// 첫 웨딩숲 글·첫 견적을 보낸 순간 출석 오버레이에서 그 칸(글쓰기/견적)이 채워지게(261110 사장 '첫 글쓰기 했을 때 모달 올라오면 글쓰기 체크되게, 견적도').
//  · 보낸 곳(글쓰기·퀵매칭·사회자 상세 문의·홈 간편 요청·채팅 견적서)이 성공 뒤 celebrateMissionTask 를 부른다.
//  · 서버 상태로 '이번 것이 첫 번째'(필요 수에 막 닿음)인지 보고 이벤트를 쏘면 루트의 MissionTaskHost 가 그린다 — 페이지를 옮겨도 그 위에 뜬다.
//  · 기기·계정·칸마다 한 번만(localStorage). 이미 상금 신청했으면 안 띄움.
export type MissionTaskKind = 'post' | 'quote';
export type MissionTaskDetail = { kind: MissionTaskKind; status: WelcomeMissionStatus };
export const MISSION_TASK_EVENT = 'freetiful:mission-task';

export function celebrateMissionTask(kind: MissionTaskKind) {
  const me = useAuthStore.getState().user as ({ id?: string; createdAt?: string | null; role?: string | null; email?: string | null } | null);
  if (!me?.id || me.role === 'admin' || isAdminUser(me)) return;
  if (me.createdAt && Date.parse(me.createdAt) < WELCOME_MISSION_START) return;
  const key = `freetiful-mission-task:${me.id}:${kind}`;
  try { if (localStorage.getItem(key)) return; } catch {}
  missionApi
    .status()
    .then((st) => {
      const c = st[kind];
      if (!st.eligible || c.count !== c.required || (st.claim && st.claim.status !== 'rejected')) return;
      try { localStorage.setItem(key, '1'); } catch {}
      window.dispatchEvent(new CustomEvent<MissionTaskDetail>(MISSION_TASK_EVENT, { detail: { kind, status: st } }));
    })
    .catch(() => undefined);
}
