'use client';

// 웨딩런 화면 본체(261011 사장 '웨딩런: 신혼집까지 달려!' 사양서 [3]·[7]·[8]·[9]·[11])
//  · 게임 상태(엔진: 달리기·충돌·점수)와 UI 상태(이 파일: 진입/플레이/일시정지/종료/팝업)를 나눈다 — 엔진과는 WRGame·WREvent 약속으로만.
//  · 엔진(Phaser 3)은 ui/engine-loader 가 dynamic import — 진입 화면이 떠 있는 동안 미리 받아 로딩 진행을 보여 준다.
//  · 일시정지: pause 버튼·Esc·앱 백그라운드(엔진 autopause)·세로로 돌림 → 일시정지 팝업. 재개 = 3·2·1 뒤 engine.resume().
//  · 홈: 진행 중이면 확인 팝업 → 앱 웹뷰면 뒤로, 아니면 /main.
//  · 저장: wr-best · wr-first-clear · wr-max-segment · wr-sound (ui/storage.ts). 신혼집 도착 순간 바로 저장(완주 연출 중 종료돼도 남게).
//  · 랭킹: ranking.ts — 서버가 없으면 '랭킹 준비 중'(가짜 순위 금지).
//  · (261011 검증 반영) 3·2·1 도중 창이 포커스를 잃으면(blur·pagehide) 일시정지로 되돌림 · 재개 때 아직 누르고 있는 슬라이드를 엔진에 다시 알림
//    · 페이지를 떠날 때 안 쓴 세션 토큰을 서버에서 닫음.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { WR_CHAR, WR_ENTRY, WR_UI } from '../assets';
import {
  abandonRun,
  beginRun,
  currentNickname,
  invalidateBoards,
  prepareSession,
  releasePreparedSession,
  setNickname,
  submitRun,
  type SubmitOutcome,
} from '../ranking';
import { buildShare, parseLinkChallenge, shareRecord, type Challenge } from '../share';
import Controls from './Controls';
import { preloadPanel } from './parts';
import Entry from './Entry';
import Hud, { type LiveState } from './Hud';
import { ConfirmHomeModal, CopyFallbackModal, Countdown, HelpModal, NicknameModal, PauseModal, RotateNotice } from './Modals';
import RankingModal from './RankingModal';
import ResultModal, { type ResultView } from './ResultModal';
import { loadEngine } from './engine-loader';
// 엔진 화면 배치 숫자(설계 세로·최소 폭·땅 높이) — config.ts 는 Phaser 를 import 하지 않아 화면 청크에 섞여도 숫자뿐
import { GROUND_FROM_BOTTOM, VIEW_H, VIEW_MIN_W } from '../game/config';
import {
  getBest,
  getFirstClearAt,
  getMaxProgress,
  getSoundOn,
  markFirstClear,
  saveBest,
  saveMaxProgress,
  saveSoundOn,
} from './storage';
import { STAGE_INFO, clampSegment } from './text';
import type { WREvent, WRGame } from './types';
import './wedding-run.css';
import { WR_ALIVE_KEY } from '@/components/WeddingRunRescue';

type Phase = 'entry' | 'playing' | 'paused' | 'countdown' | 'over';
type BannerTone = 'event' | 'stage' | 'tutorial';
type Banner = { id: number; text: string; tone: BannerTone; out?: boolean };
type Big = { id: number; text: string; sub?: string; out?: boolean };
/** (261011 사장 '맵이 바뀔 때마다 어떤 맵인지 페이드인되는 제목') '02 · 종로' + 한 줄 */
type MapTitle = { id: number; no: string; name: string; line: string; out?: boolean };
/** 맵 제목 시간(ms): 0.35초 나타남 → 1.5초 유지 → 0.45초 사라짐 */
const MAP_TITLE_HOLD_MS = 1850;
const MAP_TITLE_OUT_MS = 450;

/** 앱(iOS/안드 웹뷰) 안인가 — 홈 = 뒤로 */
function isAppWebView(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as { webkit?: { messageHandlers?: unknown }; Android?: unknown; FreetifulAndroid?: unknown; ReactNativeWebView?: unknown };
  const ua = navigator.userAgent || '';
  return !!(w.webkit?.messageHandlers || w.Android || w.FreetifulAndroid || w.ReactNativeWebView || /; wv\)/i.test(ua));
}

function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  } catch {
    return false;
  }
}

/** 세로 화면 판정 — 폰·태블릿 세로, 좁고 긴 창(PC 넓은 창은 제외) */
function isPortraitNow(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (h <= w) return false;
  return isTouchDevice() || w < 1024;
}

type FsDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

/**
 * 가로 고정 시도 — 전체 화면 + orientation.lock (지원할 때만, 실패는 조용히). 버튼 누른 그 자리에서 불러야 한다.
 * 프리티풀 앱 웹뷰에선 하지 않는다: 회전은 앱이 맡고(iOS Info.plist 가로 허용 · 안드 화면 고정 없음),
 * 안드 앱 WebChromeClient 는 onShowCustomView 가 없어 문서 전체 화면 요청이 어떻게 보일지 보장이 없다.
 */
function tryLandscape() {
  if (!isTouchDevice() || isAppWebView()) return;
  const doc = document as FsDoc;
  const el = document.documentElement as FsEl;
  const lock = () => {
    try {
      const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      if (o && typeof o.lock === 'function') o.lock('landscape').catch(() => undefined);
    } catch {
      /* 지원 안 함 */
    }
  };
  try {
    if (!(doc.fullscreenElement || doc.webkitFullscreenElement)) {
      if (typeof el.requestFullscreen === 'function') {
        el.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions).then(lock, () => undefined);
        return;
      }
      if (typeof el.webkitRequestFullscreen === 'function') {
        void el.webkitRequestFullscreen();
      }
    }
  } catch {
    /* 지원 안 함(iOS 사파리·대부분 웹뷰) */
  }
  lock();
}

function exitFullscreen() {
  const doc = document as FsDoc;
  try {
    if (doc.fullscreenElement && typeof doc.exitFullscreen === 'function') void doc.exitFullscreen().catch(() => undefined);
    else if (doc.webkitFullscreenElement && typeof doc.webkitExitFullscreen === 'function') void doc.webkitExitFullscreen();
  } catch {
    /* 무시 */
  }
}

/** 화면 그림 미리 받기(진입 화면·버튼·패널) — 종료 화면 버튼이 뜰 때 비어 보이지 않게.
 *  Image 객체를 모듈에 붙잡아 둔다(버리면 받는 도중 취소되거나 메모리 캐시에서 빠져 나중에 <img> 가 다시 받음). */
const keepImgs: HTMLImageElement[] = [];
function preloadUi() {
  preloadPanel();
  if (keepImgs.length) return;
  const srcs = [WR_ENTRY.src, ...Object.entries(WR_UI).filter(([, v]) => !v.refOnly).map(([, v]) => v.src), ...WR_CHAR.map((c) => c.frames.run_02.src), WR_CHAR[4].frames.celebrate.src];
  srcs.forEach((s) => {
    const i = new Image();
    i.decoding = 'async';
    i.src = s;
    keepImgs.push(i);
    if (typeof i.decode === 'function') i.decode().catch(() => undefined);
  });
}

/** 컨트롤이 땅(발판 앞면) 칸 안에 앉도록 엔진 배치값을 CSS 로 넘긴다 */
const ROOT_VARS = { '--view-h': VIEW_H, '--view-w': VIEW_MIN_W, '--ground': GROUND_FROM_BOTTOM } as CSSProperties;

export default function WeddingRunScreen({
  challenge: verified,
  linkChallenge,
}: {
  /** 서버가 검증한 기록(?c=) */
  challenge: Challenge | null;
  /** 링크에 적힌 목표(?t=&n=) — 검증 안 됨 */
  linkChallenge: { t: string; n: string | null } | null;
}) {
  const challenge = useMemo<Challenge | null>(() => verified ?? (linkChallenge ? parseLinkChallenge(linkChallenge.t, linkChallenge.n) : null), [verified, linkChallenge]);
  const router = useRouter();
  const stageRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<WRGame | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  const [phase, setPhase] = useState<Phase>('entry');
  const phaseRef = useRef<Phase>('entry');
  phaseRef.current = phase;
  const startedOnce = useRef(false);

  // 기기 기록(처음엔 0 — 하이드레이션 뒤 저장값으로)
  const [best, setBest] = useState(0);
  const [firstClear, setFirstClear] = useState(false);
  const [maxProgress, setMaxProgress] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const [nickname, setNick] = useState('');

  // 플레이 중 값
  const liveRef = useRef<LiveState>({ score: 0, toHome: 0, segment: 0, stage: 0, lap: 1 });
  const bestAtStartRef = useRef(0);
  const everArrivedAtStart = useRef(false);
  const lapsDoneRef = useRef(0);
  const [segment, setSegment] = useState(0);
  /** 지금 몇 번째 여정(엔진 score.lap, 1부터) — HUD '다음 여정 N' */
  const [lap, setLap] = useState(1);
  const arriveAtRef = useRef(0);
  const [shieldOn, setShieldOn] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [big, setBig] = useState<Big | null>(null);
  const [mapTitle, setMapTitle] = useState<MapTitle | null>(null);
  /** 2단 점프로 머리가 구간 알약 밑을 지날 때 알약 흐리게 */
  const [hudDim, setHudDim] = useState(false);
  const [pulse, setPulse] = useState<'jump' | 'slide' | null>(null);
  const [pausedScore, setPausedScore] = useState(0);
  /** 엔진 재개 때마다 +1 → Controls 가 아직 누르고 있는 슬라이드를 다시 알림 */
  const [resyncKey, setResyncKey] = useState(0);

  // 종료
  const [resultView, setResultView] = useState<ResultView | null>(null);
  const [showResult, setShowResult] = useState(false);
  const showResultRef = useRef(false);
  showResultRef.current = showResult;
  const [submit, setSubmit] = useState<SubmitOutcome | null>(null);
  const [boardKey, setBoardKey] = useState(0);
  const runIdRef = useRef(0);

  // 팝업
  const [rankingOpen, setRankingOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [nickOpen, setNickOpen] = useState(false);
  const [copyText, setCopyText] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  // 화면
  const [portrait, setPortrait] = useState(false);
  const [canLock, setCanLock] = useState(false);
  const [showKeys, setShowKeys] = useState(false);

  const challengeScore = challenge ? challenge.score : null;

  // ── 처음: 저장값·문서 잠금 ──
  useEffect(() => {
    setBest(getBest());
    setFirstClear(!!getFirstClearAt());
    setMaxProgress(getMaxProgress());
    setSoundOn(getSoundOn());
    setNick(currentNickname());
    setShowKeys(!isTouchDevice());
    preloadUi();
    document.documentElement.classList.add('wr-lock');
    return () => document.documentElement.classList.remove('wr-lock');
  }, []);

  // ── 토스트 ──
  const showToast = useCallback((text: string) => {
    const id = Date.now();
    setToast({ id, text });
    setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), 2200);
  }, []);

  // ── 이벤트 문구(짧게) ──
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bannerNow = useRef<{ id: number; text: string } | null>(null);
  const showBanner = useCallback((text: string, tone: BannerTone, ms: number) => {
    if (!text) return;
    // 같은 문구가 이어 오면(예: 단계 'stage' + 이벤트 'bouquet' 가 같은 '부케 장착!') 다시 튀지 않고 시간만 늘린다
    const cur = bannerNow.current;
    const id = cur && cur.text === text ? cur.id : Date.now() + Math.random();
    bannerNow.current = { id, text };
    if (!cur || cur.text !== text) setBanner({ id, text, tone });
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => {
      setBanner((b) => (b && b.id === id ? { ...b, out: true } : b));
      if (bannerNow.current?.id === id) bannerNow.current = null;
      bannerTimer.current = setTimeout(() => setBanner((b) => (b && b.id === id ? null : b)), 300);
    }, ms);
  }, []);
  const bigTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showBig = useCallback((text: string, sub: string | undefined, ms: number) => {
    const id = Date.now() + Math.random();
    setBig({ id, text, sub });
    if (bigTimer.current) clearTimeout(bigTimer.current);
    bigTimer.current = setTimeout(() => {
      setBig((b) => (b && b.id === id ? { ...b, out: true } : b));
      bigTimer.current = setTimeout(() => setBig((b) => (b && b.id === id ? null : b)), 350);
    }, ms);
  }, []);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showMapTitle = useCallback((t: { no: string; name: string; line: string }) => {
    const id = Date.now() + Math.random();
    setMapTitle({ id, no: t.no, name: t.name, line: t.line });
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => {
      setMapTitle((m) => (m && m.id === id ? { ...m, out: true } : m));
      titleTimer.current = setTimeout(() => setMapTitle((m) => (m && m.id === id ? null : m)), MAP_TITLE_OUT_MS);
    }, MAP_TITLE_HOLD_MS);
  }, []);

  const clearPlayFx = useCallback(() => {
    bannerNow.current = null;
    setBanner(null);
    setBig(null);
    setPulse(null);
    setMapTitle(null);
    setHudDim(false);
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    if (bigTimer.current) clearTimeout(bigTimer.current);
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
    if (titleTimer.current) clearTimeout(titleTimer.current);
  }, []);

  // ── 엔진 이벤트 ──
  const onEventRef = useRef<(e: WREvent) => void>(() => undefined);
  onEventRef.current = (e: WREvent) => {
    switch (e.type) {
      case 'loading':
        setProgress(Math.max(0, Math.min(1, Number(e.progress) || 0)));
        break;
      case 'ready':
        setProgress(1);
        setReady(true);
        void prepareSession();
        break;
      case 'score': {
        const l = liveRef.current;
        l.score = e.score;
        l.toHome = e.toHome;
        l.stage = e.stage;
        if (e.lap !== l.lap) setLap(Math.max(1, Math.floor(e.lap) || 1));
        l.lap = e.lap;
        if (e.segment !== l.segment) {
          l.segment = e.segment;
          setSegment(clampSegment(e.segment));
        }
        break;
      }
      case 'stage':
        showBanner(e.text || STAGE_INFO[Math.max(0, Math.min(4, e.stage))]?.toast || '', 'stage', 2200);
        break;
      case 'segment': {
        const idx = clampSegment(e.index);
        liveRef.current.segment = idx;
        setSegment(idx);
        setMaxProgress(saveMaxProgress(lapsDoneRef.current, idx));
        break;
      }
      case 'maptitle':
        showMapTitle({ no: String(e.no || ''), name: String(e.name || ''), line: String(e.line || '') });
        break;
      case 'hud':
        setHudDim(!!e.dim);
        break;
      case 'event':
        // 도착 순간의 'arrive' 문구는 type 'arrive'(아래)가 큰 문구로 — 도착 직전 '신혼집이 보여요!' 는 짧은 문구로
        if (e.kind === 'arrive' && Date.now() - arriveAtRef.current < 1500) break;
        if (e.kind === 'next-journey') {
          // (261011 사장 맵 제목) 2바퀴~ 서울 제목은 따로 띄우지 않고 이 큰 문구 아랫줄로 합침(같은 자리에서 겹치지 않게)
          showBig(e.text || '우리의 다음 여정 시작!', '01 · 서울 · 속도 UP', 2400);
          break;
        }
        if (e.kind === 'tutorial') {
          showBanner(e.text, 'tutorial', 2600);
          const k = /슬라이드|↓/.test(e.text) ? 'slide' : /점프|↑|Space/i.test(e.text) ? 'jump' : null;
          setPulse(k);
          if (pulseTimer.current) clearTimeout(pulseTimer.current);
          pulseTimer.current = setTimeout(() => setPulse(null), 2600);
          break;
        }
        showBanner(e.text, 'event', 1700);
        break;
      case 'shield':
        setShieldOn(!!e.on);
        break;
      case 'arrive': {
        // 완주 보상 연출 동안 점수·완주 기록을 확실히 저장(연출 중 앱을 닫아도 남게)
        arriveAtRef.current = Date.now();
        lapsDoneRef.current += 1;
        markFirstClear();
        setFirstClear(true);
        setBest(saveBest(liveRef.current.score));
        setMaxProgress(saveMaxProgress(lapsDoneRef.current, 0));
        showBig('우리 신혼집 입주 완료!', lapsDoneRef.current > 1 ? `신혼집 ${lapsDoneRef.current}번째 입주` : '첫 완주 기록 저장 완료', 2600);
        break;
      }
      case 'autopause':
        if (phaseRef.current === 'playing' || phaseRef.current === 'countdown') {
          setPausedScore(liveRef.current.score);
          setPhase('paused');
        }
        break;
      case 'gameover':
        handleGameOver(e.result);
        break;
      default:
        break;
    }
  };

  const handleGameOver = (r: Extract<WREvent, { type: 'gameover' }>['result']) => {
    if (phaseRef.current === 'over') return;
    const runId = ++runIdRef.current;
    clearPlayFx();
    setShieldOn(false);
    const prevBest = bestAtStartRef.current;
    const newBest = saveBest(r.score);
    setBest(newBest);
    if (r.arrived || r.laps > 0) {
      markFirstClear();
      setFirstClear(true);
    }
    setMaxProgress(saveMaxProgress(r.laps, r.segment));
    setResultView({ result: r, prevBest, best: newBest, everArrived: everArrivedAtStart.current });
    setSubmit(null);
    setPhase('over');
    setShowResult(false);
    // 넘어지는 모습을 잠깐 보여 주고 결과
    setTimeout(() => {
      if (runIdRef.current === runId) setShowResult(true);
    }, 750);
    submitRun(r).then((out) => {
      if (runIdRef.current !== runId) return;
      setSubmit(out);
      if (out.status === 'ok') {
        invalidateBoards();
        setBoardKey((k) => k + 1);
        if (out.res.nickname) setNick(out.res.nickname);
        // 정한 닉네임을 서버가 받지 않았으면(같은 이름·금칙어·잠금) 알려 준다 — 기록은 지금 이름으로 올라감(261011 통합)
        if (out.res.nicknameRejected) showToast(`닉네임을 바꾸지 못했어요: ${out.res.nicknameRejected}`);
      }
    });
  };

  // ── 엔진 만들기 ──
  useEffect(() => {
    let alive = true;
    let game: WRGame | null = null;
    // 새 엔진 = 새 판부터(다시 불러오기·개발 중 핫 리로드)
    startedOnce.current = false;
    if (phaseRef.current !== 'entry') setPhase('entry');
    setFailed(false);
    setReady(false);
    setProgress(null);
    const parent = stageRef.current;
    if (!parent) return;
    loadEngine()
      // 다시 불러오기(loadKey) 뒤엔 옛 엔진이 늦게 보내는 알림(로딩 진행 등)을 무시
      .then((create) => create(parent, { onEvent: (e) => alive && onEventRef.current(e) }))
      .then((g) => {
        if (!alive) {
          g.destroy();
          return;
        }
        game = g;
        gameRef.current = g;
        try {
          g.setSound(getSoundOn());
        } catch {
          /* 무시 */
        }
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
      gameRef.current = null;
      try {
        game?.destroy();
      } catch {
        /* 무시 */
      }
    };
  }, [loadKey]);

  // ── 판 시작/다시 ──
  const resetRunUi = useCallback(() => {
    liveRef.current = { score: 0, toHome: 0, segment: 0, stage: 0, lap: 1 };
    lapsDoneRef.current = 0;
    setLap(1);
    setSegment(0);
    setShieldOn(false);
    clearPlayFx();
    setResultView(null);
    setShowResult(false);
    setSubmit(null);
    bestAtStartRef.current = getBest();
    everArrivedAtStart.current = !!getFirstClearAt();
    runIdRef.current++;
  }, [clearPlayFx]);

  const blurActive = () => {
    try {
      (document.activeElement as HTMLElement | null)?.blur?.();
    } catch {
      /* 무시 */
    }
  };

  const startGame = useCallback(() => {
    const g = gameRef.current;
    if (!g || !ready) return;
    tryLandscape();
    resetRunUi();
    beginRun();
    try {
      g.setSound(getSoundOn());
      if (startedOnce.current) g.restart();
      else g.start();
    } catch {
      /* 엔진 오류 — 아래 상태는 그대로 */
    }
    startedOnce.current = true;
    setRankingOpen(false);
    setHelpOpen(false);
    setConfirmOpen(false);
    setPhase('playing');
    blurActive();
  }, [ready, resetRunUi]);

  const pauseGame = useCallback(() => {
    if (phaseRef.current !== 'playing') return;
    try {
      gameRef.current?.pause();
    } catch {
      /* 무시 */
    }
    setPausedScore(liveRef.current.score);
    setPhase('paused');
  }, []);

  const requestResume = useCallback(() => {
    if (phaseRef.current !== 'paused') return;
    setConfirmOpen(false);
    setPhase('countdown');
    blurActive();
  }, []);

  const finishCountdown = useCallback(() => {
    if (phaseRef.current !== 'countdown') return;
    try {
      gameRef.current?.resume();
    } catch {
      /* 무시 */
    }
    setPhase('playing');
    setResyncKey((k) => k + 1);
  }, []);

  const retryFromPause = useCallback(() => {
    abandonRun();
    startGame();
  }, [startGame]);

  const toggleSound = useCallback(() => {
    setSoundOn((on) => {
      const next = !on;
      saveSoundOn(next);
      try {
        gameRef.current?.setSound(next);
      } catch {
        /* 무시 */
      }
      return next;
    });
  }, []);

  // '살아 있음' 시각(261018) — 안드 앱이 회전으로 화면을 새로 만들어 홈을 열면 WeddingRunRescue 가 이 시각을 보고 되돌려 보낸다.
  // 화면을 정상으로 떠날 때(나가기 단추 · 다른 화면으로 이동)는 지운다
  useEffect(() => {
    const mark = () => { try { localStorage.setItem(WR_ALIVE_KEY, String(Date.now())); } catch { /* 저장소 막힘 */ } };
    mark();
    const t = window.setInterval(mark, 1000);
    return () => {
      window.clearInterval(t);
      try { localStorage.removeItem(WR_ALIVE_KEY); } catch { /* 저장소 막힘 */ }
    };
  }, []);

  const goHome = useCallback(() => {
    try { localStorage.removeItem(WR_ALIVE_KEY); } catch { /* 저장소 막힘 */ }
    abandonRun();
    exitFullscreen();
    if (isAppWebView() && window.history.length > 1) {
      window.history.back();
      return;
    }
    router.push('/main');
  }, [router]);

  const onHomePressed = useCallback(() => {
    // 진행 중(일시정지 포함)이면 확인부터
    if (phaseRef.current === 'paused' || phaseRef.current === 'playing' || phaseRef.current === 'countdown') {
      if (phaseRef.current === 'playing') pauseGame();
      setConfirmOpen(true);
      return;
    }
    goHome();
  }, [goHome, pauseGame]);

  const onInput = useCallback((kind: 'jump' | 'slide', down: boolean) => {
    try {
      gameRef.current?.setInput(kind, down);
    } catch {
      /* 무시 */
    }
  }, []);

  // ── 공유 ──
  const onShare = useCallback(async () => {
    if (!resultView) return;
    const r = resultView.result;
    const p = buildShare({
      score: r.score,
      stage: r.stage,
      segment: r.segment,
      arrived: r.arrived,
      laps: r.laps,
      prevBest: resultView.prevBest,
      nickname: currentNickname(),
      // 보류된 판은 공유 링크(?c=)로 열 수 없다(숨김) — 그땐 링크 목표(?t=)로
      scoreId: submit?.status === 'ok' && !submit.res.held ? submit.res.id : null,
    });
    const res = await shareRecord(p);
    if (res === 'copied') showToast('기록과 링크를 복사했어요. 친구에게 붙여 넣어 보내 보세요!');
    else if (res === 'cancelled') showToast('공유를 취소했어요');
    else if (res === 'failed') setCopyText(`${p.text}\n${p.url}`);
  }, [resultView, submit, showToast]);

  // ── 키보드(Esc: 일시정지·재개·팝업 닫기, Enter: 진입 화면 시작) ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault();
        if (nickOpen) return setNickOpen(false);
        if (copyText != null) return setCopyText(null);
        if (confirmOpen) return setConfirmOpen(false);
        if (helpOpen) return setHelpOpen(false);
        if (rankingOpen) return setRankingOpen(false);
        const ph = phaseRef.current;
        if (ph === 'playing') pauseGame();
        else if (ph === 'paused') requestResume();
        else if (ph === 'countdown') setPhase('paused');
        return;
      }
      // Enter = 진입 화면 '게임 시작' / 종료 화면 '다시 도전'(버튼·입력칸에 포커스가 있으면 그 버튼 몫)
      if (e.key === 'Enter' && !rankingOpen && !helpOpen && !nickOpen && copyText == null && !confirmOpen) {
        const t = e.target as HTMLElement | null;
        if (t && typeof t.closest === 'function' && t.closest('button, a, input, textarea')) return;
        if (phaseRef.current === 'entry' || (phaseRef.current === 'over' && showResultRef.current)) {
          e.preventDefault();
          startGame();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nickOpen, copyText, confirmOpen, helpOpen, rankingOpen, pauseGame, requestResume, startGame]);

  // ── 세로 화면 = 회전 안내 + 일시정지(게임 상태는 그대로) ──
  useEffect(() => {
    const check = () => {
      const p = isPortraitNow();
      setPortrait(p);
      if (p && (phaseRef.current === 'playing' || phaseRef.current === 'countdown')) {
        try {
          gameRef.current?.pause();
        } catch {
          /* 무시 */
        }
        setPausedScore(liveRef.current.score);
        setPhase('paused');
      }
    };
    check();
    try {
      const o = screen.orientation as (ScreenOrientation & { lock?: unknown }) | undefined;
      setCanLock(isTouchDevice() && !isAppWebView() && !!o && typeof o.lock === 'function' && !!document.fullscreenEnabled);
    } catch {
      setCanLock(false);
    }
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  // 백그라운드 안전망(엔진 autopause 와 별개로 — 이미 멈췄으면 그대로)
  //  · 탭 전환(visibilitychange)·창 포커스 잃음(blur)·페이지 떠남(pagehide) 모두. 3·2·1 도중이면 엔진은 이미 멈춰 있어 autopause 를 안 보내므로
  //    화면이 직접 일시정지로 되돌린다(261011 검증 low: 카운트다운 중 blur 면 다 센 뒤 혼자 재개됐다)
  useEffect(() => {
    const away = () => {
      if (phaseRef.current === 'playing') pauseGame();
      else if (phaseRef.current === 'countdown') setPhase('paused');
    };
    const onVis = () => {
      if (document.visibilityState === 'hidden') away();
    };
    const onPageHide = () => {
      away();
      // 안 쓴 미리 받은 세션은 서버에서 닫는다(같은 IP 열린 판 상한에서 빠지게)
      releasePreparedSession();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      // 뒤로 가기 캐시에서 돌아옴 — 다음 판 세션 다시 미리
      if (e.persisted) void prepareSession();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', away);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', away);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [pauseGame]);

  const playing = phase === 'playing' || phase === 'paused' || phase === 'countdown';

  const rankingProps = useMemo(
    () => ({ best, firstClear, maxProgress, nickname, refreshKey: boardKey }),
    [best, firstClear, maxProgress, nickname, boardKey],
  );

  return (
    <div className={`wr-root${mapTitle && !mapTitle.out ? ' has-maptitle' : ''}${hudDim ? ' is-hud-dim' : ''}`} data-phase={phase} style={ROOT_VARS}>
      <div ref={stageRef} className="wr-stage" aria-label="웨딩런 게임 화면" />

      <div className="wr-layer">
        {(playing || (phase === 'over' && !showResult)) && (
          <>
            <Hud liveRef={liveRef} bestRef={bestAtStartRef} challengeScore={challengeScore} segment={segment} lap={lap} shieldOn={shieldOn} onPause={pauseGame} />
            {phase !== 'over' && <Controls onInput={onInput} pulse={pulse} showKeys={showKeys} resyncKey={resyncKey} />}
            {mapTitle && phase !== 'over' && (
              <div key={mapTitle.id} className={`wr-maptitle${mapTitle.out ? ' is-out' : ''}`} aria-live="polite">
                <b>
                  {mapTitle.no} · {mapTitle.name}
                </b>
                <small>{mapTitle.line}</small>
              </div>
            )}
            {banner && (
              <div className="wr-banner" aria-live="polite">
                <span className={`wr-banner-pill is-${banner.tone}${banner.out ? ' is-out' : ''}`}>{banner.text}</span>
              </div>
            )}
            {big && (
              <div className={`wr-big${big.out ? ' is-out' : ''}`} aria-live="polite">
                <b>{big.text}</b>
                {big.sub && <small>{big.sub}</small>}
              </div>
            )}
          </>
        )}

        {phase === 'entry' && (
          <Entry
            ready={ready}
            progress={progress}
            failed={failed}
            best={best}
            firstClear={firstClear}
            maxProgress={maxProgress}
            soundOn={soundOn}
            challenge={challenge}
            onStart={startGame}
            onRanking={() => setRankingOpen(true)}
            onSound={toggleSound}
            onHome={goHome}
            onHelp={() => setHelpOpen(true)}
            onRetryLoad={() => setLoadKey((k) => k + 1)}
          />
        )}

        {phase === 'paused' && !confirmOpen && (
          <PauseModal score={pausedScore} segment={segment} soundOn={soundOn} onResume={requestResume} onRetry={retryFromPause} onHome={onHomePressed} onSound={toggleSound} />
        )}
        {phase === 'countdown' && <Countdown onDone={finishCountdown} />}

        {phase === 'over' && showResult && resultView && !rankingOpen && (
          <ResultModal view={resultView} submit={submit} challenge={challenge} onRetry={startGame} onShare={onShare} onRanking={() => setRankingOpen(true)} onHome={goHome} />
        )}

        {confirmOpen && <ConfirmHomeModal onCancel={() => setConfirmOpen(false)} onLeave={goHome} />}
        {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
        {rankingOpen && !nickOpen && <RankingModal {...rankingProps} onClose={() => setRankingOpen(false)} onNickname={() => setNickOpen(true)} />}
        {nickOpen && (
          <NicknameModal
            current={nickname}
            onClose={() => setNickOpen(false)}
            onSave={(n) => {
              const r = setNickname(n);
              if (r.ok) {
                setNick(r.nickname);
                setNickOpen(false);
                showToast('닉네임을 바꿨어요. 다음 기록부터 랭킹에 보여요');
              }
            }}
          />
        )}
        {copyText != null && <CopyFallbackModal text={copyText} onClose={() => setCopyText(null)} />}
        {toast && (
          <div key={toast.id} className="wr-toast" role="status">
            {toast.text}
          </div>
        )}
      </div>

      <RotateNotice on={portrait} canLock={canLock} onLock={tryLandscape} />
    </div>
  );
}
