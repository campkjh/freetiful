import { AVATAR_ANIMALS, EXTRA_ANIMALS, MODIFIERS } from './community-nickname';

/**
 * 운영 프로필(운영팀 이름) 공용 규칙(261004) — 어드민 운영 프로필 · 앱 '운영진 에디터 이름 바꾸기'가 같이 쓴다.
 *  · 앱의 글·댓글에 늘 OPERATOR_ROLE_LABEL 표시 → 운영 글이 회원 글처럼 보이지 않는다.
 *  · 이름은 회원·예비부부·사회자처럼 보이면 안 되고, 회원 닉네임('꾸밈말 동물') 모양도 안 된다(실제 회원과 헷갈림·사칭 방지).
 */
export const OPERATOR_ROLE_LABEL = '운영팀';

/** 운영 프로필 이름에 못 쓰는 말 — 회원·예비부부·사회자(판매자)처럼 보이면 안 된다 */
export const OPERATOR_NAME_BLOCK = /사회자|엠씨|\bmc\b|회원|고객|이용자|신부|신랑|예비|부부|커플|후기|탈퇴한/i;

/** 회원 닉네임('꾸밈말 동물')과 같은 모양인지 */
export function looksLikeMemberNickname(name: string): boolean {
  return [...AVATAR_ANIMALS, ...EXTRA_ANIMALS].some((animal) => name.endsWith(` ${animal}`) && MODIFIERS.includes(name.slice(0, -(animal.length + 1))));
}

/** 이름 형식 검사 — 문제가 있으면 사람이 읽을 이유, 없으면 null */
export function operatorNameProblem(raw: unknown): string | null {
  const name = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > 16) return '이름은 2~16자로 정해 주세요';
  if (!/^[가-힣a-zA-Z0-9 ._-]+$/.test(name)) return '한글·영문·숫자와 . _ - 만 쓸 수 있어요';
  if (OPERATOR_NAME_BLOCK.test(name)) return '회원·예비부부·사회자로 보일 수 있는 말은 쓸 수 없어요';
  if (looksLikeMemberNickname(name)) return '회원 닉네임과 같은 모양(꾸밈말 + 동물)은 쓸 수 없어요';
  return null;
}

export const normalizeOperatorName = (raw: unknown) => String(raw ?? '').replace(/\s+/g, ' ').trim();

/** 회원 웨딩숲 닉네임에 못 쓰는 말 — 운영진·사회자로 보이면 안 된다(허용 계정 직접 정하기·관리자 변경 같은 규칙) */
export const MEMBER_NICKNAME_BLOCK = /프리티풀|freetiful|운영|관리자|어드민|admin|에디터|공식|사회자|탈퇴한/i;

/** 회원 닉네임 형식 검사 — 문제가 있으면 이유, 없으면 null */
export function memberNicknameProblem(raw: unknown): string | null {
  const nickname = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (nickname.length < 2 || nickname.length > 12) return '닉네임은 2~12자로 정해 주세요';
  if (!/^[가-힣a-zA-Z0-9 ._-]+$/.test(nickname)) return '한글·영문·숫자와 . _ - 만 쓸 수 있어요';
  if (MEMBER_NICKNAME_BLOCK.test(nickname)) return '운영진이나 사회자로 보일 수 있는 이름은 쓸 수 없어요';
  return null;
}

/** 운영 글 상태 */
export const POST_STATUSES = ['published', 'draft', 'scheduled', 'private'] as const;
export type PostStatus = (typeof POST_STATUSES)[number];
