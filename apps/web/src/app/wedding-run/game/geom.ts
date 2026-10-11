// 웨딩런 충돌·표시 크기 계산 (261011 사장 '웨딩런') — assets.ts 의 이미지 px 값을 설계 좌표로 바꾼다.
//  · 좌표: x = 피벗 기준 오른쪽(+), 높이 = 땅(피벗) 기준 위쪽(+). 충돌 상자는 '관대하게' 줄인 값.
import { WR_CHAR, WR_GROOM, type WrBox, type WrCharStage, type WrObstacle } from '../assets';
import { CHAR_H, OBS_HIT, OBSTACLE_TUNING, PLAYER_HIT_H, PLAYER_HIT_W } from './config';

export type Box = { x0: number; x1: number; b: number; t: number }; // 피벗 기준 좌우·아래·위

function boxFrom(hb: WrBox, pivot: { x: number; y: number }, s: number, flip: boolean, w: number): Box {
  let x0 = (hb.x - pivot.x) * s;
  let x1 = (hb.x + hb.w - pivot.x) * s;
  if (flip) {
    // 좌우 반전: 이미지 안 x → w - x, 피벗도 반전 → 피벗 기준으로는 부호만 뒤집힘
    const nx0 = -x1;
    const nx1 = -x0;
    x0 = nx0;
    x1 = nx1;
  }
  void w;
  const b = (pivot.y - (hb.y + hb.h)) * s;
  const t = (pivot.y - hb.y) * s;
  return { x0, x1, b, t };
}

function shrink(bx: Box, kw: number, kh: number): Box {
  const cx = (bx.x0 + bx.x1) / 2;
  const hw = ((bx.x1 - bx.x0) / 2) * kw;
  const cy = (bx.b + bx.t) / 2;
  const hh = ((bx.t - bx.b) / 2) * kh;
  return { x0: cx - hw, x1: cx + hw, b: cy - hh, t: cy + hh };
}

/* ───────── 캐릭터 ───────── */

export type PoseKind = 'run' | 'jump' | 'slide';

export type CharGeom = {
  stage: WrCharStage;
  /** 표시 배율(달리기 몸 높이 = CHAR_H) */
  scale: number;
  /**
   * 충돌 상자 — '기준점'(월드 x = worldX, 화면 x = PLAYER_X) 기준. 그림 피벗(신부 발)은 기준점 + offX 에 그린다.
   * 1~3단계는 offX = 0(신부 발 = 기준점). 4·5단계(커플)는 아래 offX 만큼 왼쪽으로 그려 충돌 앞끝이 1~3단계와 같은 자리.
   */
  hit: Record<PoseKind, Box>;
  /**
   * 그림 피벗(신부 발)을 기준점에서 이만큼 옮겨 그린다(설계 좌표, 음수 = 왼쪽).
   * (261011 사장 사양서 [4] '커플이 됐다는 이유로 충돌 난도가 갑자기 높아지지 않게' — 검증: 4단계 충돌 앞끝이 신랑 쪽으로 ≈74 앞서
   *  같은 박자로 뛰면 착지하다 걸림) → 커플 그림을 뒤로 그려 '앞 사람(신랑) 충돌 앞끝 = 1~3단계 신부 충돌 앞끝' 으로 고정한다.
   *  눈으로 맞추는 기준(앞 사람 앞끝)과 충돌 앞끝이 단계와 상관없이 같은 화면 x 에 있다.
   */
  offX: number;
};

const RAW_CHAR_HIT = WR_CHAR.map((c) => {
  const s = CHAR_H / c.refH;
  const hit = {} as Record<PoseKind, Box>;
  (['run', 'jump', 'slide'] as PoseKind[]).forEach((k) => {
    const ss = k === 'slide' ? s * c.slideScale : s;
    hit[k] = shrink(boxFrom(c.hitbox[k], c.pivot, ss, false, c.frames.run_01.w), PLAYER_HIT_W, PLAYER_HIT_H);
  });
  return { stage: c, scale: s, hit };
});

/** 1~3단계(신부 혼자) 달리기 충돌 앞끝 평균(≈ +32.7) — 커플 단계 앞끝을 여기에 맞춘다 */
const SOLO_FRONT = (() => {
  const solo = RAW_CHAR_HIT.filter((g) => g.stage.stage <= 3);
  return solo.reduce((a, g) => a + g.hit.run.x1, 0) / Math.max(1, solo.length);
})();

const shiftBox = (b: Box, dx: number): Box => ({ x0: b.x0 + dx, x1: b.x1 + dx, b: b.b, t: b.t });

export const CHAR_GEOM: CharGeom[] = RAW_CHAR_HIT.map(({ stage, scale, hit }) => {
  // 커플 단계(4·5)만 — 4단계 ≈ -74, 5단계 ≈ -56. 자세(달리기·점프·슬라이드)마다 다르게 옮기면 그림이 자세마다 튀므로 단계당 하나(달리기 앞끝 기준).
  const offX = stage.stage >= 4 ? Math.round(SOLO_FRONT - hit.run.x1) : 0;
  return {
    stage,
    scale,
    offX,
    hit: { run: shiftBox(hit.run, offX), jump: shiftBox(hit.jump, offX), slide: shiftBox(hit.slide, offX) },
  };
});

/** 간격 계산용 플레이어 충돌 폭(모든 단계·자세 중 가장 넓은 값 — 보수적으로) */
export const PLAYER_HIT_MAX_W = Math.max(...CHAR_GEOM.flatMap((g) => [g.hit.run, g.hit.jump, g.hit.slide].map((b) => b.x1 - b.x0)));
/** 머리 위 장애물 판정에 쓰는 슬라이드 위끝 최댓값 */
export const PLAYER_SLIDE_MAX_TOP = Math.max(...CHAR_GEOM.map((g) => g.hit.slide.t));

/** 신랑 단독(합류 연출) 배율 = 4단계 배율 */
export const GROOM_SCALE = CHAR_H / WR_CHAR[3].refH;
export const GROOM_JOIN = { x: WR_GROOM.joinOffset.x * GROOM_SCALE, y: WR_GROOM.joinOffset.y * GROOM_SCALE };

/* ───────── 장애물 ───────── */

export type ObsGeom = {
  def: WrObstacle;
  scale: number;
  flip: boolean;
  /** 자체 이동 속도(땅 속도 대비, 0=제자리) */
  move: number;
  hit: Box;
  /** 충돌 폭 */
  w: number;
  /** 'jump' = 점프로 넘기(지상·움직이는 지상) / 'slide' = 슬라이드로 지나기(머리 위·나는 것) */
  action: 'jump' | 'slide';
  /** 피벗을 땅에서 띄우는 높이(나는 것만, 충돌 아래끝 = clearance×CHAR_H) */
  lift: number;
  /** 화면 표시 폭(그림 전체) */
  drawW: number;
  /** 코드로 그린 기믹 장애물(번개·전기 띠·말풍선·리본·눕힌 서핑보드) — gimmicks.ts codeGeom (261011 사장 기믹) */
  code?: 'bolt' | 'zap' | 'bubble' | 'ribbon' | 'surf';
};

const geomCache = new Map<WrObstacle, ObsGeom>();

export function obsGeom(def: WrObstacle): ObsGeom {
  const hit0 = geomCache.get(def);
  if (hit0) return hit0;
  const f0 = def.frames[0];
  const s = (def.scaleHint * CHAR_H) / f0.h;
  const tune = OBSTACLE_TUNING[def.key] ?? {};
  const flip = !!tune.flip;
  const hit = shrink(boxFrom(def.hitbox, def.pivot, s, flip, f0.w), OBS_HIT, OBS_HIT);
  const action: 'jump' | 'slide' = def.kind === 'air' || def.kind === 'flying' ? 'slide' : 'jump';
  let lift = 0;
  if (def.kind === 'flying') {
    const clear = (def.clearance ?? 0.7) * CHAR_H;
    lift = clear - hit.b;
  }
  const g: ObsGeom = {
    def,
    scale: s,
    flip,
    move: def.kind === 'moving-ground' || def.kind === 'flying' ? tune.move ?? 0.15 : 0,
    hit,
    w: hit.x1 - hit.x0,
    action,
    lift,
    drawW: f0.w * s,
  };
  geomCache.set(def, g);
  return g;
}
