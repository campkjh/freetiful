/**
 * 신규가입 5,000원 미션 규칙(261110 사장 '신규가입자에 한해서 5,000원 미션 — 출석체크 2번 · 웨딩숲 1회 작성 · 견적 1회 전송,
 * 연락처 · 계좌번호 · 예금주 · 은행명 입력하면 받게').
 *  · 신규가입자 = 미션을 연 날(2026-11-10 KST) 이후에 가입한 계정. 관리자 · 탈퇴 계정 제외.
 *  · 출석 = 미션 화면을 연 날(KST) 하루 한 번(user_attendances). 연속일 필요 없음.
 *  · 웨딩숲 = 내가 쓴 글(보이는 글만 — 숨김 · 블라인드 제외).
 *  · 견적 = 고객은 견적 요청을 보낸 것(match_requests), 사회자는 견적서를 보낸 것(quotations) — 둘 중 하나.
 *  · 지급 = 운영자가 계좌로 직접 보낸다(어드민 '신규가입 미션'). 계정당 1번, 같은 연락처 · 계좌로 다른 계정이 또 받을 수 없다.
 */
export const WELCOME_MISSION_REWARD = 5000;
export const WELCOME_MISSION_START = new Date('2026-11-10T00:00:00+09:00');
export const WELCOME_MISSION_REQUIRED = { attendance: 2, post: 1, quote: 1 } as const;

const KST_MS = 9 * 3600_000;

/** KST 날짜 'YYYY-MM-DD' */
export function kstDay(at: Date = new Date()) {
  return new Date(at.getTime() + KST_MS).toISOString().slice(0, 10);
}

export function isWelcomeMissionUser(u: { createdAt: Date; role: string; deletedAt?: Date | null; isActive?: boolean }) {
  return u.createdAt >= WELCOME_MISSION_START && u.role !== 'admin' && !u.deletedAt && u.isActive !== false;
}

export interface WelcomeClaimInput {
  phone: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** 지급 신청 입력 검사 — 틀리면 이유 문자열. 연락처 · 계좌번호는 숫자만 남긴다 */
export function parseWelcomeClaim(body: unknown): WelcomeClaimInput | string {
  const o = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const phone = String(o.phone ?? '').replace(/[^0-9]/g, '');
  if (!/^01[0-9]{8,9}$/.test(phone)) return '연락처를 확인해 주세요.';
  const bankName = clean(o.bankName, 20);
  if (!bankName) return '은행을 골라 주세요.';
  const accountNumber = String(o.accountNumber ?? '').replace(/[^0-9]/g, '');
  if (accountNumber.length < 8 || accountNumber.length > 20) return '계좌번호를 확인해 주세요.';
  const accountHolder = clean(o.accountHolder, 20);
  if (!accountHolder) return '예금주를 입력해 주세요.';
  return { phone, bankName, accountNumber, accountHolder };
}

/** 화면에 보일 계좌 — 뒤 4자리만 */
export const maskAccount = (n: string) => (n.length <= 4 ? n : `${'•'.repeat(Math.min(6, n.length - 4))}${n.slice(-4)}`);
