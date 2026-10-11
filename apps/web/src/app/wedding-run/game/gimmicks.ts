// 웨딩런 기믹 정의 — 18종(사장 지정 3 + 추가 15) (261011 사장 '갈수록 완전 더 어렵게, 기믹도 많이' · '어렵게'와 '공정하게' 둘 다)
//  · 순수 계산(Phaser 없음) — 코스 생성기(planner.ts)가 배치하고, 장면(scene.ts)이 그린다.
//  · 새 그림 없이 구간 장애물 그림 + 코드 그림(번개·전기 띠·말풍선·리본)만 쓴다.
//  · 공정성 불변식(설계 §5): 접촉 0.9초 이상 전 예고 · 움직이는 기믹은 마지막 0.6초 등속 · 회피 창 ≥ 0.25초 · 제목 시간엔 기믹 없음.
//  · 움직임은 '남은 시간 τ(= 플레이어가 만남 자리까지 남은 거리 ÷ 계획 속도)'의 함수 → 프레임과 무관하게 생성기 계산과 같은 자리에서 만난다.
import type { WrObstacle } from '../assets';
import { CHAR_H, GIMMICK_TUNING as GT } from './config';
import type { Box, ObsGeom } from './geom';

export type GimmickId =
  | 'mil-bolt'
  | 'zap-floor'
  | 'blackout'
  | 'nag-barrage'
  | 'pigeon-dive'
  | 'kid-rush'
  | 'royal-triple'
  | 'rack-slide'
  | 'dryer-wind'
  | 'paper-rain'
  | 'photo-flash'
  | 'turbulence'
  | 'monkey-hop'
  | 'surf-wave'
  | 'robo-zigzag'
  | 'cat-pounce'
  | 'clap-rhythm'
  | 'arch-tunnel';

export type EnvKind = 'blackout' | 'flash' | 'wind' | 'turb';
export type WarnKind = 'ground' | 'head' | 'sky' | 'none';

export interface GimmickDef {
  id: GimmickId;
  name: string;
  /** 대표 구간(0~11) */
  home: number;
  /** 환경형(화면·물리 바꿈) / 장애물형 */
  env: EnvKind | null;
  /** 이 바퀴부터(1바퀴에 없는 것 = 2) */
  minLap: number;
  /** 꼭 필요한 장애물 그림(없으면 이 기믹 대신 다른 것 — 공정성 규칙 10) */
  needs: string[];
  /** 2바퀴~ 상주 그림이라 어느 구간에서나 */
  anywhere: boolean;
  /** 2바퀴~ 뽑기 가중치(대표 구간이면 ×2) */
  weight: number;
  /** 화면 밖일 때 오른쪽 끝 경고 아이콘(땅=분홍 '!', 머리=노랑 번개, 하늘=파랑 그림자) */
  warnKind: WarnKind;
  /** 경고 소리 */
  sound: string;
}

export const GIMMICKS: Record<GimmickId, GimmickDef> = {
  'mil-bolt': { id: 'mil-bolt', name: '시어머니의 벼락', home: 3, env: null, minLap: 1, needs: [], anywhere: true, weight: 1.5, warnKind: 'head', sound: 'thunder' },
  'zap-floor': { id: 'zap-floor', name: '가전제품 바닥 전기', home: 5, env: null, minLap: 1, needs: [], anywhere: true, weight: 1.5, warnKind: 'ground', sound: 'hum' },
  blackout: { id: 'blackout', name: '정전', home: 5, env: 'blackout', minLap: 3, needs: [], anywhere: true, weight: 0.6, warnKind: 'none', sound: 'flicker' },
  'nag-barrage': { id: 'nag-barrage', name: '아버지 잔소리 탄막', home: 3, env: null, minLap: 1, needs: ['nagging_father'], anywhere: true, weight: 1, warnKind: 'head', sound: 'ahem' },
  'pigeon-dive': { id: 'pigeon-dive', name: '비둘기 급강하', home: 0, env: null, minLap: 1, needs: ['pigeon'], anywhere: true, weight: 1, warnKind: 'sky', sound: 'coo' },
  'kid-rush': { id: 'kid-rush', name: '아이 역주행', home: 1, env: null, minLap: 1, needs: ['running_children'], anywhere: true, weight: 1, warnKind: 'ground', sound: 'rush' },
  'royal-triple': { id: 'royal-triple', name: '왕의 행렬 3연속', home: 2, env: null, minLap: 1, needs: ['royal_procession'], anywhere: false, weight: 1, warnKind: 'ground', sound: 'drum' },
  'rack-slide': { id: 'rack-slide', name: '드레스 행거 미끄럼', home: 4, env: null, minLap: 1, needs: ['dress_rack'], anywhere: false, weight: 1, warnKind: 'ground', sound: 'squeak' },
  'dryer-wind': { id: 'dryer-wind', name: '헤어드라이어 바람', home: 5, env: 'wind', minLap: 2, needs: ['flying_dyson'], anywhere: true, weight: 1, warnKind: 'head', sound: 'whirr' },
  'paper-rain': { id: 'paper-rain', name: '계약서 서류 비', home: 6, env: null, minLap: 1, needs: ['contract_stack'], anywhere: false, weight: 1, warnKind: 'sky', sound: 'paper' },
  'photo-flash': { id: 'photo-flash', name: '사진사 플래시', home: 8, env: 'flash', minLap: 2, needs: ['wedding_photographer'], anywhere: false, weight: 1, warnKind: 'ground', sound: 'beep' },
  turbulence: { id: 'turbulence', name: '비행기 난기류', home: 9, env: 'turb', minLap: 1, needs: ['service_cart'], anywhere: false, weight: 1, warnKind: 'ground', sound: 'dingdong' },
  'monkey-hop': { id: 'monkey-hop', name: '원숭이 깡충', home: 10, env: null, minLap: 1, needs: ['playful_monkey'], anywhere: false, weight: 1, warnKind: 'ground', sound: 'monkey' },
  'surf-wave': { id: 'surf-wave', name: '서핑보드 파도', home: 10, env: null, minLap: 1, needs: ['surfboard'], anywhere: false, weight: 1, warnKind: 'head', sound: 'splash' },
  'robo-zigzag': { id: 'robo-zigzag', name: '로봇청소기 지그재그', home: 11, env: null, minLap: 1, needs: ['robot_vacuum'], anywhere: false, weight: 1, warnKind: 'ground', sound: 'robo' },
  'cat-pounce': { id: 'cat-pounce', name: '고양이 기습 점프', home: 11, env: null, minLap: 1, needs: ['home_cat'], anywhere: false, weight: 1, warnKind: 'sky', sound: 'meow' },
  'clap-rhythm': { id: 'clap-rhythm', name: '하객 박수 리듬', home: 8, env: null, minLap: 1, needs: ['clapping_guests'], anywhere: false, weight: 1, warnKind: 'ground', sound: 'clap' },
  'arch-tunnel': { id: 'arch-tunnel', name: '꽃 아치 터널', home: 7, env: null, minLap: 1, needs: ['floral_arch', 'guest_chair'], anywhere: false, weight: 1, warnKind: 'head', sound: 'chime' },
};

export const GIMMICK_IDS = Object.keys(GIMMICKS) as GimmickId[];

/**
 * 1바퀴(배우는 바퀴) — 고정 순서, 구간당 1~3개, 겹침 없음(설계 §7.1). f = 구간 안 위치.
 * 정해진 자리가 안전 구간·제목 구간과 겹치면 뒤로 밀고, 구간 끝 전까지 못 놓으면 생략.
 */
export const LAP1_SCHEDULE: ReadonlyArray<{ seg: number; f: number; id: GimmickId; opt?: 'practice' | 'blackout' }> = [
  { seg: 0, f: 0.7, id: 'pigeon-dive' },
  { seg: 1, f: 0.45, id: 'kid-rush' },
  { seg: 2, f: 0.5, id: 'royal-triple' },
  { seg: 3, f: 0.35, id: 'mil-bolt' },
  { seg: 3, f: 0.72, id: 'nag-barrage' },
  { seg: 4, f: 0.6, id: 'rack-slide' },
  { seg: 5, f: 0.15, id: 'zap-floor', opt: 'practice' },
  { seg: 5, f: 0.42, id: 'zap-floor' },
  { seg: 5, f: 0.66, id: 'zap-floor', opt: 'blackout' },
  { seg: 6, f: 0.65, id: 'paper-rain' },
  { seg: 7, f: 0.72, id: 'arch-tunnel' },
  { seg: 8, f: 0.48, id: 'clap-rhythm' },
  { seg: 9, f: 0.45, id: 'turbulence' },
  { seg: 10, f: 0.35, id: 'monkey-hop' },
  { seg: 10, f: 0.7, id: 'surf-wave' },
  { seg: 11, f: 0.3, id: 'robo-zigzag' },
  { seg: 11, f: 0.62, id: 'cat-pounce' },
];

/**
 * 2바퀴~ 구간당 기믹 일정 수 · 구간당 환경형 최대 · 환경형 중 겹쳐 나오는 장애물 기믹 수(동시 2 → 3 → 4).
 * (261011 검증 medium '2→3바퀴 기믹 수가 거의 안 늚') 일정 수는 '목표'이고 실제 수는 시간이 정한다 — 기믹 하나가 2~4초를 쓰고
 * 구간마다 맵 제목 3.2초·이벤트 연출이 빠져서 3바퀴(구간 ≈ 11.6초)에서 구간당 3.3개 남짓이 한계.
 * 그래서 늘리는 건 '겹침'으로: 환경형 뒤 연쇄 기믹은 일정을 더 쌓지 않고 곧 올 일반 일정을 환경 안으로 당겨 오고(planner trySchedule),
 * 바람·난기류는 자체 장애물을 줄여(바람 지상 1개·카트 2대·사진사 1명) 그 시간을 연쇄가 환경 속에서 쓴다.
 * 코스 생성기만 돌린 시험(scratchpad wrun4/plansim.ts, 40판): 바퀴당 기믹 1바퀴 16 · 2바퀴 32 · 3바퀴 37 · 4바퀴 34
 * (초당 0.09 · 0.22 · 0.28 · 0.27 — 4바퀴~ 는 더 빨라 바퀴가 짧아진 만큼 수는 비슷, 속도·동시 4로 어려워짐),
 * 실제로 환경 안에서 겹친 연쇄 0 · 4.2 · 7.2 · 6.4. 4바퀴~ 일정 수를 더 올려도 시간이 없어 '기한 넘김'만 는다.
 */
export const GIMMICKS_PER_SEG: readonly number[] = [0, 2.8, 4.5, 4.5];
export const ENV_PER_SEG: readonly number[] = [0, 1, 2, 2];
export const ENV_CHAIN: readonly number[] = [0, 1, 2, 3];
const byLap = (arr: readonly number[], lap: number) => arr[Math.max(0, Math.min(arr.length - 1, lap - 1))];
export const gimmicksPerSeg = (lap: number) => byLap(GIMMICKS_PER_SEG, lap);
export const envPerSeg = (lap: number) => byLap(ENV_PER_SEG, lap);
export const envChain = (lap: number) => byLap(ENV_CHAIN, lap);

/** 환경형 × 장애물형 겹침 허용표(설계 §7.2) — 환경형 2개 동시는 없음 */
const X = (ids: GimmickId[]) => new Set<GimmickId>(ids);
export const ENV_COMPAT: Record<EnvKind, Set<GimmickId>> = {
  blackout: X(['mil-bolt', 'nag-barrage', 'kid-rush', 'royal-triple', 'rack-slide', 'monkey-hop', 'robo-zigzag', 'cat-pounce', 'clap-rhythm', 'arch-tunnel']),
  turb: X(['mil-bolt', 'nag-barrage', 'kid-rush', 'royal-triple', 'rack-slide', 'paper-rain', 'monkey-hop', 'robo-zigzag', 'cat-pounce', 'clap-rhythm', 'arch-tunnel']),
  wind: X(['nag-barrage', 'pigeon-dive', 'kid-rush', 'royal-triple', 'rack-slide', 'paper-rain', 'monkey-hop', 'robo-zigzag', 'cat-pounce', 'arch-tunnel']),
  flash: X(['mil-bolt', 'zap-floor', 'nag-barrage', 'kid-rush', 'royal-triple', 'rack-slide', 'monkey-hop', 'surf-wave', 'robo-zigzag', 'cat-pounce', 'clap-rhythm', 'arch-tunnel']),
};
/** 정전 중 바닥 전기는 3바퀴부터 */
export function envAllows(env: EnvKind, id: GimmickId, lap: number): boolean {
  if (env === 'blackout' && id === 'zap-floor') return lap >= 3;
  return ENV_COMPAT[env].has(id);
}

/** 정전·플래시 앞뒤(초)엔 바닥 틈·그림자 신호 기믹(급강하·서류 비·서핑) 금지 — 공정성 규칙 6 */
export const DARK_GUARD_SEC = 0.5;
export const SHADOW_SIGNAL: ReadonlySet<GimmickId> = X(['pigeon-dive', 'paper-rain', 'surf-wave']);

/* ───────── 움직임(τ = 만남까지 남은 시간) ───────── */

export type Motion =
  | { k: 'bolt' }
  | { k: 'accel'; m1: number }
  | { k: 'dive'; m: number; from: number }
  | { k: 'drop' }
  | { k: 'pounce'; m1: number; shelf: number }
  | { k: 'zigzag'; a: number; b: number; c: number }
  | { k: 'hop'; m: number }
  | { k: 'wave'; m: number };

const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));

/** 자체 속도(땅 속도 대비, 플레이어 쪽 +) — 마지막 0.6초는 늘 등속(규칙 3) */
export function motionM(mo: Motion, tau: number): number {
  switch (mo.k) {
    case 'accel':
      // 처음엔 서 있다가 1.2초 전 '끼익' 가속 → 0.7초 전부터 등속
      return tau >= 1.2 ? 0 : tau <= 0.7 ? mo.m1 : lerp(mo.m1, 0, (tau - 0.7) / 0.5);
    case 'dive':
    case 'hop':
    case 'wave':
      return mo.m;
    case 'pounce':
      return tau >= 1.05 ? 0 : tau <= 0.7 ? mo.m1 : lerp(mo.m1, 0, (tau - 0.7) / 0.35);
    case 'zigzag':
      // 1.0초 밖: 0.4초마다 빨랐다 느렸다, 1.0초 안: 등속
      if (tau <= 1.0) return mo.c;
      return Math.floor((tau - 1.0) / 0.4) % 2 === 0 ? mo.b : mo.a;
    default:
      return 0;
  }
}

/** 추가 높이(충돌·그림 모두) */
export function motionY(mo: Motion, tau: number): number {
  switch (mo.k) {
    case 'dive': {
      // 높이 from 에서 diveSec 동안 사선 급강하 → 접촉 diveLevelAt 초 전에 머리 높이 도착 후 수평(흔들림 ±3)
      const t1 = GT.diveLevelAt;
      const t0 = t1 + GT.diveSec;
      if (tau <= t1) return Math.sin(tau * 8) * 3;
      if (tau >= t0) return mo.from;
      const k = (tau - t1) / GT.diveSec;
      return mo.from * k * k;
    }
    case 'drop':
      // 서류 더미가 하늘에서 떨어져 접촉 0.6초 전 착지
      return tau <= 0.6 ? 0 : Math.min(560, (tau - 0.6) * (tau - 0.6) * 2400 + (tau - 0.6) * 300);
    case 'pounce': {
      // 선반(shelf)에서 0.35초 호로 뛰어내려 0.7초 전 착지
      if (tau <= 0.7) return 0;
      if (tau >= 1.05) return mo.shelf;
      const k = (tau - 0.7) / 0.35; // 1 → 0
      return mo.shelf * k + 60 * Math.sin(Math.PI * k) * (1 - k);
    }
    case 'hop': {
      // 멀리선(1.3초 밖) 높이 튀어 오름(위험 없음), 가까이선 낮은 깡충(≤30)
      if (tau > 1.3) return 140 * Math.abs(Math.sin((tau * Math.PI) / 0.6));
      return 30 * Math.abs(Math.sin((tau * Math.PI) / 0.32));
    }
    case 'wave':
      // 서핑보드 아래끝 88 ↔ 150(1.4초 주기) — lift 는 장면이 보드 기준 높이 119 로 둠
      return 31 * Math.sin((2 * Math.PI * tau) / 1.4);
    default:
      return 0;
  }
}

/** 충돌이 켜져 있나(번개 내리꽂히기 전·서류 더미 착지 전·고양이 착지 전은 꺼짐) */
export function motionArmed(mo: Motion | undefined, tau: number): boolean {
  if (!mo) return true;
  if (mo.k === 'bolt') return tau <= GT.boltStrike;
  if (mo.k === 'drop') return tau <= 0.6;
  if (mo.k === 'pounce') return tau <= 0.7;
  return true;
}

/** 마지막 등속 구간의 자체 속도 */
export const motionEndM = (mo: Motion) => motionM(mo, 0);

/** S(τ) = ∫₀^τ m dτ' (초 단위 거리 비율 — 실제 거리 = v × S) 표: 0.01초 간격, maxSec 까지 */
export function motionTable(mo: Motion, maxSec = 6): Float32Array {
  const n = Math.ceil(maxSec / 0.01) + 1;
  const t = new Float32Array(n);
  let acc = 0;
  for (let i = 1; i < n; i++) {
    const tau = (i - 0.5) * 0.01;
    acc += motionM(mo, tau) * 0.01;
    t[i] = acc;
  }
  return t;
}

/** 표에서 S(τ) — τ<0 은 마지막 등속으로 이어감, 표 밖은 끝 기울기로 */
export function motionS(table: Float32Array, mo: Motion, tau: number): number {
  if (tau <= 0) return motionEndM(mo) * tau;
  const f = tau / 0.01;
  const i = Math.floor(f);
  if (i >= table.length - 1) return table[table.length - 1] + motionM(mo, tau) * (tau - (table.length - 1) * 0.01);
  return table[i] + (table[i + 1] - table[i]) * (f - i);
}

/* ───────── 코드 그림 장애물(번개·전기 띠·말풍선·리본·서핑보드) ───────── */

export type CodeKind = 'bolt' | 'zap' | 'bubble' | 'ribbon' | 'surf';

/** 코드 그림 장애물의 충돌·크기 — 그림 피벗(가운데 아래) 기준 */
export function codeGeom(code: CodeKind, hit: Box, action: 'jump' | 'slide', drawW: number, drawH: number, base?: WrObstacle): ObsGeom {
  const def: WrObstacle = base ?? {
    key: `g-${code}`,
    name: code,
    frames: [{ src: '', w: drawW, h: drawH }],
    anim: false,
    kind: action === 'slide' ? 'air' : 'ground',
    hitbox: { x: 0, y: 0, w: drawW, h: drawH },
    pivot: { x: drawW / 2, y: drawH },
    scaleHint: drawH / CHAR_H,
  };
  return { def, scale: 1, flip: false, move: 0, hit, w: hit.x1 - hit.x0, action, lift: 0, drawW, code };
}

/** 번개: 폭 30, 아래끝 84 ~ 하늘까지(점프로는 못 넘음, 슬라이드 위끝 64.5 → 여유 19.5) */
export const BOLT_GEOM = codeGeom('bolt', { x0: -15, x1: 15, b: GT.boltBottom, t: 5000 }, 'slide', 44, 400);
/** 잔소리 말풍선: 폭 48, 아래끝 86(여유 21.5) */
export const BUBBLE_GEOM = codeGeom('bubble', { x0: -24, x1: 24, b: 86, t: 124 }, 'slide', 78, 52);
/**
 * 잔소리 탄막 윗줄(아랫줄 바로 위, 그림 160~212) — (261011 검증 medium '계속 슬라이드!' 기믹을 2단 점프로 넘던 것)
 * 두 줄 사이 틈 42 < 점프 몸 높이 84~92 → 어떤 점프(1단·2단)로도 사이로 못 지나감, 위끝 206 > 2단 꼭대기 몸 아래끝 202.5 → 위로도 못 넘음.
 * 슬라이드(위끝 ≤ 64.5)만 통과 — 사장 원문 '아버지 잔소리 말풍선 탄막(슬라이드)'.
 */
export const BUBBLE_HI_GEOM = codeGeom('bubble', { x0: -24, x1: 24, b: 166, t: 206 }, 'slide', 78, 52);
/** 박수 꽃가루 리본: 폭 60, 아래끝 86 */
export const RIBBON_GEOM = codeGeom('ribbon', { x0: -30, x1: 30, b: 86, t: 112 }, 'slide', 84, 40);

/** 바닥 전기 띠: 충돌 길이 E = round(0.78·v − 72), 높이 0~18(그림은 양끝 10씩 더 김 — 충돌은 E) */
export function zapGeom(v: number): ObsGeom {
  const E = Math.max(120, Math.round(GT.zapK * v - GT.zapPlayerW));
  return codeGeom('zap', { x0: -E / 2, x1: E / 2, b: 0, t: GT.zapTop }, 'jump', E + 20, 34);
}

/** 서핑보드(눕힘): 폭 70·두께 18, 아래끝 = 119 + 31·sin → 88 ↔ 150 (lift 119 는 장면이 더함) */
export function surfGeom(board: WrObstacle): ObsGeom {
  const g = codeGeom('surf', { x0: -35, x1: 35, b: 0, t: 18 }, 'slide', 92, 40, board);
  return { ...g, lift: 119 };
}

/** 잔소리 말풍선 문구(무례하지 않게) */
export const NAG_LINES = ['어흠!', '결혼은 말이야', '라떼는', '에휴'];
