// 웨딩런 엔진 입구 — createWeddingRunGame (261011 사장 '웨딩런: 신혼집까지 달려!', 사양서 [12] Phaser 3)
//  · Phaser 는 이 함수 안에서 dynamic import → /wedding-run 에서만 받는 청크, SSR 에서 import 안 됨(모듈 최상단에 window 접근 없음).
//  · 캔버스 해상도 = CSS 크기 × min(기기 픽셀 비율, 2) × 품질(저사양이면 자동으로 낮춤), 카메라가 설계 좌표(세로 450)를 꽉 채움.
//  · 키보드: Space/↑ 점프, ↓ 슬라이드(엔진). Esc 일시정지는 화면 담당. 입력칸(닉네임 등)에 쓰는 키는 건드리지 않음.
//  · 백그라운드(visibilitychange·blur·pagehide) → 자동 일시정지 + 'autopause' 알림. 재개는 화면이 3·2·1 뒤 resume().
//  · 개발 서버에서만 window.__wrDebug(구간 건너뛰기·무적·배속·자동 봇·충돌 상자) — 운영 빌드는 NODE_ENV 가 접혀 빠진다.
import { WR_ENTRY, wrUiSrcs } from '../assets';
import { LOADER_MAX_RETRIES, LOADER_PARALLEL, LOADER_TIMEOUT_MS, MAX_RESOLUTION, MIN_RESOLUTION, RES_STEP } from './config';
import { makeRunScene, type RunSceneApi } from './scene';
import { WRSound } from './sound';
import type { WRCreateOpts, WREvent, WRGame } from './types';

export type { WREvent, WRGame, WRResult, WREventKind, WRCreateOpts } from './types';
export { WR_MAX_SCORE_PER_SEC, STAGE_TEXT, LAP_LEN, FIRST_CLEAR_SEC } from './config';

export async function createWeddingRunGame(parent: HTMLElement, opts: WRCreateOpts): Promise<WRGame> {
  const dev = process.env.NODE_ENV !== 'production';

  let destroyed = false;
  let api: RunSceneApi | null = null;
  let readySent = false;
  let phaserP = 0;
  let created = false;
  let quality = 0; // 저사양 단계(0 = 최대 해상도)
  const sound = new WRSound();
  const emit = (e: WREvent) => {
    if (destroyed) return;
    try {
      opts.onEvent(e);
    } catch {
      /* 화면 쪽 오류가 엔진을 멈추지 않게 */
    }
  };

  /*
   * 로딩 진행 = 엔진 코드(Phaser 청크) 35% + 첫 게임 이미지 50% + UI 이미지 15%.
   * (261011 검증 low: 예전엔 Phaser 청크를 받는 동안이 빠져 느린 4G 에서 숫자 없이 '게임 준비 중…'만 오래 떠 있다가 끝에 15%→97% 로 뛰었다)
   * 청크는 바이트 진행을 알 수 없어 시간에 따라 천천히 차오르는 추정(받는 중엔 35% 를 넘지 않음), 받으면 35% 로 맞춘다.
   * UI 이미지는 청크와 동시에 받기 시작한다(전엔 청크를 다 받은 뒤에야 시작).
   */
  const uiSrcs = [...wrUiSrcs(false), WR_ENTRY.src];
  let uiDone = 0;
  let codeP = 0;
  let lastSent = -1;
  const progress = () => {
    const p = Math.min(0.99, codeP * 0.35 + phaserP * 0.5 + (uiDone / uiSrcs.length) * 0.15);
    const r = Math.round(p * 100) / 100;
    if (r <= lastSent) return; // 뒤로 가지 않게
    lastSent = r;
    emit({ type: 'loading', progress: r });
  };
  const maybeReady = () => {
    if (readySent || !created || uiDone < uiSrcs.length) return;
    readySent = true;
    emit({ type: 'loading', progress: 1 });
    emit({ type: 'ready' });
  };
  emit({ type: 'loading', progress: 0 });
  for (const src of uiSrcs) {
    const im = new Image();
    im.decoding = 'async';
    im.onload = im.onerror = () => {
      uiDone++;
      progress();
      maybeReady();
    };
    im.src = src;
  }

  // 엔진 코드(Phaser) — 받는 동안 진행률을 시간 추정으로 천천히(τ 4초, 최대 0.95)
  const codeT0 = Date.now();
  const codeTimer = setInterval(() => {
    codeP = Math.min(0.95, 1 - Math.exp(-(Date.now() - codeT0) / 4000));
    progress();
  }, 250);
  let mod: { default?: typeof import('phaser') } & typeof import('phaser');
  try {
    mod = (await import('phaser')) as unknown as { default?: typeof import('phaser') } & typeof import('phaser');
  } finally {
    clearInterval(codeTimer);
  }
  codeP = 1;
  progress();
  const Phaser = (mod.default ?? mod) as typeof import('phaser');

  const isTouch = typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window);

  const SceneClass = makeRunScene(Phaser, {
    emit,
    sound,
    isTouch: !!isTouch,
    onLoadProgress: (p) => {
      phaserP = p;
      progress();
    },
    onCreated: (a) => {
      api = a;
      created = true;
      phaserP = 1;
      progress();
      maybeReady();
      if (dev && typeof window !== 'undefined') (window as unknown as { __wrDebug?: unknown }).__wrDebug = a.debugApi();
    },
    onLowFps: () => {
      const base = Math.min(window.devicePixelRatio || 1, MAX_RESOLUTION);
      if (base - (quality + 1) * RES_STEP >= MIN_RESOLUTION - 1e-6) {
        quality++;
        applySize();
      }
    },
  });

  const measure = () => {
    const r = parent.getBoundingClientRect();
    const cssW = Math.max(1, Math.round(r.width || window.innerWidth));
    const cssH = Math.max(1, Math.round(r.height || window.innerHeight));
    const base = Math.min(window.devicePixelRatio || 1, MAX_RESOLUTION);
    const res = Math.max(MIN_RESOLUTION, base - quality * RES_STEP);
    return { cssW, cssH, res, w: Math.round(cssW * res), h: Math.round(cssH * res) };
  };

  const m0 = measure();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#F6EEF8',
    banner: false,
    disableContextMenu: true,
    audio: { noAudio: true },
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    scale: { mode: Phaser.Scale.NONE, width: m0.w, height: m0.h, zoom: 1 / m0.res, autoCenter: Phaser.Scale.NO_CENTER },
    render: { antialias: true, pixelArt: false, roundPixels: false, powerPreference: 'high-performance' },
    fps: { target: 60, smoothStep: true },
    // (261011 검증 E2) 그림 하나가 응답 없으면 로더 전체가 멈춰 뒤 구간 그림을 영영 못 받았다 → 시간 제한 + 자체 재시도
    // 동시 받기 6개(기본 32) — 느린 망에서 큰 그림 수십 장이 대역폭을 나눠 가져 전부 시간 제한에 걸리던 것(검증 high), 앞 순서(캐릭터·첫 구간)부터 끝낸다
    loader: { timeout: LOADER_TIMEOUT_MS, maxRetries: LOADER_MAX_RETRIES, maxParallelDownloads: LOADER_PARALLEL },
    scene: [SceneClass],
  });

  const styleCanvas = () => {
    const c = game.canvas;
    if (!c) return;
    c.style.display = 'block';
    c.style.touchAction = 'none';
    c.style.userSelect = 'none';
    (c.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = 'none';
    c.setAttribute('aria-hidden', 'true');
  };
  styleCanvas();

  let lastKey = '';
  function applySize() {
    if (destroyed) return;
    const m = measure();
    const key = `${m.w}x${m.h}@${m.res}`;
    if (key === lastKey) return;
    lastKey = key;
    try {
      game.scale.setZoom(1 / m.res);
      game.scale.resize(m.w, m.h);
      styleCanvas();
      api?.layout();
    } catch {
      /* 부팅 중 */
    }
  }
  let raf = 0;
  const schedule = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      raf = 0;
      applySize();
    });
  };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
  ro?.observe(parent);
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  game.events.once('ready', () => {
    lastKey = '';
    applySize();
  });

  // 키보드(PC): Space/↑ 점프, ↓ 슬라이드 — 입력칸 타이핑·화면 단축키(Esc 등)는 그대로
  const onKey = (e: KeyboardEvent, down: boolean) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    let kind: 'jump' | 'slide' | null = null;
    if (e.code === 'Space' || e.key === ' ' || e.key === 'ArrowUp' || e.code === 'KeyW') kind = 'jump';
    else if (e.key === 'ArrowDown' || e.code === 'KeyS') kind = 'slide';
    if (!kind || !api) return;
    if (!api.acceptsInput()) {
      if (!down) api.setInput(kind, false, 'key');
      return;
    }
    e.preventDefault();
    if (down && e.repeat) return;
    api.setInput(kind, down, 'key');
  };
  const kd = (e: KeyboardEvent) => onKey(e, true);
  const ku = (e: KeyboardEvent) => onKey(e, false);
  window.addEventListener('keydown', kd);
  window.addEventListener('keyup', ku);

  // 백그라운드로 가면 자동 일시정지
  const autoPause = () => {
    if (!api || !api.isLive()) return;
    if (api.pauseGame()) emit({ type: 'autopause' });
  };
  const onVis = () => {
    if (document.visibilityState === 'hidden') autoPause();
  };
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('blur', autoPause);
  window.addEventListener('pagehide', autoPause);

  let pendingStart = false;
  const handle: WRGame = {
    start() {
      sound.unlock();
      if (!api) {
        pendingStart = true;
        return;
      }
      api.startGame();
    },
    pause() {
      api?.pauseGame();
    },
    resume() {
      sound.unlock();
      api?.resumeGame();
    },
    restart() {
      sound.unlock();
      if (!api) {
        pendingStart = true;
        return;
      }
      api.restartGame();
    },
    setInput(kind, down) {
      api?.setInput(kind, down, 'touch');
    },
    setSound(on) {
      // 켬/끔 값만 바꾼다 — AudioContext 는 사용자 입력 경로(start·restart·resume·setInput)에서만 만든다
      // (261011 검증 low: 엔진 준비 때 화면이 setSound 를 불러 입력 전에 AudioContext 가 생겼다 — 사양서 [12] '음원은 사용자 입력 이후')
      sound.setEnabled(!!on);
    },
    isPaused() {
      return !!api?.isPaused();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      ro?.disconnect();
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', autoPause);
      window.removeEventListener('pagehide', autoPause);
      sound.destroy();
      api = null;
      try {
        game.destroy(true);
      } catch {
        /* 무시 */
      }
      if (dev && typeof window !== 'undefined') delete (window as unknown as { __wrDebug?: unknown }).__wrDebug;
    },
  };

  // 준비 전에 start() 를 불렀다면 준비되는 즉시 시작
  const waitStart = () => {
    if (destroyed) return;
    if (api) {
      if (pendingStart) {
        pendingStart = false;
        api.startGame();
      }
      return;
    }
    setTimeout(waitStart, 50);
  };
  waitStart();

  return handle;
}
