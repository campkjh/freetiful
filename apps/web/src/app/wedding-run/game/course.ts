// 웨딩런 코스(한 바퀴 = 서울 → … → 신혼집 12구간) 배치·속도·난이도 계산 (261011 사장 '웨딩런: 신혼집까지 달려!')
//  · 순수 계산만(Phaser 없음). 거리는 '이번 바퀴 시작부터' 설계 좌표.
//  · 속도는 바퀴 안 위치로 정해진다 → 같은 지점은 늘 같은 속도(이벤트 위치·안전 구간·서버 시간 창을 미리 계산 가능).
//  · (261011 사장 '갈수록 완전 더 어렵게' + '더 갈수록 빨라지게') 속도 = 구간 계단 + 바퀴마다 시작·상한 상승, 밀도도 구간 계단.
import { WR_SEGMENTS } from '../assets';
import {
  DENSITY,
  GIMMICK_TITLE_GUARD,
  HONEYMOON_AT,
  LAP_LEN,
  LIGHT_ZONE,
  MAX_SPEED,
  MOVE_MUL,
  PHOTO_AT,
  QUIET,
  SEGMENT_WEIGHTS,
  SHIELD_AT,
  SPEED_BLEND,
  SPEED_KAPPA,
  SPEED_LAP_PLUS,
  SPEED_LAPS,
  SPEED_V0_MAX,
  STAGE_AT,
  type CoursePoint,
} from './config';

export const SEG_COUNT = WR_SEGMENTS.length; // 12

const W_SUM = SEGMENT_WEIGHTS.slice(0, SEG_COUNT).reduce((a, b) => a + b, 0);
/** 구간 길이·시작(바퀴 기준 거리) */
export const SEG_LEN: number[] = WR_SEGMENTS.map((_, i) => (LAP_LEN * (SEGMENT_WEIGHTS[i] ?? 1)) / W_SUM);
export const SEG_START: number[] = SEG_LEN.map((_, i) => SEG_LEN.slice(0, i).reduce((a, b) => a + b, 0));

export function pointDist(p: CoursePoint): number {
  const s = Math.max(0, Math.min(SEG_COUNT - 1, p.seg));
  return SEG_START[s] + SEG_LEN[s] * Math.max(0, Math.min(1, p.f));
}

export const STAGE_DIST: number[] = STAGE_AT.map(pointDist);
export const PHOTO_DIST = pointDist(PHOTO_AT);
export const SHIELD_DIST = pointDist(SHIELD_AT);
export const HONEYMOON_DIST = pointDist(HONEYMOON_AT);

/** 바퀴 lap(1부터)의 [v0, 구간당 Δ, 상한] — 6바퀴~ 는 v0 += 10/바퀴(최대 760), 상한 MAX_SPEED */
export function lapSpeedCfg(lap: number): readonly [number, number, number] {
  const n = SPEED_LAPS.length;
  if (lap <= n) return SPEED_LAPS[Math.max(0, lap - 1)];
  const [v0, d] = SPEED_LAPS[n - 1];
  return [Math.min(v0 + SPEED_LAP_PLUS * (lap - n), SPEED_V0_MAX), d, MAX_SPEED];
}

/** 경계 섞기 없는 곡선 v(바퀴, 구간, f) — 서버 game-rules.ts wrSpeed 와 같은 식 */
export function rawSpeed(lap: number, seg: number, f: number): number {
  const [v0, d, cap] = lapSpeedCfg(lap);
  return Math.min(cap, MAX_SPEED, v0 + d * seg + d * SPEED_KAPPA * Math.max(0, Math.min(1, f)));
}

/** 바퀴 안 거리 → 구간 번호 0~11 */
export function segmentAt(d: number): number {
  if (d <= 0) return 0;
  for (let i = SEG_COUNT - 1; i >= 0; i--) if (d >= SEG_START[i]) return i;
  return 0;
}

/** 바퀴 안 거리 → 그 구간 안 비율 0~1 */
export function segFrac(d: number): number {
  const s = segmentAt(d);
  return Math.max(0, Math.min(1, (d - SEG_START[s]) / SEG_LEN[s]));
}

/**
 * 바퀴 lap(1부터)·바퀴 안 거리 d 에서의 목표 땅 속도.
 * 구간 경계 B 에서는 [B, B + SPEED_BLEND] 동안 smoothstep 으로 앞 구간 끝 속도 → 새 구간 속도(급가속 없음).
 */
export function speedAt(lap: number, d: number): number {
  const dd = Math.max(0, Math.min(LAP_LEN, d));
  const s = segmentAt(dd);
  const into = dd - SEG_START[s];
  const v = rawSpeed(lap, s, into / SEG_LEN[s]);
  if (s > 0 && into < SPEED_BLEND) {
    const prev = rawSpeed(lap, s - 1, 1);
    const t = into / SPEED_BLEND;
    const k = t * t * (3 - 2 * t);
    return prev + (v - prev) * k;
  }
  return v;
}

/** 구간 하나를 달리는 시간(닫힌 꼴, 경계 섞기 무시 — 서버와 같은 시험 값) */
export function segTimeSec(lap: number, seg: number): number {
  const a = rawSpeed(lap, seg, 0);
  const b = rawSpeed(lap, seg, 1);
  const L = SEG_LEN[seg];
  if (Math.abs(b - a) < 1e-9) return L / a;
  return (L / (b - a)) * Math.log(b / a);
}

/** 한 바퀴 달린 시간(연출 제외) — 1바퀴 176.4 · 2바퀴 147.3 · 3바퀴 132.8 · 4바퀴 125.0 */
export function lapTimeSec(lap: number): number {
  let t = 0;
  for (let s = 0; s < SEG_COUNT; s++) t += segTimeSec(lap, s);
  return t;
}

/**
 * 진행도·난이도(구간 단위 계단): Lv = (바퀴−1) + (구간 + 0.35·f)/12,
 * diff = clamp(Lv/2, 0, 1) — 1바퀴 끝 ≈ 0.47, 2바퀴 끝 ≈ 0.97, 3바퀴부터 1 · over = clamp((Lv−2)/2, 0, 1) — 3바퀴부터 더.
 */
export function level(lap: number, d: number): { lv: number; diff: number; over: number } {
  const dd = Math.max(0, Math.min(LAP_LEN, d));
  const lv = lap - 1 + (segmentAt(dd) + 0.35 * segFrac(dd)) / SEG_COUNT;
  return { lv, diff: Math.max(0, Math.min(1, lv / 2)), over: Math.max(0, Math.min(1, (lv - 2) / 2)) };
}

/** 예전 이름 유지(확인용) — diff 값 */
export function difficulty(lap: number, d: number): number {
  return level(lap, d).diff;
}

/** 밀도 값 a − b·diff − c·over */
export function density(k: keyof Pick<typeof DENSITY, 'pad' | 'gapMul' | 'breath' | 'pit'>, lap: number, d: number): number {
  const { diff, over } = level(lap, d);
  const [a, b, c] = DENSITY[k];
  return k === 'pit' ? a + b * diff + c * over : a - b * diff - c * over;
}

/** 움직이는 장애물 속도 배수 */
export function moveMul(lap: number, d: number): number {
  const { diff, over } = level(lap, d);
  return lerp2(MOVE_MUL, diff) + DENSITY.moveOver * over;
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerp2 = (pair: readonly [number, number], t: number) => lerp(pair[0], pair[1], t);

export type Zone = [number, number];

function mergeZones(z: Zone[]): Zone[] {
  z.sort((a, b) => a[0] - b[0]);
  const out: Zone[] = [];
  for (const q of z) {
    const last = out[out.length - 1];
    if (last && q[0] <= last[1]) last[1] = Math.max(last[1], q[1]);
    else out.push([q[0], q[1]]);
  }
  return out;
}

/**
 * 장애물을 두지 않는 안전 구간(바퀴 기준 거리). 초 단위 설정을 그 지점 속도로 거리로 바꾼다.
 *  · stagesLeft = 아직 남은 단계 전환(첫 바퀴만) — 다음 판·다음 바퀴엔 단계 연출이 없다.
 */
export function quietZones(lap: number, opts: { stagesFrom: number }): Zone[] {
  const z: Zone[] = [];
  const at = (d: number, before: number, after: number) => {
    const v = speedAt(lap, d);
    z.push([d - before * v, d + after * v]);
  };
  // 출발 직후(첫 바퀴=게임 시작, 다음 바퀴=다음 여정 출발)
  z.push([-1e9, (lap === 1 ? QUIET.start : QUIET.nextJourney) * speedAt(lap, 0)]);
  // 구간 경계(배경 교차 전환 + 맵 제목)
  for (let i = 1; i < SEG_COUNT; i++) {
    const v = Math.max(speedAt(lap, SEG_START[i] - 1), speedAt(lap, SEG_START[i] + SPEED_BLEND));
    z.push([SEG_START[i] - QUIET.segment[0] * v, SEG_START[i] + QUIET.segment[1] * v]);
  }
  // 단계 전환(첫 바퀴 — 남은 것만)
  for (let s = Math.max(1, opts.stagesFrom); s < STAGE_DIST.length; s++) {
    const q = s === 3 ? QUIET.groom : QUIET.stage;
    at(STAGE_DIST[s], q[0], q[1]);
  }
  at(PHOTO_DIST, QUIET.photo[0], QUIET.photo[1]);
  at(SHIELD_DIST, QUIET.shield[0], QUIET.shield[1]);
  at(HONEYMOON_DIST, QUIET.honeymoon[0], QUIET.honeymoon[1]);
  // 신혼집 앞 마지막 직선 ~ 바퀴 끝 너머
  z.push([LAP_LEN - QUIET.arrive * speedAt(lap, LAP_LEN), 1e12]);
  return mergeZones(z);
}

/** 맵 제목이 떠 있는 '가벼운 구간'(경계 뒤 1.4~2.6초) — 간격 ×1.35, 바닥 틈 금지 */
export function lightZones(lap: number): Zone[] {
  const z: Zone[] = [];
  for (let i = 1; i < SEG_COUNT; i++) {
    const v = speedAt(lap, SEG_START[i] + SPEED_BLEND);
    z.push([SEG_START[i] + LIGHT_ZONE.from * v, SEG_START[i] + LIGHT_ZONE.to * v]);
  }
  return z;
}

/** 기믹 예고·접촉 금지(맵 제목 시간: 경계 −0.6 ~ +2.6초) + 출발 직후 */
export function noGimmickZones(lap: number): Zone[] {
  const z: Zone[] = [];
  z.push([-1e9, ((lap === 1 ? QUIET.start : QUIET.nextJourney) + 1.2) * speedAt(lap, 0)]);
  for (let i = 1; i < SEG_COUNT; i++) {
    const v = Math.max(speedAt(lap, SEG_START[i] - 1), speedAt(lap, SEG_START[i] + SPEED_BLEND));
    z.push([SEG_START[i] - GIMMICK_TITLE_GUARD[0] * v, SEG_START[i] + GIMMICK_TITLE_GUARD[1] * v]);
  }
  return mergeZones(z);
}

/** [a,b] 가 안전 구간과 겹치면 그 안전 구간 끝, 아니면 null */
export function overlapQuiet(zones: Zone[], a: number, b: number): number | null {
  for (const q of zones) {
    if (q[0] > b) break;
    if (q[1] >= a) return q[1];
  }
  return null;
}

/** x 가 구간 안에 있나 */
export function inZones(zones: Zone[], x: number): boolean {
  for (const q of zones) {
    if (q[0] > x) return false;
    if (x <= q[1]) return true;
  }
  return false;
}
