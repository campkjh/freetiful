// 점검용 '테스트 신청' 판정 — 랜딩(wedding-mc)·퀵매칭 공용.
// 서버(apps/api match.service.ts isTestLead)가 같은 규칙으로 사회자 발송(MatchDelivery)을 막는다 — 단 서버는 Authorization 토큰으로 계정을 안다.
// 웹의 이 판정은 '짐작'이다(브라우저 저장소의 user): 신청 전 안내·픽셀 Lead·전환 기록 생략에만 쓰고,
// '사회자에게 안 갔다'는 표시(완료 화면·시트 [테스트])는 서버 응답 matchRequest.rawUserInput.suppressedAsTestLead 로 정한다.

/** 점검용 계정 — 서버 apps/api/src/match/test-lead.ts 의 TEST_LEAD_USER_IDS 와 같게 유지할 것 */
export const TEST_LEAD_USER_IDS = [
  'a7c23078-a2cd-4643-87c0-c9292321bc3b', // 사회자 김정현(campkjh@nate.com) — 랜딩 점검용
  'abe4d5ef-7331-4fcc-be36-fe1ec079c2cf', // 고객 박수용(cjpsyjp@hanmail.net) — 퀵매칭 고객 흐름 점검용(261008 사장)
];

/** 공백 제거 후 정확히 '테스트'/'test' 이거나 점검용 계정일 때만 — includes() 로 넓히면 '김테스트' 같은 실제 이름이 걸린다 */
export function isTestLeadSubmission(name: string | null | undefined, userId?: string | null): boolean {
  if (userId && TEST_LEAD_USER_IDS.includes(userId)) return true;
  const s = String(name ?? '').replace(/\s/g, '');
  return s === '테스트' || s.toLowerCase() === 'test';
}
