import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WELCOME_MISSION_OPEN_TO_ALL, WELCOME_MISSION_START, isWelcomeMissionPost, isWelcomeMissionUser, kstDay, maskAccount, parseWelcomeClaim } from './welcome-mission.rules';

test('KST 날짜 — 자정 경계', () => {
  assert.equal(kstDay(new Date('2026-11-10T14:59:59Z')), '2026-11-10');
  assert.equal(kstDay(new Date('2026-11-10T15:00:00Z')), '2026-11-11');
});

test('신규가입자 — 시작 이후 가입 · 관리자 · 탈퇴 제외', () => {
  const after = new Date(WELCOME_MISSION_START.getTime() + 1000);
  assert.equal(isWelcomeMissionUser({ createdAt: after, role: 'general' }), true);
  assert.equal(isWelcomeMissionUser({ createdAt: after, role: 'pro' }), true);
  assert.equal(isWelcomeMissionUser({ createdAt: new Date(WELCOME_MISSION_START.getTime() - 1000), role: 'general' }), WELCOME_MISSION_OPEN_TO_ALL);
  assert.equal(isWelcomeMissionUser({ createdAt: after, role: 'admin' }), false);
  assert.equal(isWelcomeMissionUser({ createdAt: after, role: 'general', deletedAt: new Date() }), false);
});

test('웨딩숲 미션 글 — 알맹이 30자 이상 · 장난 글 제외', () => {
  assert.equal(isWelcomeMissionPost('결혼식 사회자 고민 중인데 다들 어떻게 고르셨나요? 후기 많이 보고 결정하려고요'), true);
  assert.equal(isWelcomeMissionPost('다음 달 결혼하는데 사회자 견적 받아보신 분들 대략 얼마 정도 나왔는지 궁금해요!'), true);
  assert.equal(isWelcomeMissionPost('청첩장 돌릴 때 이름 꼭 써야 하나요 친구들이 서운해하더라고요ㅠㅠ'), true); // 띄어쓰기 포함 30자 넘음
  assert.equal(isWelcomeMissionPost('예식장 정했어요 사회자도 구해야 하는데'), false); // 30자 안 됨
  assert.equal(isWelcomeMissionPost('예식장 정했어요!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'), false); // 문장부호는 안 셈
  assert.equal(isWelcomeMissionPost('아아아아아앙이미미밈'.repeat(5)), false);
  assert.equal(isWelcomeMissionPost('아아아아아앙 이미미밈 아앙아앙 미미밈 이이이 아아앙 밈밈 이미 아아아 앙앙앙 미밈미밈 이미이미 아아'), false);
  assert.equal(isWelcomeMissionPost('가나다라마바사아자차카타파하'.repeat(4)), false);
  assert.equal(isWelcomeMissionPost('ㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋ 좋아요'), false);
  assert.equal(isWelcomeMissionPost('좋아요 '.repeat(20)), false);
  assert.equal(isWelcomeMissionPost('asdfasdfasdfqwerqwerqwerzxcvzxcv1234123412341234'), false);
  assert.equal(isWelcomeMissionPost('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!'), false);
  assert.equal(isWelcomeMissionPost(null), false);
});

test('지급 신청 입력', () => {
  assert.deepEqual(parseWelcomeClaim({ phone: '010-1234-5678', bankName: ' 국민은행 ', accountNumber: '123-45-678901', accountHolder: '김 프리' }), {
    phone: '01012345678',
    bankName: '국민은행',
    accountNumber: '12345678901',
    accountHolder: '김 프리',
  });
  assert.equal(parseWelcomeClaim({ phone: '02-123-4567', bankName: '국민', accountNumber: '12345678', accountHolder: '김' }), '연락처를 확인해 주세요.');
  assert.equal(parseWelcomeClaim({ phone: '01012345678', bankName: '', accountNumber: '12345678', accountHolder: '김' }), '은행을 골라 주세요.');
  assert.equal(parseWelcomeClaim({ phone: '01012345678', bankName: '국민', accountNumber: '1234', accountHolder: '김' }), '계좌번호를 확인해 주세요.');
  assert.equal(parseWelcomeClaim({ phone: '01012345678', bankName: '국민', accountNumber: '12345678', accountHolder: ' ' }), '예금주를 입력해 주세요.');
  assert.equal(maskAccount('12345678901'), '••••••8901');
});
