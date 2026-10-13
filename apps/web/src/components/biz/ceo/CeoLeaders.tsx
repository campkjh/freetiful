'use client';

/* eslint-disable @next/next/no-img-element -- public 정적 프로필(같은 3:4 틀로 맞춘 webp) */
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { useBizLang, useT } from '@/lib/biz/i18n';
import { FadeUp } from '@/components/biz/biz-motion';
import { holdBizTabBar, prefersReducedMotion, scrollToY } from '../scroll-to';
import CeoSilk from './CeoSilk';
import { LEADERS, LEADERS_HEAD, type Leader, titleCode } from './content';
import { flag, put, useIsoLayoutEffect } from './motion';

/*
 * ④ 이사진 소개 9명(261012 사장 '이거 이사진 부분에 이런느낌으로 해줘라 배경을 일렁이는 고급스러운 3d배경 느낌으로' — 참고 화면은 모양만 따른다).
 * 바탕 = 천천히 일렁이는 유리 · 비단 띠(CeoSilk, WebGL 한 장 · 없으면 CSS 그라데이션). 섹션이 화면 몇 장 높이가 돼도 비단은 화면 한 장으로 따라 붙는다(sticky).
 * 데스크톱(≥1024): 왼쪽 제목 칸(LEADERSHIP · 이사진 소개 · 한 줄 · 단추 두 개 + 01 / 09), 오른쪽 = 카드 줄.
 * 모바일 · 태블릿: 제목 → 카드 줄(화면 끝까지) → 01 / 09 + 단추.
 *
 * 261012 사장 2차 '카드가 살짝 반투명하게 · 스크롤을 내리면 우측에서 카드가 좌측으로 흐를 수 있게 · 좌측이 딱 짤리는 느낌인데 그라데이션으로
 *   자연스럽게 사라지게 · CEO 이런 거 대표이사(CEO) 이런 느낌으로 · 01 이런 것도 엄청 옅게 · 카드 r값 5'
 * ■ 흐르는 판(움직임 줄이기 아님 · 무대가 들어가는 높이 — FLOW_MQ): 섹션 = 무대 높이 + 흐를 거리, 무대는 머리줄 아래에 붙고(sticky)
 *   세로 1px 내릴 때 카드 줄이 왼쪽으로 1px(261009 판의 '세로 스크롤 → 가로 흐름'을 되살림). 01 / 09 · 막대가 따라오고
 *   단추 · 화살표 키 = 그 카드 자리까지 페이지를 굴린다(Lenis). 끌기(마우스 · 손가락 가로)와 트랙패드 가로 밀기도 같은 페이지 스크롤로 바꿔 준다 —
 *   카드 줄만 따로 가로로 굴러가는 두 번째 방법은 없다.
 *   폰 · 태블릿도 같은 판 — 판정은 주소창이 나와 있을 때 높이(svh)로 한다(주소창이 접힌 채 새로 고쳐도 같은 기기는 같은 판, 261012 검토).
 *   사파리 · 크롬 실제 창(390×664 · 393×659 · 360×668 …)에서 머리줄 + 제목 + 카드 + 01/09 가 하단 탭바 위에 들어가고, 카드는 무대 높이에 맞춰 줄인다(최소 CW_MIN).
 *   무대가 모자라는 화면(가로로 눕힌 폰 · iPhone SE · mini 사파리 · 아주 낮은 창)과 움직임 줄이기는 예전 넘기는 판(scroll-snap 가로 줄 + 단추 · 끌기 · 키보드).
 *   터치폰은 폭이 바뀔 때(돌리기)만 다시 고른다.
 * ■ 왼쪽 사라짐: 카드가 제목 칸 쪽으로 가면 카드마다 제 위치에서 잰 가로 그라데이션 마스크로 녹는다(제목 칸 글자 · 단추 오른쪽 끝 + 28px 에서 0,
 *   띠 폭 84px 이상 — 모자라면 카드 줄을 그만큼 오른쪽에서 시작). 띠에 닿기 전 18px 동안 그림자를 스크롤 따라 거둔다(마스크가 그림자를 '툭' 자르지 않게).
 *   조상에 마스크를 걸면 그 칸이 backdrop 뿌리가 돼 유리 흐림이 꺼진다 — 그래서 카드(.cx-lc-in) 자신에게 건다. 넘기는 판도 같은 띠.
 * ■ 카드 색은 파랑 · 어두운 유리 · 흰 유리(content.ts tone) — 셋 다 뒤 비단이 살짝 비친다. 회색 배경 사진은 가장자리를 녹여 유리 위에 앉힌다.
 */

const pad2 = (x: number) => String(x).padStart(2, '0');
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * 흐르는 판 — 움직임 줄이기 아님 + 무대(머리줄 아래 화면)에 제목 · 카드 · 01/09 가 들어가는 높이(svh).
 * 데스크톱 2단(≥1024)은 560, 1단(폰 · 태블릿)은 640(그다음은 재서 카드가 CW_MIN 보다 작아야 들어가면 넘기는 판) — styles.ts data-pre 미리 높이와 같은 값.
 */
const MOTION_MQ = '(prefers-reduced-motion: no-preference)';
const WIDE_MQ = '(min-width: 1024px)';
const FLOW_H_WIDE = 560;
const FLOW_H_ONE = 640;
/** 왼쪽 사라지는 띠 최소 폭(데스크톱) — 제목 글자 오른쪽 끝과 첫 카드 사이가 모자라면 카드 줄을 그만큼 오른쪽에서 시작한다 */
const FADE_MIN = 84;
/** 띠 바로 앞 그림자 거두는 칸(데스크톱) — 마스크가 테두리 밖 그림자를 자르는 브라우저(mask-clip:no-clip 모름)에서 '툭' 사라지지 않게 그 전에 스크롤 따라 옅게.
 *  그림자 0 28px 44px -28px 은 옆으로 16px 남짓 — 18 이면 된다(261012 검토: 32 → 18, 줄인 만큼 TEXT_GAP 을 늘려 첫 카드 자리는 그대로) */
const NEAR = 18;
/** 띠 시작 = 제목 칸 글자 · 단추 · 01/09 오른쪽 끝 + 이만큼(녹는 카드의 투명한 끝이 '09' 에 붙어 보이던 것, 261012 검토: 14 → 28) */
const TEXT_GAP = 28;
/**
 * 무대에 맞춰 줄일 때 카드 최소 폭 — 이보다 작아야 들어가는 1단 화면은 넘기는 판으로(알약 '最高マーケティング責任者(CMO)' 가 한 줄에 드는 폭).
 * 1단 판 가르기는 사실상 FLOW_H_ONE(svh 640 — 그때 카드 ≈ 214)이 하고, 이건 제목이 두 줄로 넘어가는 언어 · 글꼴 같은 예외용 안전망.
 * 실제 창 높이: iPhone 12~16 사파리 659~664 → 카드 226~229, 갤럭시 크롬 360×668 → 232, mini 사파리 ≈ 630 · SE 548 → 넘기는 판(경계와 20px 남짓 떨어져 있다)
 */
const CW_MIN = 210;
/** 1단 무대에서 카드 위아래 숨 쉴 틈(머리줄 ↔ 제목, 01/09 ↔ 탭바 자리 각 12) */
const ONE_SLACK = 24;

/**
 * lefts = 카드 자연 왼쪽 끝(무대 기준) · 띠 x0(0) → x1(1) · s = 첫 카드 자리(그림자가 다 있는 곳) · travel = 흐를 거리 · stops = 카드 k 자리의 흐른 거리
 * pos = 지난 프레임의 흐른 거리(흐르는 판)
 */
type Geo = { ok: boolean; lefts: number[]; cw: number; step: number; x0: number; x1: number; s: number; travel: number; stops: number[]; lastStop: number; stick: number; pos: number };
type Drag = { id: number; x: number; y: number; left: number; moved: boolean; lx: number; lt: number; v: number };

/** 주소창이 나와 있을 때 높이(svh) — 주소창이 들어가고 나와도 같은 값(svh 를 모르는 브라우저는 vh) */
function svhOf() {
  try {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:0;top:0;width:0;height:100vh;height:100svh;visibility:hidden;pointer-events:none';
    document.body.appendChild(el);
    const h = el.offsetHeight;
    el.remove();
    return h || window.innerHeight;
  } catch {
    return window.innerHeight;
  }
}

/**
 * 흐르는 판을 쓸지 — 서버 · 첫 그림은 넘기는 판(스크립트가 없어도 넘길 수 있다), 고르기 전(pending)은 styles.ts data-pre 가 섹션 높이를 대략 미리 잡는다.
 * 판정은 붙는 순간(layout effect, 첫 그림 전) — 높이 기준은 svh 라 터치폰은 주소창 상태와 상관없이 같은 판.
 * veto = 재 보니 무대가 모자란 화면(카드가 CW_MIN 밑으로 줄어야 들어감) — 그때 창 크기를 기억해 두고, 폭이 바뀌거나 높이가 늘 때만 다시 재 본다
 * (데스크톱 창을 끌어 줄이는 동안 resize 마다 흐르는 판 → 재기 → 넘기는 판으로 두 번 그리던 것, 261012 검토). 데스크톱 resize 는 120ms 모아서.
 */
function useFlow(): [boolean, boolean, () => void] {
  const [on, setOn] = useState<boolean | null>(null);
  const vetoAt = useRef<{ w: number; h: number } | null>(null);
  const vetoFn = useRef<() => void>(() => {});
  useIsoLayoutEffect(() => {
    let motion: MediaQueryList;
    let wide: MediaQueryList;
    try {
      motion = window.matchMedia(MOTION_MQ);
      wide = window.matchMedia(WIDE_MQ);
    } catch {
      setOn(false);
      return undefined;
    }
    let coarse = false;
    try { coarse = window.matchMedia('(pointer: coarse)').matches; } catch { /* 없음 */ }
    let w = window.innerWidth;
    let tm = 0;
    const apply = () => {
      w = window.innerWidth;
      const h = svhOf();
      const v = vetoAt.current;
      if (v && (w !== v.w || h > v.h + 1)) vetoAt.current = null;
      setOn(!vetoAt.current && motion.matches && h >= (wide.matches ? FLOW_H_WIDE : FLOW_H_ONE));
    };
    vetoFn.current = () => {
      vetoAt.current = { w: window.innerWidth, h: svhOf() };
      setOn(false);
    };
    // 터치폰은 폭이 그대로면(주소창 · 키보드) 판을 바꾸지 않는다
    const onResize = () => {
      if (coarse && Math.abs(window.innerWidth - w) < 2) return;
      window.clearTimeout(tm);
      if (coarse) apply();
      else tm = window.setTimeout(apply, 120);
    };
    apply();
    motion.addEventListener?.('change', apply);
    wide.addEventListener?.('change', onResize);
    window.addEventListener('resize', onResize);
    return () => {
      window.clearTimeout(tm);
      motion.removeEventListener?.('change', apply);
      wide.removeEventListener?.('change', onResize);
      window.removeEventListener('resize', onResize);
    };
  }, []);
  return [on === true, on === null, () => vetoFn.current()];
}

function LeaderCard({ p, i, t, on }: { p: Leader; i: number; t: ReturnType<typeof useT>; on: boolean }) {
  return (
    <li className="cx-lc" data-tone={p.tone} data-cut={p.cut ? '' : undefined} data-cur={on ? '' : undefined} style={{ '--i': i } as CSSProperties}>
      <figure className="cx-lc-in">
        <img src={p.image} alt="" loading="lazy" decoding="async" draggable={false} onLoad={(e) => e.currentTarget.setAttribute('data-ld', '')} />
        {/* 알약 = 직함(코드) — 카드 아래는 이름만(같은 직함을 두 번 쓰지 않는다) */}
        <span className="cx-lc-no" aria-hidden>{pad2(i + 1)}</span>
        <figcaption className="cx-lc-cap">
          <span className="cx-lc-n">{t(p.name)}</span>
          {/* 이름 아래 '코드 직함'(261013 — 알약 대신) */}
          <span className="cx-lc-r">{titleCode(p.badge) && <b className="cx-lc-code">{titleCode(p.badge)}</b>}{t(p.role)}</span>
        </figcaption>
      </figure>
    </li>
  );
}

/** 카드 한 칸 = 카드 폭 + 사이 간격 */
const stepOf = (track: HTMLElement) => {
  const a = track.children[0] as HTMLElement | undefined;
  const b = track.children[1] as HTMLElement | undefined;
  if (!a) return 1;
  return Math.max(1, b ? b.offsetLeft - a.offsetLeft : a.offsetWidth);
};

/** 가로로 갈 수 있는 끝 */
const maxOf = (track: HTMLElement) => Math.max(0, track.scrollWidth - track.clientWidth);
/** 카드 k 의 자리(첫 카드 기준) — 카드마다 offsetLeft 로 재서 칸 폭 반올림이 쌓이지 않는다 */
const offOf = (track: HTMLElement, k: number) => {
  const a = track.children[0] as HTMLElement | undefined;
  const b = track.children[k] as HTMLElement | undefined;
  return a && b ? b.offsetLeft - a.offsetLeft : 0;
};
/** 칸 k 의 스크롤 자리 — 끝을 넘는 칸은 끝으로 모인다 */
const leftOf = (track: HTMLElement, k: number) => Math.min(offOf(track, k), maxOf(track));
/** 붙을 수 있는 마지막 칸 = 자리가 끝에 닿는 첫 칸(태블릿 · 데스크톱은 그 뒤 카드들의 자리가 모두 끝으로 모인다) */
const lastStopOf = (track: HTMLElement, n: number) => {
  const m = maxOf(track) - 2;
  for (let k = 0; k < n; k++) if (offOf(track, k) >= m) return k;
  return n - 1;
};
/** 흐른 거리 pos 에서 가장 가까운 칸(흐르는 판 — 끝 구간 칸들은 고르게 나눈 자리) */
const nearStop = (stops: number[], pos: number) => {
  let k = 0;
  for (let i = 1; i < stops.length; i++) if (Math.abs(stops[i] - pos) < Math.abs(stops[k] - pos)) k = i;
  return k;
};
const atEnd = (track: HTMLElement) => { const m = maxOf(track); return m > 0 && track.scrollLeft >= m - 2; };
/** 끝 빈 칸(넘기는 판) — 끝에서 다 보이는 카드 수만큼 남기고(최소 1장, 오른쪽 여백 48 이상) 끝 자리 = 카드 경계 */
const fitTail = (track: HTMLElement) => {
  const a = track.children[0] as HTMLElement | undefined;
  if (!a) return;
  const cs = getComputedStyle(track);
  const gap = parseFloat(cs.columnGap) || 0;
  const room = track.clientWidth - (parseFloat(cs.paddingLeft) || 0);
  const step = a.getBoundingClientRect().width + gap; // 폭은 등장 transform(가로 이동)과 무관
  if (!(step > 0) || !(room > 0)) return;
  const k = Math.max(1, Math.floor((room + gap - 48) / step));
  track.style.setProperty('--tail', `${Math.max(0, room - k * step).toFixed(2)}px`);
};

/**
 * 왼쪽 사라지는 띠 — 카드 왼쪽 끝 L(무대 기준)이 x1 보다 왼쪽이면 카드 자신에게 가로 마스크(x0 에서 0 → x1 에서 1, 부드러운 계단 근사).
 * 마스크 그림 판은 카드보다 사방 MASK_PAD 크게(styles.ts mask-size · mask-position · no-clip) — 그래서 멈춤 값에 MASK_PAD 를 더한다.
 * s(첫 카드 자리) → x1 사이에서는 그림자를 스크롤 따라 옅게(--sh), x0 를 다 넘어간 카드는 숨긴다(visibility).
 * 거둘 칸이 없는 1단(s = x1)은 그림자를 그대로 두고 마스크가 같이 녹인다 — 예전엔 0.5px 만 움직여도 0 이 되고 멈춤 자리에서만 켜졌다(261012 검토).
 */
/** styles.ts .cx-lc-in mask-position(-64px) 와 같은 값 */
const MASK_PAD = 64;

function fadeCards(cards: HTMLElement[], ins: HTMLElement[], lefts: number[], cw: number, x0: number, x1: number, s: number) {
  for (let i = 0; i < cards.length; i++) {
    const L = lefts[i];
    const el = ins[i];
    const gone = L + cw <= x0 + 1; // 흐를 거리 반올림(≤0.5px)으로 남는 1px 미만 조각까지 숨긴다
    const fade = !gone && L < x1 - 0.5;
    flag(cards[i], 'data-gone', gone);
    const sh = s > x1 ? clamp01((L - x1) / (s - x1)) : 1;
    put(el, '--sh', sh >= 1 ? '' : sh.toFixed(3));
    let m = '';
    if (fade) {
      const a = x0 - L;
      const d = Math.max(1, x1 - x0);
      const at = (f: number) => `${(MASK_PAD + a + d * f).toFixed(1)}px`;
      m = `linear-gradient(90deg,transparent ${at(0)},rgba(0,0,0,.1) ${at(0.2)},rgba(0,0,0,.42) ${at(0.45)},rgba(0,0,0,.8) ${at(0.72)},#000 ${at(1)})`;
    }
    put(el, '-webkit-mask-image', m);
    put(el, 'mask-image', m);
  }
}

export default function CeoLeaders() {
  const t = useT();
  const { lang } = useBizLang();
  const [flow, pending, vetoFlow] = useFlow();
  const flowRef = useRef(flow);
  flowRef.current = flow;
  const secRef = useRef<HTMLElement>(null);
  const runRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const geo = useRef<Geo>({ ok: false, lefts: [], cw: 1, step: 1, x0: 0, x1: 0, s: 0, travel: 0, stops: [], lastStop: 0, stick: 0, pos: 0 });
  const relayout = useRef<() => void>(() => {});
  const target = useRef<number | null>(null); // 단추로 가는 중인 칸(연달아 누르면 이어서)
  const lastD = useRef(Infinity); // 가는 중 남은 거리 — 늘어나면(사용자가 반대로 굴림) 목표를 버린다
  const at = useRef(0); // 지금 붙어 있는 칸(끝에서는 번호 09 와 다르다)
  const drag = useRef<Drag | null>(null);
  const settle = useRef(0);
  const [cur, setCur] = useState(0); // 보이는 번호(끝에 닿으면 마지막)
  const [said, setSaid] = useState(0); // 읽기 프로그램 알림 — 지나가는 카드마다 읽지 않게 멈춘 뒤 한 번
  const navAt = useRef(-1e9); // 단추 · 키보드 · 끌기로 옮긴 때 — 흐르는 판은 그냥 페이지를 지나가며 번호가 바뀔 때는 알리지 않는다
  const n = LEADERS.length;
  const clampI = (i: number) => Math.max(0, Math.min(n - 1, i));

  // 화면에 들어오면 카드가 오른쪽에서 차례로(한 번) — 붙은 뒤에만 숨겨 두므로 스크립트가 없어도 보인다
  useEffect(() => {
    const sec = secRef.current;
    if (!sec) return undefined;
    if (prefersReducedMotion()) return undefined;
    sec.setAttribute('data-arm', '');
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        sec.setAttribute('data-in', '');
        io.disconnect();
      }
    }, { threshold: 0.18 });
    io.observe(stageRef.current || sec);
    return () => io.disconnect();
  }, []);

  /*
   * 사진 — 줄 안의 lazy 는 카드가 실제로 넘어와야 받기 시작해 넘기면 빈 카드가 잠깐 보였다(개발 서버 1초 남짓).
   * 섹션이 가까워지면(아래 800px) 9장 모두 받는다(장당 20~45KB). 붙기 전에 이미 받아진 사진은 load 를 놓치므로 여기서 표시.
   */
  useEffect(() => {
    const sec = secRef.current;
    const track = trackRef.current;
    if (!sec || !track) return undefined;
    const imgs = Array.from(track.querySelectorAll('img'));
    imgs.forEach((im) => { if (im.complete && im.naturalWidth) im.setAttribute('data-ld', ''); });
    sec.setAttribute('data-js', ''); // 받는 중인 사진은 투명했다가 서서히(스크립트가 없으면 그냥 보인다)
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      imgs.forEach((im) => { im.loading = 'eager'; });
      io.disconnect();
    }, { rootMargin: '800px 0px' });
    io.observe(sec);
    return () => io.disconnect();
  }, []);

  /*
   * 자리 재기 · 프레임 — 두 판이 같은 틀을 쓴다.
   *  흐르는 판: 무대 높이에 맞춰 카드 폭(--cw) → 띠 · 첫 카드 자리(--ext · --lead) → 흐를 거리 → 섹션 높이. 페이지 스크롤마다 카드 줄 transform.
   *  넘기는 판: 띠 · 첫 카드 자리 · 끝 빈 칸(--tail). 카드 줄 가로 스크롤마다.
   */
  useIsoLayoutEffect(() => {
    const sec = secRef.current;
    const run = runRef.current;
    const stage = stageRef.current;
    const rail = railRef.current;
    const track = trackRef.current;
    const inner = stage?.querySelector<HTMLElement>('.cx-ld-in');
    const head = stage?.querySelector<HTMLElement>('.cx-ld-head');
    const nav = stage?.querySelector<HTMLElement>('.cx-ld-nav');
    if (!sec || !run || !stage || !rail || !track || !inner || !head || !nav) return undefined;
    const cards = Array.from(track.children) as HTMLElement[];
    const ins = cards.map((c) => c.firstElementChild as HTMLElement);
    const g = geo.current;
    let wideMq: MediaQueryList | null = null;
    try { wideMq = window.matchMedia(WIDE_MQ); } catch { /* 없음 */ }
    let q = 0;
    let rq = 0;
    let alive = true; // 글꼴 대기처럼 늦게 오는 콜백이 판이 바뀐 뒤 옛 판 계산으로 자리를 덮어쓰지 않게

    /** 제목 칸 글자 · 단추 · 번호의 오른쪽 끝(화면 기준) — 글자는 줄 상자가 아니라 실제 글자 폭(Range) */
    const textRight = () => {
      let r = 0;
      head.querySelectorAll('p, h2').forEach((el) => {
        const rg = document.createRange();
        rg.selectNodeContents(el);
        const b = rg.getBoundingClientRect();
        if (b.width) r = Math.max(r, b.right);
      });
      nav.querySelectorAll('.cx-ld-count, .cx-ld-btns').forEach((el) => { r = Math.max(r, el.getBoundingClientRect().right); });
      return r;
    };

    const frame = () => {
      q = 0;
      if (!g.ok) return;
      let pos: number;
      let end: boolean;
      let prog: number;
      if (flow) {
        const p = g.travel > 0 ? clamp01((g.stick - run.getBoundingClientRect().top) / g.travel) : 0;
        pos = p * g.travel;
        end = g.travel > 0 && pos >= g.travel - 1;
        prog = p;
        g.pos = pos;
        put(track, 'transform', `translate3d(${(-pos).toFixed(1)}px,0,0)`);
      } else {
        pos = track.scrollLeft;
        end = atEnd(track);
        const m = maxOf(track);
        prog = m > 0 ? Math.min(1, pos / m) : 0;
      }
      fadeCards(cards, ins, g.lefts.map((l) => l - pos), g.cw, g.x0, g.x1, g.s);
      if (flow) {
        // 흐르는 판 — 가장 가까운 칸(끝 구간은 layout 에서 고르게 나눠 둬서 07 · 08 도 차례로 나온다, 끝 = 09)
        const k = nearStop(g.stops, pos);
        at.current = k;
        setCur(k);
      } else {
        const k = clampI(Math.round(pos / g.step));
        at.current = end ? lastStopOf(track, n) : k;
        setCur(end ? n - 1 : k);
      }
      // 막대 = 끝까지의 진행(01 에서 1/9 부터)
      put(barRef.current, 'transform', `scaleX(${((1 + (n - 1) * prog) / n).toFixed(4)})`);
      if (target.current !== null) {
        const goal = flow ? g.stops[target.current] ?? 0 : leftOf(track, target.current);
        const d = Math.abs(pos - goal);
        if (d < 2 || d > lastD.current + 1) target.current = null;
        lastD.current = d;
      }
    };
    const onScroll = () => { if (!q) q = requestAnimationFrame(frame); };

    const layout = () => {
      rq = 0;
      const wide = !!wideMq?.matches;
      sec.style.removeProperty('--cw');
      track.style.removeProperty('--ext');
      track.style.removeProperty('--lead');
      if (flow) put(track, 'transform', 'translate3d(0px,0,0)');
      // 1) 흐르는 판 — 카드가 무대 높이에 들어가게(1단은 제목 · 01/09 · 탭바 자리를 빼고)
      if (flow) {
        const cs = getComputedStyle(stage);
        const room = stage.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0);
        const cardH = ins[0].offsetHeight;
        const other = wide ? 0 : inner.offsetHeight - cardH;
        const fit = Math.floor(((room - other - (wide ? 80 : ONE_SLACK)) * 7) / 10);
        if (!wide && fit < CW_MIN) {
          g.ok = false;
          vetoFlow(); // 1단인데 무대가 모자란다 — 넘기는 판으로(이 효과는 정리되고 다시 돈다)
          return;
        }
        if (fit < cards[0].offsetWidth) sec.style.setProperty('--cw', `${Math.max(CW_MIN, fit)}px`);
      }
      // 2) 사라지는 띠(x0 → x1)와 첫 카드 자리 — 데스크톱은 제목 칸 글자 오른쪽에서 녹고, 1단은 화면 왼쪽 끝(여백 폭만큼)
      const sl = stage.getBoundingClientRect().left;
      let x0 = track.getBoundingClientRect().left - sl;
      let near = 0;
      if (wide) {
        const railL = rail.getBoundingClientRect().left - sl;
        const lead0 = parseFloat(getComputedStyle(track).paddingLeft) || 0;
        x0 = textRight() - sl + TEXT_GAP;
        near = NEAR;
        const startX = Math.max(railL + lead0, x0 + FADE_MIN + NEAR);
        const ext = Math.max(0, railL - x0); // 카드 줄 왼쪽 끝(넘기는 판은 여기서 잘린다)을 띠 시작보다 왼쪽으로
        track.style.setProperty('--ext', `${ext.toFixed(1)}px`);
        track.style.setProperty('--lead', `${(startX - (railL - ext)).toFixed(1)}px`);
      }
      // 3) 카드 자연 자리(transform · 가로 스크롤 0 기준)
      const tl = track.getBoundingClientRect().left - sl;
      const lefts = cards.map((c) => tl + c.offsetLeft);
      const cw = cards[0].offsetWidth;
      g.lefts = lefts;
      g.cw = cw;
      g.step = lefts.length > 1 ? lefts[1] - lefts[0] : cw;
      // 1단 — 띠 시작은 멈춘 앞 카드의 오른쪽 끝(첫 자리 - 사이 간격)보다 왼쪽이면 안 된다: 그러면 띠 안에 조각이 남는다(261012 검토 — 폰 10px · 태블릿 20px).
      // 지금 CSS 는 폰 사이 = 여백(24)이라 0 그대로, 태블릿(여백 40 · 사이 32)은 8
      if (!wide) x0 = Math.max(x0, lefts[0] - (g.step - cw));
      g.x0 = x0;
      g.s = lefts[0];
      g.x1 = lefts[0] - near;
      if (flow) {
        // 4) 흐를 거리 — 끝 화면 = 첫 카드 자리부터 오른쪽 여백(48) 안에 다 들어가는 카드 k 장(폰은 1장 = 마지막 카드가 첫 자리).
        //    그러면 오른쪽이 카드 반 장 넘게 비는 화면(1280 등)은 마지막 카드 오른쪽 끝을 오른쪽 여백(제목 칸 왼쪽 여백과 같은 폭)에 맞춘다.
        //    섹션 높이 = 무대 높이 + 흐를 거리(세로 1px = 가로 1px)
        const W = stage.clientWidth;
        const gap = g.step - cw;
        const rm = wide ? Math.max(48, (W - 1140) / 2) : lefts[0] - tl;
        const lastL = lefts[n - 1];
        const k = Math.max(1, Math.min(n, Math.floor((W - Math.min(48, rm) - lefts[0] + gap) / g.step)));
        const spare = W - (lefts[0] + k * g.step - gap);
        // 1단은 늘 '마지막 k 장이 첫 자리부터' — 오른쪽 맞춤은 데스크톱만(폰 카드를 무대에 맞춰 줄이면 393 폭에서 오른쪽 맞춤으로 넘어가 끝 화면 왼쪽에 앞 카드가 95px 남았다)
        const travel = Math.max(0, Math.round(!wide || spare <= rm + cw / 2 ? lefts[n - k] - lefts[0] : lastL + cw - (W - rm)));
        g.travel = travel;
        const stops = lefts.map((l) => Math.min(l - lefts[0], travel));
        // 끝 구간 — 끝 화면에 카드가 여러 장(1280 이상은 3장)이면 그 카드들 자리가 모두 끝(travel)으로 모여 번호 · 단추가 06 → 09 로 건너뛰었다(261012 검토).
        // 끝에 닿는 첫 칸 ls 부터 마지막 카드까지를 '그 앞 칸 → 끝' 사이에 고르게 나눈다(1440: 1353 · 1443 · 1533 · 1623) — 단추 한 번에 약 90px, 번호 07 · 08 · 09 차례로
        let ls = n - 1;
        for (let i = 0; i < n; i++) if (stops[i] >= travel - 1) { ls = i; break; }
        if (ls > 0 && ls < n - 1) {
          const base = stops[ls - 1];
          for (let i = ls; i < n; i++) stops[i] = base + ((travel - base) * (i - ls + 1)) / (n - ls);
        }
        g.stops = stops;
        g.lastStop = n - 1;
        g.stick = parseFloat(getComputedStyle(stage).top) || 0;
        run.style.height = `${Math.round(stage.offsetHeight + travel)}px`;
      } else {
        fitTail(track);
      }
      g.ok = true;
      frame();
    };
    const onResize = () => { if (!rq) rq = requestAnimationFrame(layout); };
    relayout.current = layout;

    /* 트랙패드 가로 밀기 · Shift+휠 → 페이지 스크롤(흐르는 판). 브라우저 뒤로 가기 밀기도 막힌다 */
    const runRange = (from: number) => {
      const s = run.getBoundingClientRect().top + window.scrollY - g.stick;
      return [Math.min(from, s), Math.max(from, s + g.travel)] as const;
    };
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || !g.ok) return;
      e.preventDefault();
      target.current = null;
      const l = window.__bizLenis;
      const from = l ? l.targetScroll : window.scrollY;
      const [lo, hi] = runRange(window.scrollY);
      const y = Math.max(lo, Math.min(hi, from + (e.deltaMode === 1 ? e.deltaX * 16 : e.deltaX)));
      if (l) l.scrollTo(y, { programmatic: false });
      else window.scrollTo(0, y);
    };

    /*
     * 무대가 옆으로 밀리면(찾기 Ctrl+F · 읽기 프로그램 · 텍스트 조각 링크가 화면 밖 카드로 scrollIntoView) — 밀린 만큼 페이지를 굴려 카드 줄을 흐르게 하고
     * 무대는 0 으로 되돌린다. 브라우저가 보여 주려던 자리와 같은 곳에 카드가 온다(흐른 거리 + 밀린 폭). 예전엔 무대가 밀린 채 남아 제목 칸이 화면 밖에 나갔다(261012 검토)
     */
    const onStageScroll = () => {
      const dx = stage.scrollLeft;
      if (!dx && !stage.scrollTop) return;
      stage.scrollLeft = 0;
      stage.scrollTop = 0;
      if (!g.ok || !dx) return;
      // 브라우저는 지금 그려진 자리(지난 프레임 g.pos 의 transform)를 보고 dx 를 정했다 — 같은 스크롤에서 세로로 굴린 몫(찾기의 가운데 맞춤)은 무대가 붙어 있어 뜻이 없다
      const y = Math.round(run.getBoundingClientRect().top + window.scrollY - g.stick + Math.max(0, Math.min(g.travel, g.pos + dx)));
      target.current = null;
      const l = window.__bizLenis;
      if (l) l.scrollTo(y, { immediate: true, force: true });
      else window.scrollTo({ top: y, behavior: 'instant' });
      cancelAnimationFrame(q);
      frame();
    };

    layout();
    document.fonts?.ready.then(() => { if (alive && g.ok) layout(); }).catch(() => {});
    window.addEventListener('resize', onResize);
    if (flow) {
      window.addEventListener('scroll', onScroll, { passive: true });
      stage.addEventListener('wheel', onWheel, { passive: false });
      stage.addEventListener('scroll', onStageScroll, { passive: true });
    } else {
      track.addEventListener('scroll', onScroll, { passive: true });
    }
    return () => {
      alive = false;
      cancelAnimationFrame(q);
      cancelAnimationFrame(rq);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
      stage.removeEventListener('wheel', onWheel);
      stage.removeEventListener('scroll', onStageScroll);
      track.removeEventListener('scroll', onScroll);
      relayout.current = () => {};
      g.ok = false;
      // 판이 바뀔 때만 불린다(언어는 아래 relayout) — 섹션 높이를 거두면 페이지 길이가 바뀐다
      run.style.height = '';
      put(track, 'transform', '');
      track.style.removeProperty('--ext');
      track.style.removeProperty('--lead');
      sec.style.removeProperty('--cw');
      fadeCards(cards, ins, cards.map(() => 1e6), 1, 0, 0, 0); // 마스크 · 그림자 · 숨김 모두 거둔다
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- n 은 상수(9)
  }, [flow]);

  // 언어가 바뀌면 제목 글자 폭(띠 시작) · 제목 줄 높이(1단 카드 폭)가 바뀐다 — 전부 다시 잰다(흐를 거리 · 섹션 높이도 다시 쓴다).
  // 첫 마운트는 위 layout effect 가 이미 쟀다
  const langSeen = useRef(lang);
  useEffect(() => {
    if (langSeen.current === lang) return;
    langSeen.current = lang;
    relayout.current();
  }, [lang]);

  useEffect(() => () => cancelAnimationFrame(settle.current), []);

  // 읽기 프로그램 알림 — 흐르는 판에서는 단추 · 키보드 · 끌기로 옮겼을 때만(그냥 스크롤로 섹션을 지나가면 멈출 때마다 'N / 9 이름'을 읽었다, 261012 검토)
  useEffect(() => {
    if (flowRef.current && performance.now() - navAt.current > 2500) return undefined;
    const id = window.setTimeout(() => setSaid(cur), 450);
    return () => window.clearTimeout(id);
  }, [cur]);

  /** 흐르는 판 — 카드 k 자리의 페이지 스크롤 위치 */
  const flowY = (k: number) => {
    const run = runRef.current;
    const g = geo.current;
    if (!run || !g.ok) return null;
    return Math.round(run.getBoundingClientRect().top + window.scrollY - g.stick + (g.stops[k] ?? 0));
  };

  const go = (i: number) => {
    navAt.current = performance.now();
    if (flowRef.current) {
      const k = Math.max(0, Math.min(clampI(i), geo.current.lastStop));
      const y = flowY(k);
      if (y === null) return;
      target.current = k;
      lastD.current = Infinity;
      holdBizTabBar(1600); // 단추로 아래로 굴러도 하단 탭바가 숨지 않게
      scrollToY(y);
      return;
    }
    const track = trackRef.current;
    if (!track) return;
    const k = Math.min(clampI(i), lastStopOf(track, n));
    target.current = k;
    lastD.current = Infinity;
    track.scrollTo({ left: leftOf(track, k), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };
  const by = (d: number) => go((target.current ?? at.current) + d);

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (k) by(k);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(n - 1);
    else return;
    e.preventDefault();
  };

  /*
   * 끌기 — 흐르는 판: 마우스 · 손가락 가로 끌기 = 페이지 스크롤(카드 줄이 손을 따라온다), 놓으면 던진 속도까지 셈해 가까운 카드 자리로.
   *   손가락은 줄에 touch-action: pan-y 라 세로로 밀면 브라우저 스크롤 그대로(pointercancel), 가로일 때만 여기로 온다.
   * 넘기는 판: 마우스 끌기만(손가락 · 트랙패드는 브라우저가 알아서) — 끄는 동안은 칸 붙기를 끄고(data-free),
   *   놓으면 가까운 칸으로 부드럽게 간 뒤 멈추면 다시 켠다(켜는 순간 제멋대로 튀지 않게).
   */
  const onPointerDown = (e: PointerEvent<HTMLUListElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!flowRef.current && e.pointerType !== 'mouse') return;
    const track = trackRef.current;
    if (!track) return;
    cancelAnimationFrame(settle.current);
    target.current = null;
    if (flowRef.current) {
      const l = window.__bizLenis;
      if (l && l.isScrolling) l.scrollTo(window.scrollY, { immediate: true, force: true }); // 굴러가던 부드러운 스크롤을 멈춘다
    }
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, left: flowRef.current ? window.scrollY : track.scrollLeft, moved: false, lx: e.clientX, lt: e.timeStamp, v: 0 };
  };
  const onPointerMove = (e: PointerEvent<HTMLUListElement>) => {
    const d = drag.current;
    const track = trackRef.current;
    if (!d || !track || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    if (!d.moved) {
      if (Math.abs(dx) < 6) return;
      if (Math.abs(dx) < Math.abs(e.clientY - d.y)) { drag.current = null; return; } // 세로 끌기는 놓아준다
      d.moved = true;
      if (e.pointerType === 'mouse') { try { track.setPointerCapture(d.id); } catch { /* 이미 놓았다 */ } }
      if (!flowRef.current) track.setAttribute('data-free', '');
      track.setAttribute('data-drag', '');
    }
    if (flowRef.current) {
      const g = geo.current;
      const run = runRef.current;
      if (!run || !g.ok) return;
      const s = run.getBoundingClientRect().top + window.scrollY - g.stick;
      const y = Math.max(Math.min(d.left, s), Math.min(Math.max(d.left, s + g.travel), d.left - dx));
      const l = window.__bizLenis;
      if (l) l.scrollTo(y, { immediate: true, force: true });
      else window.scrollTo(0, y);
    } else {
      track.scrollLeft = d.left - dx;
    }
    const dt = e.timeStamp - d.lt;
    if (dt > 0) d.v = d.v * 0.4 + ((e.clientX - d.lx) / dt) * 0.6;
    d.lx = e.clientX;
    d.lt = e.timeStamp;
  };
  const onPointerUp = (e: PointerEvent<HTMLUListElement>) => {
    const d = drag.current;
    const track = trackRef.current;
    if (!d || !track || e.pointerId !== d.id) return;
    drag.current = null;
    if (!d.moved) return;
    track.removeAttribute('data-drag');
    if (e.pointerType === 'mouse') { try { track.releasePointerCapture(d.id); } catch { /* 이미 놓았다 */ } }
    const fling = e.type === 'pointercancel' || e.timeStamp - d.lt > 80 ? 0 : d.v; // 멈췄다 놓으면 던지지 않은 것
    if (flowRef.current) {
      const g = geo.current;
      const run = runRef.current;
      if (!run || !g.ok) return;
      const pos = window.scrollY - (run.getBoundingClientRect().top + window.scrollY - g.stick) - fling * 180;
      go(nearStop(g.stops, Math.max(0, Math.min(g.travel, pos))));
      return;
    }
    const step = stepOf(track);
    const k = Math.min(clampI(Math.round((track.scrollLeft - fling * 160) / step)), lastStopOf(track, n));
    const left = leftOf(track, k);
    track.scrollTo({ left, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    // 다 가면(또는 1.2초) 칸 붙기를 다시 켠다
    const t0 = performance.now();
    let last = -1;
    let still = 0;
    const wait = () => {
      const x = track.scrollLeft;
      still = Math.abs(x - last) < 0.5 ? still + 1 : 0;
      last = x;
      if (Math.abs(x - left) < 1 || still > 4 || performance.now() - t0 > 1200) {
        track.removeAttribute('data-free');
        return;
      }
      settle.current = requestAnimationFrame(wait);
    };
    settle.current = requestAnimationFrame(wait);
  };

  return (
    <section ref={secRef} className="cx-ld" aria-labelledby="cx-ld-title" data-flow={flow ? '' : undefined} data-pre={pending ? '' : undefined}>
      {/* 스크립트가 없으면 판을 고르지 않는다 — 미리 잡은 흐르는 판 높이(data-pre)를 되돌린다 */}
      <noscript><style dangerouslySetInnerHTML={{ __html: '.cx-ld[data-pre]{padding:96px 0 88px}.cx-ld[data-pre] .cx-ld-run{height:auto}.cx-ld[data-pre] .cx-ld-stage{position:static;height:auto}@media (min-width:768px){.cx-ld[data-pre]{padding:130px 0 116px}}@media (min-width:1024px){.cx-ld[data-pre]{padding:150px 0 160px}}' }} /></noscript>
      <div className="cx-ld-bg" aria-hidden>
        <CeoSilk className="cx-ld-silk" />
      </div>
      <div ref={runRef} className="cx-ld-run">
        <div ref={stageRef} className="cx-ld-stage">
          <div className="cx-ld-in">
            <FadeUp className="cx-ld-head">
              <p className="cx-eyebrow">{LEADERS_HEAD.eyebrow}</p>
              <h2 id="cx-ld-title" className="cx-h2 cx-ld-h2">{t(LEADERS_HEAD.title)}</h2>
              <p className="cx-ld-sub">{t(LEADERS_HEAD.sub)}</p>
            </FadeUp>
            <FadeUp className="cx-ld-nav" delay={120}>
              <div className="cx-ld-count" aria-hidden>
                <b>{pad2(cur + 1)}</b>
                <span className="cx-ld-bar"><span ref={barRef} className="cx-ld-bar-in" /></span>
                <span>{pad2(n)}</span>
              </div>
              <span className="sr-only" aria-live="polite">{`${said + 1} / ${n} ${t(LEADERS[said].name)}`}</span>
              {/* 끝 칸에서도 disabled 대신 aria-disabled — 단추를 연달아 누르던 키보드 포커스가 페이지 맨 위로 튀지 않게.
                  DOM 은 단추가 카드 줄 앞(데스크톱 화면 순서 = 키보드 차례), 모바일은 CSS order 로 카드 줄 아래에 그린다 */}
              <div className="cx-ld-btns">
                <button type="button" className="cx-ld-btn cx-ld-prev" onClick={() => { if (cur > 0) by(-1); }} aria-disabled={cur <= 0} aria-controls="cx-ld-track" aria-label={t(LEADERS_HEAD.prev)}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden><path d="M12 5 7 10l5 5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <button type="button" className="cx-ld-btn cx-ld-next" onClick={() => { if (cur < n - 1) by(1); }} aria-disabled={cur >= n - 1} aria-controls="cx-ld-track" aria-label={t(LEADERS_HEAD.next)}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden><path d="m8 5 5 5-5 5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              </div>
            </FadeUp>
            <div ref={railRef} className="cx-ld-rail" role="region" aria-roledescription={t(LEADERS_HEAD.carousel)} aria-labelledby="cx-ld-title">
              {/* 넘기는 판: 세로 휠은 페이지(Lenis)로, 가로 휠 · 트랙패드는 이 줄이 직접 받는다. 흐르는 판: 줄은 스크롤 칸이 아니다 */}
              <ul
                ref={trackRef}
                id="cx-ld-track"
                className="cx-ld-track"
                tabIndex={0}
                aria-label={t(LEADERS_HEAD.list)}
                data-lenis-prevent-horizontal={flow ? undefined : ''}
                onKeyDown={onKeyDown}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onWheel={() => { if (!flowRef.current) target.current = null; }}
                onTouchStart={() => { if (!flowRef.current) target.current = null; }}
              >
                {LEADERS.map((p, i) => <LeaderCard key={p.key} p={p} i={i} t={t} on={i === cur} />)}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
