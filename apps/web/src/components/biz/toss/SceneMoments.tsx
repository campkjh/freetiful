'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useT } from '@/lib/biz/i18n';
import { MOMENTS } from './content';
import { clamp01, ease, lerp, prefersReducedMotion, scrollToElement, seg, useFrame, usePassProgress } from './scene';
import { GlassTile, WhitePill, bezier } from './SceneMoments.parts';

/*
 * ⑫ 함께한 순간(토스 홈 '토스가 바꾼 일상' → 비행기 창 줌 → 맺음말 장면 자리, 261008).
 * 데스크톱(≥1024): 600vh 부모 + 100vh 흰 sticky 무대(1440×900 판을 화면에 맞춰 scale).
 *   들어올 때 한 번: 제목 흐림 풀림(700ms) · 사진 4장 120px 떠오름(오른쪽부터 80ms 차례).
 *   스크롤: 계단 사진(238×325) → 238 정사각 격자로 접힘 · 제목 1 사라짐 → 유리 칸 14개 차례로 피어남 · 제목 2 →
 *   다른 칸은 사라지고 주인공 사진만 화면 가운데로, 무대는 검게 → 400vh(여기선 360vh) 줌 장면이 -180vh 겹쳐 이어받아
 *   둥근 정사각 clip-path 가 화면 밖까지 커지며 사진(배율) · 어두운 띠(이동) 2겹 시차 → 맺음말 단어별 밝아짐 + 흰 알약 버튼.
 * 모바일 · 태블릿(<1024): 토스 모바일처럼 끈적임 없이 4열 엇갈림 격자(한 번 떨어짐) + 제목 2 + 어두운 맺음말.
 * 수치는 토스 화면을 재서 옮긴 것(1440×900 기준 px) — 토스 코드 · CSS · 그림은 쓰지 않는다.
 */

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/* 토스 사진 접힘 · 검은 막 곡선 ≈ cubic-bezier(0.6,0,0,0.6) */
const SLOW = bezier(0.6, 0, 0, 0.6);
const ZOOM_VH = 350; // 줌 장면 부모 높이(vh) — 맺음말(250~350vh) 끝에서 끝난다(토스: 맺음말 끝 = 바닥글 시작)
const STMT_VH = 250; // 맺음말 100vh 칸 위 끝(줌 부모 기준, 토스 400vh - 150vh)
const PITCH = 253; // 칸 238 + 틈 15
const PH0 = 325; // 계단 사진 처음 높이
const TY0 = [187, 104, 21, -62]; // 계단 사진 처음 translateY(1~4열)
const HERO_Z = 1.5; // 주인공 칸 사진 확대(줌에서 사진이 더 드러나게)
const NAVY = '2,14,32';

/* 유리 칸 · 빈 칸 자리 [열, 행, 문구 번호(-1 = 빈 칸)] — 배열 순서 = 피어나는 순서 */
const CARDS: [number, number, number][] = [
  [3, 0, 1], [0, 2, -1], [5, 0, -1], [1, 2, 3], [4, 0, 2], [0, 0, -1], [2, 2, 4],
  [5, 2, -1], [1, 0, -1], [3, 2, 5], [0, 1, -1], [4, 2, -1], [2, 0, 0], [5, 1, -1],
];

const CSS = `
.smo-root{letter-spacing:-0.02em}
.smo-art{position:absolute;left:50%;top:50%;width:1440px;height:900px;margin:-450px 0 0 -720px;transform:scale(var(--k,1));transform-origin:50% 50%}
.smo-gbox{position:absolute;top:-120px;left:-31.5px;width:1503px;height:1000px}
.smo-mask{-webkit-mask-image:radial-gradient(54% 40% at 50% 50%,#000 0,rgba(0,0,0,.92) 60.37%,transparent 100%);mask-image:radial-gradient(54% 40% at 50% 50%,#000 0,rgba(0,0,0,.92) 60.37%,transparent 100%)}
.smo-tile{position:absolute;width:238px;height:238px;border-radius:33px;overflow:hidden;transform-origin:50% 50%;backface-visibility:hidden}
.smo-ph{position:absolute;width:238px}
.smo-ph>div{position:relative;width:238px;height:${PH0}px;border-radius:33px;overflow:hidden;will-change:transform,height;backface-visibility:hidden}
.smo-ph img,.smo-tile img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;user-select:none;-webkit-user-drag:none}
.smo-in{opacity:0;transform:translateY(120px);transition:opacity .8s cubic-bezier(.22,1,.36,1),transform .8s cubic-bezier(.22,1,.36,1);transition-delay:var(--d,0s)}
.smo-h1in{opacity:0;filter:blur(16px);transition:opacity .7s cubic-bezier(.37,.31,0,1),filter .7s cubic-bezier(.37,.31,0,1)}
[data-in] .smo-in,[data-in] .smo-h1in{opacity:1;transform:none;filter:none}
.smo-g1{background:radial-gradient(2.31em 1.29em at calc(100% - 1.4em) 90%,rgb(34,114,235) 0,rgba(2,9,19,.91) 100%);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent}
.smo-g2{background:radial-gradient(circle at 100% 50%,rgb(92,164,212) 0,rgba(30,121,241,.32) 70%,rgba(0,72,255,0) 100%),rgba(2,9,19,.91);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent}
.smo-h{font-size:48px;line-height:61.44px;font-weight:700;letter-spacing:-0.96px;margin:0;white-space:pre-wrap;word-break:keep-all}
.smo-d{font-size:16px;line-height:25.6px;font-weight:400;letter-spacing:-0.32px;color:#4E5968;margin:0;white-space:pre-wrap;word-break:keep-all}
.smo-word{display:inline-block;color:rgba(255,255,255,.1);filter:blur(6px);will-change:color,filter}
.smo-pill{display:inline-flex;align-items:center;gap:8px;height:48px;padding:0 10px 0 20px;border-radius:136px;background:#fff;color:rgb(28,31,37);font-size:15px;font-weight:600;letter-spacing:-0.3px;border:0;cursor:pointer;box-shadow:0 8px 28px rgba(0,0,0,.18);transition:transform .25s cubic-bezier(.22,1,.36,1),background-color .2s ease}
.smo-pill:hover{background:#F2F4F6}
.smo-pill:active{transform:scale(.97)}
.smo-pill:focus-visible{outline:2px solid #fff;outline-offset:3px}
.smo-pill i{display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:rgb(28,31,37);transition:transform .25s cubic-bezier(.22,1,.36,1)}
.smo-pill:hover i{transform:translateX(2px)}
.smo-cta{opacity:0;transform:translateY(16px);pointer-events:none;transition:opacity .6s cubic-bezier(.33,1,.68,1),transform .6s cubic-bezier(.33,1,.68,1)}
.smo-cta[data-on]{opacity:1;transform:none;pointer-events:auto}

/* 모바일 · 태블릿 */
.smo-m{--ts:160px;--s:.6723;--gap:8px;--off:32px;--top:100px;--px:20px;--r:24px}
@media (min-width:768px){.smo-m{--ts:208px;--s:.8739;--gap:12px;--off:40px;--top:136px;--px:48px;--r:29px}}
.smo-msec{position:relative;overflow:hidden;background:#fff;height:calc(var(--top) + 3 * var(--off) + 4 * var(--ts) + 3 * var(--gap) + 90px)}
.smo-mgrid{position:absolute;inset:0;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 6%,#000 94%,transparent 100%);mask-image:linear-gradient(90deg,transparent 0,#000 6%,#000 94%,transparent 100%)}
.smo-mgrid>div{transform:translateY(-70px);transition:transform .5s cubic-bezier(.5,1,.89,1)}
.smo-mcol{position:absolute;display:flex;flex-direction:column;gap:var(--gap);width:var(--ts)}
.smo-mt{position:relative;width:var(--ts);height:var(--ts);border-radius:var(--r);overflow:hidden;flex:none}
.smo-mt>.smo-b{position:absolute;left:0;top:0;width:238px;height:238px;transform:scale(var(--s));transform-origin:0 0}
.smo-mt img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.smo-mw{opacity:0;transition:opacity .5s cubic-bezier(.5,1,.89,1)}
.smo-mgrid[data-in]>div{transform:none}
.smo-mgrid[data-in] .smo-mw{opacity:1}
.smo-mh{font-size:36px;line-height:46.08px;letter-spacing:-0.72px}
.smo-md{font-size:14px;line-height:22.4px;letter-spacing:-0.28px;margin-top:12px}
@media (min-width:768px){.smo-mh{font-size:44px;line-height:56px;letter-spacing:-0.88px}.smo-md{font-size:16px;line-height:25.6px;letter-spacing:-0.32px;margin-top:16px}}
.smo-mpanel{position:absolute;left:0;right:0;z-index:2;background:#fff;padding:0 var(--px)}
.smo-mpanel.top{top:60px}
.smo-mpanel.top::after{content:'';position:absolute;left:0;right:0;top:100%;height:20px;background:linear-gradient(#fff,rgba(255,255,255,0))}
.smo-mpanel.bot{bottom:0;padding-bottom:40px}
.smo-mpanel.bot::before{content:'';position:absolute;left:0;right:0;bottom:100%;height:90px;background:linear-gradient(rgba(255,255,255,0),#fff)}
.smo-mword{display:inline-block;color:rgba(255,255,255,.1);filter:blur(6px);transition:color .6s cubic-bezier(.25,.1,.25,1),filter .6s cubic-bezier(.25,.1,.25,1);transition-delay:var(--d,0s)}
[data-in] .smo-mword{color:#fff;filter:none}
[data-in] .smo-cta{opacity:1;transform:none;pointer-events:auto;transition-delay:var(--d,0s)}
@media (prefers-reduced-motion:reduce){
  .smo-in,.smo-h1in,.smo-mw,.smo-mgrid>div,.smo-mword,.smo-cta{opacity:1!important;transform:none!important;filter:none!important;transition:none!important;pointer-events:auto!important}
  .smo-mword{color:#fff!important}
}
`;

/* 제목 2 설명(토스처럼 두 줄) — 프리티풀 문구 */
const DESC2 = {
  ko: '행사 기획부터 섭외, 진행, 정산까지\n이제 프리티풀 하나로 가볍게 준비하세요.',
  en: 'From planning and booking to hosting and settlement,\nget every event ready with Freetiful alone.',
  ja: '企画から手配、進行、精算まで、\nこれからはFreetifulひとつで気軽に準備できます。',
  zh: '从活动策划、预约到主持与结算，\n今后只用 Freetiful 就能轻松准备。', // 중국어=전각 문장부호
};

/** 설명을 토스처럼 두 줄로 — 첫 쉼표(, ， 、 —) 뒤에서 줄바꿈(이미 줄바꿈이 있으면 그대로) */
function twoLines(s: string) {
  if (s.includes('\n')) return s;
  const m = /(, |,|，|、| — )/.exec(s);
  if (!m || m.index < 6 || m.index > s.length - 6) return s;
  const cut = m.index + m[0].length;
  return `${s.slice(0, cut).replace(/ — $/, ' —').trimEnd()}\n${s.slice(cut).trimStart()}`;
}

function goInquiry() {
  const el = document.getElementById('문의폼');
  if (el) scrollToElement(el, -20);
}

/** 주인공 사진을 둘째 자리로(나머지 순서 유지) */
function heroSecond(list: string[], hero: string) {
  const rest = list.filter((x) => x !== hero);
  return [rest[0], hero, ...rest.slice(1)].filter(Boolean).slice(0, 4);
}

/** 맺음말 줄 → 단어 배열(줄 경계 유지) */
function splitLines(lines: string[]) {
  let k = 0;
  return lines.map((line) => line.split(' ').filter(Boolean).map((w) => ({ w, i: k++ })));
}

/* ───────────── 데스크톱: 격자 sticky + 줌 sticky + 맺음말 ───────────── */
function Desktop({ t }: { t: ReturnType<typeof useT> }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<HTMLDivElement>(null);
  const blackRef = useRef<HTMLDivElement>(null);
  const h1Ref = useRef<HTMLDivElement>(null);
  const h2Ref = useRef<HTMLDivElement>(null);
  const phRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const zoomRef = useRef<HTMLDivElement>(null);
  const zStageRef = useRef<HTMLDivElement>(null);
  const zBaseRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<HTMLDivElement>(null);
  const zImgRef = useRef<HTMLImageElement>(null);
  const shadeRef = useRef<HTMLDivElement>(null);
  const stmtRef = useRef<HTMLParagraphElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const ctaRef = useRef<HTMLDivElement>(null);
  const geo = useRef({ W: 1440, H: 900, k: 1, iw: 1600, ih: 901 });
  const st = useRef({ entered: false, dark: false, zvis: false });
  const progress = usePassProgress(rootRef);

  /* 주인공 사진 = 2열(토스 비행기 창 자리) — 오른쪽 · 아래로 미끄러져 가운데에 선다 */
  const photos = heroSecond(MOMENTS.photos, MOMENTS.hero);
  const heroIdx = 1;
  const heroCol = 2;
  /* 주인공 칸 → 판 가운데(601,331) 까지 이동량(격자 상자 좌표) */
  const HTX = 632.5 - PITCH * heroCol;
  const HTY = 451 - (50 * heroCol + PITCH);
  const words = splitLines(MOMENTS.closing.map((x) => t(x)));
  const nWords = words.reduce((a, l) => a + l.length, 0);

  const measure = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const W = stage.clientWidth || window.innerWidth;
    const H = stage.clientHeight || window.innerHeight;
    const k = Math.min(1.4, Math.max(0.7, Math.min(W / 1440, H / 900)));
    const img = zImgRef.current;
    geo.current = { W, H, k, iw: img?.naturalWidth || 1600, ih: img?.naturalHeight || 901 };
    artRef.current?.style.setProperty('--k', String(k));
  }, []);

  const update = useCallback(() => {
    const grid = gridRef.current;
    const zoom = zoomRef.current;
    if (!grid || !zoom || !grid.offsetParent) return;
    const { W, H, k, iw, ih } = geo.current;
    const s = st.current;
    const toPx = 900 / H; // 토스 1440×900 스크롤 px 로 환산
    const g = -grid.getBoundingClientRect().top * toPx;

    /* 들어올 때 한 번(부모 위 끝이 화면 위에서 ~575px) */
    if (!s.entered && g >= -575) {
      s.entered = true;
      stageRef.current?.setAttribute('data-in', '');
    }

    /* 사진 접힘 + 제목 1 사라짐 */
    const P = SLOW(seg(g, 500, 1620));
    const ph = lerp(PH0, 238, P);
    if (h1Ref.current) h1Ref.current.style.opacity = String(1 - ease.out(seg(g, 675, 1175)));
    /* 제목 2: 들어옴 1440→1763, 나감 2475→3015 */
    if (h2Ref.current) h2Ref.current.style.opacity = String(ease.out(seg(g, 1440, 1763)) * (1 - ease.out(seg(g, 2475, 3015))));
    const exitFade = ease.out(seg(g, 2610, 3015));
    const glide = ease.inOut(seg(g, 2475, 3825));

    /* 줌 장면 */
    const z = -zoom.getBoundingClientRect().top * toPx;
    const baseOp = z < 0 ? 0 : ease.out(seg(z, 0, 230));

    for (let c = 1; c <= 4; c++) {
      const el = phRefs.current[c - 1];
      if (!el) continue;
      el.style.height = `${ph}px`;
      const ty0 = TY0[c - 1] * (1 - P);
      if (c === heroCol) {
        el.style.transform = `translate3d(${HTX * glide}px,${ty0 + HTY * glide}px,0)`;
        el.style.opacity = String(1 - baseOp);
      } else {
        el.style.transform = `translate3d(0,${ty0 - 40 * exitFade}px,0)`;
        el.style.opacity = String(1 - exitFade);
      }
    }
    CARDS.forEach(([c, r], i) => {
      const el = cardRefs.current[i];
      if (!el) return;
      const a = ease.out(seg(g, 1440 + 48.5 * i, 1844 + 48.5 * i));
      const op = a * (1 - exitFade);
      el.style.opacity = String(op);
      el.style.transform = `scale(${0.5 + 0.5 * a})`;
      el.style.visibility = op <= 0.001 ? 'hidden' : 'visible';
      if (r === 2 && c >= 1 && c <= 4) el.style.top = `${50 * c + PITCH + ph + 15}px`;
    });
    const black = SLOW(seg(g, 2880, 3825));
    if (blackRef.current) blackRef.current.style.opacity = String(black);
    const dark = black > 0.5;
    if (dark !== s.dark) {
      s.dark = dark;
      if (dark) stageRef.current?.setAttribute('data-dock-theme', 'dark');
      else stageRef.current?.removeAttribute('data-dock-theme');
    }

    const zs = zStageRef.current;
    const zvis = z >= 0;
    if (zs && zvis !== s.zvis) {
      s.zvis = zvis;
      zs.style.visibility = zvis ? 'visible' : 'hidden';
    }
    if (!zvis) return;
    if (zBaseRef.current) zBaseRef.current.style.opacity = String(baseOp);
    /* 둥근 정사각 창: 한 변 = 칸 + 1.9765·스크롤(229px 부터), 모서리 = 13.87% */
    const T = 238 * k;
    const S = T + 1.9765 * Math.max(0, z - 229) / toPx;
    const v = (H - S) / 2;
    const hgap = (W - S) / 2;
    if (clipRef.current) {
      const cp = `inset(${v.toFixed(1)}px ${hgap.toFixed(1)}px round ${(0.1387 * S).toFixed(1)}px)`;
      clipRef.current.style.clipPath = cp;
      clipRef.current.style.setProperty('-webkit-clip-path', cp);
    }
    /* 사진 배율: 칸 속 확대 사진과 같은 배율에서 시작 → 1 → 1.25(밀고 들어감). 창보다 작아지지 않게 */
    const kt = (HERO_Z * T) / Math.min(iw, ih);
    const kl = Math.max(W / iw, H / ih);
    const s0 = kt / kl;
    const sc = z < 855 ? lerp(s0, 1, 1 - Math.pow(1 - seg(z, 229, 855), 2)) : lerp(1, 1.25, seg(z, 855, 2250));
    const need = Math.max(Math.min(S, H) / H, Math.min(S, W) / W);
    const sFin = Math.max(sc, need);
    const pan = Math.max(0, (sFin - 1) * H * 0.5 * 0.85) * seg(z, 1170, 2250);
    if (zImgRef.current) zImgRef.current.style.transform = `translate3d(0,${pan.toFixed(1)}px,0) scale(${sFin.toFixed(4)})`;
    /* 어두운 띠: 사진보다 빠르게 아래 → 위로(시차) */
    if (shadeRef.current) {
      const m = ease.inOut(seg(z, 810, 2250));
      shadeRef.current.style.transform = `translate3d(0,${lerp(50, -45, m)}%,0)`;
      shadeRef.current.style.opacity = String(seg(z, 650, 1000));
    }
  }, [HTX, HTY, heroCol]);

  useIsoLayoutEffect(() => {
    measure();
    update();
    const onR = () => { measure(); update(); };
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, [measure, update]);
  useFrame(progress, update);

  /* 맺음말: 스크롤 목표값 + ~450ms 부드럽게 따라감(rAF, 보일 때만) */
  useEffect(() => {
    const zoom = zoomRef.current;
    if (!zoom) return undefined;
    let raf = 0;
    let cur = 0;
    let last = 0;
    let ctaOn = false;
    const vals: string[] = [];
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const stmt = stmtRef.current;
      if (!stmt) return;
      const H = window.innerHeight;
      /* 토스: 문단 위 끝이 화면 83% → 24% 를 지나는 동안 단어가 차례로 밝아진다 */
      const pt = stmt.getBoundingClientRect().top;
      const target = clamp01((0.83 * H - pt) / (0.59 * H));
      const dt = last ? Math.min(64, now - last) : 16;
      last = now;
      cur += (target - cur) * (1 - Math.exp(-dt / 150));
      if (Math.abs(target - cur) < 0.0005) cur = target;
      const d = 1 / nWords;
      for (let i = 0; i < nWords; i++) {
        const el = wordRefs.current[i];
        if (!el) continue;
        const x = seg(cur, i * d, i * d + 0.87 * d);
        const q = x * x * (3 - 2 * x);
        const key = q.toFixed(3);
        if (vals[i] === key) continue;
        vals[i] = key;
        el.style.color = `rgba(255,255,255,${(0.1 + 0.9 * q).toFixed(3)})`;
        el.style.filter = q >= 0.999 ? 'none' : `blur(${(6 * (1 - q)).toFixed(2)}px)`;
      }
      const on = ctaOn ? cur > 0.85 : cur > 0.97;
      if (on !== ctaOn) {
        ctaOn = on;
        if (on) ctaRef.current?.setAttribute('data-on', '');
        else ctaRef.current?.removeAttribute('data-on');
      }
    };
    const ob = new IntersectionObserver(([e]) => {
      cancelAnimationFrame(raf);
      last = 0;
      if (e.isIntersecting) raf = requestAnimationFrame(tick);
    }, { rootMargin: '20% 0px' });
    ob.observe(zoom);
    return () => { ob.disconnect(); cancelAnimationFrame(raf); };
  }, [nWords]);

  const tileFor = (c: number, r: number, li: number) => {
    const top = r === 0 ? 50 * c : r === 1 ? 50 * c + PITCH : c === 0 || c === 5 ? 50 * c + 2 * PITCH : 50 * c + PITCH + PH0 + 15;
    return { left: PITCH * c, top, li };
  };

  return (
    <div ref={rootRef} className="relative">
      {/* 격자 장면 600vh */}
      <div ref={gridRef} className="relative" style={{ height: '600vh', zIndex: 2 }}>
        <div ref={stageRef} className="sticky top-0 h-screen overflow-hidden bg-white">
          <div ref={blackRef} className="absolute inset-0 bg-black" style={{ opacity: 0 }} />
          <div ref={artRef} className="smo-art">
            <div className="smo-gbox smo-mask">
              {CARDS.map(([c, r, li], i) => {
                const p = tileFor(c, r, li);
                return (
                  <div
                    key={`${c}-${r}`}
                    ref={(el) => { cardRefs.current[i] = el; }}
                    className="smo-tile"
                    style={{ left: p.left, top: p.top, zIndex: -1, opacity: 0, transform: 'scale(.5)', background: li < 0 ? '#F2F4F6' : undefined }}
                  >
                    {li >= 0 && <GlassTile label={t(MOMENTS.tiles[li])} variant={li} />}
                  </div>
                );
              })}
              {photos.map((src, i) => (i === heroIdx ? null : (
                <div key={src + i} className="smo-ph smo-in" style={{ left: PITCH * (i + 1), top: 50 * (i + 1) + PITCH, '--d': `${(3 - i) * 0.08}s` } as CSSProperties}>
                  <div ref={(el) => { phRefs.current[i] = el; }} style={{ transform: `translate3d(0,${TY0[i]}px,0)` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" loading="lazy" decoding="async" draggable={false} />
                  </div>
                </div>
              )))}
            </div>
            {/* 주인공 칸 — 가림막(마스크) 밖에서 위로 */}
            <div className="smo-gbox" style={{ zIndex: 1, pointerEvents: 'none' }}>
              <div className="smo-ph smo-in" style={{ left: PITCH * heroCol, top: 50 * heroCol + PITCH, '--d': `${(3 - heroIdx) * 0.08}s` } as CSSProperties}>
                <div ref={(el) => { phRefs.current[heroIdx] = el; }} style={{ transform: `translate3d(0,${TY0[heroIdx]}px,0)` }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={MOMENTS.hero} alt="" loading="lazy" decoding="async" draggable={false} style={{ transform: `scale(${HERO_Z})` }} />
                </div>
              </div>
            </div>
            <div ref={h1Ref} className="absolute flex flex-col" style={{ top: 150, left: 221.5, width: 732, gap: 24, zIndex: 2 }}>
              <h2 className="smo-h smo-h1in"><span className="smo-g1 inline-block">{t(MOMENTS.heading1)}</span></h2>
              <p className="smo-d">{twoLines(t(MOMENTS.desc))}</p>
            </div>
            <div ref={h2Ref} className="absolute flex flex-col" style={{ top: 646.375, left: 221.5, width: 760, gap: 24, zIndex: 2, opacity: 0 }}>
              <div aria-hidden className="absolute" style={{ top: -40, left: -221.5, width: 1440, height: 336.6, background: 'linear-gradient(180deg,rgba(255,255,255,0) 0,#fff 25%)', zIndex: -1 }} />
              <h2 className="smo-h smo-g2">{t(MOMENTS.heading2)}</h2>
              <p className="smo-d">{t(DESC2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 줌 장면 — 격자 장면 끝 180vh 위에 겹친다 */}
      <div ref={zoomRef} data-dock-theme="dark" className="relative" style={{ height: `${ZOOM_VH}vh`, marginTop: '-180vh', zIndex: 3, pointerEvents: 'none' }}>
        <div ref={zStageRef} className="sticky top-0 h-screen overflow-hidden" style={{ visibility: 'hidden' }}>
          <div ref={zBaseRef} className="absolute inset-0 bg-black" style={{ opacity: 0 }}>
            <div ref={clipRef} className="absolute inset-0 overflow-hidden" style={{ willChange: 'clip-path' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={zImgRef}
                src={MOMENTS.hero}
                alt=""
                loading="lazy"
                decoding="async"
                draggable={false}
                onLoad={() => { measure(); update(); }}
                className="absolute inset-0 h-full w-full select-none object-cover"
                style={{ transformOrigin: '50% 50%', willChange: 'transform' }}
              />
              <div
                ref={shadeRef}
                className="absolute left-0 top-0 w-full"
                style={{
                  height: '200%',
                  opacity: 0,
                  transform: 'translate3d(0,50%,0)',
                  willChange: 'transform,opacity',
                  background: `linear-gradient(180deg,rgba(${NAVY},0) 0%,rgba(${NAVY},.42) 22%,rgba(${NAVY},.68) 45%,rgba(${NAVY},.8) 70%,rgba(${NAVY},.86) 100%)`,
                }}
              />
            </div>
          </div>
        </div>
        {/* 맺음말 — 줌 장면 마지막 화면 자리, 사진 위로 올라온다 */}
        <div className="absolute left-0 flex h-screen w-full flex-col items-center justify-center" style={{ top: `${STMT_VH}vh`, zIndex: 2, padding: '0 24px' }}>
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0" style={{ height: '34%', background: `linear-gradient(180deg,rgba(${NAVY},0) 0%,rgba(${NAVY},.85) 70%,rgb(${NAVY}) 100%)` }} />
          <div className="relative">
          <p ref={stmtRef} className="m-0 text-left text-white" style={{ fontSize: 32, lineHeight: '44.8px', fontWeight: 700, letterSpacing: '-0.8px', wordBreak: 'keep-all', maxWidth: 556 }}>
            {words.map((line, li) => (
              <span key={li} className="block">
                {line.map(({ w, i }, wi) => (
                  <span key={i}>
                    <span ref={(el) => { wordRefs.current[i] = el; }} className="smo-word">{w}</span>
                    {wi < line.length - 1 ? ' ' : ''}
                  </span>
                ))}
              </span>
            ))}
          </p>
          {/* 버튼은 문단 아래에 띄워 문단이 화면 한가운데(토스 자리)에 오게 */}
          <div ref={ctaRef} className="smo-cta absolute left-0 top-full" style={{ marginTop: 40 }}>
            <WhitePill label={t(MOMENTS.closingCta)} onClick={goInquiry} />
          </div>
          </div>
        </div>
      </div>
      {/* 다음 흰 섹션(연혁)으로 — 남색 → 흰색 띠(토스 모바일의 검정 → 남색 → 흰 띠 어법) */}
      <div aria-hidden style={{ height: 200, background: `linear-gradient(180deg,rgb(${NAVY}) 0%,rgb(24,40,66) 22%,rgb(112,124,146) 52%,rgb(226,230,236) 82%,#fff 100%)` }} />
    </div>
  );
}

/* ───────────── 모바일 · 태블릿(및 줄인 움직임): 끈적임 없는 격자 + 맺음말 ───────────── */
const M_COLS: (number | string)[][] = [
  // 숫자 = 문구 칸 번호, 'p0'~'p3' = 사진, '' = 빈 칸
  ['', '', 2, ''],
  [0, 'p0', 'p1', 3],
  [1, 'p2', 'p3', 4],
  ['', 5, '', ''],
];

function Static({ t, className }: { t: ReturnType<typeof useT>; className?: string }) {
  const gridRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLDivElement>(null);
  const [gIn, setGIn] = useState(false);
  const [cIn, setCIn] = useState(false);
  useEffect(() => {
    const obs: IntersectionObserver[] = [];
    const watch = (el: HTMLElement | null, margin: string, on: () => void) => {
      if (!el) return;
      const ob = new IntersectionObserver(([e]) => { if (e.isIntersecting) { on(); ob.disconnect(); } }, { rootMargin: margin });
      ob.observe(el);
      obs.push(ob);
    };
    watch(gridRef.current, '0px 0px -88% 0px', () => setGIn(true));
    watch(closeRef.current, '0px 0px -25% 0px', () => setCIn(true));
    return () => obs.forEach((o) => o.disconnect());
  }, []);
  const words = splitLines(MOMENTS.closing.map((x) => t(x)));
  const n = words.reduce((a, l) => a + l.length, 0);

  return (
    <div className={`smo-m ${className || ''}`}>
      <div className="smo-msec">
        <div className="smo-mpanel top">
          <h2 className="smo-h smo-mh"><span className="smo-g1 inline-block">{t(MOMENTS.heading1)}</span></h2>
          <p className="smo-d smo-md">{twoLines(t(MOMENTS.desc))}</p>
        </div>
        <div ref={gridRef} className="smo-mgrid" data-in={gIn ? '' : undefined}>
          <div className="absolute inset-0">
            {M_COLS.map((col, ci) => (
              <div key={ci} className="smo-mcol" style={{ left: `calc(50% + ${ci - 2} * (var(--ts) + var(--gap)) + var(--gap) / 2)`, top: `calc(var(--top) + ${ci} * var(--off))` }}>
                {col.map((cell, ri) => {
                  if (typeof cell === 'string' && cell.startsWith('p')) {
                    const src = MOMENTS.photos[Number(cell.slice(1))];
                    return (
                      <div key={ri} className="smo-mt">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" loading="lazy" decoding="async" draggable={false} />
                      </div>
                    );
                  }
                  return (
                    <div key={ri} className="smo-mt smo-mw" style={{ background: cell === '' ? 'rgb(242,244,247)' : undefined }}>
                      {typeof cell === 'number' && <div className="smo-b"><GlassTile label={t(MOMENTS.tiles[cell])} variant={cell} /></div>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="smo-mpanel bot">
          <h2 className="smo-h smo-mh smo-g2">{t(MOMENTS.heading2)}</h2>
          <p className="smo-d smo-md">{t(DESC2)}</p>
        </div>
      </div>

      {/* 어두운 맺음말 — 흰색 → 남색 띠 + 주인공 사진 */}
      <div data-dock-theme="dark" style={{ background: `rgb(${NAVY})` }}>
        <div aria-hidden style={{ height: 240, background: `linear-gradient(180deg,#fff 0%,rgb(246,236,234) 18%,rgb(176,160,172) 38%,rgb(52,72,104) 64%,rgb(${NAVY}) 100%)` }} />
        <div ref={closeRef} data-in={cIn ? '' : undefined} className="relative overflow-hidden" style={{ minHeight: 600 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={MOMENTS.hero}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ opacity: 0.55, WebkitMaskImage: 'linear-gradient(180deg,transparent 0%,#000 48%,#000 82%,transparent 100%)', maskImage: 'linear-gradient(180deg,transparent 0%,#000 48%,#000 82%,transparent 100%)' }}
          />
          <div aria-hidden className="absolute inset-0" style={{ background: `linear-gradient(180deg,rgba(${NAVY},0) 40%,rgba(${NAVY},.35) 100%)` }} />
          <div className="relative mx-auto" style={{ padding: '8px 30px 360px', maxWidth: 620 }}>
            <p className="m-0 text-white" style={{ fontSize: 22, lineHeight: '30.8px', fontWeight: 700, wordBreak: 'keep-all' }}>
              {words.map((line, li) => (
                <span key={li} className="block">
                  {line.map(({ w, i }, wi) => (
                    <span key={i}>
                      <span className="smo-mword" style={{ '--d': `${i * 0.12}s` } as CSSProperties}>{w}</span>
                      {wi < line.length - 1 ? ' ' : ''}
                    </span>
                  ))}
                </span>
              ))}
            </p>
            <div className="smo-cta" style={{ marginTop: 28, '--d': `${n * 0.12 + 0.2}s` } as CSSProperties}>
              <WhitePill label={t(MOMENTS.closingCta)} onClick={goInquiry} />
            </div>
          </div>
        </div>
      </div>
      <div aria-hidden style={{ height: 160, background: `linear-gradient(180deg,rgb(${NAVY}) 0%,rgb(24,40,66) 22%,rgb(112,124,146) 52%,rgb(226,230,236) 82%,#fff 100%)` }} />
    </div>
  );
}

export default function SceneMoments() {
  const t = useT();
  const [still, setStill] = useState(false);
  useEffect(() => { setStill(prefersReducedMotion()); }, []);
  return (
    <section id="dock-moments" className="smo-root relative bg-white" style={{ overflowX: 'clip' }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {!still && <div className="hidden lg:block"><Desktop t={t} /></div>}
      <Static t={t} className={still ? '' : 'lg:hidden'} />
    </section>
  );
}
