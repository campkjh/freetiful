// 웨딩런 엔진 ↔ 화면 약속 타입 (261011 사장 '웨딩런: 신혼집까지 달려!')
//  · 화면 쪽 ui/types.ts 와 같은 모양(구조적 타입) — 화면은 엔진을 dynamic import 로만 받는다.
//  · stage 0~4(1~5단계), segment 0~11(서울~신혼집), lap = 지금 몇 번째 여정(1부터), result.laps = 신혼집 도착 횟수.

export type WREventKind = 'bouquet' | 'ceremony' | 'groom' | 'honeymoon' | 'photo' | 'shield' | 'arrive' | 'next-journey' | 'tutorial' | 'gimmick';

export type WRResult = {
  score: number;
  stage: number;
  segment: number;
  arrived: boolean;
  laps: number;
  durationMs: number;
  hearts: number;
  envelopes: number;
};

export type WREvent =
  | { type: 'loading'; progress: number }
  | { type: 'ready' }
  | { type: 'score'; score: number; stage: number; segment: number; toHome: number; lap: number }
  | { type: 'stage'; stage: number; text: string }
  | { type: 'segment'; index: number; name: string }
  /** (261011 사장 '맵이 바뀔 때마다 어떤 맵인지 페이드인되는 제목') 구간 경계를 지나는 순간 — '02 · 종로' + 한 줄 */
  | { type: 'maptitle'; index: number; no: string; name: string; line: string; lap: number }
  /** 2단 점프로 머리가 왼쪽 위 구간 알약 밑을 지날 때 흐리게(dim) */
  | { type: 'hud'; dim: boolean }
  | { type: 'event'; kind: WREventKind; text: string }
  | { type: 'shield'; on: boolean }
  | { type: 'arrive'; lap: number }
  | { type: 'autopause' }
  | { type: 'gameover'; result: WRResult };

export type WRGame = {
  /** 첫 판 시작(준비 전이면 준비되는 즉시). 끝난 뒤 부르면 restart 와 같다 */
  start(): void;
  pause(): void;
  /** 화면이 3·2·1 카운트다운을 끝낸 뒤 부른다 */
  resume(): void;
  /** 점수·타이머·입력·월드 완전 초기화 후 곧바로 새 판 */
  restart(): void;
  /** 버튼 누름/뗌 — 점프·슬라이드 동시 누름 지원 */
  setInput(kind: 'jump' | 'slide', down: boolean): void;
  setSound(on: boolean): void;
  isPaused(): boolean;
  destroy(): void;
};

export type WRCreateOpts = { onEvent: (e: WREvent) => void };
