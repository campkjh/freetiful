'use client';

// 웨딩런 랭킹 데이터 모듈(261011 사장 '랭킹은 나중에 서버를 연결할 수 있도록 별도 데이터 모듈로 분리 —
//   실제 랭킹 서버가 연결되지 않았다면 가짜 참여자와 순위를 실제 데이터처럼 표시하지 않는다. 랭킹 준비 중 + 개인 최고기록')
//  · lib/api/wedding-run.api.ts(서버 호출)를 감싸 '서버를 쓸 수 있는지'를 판단한다.
//    - 404·네트워크 실패·5xx·시간 초과 = 'unavailable'(랭킹 준비 중). 가짜 순위는 어디에서도 만들지 않는다.
//    - 400(검증 실패)은 서버는 살아 있는 것 — 이번 기록만 못 올린 것으로 따로 알린다.
//  · 한 판 = 세션 토큰 하나. 서버가 '달린 시간 ≤ 지금 - 세션 시작 + 2초' 를 보므로 세션은 판 시작 전에 미리 받아 둔다
//    (준비 완료·판 종료 때 다음 판 것을 미리). 서버 세션 수명은 30분(game.constants.ts WR_SESSION_TTL_MS).
//    (261011 검증 반영) 미리 받은 토큰이 1분보다 오래됐으면 판 시작 때 새로 받아 1.5초 안에 오면 바꿔 낀다(옛 토큰은 서버에서 닫음)
//    — 예전엔 10분 묵은 토큰을 그대로 써서 벽시계 20분을 넘긴 판(= 가장 잘한 판)이 '세션이 만료됐어요'로 빠졌다.
//    그만둔 판(홈·일시정지 중 다시 도전)과 페이지를 떠날 때의 안 쓴 토큰은 서버 sessions/abandon 으로 닫는다(같은 IP 열린 판 상한).
//    세션 요청이 429(요청 몰림)면 그 판은 '요청이 몰려 미등록'으로 따로 알린다(예전엔 '서버 연결이 늦었어요'로 잘못 안내).
//  · 닉네임 기본값 = 웨딩숲 '꾸밈말 동물' 생성기(lib/community/nickname.ts)를 기기 id 로 고정 — 서버 기본값과 같은 입력('wr:' + 기기 id).
import { wrApi, WrApiError, wrErrorMessage, type WrLeaderboard, type WrPeriod, type WrPublicScore, type WrSubmitRes } from '@/lib/api/wedding-run.api';
import { AVATAR_ANIMALS, EXTRA_ANIMALS, MODIFIERS, communityNickname } from '@/lib/community/nickname';
import { useAuthStore } from '@/lib/store/auth.store';
import { getDeviceId, getNicknameOwner, getNicknameReset, getSavedNickname, saveNickname, setNicknameOwner, setNicknameReset } from './ui/storage';
import type { WRResult } from './ui/types';

export type { WrLeaderboard, WrPeriod, WrPublicScore, WrSubmitRes };

export type RankingAvailability = 'unknown' | 'available' | 'unavailable';

/** 404·네트워크·5xx·시간 초과 = 서버 없음으로 본다 */
export function isServerMissing(e: unknown): boolean {
  if (e instanceof WrApiError) return e.status === 404 || e.status >= 500 || e.status === 0;
  return true; // fetch 실패(TypeError)·AbortError
}

let availability: RankingAvailability = 'unknown';
const listeners = new Set<(a: RankingAvailability) => void>();

function setAvailability(a: RankingAvailability) {
  if (availability === a) return;
  availability = a;
  listeners.forEach((fn) => fn(a));
}

export function getAvailability(): RankingAvailability {
  return availability;
}

export function onAvailability(fn: (a: RankingAvailability) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ── 닉네임 ──

/** 기본 닉네임 — 기기 id 로 고정한 '꾸밈말 동물'(이름·사진을 넘기지 않아 실명이 나올 수 없다) */
export function defaultNickname(deviceId = getDeviceId()): string {
  return communityNickname({ id: `wr:${deviceId}`, role: 'general', name: null, profileImageUrl: null });
}

/** 지금 계정 키(로그인 = 'u:<id>', 아니면 'guest') — 서버 playerKey 와 같은 기준 */
function accountKey(): string {
  try {
    const id = useAuthStore.getState().user?.id;
    return id ? `u:${id}` : 'guest';
  } catch {
    return 'guest';
  }
}

/** 기기에 저장된 닉네임 값이 지금 계정 것인가(예전 저장값은 주인 표시가 없어 그대로 인정) */
function savedIsMine(): boolean {
  const owner = getNicknameOwner();
  return !owner || owner === accountKey();
}

/**
 * 로그인 전(손님)에 이 기기에서 정한 이름을 막 로그인한 계정으로 옮기는 중인가 — (261011 검증 E4 부작용) 예전엔 손님 이름이 첫 기록 때 버려지고
 * 기본 이름으로 바뀌었다. 이때는 '계정에 직접 정한 이름이 없을 때만' 쓰라고(nicknameSoft) 서버에 한 번 보낸다(계정 이름이 있으면 그대로).
 */
function savedIsGuestCarry(): boolean {
  return getNicknameOwner() === 'guest' && accountKey() !== 'guest' && !!getSavedNickname();
}

export function currentNickname(): string {
  // (261011 검증 E4) 다른 계정이 정한 이름은 보내지 않는다 — 기본 이름을 보내면 서버가 이 계정 이름을 유지하고, 응답으로 기기 값을 맞춘다
  const saved = savedIsMine() || savedIsGuestCarry() ? getSavedNickname() : null;
  return saved || defaultNickname();
}

/** 되돌리기 대기 — 지금 계정 것만 */
function pendingReset(): boolean {
  return savedIsMine() && getNicknameReset();
}

function saveMine(nick: string, reset: boolean) {
  saveNickname(nick);
  setNicknameReset(reset);
  setNicknameOwner(accountKey());
}

/* 닉네임 검사 — 서버 apps/api/src/game/game-nickname.ts checkWeddingRunNickname 과 같은 규칙(261011 통합: 서버 보강 규칙을 그대로 옮김)
 *   ① 제어·서식·보이지 않는 글자 거부 ② 표시용 정리(NFC·전각→반각·공백 하나) ③ 2~12자 ④ 허용 글자만(한글·자모·영숫자·공백·기호 몇 개·이모지)
 *   ⑤ 주소·연락처 거부 ⑥ 금칙어(NFKC·숫자 끼우기·숫자→글자 바꾸기까지) ⑦ 기본 닉네임 모양('꾸밈말 동물')은 직접 정할 수 없음(내 기본 이름은 '기본값으로')
 * 최종 판단은 서버(같은 이름 금지 포함) — 여기는 입력 칸 안내용. 서버가 거절하면 기록은 받고 지금 이름을 유지한다.
 * (\p{…}·\u{…} 는 tsconfig target(ES2017) 때문에 문자열로 만든다. 옛 브라우저가 못 읽는 식이면 null → 그 검사만 건너뜀) */
function re(src: string, flags: string): RegExp | null {
  try {
    return new RegExp(src, flags);
  } catch {
    return null;
  }
}
const BANNED_RAW = [
  // 욕설
  '시발', '씨발', '씨빨', '시빨', '씨바', '씨팔', '시팔', '씨벌', '십새', '씹', 'ㅅㅂ', 'ㅆㅂ', 'ㅅㅂㄹㅁ',
  '병신', '븅신', '빙신', '병쉰', 'ㅂㅅ', 'ㅄ', '개새', '개색', '개쉑', '개세끼', 'ㄱㅅㄲ', '좆', '좃', '존나', '졸라', 'ㅈㄴ',
  '썅', '쌍년', '니미', '느금', '느개비', '니애미', '엠창', '지랄', '염병', '미친놈', '미친년', '또라이', '닥쳐', '꺼져', '뒤져',
  // 성적 표현
  '섹스', '섹파', '보지', '자지', '자위', '야동', '빠구리', '창녀', '걸레', '성매매', '조건만남', '원나잇',
  'fuck', 'fck', 'fuk', 'fxck', 'shit', 'bitch', 'dick', 'pussy', 'cunt', 'porn', 'sex', 'slut', 'whore', 'milf',
  // 혐오
  '한남충', '김치녀', '된장녀', '틀딱', 'nigger', 'nigga', 'nazi', 'hitler',
  // 운영진·브랜드 사칭
  '운영자', '운영진', '운영팀', '관리자', '고객센터', '공식', '프리티풀', '프리티플', '프리띠풀', '프리티뿔',
  'freetiful', 'freetful', 'prettyful', 'pretiful', 'admin', 'official', 'moderator', 'staff', '스태프',
];
const INVISIBLE_RE = re('[\\u{115F}\\u{1160}\\u{3164}\\u{FFA0}\\u{2800}\\u{180E}\\u{200B}\\u{200C}\\u{200E}\\u{200F}\\u{2060}-\\u{2064}\\u{FEFF}]', 'u');
const CONTROL_RE = re('\\p{Cc}', 'u');
const FORMAT_RE = re('\\p{Cf}', 'u');
const URL_RE =
  /(https?:|:\/\/|www\.|t\.me|open\.kakao|@[a-z0-9-]+\.|[a-z0-9-]\.(com|net|org|kr|co|io|me|ly|gg|app|xyz|shop|site|link|info|biz|tv|to|so|ai|dev|page|club|top|vip|cc|asia)\b)/i;
const BASIC_ALLOWED_RE = re("^[\\u{AC00}-\\u{D7A3}\\u{3131}-\\u{3163}\\u{3165}-\\u{318E}A-Za-z0-9 ._\\-!?~^*+&'()[\\],:;#%=/\\u{2661}\\u{2665}\\u{2605}\\u{2606}\\u{266A}\\u{00B7}]$", 'u');
const PICTO_RE = re('\\p{Extended_Pictographic}', 'u');
const EMOJI_PART_RE = re('^[\\u{1F3FB}-\\u{1F3FF}\\u{1F1E6}-\\u{1F1FF}]$', 'u');
const SKIN_RE = re('^[\\u{1F3FB}-\\u{1F3FF}]$', 'u');
const STRIP_RE = re('[\\s\\p{P}\\p{S}\\u{200D}\\u{FE0F}\\u{20E3}]', 'gu') || /[\s!-/:-@[-`{-~]/g;
const NUM_RE = re('\\p{N}', 'gu') || /[0-9]/g;
const ZWJ = '‍';
const VS16 = '️';
const KEYCAP = '⃣';

function isPicto(ch: string | undefined): boolean {
  return !!ch && (!!PICTO_RE?.test(ch) || !!EMOJI_PART_RE?.test(ch));
}

/** 글자 하나하나가 허용 글자인가(이음표·이모지 변형 선택자·키캡은 이모지 옆에서만) — 서버 allCharsAllowed 와 같음 */
function allCharsAllowed(chars: string[]): boolean {
  if (!BASIC_ALLOWED_RE) return true; // 옛 브라우저 — 서버가 본다
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (BASIC_ALLOWED_RE.test(ch) || isPicto(ch)) continue;
    const prev = chars[i - 1];
    if (ch === ZWJ) {
      let j = i - 1;
      while (j >= 0 && (chars[j] === VS16 || !!SKIN_RE?.test(chars[j]))) j--;
      if (j >= 0 && isPicto(chars[j]) && isPicto(chars[i + 1])) continue;
      return false;
    }
    if (ch === VS16 && (isPicto(prev) || /^[0-9#*]$/.test(prev || ''))) continue;
    if (ch === KEYCAP && (prev === VS16 || /^[0-9#*]$/.test(prev || ''))) continue;
    return false;
  }
  return true;
}

/** 표시용 정리 — NFC, 전각 영숫자·기호(U+FF01~FF5E)를 반각으로, 공백 하나로(서버 displayForm 과 같음) */
export function normalizeNickname(raw: string): string {
  return String(raw || '')
    .normalize('NFC')
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, ' ')
    .trim();
}

const LEET_I: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g', '@': 'a', $: 's', '!': 'i', '|': 'l' };
const LEET_L: Record<string, string> = { ...LEET_I, '1': 'l', '!': 'l' };

/** 금칙어 비교용 접기 — NFKC·소문자 후 ①숫자 지운 판 ②숫자→i 판 ③숫자→l 판(+ rn→m, vv→w) */
function foldVariants(s: string): string[] {
  const base = s.normalize('NFKC').toLowerCase();
  const a = base.replace(STRIP_RE, '').replace(NUM_RE, '');
  const leet = (map: Record<string, string>) =>
    base
      .replace(/[0-9@$!|]/g, (c) => map[c] ?? c)
      .replace(STRIP_RE, '')
      .replace(NUM_RE, '')
      .replace(/rn/g, 'm')
      .replace(/vv/g, 'w');
  return Array.from(new Set([a, leet(LEET_I), leet(LEET_L)]));
}
let bannedFolded: string[] | null = null;
function banned(): string[] {
  if (!bannedFolded) bannedFolded = BANNED_RAW.map((w) => w.normalize('NFKC').toLowerCase().replace(STRIP_RE, ''));
  return bannedFolded;
}

/** 같은 이름 비교용 접은 글자 — 서버 wrNicknameKey 와 같음 */
function nicknameKey(nickname: string): string | null {
  const k = nickname
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[1il|]/g, 'l')
    .replace(/0/g, 'o')
    .replace(STRIP_RE, '')
    .replace(/rn/g, 'm')
    .replace(/vv/g, 'w');
  return k || null;
}

/** 기본 닉네임 모양(꾸밈말 × 동물)의 접은 글자 — 처음 쓸 때 한 번 만든다 */
let defaultLike: Set<string> | null = null;
function isDefaultLike(nickname: string): boolean {
  if (!defaultLike) {
    defaultLike = new Set<string>();
    for (const m of MODIFIERS) for (const a of [...AVATAR_ANIMALS, ...EXTRA_ANIMALS]) {
      const k = nicknameKey(`${m}${a}`);
      if (k) defaultLike.add(k);
    }
  }
  const k = nicknameKey(nickname);
  return !!k && defaultLike.has(k);
}

/** 모양 검사(①~⑥) — 공유 링크 ?n= 처럼 '남의 기본 닉네임'도 받아야 하는 곳에서 쓴다. 문제 있으면 문구, 괜찮으면 null */
export function nicknameShapeError(raw: string): string | null {
  const r = String(raw || '');
  if (r.length > 200) return '2~12자로 정해 주세요';
  if (CONTROL_RE?.test(r) || FORMAT_RE?.test(r.replace(/‍/g, '')) || INVISIBLE_RE?.test(r)) return '쓸 수 없는 글자가 있어요';
  const s = normalizeNickname(r);
  if (!s) return '닉네임을 입력해 주세요';
  const chars = Array.from(s);
  if (chars.length < 2 || chars.length > 12) return chars.length < 2 ? '2자 이상 입력해 주세요' : '12자까지 쓸 수 있어요';
  if (!allCharsAllowed(chars)) return '쓸 수 없는 글자가 있어요';
  const compat = s.normalize('NFKC');
  if (URL_RE.test(compat)) return '주소는 넣을 수 없어요';
  if (/\d{7,}/.test(compat.replace(/[\s.\-]/g, ''))) return '연락처는 넣을 수 없어요';
  const flats = foldVariants(s);
  if (banned().some((w) => flats.some((f) => f.includes(w)))) return '쓸 수 없는 말이 들어 있어요';
  return null;
}

/** 직접 정하는 닉네임 검사(①~⑦) — 내 기본 닉네임 그대로면 통과('기본값으로' 처리) */
export function nicknameError(raw: string): string | null {
  const shape = nicknameShapeError(raw);
  if (shape) return shape;
  const s = normalizeNickname(raw);
  if (s !== defaultNickname() && isDefaultLike(s)) return "'꾸밈말 동물' 모양은 기본 닉네임 전용이에요";
  return null;
}

export function setNickname(raw: string): { ok: true; nickname: string } | { ok: false; reason: string } {
  const s = normalizeNickname(raw);
  // 내 기본 닉네임으로 되돌리기 = 정한 이름 지움 + 다음 기록 때 서버에도 '되돌리기'(resetNickname)를 알린다
  // (기본 이름을 보내는 것만으로는 서버가 '정하지 않음'으로 보고 예전 이름을 유지해, 되돌릴 길이 없었다 — 261011 검증 low)
  if (s && s === defaultNickname()) {
    saveMine('', true);
    return { ok: true, nickname: s };
  }
  const err = nicknameError(raw);
  if (err) return { ok: false, reason: err };
  saveMine(s, false);
  return { ok: true, nickname: s };
}

/**
 * 제출 응답의 공개 닉네임에 기기 저장값을 맞춘다 — 서버는 '그 플레이어가 마지막으로 정한 이름'을 유지하므로 보낸 이름과 다를 수 있다
 * (같은 이름·잠금·다른 기기에서 정한 이름). 기본 닉네임 모양이면 저장값을 비운다(보내면 '정하지 않음'으로 처리되게).
 */
function syncNicknameFromServer(serverNick: unknown, sentReset: boolean) {
  if (typeof serverNick !== 'string') return;
  const n = normalizeNickname(serverNick);
  if (!n) return;
  const isDefault = n === defaultNickname() || isDefaultLike(n);
  // 되돌리기를 보냈는데 서버가 여전히 직접 정한 이름이면(옛 서버·잠금 등) 기기 쪽 '기본값' 선택을 덮지 않고 다음에 다시 보낸다
  if (sentReset && !isDefault) return;
  // 이 계정의 서버 이름으로 기기 값을 맞추고 주인 표시(계정을 바꿔도 남의 이름을 보내지 않게 — E4)
  if (n === currentNickname() && savedIsMine()) {
    if (sentReset) setNicknameReset(false);
    setNicknameOwner(accountKey());
    return;
  }
  saveMine(isDefault ? '' : n, false);
}

// ── 세션(한 판 = 토큰 하나) ──

/** acct = 토큰을 받을 때의 계정 키 — (261011 검증 low) 계정을 바꾼 뒤 옛 계정 토큰으로 달려 옛 계정 기록·이름이 섞이던 것 */
type Prepared = { token: string; at: number; acct: string };
let prepared: Prepared | null = null;
let preparing: Promise<Prepared | null> | null = null;
/** 지금 달리는 판의 토큰 — 판 시작 때 prepared 에서 옮긴다 */
let runToken: string | null = null;
/** 판 번호(늦게 온 새 토큰이 다른 판에 끼지 않게) */
let runSeq = 0;
/** 마지막 세션 요청 실패 이유 — 429 = 'busy'(같은 IP 열린 판 상한·요청 몰림) */
let lastSessionError: 'busy' | 'other' | null = null;

/** 미리 받은 토큰이 이보다 오래됐으면 판 시작 때 새로 받아 바꿔 낀다(서버 수명 30분을 판이 거의 다 쓰게) */
const TOKEN_SWAP_AFTER_MS = 60 * 1000;
/** 이보다 오래된 토큰은 쓰지 않는다(새 토큰이 1.5초 안에 안 올 때의 마지막 수단 — 서버 수명 30분 안) */
const TOKEN_MAX_AGE_MS = 25 * 60 * 1000;
/** 판 시작 뒤 이 안에 온 새 토큰만 이번 판에 쓴다(서버 '달린 시간 ≤ 세션 경과 + 2초' 여유 안) */
const LATE_TOKEN_MS = 1500;

function closeToken(token: string | null | undefined) {
  if (token) wrApi.abandonSession(token, getDeviceId());
}

/** 다음 판 세션을 미리 받아 둔다(이미 있거나 받는 중이면 그대로). 서버가 없으면 null */
export function prepareSession(): Promise<Prepared | null> {
  const acct = accountKey();
  if (prepared && prepared.acct !== acct) {
    // 다른 계정으로 받은 토큰 — 닫고 새로
    closeToken(prepared.token);
    prepared = null;
  }
  if (prepared && Date.now() - prepared.at < TOKEN_MAX_AGE_MS) return Promise.resolve(prepared);
  if (preparing) return preparing;
  preparing = wrApi
    .createSession(getDeviceId())
    .then((s) => {
      // 받는 사이 다른 토큰이 들어와 있으면(드묾) 그건 닫는다
      if (prepared && prepared.token !== s.token) closeToken(prepared.token);
      prepared = { token: s.token, at: Date.now(), acct };
      lastSessionError = null;
      setAvailability('available');
      return prepared;
    })
    .catch((e) => {
      prepared = null;
      lastSessionError = e instanceof WrApiError && e.status === 429 ? 'busy' : 'other';
      if (isServerMissing(e)) setAvailability('unavailable');
      return null;
    })
    .finally(() => {
      preparing = null;
    });
  return preparing;
}

/**
 * 판 시작 — 미리 받은 토큰을 이번 판 것으로. 1분보다 오래됐거나 없으면 새로 받아, 판 시작 1.5초 안에 오면 바꿔 낀다
 * (옛 토큰은 서버에서 닫음). 늦게 오면 옛 토큰(25분 안)으로 달리고, 새 토큰은 다음 판용으로 남는다.
 */
export function beginRun() {
  const mySeq = ++runSeq;
  runToken = null;
  const startedAt = Date.now();
  const p = prepared;
  prepared = null;
  if (p && startedAt - p.at < TOKEN_MAX_AGE_MS && p.acct === accountKey()) runToken = p.token;
  else closeToken(p?.token);
  if (p && runToken && startedAt - p.at < TOKEN_SWAP_AFTER_MS) return;
  void prepareSession().then((fresh) => {
    if (!fresh || mySeq !== runSeq || fresh.acct !== accountKey()) return;
    if (Date.now() - startedAt >= LATE_TOKEN_MS) return; // 늦음 — prepared 로 남겨 다음 판에
    if (prepared === fresh) prepared = null;
    const old = runToken;
    runToken = fresh.token;
    if (old && old !== fresh.token) closeToken(old);
  });
}

/** 판 포기(홈으로 나감·일시정지 중 다시 도전) — 이번 판 토큰을 버리고 서버에서도 닫는다 */
export function abandonRun() {
  runSeq++;
  const t = runToken;
  runToken = null;
  closeToken(t);
}

/** 페이지를 떠날 때(pagehide) — 안 쓴 미리 받은 토큰을 서버에서 닫는다(달리는 판 토큰은 그대로: 뒤로 가기 캐시에서 돌아오면 이어 감) */
export function releasePreparedSession() {
  const p = prepared;
  prepared = null;
  closeToken(p?.token);
}

export type SubmitOutcome =
  | { status: 'ok'; res: WrSubmitRes }
  /** 서버 없음 — 랭킹 준비 중 */
  | { status: 'unavailable' }
  /** 서버는 있는데 이번 기록을 못 올림(검증 실패·속도 제한) */
  | { status: 'rejected'; message: string }
  /** 이번 판엔 세션이 없어 올리지 않음 — reason 'busy' = 요청이 몰려 서버가 새 판을 잠시 막음(429), 'slow' = 연결이 늦음 */
  | { status: 'skipped'; reason: 'busy' | 'slow' };

export async function submitRun(r: WRResult): Promise<SubmitOutcome> {
  const token = runToken;
  runToken = null;
  // 다음 판 세션은 결과와 상관없이 미리
  const next = () => void prepareSession();
  if (!token) {
    const why = lastSessionError === 'busy' ? 'busy' : 'slow';
    next();
    return availability === 'unavailable' ? { status: 'unavailable' } : { status: 'skipped', reason: why };
  }
  const sentReset = pendingReset();
  const soft = savedIsGuestCarry();
  try {
    const res = await wrApi.submitScore({
      token,
      score: Math.max(0, Math.floor(r.score)),
      stage: Math.max(0, Math.min(4, Math.floor(r.stage))),
      segment: Math.max(0, Math.min(11, Math.floor(r.segment))),
      arrived: !!r.arrived,
      laps: Math.max(0, Math.floor(r.laps)),
      durationMs: Math.max(0, Math.floor(r.durationMs)),
      hearts: Math.max(0, Math.floor(r.hearts)),
      envelopes: Math.max(0, Math.floor(r.envelopes)),
      nickname: currentNickname(),
      ...(sentReset ? { resetNickname: true } : {}),
      ...(soft ? { nicknameSoft: true } : {}),
      deviceId: getDeviceId(),
    });
    setAvailability('available');
    // 서버가 실제로 쓰는 공개 닉네임에 기기 저장값을 맞춘다(거절·잠금·다른 기기에서 정한 이름)
    syncNicknameFromServer(res.nickname, sentReset);
    next();
    return { status: 'ok', res };
  } catch (e) {
    next();
    if (isServerMissing(e)) {
      setAvailability('unavailable');
      return { status: 'unavailable' };
    }
    return { status: 'rejected', message: wrErrorMessage(e) || '이번 기록은 랭킹에 올리지 못했어요' };
  }
}

// ── 순위표 ──

export type BoardOutcome = { status: 'ok'; data: WrLeaderboard } | { status: 'unavailable' } | { status: 'error' };

const boardCache = new Map<WrPeriod, { at: number; data: WrLeaderboard }>();
const BOARD_FRESH_MS = 20_000;

export function invalidateBoards() {
  boardCache.clear();
}

export async function loadBoard(period: WrPeriod, force = false): Promise<BoardOutcome> {
  const hit = boardCache.get(period);
  if (!force && hit && Date.now() - hit.at < BOARD_FRESH_MS) return { status: 'ok', data: hit.data };
  try {
    const raw = await wrApi.leaderboard(period, getDeviceId());
    const data = sanitizeBoard(raw, period);
    if (!data) return { status: 'error' };
    boardCache.set(period, { at: Date.now(), data });
    setAvailability('available');
    return { status: 'ok', data };
  } catch (e) {
    if (isServerMissing(e)) {
      setAvailability('unavailable');
      return { status: 'unavailable' };
    }
    return { status: 'error' };
  }
}

/** 응답 모양이 이상하면(다른 서비스가 200 HTML 을 준다든지) 순위로 쓰지 않는다 */
function sanitizeBoard(raw: unknown, period: WrPeriod): WrLeaderboard | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Partial<WrLeaderboard>;
  if (!Array.isArray(b.top)) return null;
  const top = b.top
    .filter((r) => r && typeof r === 'object' && typeof r.score === 'number' && typeof r.rank === 'number')
    .map((r) => ({
      rank: Math.max(1, Math.floor(r.rank)),
      nickname: String(r.nickname || '').slice(0, 24) || '이름 없음',
      score: Math.max(0, Math.floor(r.score)),
      stage: Math.max(0, Math.min(4, Math.floor(Number(r.stage) || 0))),
      arrived: !!r.arrived,
      isMe: !!r.isMe,
    }));
  const me =
    b.me && typeof b.me === 'object' && typeof b.me.rank === 'number'
      ? {
          rank: Math.max(1, Math.floor(b.me.rank)),
          nickname: String(b.me.nickname || '').slice(0, 24),
          best: Math.max(0, Math.floor(Number(b.me.best) || 0)),
          stage: Math.max(0, Math.min(4, Math.floor(Number(b.me.stage) || 0))),
          arrived: !!b.me.arrived,
        }
      : null;
  return { period, participants: Math.max(0, Math.floor(Number(b.participants) || 0)), top, me };
}

// ── 공유 링크 기록(?c=) ──

export async function loadPublicScore(id: string): Promise<WrPublicScore | null> {
  try {
    const s = await wrApi.getScore(id);
    if (!s || typeof s.score !== 'number' || typeof s.nickname !== 'string') return null;
    return {
      id: String(s.id || id),
      nickname: s.nickname.slice(0, 24),
      score: Math.max(0, Math.floor(s.score)),
      stage: Math.max(0, Math.min(4, Math.floor(Number(s.stage) || 0))),
      segment: Math.max(0, Math.min(11, Math.floor(Number(s.segment) || 0))),
      arrived: !!s.arrived,
    };
  } catch {
    return null;
  }
}
