// 신규가입 미션 칸이 될 수 있는 일(웨딩숲 글 · 견적 요청/견적서)이 서버에 들어갔다는 신호.
// 글쓰기 · 견적 화면이 여러 개라(글쓰기 페이지 · 피드 글쓰기 칸 · 작성 모달 …) 화면마다 부르지 않고 길목(apiClient · cfetch)에서 한 번 쏜다
// → 루트의 MissionTaskHost 가 받아 celebrateMissionTask 로 '첫 번째'인지 보고 그라데이션 오버레이를 띄운다(261111 사장 '글 쓰면 모달 나와서 체크, 견적도').
// 가져오는 것 없음 — apiClient 가 이 파일을 불러도 순환이 안 생기게.
export type MissionSentKind = 'post' | 'quote';
export const MISSION_SENT_EVENT = 'freetiful:mission-sent';

export function noteMissionSent(kind: MissionSentKind) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<MissionSentKind>(MISSION_SENT_EVENT, { detail: kind }));
}
