/*
 * 규모 장면 점 지형(2D 캔버스) — 토스 광고 장면의 '점 격자 지형'을 실측 수치(격자 · 원근 · 색 · 핀)로 다시 짠 것.
 * 토스 코드 · 그림은 쓰지 않았다. 스크롤과 무관하게 시간으로만 흐른다(노이즈 지형이 앞으로 밀려오며 바뀐다).
 * 핀 하나가 켜지면 그 둘레가 빨간 산으로 솟고, 이름이 글자 섞임으로 풀리고, 지평선 줄의 숫자가 다시 풀린다.
 */

const TAU = Math.PI * 2;
const ROWS = 60; // 깊이 줄(z 0..1475, 25 간격)
const COLS = 200;
const Z_STEP = 25;
const NOISE_SCALE = 0.0025;
const AMP = 250; // 높이 진폭(월드)
/** 개선 펄린은 실제 값이 ±0.5 언저리라 토스 화면의 기복(앞줄 ±166px 까지)에 맞춰 키운다 */
const N_GAIN = 1.5;
const T_SPEED = 0.3; // 노이즈 시간/초(프레임당 0.005)
const RED: [number, number, number] = [255, 96, 64];
const FRONT: [number, number, number] = [100, 115, 130];
const BACK: [number, number, number] = [40, 70, 80];
const SCRAMBLE = '0123456789,+';
const FONT = 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif';

/* 개선 펄린 노이즈(자체 구현, 시드 고정 순열) */
const PERM = (() => {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = 0x2f6b9d31;
  const rnd = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
  }
  const out = new Uint8Array(512);
  for (let i = 0; i < 512; i++) out[i] = p[i & 255];
  return out;
})();
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const grad = (h: number, x: number, y: number, z: number) => {
  const k = h & 15;
  const u = k < 8 ? x : y;
  const v = k < 4 ? y : k === 12 || k === 14 ? x : z;
  return ((k & 1) ? -u : u) + ((k & 2) ? -v : v);
};
function noise3(x: number, y: number, z: number) {
  const fx = Math.floor(x), fy = Math.floor(y), fz = Math.floor(z);
  const X = fx & 255, Y = fy & 255, Z = fz & 255;
  x -= fx; y -= fy; z -= fz;
  const u = fade(x), v = fade(y), w = fade(z);
  const P = PERM;
  const A = P[X] + Y, AA = P[A] + Z, AB = P[A + 1] + Z;
  const B = P[X + 1] + Y, BA = P[B] + Z, BB = P[B + 1] + Z;
  const l = (a: number, b: number, t: number) => a + t * (b - a);
  return l(
    l(l(grad(P[AA], x, y, z), grad(P[BA], x - 1, y, z), u), l(grad(P[AB], x, y - 1, z), grad(P[BB], x - 1, y - 1, z), u), v),
    l(l(grad(P[AA + 1], x, y, z - 1), grad(P[BA + 1], x - 1, y, z - 1), u), l(grad(P[AB + 1], x, y - 1, z - 1), grad(P[BB + 1], x - 1, y - 1, z - 1), u), v),
    w,
  );
}

export type TerrainPin = {
  /** 월드 x = 0.5·W·xr */
  xr: number;
  /** 깊이 칸(z = zi·25) */
  zi: number;
  radius: number;
  power: number;
  strength: number;
  label: string;
};

export type TerrainTexts = {
  pins: string[];
  infoLabel: string;
  count: string;
  /** 오른쪽 끝 줄 — [머리, 칸1, 칸2, ...] → '머리 : 칸1 | 칸2' */
  right: string[];
  clock: (d: Date) => string;
};

type PinState = {
  amt: number; // 켜짐 정도(8%/프레임)
  rise: number; // 머리 솟음(10%/프레임)
  labelA: number; // 이름 불투명(10%/프레임)
  words: string[];
  shown: number; // 풀린 단어 수
  scr: string[]; // 아직 안 풀린 단어 자리의 섞인 글자
  fr: number;
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const toward = (cur: number, target: number, rate: number, k: number) => cur + (target - cur) * (1 - Math.pow(1 - rate, k));
const scramble = (len: number) => {
  let s = '';
  for (let i = 0; i < len; i++) s += SCRAMBLE[(Math.random() * SCRAMBLE.length) | 0];
  return s;
};

export function createTerrain(
  canvas: HTMLCanvasElement,
  opts: { pins: TerrainPin[]; texts: TerrainTexts; defaultPin: number | null; still: boolean },
) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return { setTexts: () => {}, destroy: () => {} };
  const N = ROWS * COLS;
  const pins = opts.pins;
  let texts = opts.texts;
  const still = opts.still;

  // 점 고정값(크기 바뀔 때 다시 계산)
  const wx = new Float32Array(N), wz = new Float32Array(N), sc = new Float32Array(N);
  const sx = new Float32Array(N), by = new Float32Array(N), edge = new Float32Array(N);
  const c0 = new Float32Array(N * 3), pas = new Float32Array(N);
  const fac = pins.map(() => new Float32Array(N));
  let vis = new Int32Array(0);
  // 프레임 출력(정렬용)
  const ox = new Float32Array(N), oy = new Float32Array(N), orad = new Float32Array(N), ocol = new Uint32Array(N);
  const order = new Float64Array(N);

  let W = 0, H = 0, dpr = 1;
  let t = 0;
  let active: number | null = opts.defaultPin;
  let hovered = false;
  const ps: PinState[] = pins.map(() => ({ amt: 0, rise: 0, labelA: 0, words: [], shown: 0, scr: [], fr: 0 }));
  // 지평선 숫자 풀기
  let countShown = texts.count;
  let countTarget = texts.count;
  let countRev = countTarget.length;
  let countFr = 0;
  let countRed = 0;
  let countHold = 0;
  let countDecay = 0.01;
  let clockSec = -1;
  let clockText = '';
  let ring = 0;

  const startLabel = (i: number) => {
    const s = ps[i];
    s.words = (texts.pins[i] || pins[i].label).split(' ');
    s.shown = 0;
    s.fr = 0;
    s.scr = s.words.map((w) => scramble(w.length));
  };
  const startCount = (toDefault: boolean) => {
    countTarget = texts.count;
    countRev = 0;
    countFr = 0;
    countRed = 1;
    countHold = 90;
    countDecay = toDefault ? 0.05 : 0.01;
  };
  const setActive = (i: number | null) => {
    if (i === active) return;
    active = i;
    if (i !== null) startLabel(i);
    startCount(i === null);
  };
  if (active !== null) {
    startLabel(active);
    if (still) {
      ps[active].amt = 1; ps[active].rise = 1; ps[active].labelA = 1; ps[active].shown = ps[active].words.length;
    }
  }

  const layout = () => {
    const r = canvas.getBoundingClientRect();
    const nw = Math.round(r.width), nh = Math.round(r.height);
    if (!nw || !nh) return false;
    W = nw; H = nh;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const spacing = Math.max(30, (W * 4.4) / COLS);
    const fadeIn = 0.35 * W, fadeLen = 0.2 * W;
    const list: number[] = [];
    let k = 0;
    for (let row = 0; row < ROWS; row++) {
      const z = row * Z_STEP;
      const s = 500 / (500 + z + 250);
      const dT = z / ((ROWS - 1) * Z_STEP);
      for (let c = 0; c < COLS; c++, k++) {
        const x = (c - (COLS - 1) / 2) * spacing;
        wx[k] = x; wz[k] = z; sc[k] = s;
        sx[k] = x * s + W / 2;
        by[k] = 600 * s + 0.4 * H;
        const dx = Math.abs(sx[k] - W / 2);
        edge[k] = dx <= fadeIn ? 1 : Math.max(0, 1 - (dx - fadeIn) / fadeLen);
        c0[k * 3] = FRONT[0] + (BACK[0] - FRONT[0]) * dT;
        c0[k * 3 + 1] = FRONT[1] + (BACK[1] - FRONT[1]) * dT;
        c0[k * 3 + 2] = FRONT[2] + (BACK[2] - FRONT[2]) * dT;
        let mp = 0;
        for (let p = 0; p < pins.length; p++) {
          const pin = pins[p];
          const d = Math.hypot(x - 0.5 * W * pin.xr, z - pin.zi * Z_STEP);
          const u = Math.max(0, 1 - d / pin.radius);
          fac[p][k] = u > 0 ? Math.pow(u, pin.power) : 0;
          mp = Math.max(mp, u * u * 0.35);
        }
        pas[k] = mp;
        if (edge[k] > 0.02 && sx[k] > -4 && sx[k] < W + 4) list.push(k);
      }
    }
    vis = Int32Array.from(list);
    return true;
  };

  const pinGeo = (p: number) => {
    const pin = pins[p];
    const z = pin.zi * Z_STEP;
    const s = 500 / (500 + z + 250);
    const x = 0.5 * W * pin.xr * s + W / 2;
    const base = 600 * s + 0.4 * H;
    return { s, x, base };
  };

  const step = (k: number) => {
    t += (T_SPEED / 60) * k;
    ring = (ring + k / 90) % 1; // 1.5초 고리
    for (let i = 0; i < pins.length; i++) {
      const s = ps[i];
      const on = i === active ? 1 : 0;
      s.amt = toward(s.amt, on, 0.08, k);
      s.rise = toward(s.rise, on, 0.1, k);
      s.labelA = toward(s.labelA, on, 0.1, k);
      if (on) {
        const prev = s.fr;
        s.fr += k;
        if (Math.floor(s.fr / 8) !== Math.floor(prev / 8)) s.shown = Math.min(s.words.length, s.shown + 1);
        if (Math.floor(s.fr / 5) !== Math.floor(prev / 5)) s.scr = s.words.map((w) => scramble(w.length));
      }
    }
    // 숫자: 3프레임마다 한 글자
    if (countRev < countTarget.length) {
      const prev = countFr;
      countFr += k;
      const adv = Math.floor(countFr / 3) - Math.floor(prev / 3);
      if (adv > 0) countRev = Math.min(countTarget.length, countRev + adv);
      countShown = countTarget.slice(0, countRev) + scramble(countTarget.length - countRev);
    } else {
      countShown = countTarget;
    }
    if (countHold > 0) countHold -= k;
    else if (countRed > 0) countRed = Math.max(0, countRed - countDecay * k);
  };

  const draw = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#f3f3f3';
    ctx.fillRect(0, 0, W, H);

    // 핀별 켜짐(0.001 넘는 것만 계산)
    const live: number[] = [];
    for (let i = 0; i < pins.length; i++) if (ps[i].amt > 0.001) live.push(i);

    let n = 0;
    const tz = 0.4 * t;
    for (let vi = 0; vi < vis.length; vi++) {
      const k = vis[vi];
      const s = sc[k];
      let nz = noise3(wx[k] * NOISE_SCALE, wz[k] * NOISE_SCALE + t, tz) * N_GAIN;
      if (nz > 1) nz = 1; else if (nz < -1) nz = -1;
      const h = nz * AMP;
      let f = 0, str = 0;
      for (let li = 0; li < live.length; li++) {
        const p = live[li];
        const v = ps[p].amt * fac[p][k];
        if (v > f) { f = v; str = pins[p].strength; }
      }
      const y = by[k] - (h * (1 - f) + f * str) * s;
      if (y < -4 || y > H + 4) continue;
      const mA = clamp01((f - 0.2) * 2);
      const pv = pas[k];
      const m = Math.max(mA, pv);
      const tint = clamp01((h + AMP) / (2 * AMP));
      let r = c0[k * 3] + 50 * tint, g = c0[k * 3 + 1] + 50 * tint, b = c0[k * 3 + 2] + 60 * tint;
      r += (RED[0] - r) * m; g += (RED[1] - g) * m; b += (RED[2] - b) * m;
      let a = Math.min(1, Math.max(0.2, 2 * s - 0.1)) * edge[k] + 0.4 * mA + 0.07 * (pv / 0.35);
      if (a < 0.05) continue;
      if (a > 1) a = 1;
      ox[n] = sx[k]; oy[n] = y; orad[n] = 2.2 * s * (1 + 0.8 * mA);
      // 색 32단계 · 투명도 20단계로 묶어서 한 번에 칠한다
      const key = ((((r | 0) >> 3) * 32 + ((g | 0) >> 3)) * 32 + ((b | 0) >> 3)) * 21 + Math.round(a * 20);
      ocol[n] = key;
      order[n] = key * 16384 + n;
      n++;
    }
    const ord = order.subarray(0, n);
    ord.sort();
    let cur = -1;
    for (let j = 0; j < n; j++) {
      const v = ord[j];
      const i = v % 16384;
      const key = ocol[i];
      if (key !== cur) {
        if (cur !== -1) ctx.fill();
        cur = key;
        const al = (key % 21) / 20;
        const rgb = Math.floor(key / 21);
        const bb = (rgb % 32) * 8 + 4, gg = (Math.floor(rgb / 32) % 32) * 8 + 4, rr = Math.floor(rgb / 1024) * 8 + 4;
        ctx.fillStyle = `rgba(${rr},${gg},${bb},${al})`;
        ctx.beginPath();
      }
      const x = ox[i], y = oy[i], rad = orad[i];
      if (rad < 0.75) ctx.rect(x - rad, y - rad, rad * 2, rad * 2);
      else { ctx.moveTo(x + rad, y); ctx.arc(x, y, rad, 0, TAU); }
    }
    if (cur !== -1) ctx.fill();

    drawPins();
    drawInfo();
  };

  const drawPins = () => {
    for (let i = 0; i < pins.length; i++) {
      const pin = pins[i];
      const st = ps[i];
      const { s, x, base } = pinGeo(i);
      if (x < -20 || x > W + 20) continue;
      const a = st.amt;
      const headY = base - (pin.strength - 40) * s - 0.6 * pin.strength * s * st.rise;
      // 줄 — 머리 진하게 → 바닥 투명
      const gr = ctx.createLinearGradient(0, headY, 0, base);
      const lr = Math.round(160 + (RED[0] - 160) * a), lg = Math.round(160 + (RED[1] - 160) * a), lb = Math.round(160 + (RED[2] - 160) * a);
      gr.addColorStop(0, `rgba(${lr},${lg},${lb},1)`);
      gr.addColorStop(1, `rgba(${lr},${lg},${lb},${0.3 * a})`);
      ctx.fillStyle = gr;
      ctx.fillRect(x - 0.5, headY, 1, base - headY);
      // 머리 — 회색 고리(3px + 흰 속) → 빨간 점(4px)
      const hr = 3 + a;
      const cr = Math.round(160 + (RED[0] - 160) * a), cg = Math.round(170 + (RED[1] - 170) * a), cb = Math.round(180 + (RED[2] - 180) * a);
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${0.8 + 0.2 * a})`;
      ctx.beginPath(); ctx.arc(x, headY, hr, 0, TAU); ctx.fill();
      if (a < 0.98) {
        ctx.fillStyle = `rgba(255,255,255,${1 - a})`;
        ctx.beginPath(); ctx.arc(x, headY, 1.5, 0, TAU); ctx.fill();
      }
      if (a > 0.05) {
        const rr = 4 + 12 * ring;
        ctx.strokeStyle = `rgba(${RED[0]},${RED[1]},${RED[2]},${0.6 * (1 - ring) * a})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, headY, rr, 0, TAU); ctx.stroke();
      }
      // 이름 — 단어 하나씩 풀림
      if (st.labelA > 0.01 && st.words.length) {
        const txt = st.words.map((w, wi) => (wi < st.shown ? w : st.scr[wi] || w)).join(' ');
        ctx.save();
        ctx.font = `700 ${Math.max(13, 16 * s)}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.shadowColor = 'rgba(255,255,255,0.8)';
        ctx.shadowBlur = 4;
        ctx.fillStyle = `rgba(${RED[0]},${RED[1]},${RED[2]},${st.labelA})`;
        ctx.fillText(txt, x, headY - 4 - 10);
        ctx.restore();
      }
    }
  };

  const drawInfo = () => {
    const y = 0.38 * H;
    const grey = 'rgba(120,130,140,0.5)';
    ctx.font = `400 13px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = grey;
    ctx.textAlign = 'right';
    ctx.fillText(texts.infoLabel, W / 2 - 50, y);
    ctx.fillStyle = 'rgba(120,130,140,0.3)';
    ctx.fillRect(W / 2 - 42, y - 0.25, 84, 0.5);
    const cr = Math.round(120 + (RED[0] - 120) * countRed), cg = Math.round(130 + (RED[1] - 130) * countRed), cb = Math.round(140 + (RED[2] - 140) * countRed);
    ctx.fillStyle = `rgba(${cr},${cg},${cb},${0.5 + 0.5 * countRed})`;
    ctx.textAlign = 'left';
    ctx.fillText(countShown, W / 2 + 50, y);
    if (W >= 1024) {
      const now = new Date();
      const sec = Math.floor(now.getTime() / 1000);
      if (sec !== clockSec) { clockSec = sec; clockText = texts.clock(now); }
      ctx.fillStyle = grey;
      ctx.fillText(clockText, 0.1 * W, y);
      // 오른쪽 — 칸 구분 ' | ' 는 더 옅게
      const [head, ...cells] = texts.right;
      const parts: { s: string; a: number }[] = [{ s: `${head} : `, a: 0.5 }];
      cells.forEach((c, i) => {
        if (i) parts.push({ s: ' | ', a: 0.2 });
        parts.push({ s: c, a: 0.5 });
      });
      let xr = 0.9 * W;
      ctx.textAlign = 'right';
      for (let i = parts.length - 1; i >= 0; i--) {
        ctx.fillStyle = `rgba(120,130,140,${parts[i].a})`;
        ctx.fillText(parts[i].s, xr, y);
        xr -= ctx.measureText(parts[i].s).width;
      }
    }
  };

  // 돌리기 — 35% 이상 보이면 60fps, 그 아래는 30fps, 화면 밖이면 멈춤
  let raf = 0;
  let visible = false;
  let fps = 60;
  let last = 0;
  let lastDraw = 0;
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    if (fps === 30 && now - lastDraw < 1000 / 30 - 2) return;
    const dtMs = last ? Math.min(100, now - last) : 16.7;
    last = now;
    lastDraw = now;
    step(dtMs / (1000 / 60));
    draw();
  };
  const start = () => { if (!raf && !still) { last = 0; raf = requestAnimationFrame(loop); } };
  const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };

  const io = new IntersectionObserver(
    ([e]) => {
      visible = e.isIntersecting;
      fps = e.intersectionRatio >= 0.35 ? 60 : 30;
      if (visible) start(); else stop();
    },
    { threshold: [0, 0.25, 0.35, 1], rootMargin: '300px 0px' },
  );
  io.observe(canvas);

  const ro = new ResizeObserver(() => {
    if (layout() && (still || !raf)) draw();
  });
  ro.observe(canvas);
  if (layout()) draw();

  // 지평선 아래에서 가장 가까운 핀(바닥점 기준, 반경 안)
  const pick = (cx: number, cy: number) => {
    let best: number | null = null, bd = Infinity;
    for (let i = 0; i < pins.length; i++) {
      const g = pinGeo(i);
      const d = Math.hypot(cx - g.x, cy - g.base);
      if (d < pins[i].radius && d < bd) { bd = d; best = i; }
    }
    return best;
  };
  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    const cx = e.clientX - r.left, cy = e.clientY - r.top;
    if (cy <= 0.38 * H) return;
    hovered = true;
    setActive(pick(cx, cy));
    if (still) { ps.forEach((s, i) => { const on = i === active ? 1 : 0; s.amt = on; s.rise = on; s.labelA = on; s.shown = s.words.length; }); countShown = texts.count; countRed = 0; draw(); }
  };
  const onLeave = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || !hovered) return;
    setActive(null);
    if (still) { ps.forEach((s) => { s.amt = 0; s.rise = 0; s.labelA = 0; }); draw(); }
  };
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerdown', onMove);
  canvas.addEventListener('pointerleave', onLeave);

  return {
    setTexts(next: TerrainTexts) {
      texts = next;
      if (active !== null) { startLabel(active); if (still) ps[active].shown = ps[active].words.length; }
      countTarget = next.count;
      countShown = next.count;
      countRev = next.count.length;
      clockSec = -1;
      if (still || !raf) draw();
    },
    destroy() {
      stop();
      io.disconnect();
      ro.disconnect();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
    },
  };
}
