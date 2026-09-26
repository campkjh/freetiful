/**
 * 퀵매칭(/quick-match) 사회자 명단 — 260927 사장 지시.
 *
 * FEATURED(지정 사회자): 퀵매칭 첫 화면(리롤 전)에 나오는 사회자. 이 사람들에게 간 퀵매칭 신청에만 고객 전화번호가 보인다
 *   (사회자 새요청 목록·채팅방 머리 칩). 리롤 뒤에 나온 사회자에게 간 신청은 번호 없이 프리티풀 채팅으로만 이어진다.
 *   성별 묶음은 사장이 준 명단 그대로다 — 이도윤은 프로필 성별이 '여성'으로 저장돼 있지만 남성 명단.
 *
 * EXCLUDED(매칭 제외): 퀵매칭 후보에도, 다수견적(모든 사회자에게 보내는 요청)에도 안 잡힌다.
 *   고객이 프로필에서 직접 골라 보낸 1:1 문의는 막지 않는다. '서나영'은 사회자 계정에 없어 '서나웅'으로 본다.
 */
export const QUICK_MATCH_SOURCE = 'landing_quick_match';

export const QUICK_MATCH_FEATURED: { male: string[]; female: string[] } = {
  male: [
    'bcbc3d81-27e1-4eea-9ddc-358c728d7c96', // 김병국
    '9bded78a-431c-4b85-8a9d-fd2b61c1ff2e', // 조동호
    '44aaf9df-fd3b-4a2f-805a-3da588c5799a', // 전준배
    '163fc6dd-20f0-4549-ae0a-c86ca6c7c7bd', // 전승민
    '52af21ac-b707-4cec-94da-0bba1b729ed8', // 노유재
    'ebd7e017-acdb-41ea-bb36-e069369d23e5', // 이도윤
  ],
  female: [
    '6fb8f628-7549-44e6-8136-71d74c937d75', // 이승진
    'd35e3cf7-5885-43e2-832e-dcc0b1f50c2f', // 나연지
    'b9d1ba06-882d-437f-a072-7eb8b8056f27', // 문정은
    '63a96e5f-7c1e-4106-80ab-e1d4e2a8d04a', // 심수의
    '9df27318-94c4-4877-8971-b921746b36b8', // 김규연
    '1ae2c8d3-8b11-4e02-8296-5a3e348c0b73', // 김솔
  ],
};

export const QUICK_MATCH_FEATURED_IDS = new Set<string>([...QUICK_MATCH_FEATURED.male, ...QUICK_MATCH_FEATURED.female]);

export const MATCH_EXCLUDED_PRO_IDS = new Set<string>([
  '3fb7b78c-026f-401f-a00c-f8d1719c92ed', // 서나웅(요청 문구 '서나영')
  '2cab2cf0-e7a9-449c-b99c-c9285371f04f', // 김정현(랜딩 점검용 계정)
  '629acc98-a92a-46b0-a79a-5a069cf434fa', // 황지애
]);

type Raw = Record<string, unknown>;

function asRaw(raw: unknown): Raw | null {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Raw) : null;
}

/** 이 사회자에게 고객 번호를 보여 줘도 되는 요청이면 번호(숫자만), 아니면 null */
export function sharedCustomerPhone(raw: unknown, proProfileId: string | null | undefined): string | null {
  const r = asRaw(raw);
  if (!r || !proProfileId) return null;
  const ids = Array.isArray(r.phoneSharedProProfileIds) ? r.phoneSharedProProfileIds : [];
  if (!ids.includes(proProfileId)) return null;
  const phone = String(r.phone ?? '').replace(/[^0-9]/g, '');
  return phone.length >= 9 ? phone : null;
}

/** 고객이 고른 연락 방식(퀵매칭: 전화/문자/프리티풀 채팅) */
export function customerContactMethod(raw: unknown): string | null {
  const r = asRaw(raw);
  const v = r ? String(r.contactMethod ?? '').trim() : '';
  return v || null;
}

/**
 * 사회자 쪽 응답에 싣는 rawUserInput — 고객이 폼에 적은 전화번호를 뺀다.
 * 화면에선 안 쓰지만 응답에 그대로 실려 개발자 도구로 볼 수 있었다. 번호 공유 대상이면 customerPhone 으로 따로 준다.
 */
export function rawForPro(raw: unknown): unknown {
  const r = asRaw(raw);
  if (!r) return raw;
  const { phone: _phone, phoneSharedProProfileIds: _shared, ...rest } = r;
  return rest;
}
