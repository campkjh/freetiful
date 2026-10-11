import {
  WR_ARRIVE_BONUS,
  WR_COLLECT_MAX_PER_SEC,
  WR_COLLECT_RATIO,
  WR_COLLECT_SLACK_PTS,
  WR_DIST_PER_POINT,
  WR_DIST_SLACK_PTS,
  WR_DURATION_SLACK_MS,
  WR_ENVELOPE_VALUE,
  WR_HEART_VALUE,
  WR_HOLD_COLLECT_MIN_PTS,
  WR_HOLD_DURATION_MS,
  WR_HOLD_LAPS,
  WR_HOLD_RATE_MIN_MS,
  WR_HOLD_SCORE_PER_SEC,
  WR_LAP_LEN,
  WR_MAX_SCORE_PER_SEC,
  WR_MAX_SPEED,
  WR_PHOTO_BONUS,
  WR_PHOTO_SEG,
  WR_SEGMENT_COUNT,
  WR_SPEED_KAPPA,
  WR_SPEED_LAP_PLUS,
  WR_SPEED_LAPS,
  WR_SPEED_V0_MAX,
  WR_STAGE_MIN_MS,
  WR_TIME_BASE_SLACK_MS,
  WR_TIME_LAP_OVERHEAD_MS,
  WR_TIME_MIN_RATIO,
  WR_TIME_MIN_SLACK_MS,
  WR_TIME_PHOTO_SLACK_MS,
  wrHoldCollectRatio,
  wrMaxScoreFor,
} from './game.constants';

/**
 * 웨딩런 한 판 기록의 값끼리·시간과 대조(261011 랭킹 API 검증 보강).
 * (261011 사장 '갈수록 어렵게·빨라지게' + 검증 E1: 위조 점수가 ≈ 2.8만까지 보류 없이 통과 → 새 난이도·속도 곡선 기준으로 다시 조임)
 *
 * 속도가 바퀴 안 위치로 정해지는 게임이라 '진행(완주 수·구간) ↔ 달린 시간'이 구간 하나 폭으로 묶인다(엔진 config.ts 와 같은 곡선):
 *   ① 시간 창: 0.99 × (그 구간 시작까지 곡선 시간) − 1초 ≤ 달린 시간 ≤ (그 구간 끝까지 곡선 시간) + 연출 여유
 *   ② 거리 점수 창: Dmin = (완주 × 바퀴 + 구간 시작)/25 − 8 ≤ D ≤ Dmax = min(구간 끝, 그 시간에 갈 수 있는 거리)/25 + 8
 *   ③ 수집(하트·봉투 점수) ≤ 0.7 × Dmax + 35 (엔진 생성기 예산 — 놓을 때 차감, 못 먹어도 차감)
 *   ④ 점수 항등: 점수 − 수집 − 500 × 완주 ∈ [Dmin, Dmax + 100 × 촬영 상한]  (점수 = 거리 + 수집 + 촬영 + 도착)
 *   ⑤ 점수 ≤ min(서버 경과, 달린 시간) × 70 + 200
 *   ⑥ 하트 + 봉투 ≤ 점수(수집물은 1개 ≥ 1점), 초당 10개 이하
 * 실패는 사용자에게 보일 짧은 이유(400), 통과면 null. 순수 함수 — 시험 스크립트가 바로 부른다.
 * 통과했어도 사람이 내기 어려운 판은 wrHoldReason 이 '보류'(숨김 저장 + 운영 확인)로 돌린다.
 */

export interface WRRunClaim {
  score: number;
  stage: number;
  segment: number;
  arrived: boolean;
  laps: number;
  durationMs: number;
  hearts: number;
  envelopes: number;
}

const SEG_LEN = WR_LAP_LEN / WR_SEGMENT_COUNT;

/** 완주 수(arrived 인데 laps 0 이면 1 — 엔진이 도착 연출 중에 끝나 laps 가 늦게 오르는 경우) */
export function wrEffectiveLaps(c: Pick<WRRunClaim, 'laps' | 'arrived'>): number {
  return Math.max(c.laps, c.arrived ? 1 : 0);
}

/** 바퀴 lap(1부터) 속도 설정 [v0, Δ, 상한] — 엔진 course.ts lapSpeedCfg 와 같음 */
function lapCfg(lap: number): readonly [number, number, number] {
  const n = WR_SPEED_LAPS.length;
  if (lap <= n) return WR_SPEED_LAPS[Math.max(0, lap - 1)];
  const [v0, d] = WR_SPEED_LAPS[n - 1];
  return [Math.min(v0 + WR_SPEED_LAP_PLUS * (lap - n), WR_SPEED_V0_MAX), d, WR_MAX_SPEED];
}

/** 곡선 속도 v(바퀴, 구간, f) — 엔진 course.ts rawSpeed 와 같은 식 */
export function wrSpeed(lap: number, seg: number, f: number): number {
  const [v0, d, cap] = lapCfg(lap);
  return Math.min(cap, WR_MAX_SPEED, v0 + d * seg + d * WR_SPEED_KAPPA * Math.max(0, Math.min(1, f)));
}

/** 구간 하나 곡선 시간(초, 닫힌 꼴) */
export function wrSegTimeSec(lap: number, seg: number): number {
  const a = wrSpeed(lap, seg, 0);
  const b = wrSpeed(lap, seg, 1);
  return Math.abs(b - a) < 1e-9 ? SEG_LEN / a : (SEG_LEN / (b - a)) * Math.log(b / a);
}

export function wrLapTimeSec(lap: number): number {
  let t = 0;
  for (let s = 0; s < WR_SEGMENT_COUNT; s++) t += wrSegTimeSec(lap, s);
  return t;
}

/** 완주 laps 번 + 지금 바퀴 구간 seg 의 f 지점까지 곡선 시간(초) */
export function wrCumTimeSec(laps: number, seg: number, f: number): number {
  let t = 0;
  for (let k = 1; k <= laps; k++) t += wrLapTimeSec(k);
  for (let s = 0; s < seg; s++) t += wrSegTimeSec(laps + 1, s);
  return t + Math.max(0, Math.min(1, f)) * wrSegTimeSec(laps + 1, seg);
}

/** 달린 시간 t(초) 동안 곡선 속도로 갈 수 있는 최대 거리 — 실제 속도는 곡선 이하라 위쪽 안전(연출 시간도 안 뺌) */
export function wrDistAt(tSec: number): number {
  let t = Math.max(0, tSec);
  let dist = 0;
  for (let lap = 1; lap < 1000; lap++) {
    for (let s = 0; s < WR_SEGMENT_COUNT; s++) {
      const st = wrSegTimeSec(lap, s);
      if (t >= st) {
        t -= st;
        dist += SEG_LEN;
        continue;
      }
      const a = wrSpeed(lap, s, 0);
      const b = wrSpeed(lap, s, 1);
      const f = Math.abs(b - a) < 1e-9 ? (t * a) / SEG_LEN : (a / (b - a)) * (Math.exp((t * (b - a)) / SEG_LEN) - 1);
      return dist + Math.min(1, f) * SEG_LEN;
    }
  }
  return dist;
}

const segOf = (c: Pick<WRRunClaim, 'segment'>) => Math.max(0, Math.min(WR_SEGMENT_COUNT - 1, Math.floor(c.segment)));

/** 이 진행(완주 수·구간·단계)에 닿는 데 필요한 최소 달린 시간(ms) */
export function wrMinDurationMs(c: Pick<WRRunClaim, 'laps' | 'arrived' | 'segment' | 'stage'>): number {
  const laps = wrEffectiveLaps(c);
  const byProgress = WR_TIME_MIN_RATIO * wrCumTimeSec(laps, segOf(c), 0) * 1000 - WR_TIME_MIN_SLACK_MS;
  const byStage = WR_STAGE_MIN_MS[c.stage] ?? 0;
  return Math.max(0, Math.floor(Math.max(byProgress, byStage)));
}

/** 이 진행에서 있을 수 있는 가장 긴 달린 시간(ms) — 그 구간 끝까지 곡선 시간 + 연출 여유 */
export function wrMaxDurationMs(c: Pick<WRRunClaim, 'laps' | 'arrived' | 'segment'>): number {
  const laps = wrEffectiveLaps(c);
  const seg = segOf(c);
  const photo = seg >= WR_PHOTO_SEG ? WR_TIME_PHOTO_SLACK_MS : 0;
  return Math.floor(wrCumTimeSec(laps, seg, 1) * 1000 + laps * WR_TIME_LAP_OVERHEAD_MS + WR_TIME_BASE_SLACK_MS + photo);
}

/** 거리 점수 창 [Dmin, Dmax] — 진행(구간 시작~끝)과 달린 시간(곡선으로 갈 수 있는 거리)으로 */
export function wrDistWindow(c: Pick<WRRunClaim, 'laps' | 'arrived' | 'segment' | 'durationMs'>): { dMin: number; dMax: number } {
  const laps = wrEffectiveLaps(c);
  const seg = segOf(c);
  const base = laps * WR_LAP_LEN;
  const dMin = Math.floor((base + seg * SEG_LEN) / WR_DIST_PER_POINT) - WR_DIST_SLACK_PTS;
  const byProgress = base + (seg + 1) * SEG_LEN;
  const byTime = wrDistAt(Math.max(0, c.durationMs) / 1000);
  const dMax = Math.floor(Math.min(byProgress, byTime) / WR_DIST_PER_POINT) + WR_DIST_SLACK_PTS;
  return { dMin, dMax: Math.max(dMax, dMin) };
}

/** 이 진행에서 받을 수 있는 웨딩 촬영 수 상한 */
export function wrPhotoMax(c: Pick<WRRunClaim, 'laps' | 'arrived' | 'segment'>): number {
  return wrEffectiveLaps(c) + (segOf(c) >= WR_PHOTO_SEG ? 1 : 0);
}

/** 모을 수 있는 하트·봉투 점수 상한(엔진 생성기 예산) */
export function wrCollectMax(dMax: number): number {
  return Math.floor(WR_COLLECT_RATIO * dMax) + WR_COLLECT_SLACK_PTS;
}

/** 진행 점수 상한 — 엔진 규칙(config.ts)으로 그 진행·시간까지 낼 수 있는 최대 점수 */
export function wrMaxScoreByProgress(c: Pick<WRRunClaim, 'laps' | 'arrived' | 'segment' | 'durationMs'>): number {
  const { dMax } = wrDistWindow(c);
  return dMax + wrCollectMax(dMax) + WR_PHOTO_BONUS * wrPhotoMax(c) + WR_ARRIVE_BONUS * wrEffectiveLaps(c);
}

/**
 * 기록 대조. elapsedMs = 서버가 잰 '세션 시작 ~ 제출'(DB 세션 시작 시각 기준).
 * @returns 거절 이유(사용자용) 또는 null(통과)
 */
export function wrCheckRun(c: WRRunClaim, elapsedMs: number): string | null {
  // 달린 시간은 세션 시작 후 지난 서버 시간보다 길 수 없다(일시정지는 빠지니 짧은 건 괜찮다)
  if (c.durationMs > elapsedMs + WR_DURATION_SLACK_MS) return '달린 시간이 맞지 않아요';
  // ① 시간 창
  if (c.durationMs < wrMinDurationMs(c)) return '기록이 맞지 않아요';
  if (c.durationMs > wrMaxDurationMs(c)) return '기록이 맞지 않아요';
  // ⑤ 점수 상한은 두 시간 중 작은 값으로 — 클라가 durationMs 를 부풀려도, 서버 시간을 기다려 늘려도 이득이 없다
  const effMs = Math.min(c.durationMs, Math.max(0, elapsedMs));
  if (c.score > wrMaxScoreFor(effMs)) return '점수가 너무 높아요';
  const collected = c.hearts + c.envelopes;
  if (collected > c.score) return '모은 개수가 맞지 않아요';
  if (collected > Math.ceil((effMs / 1000) * WR_COLLECT_MAX_PER_SEC) + 5) return '모은 개수가 맞지 않아요';
  // ② ③ ④ 거리 점수 창·수집 예산·점수 항등
  const { dMin, dMax } = wrDistWindow(c);
  const cv = c.hearts * WR_HEART_VALUE + c.envelopes * WR_ENVELOPE_VALUE;
  if (cv > wrCollectMax(dMax)) return '모은 개수가 맞지 않아요';
  const dist = c.score - cv - WR_ARRIVE_BONUS * wrEffectiveLaps(c);
  if (dist > dMax + WR_PHOTO_BONUS * wrPhotoMax(c)) return '점수가 너무 높아요';
  // 엔진의 '달린 초 × 70' 자르기가 걸린 판만 아래쪽 면제(정상 플레이에선 일어나지 않음)
  const clipped = c.score >= Math.floor((c.durationMs / 1000) * WR_MAX_SCORE_PER_SEC) - 1;
  if (!clipped && dist < dMin) return '기록이 맞지 않아요';
  return null;
}

/**
 * 자동 보류 — 대조는 통과했지만 사람이 내기 어려운 판(완주 3번 이상·수집이 거리 상한의 0.62~0.50배 넘음·12분 넘게 무사고).
 * 숨김(hiddenReason 'auto:<이유>')으로 저장하고 순위 요약에는 넣지 않는다 → 운영자가 확인 후 숨김 해제(요약 다시 계산)하면 반영.
 * @returns 보류 이유(운영 목록용 짧은 영문 키) 또는 null
 */
export function wrHoldReason(c: WRRunClaim): string | null {
  if (wrEffectiveLaps(c) >= WR_HOLD_LAPS) return 'many-laps';
  if (c.durationMs > WR_HOLD_DURATION_MS) return 'long-run';
  const { dMax } = wrDistWindow(c);
  const cv = c.hearts * WR_HEART_VALUE + c.envelopes * WR_ENVELOPE_VALUE;
  // 수집 보류선은 거리에 따라 0.62 → 0.50(긴 판일수록 낮게 — game.constants wrHoldCollectRatio 근거)
  if (dMax > WR_HOLD_COLLECT_MIN_PTS && cv > wrHoldCollectRatio(dMax) * dMax) return 'high-collect';
  if (c.durationMs >= WR_HOLD_RATE_MIN_MS && c.score / (c.durationMs / 1000) > WR_HOLD_SCORE_PER_SEC) return 'high-rate';
  return null;
}
