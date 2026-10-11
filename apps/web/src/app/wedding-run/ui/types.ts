// 웨딩런 화면 ↔ 엔진 약속 타입(261011 사장 '웨딩런: 신혼집까지 달려!' 2D 러너)
//  · 엔진(game/*.ts, Phaser 3)과 같은 모양을 화면 쪽에 따로 둔다 — 화면이 엔진 파일을 정적으로 import 하면
//    Phaser 가 페이지 첫 청크에 섞인다. 엔진은 ui/engine-loader.ts 가 dynamic import 로만 받는다.
//  · 모양이 같으면(구조적 타입) 엔진 모듈 결과를 그대로 넘길 수 있다.

export type WREventKind = 'bouquet' | 'ceremony' | 'groom' | 'honeymoon' | 'photo' | 'shield' | 'arrive' | 'next-journey' | 'tutorial' | 'gimmick';

export type WRResult = {
  score: number;
  /** 캐릭터 단계 0~4 */
  stage: number;
  /** 마지막 구간 0~11 */
  segment: number;
  /** 신혼집 1회 이상 도착 */
  arrived: boolean;
  /** 완주 수 */
  laps: number;
  /** 실제 달린 시간(일시정지 제외) */
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
  start(): void;
  pause(): void;
  /** 화면이 3·2·1 카운트다운을 끝낸 뒤 부른다 */
  resume(): void;
  /** 점수·타이머·입력 완전 초기화 */
  restart(): void;
  /** 버튼 누름/뗌 — 동시 터치 지원 */
  setInput(kind: 'jump' | 'slide', down: boolean): void;
  setSound(on: boolean): void;
  isPaused(): boolean;
  destroy(): void;
};

export type WRCreateGame = (parent: HTMLElement, opts: { onEvent: (e: WREvent) => void }) => Promise<WRGame>;
