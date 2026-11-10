import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WELCOME_MISSION_START, isWelcomeMissionUser, kstDay, maskAccount, parseWelcomeClaim } from './welcome-mission.rules';

test('KST 날짜 — 자정 경계', () => {
  assert.equal(kstDay(new Date('2026-11-10T14:59:59Z')), '2026-11-10');
  assert.equal(kstDay(new Date('2026-11-10T15:00:00Z')), '2026-11-11');
});

test('신규가입자 — 시작 이후 가입 · 관리자 · 탈퇴 제외', () => {
  const after = new Date(WELCOME_MISSION_START.getTime() + 1000);
  assert.equal(isWelcomeMissionUser({ createdAt: after, role: 'general' }), true);
  assert.equal(isWelcomeMissionUser({ createdAt: after, role: 'pro' }), true);
  assert.equal(isWelcomeMissionUser({ createdAt: new Date(WELCOME_MISSION_START.getTime() - 1000), role: 'general' }), false);
  assert.equal(isWelcomeMissionUser({ createdAt: after, role: 'admin' }), false);
  assert.equal(isWelcomeMissionUser({ createdAt: after, role: 'general', deletedAt: new Date() }), false);
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
