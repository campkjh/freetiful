'use client';

// 퀴즈 문제 등장 연출(261122 사장 '슈슈몽드 웨딩홀 사진 … 처음 나올 때 사진이 엄청 크게 3초 정도 전체화면으로 … 아래에 살짝 딤드 그라데이션
// 그리고 이 웨딩홀은 어디일까요? 하고 3초 뒤에 이미지가 작아지면서 문제화면으로 그리고 각각 페이지별로 인터렉션 추가해줘').
//  · 사진 문제 = 사진이 화면 가득(살짝 다가오는 줌) + 아래 은은한 딤(사장이 콕 집은 유일한 그라데이션) + 문제 글
//    → 3초 뒤 카드의 그림 자리로 작아지며 날아가 앉는다(FLIP — 자리를 재서 그 크기 · 위치로).
//  · 짝 맞추기(그림 4장) = 4장 격자 → 3초 뒤 칸마다 자기 자리로 날아간다.
//  · 글 문제(주관식 · OX · 객관식 · 미션) = 남색 단색 판에 'ROUND n · n번 문제(스페셜 미션) · 점수' + 문제가 떠오름 → 2초 뒤 카드 머리로 줄어들며 겹쳐 사라짐.
//  · 아무 데나 누르면 바로 끝(짧게 사라짐). 동작 줄이기면 움직임 없이 보여 주다 짧게 사라진다. 정답은 절대 안 그린다(문제 · 그림만).
//  · 손님 화면(rc-qzi-*, reception.css)과 어드민 '크게 보기'(rcsi-*, quiz-stage-intro.css)가 같은 엔진 — 겉모양만 접두어로 나눈다.
//  · 언제 트나: 손님 = 문제가 열린 지 20초 안 + 이 기기 세션에서 처음(문제 · 연 시각마다 한 번, 중간에 탭을 열면 안 튼다).
//    크게 보기 = 판을 띄운 채 문제가 열리면(또는 연 지 15초 안에 판을 띄우면) 한 번.
// 착지 뒤 카드가 할 일(그림 숨김 → 머리 · 답 칸 차례로 등장)은 부르는 쪽 카드에 단계 class(hold → land → in)로 알린다.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { RECEPTION_EVENT_KEY } from '@/lib/reception/event';
import { quizNoLabel, quizRoundChip } from '@/lib/reception/quiz';

/** 연출에 쓰는 문제 칸(손님 QuizQuestionPublic · 어드민 QuizQuestionAdmin 공통 — 정답 칸은 받지 않는다) */
export interface IntroQuestion {
  id: string;
  round: number;
  roundTitle: string;
  no: number;
  kind: string;
  points: number;
  prompt: string;
  image?: string;
  slots?: string[];
  slotImages?: string[];
  /** 오프닝 주관식 — 'OPENING · 주관식', 점수 줄 없음 */
  open?: boolean;
}

/** 카드 쪽 단계 — hold: 판이 덮는 중(카드 속 숨김) · land: 날아가 앉는 중 · in: 끝(답 칸 차례 등장) */
export type IntroStage = 'hold' | 'land' | 'in';

/** 날아가 앉을 자리 — 부르는 쪽이 지금 화면의 요소를 찾아 준다 */
export interface IntroTargets {
  /** 사진이 앉을 img(object-fit: contain 이면 실제 그림 칸을 계산한다) */
  photo?: HTMLElement | null;
  /** 글 판이 줄어들어 겹칠 머리(문제 글) */
  head?: HTMLElement | null;
  /** 짝 맞추기 그림 칸들(순서 = slotImages 순서) */
  slots?: HTMLElement[];
  /** 대상이 화면 밖이면 이 상자 위쪽이 보이게 스크롤(손님 화면만) */
  scrollBox?: HTMLElement | null;
}

type IntroKind = 'photo' | 'match' | 'text';
const introKind = (q: IntroQuestion): IntroKind => (q.image ? 'photo' : q.kind === 'match' && q.slotImages?.length ? 'match' : 'text');

/** 판을 덮고 있는 시간 — 사진 · 그림 3초(사장 '3초 정도'), 글 2.2초 */
const HOLD_MS: Record<IntroKind, number> = { photo: 3000, match: 3000, text: 2200 };
/** 날아가 앉는 시간 — css transition 과 같게 */
const LAND_MS = 760;
/** 누르거나 동작 줄이기면 짧게 사라짐 */
const OUT_MS = 220;
/** 자리를 못 찾으면 작아지며 사라짐 */
const SHRINK_MS = 440;
/** 무엇이 꼬여도 카드를 가리는 건 이 시간까지(답 내기를 절대 막지 않게) */
const FAILSAFE_MS = 6000;
/** 손님 — 서버가 연 지 이 안이어야 튼다 */
const GUEST_RECENT_MS = 20_000;
/** 크게 보기 — 판을 늦게 띄워도 이 안이면 튼다 */
const STAGE_RECENT_MS = 15_000;

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

const prefersReducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/** 서버가 연 시각이 최근인가 — 못 읽거나 미래(기기 시계가 느림)면 최근으로 본다 */
export function openedRecently(openedAt: string | null | undefined, windowMs: number, now = Date.now()) {
  const t = openedAt ? Date.parse(openedAt) : NaN;
  if (Number.isNaN(t)) return true;
  const ago = now - t;
  return ago < 0 || ago <= windowMs;
}

/* ─── 한 번만 — 손님은 탭 세션(sessionStorage, 못 쓰면 메모리), 크게 보기는 메모리 ─── */
const GUEST_STORE = `freetiful-reception-${RECEPTION_EVENT_KEY}-quiz-intro`;
const playedGuest = new Set<string>();
const playedStage = new Set<string>();

/** 처음 보는 열림이면 표시하고 true — 같은 열림은 다시 false */
function claimGuest(key: string): boolean {
  if (playedGuest.has(key)) return false;
  playedGuest.add(key);
  let list: string[] = [];
  try {
    const v = JSON.parse(sessionStorage.getItem(GUEST_STORE) || '[]');
    if (Array.isArray(v)) list = v.filter((x): x is string => typeof x === 'string');
  } catch {}
  if (list.includes(key)) return false;
  try {
    sessionStorage.setItem(GUEST_STORE, JSON.stringify([...list, key].slice(-40)));
  } catch {}
  return true;
}

/**
 * 등장 연출을 틀지 정하고 단계를 들고 있는다. key = `${문제 id}@${연 시각}`(열림 하나), 열린 문제가 아니면 null.
 * overlay = 판을 그릴지, stage = 카드에 붙일 단계 class.
 */
export function useQuizIntro(key: string | null, openedAt: string | null, mode: 'guest' | 'stage') {
  const [s, setS] = useState<{ key: string; stage: IntroStage; overlay: boolean } | null>(null);
  const sRef = useRef(s);
  sRef.current = s;
  const openedRef = useRef(openedAt);
  openedRef.current = openedAt;
  const firstKey = useRef<string | null | undefined>(undefined);

  // layout effect — 카드가 숨김 없이 한 번 비치고 판이 뜨는 깜빡임을 막는다
  useIsoLayoutEffect(() => {
    if (firstKey.current === undefined) firstKey.current = key;
    if (!key) {
      // 열림이 끝나거나(마감 · 공개) 판이 잠깐 다른 화면(순위 발표)으로 바뀌면 덮던 판도 끝으로 — 같은 열림으로 돌아왔을 때
      // 판이 처음부터 다시 돌다 안전핀(6초)에 뚝 끊기지 않게(크게 보기 단추 줄이 연출 위라 중간에 누를 수 있다)
      if (sRef.current?.overlay) setS((c) => (c && c.overlay ? { ...c, stage: 'in', overlay: false } : c));
      return;
    }
    if (sRef.current?.key === key) return;
    let play: boolean;
    if (mode === 'guest') {
      play = claimGuest(key) && openedRecently(openedRef.current, GUEST_RECENT_MS);
    } else {
      // 판을 띄운 채 바뀐 열림은 시계와 상관없이 튼다 · 판을 띄울 때 이미 열려 있던 문제는 막 열렸을 때만
      play = !playedStage.has(key) && (key !== firstKey.current || openedRecently(openedRef.current, STAGE_RECENT_MS));
      playedStage.add(key);
    }
    if (play) setS({ key, stage: 'hold', overlay: true });
  }, [key, mode]);

  // 안전핀 — 판이 어떤 이유로 끝을 못 알려도 카드는 반드시 돌아온다
  useEffect(() => {
    if (!s?.overlay) return;
    const k = s.key;
    const t = window.setTimeout(() => {
      setS((c) => (c && c.key === k && c.overlay ? { ...c, stage: 'in', overlay: false } : c));
    }, FAILSAFE_MS);
    return () => window.clearTimeout(t);
  }, [s?.key, s?.overlay]);

  const onStage = useCallback((stage: IntroStage) => setS((c) => (c ? { ...c, stage } : c)), []);
  const onDone = useCallback(() => setS((c) => (c ? { ...c, stage: 'in', overlay: false } : c)), []);

  const active = s && s.key === key ? s : null;
  return { key: active?.key ?? null, stage: active?.stage ?? null, overlay: !!active?.overlay, onStage, onDone };
}

/* ─── 그림 미리 받기 — 문제 목록이 오자마자(사진이 판에 바로 뜨게) ─── */
const preloaded = new Set<string>();
const keepAlive: HTMLImageElement[] = [];

export function useQuizImagePreload(questions: ReadonlyArray<{ image?: string; slotImages?: string[] }> | undefined) {
  const sig = (questions ?? []).flatMap((q) => [q.image, ...(q.slotImages ?? [])]).filter(Boolean).join('|');
  useEffect(() => {
    if (!sig) return;
    for (const src of sig.split('|')) {
      if (preloaded.has(src)) continue;
      preloaded.add(src);
      try {
        const img = new Image();
        img.decoding = 'async';
        img.src = src;
        img.decode?.().catch(() => {});
        keepAlive.push(img);
      } catch {}
    }
  }, [sig]);
}

/* ─── 자리 재기 ─── */
type Box = { left: number; top: number; width: number; height: number };

/** img 의 실제 그림 칸(object-fit: contain 의 여백 뺀 곳) — 크기를 못 재면 null */
function contentBox(el: HTMLElement): Box | null {
  const r = el.getBoundingClientRect();
  if (r.width < 8 || r.height < 8) return null;
  if (el instanceof HTMLImageElement && el.naturalWidth > 0 && el.naturalHeight > 0) {
    const fit = getComputedStyle(el).objectFit;
    if (fit === 'contain' || fit === 'scale-down') {
      const k = Math.min(r.width / el.naturalWidth, r.height / el.naturalHeight);
      const w = el.naturalWidth * k;
      const h = el.naturalHeight * k;
      return { left: r.left + (r.width - w) / 2, top: r.top + (r.height - h) / 2, width: w, height: h };
    }
  }
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/** 모서리 둥글기 — 자기 것이 없으면(withParent) 감싼 칸의 것(손님 카드 그림은 figure 가 둥글다) */
function radiusOf(el: HTMLElement, withParent: boolean) {
  const own = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
  if (own || !withParent || !el.parentElement) return own;
  return parseFloat(getComputedStyle(el.parentElement).borderTopLeftRadius) || 0;
}

/** 대상이 화면 밖이면(아래로 내려 읽던 중) 카드 위쪽이 보이게 바로 옮긴다 — 판이 덮고 있어 손님 눈엔 안 보인다 */
function ensureVisible(t: IntroTargets): boolean {
  const main = t.photo || t.slots?.[0] || t.head;
  const box = t.scrollBox;
  if (!main || !box) return false;
  const r = main.getBoundingClientRect();
  if (r.top >= 56 && r.bottom <= window.innerHeight - 96) return false;
  const b = box.getBoundingClientRect();
  // html 은 scroll-behavior: smooth — 판이 걷히기 전에 끝나야 하니 instant
  window.scrollTo({ top: Math.max(0, window.scrollY + b.top - 72), behavior: 'instant' as ScrollBehavior });
  return true;
}

type Props = {
  q: IntroQuestion;
  /** class 접두어 — 손님 'rc-qzi' · 크게 보기 'rcsi' */
  prefix: string;
  /** 판 맨 바깥에 더 붙일 class(손님은 'rc-theme' — body 포털이라 색 · 글꼴 변수를 다시 깐다) */
  rootClassName?: string;
  /** body 로 띄우기(손님 — 떠 있는 탭 위) */
  portal?: boolean;
  /** 대상이 화면 밖이면 스크롤(손님만) */
  scroll?: boolean;
  targets: () => IntroTargets;
  onStage: (stage: IntroStage) => void;
  onDone: () => void;
};

/** 등장 판 — key 를 열림마다 바꿔 붙인다(한 판 = 한 번). 끝나면 onDone → 부르는 쪽이 뗀다 */
export function QuizIntro({ q, prefix: p, rootClassName, portal, scroll, targets, onStage, onDone }: Props) {
  const kind = useRef(introKind(q)).current;
  const [phase, setPhase] = useState<'hold' | 'land' | 'out' | 'shrink'>('hold');
  const [go, setGo] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef<Array<HTMLDivElement | null>>([]);
  const cb = useRef({ targets, onStage, onDone });
  cb.current = { targets, onStage, onDone };
  const timers = useRef<number[]>([]);
  const ended = useRef(false);

  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  const clearTimers = () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; };

  /** 짧게 사라지며 끝(누름 · 동작 줄이기 · 자리 못 찾음) — 카드는 바로 돌아온다 */
  const finish = (cls: 'out' | 'shrink', ms: number) => {
    setPhase(cls);
    cb.current.onStage('in');
    later(() => cb.current.onDone(), ms);
  };

  /** 사진 — 판 전체였던 틀을 그림 칸 크기 · 위치로(top/left/width/height 를 px 로 고정한 뒤 옮긴다) */
  const flyPhoto = (t: IntroTargets) => {
    const frame = frameRef.current;
    const to = t.photo ? contentBox(t.photo) : null;
    if (!frame || !t.photo || !to) return false;
    const from = frame.getBoundingClientRect();
    const fs = frame.style;
    fs.transition = 'none';
    fs.top = `${from.top}px`;
    fs.left = `${from.left}px`;
    fs.width = `${from.width}px`;
    fs.height = `${from.height}px`;
    void frame.offsetWidth; // 시작 자리를 먼저 확정 — 안 하면 transition 이 안 걸린다
    fs.transition = '';
    fs.top = `${to.top}px`;
    fs.left = `${to.left}px`;
    fs.width = `${to.width}px`;
    fs.height = `${to.height}px`;
    fs.borderRadius = `${radiusOf(t.photo, true)}px`;
    return true;
  };

  /** 짝 맞추기 — 정사각 칸 → 정사각 칸이라 같은 비율로 줄여 옮긴다(transform) */
  const flyTiles = (t: IntroTargets) => {
    const slots = t.slots ?? [];
    let any = false;
    tileRefs.current.forEach((tile, i) => {
      if (!tile) return;
      const target = slots[i];
      const b = target?.getBoundingClientRect();
      const a = tile.getBoundingClientRect();
      if (!target || !b || b.width < 4 || a.width < 4) {
        tile.style.opacity = '0';
        return;
      }
      const k = b.width / a.width;
      tile.style.transformOrigin = '0 0';
      tile.style.transform = `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${k})`;
      const inner = tile.firstElementChild as HTMLElement | null;
      if (inner) inner.style.borderRadius = `${radiusOf(target, false) / k}px`;
      any = true;
    });
    return any;
  };

  /** 글 판 — 카드 머리 가운데로 줄어들며 옮겨 가고, 가는 동안 흐려진다(카드 머리가 그 자리에서 떠오름) */
  const flyBlock = (t: IntroTargets) => {
    const block = blockRef.current;
    if (!block || !t.head) return false;
    const a = block.getBoundingClientRect();
    const b = t.head.getBoundingClientRect();
    if (a.width < 4 || b.width < 4) return false;
    const k = Math.max(0.3, Math.min(1, b.width / a.width));
    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    block.style.transform = `translate(${dx}px, ${dy}px) scale(${k})`;
    block.style.opacity = '0';
    return true;
  };

  const land = () => {
    if (ended.current) return;
    ended.current = true;
    if (prefersReducedMotion()) return finish('out', OUT_MS);
    try {
      const t = cb.current.targets();
      if (scroll) ensureVisible(t); // 같은 요소 — 옮긴 뒤 재면 새 자리
      const ok = kind === 'photo' ? flyPhoto(t) : kind === 'match' ? flyTiles(t) : flyBlock(t);
      if (!ok) return finish('shrink', SHRINK_MS);
      setPhase('land');
      cb.current.onStage('land');
      later(() => cb.current.onDone(), LAND_MS + 40);
    } catch {
      finish('out', OUT_MS);
    }
  };

  const skip = () => {
    if (ended.current) return;
    ended.current = true;
    clearTimers();
    finish('out', OUT_MS);
  };

  useEffect(() => {
    // 한 프레임 뒤 'go' — 사진이 천천히 다가오는 줌(transition)이 시작 크기에서 출발하게
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => { raf2 = window.requestAnimationFrame(() => setGo(true)); });
    later(land, HOLD_MS[kind]);
    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
      clearTimers();
    };
    // 한 판 = 한 번(열림마다 key 를 바꿔 새로 붙는다)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roundLabel = quizRoundChip(q);
  const noLabel = quizNoLabel(q);
  // 오프닝 주관식은 라운드 제목 없이 'OPENING · 주관식'
  const metaText = (withNo: boolean) => (q.open ? (withNo ? noLabel : '') : `${q.roundTitle}${withNo ? ` · ${noLabel}` : ''}`);
  const eyebrow = (withNo: boolean) => (
    <p className={`${p}-eyebrow`}>
      <span className={`${p}-round`}>{roundLabel}</span>
      {metaText(withNo) && <span className={`${p}-meta`}>{metaText(withNo)}</span>}
    </p>
  );

  const node = (
    <div
      className={`${rootClassName ?? ''} ${p} ${p}--${kind} ${q.kind === 'mission' ? 'mission' : ''} ${go ? 'go' : ''} ${phase === 'hold' ? '' : phase}`}
      onClick={skip}
      aria-hidden="true"
    >
      <div className={`${p}-bg`} />
      {kind === 'photo' && (
        <>
          <div ref={frameRef} className={`${p}-frame`}>
            <img className={`${p}-photo`} src={q.image} alt="" draggable={false} />
          </div>
          <div className={`${p}-dim`} />
          <div className={`${p}-cap`}>
            {eyebrow(true)}
            <p className={`${p}-prompt`}>{q.prompt}</p>
          </div>
        </>
      )}
      {kind === 'match' && (
        <div className={`${p}-center`}>
          {eyebrow(true)}
          <div className={`${p}-tiles`}>
            {(q.slotImages ?? []).map((src, i) => (
              <div key={src + i} ref={(el) => { tileRefs.current[i] = el; }} className={`${p}-tile`}>
                <div className={`${p}-tile-in`} style={{ '--i': i } as CSSProperties}>
                  <img src={src} alt="" draggable={false} />
                  {q.slots?.[i] && <span>{q.slots[i]}</span>}
                </div>
              </div>
            ))}
          </div>
          <p className={`${p}-prompt`}>{q.prompt}</p>
        </div>
      )}
      {kind === 'text' && (
        <div className={`${p}-center`}>
          <div ref={blockRef} className={`${p}-block`}>
            {eyebrow(false)}
            <i className={`${p}-line`} />
            <p className={`${p}-no`}>{q.kind === 'mission' ? 'SPECIAL MISSION' : noLabel}</p>
            {!q.open && <p className={`${p}-points`}>{q.points.toLocaleString('ko-KR')}점</p>}
            <p className={`${p}-prompt`}>{q.prompt}</p>
          </div>
        </div>
      )}
    </div>
  );

  if (portal) return typeof document === 'undefined' ? null : createPortal(node, document.body);
  return node;
}
