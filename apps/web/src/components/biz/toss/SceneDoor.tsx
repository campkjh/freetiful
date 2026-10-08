'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/biz/i18n';
import { BOOK, DOOR } from './content';
import { ease, prefersReducedMotion, seg, useFrame, usePassProgress } from './scene';
import { PhoneShell, ScreenImg } from './SceneBook.parts';

/*
 * ⑤ 현장 장면 — 토스 '매일 하는 쇼핑도 / 이제는 토스로'(상자 열기) 자리를 프리티풀 연회장 문 밀고 들어가기로 다시 짠 것.
 * 데스크톱: 높이 5vh 부모 + sticky 무대, canvas 프레임 스크럽 + 낱말별 흐림 등장(토스 측정값). 진행률 p = ['start center','end end'].
 *   토스 상자 낙하·배경 밝아짐 → 흰 바탕 위 사진 카드가 떨어져 앉고, 둘레 흰 막이 걷히며 전체 화면 사진이 된다(카드=같은 픽셀이라 이음 없음).
 *   토스 끝(사진 → 폰 화면으로 씻기 0.875~0.915, 폰 축소 0.915~0.989)은 DOM 폰(예약 장면과 같은 PhoneShell · 같은 화면)을 크게 띄워 줄여 재현 —
 *   p=1(붙음 끝)에서 무대를 숨기면 바로 아래 겹친 예약 장면(-100vh)의 같은 자리 폰이 이어받는다(토스처럼 이음 없음).
 * 모바일: 토스처럼 장면 없이 왼쪽 정렬 제목만(예약 장면 카드 2장이 바로 이어짐).
 */

// 60번째(hall-59)는 다른 컷(접수대) — 문 밀기 흐름이 끊겨 뺀다
const FRAMES = DOOR.frames.slice(0, 59);
const N = FRAMES.length;
const IMG_W = 1280;
const IMG_H = 720;

/* 토스 측정 타이밍(p) */
const F0 = 0.24; // 프레임 스크럽 시작(흰 막 걷힘과 함께)
const F1 = 0.9; // 마지막 프레임
const VEIL_A = 0.25; // 흰 막 걷힘 0.25→0.40(토스 배경 밝아짐 구간)
const VEIL_B = 0.4;
const WASH_A = 0.875; // 사진 → 폰 화면 씻기(토스 wash-out 15240~15400 = p .875~.915)
const WASH_B = 0.9146;
const ZOOM_END = 0.9886; // 폰 축소 끝(토스 15700) — 축소는 WASH_A 부터 한 곡선: 남은 배율 ∝ (1-t)^2.3(토스 너비 1160→891→693→552→456→397→369→364 맞춤)
const ZOOM_MAX = 7.2; // WASH_B 에서 3.31(토스 폰 너비 1160/350)이 되도록
/* 예약 장면 첫 자세 폰 자리(1440x900 기준 무대: left 238 + 307, top 205 - 116) */
const W0 = 1440;
const H0 = 900;
const PHONE_X = 545;
const PHONE_Y = 89;

/* 토스 상자 낙하 키(p, 토스 px@900 기준 y 오프셋, 불투명도, 흐림) — 빠르게 떨어져 살짝 튕김 */
const DROP: [number, number, number, number][] = [
  [0.104, -300, 0, 10],
  [0.112, -180, 0.5, 9],
  [0.116, -137, 0.85, 8],
  [0.137, -84, 1, 5],
  [0.149, -46, 1, 3],
  [0.161, -2, 1, 1],
  [0.171, 10, 1, 0],
  [0.182, 0, 1, 0],
];
function dropAt(p: number) {
  if (p <= DROP[0][0]) return { y: DROP[0][1], o: 0, b: DROP[0][3] };
  for (let i = 1; i < DROP.length; i++) {
    const [b0, y0, o0, l0] = DROP[i - 1];
    const [b1, y1, o1, l1] = DROP[i];
    if (p <= b1) {
      const t = (p - b0) / (b1 - b0);
      return { y: y0 + (y1 - y0) * t, o: o0 + (o1 - o0) * t, b: l0 + (l1 - l0) * t };
    }
  }
  return { y: 0, o: 1, b: 0 };
}

/* 낱말 흐림 등장 — 들어올 때 easeOutCubic, 나갈 때 easeInCubic(토스 0.12p 등장 / 0.08p 퇴장) */
type WordKey = { a: number; b: number; c: number; d: number };
function wordKeys(n: number, inStart: number, outStart: number): WordKey[] {
  const si = n > 1 ? Math.min(0.035, 0.07 / (n - 1)) : 0;
  const so = n > 1 ? Math.min(0.02, 0.04 / (n - 1)) : 0;
  return Array.from({ length: n }, (_, i) => ({ a: inStart + i * si, b: inStart + i * si + 0.12, c: outStart + i * so, d: outStart + i * so + 0.08 }));
}
function wordStyle(p: number, k: WordKey) {
  if (p < k.c) {
    const e = ease.out(seg(p, k.a, k.b));
    return { o: e, ty: 14 * (1 - e), s: 0.94 + 0.06 * e, bl: 14 * (1 - e) };
  }
  const x = ease.in(seg(p, k.c, k.d));
  return { o: 1 - x, ty: -8 * x, s: 1 + 0.08 * x, bl: 12 * x };
}

const splitWords = (s: string) => s.split(/\s+/).filter(Boolean);

/* 프레임 불러오기 — 첫 장 먼저, 나머지는 듬성듬성 → 촘촘히(스크럽 중에도 가까운 장이 늘 있게) */
type Loader = { imgs: (HTMLImageElement | null)[]; load: (i: number) => Promise<void>; loadAll: () => void; nearest: (i: number) => HTMLImageElement | null };
function createLoader(srcs: string[], onLoad: (i: number) => void): Loader {
  const imgs: (HTMLImageElement | null)[] = srcs.map(() => null);
  const started = new Set<number>();
  const load = (i: number) =>
    new Promise<void>((res) => {
      if (started.has(i)) { res(); return; }
      started.add(i);
      const im = new Image();
      im.decoding = 'async';
      im.src = srcs[i];
      const done = () => { imgs[i] = im; onLoad(i); res(); };
      im.decode().then(done, () => { if (im.complete && im.naturalWidth) done(); else res(); });
    });
  let all = false;
  const loadAll = () => {
    if (all) return;
    all = true;
    const order: number[] = [];
    for (const step of [8, 4, 2, 1]) for (let i = 0; i < srcs.length; i += step) if (!order.includes(i)) order.push(i);
    if (!order.includes(srcs.length - 1)) order.splice(1, 0, srcs.length - 1);
    void (async () => {
      for (let k = 0; k < order.length; k += 4) await Promise.all(order.slice(k, k + 4).map(load));
    })();
  };
  const nearest = (i: number) => {
    if (imgs[i]) return imgs[i];
    for (let d = 1; d < srcs.length; d++) {
      if (imgs[i - d]) return imgs[i - d];
      if (imgs[i + d]) return imgs[i + d];
    }
    return null;
  };
  return { imgs, load, loadAll, nearest };
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ───────── 데스크톱(≥1024) — 예약 장면(lg)과 같은 경계 ───────── */
function DoorDesktop({ active, still, line1, line2 }: { active: boolean; still: boolean; line1: string; line2: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const h2Ref = useRef<HTMLHeadingElement>(null);
  const g0Ref = useRef<HTMLSpanElement>(null);
  const g1Ref = useRef<HTMLSpanElement>(null);
  const w0 = useRef<(HTMLSpanElement | null)[]>([]);
  const w1 = useRef<(HTMLSpanElement | null)[]>([]);
  const phoneLayerRef = useRef<HTMLDivElement>(null);
  const designRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const size = useRef({ w: 0, h: 0, dpr: 1, fs: 1, lg: false });
  const lastP = useRef(0);
  const cache = useRef<Map<HTMLElement, string>>(new Map());
  const loaderRef = useRef<Loader | null>(null);
  const progress = usePassProgress(wrapRef, ['start center', 'end end']);

  const words0 = splitWords(line1);
  const words1 = splitWords(line2);
  const k0 = wordKeys(words0.length, 0, 0.39);
  const k1 = wordKeys(words1.length, 0.41, 0.67);

  /* 끝: 사진 위로 폰 화면이 씻겨 들어오고(투명도) 폰이 7.2 → 1 배로 줄어 예약 장면 첫 자세 자리에 앉는다 */
  const paintPhone = (p: number, wash: number) => {
    const layer = phoneLayerRef.current;
    const ph = phoneRef.current;
    if (!layer || !ph) return;
    const on = wash > 0.002;
    // 켤 때는 인라인 값을 지워 무대(부모)의 visibility 를 물려받게 — 'visible' 을 박으면 무대를 숨겨도 이 층만 남는다
    const vis = on ? '' : 'hidden';
    if (layer.style.visibility !== vis) layer.style.visibility = vis;
    if (!on) return;
    const o = wash.toFixed(3);
    if (layer.style.opacity !== o) layer.style.opacity = o;
    const s = 1 + (ZOOM_MAX - 1) * Math.pow(1 - seg(p, WASH_A, ZOOM_END), 2.3);
    ph.style.transform = `scale(${s.toFixed(4)})`;
  };

  const draw = (p: number) => {
    const c = canvasRef.current;
    const L = loaderRef.current;
    const { w, h, dpr } = size.current;
    if (!c || !w) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.filter = 'none';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);

    const f = still ? 40 : Math.round((N - 1) * seg(p, F0, F1));
    const img = L ? L.nearest(f) : null;
    // cover 맞춤(DPR 반영은 setTransform)
    const sc = Math.max(w / IMG_W, h / IMG_H);
    const Dw = IMG_W * sc;
    const Dh = IMG_H * sc;
    const dx = (w - Dw) / 2;
    const dy = (h - Dh) / 2;
    const k = still ? 1 : 1 + 0.08 * ease.in(seg(p, 0.84, 1)); // 끝에서 한 번 더 밀고 들어감
    const frame = (offY: number) => {
      if (!img) return;
      ctx.drawImage(img, w / 2 + (dx - w / 2) * k, h / 2 + (dy - h / 2) * k + offY, Dw * k, Dh * k);
    };
    frame(0);

    const veil = still ? 0 : 1 - ease.inOut(seg(p, VEIL_A, VEIL_B));
    if (veil > 0.002) {
      ctx.fillStyle = `rgba(255,255,255,${veil})`;
      ctx.fillRect(0, 0, w, h);
      // 사진 카드 — 토스 상자 자리(가로 612 · 중심 y 527 @1440x900)
      const u = Dh / 900;
      const cw = Math.min(Dw * 0.3825, w * 0.62);
      const ch = cw / 1.53;
      const cx = dx + Dw * 0.5;
      const cy = dy + Dh * 0.5856;
      const d = dropAt(p);
      if (d.o > 0.002) {
        const oy = d.y * u;
        const x = cx - cw / 2;
        const y = cy - ch / 2 + oy;
        const land = seg(p, 0.13, 0.18);
        ctx.save();
        ctx.globalAlpha = d.o;
        roundRectPath(ctx, x, y, cw, ch, 22 * u);
        ctx.shadowColor = `rgba(20,24,32,${0.2 * land * veil})`;
        ctx.shadowBlur = 56 * u;
        ctx.shadowOffsetX = 14 * u;
        ctx.shadowOffsetY = 26 * u;
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.clip();
        if (d.b > 0.3) ctx.filter = `blur(${(d.b * u).toFixed(2)}px)`;
        frame(oy);
        ctx.restore();
      }
    }

    const wash = still ? 0 : ease.inOut(seg(p, WASH_A, WASH_B));
    paintPhone(p, wash);

    // 왼쪽 눈금용 — 사진이 드러난 동안만 어두운 바탕
    const st = stageRef.current;
    if (st) {
      const dark = veil < 0.5 && wash < 0.5;
      if (dark !== (st.getAttribute('data-dock-theme') === 'dark')) {
        if (dark) st.setAttribute('data-dock-theme', 'dark');
        else st.removeAttribute('data-dock-theme');
      }
    }
  };

  // 같은 값이면 안 쓴다(스크롤마다 DOM 쓰기 최소화)
  const setCss = (el: HTMLElement, val: string) => {
    if (cache.current.get(el) === val) return;
    cache.current.set(el, val);
    el.style.cssText = val;
  };
  const setVis = (el: HTMLElement, on: boolean) => {
    const v = on ? 'visible' : 'hidden';
    if (el.style.visibility !== v) el.style.visibility = v;
  };

  const paintWords = (p: number) => {
    const fs = size.current.fs;
    const one = (els: (HTMLSpanElement | null)[], keys: WordKey[]) => {
      els.forEach((el, i) => {
        if (!el || !keys[i]) return;
        const s = wordStyle(p, keys[i]);
        const o = Math.round(s.o * 1000) / 1000;
        const css = o <= 0.001
          ? 'opacity:0'
          : `opacity:${o};transform:translate3d(0,${(s.ty * fs).toFixed(2)}px,0) scale(${s.s.toFixed(4)});filter:${s.bl > 0.05 ? `blur(${(s.bl * fs).toFixed(2)}px)` : 'none'}`;
        setCss(el, css);
      });
    };
    one(w0.current, k0);
    one(w1.current, k1);
    // 묶음 켜고 끄기(토스: 계단식)
    const end0 = k0.length ? k0[k0.length - 1].d : 0;
    const end1 = k1.length ? k1[k1.length - 1].d : 0;
    if (g0Ref.current) {
      setVis(g0Ref.current, p < end0);
      // 토스는 첫 줄이 밝은 부엌 위에서 퇴장 — 우리 사진은 어두워, 흰 막이 걷히는 만큼 글자를 흰색으로 돌린다
      const veil = 1 - ease.inOut(seg(p, VEIL_A, VEIL_B));
      const m = 1 - seg(veil, 0.42, 0.6);
      const key = m.toFixed(3);
      const g = g0Ref.current;
      if (cache.current.get(g) !== key) {
        cache.current.set(g, key);
        const ch = (a: number) => Math.round(a + (255 - a) * m);
        g.style.color = `rgb(${ch(28)},${ch(31)},${ch(37)})`;
        g.style.textShadow = `0 8px 32px rgba(0,0,0,${(0.18 * m).toFixed(3)})`;
      }
    }
    if (g1Ref.current) setVis(g1Ref.current, p >= (k1[0]?.a ?? 0) && p < end1);
  };

  useFrame(progress, (p) => {
    if (still) return;
    lastP.current = p;
    draw(p);
    paintWords(p);
    hideAtEnd(p);
  });

  // 붙음 끝(p=1) — 토스처럼 무대를 즉시 숨겨 아래에 겹친 예약 장면(같은 자리 폰)에 넘긴다. 예약 장면이 붙는 무대인 lg 이상에서만
  const hideAtEnd = (p: number) => {
    const st = stageRef.current;
    if (!st) return;
    const v = size.current.lg && p >= 0.99995 ? 'hidden' : 'visible';
    if (st.style.visibility !== v) st.style.visibility = v;
  };

  // canvas 크기 = 무대 × DPR(최대 2)
  useEffect(() => {
    const st = stageRef.current;
    const c = canvasRef.current;
    if (!active || !st || !c) return undefined;
    const fit = () => {
      const r = st.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      size.current.w = r.width;
      size.current.h = r.height;
      size.current.dpr = dpr;
      size.current.lg = window.matchMedia('(min-width: 1024px)').matches;
      // 예약 장면과 같은 배율(1440x900 기준 무대를 화면에 맞춰 통째로)
      const k = Math.max(0.6, Math.min(1.35, Math.min(window.innerWidth / W0, window.innerHeight / H0)));
      if (designRef.current) designRef.current.style.transform = `translate(-50%,-50%) scale(${k})`;
      const fsPx = h2Ref.current ? parseFloat(getComputedStyle(h2Ref.current).fontSize) : 56;
      size.current.fs = fsPx / 56;
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
      cache.current.clear();
      draw(still ? 1 : lastP.current);
      if (!still) { paintWords(lastP.current); hideAtEnd(lastP.current); }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(st);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, still]);

  // 첫 장 즉시, 나머지는 장면이 1.5 화면 앞으로 다가오면
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!active || !wrap) return undefined;
    if (!loaderRef.current) {
      loaderRef.current = createLoader(FRAMES, (i) => {
        const want = still ? 40 : Math.round((N - 1) * seg(lastP.current, F0, F1));
        const L = loaderRef.current;
        if (L && L.nearest(want) === L.imgs[i]) draw(still ? 1 : lastP.current);
      });
    }
    const L = loaderRef.current;
    if (still) { void L.load(40); return undefined; }
    void L.load(0);
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { L.loadAll(); io.disconnect(); } }, { rootMargin: '150% 0px 150% 0px' });
    io.observe(wrap);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, still]);

  // 언어가 바뀌면 낱말 칸이 새로 생긴다 → 다시 칠하기
  useEffect(() => {
    cache.current.clear();
    if (!still) paintWords(lastP.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line1, line2, still]);

  const wordCls = 'block whitespace-nowrap will-change-[transform,opacity,filter]';
  return (
    <div ref={wrapRef} className="relative hidden lg:block" style={{ height: still ? '100vh' : '500vh' }}>
      <div ref={stageRef} className="sticky top-0 h-screen overflow-hidden bg-white">
        <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" aria-hidden />
        {!still && (
          <div ref={phoneLayerRef} className="pointer-events-none absolute inset-0 z-[2] bg-white" style={{ opacity: 0, visibility: 'hidden' }} aria-hidden>
            <div ref={designRef} className="absolute left-1/2 top-1/2" style={{ width: W0, height: H0, transform: 'translate(-50%,-50%)', transformOrigin: '50% 50%' }}>
              <div ref={phoneRef} className="absolute" style={{ left: PHONE_X, top: PHONE_Y, width: 350, height: 762, transformOrigin: '175px 381px', willChange: 'transform' }}>
                <PhoneShell>
                  <ScreenImg src={BOOK.screens.profile} eager />
                </PhoneShell>
              </div>
            </div>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 z-[1] flex items-start justify-center" style={{ paddingTop: '22.222vh' }}>
          {still ? (
            <h2
              ref={h2Ref}
              className="px-6 text-center font-bold text-white"
              style={{ fontSize: 'clamp(40px, 3.889vw, 64px)', lineHeight: 1.2, wordBreak: 'keep-all', textShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
            >
              <span className="block">{line1}</span>
              <span className="block">{line2}</span>
            </h2>
          ) : (
            <h2
              ref={h2Ref}
              aria-label={`${line1} ${line2}`}
              className="relative flex w-full items-center justify-center text-center font-bold antialiased"
              style={{ fontSize: 'clamp(40px, 3.889vw, 64px)', lineHeight: 1.2, height: '1.2em', letterSpacing: 0, wordBreak: 'keep-all' }}
            >
              <span ref={g0Ref} aria-hidden className="absolute inset-x-0 top-0 flex justify-center whitespace-nowrap" style={{ gap: '0.3214em', color: '#1C1F25' }}>
                {words0.map((wd, i) => (
                  <span key={`${wd}-${i}`} ref={(el) => { w0.current[i] = el; }} className={wordCls} style={{ opacity: 0, transformOrigin: '50% 50%' }}>{wd}</span>
                ))}
              </span>
              <span
                ref={g1Ref}
                aria-hidden
                className="absolute inset-x-0 top-0 flex justify-center whitespace-nowrap"
                style={{ gap: '0.3214em', color: '#fff', textShadow: '0 8px 32px rgba(0,0,0,0.18)', visibility: 'hidden' }}
              >
                {words1.map((wd, i) => (
                  <span key={`${wd}-${i}`} ref={(el) => { w1.current[i] = el; }} className={wordCls} style={{ opacity: 0, transformOrigin: '50% 50%' }}>{wd}</span>
                ))}
              </span>
            </h2>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────── 모바일·태블릿(<1024) — 토스 모바일: 상자 장면을 통째로 빼고 왼쪽 정렬 제목만(바로 아래 예약 장면 카드 2장 + 알약이 이어진다) ─────────
 * 토스: 제목 블록 390x124(제목 2줄 92 + 32) 바로 다음 ul. 아래 MobileBook 이 pt 8 이라 여기 pb 24 로 맞춘다.
 * 위 여백 0 — 경력 장면 아래 160 이 블록 사이 160 을 혼자 맡는다(겹치면 320). */
function revealOnce(el: HTMLElement | null, rootMargin: string, cb: () => void) {
  if (!el) return () => {};
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { cb(); io.disconnect(); } }, { rootMargin });
  io.observe(el);
  return () => io.disconnect();
}

function DoorMobile({ active, still, line1, line2 }: { active: boolean; still: boolean; line1: string; line2: string }) {
  const lineRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const headRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!active) return undefined;
    const lines = lineRefs.current.filter(Boolean) as HTMLSpanElement[];
    if (still) {
      lines.forEach((el) => { el.style.cssText = 'opacity:1'; });
      return undefined;
    }
    // 프리셋 F(흐림 등장) — 줄마다 67ms 차례, 1000ms ease
    return revealOnce(headRef.current, '0px 0px -14% 0px', () => {
      lines.forEach((el, i) => {
        el.style.transition = `opacity 1000ms ease ${i * 67}ms, transform 1000ms ease ${i * 67}ms, filter 1000ms ease ${i * 67}ms`;
        el.style.opacity = '1';
        el.style.transform = 'none';
        el.style.filter = 'none';
      });
    });
  }, [active, still]);

  const lineHidden = { opacity: 0, transform: 'translate3d(0,24px,0)', filter: 'blur(16px)' };
  return (
    <div className="px-5 pb-6 pt-0 lg:hidden">
      <h2
        ref={headRef}
        className="font-bold"
        style={{ fontSize: 36, lineHeight: '46.08px', letterSpacing: '-0.72px', color: 'rgb(25,31,40)', wordBreak: 'keep-all' }}
      >
        {[line1, line2].map((ln, i) => (
          <span key={i} ref={(el) => { lineRefs.current[i] = el; }} className="block" style={lineHidden}>{ln}</span>
        ))}
      </h2>
    </div>
  );
}

export default function SceneDoor() {
  const t = useT();
  const line1 = t(DOOR.line1);
  const line2 = t(DOOR.line2);
  const [desk, setDesk] = useState<boolean | null>(null);
  const [still, setStill] = useState(false);

  useEffect(() => {
    setStill(prefersReducedMotion());
    const mq = window.matchMedia('(min-width: 1024px)');
    const on = () => setDesk(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  return (
    // lg 이상 바탕 투명 + 위층(z 2): 예약 장면이 마지막 100vh 에 겹쳐 올라온다(lg). 무대가 숨으면 그 아래가 보인다
    <section id="dock-door" className="relative z-[2] bg-white lg:bg-transparent">
      <DoorDesktop active={desk === true} still={still} line1={line1} line2={line2} />
      <DoorMobile active={desk === false} still={still} line1={line1} line2={line2} />
    </section>
  );
}
