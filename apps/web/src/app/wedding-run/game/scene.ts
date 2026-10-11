// 웨딩런 Phaser 장면 — 달리기·점프·슬라이드·장애물·구간·단계·이벤트·도착 (261011 사장 '웨딩런: 신혼집까지 달려!')
//  · Phaser 는 index.ts 가 dynamic import 로 받아 makeRunScene(Phaser) 로 넘긴다(여기선 타입만 import → SSR·다른 화면 번들에 안 섞임).
//  · 카메라는 고정(설계 좌표 = 화면 좌표, 세로 VIEW_H). 월드 x(달린 거리)는 계속 늘고, 모든 물체는 매 프레임 'wx - viewX' 로 그린다.
//  · 게임 상태(이 파일)와 UI 상태(React 화면)는 분리 — 화면은 onEvent 로만 듣고, setInput·pause 등으로만 조작한다.
import type * as PhaserNS from 'phaser';
import { WR_CHAR, WR_GROOM, WR_SEGMENTS, type WrMotion } from '../assets';
import * as C from './config';
import {
  HONEYMOON_DIST,
  lerp2,
  level,
  PHOTO_DIST,
  SEG_COUNT,
  SEG_START,
  segmentAt,
  SHIELD_DIST,
  speedAt,
  STAGE_DIST,
  difficulty,
} from './course';
import { GIMMICKS, motionArmed, motionS, motionTable, motionY, NAG_LINES, type GimmickId } from './gimmicks';
import { CHAR_GEOM, GROOM_JOIN, GROOM_SCALE, obsGeom, type Box, type PoseKind } from './geom';
import { defByKey, Planner, tUp, type MarkKind, type PlanDecor, type PlanItem, type PlanObs, type PlannerCtx, type PlanWarn } from './planner';
import type { WRSound } from './sound';
import { bubbleKey, countKey, hintKeyOf, makeGimmickTextures, makeTextures, TEX } from './textures';
import type { WREvent, WRResult } from './types';

type PhaserLib = typeof PhaserNS;
type Img = PhaserNS.GameObjects.Image;
type Emitter = PhaserNS.GameObjects.Particles.ParticleEmitter;

/* ───────── 텍스처 키 ───────── */
const MOTIONS: WrMotion[] = ['run_01', 'run_02', 'jump', 'slide', 'stumble', 'celebrate'];
export const K = {
  bg: (i: number) => `wr-bg-${i}`,
  pf: (i: number) => `wr-pf-${i}`,
  ob: (key: string, f: number) => `wr-ob-${key}-${f}`,
  ch: (s: number, m: WrMotion) => `wr-ch-${s}-${m}`,
  gr: (m: 'run_01' | 'run_02') => `wr-gr-${m}`,
};
type FileRef = { key: string; src: string };
const segFiles = (i: number): FileRef[] => {
  const sg = WR_SEGMENTS[i];
  return [
    { key: K.bg(i), src: sg.bg.src },
    { key: K.pf(i), src: sg.platform.src },
    ...sg.obstacles.flatMap((o) => o.frames.map((f, k) => ({ key: K.ob(o.key, k), src: f.src }))),
  ];
};
const charFiles = (s: number): FileRef[] => MOTIONS.map((m) => ({ key: K.ch(s, m), src: WR_CHAR[s].frames[m].src }));
/**
 * (261011 사장 기믹 '이후 바퀴엔 아무 데서나') 1바퀴 가전 매장부터 메모리에 남겨 두는 장애물 그림 9장
 * (시어머니 2·아버지 2·세탁기·이동식 TV·드라이어 3) — 2바퀴~ 벼락·잔소리·바닥 전기 장식·바람을 어느 구간에서나.
 */
const RESIDENT_OBS = ['scolding_mother', 'nagging_father', 'bespoke_washer', 'lg_stanbyme', 'flying_dyson'];
const residentFiles = (): FileRef[] =>
  RESIDENT_OBS.flatMap((k) => {
    const d = defByKey(k);
    return d ? d.frames.map((f, i) => ({ key: K.ob(k, i), src: f.src })) : [];
  });
const RESIDENT_KEYS = new Set(residentFiles().map((f) => f.key));
const groomFiles = (): FileRef[] => (['run_01', 'run_02'] as const).map((m) => ({ key: K.gr(m), src: WR_GROOM.frames[m].src }));

/* ───────── 깊이(그리는 순서) ───────── */
const D = {
  bgOld: 1,
  bgNew: 2,
  pit: 19,
  playerFall: 19.5,
  platform: 20,
  // (261011 사장 기믹) 정전 덮개 = 발판 위·장애물 아래 → 플레이어·장애물은 늘 보임 / 사진사 플래시 덮개도 장애물 아래
  dark: 22,
  darkLine: 22.5,
  flashOv: 23,
  zap: 23.5,
  decor: 24.2,
  shadow: 24.6,
  // 발판보다 위(발밑이 발판 윗면에 묻히지 않게), 플레이어보다 아래(기둥 사이로 지나가는 그림)
  houseGlow: 24,
  house: 25,
  air: 26,
  ground: 30,
  items: 35,
  groom: 39,
  plGlow: 39.5,
  player: 40,
  shield: 41,
  bolt: 44,
  flying: 45,
  hint: 46,
  marks: 46.5,
  warn: 47,
  fx: 50,
  flash: 90,
  fade: 95,
  debug: 99,
};

/* ───────── 런타임 물체 ───────── */
type ObsRT = {
  plan: PlanObs;
  img: Img;
  wx: number;
  frameT: number;
  frame: number;
  bob: number;
  bobY: number;
  dead: boolean;
  bumped: boolean;
  passed: boolean;
  hint: Img | null;
  /** (261011 사장 기믹) 움직임 표(τ 함수) · 추가 높이 · 충돌 켜짐 · 남은 시간 · 붙은 연출 · 번개 내리꽂힘 */
  sTab: Float32Array | null;
  dy: number;
  armed: boolean;
  tau: number;
  marks: Partial<Record<MarkKind, Img>>;
  struck: boolean;
  bornT: number;
};
type WarnRT = { w: PlanWarn; icon: Img | null; t: number };
type DecorRT = { p: PlanDecor; img: Img };
type ItemRT = { plan: PlanItem; img: Img; wx: number; h: number; done: boolean; phase: number };
type Piece = { img: Img; wx: number; w: number; yTop: number };
type PitShade = { img: Img; x0: number; x1: number };
type BgLayer = { seg: number; imgs: Img[]; startX: number };
type PfGeo = { key: string; s: number; footY: number; flatLen: number; flatH: number; roundL: number; roundR: number; capExtra: number; w: number };

type Seq =
  | null
  | { kind: 'stage'; t: number; to: number; swapped: boolean }
  | { kind: 'groom'; t: number; joined: boolean; x: number }
  | { kind: 'photo'; t: number; flashes: number }
  | { kind: 'arrive'; t: number; stopped: boolean; holdT: number }
  | { kind: 'next'; t: number; rebuilt: boolean };

export type SceneHooks = {
  emit: (e: WREvent) => void;
  sound: WRSound;
  isTouch: boolean;
  onCreated: (api: RunSceneApi) => void;
  onLoadProgress: (p: number) => void;
  onLowFps: () => void;
};

export interface RunSceneApi {
  layout(): void;
  startGame(): void;
  restartGame(): void;
  setInput(kind: 'jump' | 'slide', down: boolean, src: 'touch' | 'key'): void;
  pauseGame(): boolean;
  resumeGame(): void;
  isPaused(): boolean;
  acceptsInput(): boolean;
  isLive(): boolean;
  debugApi(): Record<string, unknown>;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

export function makeRunScene(Phaser: PhaserLib, hooks: SceneHooks) {
  return class RunScene extends Phaser.Scene implements RunSceneApi {
    /* 화면 */
    DW = 1000;
    DH = C.VIEW_H;
    groundY = C.VIEW_H - C.GROUND_FROM_BOTTOM;

    /* 상태 */
    mode: 'boot' | 'idle' | 'run' | 'dying' | 'over' = 'boot';
    paused = false;
    pendingStart = false;
    tutorialPending = true;
    worldX = 0;
    distance = 0;
    speed = 0;
    speedMul = 0;
    speedTarget = 1;
    speedRate = 1 / C.START_ACCEL_SEC;
    runTime = 0;
    lap = 1;
    lapStartX = 0;
    laps = 0;
    stage = 0;
    curSeg = 0;
    bonus = 0;
    hearts = 0;
    envelopes = 0;
    combo = 0;
    comboT = 0;
    shieldOn = false;
    shieldT = 0;
    flags = { photo: false, shield: false, honeymoon: false, homeNotice: false, arrive: false };
    seq: Seq = null;
    dyingT = 0;
    dieCause: 'hit' | 'pit' = 'hit';
    dieAfterArrive = false;
    lastScoreEmit = 0;
    lastScore = -1;
    tut = { active: false, step: 0, obs: null as PlanObs | null, retries: 0, introT: 0 };
    /** 화면(HUD)에 알린 구간 — 그 구간 그림이 준비된 뒤에 알린다(느린 네트워크에서 이름만 바뀌고 그림은 이전 구간인 장면 방지) */
    segShown = 0;
    segWaitT = 0;
    /** 그림 피벗(신부 발)을 기준점(PLAYER_X)에서 옮겨 그리는 거리 — 커플 단계 앞끝 맞춤(geom.ts CharGeom.offX), 신랑 합류 중엔 서서히 */
    plOffX = 0;
    /** 구간 경계를 지난 달린 시각 — 맵 제목은 그림이 MAP_TITLE_LATE_SEC 안에 준비될 때만 */
    segCrossT = 0;
    /** (261011 사장 2단 점프) 1바퀴 가전 매장 연습 전엔 잠금 — 연습 뒤·2바퀴~·같은 페이지 다음 판은 열림 */
    djUnlocked = false;
    /** 2단 점프 연습 진행(연습 띠 3줄 중 다음 판정할 것) */
    djTut = { active: false, gi: 0, idx: 0, ok: false };
    /** 왼쪽 위 구간 알약 흐림(2단 점프 머리) */
    hudDim = false;
    /** 예고 아이콘·장식·환경 연출 */
    warnRT: WarnRT[] = [];
    decorRT: DecorRT[] = [];
    firedGi = new Set<number>();
    envStarted = new Set<number>();
    darkA = 0;
    /** 바람에 젖힌 정도 0~1(그림만) */
    windLean = 0;
    /** 시어머니 호통 깜짝 등장(번개만 올 때) */
    cameos: Img[] = [];
    retryT = 0;
    /** 구간 그림 요청 시각(달린 시각) — 오래 안 오면 대체(E2) */
    segReqAt = new Map<number, number>();
    /** 확인용: 기믹 예고·보이기 시간 기록 · 넘어진 원인 */
    fair: Array<{ gi: number; gim: string; lap: number; warnLead: number; seenLead: number | null }> = [];
    deaths: Array<{ cause: string; key?: string; gim?: string; lap: number; seg: number; lapD: number; t: number }> = [];
    botDj: { at: number } | null = null;

    /* 플레이어 */
    pl = {
      y: 0,
      vy: 0,
      grounded: true,
      sliding: false,
      slideT: 0,
      coyote: 0,
      jumpBuf: 0,
      invuln: 0,
      blink: 0,
      falling: false,
      runT: 0,
      airT: 0,
      // (261011 사장 2단 점프) 진짜 점프 뒤 1회 · 중력 배수(바람 0.78·2단 0.8) · 늦춘 2단 · 새로 누름
      djAvail: false,
      gMul: 1,
      djDefer: 0,
      jumpPress: false,
    };
    inp = { jumpTouch: false, jumpKey: false, slideTouch: false, slideKey: false };

    /* 물체 */
    planner!: Planner;
    player!: Img;
    groom!: Img;
    shield!: Img;
    house!: Img;
    houseLit!: Img;
    houseGlow!: Img;
    houseWX = 0;
    houseShown = false;
    flash!: Img;
    fade!: Img;
    warm!: Img;
    darkOv!: Img;
    flashOv!: Img;
    darkLine!: Img;
    plGlow!: Img;
    seatbelt!: Img;
    fxWind!: Emitter;
    fxPaper!: Emitter;
    obs: ObsRT[] = [];
    items: ItemRT[] = [];
    pieces: Piece[] = [];
    shades: PitShade[] = [];
    poolImg: Img[] = [];
    /** 풀에 들어 있는 이미지(이중 반납 방지) */
    pooled = new Set<Img>();
    bgCur: BgLayer | null = null;
    bgOld: BgLayer | null = null;
    bgFadeT = 1;
    bgPending = -1;
    pfX = 0;
    pfOpen = false;
    pfFlip = 0;
    fxPetal!: Emitter;
    fxRain!: Emitter;
    fxSpark!: Emitter;
    fxDust!: Emitter;
    fxHeart!: Emitter;
    rainT = 0;
    dbgGfx: PhaserNS.GameObjects.Graphics | null = null;

    /* 불러오기 */
    loadQueue: FileRef[] = [];
    queued = new Set<string>();
    failed = new Map<string, number>();
    /** 마지막 실패 시각(ms, 실제 시간) — 잠시 포기한 파일은 백오프 뒤 다시(영구 포기 없음, 261011 검증 high) */
    failedAt = new Map<string, number>();
    /** 대기열에 넣은 시각(ms) — 디코드 실패(loaderror 없음)로 영영 '받는 중'으로 남은 키 정리용 */
    queuedAt = new Map<string, number>();
    /** 받는 중 멈춤 감시(1초마다 — 첫 로딩(preload) 동안엔 update 가 안 돌아 setInterval) */
    stallTimer: ReturnType<typeof setInterval> | null = null;

    /* 성능 */
    fpsAcc = 0;
    fpsN = 0;
    fpsWindow = 0;
    fpsGrace = 3;

    /* 개발 확인용 */
    dbg = { god: false, timeScale: 1, bot: false, hit: false, botSlide: false, timing: 'center' as 'early' | 'center' | 'late', dj: 'apex' as 'early' | 'apex' | 'late' | 'none', gimmicks: true, input: false };
    /** (개발) 봇이 실제 입력 경로(setInput)로 누른 점프를 뗄 때까지 남은 걸음 */
    botHold = 0;

    constructor() {
      super({ key: 'wr-run' });
    }

    /* ═════════ 불러오기 ═════════ */

    preload() {
      // 첫 화면에 필요한 것만 먼저: 캐릭터 1·2단계 + 서울·종로(배경·발판·장애물). 나머지는 달리는 동안 미리 받는다.
      const first = [...charFiles(0), ...charFiles(1), ...segFiles(0), ...segFiles(1)];
      for (const f of first) this.loadImage(f);
      this.load.on('progress', (p: number) => hooks.onLoadProgress(p));
      this.startStallWatch();
      // 받기 실패(Phaser 자체 재시도 LOADER_MAX_RETRIES 회 뒤) — 시간 제한(LOADER_TIMEOUT_MS)도 여기로 와서 로더가 멈추지 않는다(E2)
      this.load.on('loaderror', (file: { key: string }) => this.markFailed(file.key));
    }

    /** 빠진 그림 주기 재요청(LOADER_RETRY_SEC) — 디코드 실패 정리 → 창 안 그림·캐릭터 요청 → 로더 깨우기 */
    loaderTick(dt: number) {
      this.retryT -= dt;
      if (this.retryT > 0) return;
      this.retryT = C.LOADER_RETRY_SEC;
      this.sweepLoader();
      this.manageTextures();
      this.pumpLoader();
    }

    markFailed(key: string) {
      this.failed.set(key, (this.failed.get(key) ?? 0) + 1);
      this.failedAt.set(key, performance.now());
      this.queued.delete(key);
      this.queuedAt.delete(key);
    }

    create() {
      makeTextures(this, C.HINT_TEXT);
      makeGimmickTextures(this, Object.values(C.GIMMICK_HINT), NAG_LINES);
      this.planner = new Planner(this.plannerCtx());
      this.player = this.add.image(C.PLAYER_X, this.groundY, K.ch(0, 'run_01')).setDepth(D.player);
      this.groom = this.add.image(-200, this.groundY, K.gr('run_01')).setDepth(D.groom).setVisible(false);
      this.shield = this.add.image(0, 0, TEX.shield).setDepth(D.shield).setVisible(false);
      this.houseGlow = this.add.image(0, 0, TEX.glow).setDepth(D.houseGlow).setVisible(false).setTint(0xffd6e8);
      this.house = this.add.image(0, 0, TEX.house).setDepth(D.house).setVisible(false).setOrigin(0.5, 0.97);
      this.houseLit = this.add.image(0, 0, TEX.houseLit).setDepth(D.house + 0.1).setVisible(false).setOrigin(0.5, 0.97);
      this.warm = this.add.image(0, 0, TEX.warm).setDepth(D.houseGlow + 0.1).setVisible(false).setBlendMode(Phaser.BlendModes.ADD);
      this.flash = this.add.image(0, 0, TEX.white).setOrigin(0, 0).setDepth(D.flash).setAlpha(0);
      this.fade = this.add.image(0, 0, TEX.white).setOrigin(0, 0).setDepth(D.fade).setAlpha(0);
      // (261011 사장 기믹) 정전 덮개(발판 위·장애물 아래) · 땅 선 · 플레이어 뒤 은은한 빛 · 사진사 플래시 덮개 · 좌석벨트 표시
      this.darkOv = this.add.image(0, 0, TEX.white).setOrigin(0, 0).setDepth(D.dark).setTint(0x0d0b1f).setAlpha(0);
      this.darkLine = this.add.image(0, 0, TEX.white).setOrigin(0, 0.5).setDepth(D.darkLine).setTint(0xc9b8ff).setAlpha(0);
      this.plGlow = this.add.image(0, 0, TEX.glow).setDepth(D.plGlow).setTint(0xfff1d6).setAlpha(0);
      this.flashOv = this.add.image(0, 0, TEX.white).setOrigin(0, 0).setDepth(D.flashOv).setAlpha(0);
      this.seatbelt = this.add.image(0, 0, TEX.seatbelt).setDepth(D.warn).setVisible(false);
      this.makeFx();

      // 달리는 동안 이어서 받기(이때부터 진행률은 화면에 안 알림 — 'loading' 은 첫 로딩만)
      this.load.off('progress');
      this.load.on('filecomplete', (key: string) => {
        this.queued.delete(key);
        this.queuedAt.delete(key);
        this.failed.delete(key);
        this.failedAt.delete(key);
        if (key.startsWith('wr-pf-')) this.ensurePfFrames(Number(key.slice(6)));
      });
      this.load.on('loaderror', () => this.pumpLoader());
      this.load.on('complete', () => this.pumpLoader());
      // 순서: (첫 로딩에서 빠진 캐릭터 1·2단계 — 261011 검증 high: 다시 요청하는 길이 없어 끝까지 검은 점) → 다음 구간 → 3단계 → 신랑 → 4·5단계
      // (구간은 manageTextures 가 창 단위로, 캐릭터·신랑도 manageTextures 가 주기적으로 다시)
      this.requestFiles([...charFiles(0), ...charFiles(1), ...segFiles(2), ...charFiles(2), ...groomFiles(), ...charFiles(3), ...charFiles(4)]);
      for (let i = 0; i < SEG_COUNT; i++) if (this.textures.exists(K.pf(i))) this.ensurePfFrames(i);

      this.resetWorld();
      this.mode = 'idle';
      this.layout();
      this.events.on('shutdown', () => this.cleanup());
      this.events.once('destroy', () => this.cleanup());
      hooks.onCreated(this);
      if (this.pendingStart) {
        this.pendingStart = false;
        this.startGame();
      }
    }

    cleanup() {
      try {
        this.load?.removeAllListeners();
      } catch {
        /* 이미 정리됨 */
      }
      if (this.stallTimer) clearInterval(this.stallTimer);
      this.stallTimer = null;
    }

    /**
     * 받는 중 멈춤 감시(261011 검증 high) — 받는 파일의 XHR 이 LOADER_STALL_MS 동안 응답·받은 양이 안 늘면 끊고 Phaser 재시도/실패로 넘긴다.
     * (총 시간 제한만 있으면 느리지만 받고 있는 큰 그림까지 끊거나, 응답 없는 파일이 그 시간만큼 첫 로딩을 붙잡았다)
     * 진행은 XHR 'progress'·'readystatechange' 를 따로 듣는다(Content-Length 가 없어 Phaser bytesLoaded 가 안 느는 응답도 진행으로 봄).
     */
    startStallWatch() {
      if (this.stallTimer) return;
      type LFile = { xhrLoader?: XMLHttpRequest; onError?: () => void };
      const watch = new Map<XMLHttpRequest, { t: number }>();
      this.stallTimer = setInterval(() => {
        const inflight = (this.load as unknown as { inflight?: { entries?: LFile[] } | null })?.inflight?.entries;
        if (!inflight) return;
        const now = performance.now();
        const live = new Set<XMLHttpRequest>();
        for (const f of inflight.slice()) {
          const x = f.xhrLoader;
          if (!x || typeof f.onError !== 'function') continue;
          live.add(x);
          const rec = watch.get(x);
          if (!rec) {
            const r = { t: now };
            const bump = () => {
              r.t = performance.now();
            };
            x.addEventListener('progress', bump);
            x.addEventListener('readystatechange', bump);
            watch.set(x, r);
            continue;
          }
          if (now - rec.t < C.LOADER_STALL_MS) continue;
          watch.delete(x);
          try {
            f.onError(); // Phaser: XHR 처리기 떼고 → 재시도(남았으면) 또는 loaderror
          } catch {
            /* 무시 */
          }
          try {
            x.abort();
          } catch {
            /* 무시 */
          }
        }
        for (const x of Array.from(watch.keys())) if (!live.has(x)) watch.delete(x);
      }, 1000);
    }

    requestFiles(files: FileRef[]) {
      const now = performance.now();
      for (const f of files) {
        if (this.textures.exists(f.key) || this.queued.has(f.key)) continue;
        if (this.backingOff(f.key, now)) continue;
        this.queued.add(f.key);
        this.queuedAt.set(f.key, now);
        this.loadQueue.push(f);
      }
      this.pumpLoader();
    }

    /** 잠시 포기한 파일인가 — LOADER_GIVE_UP 번 실패하면 LOADER_BACKOFF_SEC(두 배씩, 최대 60초) 동안 다시 안 받음 */
    backingOff(key: string, now = performance.now()): boolean {
      const n = this.failed.get(key) ?? 0;
      if (n < C.LOADER_GIVE_UP) return false;
      const wait = Math.min(C.LOADER_BACKOFF_MAX_SEC, C.LOADER_BACKOFF_SEC * 2 ** (n - C.LOADER_GIVE_UP)) * 1000;
      return now - (this.failedAt.get(key) ?? 0) < wait;
    }

    /** 잠시 포기한 파일을 바로 다시 받게(구간이 바뀔 때·새 판) — 실패 횟수는 남겨 둬서 대체 그림 판단은 그대로 */
    expireBackoff() {
      for (const k of this.failedAt.keys()) this.failedAt.set(k, -Infinity);
    }

    /**
     * 디코드 실패(onProcessError)는 loaderror 가 안 와서 queued 에 영원히 남는다 → 로더 어디에도 없는데 오래 '받는 중'인 키는 실패로 정리.
     * (받는 중인 것은 로더 list·inflight·queue 에 있다 — 그건 시간 제한(LOADER_TIMEOUT_MS)·loaderror 가 맡는다)
     */
    sweepLoader() {
      if (!this.queued.size) return;
      // Phaser.Structs.Set — entries 는 배열
      type FSet = { entries?: Array<{ key: string }> } | null | undefined;
      const ld = this.load as unknown as { list: FSet; inflight: FSet; queue: FSet };
      const keys = new Set<string>();
      for (const set of [ld.list, ld.inflight, ld.queue]) for (const f of set?.entries ?? []) keys.add(f.key);
      for (const f of this.loadQueue) keys.add(f.key);
      const now = performance.now();
      for (const k of Array.from(this.queued)) {
        if (keys.has(k) || this.textures.exists(k)) continue;
        if (now - (this.queuedAt.get(k) ?? now) < 3000) continue;
        this.markFailed(k);
      }
    }

    /**
     * 그림 하나 받기 — 파일마다 시간 제한(xhrSettings.timeout).
     * (261011 검증 E2) Phaser 3.90 은 게임 설정 loader.timeout 을 파일 기본값(timeout 0)이 덮어써 시간 제한이 안 걸렸다
     * → 응답 없는 그림 하나가 로더를 영영 붙잡아 뒤 구간 그림을 못 받았다. 파일 설정으로 직접 준다.
     */
    loadImage(f: FileRef) {
      this.load.image({ key: f.key, url: f.src, xhrSettings: { timeout: C.LOADER_TIMEOUT_MS } } as unknown as PhaserNS.Types.Loader.FileTypes.ImageFileConfig);
    }

    /**
     * 받기 대기열 → 로더. 받는 중이어도 바로 끼워 넣는다(예전엔 지금 묶음이 '다' 끝나야 다음 묶음 — 응답 없는 파일 하나가 전부를 막았다).
     * 실패한 파일은 loaderror 에서 queued 를 지움 → 다음 requestFiles 때 다시(포기 LOADER_GIVE_UP 회).
     */
    pumpLoader() {
      if (!this.loadQueue.length) return;
      const batch = this.loadQueue.splice(0, this.loadQueue.length);
      let n = 0;
      for (const f of batch) {
        if (this.textures.exists(f.key)) {
          this.queued.delete(f.key);
          continue;
        }
        this.loadImage(f);
        n++;
      }
      if (!n) return;
      if (!this.load.isLoading()) this.load.start();
      else (this.load as unknown as { checkLoadQueue?: () => void }).checkLoadQueue?.();
    }

    segReady(i: number): boolean {
      return segFiles(i).every((f) => this.textures.exists(f.key));
    }
    charReady(s: number): boolean {
      return charFiles(s).every((f) => this.textures.exists(f.key));
    }

    /**
     * 텍스처 메모리: 0·1구간은 항상, 나머지는 현재-1 ~ 현재+2 만 GPU 에 둔다(나머지는 HTTP 캐시에서 다시 받음).
     * (261011 사장 기믹) 1바퀴 가전 매장부터는 상주 9장(RESIDENT_OBS)을 지우지 않고, 없으면 받는다.
     */
    manageTextures() {
      const cur = this.curSeg;
      // (261011 검증 high) 캐릭터·신랑 그림도 여기서 다시 요청 — 예전엔 첫 로딩·create 에서 한 번뿐이라, 잠깐만 느려도 신부가 끝까지 검은 점(__MISSING)이고
      // 단계 전환도 영영 안 됐다. 순서: 지금 단계(없으면 1단계 대체) → 다음 단계 → 신랑(합류 전) — 구간 그림보다 먼저
      const chars: FileRef[] = [...charFiles(0)];
      if (this.lap === 1) {
        chars.push(...charFiles(this.stage));
        if (this.stage < 4) chars.push(...charFiles(this.stage + 1));
        if (this.stage < 3) chars.push(...groomFiles());
      } else chars.push(...charFiles(4));
      this.requestFiles(chars);
      for (let i = 0; i < SEG_COUNT; i++) {
        const keep = i <= 1 || (i >= cur - C.KEEP_SEGMENTS_BEHIND && i <= cur + C.PRELOAD_SEGMENTS_AHEAD) || (cur >= SEG_COUNT - 2 && i <= 1);
        if (keep) {
          if (!this.segReady(i)) {
            if (!this.segReqAt.has(i)) this.segReqAt.set(i, this.runTime);
            this.requestFiles(segFiles(i));
          }
        } else {
          this.segReqAt.delete(i);
          if (this.textures.exists(K.bg(i)) && !this.segInUse(i)) {
            for (const f of segFiles(i)) if (this.textures.exists(f.key) && !RESIDENT_KEYS.has(f.key)) this.textures.remove(f.key);
          }
        }
      }
      if (this.lap > 1 || cur >= 4) this.requestFiles(residentFiles());
    }

    /** 장애물 그림(모든 프레임)이 준비됐나 */
    obsReady(key: string): boolean {
      const d = defByKey(key);
      return !!d && d.frames.every((_, i) => this.textures.exists(K.ob(key, i)));
    }

    /** 그 구간 그림을 충분히 기다렸나·받기를 포기했나(E2) — 그럼 가까운 구간 장애물로 대체 */
    segWaited(i: number): boolean {
      if (segFiles(i).some((f) => (this.failed.get(f.key) ?? 0) >= C.LOADER_GIVE_UP)) return true;
      const at = this.segReqAt.get(i);
      return at != null && this.runTime - at >= C.SEG_NOTICE_WAIT_SEC;
    }

    segInUse(i: number): boolean {
      const keys = new Set(segFiles(i).map((f) => f.key));
      const used = (img: Img) => img.active && keys.has(img.texture.key);
      if (this.bgCur?.seg === i || this.bgOld?.seg === i) return true;
      if (this.obs.some((o) => used(o.img)) || this.pieces.some((p) => used(p.img)) || this.decorRT.some((d) => used(d.img))) return true;
      // (261011 검증 low) 아직 화면에 안 나온 계획 장애물(가까운 구간 그림을 쓰는 기믹·대체 장애물)이 쓸 그림도 지우지 않는다
      // — 지우면 나올 때 장애물은 조용히 빠지고 예고(북·박수·경고 아이콘)만 남았다
      return this.planner.obs.some((p) => !p.spawned && !p.g.code && keys.has(K.ob(p.g.def.key, 0)));
    }

    ensurePfFrames(i: number) {
      const key = K.pf(i);
      if (!this.textures.exists(key)) return;
      const tex = this.textures.get(key);
      if (tex.has('flat')) return;
      const p = WR_SEGMENTS[i].platform;
      const ce = C.PLATFORM_CAP_EXTRA;
      tex.add('flat', 0, p.solidX0 + 2, 0, p.solidX1 - p.solidX0 - 4, p.h);
      tex.add('capL', 0, 0, 0, p.solidX0 + ce, p.h);
      tex.add('capR', 0, p.solidX1 - ce, 0, p.w - (p.solidX1 - ce), p.h);
    }

    pfGeo(i: number): PfGeo {
      const p = WR_SEGMENTS[i].platform;
      const footY = p.topY + (p.faceY - p.topY) * C.PLATFORM_FOOT_DEPTH;
      const s = (C.GROUND_FROM_BOTTOM + 3) / (p.h - footY);
      return {
        key: K.pf(i),
        s,
        footY,
        flatLen: (p.solidX1 - p.solidX0 - 4) * s,
        flatH: p.h,
        roundL: p.solidX0 * s,
        roundR: (p.w - p.solidX1) * s,
        capExtra: C.PLATFORM_CAP_EXTRA * s,
        w: p.w,
      };
    }

    /** 구간 i 발판에 쓸 텍스처 구간(아직 없으면 가장 가까운 앞 구간) */
    pfTexSeg(i: number): number {
      for (let k = i; k >= 0; k--) if (this.textures.exists(K.pf(k))) return k;
      for (let k = i + 1; k < SEG_COUNT; k++) if (this.textures.exists(K.pf(k))) return k;
      return 0;
    }

    /* ═════════ 화면 배치 ═════════ */

    layout() {
      const gw = this.scale.width;
      const gh = this.scale.height;
      if (!gw || !gh) return;
      const aspect = gw / gh;
      this.DH = Math.max(C.VIEW_H, C.VIEW_MIN_W / aspect);
      this.DW = this.DH * aspect;
      this.groundY = this.DH - C.GROUND_FROM_BOTTOM;
      const cam = this.cameras.main;
      cam.setZoom(gh / this.DH);
      cam.centerOn(this.DW / 2, this.DH / 2);
      this.flash.setDisplaySize(this.DW + 4, this.DH + 4).setPosition(-2, -2);
      this.fade.setDisplaySize(this.DW + 4, this.DH + 4).setPosition(-2, -2);
      this.darkOv.setDisplaySize(this.DW + 40, this.DH + 40).setPosition(-20, -20);
      this.flashOv.setDisplaySize(this.DW + 40, this.DH + 40).setPosition(-20, -20);
      this.darkLine.setDisplaySize(this.DW + 40, 3).setPosition(-20, this.groundY);
      // (261011 검증 low) 예고 아이콘·좌석벨트는 화면 오른쪽 끝 기준 — 회전·창 크기가 바뀌면 다시 놓는다
      for (const r of this.warnRT) if (r.icon) r.icon.setPosition(this.DW - 30, this.groundY - Math.max(22, r.w.h));
      if (this.seatbelt?.visible) this.seatbelt.setPosition(this.DW - 70, 92);
      if (this.fxWind) {
        const wz = new Phaser.Geom.Rectangle(this.DW + 10, this.groundY - 230, 20, 220);
        this.fxWind.clearEmitZones();
        this.fxWind.addEmitZone({ type: 'random', source: wz as unknown as PhaserNS.Types.GameObjects.Particles.RandomZoneSource });
      }
      if (this.fxRain) {
        const zone = new Phaser.Geom.Rectangle(0, -30, this.DW + 200, 10);
        this.fxRain.clearEmitZones();
        this.fxRain.addEmitZone({ type: 'random', source: zone as unknown as PhaserNS.Types.GameObjects.Particles.RandomZoneSource });
      }
      if (this.mode !== 'boot') {
        this.buildPlatform();
        this.renderAll(0);
      }
    }

    get spawnAhead() {
      return this.DW - C.PLAYER_X + C.SPAWN_MARGIN;
    }

    plannerCtx(): PlannerCtx {
      return {
        lap: this.lap,
        lapStartX: this.lapStartX,
        stagesFrom: this.lap === 1 ? this.stage + 1 : 5,
        obsReady: (k) => this.obsReady(k),
        segWaited: (i) => this.segWaited(i),
        spawnAhead: this.spawnAhead,
        pitMinX: () => this.pfX + 60,
        gimmicks: this.dbg.gimmicks,
      };
    }

    /* ═════════ 효과 ═════════ */

    makeFx() {
      this.fxPetal = this.add
        .particles(0, 0, TEX.petal, {
          lifespan: 1700,
          speed: { min: 80, max: 260 },
          angle: { min: 190, max: 350 },
          gravityY: 220,
          rotate: { start: 0, end: 540 },
          scale: { min: 0.5, max: 1 },
          alpha: { start: 1, end: 0 },
          emitting: false,
        })
        .setDepth(D.fx);
      this.fxRain = this.add
        .particles(0, 0, TEX.petal, {
          lifespan: 3200,
          speedY: { min: 70, max: 150 },
          speedX: { min: -90, max: -30 },
          rotate: { start: 0, end: 360 },
          scale: { min: 0.45, max: 0.9 },
          alpha: { start: 1, end: 0.2 },
          frequency: 45,
          emitting: false,
        })
        .setDepth(D.fx);
      this.fxSpark = this.add
        .particles(0, 0, TEX.sparkle, {
          lifespan: 750,
          speed: { min: 60, max: 260 },
          scale: { start: 0.9, end: 0 },
          alpha: { start: 1, end: 0 },
          rotate: { min: 0, max: 90 },
          blendMode: 'ADD',
          emitting: false,
        })
        .setDepth(D.fx);
      this.fxDust = this.add
        .particles(0, 0, TEX.dust, {
          lifespan: 520,
          speed: { min: 20, max: 90 },
          angle: { min: 150, max: 210 },
          scale: { start: 0.5, end: 1.4 },
          alpha: { start: 0.85, end: 0 },
          emitting: false,
        })
        .setDepth(D.fx);
      this.fxHeart = this.add
        .particles(0, 0, TEX.heart, {
          lifespan: 1500,
          speed: { min: 140, max: 340 },
          angle: { min: 215, max: 325 },
          gravityY: 320,
          scale: { min: 0.22, max: 0.42 },
          rotate: { min: -30, max: 30 },
          alpha: { start: 1, end: 0 },
          emitting: false,
        })
        .setDepth(D.fx);
      // (261011 사장 기믹) 드라이어 바람 줄 · 계약서 종이
      this.fxWind = this.add
        .particles(0, 0, TEX.wind, {
          lifespan: 850,
          speedX: { min: -1500, max: -1000 },
          speedY: { min: -20, max: 20 },
          scale: { min: 0.8, max: 1.5 },
          alpha: { start: 1, end: 0.15 },
          frequency: 22,
          emitting: false,
        })
        .setDepth(D.fx);
      this.fxPaper = this.add
        .particles(0, 0, TEX.paper, {
          lifespan: 1300,
          speedY: { min: 180, max: 320 },
          speedX: { min: -140, max: 40 },
          rotate: { start: 0, end: 540 },
          scale: { min: 0.7, max: 1.1 },
          alpha: { start: 1, end: 0.3 },
          emitting: false,
        })
        .setDepth(D.fx);
    }

    flashOnce(alpha = 0.85, dur = 320) {
      this.tweens.killTweensOf(this.flash);
      this.flash.setCrop();
      this.flash.setAlpha(alpha);
      this.tweens.add({ targets: this.flash, alpha: 0, duration: dur, ease: 'Quad.easeOut' });
    }

    /* ═════════ 풀(재사용) ═════════ */

    acquire(key: string, frame?: string): Img {
      let img = this.poolImg.pop();
      if (img) this.pooled.delete(img);
      if (!img) img = this.add.image(0, 0, key, frame);
      else {
        img.setTexture(key, frame);
        img.setActive(true).setVisible(true);
      }
      img.setAlpha(1).setAngle(0).setScale(1).setFlipX(false).setOrigin(0.5, 0.5).clearTint().setBlendMode(Phaser.BlendModes.NORMAL);
      img.setCrop();
      this.children.bringToTop(img);
      return img;
    }
    /**
     * 반납 — 이미 풀에 있으면 무시(이중 반납 = 같은 Image 를 두 물체가 나눠 쓰는 사고, 261011 검증 high).
     * 반납할 수 있는 건 그 이미지를 지금 쥔 주인뿐 — 먹은 하트처럼 트윈이 반납할 물체는 목록(items)에서 바로 빼 둔다(collect·despawn).
     */
    release(img: Img) {
      if (this.pooled.has(img)) return;
      this.tweens.killTweensOf(img);
      img.setActive(false).setVisible(false);
      this.pooled.add(img);
      this.poolImg.push(img);
    }

    /* ═════════ 월드 초기화 ═════════ */

    /** 장애물 하나와 붙은 그림(안내 말풍선·연출) 반납 */
    releaseObs(o: ObsRT) {
      this.release(o.img);
      if (o.hint) this.release(o.hint);
      for (const m of Object.values(o.marks)) if (m) this.release(m);
      o.marks = {};
    }

    /** 기믹 연출(예고 아이콘·장식·덮개·흔들림·바람) 정리 */
    clearGimmickFx() {
      for (const w of this.warnRT) if (w.icon) this.release(w.icon);
      for (const d of this.decorRT) this.release(d.img);
      this.warnRT = [];
      this.decorRT = [];
      this.firedGi.clear();
      this.envStarted.clear();
      this.darkA = 0;
      this.tweens.killTweensOf([this.darkOv, this.flashOv, this.darkLine, this.plGlow]);
      this.darkOv.setAlpha(0);
      this.darkLine.setAlpha(0);
      this.plGlow.setAlpha(0);
      this.flashOv.setAlpha(0);
      this.seatbelt.setVisible(false);
      this.tweens.killTweensOf(this.seatbelt);
      this.fxWind.stop();
      this.windLean = 0;
      for (const c of this.cameos) this.release(c);
      this.cameos = [];
      this.cameras.main.resetFX();
      this.djTut = { active: false, gi: 0, idx: 0, ok: false };
      this.botDj = null;
      this.setHudDim(false);
    }

    setHudDim(on: boolean) {
      if (this.hudDim === on) return;
      this.hudDim = on;
      hooks.emit({ type: 'hud', dim: on });
    }

    resetWorld() {
      // 새 판 — 잠시 포기한 그림도 바로 다시 받게(실패 횟수는 남겨 대체 그림 판단은 그대로, 261011 검증 high)
      this.expireBackoff();
      // 모든 물체 반납
      for (const o of this.obs) this.releaseObs(o);
      for (const it of this.items) this.release(it.img);
      for (const p of this.pieces) this.release(p.img);
      for (const s of this.shades) this.release(s.img);
      this.clearGimmickFx();
      this.obs = [];
      this.items = [];
      this.pieces = [];
      this.shades = [];
      this.worldX = 0;
      this.distance = 0;
      this.speed = 0;
      this.speedMul = 0;
      this.speedTarget = 1;
      this.speedRate = 1 / C.START_ACCEL_SEC;
      this.runTime = 0;
      this.lap = 1;
      this.lapStartX = 0;
      this.laps = 0;
      this.stage = 0;
      this.curSeg = 0;
      this.bonus = 0;
      this.hearts = 0;
      this.envelopes = 0;
      this.combo = 0;
      this.comboT = 0;
      this.shieldOn = false;
      this.shieldT = 0;
      this.flags = { photo: false, shield: false, honeymoon: false, homeNotice: false, arrive: false };
      this.seq = null;
      this.dyingT = 0;
      this.dieAfterArrive = false;
      this.lastScore = -1;
      this.lastScoreEmit = 0;
      this.tut = { active: false, step: 0, obs: null, retries: 0, introT: 0 };
      this.segShown = 0;
      this.segWaitT = 0;
      this.segCrossT = 0;
      this.plOffX = 0;
      this.fair = [];
      this.pl = { y: 0, vy: 0, grounded: true, sliding: false, slideT: 0, coyote: 0, jumpBuf: 0, invuln: 0, blink: 0, falling: false, runT: 0, airT: 0, djAvail: false, gMul: 1, djDefer: 0, jumpPress: false };
      this.clearInput();
      this.planner.reset(this.plannerCtx(), C.QUIET.start * speedAt(1, 0), { clear: true, resetBudget: true });
      this.planner.enabled = true;
      // 화면 물체
      this.player.setAngle(0).setAlpha(1).setDepth(D.player);
      this.groom.setVisible(false);
      this.tweens.killTweensOf([this.shield, this.flash]);
      this.shield.setVisible(false);
      this.hideHouse();
      this.flash.setAlpha(0);
      this.fade.setAlpha(0);
      this.fxRain.stop();
      this.rainT = 0;
      // 배경: 서울부터
      this.setBg(0, this.lapStartX - 0, true);
      // 발판: 화면 왼쪽 밖부터
      this.pfX = this.lapStartX - C.PLAYER_X - 600;
      this.pfOpen = false;
      this.pfFlip = 0;
      this.buildPlatform();
      this.applyPose();
    }

    hideHouse() {
      this.houseShown = false;
      this.tweens.killTweensOf([this.houseGlow, this.houseLit, this.warm]);
      this.house.setVisible(false);
      this.houseLit.setVisible(false).setAlpha(0);
      this.houseGlow.setVisible(false);
      this.warm.setVisible(false).setAlpha(0);
    }

    clearInput() {
      this.inp = { jumpTouch: false, jumpKey: false, slideTouch: false, slideKey: false };
      this.pl.jumpBuf = 0;
      this.pl.jumpPress = false;
    }

    get slideHeld() {
      return this.inp.slideTouch || this.inp.slideKey || this.dbg.botSlide;
    }

    /* ═════════ 배경 ═════════ */

    setBg(seg: number, startX: number, instant: boolean) {
      if (!this.textures.exists(K.bg(seg))) {
        this.bgPending = seg;
        return;
      }
      this.bgPending = -1;
      const old = this.bgOld;
      if (old) {
        for (const im of old.imgs) im.destroy();
        this.bgOld = null;
      }
      if (instant && this.bgCur) {
        for (const im of this.bgCur.imgs) im.destroy();
        this.bgCur = null;
      }
      this.bgOld = this.bgCur;
      const imgs: Img[] = [];
      for (let k = 0; k < 3; k++) imgs.push(this.add.image(0, 0, K.bg(seg)).setOrigin(0, 0).setDepth(D.bgNew));
      if (this.bgOld) for (const im of this.bgOld.imgs) im.setDepth(D.bgOld);
      this.bgCur = { seg, imgs, startX };
      this.bgFadeT = instant ? 1 : 0;
      for (const im of imgs) im.setAlpha(instant ? 1 : 0);
      // 신혼집은 저녁(살짝 어둡게) → 도착하면 불이 켜짐
      if (seg === SEG_COUNT - 1) for (const im of imgs) im.setTint(0xcdc4e6);
    }

    renderBg(layer: BgLayer, alpha: number) {
      const sg = WR_SEGMENTS[layer.seg].bg;
      const sc = this.DH / sg.h;
      const tw = sg.w * sc;
      const local = Math.max(0, (this.worldX - layer.startX) * C.BG_PARALLAX);
      const first = Math.floor(local / tw);
      for (let j = 0; j < layer.imgs.length; j++) {
        const k = first + j;
        const im = layer.imgs[j];
        im.setScale(sc);
        im.setFlipX(k % 2 === 1); // 끝이 이어지지 않는 배경 → 좌우 반전 교대
        im.setPosition(k * tw - local, 0);
        im.setAlpha(alpha);
        im.setVisible(k * tw - local < this.DW + 2);
      }
    }

    /* ═════════ 발판 ═════════ */

    /** 화면 오른쪽 밖까지 발판 조각을 이어 붙인다(구간 경계는 새 발판의 둥근 끝을 위에 겹쳐 놓고, 바닥 틈은 끝 마개로 닫음) */
    buildPlatform() {
      const until = this.worldX - C.PLAYER_X + this.DW + 320;
      let guard = 0;
      while (this.pfX < until && guard++ < 40) {
        const lapD = this.pfX - this.lapStartX;
        const seg = clamp(segmentAt(lapD + 0.5), 0, SEG_COUNT - 1);
        const ts = this.pfTexSeg(seg);
        this.ensurePfFrames(ts);
        const P = this.pfGeo(ts);
        const segEnd = seg < SEG_COUNT - 1 ? this.lapStartX + SEG_START[seg + 1] : Infinity;
        const pit = this.planner.pits.find((p) => p.x1 > this.pfX + 1);
        const pitB = pit ? pit.x0 - P.roundR : Infinity;
        // 한 번에 평평한 조각 하나 길이까지만(그 앞의 바닥 틈은 planner 가 이미 계획해 둠 — pitMinX 약속)
        const b = Math.min(segEnd, pitB, this.pfX + P.flatLen);
        const kind = b === pitB ? 'pit' : b === segEnd ? 'seg' : 'cont';
        if (!this.pfOpen) this.placeCap(P, 'capL', this.pfX - P.roundL);
        const end = kind === 'seg' ? b + 14 : b;
        this.placeFlats(P, this.pfX, end);
        if (kind === 'pit' && pit) {
          this.placeCap(P, 'capR', b - P.capExtra);
          this.placeShade(pit.x0, pit.x1);
          this.pfX = pit.x1 + P.roundL;
          this.pfOpen = false;
        } else if (kind === 'seg') {
          this.pfX = segEnd;
          this.pfOpen = false;
        } else {
          this.pfX = b - 0.75;
          this.pfOpen = true;
        }
      }
    }

    placeCap(P: PfGeo, frame: 'capL' | 'capR', x: number) {
      const img = this.acquire(P.key, frame).setOrigin(0, 0).setScale(P.s).setDepth(D.platform);
      const w = img.frame.width * P.s;
      this.pieces.push({ img, wx: x, w, yTop: P.footY * P.s });
    }

    placeFlats(P: PfGeo, x0: number, x1: number) {
      let x = x0;
      let guard = 0;
      while (x1 - x > 1 && guard++ < 20) {
        const len = Math.min(P.flatLen, x1 - x);
        const img = this.acquire(P.key, 'flat').setOrigin(0, 0).setScale(P.s).setDepth(D.platform);
        if (len < P.flatLen - 0.5) {
          img.setFlipX(false);
          img.setCrop(0, 0, len / P.s + 1, P.flatH);
        } else {
          img.setFlipX(this.pfFlip % 2 === 1); // 평평한 부분을 좌우 반전 교대로 → 이음매 색이 이어짐
          this.pfFlip++;
        }
        this.pieces.push({ img, wx: x, w: len, yTop: P.footY * P.s });
        x += len - 0.75;
      }
    }

    placeShade(x0: number, x1: number) {
      const img = this.acquire(TEX.pit).setOrigin(0, 0).setDepth(D.pit);
      this.shades.push({ img, x0: x0 - 3, x1: x1 + 3 });
    }

    /* ═════════ 게임 흐름 ═════════ */

    startGame() {
      if (this.mode === 'boot') {
        this.pendingStart = true;
        return;
      }
      if (this.mode === 'run' || this.mode === 'dying') return;
      if (this.mode === 'over') {
        this.restartGame();
        return;
      }
      this.beginRun();
    }

    restartGame() {
      if (this.mode === 'boot') {
        this.pendingStart = true;
        return;
      }
      if (this.paused) {
        this.paused = false;
        this.scene.resume();
      }
      this.resetWorld();
      this.beginRun();
    }

    beginRun() {
      this.mode = 'run';
      this.paused = false;
      this.fpsGrace = 3;
      hooks.sound.unlock();
      hooks.sound.play('start');
      hooks.sound.bgmStart();
      hooks.sound.bgmTempo(1);
      hooks.emit({ type: 'segment', index: 0, name: WR_SEGMENTS[0].name });
      // (261011 사장 맵 제목) 시작은 '01 · 서울' — 1단계 문구('결혼 준비, 출발!')는 제목 아래로 내려 같이 보인다(화면 has-maptitle)
      this.emitMapTitle(0);
      hooks.emit({ type: 'stage', stage: 0, text: C.STAGE_TEXT[0] });
      this.emitScore(true);
      if (this.tutorialPending) this.startTutorial();
      this.manageTextures();
    }

    pauseGame(): boolean {
      if (this.paused || !(this.mode === 'run' || this.mode === 'dying')) return false;
      this.paused = true;
      this.clearInput();
      this.dbg.botSlide = false;
      // 멈춘 동안 카메라 흔들림 오프셋이 굳지 않게(재개하면 tickGimmicks 가 남은 만큼 다시 흔든다)
      this.cameras.main.resetFX();
      this.scene.pause();
      hooks.sound.bgmPause(true);
      return true;
    }

    resumeGame() {
      if (!this.paused) return;
      this.paused = false;
      this.clearInput();
      this.fpsGrace = 2;
      this.scene.resume();
      hooks.sound.unlock();
      hooks.sound.bgmPause(false);
    }

    isPaused() {
      return this.paused;
    }
    acceptsInput() {
      return this.mode === 'run' && !this.paused;
    }
    isLive() {
      return (this.mode === 'run' || this.mode === 'dying') && !this.paused;
    }

    setInput(kind: 'jump' | 'slide', down: boolean, src: 'touch' | 'key') {
      if (down) hooks.sound.unlock();
      if (kind === 'jump') {
        if (src === 'touch') this.inp.jumpTouch = down;
        else this.inp.jumpKey = down;
        // 새로 누름 — 다음 물리 걸음에서 땅이면 점프(버퍼), 공중이면 2단 점프(곧 안전한 땅이면 버퍼)
        if (down && this.acceptsInput()) this.pl.jumpPress = true;
      } else {
        if (src === 'touch') this.inp.slideTouch = down;
        else this.inp.slideKey = down;
        if (down && this.acceptsInput() && this.pl.grounded && !this.pl.sliding && !this.inputLocked()) this.startSlide();
      }
    }

    inputLocked() {
      const k = this.seq?.kind;
      return k === 'photo' || k === 'arrive' || k === 'next';
    }

    /* ═════════ 연습(첫 판 조작 안내) ═════════ */

    startTutorial() {
      // 첫 안내는 TUTORIAL_INTRO_SEC 뒤에(frameLogic) — 같은 틱에 보내면 1단계 문구 '결혼 준비, 출발!' 배너를 바로 덮어 첫 판엔 한 번도 안 보였다(261011 검증 low)
      this.tut = { active: true, step: 0, obs: null, retries: 0, introT: C.TUTORIAL_INTRO_SEC };
      this.planner.enabled = false;
      const def = WR_SEGMENTS[0].obstacles.find((o) => o.key === 'couple_selfie') ?? WR_SEGMENTS[0].obstacles[0];
      this.tut.obs = this.planner.addTutorial(def, this.worldX + C.TUTORIAL_FIRST_AT, 'jump');
    }

    /** 첫 조작 안내 문구(1단계 문구가 먼저 보인 뒤) */
    tickTutorialIntro(dt: number) {
      const t = this.tut;
      if (!t.active || t.introT <= 0) return;
      t.introT -= dt;
      if (t.introT <= 0) hooks.emit({ type: 'event', kind: 'tutorial', text: hooks.isTouch ? C.EVENT_TEXT.tutorialJumpTouch : C.EVENT_TEXT.tutorialJumpKey });
    }

    updateTutorial() {
      const t = this.tut;
      if (!t.active || !t.obs) return;
      const o = t.obs;
      if (o.meetX > this.worldX - 140) return; // 아직 안 지나감
      const rt = this.obs.find((r) => r.plan === o);
      const bumped = !!rt?.bumped;
      if (bumped && t.retries < 2) {
        t.retries++;
        hooks.emit({ type: 'event', kind: 'tutorial', text: C.EVENT_TEXT.tutorialRetry });
        t.obs = this.planner.addTutorial(o.g.def, this.worldX + 1150, o.tutorial ?? 'jump');
        return;
      }
      if (t.step === 0) {
        t.step = 1;
        t.retries = 0;
        this.planner.addHeartRow(this.worldX + 420, 4);
        hooks.emit({ type: 'event', kind: 'tutorial', text: hooks.isTouch ? C.EVENT_TEXT.tutorialSlideTouch : C.EVENT_TEXT.tutorialSlideKey });
        const pigeon = WR_SEGMENTS[0].obstacles.find((d) => d.kind === 'flying') ?? WR_SEGMENTS[0].obstacles[0];
        t.obs = this.planner.addTutorial(pigeon, this.worldX + 1500, 'slide');
        return;
      }
      // 연습 끝 — 이제부터 충돌은 실제
      t.active = false;
      t.obs = null;
      this.tutorialPending = false;
      hooks.emit({ type: 'event', kind: 'tutorial', text: C.EVENT_TEXT.tutorialDone });
      this.planner.reset(this.plannerCtx(), this.worldX + this.spawnAhead + 260);
      this.planner.enabled = true;
    }

    /* ═════════ 매 프레임 ═════════ */

    update(_time: number, deltaMs: number) {
      if (this.mode === 'boot') return;
      this.monitorFps(deltaMs);
      const realDt = Math.min(deltaMs / 1000, C.MAX_FRAME_DT);
      const dt = realDt * this.dbg.timeScale;
      if (this.mode === 'run') {
        let remain = dt;
        let n = 0;
        while (remain > 1e-6 && n++ < 40 && this.mode === 'run') {
          const h = Math.min(C.MAX_SUBSTEP, remain);
          this.step(h);
          remain -= h;
        }
        if (this.mode === 'run') this.frameLogic(dt);
      } else if (this.mode === 'dying') {
        this.dyingStep(dt);
      } else if (this.mode === 'idle') {
        this.pl.runT += dt;
      }
      // 시작 화면·결과 화면에서도 빠진 그림(첫 로딩에서 실패한 캐릭터 등)을 다시 받는다(261011 검증 high)
      if (this.mode === 'idle' || this.mode === 'over') this.loaderTick(realDt);
      this.animateObstacles(dt);
      this.renderAll(dt);
    }

    monitorFps(deltaMs: number) {
      if (!this.isLive()) return;
      if (this.fpsGrace > 0) {
        this.fpsGrace -= deltaMs / 1000;
        return;
      }
      this.fpsAcc += deltaMs;
      this.fpsN++;
      if (this.fpsAcc >= 3000) {
        const fps = (this.fpsN * 1000) / this.fpsAcc;
        this.fpsAcc = 0;
        this.fpsN = 0;
        if (fps < C.LOW_FPS) {
          hooks.onLowFps();
          this.fpsGrace = 2;
        }
      }
    }

    /** 물리·충돌 한 걸음(최대 1/120초) */
    step(h: number) {
      // 속도: 바퀴 안 거리에 비례한 목표 속도 × 연출 배수(출발 가속·촬영 감속·도착 정지)
      const lapD = this.worldX - this.lapStartX;
      if (this.speedMul < this.speedTarget) this.speedMul = Math.min(this.speedTarget, this.speedMul + this.speedRate * h);
      else if (this.speedMul > this.speedTarget) this.speedMul = Math.max(this.speedTarget, this.speedMul - this.speedRate * h);
      this.speed = Math.min(C.MAX_SPEED, speedAt(this.lap, lapD)) * easeOut(clamp(this.speedMul, 0, 1));
      const dx = this.speed * h;
      this.worldX += dx;
      this.distance += dx;
      this.runTime += h;

      // 장애물 이동(다가오는 것) — 기믹 움직임은 τ(만남까지 남은 시간) 함수로 자리를 바로 계산(생성기와 같은 자리에서 만남)
      for (const o of this.obs) {
        if (o.dead && !o.plan.motion) continue;
        const mo = o.plan.motion;
        if (mo && o.sTab) {
          const vp = o.plan.vPlan || Math.max(1, speedAt(this.lap, lapD));
          const r = o.plan.meetX - this.worldX;
          const tau = r / vp;
          o.tau = tau;
          o.wx = this.worldX + r + vp * motionS(o.sTab, mo, tau);
          o.dy = motionY(mo, Math.max(0, tau));
          o.armed = motionArmed(mo, tau);
        } else {
          if (o.plan.moveFrac > 0 && !o.dead) o.wx -= o.plan.moveFrac * speedAt(this.lap, lapD) * this.speedMulFactor() * h;
          o.tau = (o.plan.meetX - this.worldX) / Math.max(1, speedAt(this.lap, lapD));
        }
      }

      if (this.dbg.bot) this.botThink();
      this.playerStep(h);
      if (this.mode !== 'run') return;
      this.collide();
      if (this.mode === 'run') this.collect();
    }

    speedMulFactor() {
      return easeOut(clamp(this.speedMul, 0, 1));
    }

    playerStep(h: number) {
      const pl = this.pl;
      pl.coyote -= h;
      pl.jumpBuf -= h;
      pl.slideT -= h;
      pl.invuln -= h;
      pl.djDefer -= h;
      pl.runT += h * (0.85 + this.speed / 900);
      const locked = this.inputLocked();
      const groundUnder = !this.planner.pitAt(this.worldX);
      const overhead = this.overheadNear();

      // 점프 새로 누름 — 땅·코요테면 버퍼(기존), 공중이면 2단 점프(단, 안전한 땅에 0.1초 안에 내리면 기존 '착지 즉시 점프')
      if (pl.jumpPress) {
        pl.jumpPress = false;
        if (!locked) {
          if (pl.grounded || pl.coyote > 0 || pl.falling || !this.canDouble()) pl.jumpBuf = C.JUMP_BUFFER_SEC;
          else if (this.landingSoonSafe()) pl.jumpBuf = C.JUMP_BUFFER_SEC;
          else this.tryDouble(false);
        }
      }
      if (pl.djDefer > 0 && !pl.grounded) this.tryDouble(true);

      // 머리 위 장애물 밑에서 누른 점프는 빠져나간 직후로 미룸(관대)
      if (pl.jumpBuf > 0 && overhead && pl.sliding) pl.jumpBuf = Math.max(pl.jumpBuf, h * 2);
      if (!locked && pl.jumpBuf > 0 && !(overhead && pl.sliding) && !pl.falling && (pl.grounded || pl.coyote > 0)) this.doJump();
      if (!locked && this.slideHeld && pl.grounded && !pl.sliding) this.startSlide();

      if (!pl.grounded) {
        pl.airT += h;
        const g = C.GRAVITY * pl.gMul * (this.slideHeld && !locked && !pl.falling ? C.FAST_FALL_MUL : 1);
        pl.vy -= g * h;
        pl.y += pl.vy * h;
        if (pl.y <= 0 && pl.vy <= 0 && !pl.falling) {
          if (groundUnder) {
            pl.y = 0;
            pl.vy = 0;
            pl.grounded = true;
            pl.airT = 0;
            pl.gMul = 1;
            pl.djAvail = false;
            pl.djDefer = 0;
            this.onLand();
          } else if (pl.y < -6) {
            this.onPit();
          }
        }
        if (pl.falling && pl.y < -40) this.die('pit');
      } else if (!groundUnder) {
        // 걸어서 틈으로 — 아주 잠깐(코요테) 점프 허용(2단 점프는 없음 — 틈 난이도 유지)
        pl.grounded = false;
        pl.coyote = C.COYOTE_SEC;
        pl.vy = 0;
        pl.sliding = false;
        pl.djAvail = false;
        pl.gMul = 1;
      }

      if (pl.sliding) {
        const keep = this.slideHeld || pl.slideT > 0 || overhead;
        if (!keep || !pl.grounded) pl.sliding = false;
      }
    }

    doJump() {
      const pl = this.pl;
      pl.vy = C.JUMP_V;
      pl.grounded = false;
      pl.sliding = false;
      pl.jumpBuf = 0;
      pl.coyote = 0;
      pl.airT = 0;
      pl.djAvail = true;
      pl.djDefer = 0;
      // 물리는 '이륙 때' 정해짐(공정성 규칙 8) — 바람 구역 안에서 뛴 점프만 중력 ×0.78(착지까지)
      pl.gMul = this.planner.envAt(this.worldX, 'wind') ? C.GIMMICK_TUNING.windG : 1;
      hooks.sound.play('jump');
    }

    /** 2단 점프를 쓸 수 있나 — 진짜 점프 뒤 1회, 이륙 DJUMP_MIN_AIR 뒤, 연습 전엔 잠금 */
    canDouble(): boolean {
      const pl = this.pl;
      return this.djUnlocked && pl.djAvail && !pl.grounded && !pl.falling && pl.airT >= C.DJUMP_MIN_AIR && !this.inputLocked();
    }

    /** 안전한 땅(틈·바닥 전기 아님)에 DJUMP_LAND_BUFFER 안에 내리나 */
    landingSoonSafe(): boolean {
      const pl = this.pl;
      if (pl.vy > 0) return false;
      const g = C.GRAVITY * pl.gMul;
      const t = (pl.vy + Math.sqrt(pl.vy * pl.vy + 2 * g * Math.max(0, pl.y))) / g;
      if (t >= C.DJUMP_LAND_BUFFER) return false;
      const x = this.worldX + this.speed * t;
      if (this.planner.pitAt(x)) return false;
      for (const o of this.obs) {
        if (o.dead || o.plan.g.code !== 'zap') continue;
        if (x + 40 > o.wx + o.plan.g.hit.x0 && x - 40 < o.wx + o.plan.g.hit.x1) return false;
      }
      return true;
    }

    /** 2단 점프 — 초속 = min(600, √(2·g2·(190 − 높이))). 지금 더 빨리 오르는 중이면 0.25초까지 기다렸다 적용 */
    tryDouble(deferred: boolean) {
      const pl = this.pl;
      if (!this.canDouble()) {
        pl.djDefer = 0;
        return;
      }
      const g2 = C.GRAVITY * C.DJUMP_G_MUL;
      const v2 = Math.min(C.DJUMP_V, Math.sqrt(Math.max(0, 2 * g2 * (C.DJUMP_PEAK_MAX - pl.y))));
      if (v2 <= pl.vy) {
        if (!deferred) pl.djDefer = C.DJUMP_DEFER;
        return;
      }
      pl.vy = v2;
      pl.gMul = C.DJUMP_G_MUL;
      pl.djAvail = false;
      pl.djDefer = 0;
      pl.sliding = false;
      this.fxDust.explode(6, this.px - 4, this.groundY - pl.y - 4);
      const ring = this.acquire(TEX.ring).setDepth(D.fx).setPosition(this.px, this.groundY - pl.y + 2).setScale(0.6).setAlpha(0.95);
      this.tweens.add({ targets: ring, scaleX: 1.5, scaleY: 1.5, alpha: 0, duration: 320, ease: 'Quad.easeOut', onComplete: () => this.release(ring) });
      hooks.sound.play('djump');
    }

    startSlide() {
      this.pl.sliding = true;
      this.pl.slideT = C.SLIDE_MIN_SEC;
      hooks.sound.play('slide');
    }

    onLand() {
      hooks.sound.play('land');
      this.fxDust.explode(4, this.px - 10, this.groundY - 2);
      if (this.slideHeld && !this.inputLocked()) this.startSlide();
    }

    onPit() {
      const pl = this.pl;
      // 보호막·무적이면 통통 튕겨 올려 줌(틈은 '충돌'이 아니지만 응원 보호막이 지켜 줌)
      if (this.shieldOn || pl.invuln > 0 || this.dbg.god || this.tut.active || this.seq?.kind === 'arrive' || this.seq?.kind === 'next') {
        pl.vy = C.JUMP_V * 1.05;
        pl.y = 0;
        if (this.shieldOn) this.consumeShield();
        this.fxSpark.explode(10, this.px, this.groundY - 20);
        hooks.sound.play('pop');
        return;
      }
      pl.falling = true;
      pl.sliding = false;
      this.logDeath('pit');
      // 앞으로 계속 가면 틈 건너편 발판 '속'으로 빠져 보임 → 바로 멈추고 틈 안으로 쏙
      this.speedTarget = 0;
      this.speedRate = 6;
      this.player.setDepth(D.playerFall);
      hooks.sound.play('fall');
    }

    /** 플레이어 충돌 상자(월드) */
    playerBox(): Box {
      const pose: PoseKind = this.pl.sliding ? 'slide' : this.pl.grounded ? 'run' : 'jump';
      const g = CHAR_GEOM[this.stage];
      const b = g.hit[pose];
      // 상자는 기준점(worldX) 기준(geom.ts) — 신랑 합류 중 신부가 뒤로 물러나는 동안만 그림과 같이 옮긴다(평소 d = 0)
      const d = this.plOffX - g.offX;
      return { x0: this.worldX + d + b.x0, x1: this.worldX + d + b.x1, b: this.pl.y + b.b, t: this.pl.y + b.t };
    }

    /** 그림 피벗(신부 발)의 화면 x */
    get px() {
      return C.PLAYER_X + this.plOffX;
    }

    obsBox(o: ObsRT): Box {
      const g = o.plan.g;
      const lift = g.lift + o.bobY + o.dy;
      return { x0: o.wx + g.hit.x0, x1: o.wx + g.hit.x1, b: lift + g.hit.b, t: lift + g.hit.t };
    }

    overheadNear(): boolean {
      // 일어서면 쓸 달리기 상자 둘레(뒤 10·앞 38 여유) — 커플 단계도 상자 기준이라 같은 범위
      const g = CHAR_GEOM[this.stage];
      const d = this.plOffX - g.offX;
      const px0 = this.worldX + d + g.hit.run.x0 - 10;
      const px1 = this.worldX + d + g.hit.run.x1 + 38;
      for (const o of this.obs) {
        if (o.dead || o.plan.g.action !== 'slide') continue;
        // 아직 안 내리꽂힌 번개도 '머리 위'로 본다(곧 떨어질 자리에서 일어서지 않게)
        const x0 = o.wx + o.plan.g.hit.x0;
        const x1 = o.wx + o.plan.g.hit.x1;
        if (x1 > px0 && x0 < px1) return true;
      }
      return false;
    }

    collide() {
      if (this.pl.falling) return;
      const k = this.seq?.kind;
      if (k === 'arrive' || k === 'next') return;
      const pb = this.playerBox();
      for (const o of this.obs) {
        if (o.dead || !o.armed) continue;
        const ob = this.obsBox(o);
        if (ob.x1 < pb.x0 || ob.x0 > pb.x1 || ob.t < pb.b || ob.b > pb.t) continue;
        if (this.pl.invuln > 0 || this.dbg.god) continue;
        this.onHit(o);
        if (this.mode !== 'run') return;
      }
    }

    onHit(o: ObsRT) {
      const code = o.plan.g.code;
      const zappy = code === 'zap' || code === 'bolt';
      // 2단 점프 연습 띠: 넘어지지 않고 '찌릿'만 — 다음 연습 띠로(최대 2번 더)
      if (o.plan.practice) {
        o.bumped = true;
        o.dead = true;
        o.img.setTint(0x9aa0b8);
        this.pl.invuln = 0.6;
        this.pl.blink = 0.6;
        this.fxSpark.explode(10, this.px + 10, this.groundY - 16);
        hooks.sound.play('zap');
        return;
      }
      if (zappy && !this.tut.active) {
        // 번개·전기에 맞아도 귀엽게 '찌릿' 반짝(폭력 연출 없음, 사양서 [6]) — 그다음 기존 넘어짐
        this.fxSpark.explode(14, this.px + 6, this.groundY - this.pl.y - C.CHAR_H * (code === 'bolt' ? 0.9 : 0.15));
        hooks.sound.play('zap');
      }
      // 연습 구간: 넘어지지 않고 통 — 다시 해 보게
      if (this.tut.active) {
        o.bumped = true;
        this.poof(o);
        this.pl.invuln = 0.8;
        this.pl.blink = 0.8;
        hooks.sound.play('bump');
        return;
      }
      if (this.shieldOn) {
        this.poof(o);
        this.consumeShield();
        this.pl.invuln = C.SHIELD_INVULN_SEC;
        this.pl.blink = C.SHIELD_INVULN_SEC;
        hooks.emit({ type: 'event', kind: 'shield', text: C.EVENT_TEXT.shieldBlock });
        return;
      }
      // 부딪힌 장애물을 신부 앞으로 — 무엇에 걸려 넘어졌는지 보이게(그대로 두면 드레스 뒤에 가려짐)
      o.img.setDepth(D.player + 1);
      this.logDeath('hit', o);
      this.die('hit');
    }

    logDeath(cause: string, o?: ObsRT) {
      if (process.env.NODE_ENV === 'production') return;
      const lapD = this.worldX - this.lapStartX;
      this.deaths.push({ cause, key: o?.plan.g.def.key, gim: o?.plan.gim, lap: this.lap, seg: this.curSeg, lapD: Math.round(lapD), t: +this.runTime.toFixed(2) });
      if (this.deaths.length > 200) this.deaths.shift();
    }

    poof(o: ObsRT) {
      o.dead = true;
      const x = o.wx - this.viewX;
      const y = this.groundY - o.plan.g.lift - (o.plan.g.hit.b + o.plan.g.hit.t) / 2;
      this.fxSpark.explode(12, x, y);
      this.tweens.add({ targets: o.img, alpha: 0, scaleX: o.img.scaleX * 1.15, scaleY: o.img.scaleY * 1.15, duration: 260 });
      if (o.hint) this.tweens.add({ targets: o.hint, alpha: 0, duration: 200 });
    }

    consumeShield() {
      this.shieldOn = false;
      this.shieldT = 0;
      hooks.sound.play('pop');
      this.fxHeart.explode(8, this.px, this.groundY - C.CHAR_H * 0.6);
      this.tweens.add({ targets: this.shield, alpha: 0, scale: this.shield.scale * 1.3, duration: 260, onComplete: () => this.shield.setVisible(false) });
      hooks.emit({ type: 'shield', on: false });
    }

    die(cause: 'hit' | 'pit') {
      if (this.mode !== 'run') return;
      // 도착해서 완주 수가 이미 오른 뒤(도착 연출·하얀 전환)에 끝나면 결과 구간은 '다음 여정 0' — 서버 시간 창(완주 수 + 구간)과 맞게
      this.dieAfterArrive = (this.seq?.kind === 'arrive' && this.seq.stopped) || (this.seq?.kind === 'next' && !this.seq.rebuilt);
      this.mode = 'dying';
      this.dieCause = cause;
      this.dyingT = 0;
      this.pl.sliding = false;
      this.dbg.botSlide = false;
      this.seq = null;
      this.groom.setVisible(false);
      this.setHudDim(false);
      this.fxWind.stop();
      // (261011 검증 low) 정전·플래시 중에 넘어지면 다시 시작할 때까지 화면이 캄캄·하얗게 굳던 것 → 짧게 걷어 냄(넘어진 장면이 보이게), 흔들림도 멈춤
      this.tweens.killTweensOf([this.darkOv, this.flashOv, this.darkLine, this.plGlow]);
      this.tweens.add({ targets: [this.darkOv, this.flashOv, this.darkLine, this.plGlow], alpha: 0, duration: 260 });
      this.darkA = 0;
      this.cameras.main.resetFX();
      hooks.sound.bgmStop();
      if (cause === 'hit') {
        hooks.sound.play('trip');
        this.fxDust.explode(8, this.px + 20, this.groundY - 4);
        this.fxSpark.explode(6, this.px + 30, this.groundY - C.CHAR_H * 0.85);
      }
      this.emitScore(true);
    }

    dyingStep(dt: number) {
      this.dyingT += dt;
      // 땅은 빠르게 멈추고, 신부는 'stumble' 로 앞으로 살짝 넘어짐(폭력 연출 없음)
      this.speed *= Math.exp(-dt * 7);
      this.worldX += this.speed * dt * 0.35;
      if (this.dieCause === 'pit') {
        this.pl.vy -= C.GRAVITY * dt;
        this.pl.y = Math.max(-260, this.pl.y + this.pl.vy * dt);
      } else if (!this.pl.grounded) {
        this.pl.vy -= C.GRAVITY * dt;
        this.pl.y = Math.max(0, this.pl.y + this.pl.vy * dt);
        if (this.pl.y <= 0) this.pl.grounded = true;
      }
      if (this.dyingT >= C.STUMBLE_SEC) {
        this.mode = 'over';
        hooks.emit({ type: 'gameover', result: this.result() });
      }
    }

    result(): WRResult {
      return {
        score: this.score(),
        stage: this.stage,
        segment: this.dieAfterArrive ? 0 : this.curSeg,
        arrived: this.laps > 0,
        laps: this.laps,
        durationMs: Math.round(this.runTime * 1000),
        hearts: this.hearts,
        envelopes: this.envelopes,
      };
    }

    /** 점수 = 거리 + 수집·보너스, 그리고 (달린 초 × WR_MAX_SCORE_PER_SEC) 로 한 번 더 자름(서버 검증과 같은 상한) */
    score(): number {
      const raw = Math.floor(this.distance / C.DIST_PER_POINT) + this.bonus;
      return Math.max(0, Math.min(raw, Math.floor(this.runTime * C.WR_MAX_SCORE_PER_SEC)));
    }

    emitScore(force = false) {
      const s = this.score();
      const now = this.time.now;
      if (!force && (s === this.lastScore || now - this.lastScoreEmit < 100)) return;
      this.lastScore = s;
      this.lastScoreEmit = now;
      const lapD = this.worldX - this.lapStartX;
      hooks.emit({ type: 'score', score: s, stage: this.stage, segment: this.segShown, toHome: clamp(lapD / C.LAP_LEN, 0, 1), lap: this.lap });
    }

    /** 프레임 단위 일(생성·코스 이벤트·연출·점수 알림) */
    frameLogic(dt: number) {
      const lapD = this.worldX - this.lapStartX;
      const v = speedAt(this.lap, lapD);

      // 구간: 배경은 경계가 화면 가운데쯤 왔을 때 교차 전환, 'segment' 알림은 신부가 경계를 지날 때
      if (lapD < C.LAP_LEN) {
        const seg = segmentAt(lapD);
        if (seg !== this.curSeg) {
          // 앞 구간 알림을 이미 했으면 기다림을 새로 세고, 아직 기다리는 중이면 이어서 센다(E2: 짧은 구간마다 0 으로 돌아가 영영 안 알리던 것)
          if (this.segShown === this.curSeg) this.segWaitT = 0;
          this.curSeg = seg;
          this.segCrossT = this.runTime;
          // 잠시 포기한 그림도 구간이 바뀌면 바로 다시(망이 돌아왔을 수 있음 — 261011 검증 high)
          this.expireBackoff();
          this.manageTextures();
          // 배경음도 구간마다 살짝 빨라짐(귀로도 '갈수록 빨라짐')
          hooks.sound.bgmTempo(1 + 0.08 * (this.lap - 1) + 0.006 * seg);
        }
        const ahead = segmentAt(lapD + this.DW * 0.55 - C.PLAYER_X);
        if (ahead !== this.bgCur?.seg && ahead !== this.bgPending && ahead > (this.bgCur?.seg ?? -1)) {
          this.setBg(ahead, this.worldX, false);
        }
      }
      if (this.bgPending >= 0 && this.textures.exists(K.bg(this.bgPending))) this.setBg(this.bgPending, this.worldX, false);
      this.syncSegmentNotice(dt);
      if (this.bgFadeT < 1) {
        this.bgFadeT = Math.min(1, this.bgFadeT + dt / C.BG_FADE_SEC);
        if (this.bgFadeT >= 1 && this.bgOld) {
          for (const im of this.bgOld.imgs) im.destroy();
          this.bgOld = null;
        }
      }

      // 단계 전환(첫 바퀴)
      if (this.lap === 1 && !this.seq && this.stage < 4 && lapD >= STAGE_DIST[this.stage + 1]) {
        const next = this.stage + 1;
        if (next === 3) this.beginGroom();
        else if (this.pl.grounded && !this.pl.sliding && this.charReady(next)) this.beginStage(next);
      }
      // 웨딩 촬영
      if (!this.flags.photo && !this.seq && lapD >= PHOTO_DIST && this.pl.grounded && !this.pl.sliding) this.beginPhoto();
      if (!this.flags.photo && lapD >= PHOTO_DIST + v * 1.5) this.flags.photo = true; // 계속 공중이면 건너뜀
      // 하객 응원 보호막
      if (!this.flags.shield && lapD >= SHIELD_DIST) {
        this.flags.shield = true;
        this.shieldOn = true;
        this.shieldT = C.SHIELD_SEC;
        this.shield.setVisible(true).setAlpha(0);
        this.tweens.add({ targets: this.shield, alpha: 0.95, duration: 260 });
        hooks.sound.play('cheer');
        this.fxHeart.explode(10, this.px, this.groundY - C.CHAR_H * 0.7);
        hooks.emit({ type: 'event', kind: 'shield', text: C.EVENT_TEXT.shield });
        hooks.emit({ type: 'shield', on: true });
      }
      if (this.shieldOn) {
        this.shieldT -= dt;
        if (this.shieldT <= 0) {
          this.shieldOn = false;
          this.tweens.add({ targets: this.shield, alpha: 0, duration: 300, onComplete: () => this.shield.setVisible(false) });
          hooks.emit({ type: 'shield', on: false });
        }
      }
      // 신혼여행 출발
      if (!this.flags.honeymoon && lapD >= HONEYMOON_DIST) {
        this.flags.honeymoon = true;
        hooks.sound.play('plane');
        // 신혼여행 출발: 하트가 퐁퐁 + 반짝 (꽃잎은 부케 이벤트 몫)
        this.fxHeart.explode(14, this.px + 40, this.groundY - C.CHAR_H * 0.8);
        this.fxSpark.explode(16, this.px + 60, this.groundY - C.CHAR_H * 0.9);
        hooks.emit({ type: 'event', kind: 'honeymoon', text: C.EVENT_TEXT.honeymoon });
      }
      // 신혼집이 보여요(도착 직전 강조)
      if (!this.houseShown && lapD >= C.LAP_LEN - (this.DW + 500)) this.showHouse();
      if (!this.flags.homeNotice && lapD >= C.LAP_LEN - C.HOME_NOTICE_SEC * v) {
        this.flags.homeNotice = true;
        hooks.sound.play('bell');
        hooks.emit({ type: 'event', kind: 'arrive', text: C.EVENT_TEXT.homeNotice });
      }
      // 도착: 남은 거리 = 감속 거리(배수가 1→0 으로 줄 때 easeOut 속도 적분 = v × 정지시간 × 2/3)
      if (!this.flags.arrive && lapD >= C.LAP_LEN - (v * C.ARRIVE_STOP_SEC * 2) / 3) this.beginArrive();

      this.updateSeq(dt);
      this.tickTutorialIntro(dt);
      this.updateTutorial();
      this.tickGimmicks(dt);
      // 빠진 그림 다시 요청(구간이 바뀔 때만 요청하던 것 보강 — E2)
      this.loaderTick(dt);
      // 2단 점프 꼭대기에선 머리가 왼쪽 위 구간 알약 밑을 지나감 → 알약 흐리게
      if (!this.hudDim && this.pl.y > C.HUD_DIM_FEET[0]) this.setHudDim(true);
      else if (this.hudDim && this.pl.y < C.HUD_DIM_FEET[1]) this.setHudDim(false);

      if (this.rainT > 0) {
        this.rainT -= dt;
        if (this.rainT <= 0) this.fxRain.stop();
      }
      if (this.comboT > 0) {
        this.comboT -= dt;
        if (this.comboT <= 0) this.combo = 0;
      }
      this.pl.blink -= dt;

      // 그림 자리: 신랑이 뛰어 들어오는 동안(updateSeq)만 서서히, 그 밖엔 단계 값 그대로
      if (!(this.seq?.kind === 'groom' && !this.seq.joined)) this.plOffX = CHAR_GEOM[this.stage].offX;

      // 생성·정리
      this.planner.setStagesFrom(this.lap === 1 ? this.stage + 1 : 5);
      // 발판은 한 번에 평평한 조각 하나(최대 ≈2,700)씩 앞서 깔리므로 계획은 그보다 멀리
      this.planner.planUntil(this.worldX + this.spawnAhead + 3400);
      this.spawn();
      this.buildPlatform();
      this.despawn();
      this.emitScore();
    }

    /**
     * 'segment' 알림(HUD 구간 이름)은 그 구간 배경·발판 그림이 준비된 뒤에 — 느린 네트워크에서 HUD 는 '웨딩플래너 상담' 인데
     * 배경은 서울·발판은 종로로 남던 장면 방지(261011 검증 low). 배경 교차 전환(bgPending)도 그림이 오는 순간 시작하므로 이름과 같이 바뀐다.
     * 받기를 포기했거나(3회 실패) SEG_NOTICE_WAIT_SEC 넘게 안 오면 그냥 알린다. 결과·서버 제출의 구간(curSeg)은 실제 진행 그대로.
     */
    syncSegmentNotice(dt: number) {
      if (this.segShown === this.curSeg) return;
      this.segWaitT += dt;
      const sg = this.curSeg;
      const visReady = this.textures.exists(K.bg(sg)) && this.textures.exists(K.pf(sg));
      const gaveUp = [K.bg(sg), K.pf(sg)].some((k) => (this.failed.get(k) ?? 0) >= C.LOADER_GIVE_UP);
      if (!visReady && !gaveUp && this.segWaitT < C.SEG_NOTICE_WAIT_SEC) return;
      this.segShown = this.curSeg;
      hooks.emit({ type: 'segment', index: this.curSeg, name: WR_SEGMENTS[this.curSeg].name });
      // (261011 사장 맵 제목) 경계를 지나는 순간(그림이 0.8초 넘게 늦으면 생략 — 촘촘한 구간 한가운데에 뜨지 않게)
      if (this.runTime - this.segCrossT <= C.MAP_TITLE_LATE_SEC && !(this.lap > 1 && sg === 0)) this.emitMapTitle(sg);
      this.emitScore(true);
    }

    emitMapTitle(sg: number) {
      const t = C.SEG_TITLES[sg];
      if (!t) return;
      hooks.emit({ type: 'maptitle', index: sg, no: t.no, name: WR_SEGMENTS[sg].name, line: t.line, lap: this.lap });
    }

    /* ═════════ 기믹(261011 사장 — 예고 신호·환경 연출·2단 점프 연습) ═════════ */

    tickGimmicks(dt: number) {
      const pl = this.planner;
      const wx = this.worldX;
      // 예고: 소리 + 화면 신호(처음이면 문구), 위협이 화면 밖이면 오른쪽 끝 아이콘
      for (const w of pl.warns) {
        if (w.beats) {
          let i = w.beatIdx ?? 0;
          while (i < w.beats.length && wx >= w.beats[i]) {
            if (w.beatSound) hooks.sound.play(w.beatSound);
            i++;
          }
          w.beatIdx = i;
        }
        if (w.fired || wx < w.x) continue;
        w.fired = true;
        this.fireWarn(w);
      }
      // 예고 아이콘: 첫 요소가 화면 안에 들어오면(또는 만남 직전) 사라짐
      if (this.warnRT.length) {
        const keep: WarnRT[] = [];
        for (const r of this.warnRT) {
          r.t += dt;
          const o = this.obs.find((q) => q.plan.id === r.w.obsId);
          const onScreen = !!o && o.img.visible && o.img.x < this.DW - 40;
          const gone = wx >= r.w.contactX - 0.15 * this.speed || r.t > 2.4 || onScreen;
          if (gone) {
            if (r.icon) this.release(r.icon);
          } else keep.push(r);
        }
        this.warnRT = keep;
      }
      // 환경형: 정전·플래시 덮개, 난기류 흔들림, 바람 줄
      let dark = 0;
      let flash = 0;
      let wind = false;
      for (const e of pl.envs) {
        const v = Math.max(1, e.v);
        if (e.kind === 'blackout') {
          const pre = C.GIMMICK_TUNING.blackoutPre * v;
          const post = C.GIMMICK_TUNING.blackoutPost * v;
          const A = C.GIMMICK_TUNING.blackoutAlpha;
          if (wx >= e.x0 - pre && wx < e.x0) {
            // 0.6초 깜빡 예고(.6 → .1 → .75 → .15)
            const k = (wx - (e.x0 - pre)) / pre;
            dark = Math.max(dark, k < 0.25 ? 0.6 : k < 0.5 ? 0.1 : k < 0.75 ? 0.75 : 0.15);
          } else if (wx >= e.x0 && wx <= e.x1) dark = Math.max(dark, A);
          else if (wx > e.x1 && wx < e.x1 + post) {
            const k = (wx - e.x1) / post;
            dark = Math.max(dark, k < 0.33 ? 0.35 : k < 0.66 ? 0.7 : 0.2);
          }
        } else if (e.kind === 'flash') {
          if (wx >= e.x0 && wx <= e.x1) {
            flash = Math.max(flash, C.GIMMICK_TUNING.flashAlpha * (1 - (wx - e.x0) / Math.max(1, e.x1 - e.x0)) + 0.1);
            if (!this.envStarted.has(e.id)) {
              this.envStarted.add(e.id);
              hooks.sound.play('flash');
            }
          }
        } else if (e.kind === 'turb') {
          if (wx >= e.x0 && wx < e.x1) {
            if (!this.envStarted.has(e.id)) {
              this.envStarted.add(e.id);
              hooks.sound.play('shake');
            }
            // 그림만 흔들림(월드·충돌 그대로). 남은 길이만큼 — 연쇄 기믹이 구간을 늘렸거나(261011 검증 medium) 일시정지로 멈췄으면 다시 이어서
            const cam = this.cameras.main;
            if (!cam.shakeEffect.isRunning) cam.shake(Math.max(50, ((e.x1 - wx) / v) * 1000), C.GIMMICK_TUNING.turbIntensity);
          }
        } else if (e.kind === 'wind') {
          if (wx >= e.x0 - 0.9 * v && wx <= e.x1 + 0.2 * v) wind = true;
        }
      }
      if (Math.abs(dark - this.darkA) > 0.001) {
        this.darkA = dark;
        this.darkOv.setAlpha(dark);
        this.darkLine.setAlpha(dark > 0.5 ? 0.35 : 0);
        this.plGlow.setAlpha(dark > 0.5 ? 0.35 : 0);
      }
      this.flashOv.setAlpha(flash);
      if (wind && !this.fxWind.emitting) this.fxWind.start();
      else if (!wind && this.fxWind.emitting) this.fxWind.stop();
      // 바람에 밀리는 모습: 몸을 뒤로 젖힘 + 발 뒤 흙먼지(그림만)
      const inWind = !!pl.envAt(wx, 'wind');
      this.windLean += ((inWind ? 1 : 0) - this.windLean) * Math.min(1, dt * 6);
      if (inWind && this.pl.grounded && Math.random() < dt * 9) this.fxDust.explode(1, this.px - 26, this.groundY - 3);
      this.updateDjTut();
    }

    fireWarn(w: PlanWarn) {
      const g = GIMMICKS[w.gim];
      this.firedGi.add(w.gi);
      const v = Math.max(1, this.speed);
      this.fair.push({ gi: w.gi, gim: w.gim, lap: this.lap, warnLead: +((w.contactX - this.worldX) / v).toFixed(2), seenLead: null });
      if (this.fair.length > 300) this.fair.shift();
      hooks.sound.play(w.sound);
      if (w.tutorial) {
        // 2단 점프 연습 시작 — 이때부터 2단 점프 사용 가능
        this.djUnlocked = true;
        // idx = 판정할 연습 띠 id, gi = 시도 횟수(연습 1 + 실패 시 다음 전기 2개까지)
        this.djTut = { active: true, gi: 1, idx: w.obsId ?? 0, ok: false };
        hooks.emit({ type: 'event', kind: 'tutorial', text: hooks.isTouch ? C.EVENT_TEXT.djTutorialTouch : C.EVENT_TEXT.djTutorialKey });
      } else if (w.first && C.GIMMICK_TEXT[w.gim]) hooks.emit({ type: 'event', kind: 'gimmick', text: C.GIMMICK_TEXT[w.gim] });
      // 기믹별 화면 신호
      if (w.gim === 'mil-bolt') {
        // 하늘 번쩍(위 띠만 흰 .35 — 장애물 안 가림)
        this.tweens.killTweensOf(this.flash);
        this.flash.setCrop(0, 0, 4, 4 * 0.4).setAlpha(0.35);
        this.tweens.add({ targets: this.flash, alpha: 0, duration: 260, delay: 120, onComplete: () => this.flash.setCrop() });
        // (261011 사장 원문 '시어머니가 호통치면 번개') 시어머니 없이 오는 번개(2바퀴~ 쌍번개 등)는 오른쪽 위에 시어머니가 잠깐 나와 호통
        if (!this.planner.obs.some((p) => p.gi === w.gi && p.g.def.key === 'scolding_mother')) this.momCameo();
      } else if (w.gim === 'turbulence') {
        this.seatbelt.setVisible(true).setAlpha(0).setPosition(this.DW - 70, 92).setScale(0.9);
        this.tweens.killTweensOf(this.seatbelt);
        this.tweens.add({ targets: this.seatbelt, alpha: 1, duration: 180, yoyo: true, hold: 2400, onComplete: () => this.seatbelt.setVisible(false) });
      } else if (w.gim === 'paper-rain') {
        this.fxPaper.explode(14, this.DW * 0.75, -20);
      } else if (w.gim === 'zap-floor') {
        // 가전이 '징—' 하며 불꽃(띠 끝 뒤 장식)
        const d = this.decorRT.find((r) => Math.abs(r.p.x - w.contactX) < 900);
        if (d) this.fxSpark.explode(10, d.p.x - this.viewX, this.groundY - d.p.dy - 30);
      }
      // 화면 밖 위협 → 오른쪽 끝 경고 아이콘(그 높이)
      if (w.kind !== 'none') {
        const key = w.kind === 'ground' ? TEX.warnGround : w.kind === 'head' ? TEX.warnHead : TEX.warnSky;
        const icon = this.acquire(key).setDepth(D.warn).setScale(0.62);
        icon.setPosition(this.DW - 30, this.groundY - Math.max(22, w.h));
        this.tweens.add({ targets: icon, scaleX: 0.72, scaleY: 0.72, duration: 220, yoyo: true, repeat: -1 });
        this.warnRT.push({ w, icon, t: 0 });
      }
      void g;
    }

    /** 시어머니 깜짝 호통(번개 예고와 함께, 화면 오른쪽 위 — 길·장애물 높이를 가리지 않는 하늘 쪽) */
    momCameo() {
      const def = defByKey('scolding_mother');
      const key = K.ob('scolding_mother', 0);
      const x = this.DW - 78;
      const feet = this.groundY - 196;
      const imgs: Img[] = [];
      let headY = feet - 40;
      if (def && this.textures.exists(key)) {
        const g = obsGeom(def);
        const f0 = def.frames[0];
        const m = this.acquire(key).setDepth(D.warn).setFlipX(g.flip).setScale(g.scale * 0.62);
        m.setOrigin((g.flip ? f0.w - def.pivot.x : def.pivot.x) / f0.w, def.pivot.y / f0.h).setPosition(x, feet);
        imgs.push(m);
        headY = feet - g.hit.t * 0.62 - 4;
      }
      const sh = this.acquire(TEX.shout).setDepth(D.warn).setOrigin(0.5, 1).setScale(0.72).setPosition(x - 8, headY);
      imgs.push(sh);
      for (const im of imgs) {
        im.setAlpha(0);
        this.cameos.push(im);
        this.tweens.add({ targets: im, alpha: 1, x: im.x, duration: 160 });
        this.tweens.add({
          targets: im,
          alpha: 0,
          delay: 1050,
          duration: 260,
          onComplete: () => {
            this.cameos = this.cameos.filter((c) => c !== im);
            this.release(im);
          },
        });
      }
      this.tweens.add({ targets: sh, y: headY - 4, duration: 70, yoyo: true, repeat: 6 });
    }

    /**
     * 2단 점프 연습: 연습 띠를 지나면 판정 — 성공하면 '이제 진짜 전기예요', 실패하면 이 구간의 다음 바닥 전기를 연습(넘어지지 않음)으로
     * 바꿔 한 번 더(최대 2번 더 — 사장 '연습 1회' + 설계 '실패 시 최대 2회 더'). 연습 띠를 따로 더 깔지 않아 구간 길이를 안 먹는다.
     */
    updateDjTut() {
      const t = this.djTut;
      if (!t.active) return;
      const cur = this.planner.obs.find((p) => p.id === t.idx);
      if (!cur) {
        t.active = false;
        return;
      }
      if (cur.meetX + cur.g.w / 2 > this.worldX - 60) return; // 아직 다 안 지나감
      const rt = this.obs.find((o) => o.plan === cur);
      const bumped = !!rt?.bumped;
      if (!bumped) {
        t.active = false;
        t.ok = true;
        hooks.emit({ type: 'event', kind: 'tutorial', text: C.EVENT_TEXT.djDone });
        return;
      }
      t.ok = false;
      const next = t.gi < 3 ? this.planner.obs.find((p) => p.g.code === 'zap' && !p.practice && p.meetX > this.worldX + 200 && p.meetX < this.worldX + 9000) : undefined;
      if (!next) {
        t.active = false;
        hooks.emit({ type: 'event', kind: 'tutorial', text: C.EVENT_TEXT.djRetry.replace('괜찮아요! ', '') });
        return;
      }
      next.practice = true;
      next.hint = C.GIMMICK_HINT['zap-floor'];
      const nrt = this.obs.find((o) => o.plan === next);
      if (nrt && !nrt.hint) nrt.hint = this.acquire(hintKeyOf(next.hint)).setDepth(D.hint).setOrigin(0.5, 1).setScale(0.58);
      t.idx = next.id;
      t.gi++;
      hooks.emit({ type: 'event', kind: 'tutorial', text: C.EVENT_TEXT.djRetry });
    }

    get viewX() {
      return this.worldX - C.PLAYER_X;
    }

    /** 장애물 텍스처 키(코드 그림 기믹은 코드 텍스처) */
    obsTexKey(p: PlanObs, frame = 0): string {
      switch (p.g.code) {
        case 'bolt':
          return TEX.bolt;
        case 'zap':
          return TEX.zap;
        case 'ribbon':
          return TEX.ribbon;
        case 'bubble':
          return bubbleKey(Math.max(0, NAG_LINES.indexOf(p.text ?? '')));
        default:
          return K.ob(p.g.def.key, frame);
      }
    }

    spawn() {
      const ahead = this.spawnAhead;
      for (const p of this.planner.obs) {
        if (p.spawned) continue;
        const half = p.g.drawW / 2;
        let sTab: Float32Array | null = null;
        let need: number;
        const r = p.meetX - this.worldX;
        if (p.motion) {
          // 움직임 표는 생성기가 한 번 만들어 둔 것(없으면 한 번 만들어 붙여 둠) — 매 프레임 601칸 새로 만들던 것(261011 검증 low)
          sTab = p.sTab ?? (p.sTab = motionTable(p.motion));
          const vp = p.vPlan || 500;
          need = r + vp * motionS(sTab, p.motion, r / vp);
        } else need = Math.max(0, r) * (1 + p.moveFrac);
        if (need - half > ahead) continue;
        p.spawned = true;
        const def = p.g.def;
        const f0 = def.frames[0];
        const key = this.obsTexKey(p);
        if (!this.textures.exists(key)) continue; // 이미지가 빠졌으면(메모리 정리 경합) 그냥 건너뜀
        const img = this.acquire(key);
        const code = p.g.code;
        if (!code) {
          img.setFlipX(p.g.flip);
          img.setOrigin((p.g.flip ? f0.w - def.pivot.x : def.pivot.x) / f0.w, def.pivot.y / f0.h);
          img.setScale(p.g.scale);
          img.setDepth(def.kind === 'air' ? D.air : def.kind === 'flying' ? D.flying : D.ground);
        } else if (code === 'bolt') {
          img.setOrigin(0.5, 1).setDepth(D.bolt).setAlpha(0);
        } else if (code === 'zap') {
          // 띠: 왼쪽 끝 기준, 필요한 폭만 잘라 씀(충돌은 E, 그림은 양끝 10씩 더)
          img.setOrigin(0, 1).setDepth(D.zap).setCrop(0, 0, p.g.drawW, 34).setAlpha(0.35);
        } else if (code === 'surf') {
          const sd = defByKey('surfboard');
          img.setOrigin(0.5, 0.5).setScale(sd ? obsGeom(sd).scale : 0.26).setAngle(90).setDepth(D.flying);
        } else {
          img.setOrigin(0.5, 1).setDepth(D.flying);
        }
        const wx = this.worldX + need;
        let hint: Img | null = null;
        if (p.tutorial) {
          hint = this.acquire(p.tutorial === 'jump' ? TEX.hintJump : TEX.hintSlide).setDepth(D.hint).setOrigin(0.5, 1).setScale(0.62);
        } else if (p.hint) {
          hint = this.acquire(hintKeyOf(p.hint)).setDepth(D.hint).setOrigin(0.5, 1).setScale(0.58);
        }
        const marks: Partial<Record<MarkKind, Img>> = {};
        for (const m of p.marks ?? []) {
          if (m === 'boltMark') marks.boltMark = this.acquire(TEX.boltMark).setDepth(D.marks).setOrigin(0.5, 1).setAlpha(0);
          else if (m === 'shout') marks.shout = this.acquire(TEX.shout).setDepth(D.marks).setOrigin(0.5, 1).setScale(0.8).setVisible(false);
          else if (m === 'shadow') marks.shadow = this.acquire(TEX.shadow).setDepth(D.shadow).setOrigin(0.5, 0.5);
          else if (m === 'eyes') marks.eyes = this.acquire(TEX.eyes).setDepth(D.marks).setOrigin(0.5, 0.5).setScale(0.9);
          else if (m === 'count') marks.count = this.acquire(countKey(3)).setDepth(D.marks).setOrigin(0.5, 1).setScale(0.75).setVisible(false);
        }
        const tau = p.motion ? r / (p.vPlan || 500) : r / Math.max(1, this.speed);
        // 확인용: 그 기믹 덩어리 첫 요소가 화면에 들어온 때(만남까지 초)
        if (p.first && p.gi) {
          const f = this.fair.find((q) => q.gi === p.gi);
          if (f && f.seenLead == null) f.seenLead = +tau.toFixed(2);
        }
        this.obs.push({
          plan: p,
          img,
          wx,
          frameT: 0,
          frame: 0,
          bob: Math.random() * Math.PI * 2,
          bobY: 0,
          dead: false,
          bumped: false,
          passed: false,
          hint,
          sTab,
          dy: p.motion ? motionY(p.motion, Math.max(0, tau)) : 0,
          armed: motionArmed(p.motion, tau),
          tau,
          marks,
          struck: false,
          bornT: this.runTime,
        });
      }
      // 장식(바닥 전기 띠 끝 가전 — 충돌 없음, 배경 쪽)
      for (const d of this.planner.decor) {
        if (d.spawned || d.x - this.worldX > ahead + 120) continue;
        d.spawned = true;
        const key = K.ob(d.def.key, 0);
        if (!this.textures.exists(key)) continue;
        const g = obsGeom(d.def);
        const f0 = d.def.frames[0];
        const img = this.acquire(key).setDepth(D.decor);
        img.setFlipX(g.flip);
        img.setOrigin((g.flip ? f0.w - d.def.pivot.x : d.def.pivot.x) / f0.w, d.def.pivot.y / f0.h);
        img.setScale(g.scale * d.scale).setTint(0xe2d9f0).setAlpha(0.88);
        this.decorRT.push({ p: d, img });
      }
      for (const it of this.planner.items) {
        if (it.spawned) continue;
        if (it.x - this.worldX > ahead + 40) break;
        it.spawned = true;
        const img = this.acquire(it.kind === 'heart' ? TEX.heart : TEX.envelope).setDepth(D.items);
        img.setScale(it.kind === 'heart' ? 0.3 : 0.36);
        this.items.push({ plan: it, img, wx: it.x, h: it.h, done: false, phase: it.x * 0.013 });
      }
    }

    despawn() {
      const left = this.viewX - 260;
      if (this.obs.length) {
        const keep: ObsRT[] = [];
        for (const o of this.obs) {
          const right = o.wx + o.plan.g.drawW;
          if (right < left) this.releaseObs(o);
          else keep.push(o);
        }
        this.obs = keep;
      }
      if (this.decorRT.length) {
        const keep: DecorRT[] = [];
        for (const d of this.decorRT) {
          if (d.p.x + 120 < left) this.release(d.img);
          else keep.push(d);
        }
        this.decorRT = keep;
      }
      if (this.items.length) {
        // 먹은 것(done)은 이미 목록에서 빠졌다(collect) — 남은 건 아직 안 먹은 것뿐
        const keep: ItemRT[] = [];
        for (const it of this.items) {
          if (it.done) continue;
          if (it.wx < left) this.release(it.img);
          else keep.push(it);
        }
        this.items = keep;
      }
      if (this.pieces.length) {
        const keep: Piece[] = [];
        for (const p of this.pieces) {
          if (p.wx + p.w + 40 < left) this.release(p.img);
          else keep.push(p);
        }
        this.pieces = keep;
      }
      if (this.shades.length) {
        const keep: PitShade[] = [];
        for (const s of this.shades) {
          if (s.x1 < left) this.release(s.img);
          else keep.push(s);
        }
        this.shades = keep;
      }
      this.planner.prune(this.viewX - 400);
    }

    collect() {
      const pb = this.playerBox();
      let took = false;
      for (const it of this.items) {
        if (it.done) continue;
        const r = (it.plan.kind === 'heart' ? 13 : 16) + C.COLLECT_GRACE;
        const cx = it.wx;
        const cy = it.h;
        const nx = clamp(cx, pb.x0, pb.x1);
        const ny = clamp(cy, pb.b, pb.t);
        if ((nx - cx) * (nx - cx) + (ny - cy) * (ny - cy) > r * r) continue;
        it.done = true;
        if (it.plan.kind === 'heart') {
          this.hearts++;
          this.bonus += C.HEART_VALUE;
          this.combo = Math.min(9, this.combo + 1);
          this.comboT = 0.9;
          hooks.sound.play('heart', this.combo);
        } else {
          this.envelopes++;
          this.bonus += C.ENVELOPE_VALUE;
          hooks.sound.play('envelope');
          this.fxSpark.explode(6, it.wx - this.viewX, this.groundY - it.h);
        }
        // 이 이미지는 이제 트윈 몫 — 트윈 끝에서 딱 한 번 반납. 목록에 남겨 두면 같은 프레임에 풀에서 다시 꺼낸 다른 물체와
        // 같은 Image 를 쥔 채 남아, 다시 도전·다음 여정(resetWorld·nextLap)에서 한 번 더 반납되는 사고가 났다(261011 검증 high)
        const img = it.img;
        took = true;
        this.tweens.add({
          targets: img,
          y: img.y - 34,
          alpha: 0,
          scale: img.scale * 1.35,
          duration: 280,
          ease: 'Quad.easeOut',
          onComplete: () => this.release(img),
        });
      }
      if (took) this.items = this.items.filter((it) => !it.done);
    }

    /* ═════════ 연출 순서(단계·신랑·촬영·도착·다음 여정) ═════════ */

    beginStage(next: number) {
      this.seq = { kind: 'stage', t: 0, to: next, swapped: false };
      if (next === 1) hooks.emit({ type: 'event', kind: 'bouquet', text: C.EVENT_TEXT.bouquet });
      if (next === 2) hooks.emit({ type: 'event', kind: 'ceremony', text: C.EVENT_TEXT.ceremony });
      hooks.sound.play('stage');
    }

    beginGroom() {
      if (!this.textures.exists(K.gr('run_01')) || !this.charReady(3)) return; // 아직 이미지 받는 중 → 다음 프레임에 다시
      this.seq = { kind: 'groom', t: 0, joined: false, x: -120 };
      // 신부 앞(가까운 쪽)으로 지나가며 오른쪽 자리로 — 뒤로 지나가면 드레스·머리에 가려 안 보임
      this.groom.setVisible(true).setScale(GROOM_SCALE).setDepth(D.player + 0.5);
      const gp = WR_GROOM.pivot;
      const gf = WR_GROOM.frames.run_01;
      this.groom.setOrigin(gp.x / gf.w, gp.y / gf.h);
      hooks.sound.play('groom');
      hooks.emit({ type: 'event', kind: 'groom', text: C.EVENT_TEXT.groom });
    }

    beginPhoto() {
      this.flags.photo = true;
      this.seq = { kind: 'photo', t: 0, flashes: 0 };
      this.speedTarget = C.PHOTO_SLOW;
      this.speedRate = 5;
      this.pl.jumpBuf = 0;
      hooks.emit({ type: 'event', kind: 'photo', text: C.EVENT_TEXT.photo });
    }

    beginArrive() {
      this.flags.arrive = true;
      this.seq = { kind: 'arrive', t: 0, stopped: false, holdT: 0 };
      this.speedTarget = 0;
      this.speedRate = 1 / C.ARRIVE_STOP_SEC;
      this.pl.jumpBuf = 0;
      this.pl.sliding = false;
      if (!this.houseShown) this.showHouse();
    }

    showHouse() {
      this.houseShown = true;
      // 커플(신부 피벗 ~ 신랑 앞끝 ≈ +130, 커플 그림은 offX 만큼 뒤에 그림)이 멈춰 선 바로 앞(오른쪽)에 집 — 겹치지 않게
      this.houseWX = this.lapStartX + C.LAP_LEN + 320 + CHAR_GEOM[this.stage].offX;
      const sc = (C.CHAR_H * 1.75) / 300;
      this.house.setVisible(true).setScale(sc).setAlpha(1);
      this.houseLit.setVisible(true).setScale(sc).setAlpha(0);
      // 직전 강조: 집 뒤에서 연분홍 빛이 두근두근
      this.houseGlow.setVisible(true).setAlpha(0.55).setScale(3.0);
      this.tweens.add({ targets: this.houseGlow, scale: 3.6, alpha: 0.3, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    updateSeq(dt: number) {
      const s = this.seq;
      if (!s) return;
      s.t += dt;
      switch (s.kind) {
        case 'stage': {
          if (!s.swapped && s.t >= 0.12) {
            s.swapped = true;
            this.stage = s.to;
            // 커플 앞끝 맞춤(4→5단계: 신랑 앞끝이 같은 자리에 오게 그림 자리만 바뀜, '팡' 연출에 묻힘)
            this.plOffX = CHAR_GEOM[s.to].offX;
            this.fxSpark.explode(18, this.px + 10, this.groundY - C.CHAR_H * 0.55);
            if (s.to === 1) {
              this.fxPetal.explode(26, this.px + 10, this.groundY - C.CHAR_H * 0.7);
              this.fxRain.start();
              this.rainT = 2.4;
            }
            if (s.to === 4) this.fxHeart.explode(16, this.px + 40, this.groundY - C.CHAR_H * 0.7);
            hooks.emit({ type: 'stage', stage: s.to, text: C.STAGE_TEXT[s.to] });
            this.emitScore(true);
            this.flashOnce(0.35, 260);
          }
          if (s.t >= C.STAGE_FX_SEC) this.seq = null;
          break;
        }
        case 'groom': {
          // 신랑이 왼쪽 밖에서 신부를 따라잡아 오른쪽(앞) 자리로 — 그 자리에 닿으면 4단계 그림으로 교체(이음매 없음, assets WR_GROOM)
          // 합류 자리 = 4단계 커플 그림 속 신랑 자리(커플 그림은 offX 만큼 뒤에 그린다 — geom.ts)
          const g3 = CHAR_GEOM[3];
          const target = C.PLAYER_X + g3.offX + GROOM_JOIN.x;
          const k = clamp(s.t / C.GROOM_RUN_SEC, 0, 1);
          s.x = -120 + (target + 120) * easeOut(k);
          // 신부는 신랑을 기다리듯 서서히 뒤로(커플 그림 자리) — 합류 순간 그림이 이음매 없이 바뀌고, 그 뒤 충돌 앞끝은 1~3단계와 같은 자리
          if (!s.joined) this.plOffX = g3.offX * k * k * (3 - 2 * k);
          if (k >= 1 && !s.joined && this.pl.grounded && !this.pl.sliding) {
            s.joined = true;
            this.stage = 3;
            this.plOffX = g3.offX;
            this.groom.setVisible(false);
            this.fxSpark.explode(20, this.px + 50, this.groundY - C.CHAR_H * 0.6);
            this.fxHeart.explode(10, this.px + 50, this.groundY - C.CHAR_H * 0.8);
            hooks.sound.play('stage');
            hooks.emit({ type: 'stage', stage: 3, text: C.STAGE_TEXT[3] });
            this.emitScore(true);
          }
          if (s.joined && s.t >= C.GROOM_RUN_SEC + 0.5) this.seq = null;
          break;
        }
        case 'photo': {
          // 웨딩 촬영: 느려짐 + celebrate 포즈 + 플래시 두 번 + 보너스
          if (s.flashes === 0 && s.t >= 0.25) {
            s.flashes = 1;
            this.flashOnce(0.9, 300);
            hooks.sound.play('shutter');
            this.fxSpark.explode(14, this.px + 20, this.groundY - C.CHAR_H * 0.6);
          }
          if (s.flashes === 1 && s.t >= 0.62) {
            s.flashes = 2;
            this.flashOnce(0.75, 280);
            hooks.sound.play('shutter');
            this.bonus += C.PHOTO_BONUS;
            this.emitScore(true);
          }
          if (s.t >= C.PHOTO_SEC) {
            this.seq = null;
            this.speedTarget = 1;
            this.speedRate = 2;
          }
          break;
        }
        case 'arrive': {
          if (!s.stopped && this.speedMul <= 0.001) {
            s.stopped = true;
            this.laps++;
            this.bonus += C.ARRIVE_BONUS;
            // 불 켜짐: 집 창문 + 거실 배경 밝아짐 + 따뜻한 빛
            this.tweens.add({ targets: this.houseLit, alpha: 1, duration: 520, ease: 'Quad.easeOut' });
            this.warm.setVisible(true).setAlpha(0).setScale(4.2);
            this.tweens.add({ targets: this.warm, alpha: 0.55, duration: 600 });
            if (this.bgCur) for (const im of this.bgCur.imgs) this.tweens.addCounter({ from: 0, to: 1, duration: 600, onUpdate: (tw) => im.setTint(lerpColor(0xcdc4e6, 0xffffff, tw.getValue() ?? 1)) });
            this.fxHeart.explode(22, this.houseWX - this.viewX, this.groundY - C.CHAR_H);
            this.fxSpark.explode(24, this.houseWX - this.viewX, this.groundY - C.CHAR_H * 1.1);
            hooks.sound.play('arrive');
            // 점수(도착 보너스 포함)를 먼저 알린다 — 화면이 'arrive' 를 받는 순간 그 점수로 최고기록·첫 완주를 저장(261011 통합: 사양서 [10] 완주 연출 중 저장)
            this.emitScore(true);
            hooks.emit({ type: 'arrive', lap: this.lap });
            hooks.emit({ type: 'event', kind: 'arrive', text: C.EVENT_TEXT.arrive });
          }
          if (s.stopped) {
            s.holdT += dt;
            if (s.holdT > 0.5 && s.holdT - dt <= 0.5) this.fxHeart.explode(12, this.px + 40, this.groundY - C.CHAR_H * 0.9);
            if (s.holdT >= C.ARRIVE_HOLD_SEC) {
              this.seq = { kind: 'next', t: 0, rebuilt: false };
              hooks.sound.play('next');
              hooks.emit({ type: 'event', kind: 'next-journey', text: C.EVENT_TEXT.nextJourney });
            }
          }
          break;
        }
        case 'next': {
          const half = C.NEXT_FADE_SEC;
          if (!s.rebuilt) {
            this.fade.setAlpha(clamp(s.t / half, 0, 1));
            if (s.t >= half) {
              s.rebuilt = true;
              this.nextLap();
            }
          } else {
            this.fade.setAlpha(clamp(1 - (s.t - half) / half, 0, 1));
            if (s.t >= half * 2) {
              this.fade.setAlpha(0);
              this.seq = null;
            }
          }
          break;
        }
        default:
          break;
      }
    }

    /** 다음 여정: 서울부터 다시, 더 빠르고 촘촘하게(단계는 5단계 그대로) */
    nextLap() {
      for (const o of this.obs) this.releaseObs(o);
      this.clearGimmickFx();
      // (261011 사장 2단 점프) 2바퀴~ 는 항상 사용 가능
      this.djUnlocked = true;
      for (const it of this.items) this.release(it.img);
      for (const p of this.pieces) this.release(p.img);
      for (const sh of this.shades) this.release(sh.img);
      this.obs = [];
      this.items = [];
      this.pieces = [];
      this.shades = [];
      this.lap += 1;
      this.lapStartX = this.worldX;
      this.curSeg = 0;
      this.segShown = 0;
      this.segWaitT = 0;
      this.segCrossT = this.runTime;
      this.flags = { photo: false, shield: false, honeymoon: false, homeNotice: false, arrive: false };
      this.hideHouse();
      this.setBg(0, this.lapStartX, true);
      this.pfX = this.lapStartX - C.PLAYER_X - 600;
      this.pfOpen = false;
      this.planner.reset(this.plannerCtx(), this.lapStartX + C.QUIET.nextJourney * speedAt(this.lap, 0), { clear: true });
      this.planner.enabled = true;
      this.buildPlatform();
      this.speedMul = 0;
      this.speedTarget = 1;
      this.speedRate = 1 / C.START_ACCEL_SEC;
      this.pl.y = 0;
      this.pl.vy = 0;
      this.pl.grounded = true;
      hooks.sound.bgmTempo(1 + 0.08 * (this.lap - 1));
      this.pl.gMul = 1;
      this.pl.djAvail = false;
      hooks.emit({ type: 'segment', index: 0, name: WR_SEGMENTS[0].name });
      this.manageTextures();
      this.emitScore(true);
    }

    /* ═════════ 그리기 ═════════ */

    animateObstacles(dt: number) {
      if (this.paused) return;
      for (const o of this.obs) {
        const def = o.plan.g.def;
        if (def.anim && def.frames.length > 1 && !o.plan.g.code) {
          o.frameT += dt;
          // 시어머니 호통(예고 뒤)은 8fps 로 빠르게
          const fps = o.marks.shout && o.plan.gi && this.firedGi.has(o.plan.gi) ? 8 : def.fps ?? 6;
          const per = 1 / fps;
          if (o.frameT >= per) {
            o.frameT -= per;
            o.frame = (o.frame + 1) % def.frames.length;
            const key = K.ob(def.key, o.frame);
            if (this.textures.exists(key)) o.img.setTexture(key);
          }
        }
        // 나는 장애물 흔들림(급강하 비둘기는 움직임이 대신 ±3)
        if (def.kind === 'flying' && !o.plan.motion) {
          o.bob += dt * Math.PI * 2 * C.FLY_BOB_HZ;
          o.bobY = Math.sin(o.bob) * C.FLY_BOB_AMP * C.CHAR_H;
        }
      }
    }

    /** 캐릭터 그림·배율·각도(단계·자세) */
    applyPose() {
      const pl = this.pl;
      const st = CHAR_GEOM[this.stage].stage;
      let motion: WrMotion;
      let slide = false;
      const seqCelebrate =
        (this.seq?.kind === 'stage' && this.seq.swapped) ||
        this.seq?.kind === 'photo' ||
        (this.seq?.kind === 'arrive' && this.seq.stopped) ||
        (this.seq?.kind === 'next' && !this.seq.rebuilt);
      if (this.mode === 'dying' || pl.falling) motion = 'stumble';
      else if (this.mode === 'over') motion = 'stumble';
      else if (!pl.grounded) motion = 'jump';
      else if (pl.sliding) {
        motion = 'slide';
        slide = true;
      } else if (seqCelebrate && this.mode === 'run') motion = 'celebrate';
      else {
        const cyc = st.runCycle;
        motion = cyc[Math.floor(pl.runT * 9) % cyc.length];
      }
      let s = this.stage;
      if (!this.charReady(s)) s = 0;
      const stg = WR_CHAR[s];
      const key = K.ch(s, motion);
      if (this.player.texture.key !== key && this.textures.exists(key)) {
        this.player.setTexture(key);
        const f = stg.frames[motion];
        this.player.setOrigin(stg.pivot.x / f.w, stg.pivot.y / f.h);
      }
      let sc = CHAR_GEOM[s].scale * (slide ? stg.slideScale : 1);
      // 단계 전환 '팡'
      if (this.seq?.kind === 'stage') {
        const t = this.seq.t;
        sc *= t < 0.12 ? 1 + (t / 0.12) * 0.14 : 1 + 0.14 * Math.max(0, 1 - (t - 0.12) / 0.2);
      }
      this.player.setScale(sc);
      // 각도: 점프 오를 때 살짝 뒤로, 내릴 때 앞으로 / 넘어질 때 앞으로 기울기
      let ang = 0;
      if (this.mode === 'dying' || this.mode === 'over') ang = this.dieCause === 'pit' ? -14 : Math.min(12, (this.dyingT / 0.3) * 12);
      else if (!pl.grounded) ang = clamp(-pl.vy / 120, -5, 6);
      // (261011 사장 '헤어드라이어 바람(…밀림)') 바람 속에선 뒤로 젖혀 버티는 모습(그림만 — 충돌 상자·속도는 그대로라 공정성 영향 없음)
      if (this.mode === 'run') ang -= 6 * this.windLean;
      this.player.setAngle(ang);
    }

    renderAll(_dt: number) {
      const vx = this.viewX;
      const gy = this.groundY;
      // 배경
      if (this.bgOld) this.renderBg(this.bgOld, 1);
      if (this.bgCur) this.renderBg(this.bgCur, this.bgFadeT);
      // 발판
      for (const p of this.pieces) p.img.setPosition(p.wx - vx, gy - p.yTop);
      for (const s of this.shades) {
        s.img.setPosition(s.x0 - vx, gy - 34);
        s.img.setDisplaySize(Math.max(2, s.x1 - s.x0), this.DH - gy + 44);
      }
      // 장애물
      for (const o of this.obs) this.renderObs(o, vx, gy);
      // 장식(가전)
      for (const d of this.decorRT) d.img.setPosition(d.p.x - vx, gy - d.p.dy);
      // 수집물(정전 중엔 은은히 55%)
      const tnow = this.time.now / 1000;
      const itemA = this.darkA > 0.5 ? 0.55 : 1;
      for (const it of this.items) {
        if (it.done) continue;
        it.img.setPosition(it.wx - vx, gy - it.h + Math.sin(tnow * 4 + it.phase) * 3);
        it.img.setAlpha(itemA);
        if (it.plan.kind === 'envelope') it.img.setAngle(Math.sin(tnow * 3 + it.phase) * 6);
      }
      // 신혼집
      if (this.houseShown) {
        const hx = this.houseWX - vx;
        this.house.setPosition(hx, gy + 6);
        this.houseLit.setPosition(hx, gy + 6);
        this.houseGlow.setPosition(hx, gy - C.CHAR_H * 0.75);
        this.warm.setPosition(hx, gy - C.CHAR_H * 0.9);
      }
      // 플레이어
      this.applyPose();
      const pl = this.pl;
      let bob = 0;
      if (pl.grounded && !pl.sliding && (this.mode === 'run' || this.mode === 'idle')) {
        const single = CHAR_GEOM[this.stage].stage.runCycle.length === 1;
        bob = Math.abs(Math.sin(pl.runT * Math.PI * (single ? 4.5 : 4.5))) * (single ? 4 : 1.6);
        if (single && this.mode === 'run') this.player.setAngle(Math.sin(pl.runT * Math.PI * 4.5) * 1.5);
      }
      let dx = 0;
      if (this.mode === 'dying' || this.mode === 'over') dx = this.dieCause === 'hit' ? easeOut(clamp(this.dyingT / 0.4, 0, 1)) * 16 : 0;
      this.player.setPosition(this.px + dx, gy - pl.y - bob);
      this.player.setAlpha(pl.blink > 0 ? (Math.floor(pl.blink * 14) % 2 ? 0.35 : 1) : 1);
      if (this.plGlow.alpha > 0) this.plGlow.setPosition(this.px + 10, gy - pl.y - C.CHAR_H * 0.5).setDisplaySize(C.CHAR_H * 2.2, C.CHAR_H * 2.0);
      if (!pl.falling && this.mode !== 'dying') this.player.setDepth(D.player);
      // 신랑(합류 연출)
      if (this.seq?.kind === 'groom' && !this.seq.joined) {
        const m = Math.floor(this.seq.t * 10) % 2 ? 'run_02' : 'run_01';
        if (this.groom.texture.key !== K.gr(m)) this.groom.setTexture(K.gr(m));
        this.groom.setPosition(this.seq.x, gy - pl.y + GROOM_JOIN.y - Math.abs(Math.sin(this.seq.t * 14)) * 3);
      }
      // 보호막
      if (this.shield.visible) {
        const couple = this.stage >= 3;
        const cx = this.px + (couple ? 48 : 6);
        const cy = gy - pl.y - C.CHAR_H * 0.5;
        const pulse = 1 + Math.sin(this.time.now / 160) * 0.03;
        this.shield.setPosition(cx, cy);
        this.shield.setDisplaySize(C.CHAR_H * (couple ? 2.15 : 1.45) * pulse, C.CHAR_H * 1.3 * pulse);
      }
      if (this.dbg.hit) this.drawDebug();
      else if (this.dbgGfx) this.dbgGfx.clear();
    }

    /** 장애물 하나 그리기 — 기믹은 추가 높이·코드 그림·붙은 연출까지 */
    renderObs(o: ObsRT, vx: number, gy: number) {
      const g = o.plan.g;
      const x = o.wx - vx;
      const lift = g.lift + o.bobY + o.dy;
      const code = g.code;
      if (code === 'bolt') {
        // 번개: 내리꽂히기 전엔 안 보임(땅 표시만), 내리꽂히면 위에서 아래끝 84 까지
        if (o.armed && !o.struck && !o.dead) {
          o.struck = true;
          hooks.sound.play('strike');
          this.fxSpark.explode(10, x, gy - g.hit.b);
        }
        const bottom = gy - g.hit.b + 6;
        o.img.setPosition(x, bottom).setDisplaySize(44, Math.max(40, bottom + 20));
        const after = o.tau < -0.25 ? Math.max(0, 1 + (o.tau + 0.25) / 0.3) : 1;
        o.img.setAlpha(o.struck ? (0.8 + Math.random() * 0.2) * after : 0);
      } else if (code === 'zap') {
        o.img.setPosition(x - g.drawW / 2, gy + 6);
        const warned = !!o.plan.gi && this.firedGi.has(o.plan.gi);
        o.img.setAlpha(o.dead && !o.plan.practice ? 0.25 : warned || o.plan.practice ? 0.78 + Math.random() * 0.22 : 0.35);
        // 띠 양끝에서 '찌직' 불꽃(전기가 흐른다는 신호)
        if ((warned || o.plan.practice) && !this.paused && Math.random() < 0.12) {
          const ex = Math.random() < 0.5 ? x - g.w / 2 : x + g.w / 2;
          this.fxSpark.explode(2, ex, gy - 6);
        }
      } else if (code === 'surf') {
        o.img.setPosition(x, gy - lift - 9);
      } else if (code === 'bubble' || code === 'ribbon') {
        o.img.setPosition(x, gy - lift - g.hit.b + 6);
      } else {
        o.img.setPosition(x, gy - lift);
      }
      if (o.hint) {
        // 잔소리 탄막은 윗줄(위끝 ≈ 212) 위에 — 첫 요소(아랫줄) 위끝에 두면 윗줄 말풍선에 가린다
        const top = code === 'bolt' ? 60 : code === 'zap' ? 40 : code === 'bubble' ? 214 : lift + g.hit.t;
        o.hint.setPosition(x, gy - Math.min(top, 230) - 14 + Math.sin(this.time.now / 180) * 4);
        o.hint.setVisible(!o.dead || !!o.plan.practice);
      }
      const m = o.marks;
      if (m.boltMark) {
        // 떨어질 자리 땅 표시 — 깜빡이다 내리꽂히면 사라짐
        m.boltMark.setPosition(x, gy + 2).setAlpha(o.struck ? 0 : 0.55 + 0.45 * Math.abs(Math.sin(this.time.now / 110)));
      }
      if (m.shout) {
        const on = !!o.plan.gi && this.firedGi.has(o.plan.gi) && o.tau > -0.2;
        m.shout.setVisible(on).setPosition(x - 6, gy - lift - g.hit.t - 8 + Math.sin(this.time.now / 70) * 2);
      }
      if (m.shadow) {
        // 땅 그림자 — 높이 있을수록 작고 흐리게, 내려올수록 커짐
        const hgt = Math.max(0, lift + g.hit.b);
        const k = 1 - Math.min(1, hgt / 520);
        m.shadow.setPosition(x, gy + 3).setScale(0.35 + 0.65 * k, 0.6 + 0.4 * k).setAlpha(0.25 + 0.6 * k);
      }
      if (m.eyes) {
        // 선반 위 노란 눈빛(뛰어내리기 전까지)
        const shelf = o.plan.motion?.k === 'pounce' ? o.plan.motion.shelf : 150;
        m.eyes.setPosition(x - 4, gy - shelf - 30).setAlpha(o.tau > 1.05 ? 0.6 + 0.4 * Math.abs(Math.sin(this.time.now / 140)) : 0);
      }
      if (m.count) {
        // 사진사 위 3·2·1(플래시 직전까지)
        const t = o.tau - C.GIMMICK_TUNING.flashAt;
        const n = t > 0.5 ? 3 : t > 0.25 ? 2 : t > 0 ? 1 : 0;
        const show = n > 0 && o.tau < C.GIMMICK_TUNING.flashAt + 0.75 && !!o.plan.gi && this.firedGi.has(o.plan.gi);
        m.count.setVisible(show);
        if (show) {
          const key = countKey(n);
          if (m.count.texture.key !== key) m.count.setTexture(key);
          m.count.setPosition(x, gy - lift - g.hit.t - 12);
        }
      }
    }

    drawDebug() {
      if (process.env.NODE_ENV === 'production') return;
      if (!this.dbgGfx) this.dbgGfx = this.add.graphics().setDepth(D.debug);
      const g = this.dbgGfx;
      g.clear();
      const vx = this.viewX;
      const gy = this.groundY;
      const pb = this.playerBox();
      g.lineStyle(2, 0x00ff66, 1).strokeRect(pb.x0 - vx, gy - pb.t, pb.x1 - pb.x0, pb.t - pb.b);
      for (const o of this.obs) {
        const b = this.obsBox(o);
        g.lineStyle(2, o.dead ? 0x999999 : 0xff3355, 1).strokeRect(b.x0 - vx, gy - b.t, b.x1 - b.x0, b.t - b.b);
      }
      for (const p of this.planner.pits) {
        g.lineStyle(2, 0xffaa00, 1).strokeRect(p.x0 - vx, gy - 4, p.x1 - p.x0, 8);
      }
      g.lineStyle(1, 0x3366ff, 0.8).lineBetween(0, gy, this.DW, gy);
    }

    /* ═════════ 개발 확인(자동 봇·구간 건너뛰기 등 — 운영 번들 제외) ═════════ */

    /**
     * 개발 확인용 자동 봇 — 정상 조작만(점프·2단 점프·슬라이드 입력). timing = 창 안 박자(early·center·late), dj = 2단 누름 시각.
     * '불가능 패턴 0' 확인: center 봇이 넘어지면 생성기·기믹 버그(deaths() 로 원인 기록).
     */
    botThink() {
      if (process.env.NODE_ENV === 'production') return;
      const pl = this.pl;
      const pb = this.playerBox();
      const v = Math.max(1, this.speed);
      const shift = this.dbg.timing === 'early' ? 0.07 : this.dbg.timing === 'late' ? -0.07 : 0;
      const inWind = !!this.planner.envAt(this.worldX, 'wind');
      const air = inWind ? C.JUMP_AIR_SEC / C.GIMMICK_TUNING.windG : C.JUMP_AIR_SEC;
      let wantSlide = false;
      const ground = pl.grounded || pl.coyote > 0;
      // (261011 검증 medium) input 모드 = 사람처럼 setInput('jump') 누름·뗌 — 착지 버퍼·2단 분기(jumpPress → landingSoonSafe)를 그대로 시험
      if (this.botHold > 0 && --this.botHold === 0) this.setInput('jump', false, 'key');
      const press = () => {
        if (!this.dbg.input) {
          pl.jumpBuf = 0.05;
          return;
        }
        if (this.botHold > 0) return;
        this.setInput('jump', true, 'key');
        this.botHold = 3;
      };
      for (const o of this.obs) {
        if (o.dead || (!o.armed && o.plan.motion?.k !== 'bolt')) continue;
        const b = this.obsBox(o);
        if (b.x1 < pb.x0 - 4) continue;
        const closing = v * (1 + o.plan.moveFrac);
        if (o.plan.g.code === 'zap') {
          // 바닥 전기: 띠 앞끝 0.08초 전 이륙 → 공중 dj 시각에 2단
          const tf = (b.x0 - pb.x1) / closing;
          if (tf > -0.05 && tf <= 0.08 + shift && ground) {
            press();
            // dj 'none' = 2단 점프를 안 하는 봇(연습 띠·바닥 전기 실패 확인용)
            if (this.dbg.dj !== 'none') this.botDj = { at: this.dbg.dj === 'early' ? 0.2 : this.dbg.dj === 'late' ? 0.6 : 0.33 };
          }
          continue;
        }
        if (o.plan.g.action === 'jump') {
          const center = (b.x0 + b.x1) / 2;
          const tc = (center - this.worldX) / closing;
          const need = air / 2 + 0.01 + shift;
          if (tc > 0 && tc <= need && ground) press();
          if (tc > 0 && tc <= need + 0.35 && pl.sliding && !this.overheadNear()) pl.slideT = 0;
        } else {
          const tf = (b.x0 - pb.x1) / closing;
          if (tf < 0.22 + shift && b.x1 > pb.x0 - 6) wantSlide = true;
        }
      }
      for (const p of this.planner.pits) {
        const center = (p.x0 + p.x1) / 2;
        const tc = (center - this.worldX) / v;
        if (tc > 0 && tc <= C.JUMP_AIR_SEC / 2 + shift && pl.grounded) press();
      }
      // 2단 점프(공중, 정해 둔 시각)
      if (this.botDj && !pl.grounded && pl.airT >= this.botDj.at && this.canDouble() && this.botHold === 0) {
        if (this.dbg.input) press();
        else this.tryDouble(false);
        this.botDj = null;
      }
      if (this.botDj && pl.grounded && pl.jumpBuf <= 0 && !pl.jumpPress) this.botDj = null;
      void tUp;
      this.dbg.botSlide = wantSlide;
    }

    /** 개발용: 구간 seg(0~11)의 시작으로 순간이동(첫 바퀴면 단계도 그 지점에 맞춤) */
    debugSkip(seg: number, frac = 0, tries = 0) {
      if (process.env.NODE_ENV === 'production' || this.mode !== 'run') return;
      const sg = clamp(seg, 0, SEG_COUNT - 1);
      // 그 구간 이미지가 아직이면 받아 온 뒤 이동(발판이 다른 구간 그림으로 깔리는 것 방지)
      if (!this.segReady(sg) && tries < 60) {
        this.requestFiles(segFiles(sg));
        this.time.delayedCall(100, () => this.debugSkip(seg, frac, tries + 1));
        return;
      }
      const lapD = SEG_START[sg] + frac * (SEG_START[1] ?? 1);
      for (const o of this.obs) this.releaseObs(o);
      for (const it of this.items) this.release(it.img);
      for (const p of this.pieces) this.release(p.img);
      for (const sh of this.shades) this.release(sh.img);
      this.clearGimmickFx();
      this.obs = [];
      this.items = [];
      this.pieces = [];
      this.shades = [];
      this.seq = null;
      this.groom.setVisible(false);
      this.tut.active = false;
      this.tutorialPending = false;
      const dx = this.lapStartX + lapD - this.worldX;
      this.worldX += dx;
      this.distance += Math.max(0, dx);
      this.runTime += Math.max(0, dx) / Math.max(1, speedAt(this.lap, lapD));
      if (this.lap === 1) {
        let st = 0;
        for (let i = 0; i < STAGE_DIST.length; i++) if (lapD >= STAGE_DIST[i]) st = i;
        this.stage = st;
        this.plOffX = CHAR_GEOM[st].offX;
        this.requestFiles(charFiles(st));
      }
      this.flags.photo = lapD > PHOTO_DIST;
      this.flags.shield = lapD > SHIELD_DIST;
      this.flags.honeymoon = lapD > HONEYMOON_DIST;
      this.flags.homeNotice = false;
      this.flags.arrive = false;
      this.hideHouse();
      this.curSeg = segmentAt(lapD);
      this.segShown = this.curSeg;
      this.segWaitT = 0;
      this.manageTextures();
      this.setBg(this.curSeg, this.worldX, true);
      this.pfX = this.worldX - C.PLAYER_X - 600;
      this.pfOpen = false;
      this.planner.reset(this.plannerCtx(), this.worldX + this.spawnAhead * 0.8, { clear: true });
      this.planner.enabled = true;
      this.buildPlatform();
      hooks.emit({ type: 'segment', index: this.curSeg, name: WR_SEGMENTS[this.curSeg].name });
      this.emitScore(true);
    }

    debugApi(): Record<string, unknown> {
      if (process.env.NODE_ENV === 'production') return {};
      return {
        state: () => ({
          mode: this.mode,
          paused: this.paused,
          lap: this.lap,
          laps: this.laps,
          stage: this.stage,
          seg: this.curSeg,
          segName: WR_SEGMENTS[this.curSeg]?.name,
          lapD: Math.round(this.worldX - this.lapStartX),
          lapLen: C.LAP_LEN,
          speed: Math.round(this.speed),
          py: Math.round(this.pl.y),
          spr: { x: Math.round(this.player.x), y: Math.round(this.player.y), d: this.player.depth, a: this.player.alpha, v: this.player.visible, tex: this.player.texture.key },
          grounded: this.pl.grounded,
          sliding: this.pl.sliding,
          score: this.score(),
          hearts: this.hearts,
          envelopes: this.envelopes,
          runTime: +this.runTime.toFixed(2),
          obs: this.obs.length,
          items: this.items.length,
          pieces: this.pieces.length,
          pits: this.planner.pits.length,
          seq: this.seq?.kind ?? null,
          shield: this.shieldOn,
          diff: +difficulty(this.lap, this.worldX - this.lapStartX).toFixed(2),
          tut: this.tut.active,
          djUnlocked: this.djUnlocked,
          djAvail: this.pl.djAvail,
          gMul: this.pl.gMul,
          airT: +this.pl.airT.toFixed(2),
          dark: +this.darkA.toFixed(2),
          wind: { emitting: this.fxWind.emitting, alive: this.fxWind.getAliveParticleCount(), env: !!this.planner.envAt(this.worldX, 'wind') },
          djTut: { ...this.djTut },
          hudDim: this.hudDim,
          gim: this.obs.filter((o) => !o.dead && o.plan.gim).map((o) => ({ gim: o.plan.gim, code: o.plan.g.code ?? o.plan.g.def.key, x: Math.round(o.wx - this.viewX), dy: Math.round(o.dy), armed: o.armed, tau: +o.tau.toFixed(2) })),
          textures: this.textures.getTextureKeys().filter((k) => k.startsWith('wr-bg-')).sort(),
          DW: Math.round(this.DW),
          DH: Math.round(this.DH),
          res: this.scale.width + 'x' + this.scale.height,
          visibleObs: this.obs.filter((o) => !o.dead).map((o) => o.plan.g.def.key),
          near: this.obs.filter((o) => !o.dead).map((o) => ({ key: o.plan.g.def.key, kind: o.plan.g.def.kind, x: Math.round(o.wx - this.viewX) })),
          pitsNear: this.planner.pits.map((p) => [Math.round(p.x0 - this.viewX), Math.round(p.x1 - this.viewX)]).filter((p) => p[1] > -100 && p[0] < this.DW + 3000),
        }),
        skip: (seg: number, frac?: number) => this.debugSkip(seg, frac ?? 0),
        god: (on = true) => {
          this.dbg.god = !!on;
        },
        speed: (mul = 1) => {
          this.dbg.timeScale = clamp(mul, 0.1, 8);
        },
        hitboxes: (on = true) => {
          this.dbg.hit = !!on;
        },
        arrive: () => this.debugSkip(SEG_COUNT - 1, 0.86),
        die: () => this.die('hit'),
        lapNow: () => this.lap,
        planner: () => ({ obs: this.planner.obs.length, pits: this.planner.pits.map((p) => [Math.round(p.x0), Math.round(p.x1)]), items: this.planner.items.length, stats: this.planner.stats }),
        lerp2,
        // ── (261011 사장 기믹) ──
        /** 기믹 강제: 다음 빈자리(화면 오른쪽 밖)에 — opt 'practice'(2단 연습)·'blackout'(전기 뒤 정전) */
        gimmick: (id: GimmickId, opt?: 'practice' | 'blackout') => {
          if (this.mode !== 'run' || !GIMMICKS[id]) return false;
          if (id === 'zap-floor' && opt !== 'practice') this.djUnlocked = true;
          this.tut.active = false;
          this.tutorialPending = false;
          this.planner.enabled = true;
          this.planner.force(id, this.worldX + this.spawnAhead + 260, opt);
          return true;
        },
        /** n바퀴 시작으로(5단계·2단 점프 열림) */
        lap: (n: number) => {
          if (this.mode !== 'run') return false;
          const k = Math.max(1, Math.floor(n));
          this.tut.active = false;
          this.tutorialPending = false;
          this.seq = null;
          this.stage = 4;
          this.plOffX = CHAR_GEOM[4].offX;
          this.requestFiles(charFiles(4));
          this.lap = k - 1;
          this.laps = Math.max(this.laps, k - 1);
          this.nextLap();
          return this.lap;
        },
        bot: (on: boolean | { timing?: 'early' | 'center' | 'late'; dj?: 'early' | 'apex' | 'late' | 'none'; input?: boolean } = true) => {
          if (typeof on === 'object') {
            this.dbg.bot = true;
            if (on.timing) this.dbg.timing = on.timing;
            if (on.dj) this.dbg.dj = on.dj;
            if (on.input != null) this.dbg.input = !!on.input;
          } else {
            this.dbg.bot = !!on;
            if (!on) this.dbg.botSlide = false;
          }
        },
        gimmicksOn: (on = true) => {
          this.dbg.gimmicks = !!on;
        },
        gimmickLog: () => this.planner.gimLog.map((g) => ({ ...g, warnX: Math.round(g.warnX), contactX: Math.round(g.contactX), endX: Math.round(g.endX) })),
        fairness: () => this.fair.slice(),
        deaths: () => this.deaths.slice(),
        sched: () => this.planner.scheduleView(),
        skipLog: () => this.planner.skipLog.slice(),
        envs: () => this.planner.envs.map((e) => ({ kind: e.kind, x0: Math.round(e.x0 - this.worldX), x1: Math.round(e.x1 - this.worldX) })),
        title: (i: number) => this.emitMapTitle(clamp(Math.floor(i), 0, SEG_COUNT - 1)),
        unlockDj: (on = true) => {
          this.djUnlocked = !!on;
        },
        djump: () => this.tryDouble(false),
        jump: () => this.setInput('jump', true, 'key'),
        lvl: () => level(this.lap, this.worldX - this.lapStartX),
      };
    }
  };
}

function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}
