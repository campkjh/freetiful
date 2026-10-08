/**
 * 점검용 '테스트 의뢰' 계정 — 이 계정이 낸 의뢰는 사회자에게 내보내지 않는다(MatchService.isTestLead).
 * 웹 apps/web/src/lib/test-lead.ts 의 TEST_LEAD_USER_IDS 와 같게 유지할 것
 * (웹은 신청 전 '사회자에게 안 가요' 알약·픽셀 Lead·전환 기록을 이걸로 거른다. 완료 화면·시트 표시는 서버 응답 suppressedAsTestLead 기준).
 *
 * 의뢰(MatchDelivery) 밖의 길 — 채팅방 만들기(createRoom)·고객 쪽 메시지(sendMessage)도 ChatService 가 이걸로 막는다(261008).
 */
export const TEST_LEAD_USER_IDS: ReadonlySet<string> = new Set<string>([
  'a7c23078-a2cd-4643-87c0-c9292321bc3b', // 사회자 김정현(campkjh@nate.com) — 랜딩 점검용
  'abe4d5ef-7331-4fcc-be36-fe1ec079c2cf', // 고객 박수용(cjpsyjp@hanmail.net) — 퀵매칭 고객 흐름 점검용(261008 사장)
]);

export function isTestLeadUserId(userId?: string | null): boolean {
  return !!userId && TEST_LEAD_USER_IDS.has(userId);
}
