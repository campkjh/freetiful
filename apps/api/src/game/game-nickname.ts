import { AVATAR_ANIMALS, EXTRA_ANIMALS, MODIFIERS, communityNickname } from '../community/community-nickname';

/**
 * 웨딩런 공개 닉네임(261011 사장 기획 '공개 랭킹의 닉네임은 사용자 설정' + 랭킹 API 검증 보강).
 *  · 기본 = 웨딩숲 '꾸밈말 동물' 생성기(communityNickname)를 deviceId 로 고정 — 실명은 절대 쓰지 않는다
 *    (로그인 회원이어도 이름을 넘기지 않으니 늘 '꾸밈말 동물'). 웹도 같은 함수에 { id: 'wr:' + deviceId, role: 'general' } — 같은 이름.
 *  · 사용자가 바꾸면 2~12자. 검사 순서(보강):
 *     ① 제어문자·서식문자·보이지 않는 글자 거부
 *     ② 표시용 정리 = NFC + 전각 영숫자·기호를 반각으로 + 공백 하나로
 *     ③ 허용 글자만(한글·한글 자모·영문·숫자·공백·몇 가지 기호·이모지) — 키릴·그리스 문자 같은 닮은꼴('frееtiful' 의 е)·
 *        수학 영숫자·결합 문자 도배는 여기서 걸린다
 *     ④ 주소·연락처 거부
 *     ⑤ 금칙어 — NFKC(전각 ｆｕｃｋ → fuck, 'ㅅㅣ발' → '시발') + 소문자 + 공백·기호 제거 + 숫자 제거판/숫자→글자판(fr33tiful) 셋 다 본다
 *     ⑥ 기본 닉네임 모양('설레는 고양이' 식 꾸밈말+동물)은 남의 기본 닉네임 사칭이 돼서 직접 정할 수 없다(자기 기본 닉네임은 기본값으로 처리)
 *  · 다른 플레이어가 지금 쓰는 닉네임과 '접은 글자'(nicknameKey — 대소문자·띄어쓰기·기호·1/l/I·0/o 접기)가 같으면 서비스가 거절한다.
 *  · 점수 제출 때 닉네임이 규칙에 어긋나면 기록은 버리지 않고 그 플레이어의 지금 닉네임(없으면 기본)을 유지한다(응답으로 이유를 알려 줌).
 * ⚠ 웹 입력 칸 검사(wedding-run 화면 쪽)는 안내용 — 최종 판단은 여기.
 */

export const WR_NICK_MIN = 2;
export const WR_NICK_MAX = 12;

/**
 * 금칙어(욕설·성적 표현·혐오·운영진/브랜드 사칭). 비교는 아래 fold 로 접은 글자끼리 — 띄어쓰기·기호·숫자를 끼워도 걸린다.
 * 흔한 낱말을 막는 짧은 말은 뺐다('시바'견·'보슬'비·g'rape'·'죽어'도 좋아).
 */
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

/** 보이지 않는 채움·폭 없는 글자(한글 채움·점자 공백·폭 없는 공백 등) — '공백만'·같은 이름 우회에 쓰인다 */
const INVISIBLE_RE = /[\u{115F}\u{1160}\u{3164}\u{FFA0}\u{2800}\u{180E}\u{200B}\u{200C}\u{200E}\u{200F}\u{2060}-\u{2064}\u{FEFF}]/u;
/** 제어문자(Cc)·서식문자(Cf — 이모지 이음 ZWJ 는 아래에서 이모지 사이일 때만 허용) */
const CONTROL_RE = /\p{Cc}/u;
const FORMAT_RE = /\p{Cf}/u;
/** 주소·도메인·이메일·메신저 링크('Mr.Kim' 같은 이름은 통과 — 흔한 최상위 도메인만 본다) */
const URL_RE =
  /(https?:|:\/\/|www\.|t\.me|open\.kakao|@[a-z0-9-]+\.|[a-z0-9-]\.(com|net|org|kr|co|io|me|ly|gg|app|xyz|shop|site|link|info|biz|tv|to|so|ai|dev|page|club|top|vip|cc|asia)\b)/i;

/** 허용 글자 — 한글 음절·한글 호환 자모(ㅋㅋ — 채움 U+3164 제외)·영문·숫자·공백·기호 몇 개 */
const BASIC_ALLOWED_RE = /^[\u{AC00}-\u{D7A3}\u{3131}-\u{3163}\u{3165}-\u{318E}A-Za-z0-9 ._\-!?~^*+&'()[\],:;#%=/\u{2661}\u{2665}\u{2605}\u{2606}\u{266A}\u{00B7}]$/u;
const PICTO_RE = /\p{Extended_Pictographic}/u;
/** 이모지 피부색·국기(지역 표시 문자) */
const EMOJI_PART_RE = /^[\u{1F3FB}-\u{1F3FF}\u{1F1E6}-\u{1F1FF}]$/u;

function isPicto(ch: string | undefined): boolean {
  return !!ch && (PICTO_RE.test(ch) || EMOJI_PART_RE.test(ch));
}

/** 표시용 글자 하나하나가 허용 글자인가(이음표 ZWJ·이모지 변형 선택자·키캡은 이모지 옆에서만) */
function allCharsAllowed(chars: string[]): boolean {
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (BASIC_ALLOWED_RE.test(ch) || isPicto(ch)) continue;
    const prev = chars[i - 1];
    if (ch === '\u{200D}') {
      // 이음표 앞은 변형 선택자·피부색을 건너뛴 이모지, 뒤도 이모지여야(글자 사이에 숨긴 이음표로 같은 이름 우회 금지)
      let j = i - 1;
      while (j >= 0 && (chars[j] === '\u{FE0F}' || /^[\u{1F3FB}-\u{1F3FF}]$/u.test(chars[j]))) j--;
      if (j >= 0 && isPicto(chars[j]) && isPicto(chars[i + 1])) continue;
      return false;
    }
    if (ch === '\u{FE0F}' && (isPicto(prev) || /^[0-9#*]$/.test(prev || ''))) continue;
    if (ch === '\u{20E3}' && (prev === '\u{FE0F}' || /^[0-9#*]$/.test(prev || ''))) continue;
    return false;
  }
  return true;
}

/** 표시용 정리 — NFC, 전각 영숫자·기호(U+FF01~FF5E)를 반각으로, 공백 하나로 */
function displayForm(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/[\u{FF01}-\u{FF5E}]/gu, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\s+/gu, ' ')
    .trim();
}

const STRIP_RE = /[\s\p{P}\p{S}\u{200D}\u{FE0F}\u{20E3}]/gu;
const LEET_I: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g', '@': 'a', $: 's', '!': 'i', '|': 'l' };
const LEET_L: Record<string, string> = { ...LEET_I, '1': 'l', '!': 'l' };

/** 금칙어 비교용 접기 — NFKC·소문자 후 ①숫자 지운 판 ②숫자→i 판 ③숫자→l 판(+ rn→m, vv→w) */
function foldVariants(s: string): string[] {
  const base = s.normalize('NFKC').toLowerCase();
  const a = base.replace(STRIP_RE, '').replace(/\p{N}/gu, '');
  const leet = (map: Record<string, string>) =>
    base
      .replace(/[0-9@$!|]/g, (c) => map[c] ?? c)
      .replace(STRIP_RE, '')
      .replace(/\p{N}/gu, '')
      .replace(/rn/g, 'm')
      .replace(/vv/g, 'w');
  return Array.from(new Set([a, leet(LEET_I), leet(LEET_L)]));
}

const BANNED = BANNED_RAW.map((w) => w.normalize('NFKC').toLowerCase().replace(STRIP_RE, ''));

/**
 * 같은 이름 비교용 접은 글자(nicknameKey) — NFKC·소문자, 1·i·l·| → l, 0 → o, 공백·기호·이모지 제거, rn → m, vv → w.
 * '설레는 신부'·'설레는신부!'·'설레는 신부✨' 는 같은 키. 다 지워져 빈 글자면(이모지만) null — 같은 이름 검사를 하지 않는다.
 */
export function wrNicknameKey(nickname: string): string | null {
  const k = nickname
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[1il|]/g, 'l')
    .replace(/0/g, 'o')
    .replace(STRIP_RE, '')
    .replace(/rn/g, 'm')
    .replace(/vv/g, 'w');
  return k ? k : null;
}

/** 기본 닉네임 모양(꾸밈말 64 × 동물 32)의 접은 글자 — 직접 정한 이름으로 남의 기본 닉네임을 흉내 내지 못하게 */
const DEFAULT_LIKE_KEYS = new Set<string>();
for (const m of MODIFIERS) for (const a of [...AVATAR_ANIMALS, ...EXTRA_ANIMALS]) {
  const k = wrNicknameKey(`${m}${a}`);
  if (k) DEFAULT_LIKE_KEYS.add(k);
}

export type WRNicknameCheck = { ok: true; nickname: string; key: string | null } | { ok: false; reason: string };

/** 사용자가 정한 닉네임 검사 — 통과하면 표시용 닉네임과 같은 이름 비교 키 */
export function checkWeddingRunNickname(raw: unknown): WRNicknameCheck {
  if (typeof raw !== 'string') return { ok: false, reason: '닉네임을 정해 주세요' };
  // 터무니없이 긴 값은 정규식 돌리기 전에 바로(본문 한도가 50MB 라)
  if (raw.length > 200) return { ok: false, reason: `${WR_NICK_MIN}~${WR_NICK_MAX}자로 정해 주세요` };
  if (CONTROL_RE.test(raw) || FORMAT_RE.test(raw.replace(/\u{200D}/gu, '')) || INVISIBLE_RE.test(raw)) {
    return { ok: false, reason: '쓸 수 없는 글자가 있어요' };
  }
  const s = displayForm(raw);
  if (!s) return { ok: false, reason: '공백만으로는 정할 수 없어요' };
  const chars = Array.from(s);
  if (chars.length < WR_NICK_MIN || chars.length > WR_NICK_MAX) return { ok: false, reason: `${WR_NICK_MIN}~${WR_NICK_MAX}자로 정해 주세요` };
  if (!allCharsAllowed(chars)) return { ok: false, reason: '쓸 수 없는 글자가 있어요' };
  const compat = s.normalize('NFKC');
  if (URL_RE.test(compat)) return { ok: false, reason: '주소는 넣을 수 없어요' };
  if (/\d{7,}/.test(compat.replace(/[\s.\-]/g, ''))) return { ok: false, reason: '연락처는 넣을 수 없어요' };
  const flats = foldVariants(s);
  if (BANNED.some((w) => flats.some((f) => f.includes(w)))) return { ok: false, reason: '쓸 수 없는 말이 들어 있어요' };
  const key = wrNicknameKey(s);
  if (key && DEFAULT_LIKE_KEYS.has(key)) return { ok: false, reason: '기본 닉네임 모양은 직접 정할 수 없어요' };
  return { ok: true, nickname: s, key };
}

/**
 * 기본 닉네임 — deviceId 로 고정한 '꾸밈말 동물'. 웹 기본 닉네임과 같은 입력('wr:' + deviceId)이어야
 * 화면에 보이던 이름과 서버가 저장한 이름이 같다(접두어 'wr:' = 회원 id 와 같은 해시가 나오지 않게).
 */
export function defaultWeddingRunNickname(deviceId: string): string {
  return communityNickname({ id: `wr:${deviceId}`, role: 'general' });
}

/** 보낸 닉네임이 '정하지 않음'인가 — 비었거나 그 기기의 기본 닉네임 그대로(웹은 정하지 않았으면 기본 닉네임을 보낸다) */
export function isUnsetNickname(raw: unknown, deviceId: string): boolean {
  if (raw == null) return true;
  if (typeof raw !== 'string') return false;
  const s = raw.length > 200 ? raw : displayForm(raw);
  return !s || s === defaultWeddingRunNickname(deviceId);
}
