/**
 * 신규가입 5,000원 미션 규칙(261110 사장 '신규가입자에 한해서 5,000원 미션 — 출석체크 2번 · 웨딩숲 1회 작성 · 견적 1회 전송,
 * 연락처 · 계좌번호 · 예금주 · 은행명 입력하면 받게').
 *  · 신규가입자 = 미션을 연 날(2026-11-10 KST) 이후에 가입한 계정. 관리자 · 탈퇴 계정 제외.
 *  · 출석 = 미션 화면을 연 날(KST) 하루 한 번(user_attendances). 연속일 필요 없음.
 *  · 웨딩숲 = 내가 쓴 글(보이는 글만 — 숨김 · 블라인드 제외) 중 알맹이 30자 이상 · 장난 글 아닌 것(isWelcomeMissionPost). 인정된 첫 글은 본인이 못 지운다.
 *  · 견적 = 고객은 견적 요청을 보낸 것(match_requests), 사회자는 견적서를 보낸 것(quotations) — 둘 중 하나.
 *  · 지급 = 운영자가 계좌로 직접 보낸다(어드민 '신규가입 미션'). 계정당 1번, 같은 연락처 · 계좌로 다른 계정이 또 받을 수 없다.
 */
export const WELCOME_MISSION_REWARD = 5000;
export const WELCOME_MISSION_START = new Date('2026-11-10T00:00:00+09:00');
export const WELCOME_MISSION_REQUIRED = { attendance: 2, post: 1, quote: 1 } as const;
/** 테스트 기간 — 가입일 상관없이 관리자 빼고 전원 참여(261110 사장 '11월10일 이후가 아니라 전부 다 받을 수 있게, 테스트로'). 끝낼 땐 false — 웹 lib/api/mission.api.ts 도 같이 */
export const WELCOME_MISSION_OPEN_TO_ALL = true;
/** 웨딩숲 글로 인정되는 알맹이 글자 수(261110 사장 '적어도 30자 이상') */
export const WELCOME_POST_MIN_CHARS = 30;

const KST_MS = 9 * 3600_000;

/** KST 날짜 'YYYY-MM-DD' */
export function kstDay(at: Date = new Date()) {
  return new Date(at.getTime() + KST_MS).toISOString().slice(0, 10);
}

export function isWelcomeMissionUser(u: { createdAt: Date; role: string; deletedAt?: Date | null; isActive?: boolean }) {
  return (WELCOME_MISSION_OPEN_TO_ALL || u.createdAt >= WELCOME_MISSION_START) && u.role !== 'admin' && !u.deletedAt && u.isActive !== false;
}

/** 글 · 견적을 세기 시작하는 때 — 가입 시각과 미션 시작 중 늦은 쪽(옛 회원은 미션 시작부터) */
export const welcomeMissionSince = (createdAt: Date) => (createdAt > WELCOME_MISSION_START ? createdAt : WELCOME_MISSION_START);

/**
 * 웨딩숲 미션으로 인정되는 글인가 — 261110 사장 '30자 이상, 아아아아아앙이미미밈 같은 글은 못 받게'.
 *  · 알맹이 = 링크 · 낱자(ㅋㅋ · ㅠㅠ · ㅁㄴㅇㄹ) · 문장부호 · 이모지를 빼고, 같은 글자 3번 넘게 이어지면 2번으로, 띄어쓰기는 한 칸으로 줄인 것 → 30자 이상
 *    (띄어쓰기 포함 — 사람이 세는 글자 수와 맞춘다. 빼고 세면 보통 글도 28자 안팎에서 많이 떨어졌다, 운영 글 243개로 확인).
 *  · 장난 글 = 띄어쓰기 뺀 앞 100자 안에서 쓴 글자 종류가 너무 적거나(아 · 앙 · 이 · 미 · 밈) 같은 묶음이 되풀이(가나다라가나다라)되는 글.
 */
export function isWelcomeMissionPost(content: string | null | undefined) {
  const text = (content || '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[ㄱ-ㅎㅏ-ㅣ]/g, '')
    .replace(/[\p{P}\p{S}\p{M}\p{C}]/gu, '')
    .replace(/(\S)\1{2,}/gu, '$1$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (Array.from(text).length < WELCOME_POST_MIN_CHARS) return false;
  const head = Array.from(text.replace(/ /g, '')).slice(0, 100);
  const kinds = new Set(head).size;
  const pairs = new Set(head.slice(1).map((c, i) => head[i] + c)).size;
  return kinds >= 12 && kinds / head.length >= 0.3 && pairs / (head.length - 1) >= 0.5;
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

/* ─── 시크릿 미션(261118 사장 '5000원 미션완료하면 신규미션 — 인스타그램 스토리에 프리티풀을 태그해서 올려주면 추첨을 통해 4만원 상당의 화장품 세트') ───
 *  · 열림 = 5,000원 미션(출석 2 · 글 1 · 견적 1)을 다 한 계정. 5,000원 신청 여부와는 상관없다.
 *  · 응모 = 인스타 아이디 + 스토리 캡처 1장(계정당 1번, 반려되면 다시). 추첨 · 당첨 표시는 운영팀이 어드민에서. */
export const SECRET_MISSION_PRIZE = '4만원 상당 화장품 세트';
/** 태그할 프리티풀 인스타 계정(웹 /biz 와 같은 계정) */
export const SECRET_MISSION_INSTAGRAM = 'freetiful_';
/** entered(응모) | won(당첨) | rejected(반려 — 다시 응모 가능) */
export const SECRET_ENTRY_STATUSES = ['entered', 'won', 'rejected'] as const;
export const SECRET_PHOTO_MAX_BYTES = 15 * 1024 * 1024;
export const SECRET_PHOTO_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];

/** 인스타 아이디 — '@아이디' · 프로필 주소를 붙여 넣어도 아이디만. 영문 소문자 · 숫자 · 마침표 · 밑줄 30자(인스타 규칙) — 틀리면 이유 문자열 */
export function parseInstagramId(v: unknown): { instagramId: string } | string {
  let s = typeof v === 'string' ? v.trim() : '';
  s = s.replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, '').replace(/[/?#].*$/, '').replace(/^@+/, '').toLowerCase();
  if (!s) return '인스타그램 아이디를 입력해 주세요.';
  if (!/^[a-z0-9._]{1,30}$/.test(s) || s.startsWith('.') || s.endsWith('.') || s.includes('..')) return '인스타그램 아이디를 확인해 주세요.';
  return { instagramId: s };
}
