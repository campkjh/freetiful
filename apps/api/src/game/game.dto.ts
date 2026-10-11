import {
  WR_ABS_MAX_SCORE,
  WR_COLLECT_MAX,
  WR_LAPS_MAX,
  WR_PERIODS,
  WR_SEGMENT_MAX,
  WR_STAGE_MAX,
  WRPeriod,
} from './game.constants';

/**
 * 웨딩런 API 요청·응답 모양(261011 — 웹 apps/web/src/lib/api/wedding-run.api.ts 와의 공동 약속 그대로).
 * (261011 랭킹 API 검증 보강: 응답 모양은 그대로, 구간 0~11(12구간)·운영 숨김 API 몸통 추가)
 * 본문은 class-validator DTO 대신 인터페이스 + 아래 parse 함수로 검사한다:
 *   전역 ValidationPipe 가 forbidNonWhitelisted 라, 엔진 결과를 펼쳐 보낼 때 칸이 하나만 늘어도 판 기록 전체가 400 으로 사라진다.
 *   알려진 칸만 꺼내 쓰고 나머지는 무시한다.
 */

export interface CreateSessionBody {
  deviceId: string;
}

/** 판 포기 — 그 판의 세션 토큰 + 기기 id */
export interface AbandonSessionBody {
  token: string;
  deviceId: string;
}

export interface CreateSessionResult {
  sessionId: string;
  token: string;
  startedAt: number;
}

export interface SubmitScoreBody {
  token: string;
  score: number;
  stage: number;
  segment: number;
  arrived: boolean;
  laps: number;
  durationMs: number;
  hearts: number;
  envelopes: number;
  nickname?: string;
  /** 기본 닉네임('꾸밈말 동물')으로 되돌리기 — 직접 정한 이름을 지운다(261011 검증 low: 예전엔 되돌릴 길이 없었다) */
  resetNickname?: boolean;
  /** (261011 검증 E4) 손님 때 이 기기에서 정한 이름을 막 로그인한 계정으로 — 계정에 직접 정한 이름이 이미 있으면 그대로 둔다 */
  nicknameSoft?: boolean;
  deviceId: string;
}

export interface SubmitScoreResult {
  id: string;
  isNewBest: boolean;
  best: number;
  today: { rank: number; participants: number };
  nextGoal: { rank: number; gap: number } | null;
  top10Gap: number | null;
  /** 실제로 저장된 공개 닉네임(규칙에 어긋나면 기본 닉네임으로 바뀜) — 약속 밖 추가 칸 */
  nickname: string;
  /** 닉네임을 기본값으로 바꾼 이유(바꾸지 않았으면 null) — 약속 밖 추가 칸 */
  nicknameRejected: string | null;
  /**
   * 자동 보류(261011 검증 반영) — 사람이 내기 어려운 판이라 숨김 저장, 운영 확인 뒤 순위에 반영. 보류면 today.rank 는 이 판을 뺀 값(없으면 0).
   */
  held: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  nickname: string;
  score: number;
  stage: number;
  arrived: boolean;
  /** 요청한 사람 본인 줄 — 약속 밖 추가 칸(화면 강조용) */
  isMe: boolean;
}

export interface LeaderboardResult {
  period: WRPeriod;
  participants: number;
  top: LeaderboardEntry[];
  me: { rank: number; nickname: string; best: number; stage: number; arrived: boolean } | null;
}

/** 운영 — 판 숨김/해제 */
export interface AdminHideScoreBody {
  hidden?: unknown;
  reason?: unknown;
}

/** 운영 — 그 판을 낸 플레이어 숨김/해제·닉네임 기본값으로 되돌리기(+잠금) */
export interface AdminPlayerBody {
  hidden?: unknown;
  resetNickname?: unknown;
  lockNickname?: unknown;
  reason?: unknown;
}

/** 운영 목록 한 줄 — 운영자만(playerKey·userId·deviceId 포함) */
export interface AdminScoreRow {
  id: string;
  playerKey: string;
  userId: string | null;
  deviceId: string;
  /** 그 판을 낼 때 닉네임 · 플레이어의 지금 공개 닉네임 */
  nickname: string;
  playerNickname: string | null;
  score: number;
  stage: number;
  segment: number;
  arrived: boolean;
  laps: number;
  durationMs: number;
  hearts: number;
  envelopes: number;
  /** 초당 점수(달린 시간 기준) — 이상한 기록 찾기용 */
  scorePerSec: number;
  createdAt: string;
  hiddenAt: string | null;
  hiddenReason: string | null;
  playerHiddenAt: string | null;
  playerHiddenReason: string | null;
}

export interface PublicScoreResult {
  id: string;
  nickname: string;
  score: number;
  stage: number;
  segment: number;
  arrived: boolean;
}

// ── 검사 ──

const DEVICE_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 기기 id — 웹 localStorage 'wr-device-id'(uuid). 형식이 아니면 null */
export function parseDeviceId(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return DEVICE_ID_RE.test(s) ? s : null;
}

/** 기간 — 없으면 오늘, 모르는 값이면 null(400) */
export function parsePeriod(v: unknown): WRPeriod | null {
  if (v == null || v === '') return 'today';
  return (WR_PERIODS as readonly string[]).includes(String(v)) ? (v as WRPeriod) : null;
}

/** 0 이상 유한수(숫자 또는 숫자 글자) → 내림 정수. 음수·NaN·Infinity·그 밖은 null */
function nonNegInt(v: unknown, max: number): number | null {
  let n: number;
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string' && /^\d+(\.\d+)?$/.test(v.trim())) n = Number(v);
  else return null;
  if (!Number.isFinite(n) || n < 0 || n > max) return null;
  return Math.floor(n);
}

export interface ParsedScore {
  token: string;
  deviceId: string;
  score: number;
  stage: number;
  segment: number;
  arrived: boolean;
  laps: number;
  durationMs: number;
  hearts: number;
  envelopes: number;
  nickname: unknown;
  resetNickname: boolean;
  nicknameSoft: boolean;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; reason: string };

/** 점수 제출 본문 검사 — 범위·형식만(토큰·세션·시간·값끼리 대조는 서비스·game-rules.ts 에서) */
export function parseSubmitScoreBody(body: unknown): Parsed<ParsedScore> {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const token = typeof b.token === 'string' ? b.token.trim() : '';
  if (!token || token.length > 2048) return { ok: false, reason: '세션 정보가 없어요' };
  const deviceId = parseDeviceId(b.deviceId);
  if (!deviceId) return { ok: false, reason: '기기 정보가 올바르지 않아요' };
  const score = nonNegInt(b.score, WR_ABS_MAX_SCORE);
  if (score == null) return { ok: false, reason: '점수가 올바르지 않아요' };
  const stage = nonNegInt(b.stage, WR_STAGE_MAX);
  if (stage == null) return { ok: false, reason: '캐릭터 단계가 올바르지 않아요' };
  const segment = nonNegInt(b.segment, WR_SEGMENT_MAX);
  if (segment == null) return { ok: false, reason: '구간이 올바르지 않아요' };
  // 서버 시계 검사(세션 시작 후 지난 시간 이하)는 서비스에서 — 여기선 정수 칸 넘침만 막는다
  const durationMs = nonNegInt(b.durationMs, 2_000_000_000);
  if (durationMs == null) return { ok: false, reason: '달린 시간이 올바르지 않아요' };
  const laps = b.laps == null ? 0 : nonNegInt(b.laps, WR_LAPS_MAX);
  if (laps == null) return { ok: false, reason: '완주 수가 올바르지 않아요' };
  const hearts = b.hearts == null ? 0 : nonNegInt(b.hearts, WR_COLLECT_MAX);
  const envelopes = b.envelopes == null ? 0 : nonNegInt(b.envelopes, WR_COLLECT_MAX);
  if (hearts == null || envelopes == null) return { ok: false, reason: '모은 개수가 올바르지 않아요' };
  if (b.arrived != null && typeof b.arrived !== 'boolean') return { ok: false, reason: '도착 여부가 올바르지 않아요' };
  // 완주가 1번 이상이면 도착한 것(엔진이 도착 연출 중에 끝나 arrived 만 늦게 켜지는 경우도 맞춰 준다).
  // 반대로 arrived 인데 laps 0 이면 대조(game-rules.ts)에서 완주 1번으로 센다.
  const arrived = b.arrived === true || laps > 0;
  return {
    ok: true,
    value: { token, deviceId, score, stage, segment, arrived, laps, durationMs, hearts, envelopes, nickname: b.nickname, resetNickname: b.resetNickname === true, nicknameSoft: b.nicknameSoft === true },
  };
}

/** 참·거짓 칸(없으면 undefined, 모양이 틀리면 null) */
export function parseOptionalBool(v: unknown): boolean | undefined | null {
  if (v === undefined) return undefined;
  return typeof v === 'boolean' ? v : null;
}

/** 운영 사유 — 200자까지, 없으면 null */
export function parseReason(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, 200) : null;
}
