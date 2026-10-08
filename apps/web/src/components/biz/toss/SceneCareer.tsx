'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useT, type Translations } from '@/lib/biz/i18n';
import { CAREER } from './content';
import { clamp01, ease, lerp, prefersReducedMotion } from './scene';
import { CuesheetDemo, MapDemo, TranslateDemo } from './SceneCareer.demos';

/*
 * ⑤ 경력 — 토스 홈 '주식 용어 구름 + 검은 카드 3장' 장면을 우리 코드로 다시 짠 것.
 * 스크롤로 긁는 연출은 없다(토스와 같음) — 블록이 화면 가운데쯤 오면 시간 기준으로 한 번 등장.
 * 용어 구름만 예외: 들어올 때 터져 나오고, 위로 빠질 때 날아가고, 완전히 나갔다 들어오면 다시.
 */

const CSS = `
/* 토스는 매칭+경력이 한 섹션 — 매칭 장면 아래 여백 0, 여기 위 여백이 블록 사이(모바일 160 · 데스크톱 200)를 맡는다.
   옆 여백 48/160/210 · 아래 100/120 은 토스 1440/1600/1601~ 계단 실측, 모바일 아래 160 */
.cr-sec{position:relative;background:#fff;padding:160px 0 160px;overflow-x:clip;font-family:Pretendard,-apple-system,BlinkMacSystemFont,system-ui,sans-serif}
@media(min-width:1024px){.cr-sec{padding:200px 48px 100px}}
@media(min-width:1441px){.cr-sec{padding:200px 160px 120px}}
@media(min-width:1601px){.cr-sec{padding:200px 210px 120px}}
.cr-head{display:flex;flex-direction:column;align-items:center}
.cr-cloud{position:relative;width:350px;height:201px;margin-bottom:-78px;isolation:isolate;pointer-events:none;user-select:none}
@media(min-width:768px){.cr-cloud{width:352px;height:175px;margin-bottom:-52px}}
.cr-cloud svg{position:absolute;left:0;top:0;overflow:visible}
.cr-w{position:absolute;left:0;top:0;white-space:nowrap;font-size:14px;font-weight:600;line-height:16.1px;letter-spacing:.28px;color:#4E535C;opacity:0;will-change:transform,opacity}
.cr-sub{position:relative;z-index:1;margin:0;padding:0 20px;text-align:center;font-size:28px;font-weight:700;line-height:1.4;letter-spacing:-.02em;color:#1C1F25;word-break:keep-all}
.cr-sub>span{display:block}
@media(min-width:768px){.cr-sub{font-size:32px}.cr-sub>span{display:inline}.cr-sub>span+span::before{content:' '}}
@media(min-width:1601px){.cr-sub{font-size:40px}}
.cr-row{display:flex;flex-direction:column;align-items:center;gap:60px;margin-top:33px;padding:0 20px}
@media(min-width:1024px){.cr-row{flex-direction:row;align-items:flex-start;gap:0;max-width:1500px;margin:60px auto 0;padding:0}}
@media(min-width:1601px){.cr-row{margin-top:40px}}
.cr-item{width:100%;max-width:440px;display:flex;flex-direction:column;gap:18px}
@media(min-width:1024px){.cr-item{flex:1 1 0;min-width:0;max-width:none;gap:28px}}
@media(min-width:1024px) and (max-width:1280px){.cr-item{gap:20px}}
.cr-card{position:relative;width:100%;aspect-ratio:500/600;border-radius:32px;overflow:hidden;background:#000;isolation:isolate;--k:.7}
@media(min-width:1024px){.cr-card{border-radius:0}}
.cr-stage{position:absolute;left:0;top:0;width:500px;height:600px;transform-origin:0 0;transform:scale(var(--k))}
.cr-txt{display:flex;flex-direction:column;gap:8px;padding:0 8px}
.cr-cap{margin:0;font-size:18px;font-weight:600;line-height:26.64px;letter-spacing:-.02em;color:#333840;word-break:keep-all}
.cr-cap>span{display:block}
.cr-ph{white-space:nowrap}
.cr-body{margin:0;font-size:16px;font-weight:400;line-height:1.6;letter-spacing:-.02em;color:#727780;word-break:keep-all}
@media(min-width:1024px){.cr-cap{font-size:20px;font-weight:700;line-height:29.6px}}
@media(min-width:1601px){.cr-cap{font-size:24px;line-height:1.48}.cr-body{font-size:18px}}
.cr-arrow{position:absolute;right:32px;bottom:32px;width:48px;height:48px;border-radius:100px;overflow:hidden;z-index:3;background:rgba(255,255,255,.11);border:1px solid rgba(255,255,255,.11);backdrop-filter:blur(15px);-webkit-backdrop-filter:blur(15px)}
.cr-arrow svg{position:absolute;inset:-1px;width:48px;height:48px}
/* 등장 — 부제 40px · 카드 120px 올라오며 */
.cr-rv{opacity:0;transform:translateY(40px)}
.cr-item{opacity:0;transform:translateY(120px)}
.cr-in .cr-rv{opacity:1;transform:none;transition:transform 680ms cubic-bezier(.2,0,.25,1),opacity 680ms cubic-bezier(.2,0,.25,1)}
.cr-in .cr-item{opacity:1;transform:none;transition:transform 780ms cubic-bezier(.3,.2,.3,1) var(--d),opacity 780ms cubic-bezier(.3,.2,.3,1) var(--d)}
/* 데모 공용 */
.cr-ping{display:block}
.cr-ping::after{content:'';position:absolute;inset:-8px;border-radius:999px;background:currentColor;animation:cr-ping 2s ease-out infinite}
@keyframes cr-ping{0%{transform:scale(.5);opacity:.8}100%{transform:scale(2.4);opacity:0}}
.cr-eq i{display:block;width:4px;height:16px;border-radius:2px;background:rgb(154,154,154);animation:cr-eq 1.1s ease-in-out infinite;transform-origin:50% 50%}
@keyframes cr-eq{0%,100%{transform:scaleY(.35)}50%{transform:scaleY(1)}}
.cr-maplabel{opacity:0;transition:opacity 600ms ease}
.cr-maplabel>span{transform:translateY(6px);transition:transform 600ms cubic-bezier(.22,1,.36,1)}
.cr-maplabel[data-on="1"]{opacity:1}
.cr-maplabel[data-on="1"]>span{transform:none}
@media(prefers-reduced-motion:reduce){
  .cr-rv,.cr-item{opacity:1!important;transform:none!important;transition:none!important}
  .cr-ping::after,.cr-eq i{animation:none}
  .cr-maplabel,.cr-maplabel>span{transition:none}
}
`;

/* ───────── 용어 구름 ───────── */

const ROT_SPEED = (3 * Math.PI) / 180; // 초당 3°
const GOLD = Math.PI * (3 - Math.sqrt(5));
const LH = 16.1; // .cr-w 줄 높이
const SC_MAX = 1.27;
const OP_FRONT = 0.42; // 이보다 진한 낱말끼리는 안 겹치게(검사 기준 0.5 보다 여유)
const PAD = 4;
const STEPS = 240; // 한 바퀴 1.5° 간격으로 겹침 검사
const N_CAND = 360; // 피보나치 후보 자리
const N_LAT = 24; // 되풀이 낱말 위도 후보
const E_LO = 0.04; // 돔 위도 범위(sin) — 적도 살짝 위 ~ 꼭대기 아래
const E_HI = 0.9;

type Place = { th: number; e: number; gate: boolean; hide: boolean };
type Geo = { cx: number; rx: number; baseY: number; ry: number };

const geoOf = (W: number, H: number): Geo => ({ cx: W / 2, rx: Math.min(W * 0.37, 132), baseY: H * 0.52, ry: H * 0.58 });
const opOf = (z: number) => Math.pow(clamp01((z + 0.35) / 1.35), 1.2) * 0.95;
// 쌍둥이 낱말은 앞 반구(z>0)에서만 보인다 — 반대편 쌍둥이(z<0)와 동시에 안 보임
const gateOf = (z: number) => clamp01(z / 0.08);
const scOf = (z: number) => 0.83 + ((z + 1) / 2) * 0.44;
// 진한(op>OP_FRONT) 상태가 되려면 필요한 최소 z
const Z_FRONT = 1.35 * Math.pow(OP_FRONT / 0.95, 1 / 1.2) - 0.35;

/** 두 낱말이 한 바퀴 도는 동안 둘 다 진한 채로 겹치는 순간이 있나 */
function clash(a: Place, wa: number, b: Place, wb: number, g: Geo): boolean {
  const ca = Math.cos(a.e);
  const cb = Math.cos(b.e);
  if (ca < Z_FRONT || cb < Z_FRONT) return false;
  const sa = Math.sin(a.e);
  const sb = Math.sin(b.e);
  if (Math.abs(g.ry * (sa - sb)) > LH * SC_MAX + 20 + PAD) return false; // 위아래로 늘 떨어짐
  for (let k = 0; k < STEPS; k++) {
    const r = (k / STEPS) * Math.PI * 2;
    const za = ca * Math.cos(a.th + r);
    const zb = cb * Math.cos(b.th + r);
    if (za < Z_FRONT || zb < Z_FRONT) continue;
    const s1 = scOf(za);
    const s2 = scOf(zb);
    const dx = Math.abs(g.rx * (ca * Math.sin(a.th + r) - cb * Math.sin(b.th + r)));
    const dy = Math.abs(g.ry * (sb - sa) + 10 * (za - zb));
    if (dx < (wa * s1 + wb * s2) / 2 + PAD && dy < (LH * (s1 + s2)) / 2 + PAD / 2) return true;
  }
  return false;
}

/**
 * 자리 잡기 — 피보나치 구(돔) 후보를 돌며, 실제 글자 폭으로 한 바퀴 겹침을 따져 빈 자리에 넣는다.
 * 1) 원래 낱말 먼저(긴 것부터 — 되풀이가 자리를 먼저 먹어 원래 낱말이 겹치던 문제). 2) 되풀이(twin[i]=j)는 남는 자리에만:
 *    원래 낱말의 경도 반대편(θ+π, 위도는 가까운 빈 줄)에 두고 둘 다 앞 반구(z>0)에서만 보이게 — 같은 낱말이 동시에 두 번 안 보인다.
 *    빈 자리가 없으면 되풀이는 숨김(겹치느니 덜 빽빽한 게 낫다).
 */
function layoutCloud(widths: number[], twin: number[], W: number, H: number): Place[] {
  const g = geoOf(W, H);
  const n = widths.length;
  const out: Place[] = Array.from({ length: n }, () => ({ th: 0, e: 0, gate: false, hide: true }));
  const cand = Array.from({ length: N_CAND }, (_, k) => ({ th: k * GOLD, e: Math.asin(E_LO + ((E_HI - E_LO) * (k + 0.5)) / N_CAND) }));
  const lat = Array.from({ length: N_LAT }, (_, k) => Math.asin(E_LO + ((E_HI - E_LO) * (k + 0.5)) / N_LAT));
  const placed: { p: Place; w: number; i: number }[] = [];
  const copies = new Set(twin.filter((t) => t >= 0));
  const heads = Array.from({ length: n }, (_, i) => i).filter((i) => !copies.has(i));
  const U = heads.length;
  const freeOf = (p: Place, w: number, skip = -1) => placed.every((b) => b.i === skip || !clash(p, w, b.p, b.w, g));
  for (const i of [...heads].sort((x, y) => widths[y] - widths[x])) {
    const w = widths[i];
    // 목표 자리 — 원래 순서를 골고루 흩뿌린 후보 번호에서 시작해 양옆으로 훑는다
    const k0 = Math.floor(((((heads.indexOf(i) * 7) % U) + 0.5) / U) * N_CAND);
    let p: Place | null = null;
    for (let d = 0; d < N_CAND && !p; d++) {
      const c = cand[(k0 + (d % 2 ? -(d + 1) / 2 : d / 2) + N_CAND * 2) % N_CAND];
      const q = { th: c.th, e: c.e, gate: false, hide: false };
      if (freeOf(q, w)) p = q;
    }
    if (!p) {
      // 마지막 수단(아주 긴 낱말 · 좁은 상자) — 겹침이 가장 적은 후보
      let bc = Infinity;
      for (const c of cand) {
        const q = { th: c.th, e: c.e, gate: false, hide: false };
        const v = placed.filter((b) => clash(q, w, b.p, b.w, g)).length;
        if (v < bc) { bc = v; p = q; }
      }
    }
    out[i] = p!;
    placed.push({ p: p!, w, i });
  }
  for (const i of heads) {
    const j = twin[i];
    if (j < 0) continue;
    const h = out[i];
    // 원래 낱말은 앞 반구 전용(gate)이 돼도 자리·진하기는 그대로라 검사에서 뺀다(둘은 동시에 앞에 안 옴)
    const e = [...lat].sort((x, y) => Math.abs(x - h.e) - Math.abs(y - h.e)).find((v) => freeOf({ th: h.th + Math.PI, e: v, gate: true, hide: false }, widths[j], i));
    if (e === undefined) continue;
    out[j] = { th: h.th + Math.PI, e, gate: true, hide: false };
    h.gate = true;
    placed.push({ p: out[j], w: widths[j], i: j });
  }
  return out;
}

function WordCloud({ terms }: { terms: string[] }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const lineRefs = useRef<(SVGLineElement | null)[]>([]);
  const gradRefs = useRef<(SVGLinearGradientElement | null)[]>([]);
  // 토스는 짧은 용어 30개 — 우리 용어(16개)는 글자가 길어 24자리면 밀도가 비슷하다.
  // 되풀이 8개는 원래 낱말의 경도 반대편 쌍둥이 — 앞 반구에서만 보여 같은 낱말이 동시에 두 번 안 보인다. 빈 자리 없으면 숨김
  const dupN = terms.length > 12 ? 8 : 0;
  const words = dupN ? [...terms, ...terms.slice(0, dupN)] : terms;
  const n = words.length;
  const wordsKey = words.join('\u0001');

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return undefined;
    const twin = Array.from({ length: n }, (_, i) => (i < dupN ? n - dupN + i : -1));
    const rnd = (i: number) => { const x = Math.sin(i * 12.9898 + 4.1414) * 43758.5453; return x - Math.floor(x); };
    const anim = Array.from({ length: n }, (_, i) => ({ delay: i * 25 + rnd(i) * 10, dur: 600 + rnd(i + 50) * 300, outDelay: rnd(i + 99) * 1900 }));
    const reduce = prefersReducedMotion();
    let W = box.clientWidth;
    let H = box.clientHeight;
    let places: Place[] = [];
    let layKey = '';
    const relayout = () => {
      const widths = Array.from({ length: n }, (_, i) => wordRefs.current[i]?.offsetWidth ?? 0);
      const key = `${W}x${H}|${widths.join(',')}`;
      if (key === layKey) return;
      layKey = key;
      places = layoutCloud(widths, twin, W, H);
    };
    relayout();

    let state: 'idle' | 'in' | 'out' | 'gone' = reduce ? 'in' : 'idle';
    let tIn = reduce ? -1e9 : 0;
    let tOut = 0;
    let lastTop = Infinity;
    const t0 = performance.now();
    let raf = 0;

    const paint = (now: number) => {
      const rot = reduce ? 0.4 : ((now - t0) / 1000) * ROT_SPEED;
      const g = geoOf(W, H);
      // 돔: 꼭대기 y≈-10, 적도 y≈H*.52(부제 위). 빛줄기 모이는 점=상자 아래 끝 살짝 밑(토스 176,183 @352×175) — 선은 35% 지점부터 보여 부제 위로만 드러난다
      const ax = g.cx;
      const ay = H * 1.046;
      const ox = g.cx;
      const oy = H * 0.83;
      for (let i = 0; i < n; i++) {
        const el = wordRefs.current[i];
        const ln = lineRefs.current[i];
        const gr = gradRefs.current[i];
        const s = places[i];
        if (!el || !s) continue;
        const a = s.th + rot;
        const ce = Math.cos(s.e);
        const z = ce * Math.cos(a); // -1(뒤) ~ 1(앞)
        let x = g.cx + g.rx * ce * Math.sin(a);
        let y = g.baseY - g.ry * Math.sin(s.e) + 10 * z;
        let sc = scOf(z);
        const gate = s.hide ? 0 : s.gate ? gateOf(z) : 1;
        let op = opOf(z) * gate;
        let lop = z < -0.2 ? 0 : 0.39 * clamp01((z + 0.2) / 1.2) * gate;
        if (state === 'idle' || state === 'gone') { op = 0; lop = 0; }
        else if (state === 'in' || state === 'out') {
          const an = anim[i];
          const k = ease.out(clamp01((now - tIn - an.delay) / an.dur));
          x = lerp(ox, x, k); y = lerp(oy, y, k); sc *= k; op *= k; lop *= k;
          if (state === 'out') {
            const u = clamp01((now - tOut - an.outDelay) / 800);
            y -= 600 * u * u;
            op *= 1 - u; lop *= 1 - u;
          }
        }
        el.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) translate(-50%,-50%) scale(${sc.toFixed(3)})`;
        el.style.opacity = op.toFixed(3);
        el.style.zIndex = String(500 + Math.round(z * 100));
        el.style.visibility = op < 0.004 ? 'hidden' : 'visible';
        if (ln && gr) {
          const xs = x.toFixed(1);
          const ys = y.toFixed(1);
          ln.setAttribute('x1', String(ax)); ln.setAttribute('y1', String(ay)); ln.setAttribute('x2', xs); ln.setAttribute('y2', ys);
          gr.setAttribute('x1', String(ax)); gr.setAttribute('y1', String(ay)); gr.setAttribute('x2', xs); gr.setAttribute('y2', ys);
          ln.style.opacity = lop.toFixed(3);
          ln.setAttribute('stroke-width', (0.7 + 0.22 * clamp01((z + 1) / 2)).toFixed(2));
        }
      }
    };

    // 상자 크기 · 낱말 폭(글꼴이 늦게 오면 바뀜)이 바뀌면 다시 자리 잡기
    const ro = new ResizeObserver(() => { W = box.clientWidth; H = box.clientHeight; relayout(); if (!raf) paint(performance.now()); });
    ro.observe(box);
    wordRefs.current.slice(0, n).forEach((el) => el && ro.observe(el));

    if (reduce) { paint(t0); return () => ro.disconnect(); }

    // 루프는 터짐·회전·날아감(in/out) 동안만 — idle·gone·화면 밖이면 멈춘다
    const tick = (now: number) => {
      const r = box.getBoundingClientRect();
      if (state === 'in' && r.top < 50 && r.top < lastTop - 0.5) { state = 'out'; tOut = now; }
      if (state === 'out' && now - tOut > 2800) state = 'gone';
      lastTop = r.top;
      paint(now);
      raf = state === 'in' || state === 'out' ? requestAnimationFrame(tick) : 0;
    };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    // 들어옴: 상자가 화면 위 45% 선 안에 걸치면(토스 ≈405/900)
    const ioIn = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || state !== 'idle') return;
      state = 'in';
      tIn = performance.now();
      lastTop = box.getBoundingClientRect().top;
      if (!raf) raf = requestAnimationFrame(tick);
    }, { rootMargin: '0px 0px -55% 0px' });
    // 완전히 나가면 처음 상태로 — 다시 들어오면 또 터진다
    const ioOut = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) return;
      stop();
      state = 'idle';
      lastTop = Infinity;
      paint(performance.now());
    });
    ioOut.observe(box);
    ioIn.observe(box);
    return () => { ioIn.disconnect(); ioOut.disconnect(); ro.disconnect(); stop(); };
  }, [n, dupN, wordsKey]);

  return (
    <div ref={boxRef} className="cr-cloud" aria-hidden>
      <svg width="100%" height="100%">
        <defs>
          {words.map((_, i) => (
            <linearGradient key={i} id={`cr-beam-${i}`} ref={(el) => { gradRefs.current[i] = el; }} gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#94A3B8" stopOpacity="0" />
              <stop offset=".35" stopColor="#94A3B8" stopOpacity="0" />
              <stop offset=".55" stopColor="#94A3B8" stopOpacity=".7" />
              <stop offset=".85" stopColor="#94A3B8" stopOpacity=".7" />
              <stop offset="1" stopColor="#94A3B8" stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {words.map((_, i) => (
          <line key={i} ref={(el) => { lineRefs.current[i] = el; }} stroke={`url(#cr-beam-${i})`} strokeWidth=".8" style={{ opacity: 0 }} />
        ))}
      </svg>
      {words.map((w, i) => (
        <span key={i} ref={(el) => { wordRefs.current[i] = el; }} className="cr-w">{w}</span>
      ))}
    </div>
  );
}

/* ───────── 검은 카드 ───────── */

/**
 * 카드 아래 설명(토스 검은 카드의 회색 두 줄 자리). content.ts 에 CAREER.cards[i].body 가 생기면 그걸 쓰고 이건 지운다.
 * 일·중은 '|' 로 어절을 나눠 둔다 — 어절 안에서는 안 끊긴다(중국어 '主持|人' · auto-phrase 없는 사파리 일본어 방지)
 */
const BODY: Translations[] = [
  {
    ko: '외국인 손님이 함께하는 행사도 걱정 없어요. 외국어 진행이 가능한 진행자가 두 언어로 매끄럽게 이어가요.',
    en: 'Guests from abroad? No problem. Hosts who can run the program in another language keep it flowing in both.',
    ja: '海外からの|ゲストがいる|イベントも|安心。|外国語で|進行できる|司会者が、|二つの言語で|スムーズに|つなぎます。',
    zh: '有外国嘉宾的|活动|也不用担心。|会外语的|主持人|用两种语言|流畅串场。',
  },
  {
    ko: '개회부터 시상, 레크리에이션, 경품 추첨까지. 미리 맞춘 식순대로 시간을 지키며 행사 흐름을 이끌어요.',
    en: 'From the opening to awards and the lucky draw, your host keeps every part of the program on time.',
    ja: '開会から|授賞、|レクリエーション、|景品抽選まで。|事前に決めた|式次第どおり、|時間を守って|進行します。',
    zh: '从开幕、|颁奖、|团建游戏|到抽奖，|按照事先|确定的流程|准时推进，|把控|整场节奏。',
  },
  {
    ko: '서울에서 부산, 제주까지. 전국 어디서 열리는 행사든 맞는 진행자를 찾아 연결해 드려요.',
    en: 'From Seoul to Busan and Jeju, wherever your event takes place, we find and connect you with the right host.',
    ja: 'ソウルから|釜山、|済州まで。|全国どこで|開かれる|イベントでも、|ぴったりの|司会者を|おつなぎします。',
    zh: '从首尔|到釜山、|济州，|无论活动|在全国|哪里举办，|我们都为您|找到|合适的|主持人。',
  },
];

/** '|' 어절 묶음 → 줄바꿈 없는 조각들(조각 사이에서만 끊긴다) */
function Phrases({ text }: { text: string }) {
  if (!text.includes('|')) return <>{text}</>;
  return <>{text.split('|').map((ph, i) => <span key={i} className="cr-ph">{ph}</span>)}</>;
}

/** 일·중·영 화면에서도 통역 데모 원문은 한국어 — 한글이 보이는 동안 원문 칸(데모 bodyRef, keep-all 글 상자)에 lang="ko"
 *  (페이지 CSS [lang="ko"] 낱말 단위 줄바꿈 · 읽어 주기 언어). 영문 결과만 남으면 뗀다. React 가 안 쥔 속성이라 다시 그려도 안 지워진다 */
function KoSource({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const body = ref.current?.querySelector<HTMLElement>('div[style*="keep-all"]');
    if (!body) return undefined;
    const sync = () => {
      const ko = /[\u3131-\u318E\uAC00-\uD7A3]/.test(body.textContent || '');
      if (ko !== (body.getAttribute('lang') === 'ko')) {
        if (ko) body.setAttribute('lang', 'ko');
        else body.removeAttribute('lang');
      }
    };
    sync();
    // 데모가 글자를 바꿀 때만(같은 상태면 데모가 DOM 을 안 건드림) — 매 프레임 아님
    const mo = new MutationObserver(sync);
    mo.observe(body, { childList: true, characterData: true, subtree: true });
    return () => mo.disconnect();
  }, []);
  return <div ref={ref} style={{ display: 'contents' }}>{children}</div>;
}

function Arrow() {
  const ref = useRef<HTMLSpanElement>(null);
  // 눌림 없는 장식 — 버튼에 올리면 화살표가 오른쪽으로 빠지고 왼쪽에서 새로 들어온다
  const swap = (enter: boolean) => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const [a, b] = Array.from(el.querySelectorAll('g'));
    const opt = { duration: enter ? 600 : 400, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' as const };
    if (enter) { a.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(200%)' }], opt); b.animate([{ transform: 'translateX(-200%)' }, { transform: 'translateX(0)' }], opt); }
    else { b.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-200%)' }], opt); a.animate([{ transform: 'translateX(200%)' }, { transform: 'translateX(0)' }], opt); }
  };
  const path = <><path d="M24 15 L33 24 L24 33" /><path d="M33 24 H14" /></>;
  return (
    <span ref={ref} className="cr-arrow" aria-hidden onMouseEnter={() => swap(true)} onMouseLeave={() => swap(false)}>
      <svg viewBox="0 0 48 48" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <g>{path}</g>
        <g style={{ transform: 'translateX(-200%)' }}>{path}</g>
      </svg>
    </span>
  );
}

function DarkCard({ bg, children, caption, body, delay }: { bg: string; children: ReactNode; caption: string[]; body: string; delay: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    // 무대 배율 = 카드 폭 / 500
    const ro = new ResizeObserver(() => el.style.setProperty('--k', String(el.clientWidth / 500)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="cr-item" style={{ ['--d' as string]: `${delay}ms` }}>
      <div ref={ref} className="cr-card" style={{ background: bg }}>
        <div className="cr-stage">{children}</div>
        <Arrow />
      </div>
      <div className="cr-txt">
        <h3 className="cr-cap">{caption.map((l, i) => <span key={i}>{l}</span>)}</h3>
        <p className="cr-body"><Phrases text={body} /></p>
      </div>
    </div>
  );
}

export default function SceneCareer() {
  const t = useT();
  const headRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [c1, c2, c3] = CAREER.cards;

  useEffect(() => {
    const el = headRef.current;
    if (!el) return undefined;
    if (prefersReducedMotion()) { setInView(true); return undefined; }
    // 블록 위 끝이 화면 위에서 56% 선을 넘으면 한 번
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setInView(true); io.disconnect(); }
    }, { rootMargin: '0px 0px -44% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section id="dock-career" className={`cr-sec${inView ? ' cr-in' : ''}`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div ref={headRef} className="cr-head">
        <WordCloud terms={CAREER.terms.map((x) => t(x))} />
        <p className="cr-sub cr-rv">{CAREER.sub.map((l, i) => <span key={i}>{t(l)}</span>)}</p>
      </div>
      <div className="cr-row">
        <DarkCard bg="#000" caption={c1.caption.map((x) => t(x))} body={t(BODY[0])} delay={200}>
          <KoSource>
            <TranslateDemo source={t(c1.source!)} target={t(c1.target!)} badge={t(c1.badge!)} kicker={t(CAREER.terms[0])} />
          </KoSource>
        </DarkCard>
        <DarkCard bg="#000" caption={c2.caption.map((x) => t(x))} body={t(BODY[1])} delay={400}>
          <CuesheetDemo title={t(c2.title!)} steps={c2.steps!.map((s) => ({ time: s.time, label: t(s.label) }))} now={t(c2.now!)} />
        </DarkCard>
        <DarkCard bg="linear-gradient(to right top, #000, #101010), #111317" caption={c3.caption.map((x) => t(x))} body={t(BODY[2])} delay={600}>
          <MapDemo cities={c3.cities!.map((x) => t(x))} pill={t(c3.pill!)} />
        </DarkCard>
      </div>
    </section>
  );
}
