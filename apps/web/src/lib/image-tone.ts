'use client';

// 사진에서 카드 바탕색 뽑기 — 홈 사회자 카드(260926 사장 "각 프로필 사진의 색을 추출해서, 자연스럽게 이어지는 느낌으로" — 토스 쇼핑 카드 결).
//  · 카드에 보이는 만큼(4:5, 위쪽 20% 기준 cover)만 작게 그려, 얼굴 쪽을 뺀 곳(아래 절반 + 가장자리)에서 가장 많이 보이는 뚜렷한 색을 고른다
//    (핑크 재킷 → 핑크, 남색 정장 → 옅은 하늘, 베이지 배경 → 베이지). 그 색을 옅은 파스텔로 바꿔 검은 글자가 잘 읽히게 한다.
//    뚜렷한 색이 없으면(검은 정장 + 회색 배경) 가장자리 평균으로 옅은 회색 계열.
//  · /uploads 는 같은 출처라 canvas 로 읽힌다. 다른 출처는 crossOrigin 으로 시도하고 막히면 null(기본 회색 카드).
//  · 한 번 뽑은 색은 메모리 + localStorage 에 기억 — 다시 열면 첫 그림부터 색이 입혀져 있다.
import { useEffect, useLayoutEffect, useState } from 'react';

export type ImageTone = {
  /** 카드 바탕 */
  bg: string;
  /** 카드 테두리(바탕보다 살짝 진하게) */
  line: string;
  /** 한 줄 정보 글자(바탕 색상을 머금은 진한 회색) */
  sub: string;
};

const STORE_KEY = 'ft-image-tone-v2';
const MAX_STORE = 240;
const memory = new Map<string, ImageTone | null>();
const pending = new Map<string, Promise<ImageTone | null>>();
let storeLoaded = false;
let saveTimer = 0;

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function toneKey(src: string) {
  return src.split('?')[0];
}

function loadStore() {
  if (storeLoaded || typeof window === 'undefined') return;
  storeLoaded = true;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const saved = raw ? JSON.parse(raw) : null;
    if (saved && typeof saved === 'object') {
      Object.entries(saved).forEach(([k, v]) => {
        const t = v as ImageTone;
        if (t && typeof t.bg === 'string' && typeof t.line === 'string' && typeof t.sub === 'string') memory.set(k, t);
      });
    }
  } catch { /* 저장소 막힘 — 메모리만 */ }
}

function saveStore() {
  if (typeof window === 'undefined') return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      const entries = Array.from(memory.entries()).filter(([, v]) => v).slice(-MAX_STORE);
      localStorage.setItem(STORE_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch { /* 가득 참·막힘 — 다음에 다시 뽑는다 */ }
  }, 500);
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

const hsl = (h: number, s: number, l: number) =>
  `hsl(${Math.round(h)}, ${Math.round(Math.max(0, Math.min(1, s)) * 100)}%, ${Math.round(Math.max(0, Math.min(1, l)) * 1000) / 10}%)`;

/** 평균 배경색 → 카드 색 세 가지 */
export function toneFromRgb(r: number, g: number, b: number): ImageTone {
  const [h, s, l] = rgbToHsl(r, g, b);
  const gray = s < 0.07;
  // 색이 있는 배경은 색상을 살려 채도 18~50%, 무채색은 그대로(살짝 푸른 회색으로 — 앱 회색 톤과 맞게)
  const hue = gray ? 214 : h;
  const sat = gray ? 0.1 : Math.min(0.5, Math.max(0.18, s * 0.85));
  // 밝은 배경일수록 조금 더 밝게(0.885~0.935) — 어두운 사진도 글자 영역은 밝은 파스텔
  const light = gray ? 0.94 : 0.885 + Math.max(0, Math.min(0.05, (l - 0.45) * 0.1));
  return {
    bg: hsl(hue, sat, light),
    line: hsl(hue, Math.min(0.6, sat + 0.05), light - 0.06),
    sub: hsl(hue, Math.min(sat, 0.2), 0.34),
  };
}

/** 뚜렷한 색(파스텔로 만들 색상·채도) → 카드 색 세 가지 */
function toneFromHue(h: number, s: number): ImageTone {
  const sat = Math.min(0.55, Math.max(0.2, s * 0.85));
  const light = 0.9;
  return {
    bg: hsl(h, sat, light),
    line: hsl(h, Math.min(0.6, sat + 0.05), light - 0.06),
    sub: hsl(h, Math.min(sat, 0.22), 0.34),
  };
}

function computeTone(img: HTMLImageElement): ImageTone | null {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (!iw || !ih) return null;
  const W = 30;
  const H = 38; // 4:5 에 가깝게
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings);
  if (!ctx) return null;
  // 카드와 같은 자르기(4:5 cover, 세로 위치 20%)
  const ar = 4 / 5;
  let sw = iw;
  let sh = iw / ar;
  if (sh > ih) { sh = ih; sw = ih * ar; }
  const sx = (iw - sw) / 2;
  const sy = (ih - sh) * 0.2;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
  const { data } = ctx.getImageData(0, 0, W, H); // 다른 출처가 막히면 여기서 throw → null

  // 볼 곳 = 아래 절반(옷·아래 배경 — 카드 색으로 녹아드는 자리) + 위쪽 가장자리(배경). 얼굴이 있는 위 가운데는 뺀다(피부색이 모두를 살구색으로 만든다)
  // 색마다(15° 칸) '얼마나 뚜렷한가'(채도 × 알맞은 밝기)를 모아 가장 많이 보이는 뚜렷한 색을 고른다 — 핑크 재킷이면 핑크, 남색 정장이면 옅은 하늘, 베이지 배경이면 베이지.
  // 뚜렷한 색이 거의 없으면(검은 정장 + 회색 배경) 가장자리 평균색으로 옅은 회색 계열.
  const BINS = 24;
  const weight = new Array(BINS).fill(0);
  const satSum = new Array(BINS).fill(0);
  const hueX = new Array(BINS).fill(0);
  const hueY = new Array(BINS).fill(0);
  let er = 0, eg = 0, eb = 0, en = 0;
  let n = 0;
  const upper = Math.round(H * 0.45);
  const edgeTop = Math.round(H * 0.12);
  const side = 4;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const edge = x < side || x >= W - side || y < edgeTop;
      if (y < upper && !edge) continue;
      const i = (y * W + x) * 4;
      if (data[i + 3] < 200) continue;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (edge && y < Math.round(H * 0.7)) { er += r; eg += g; eb += b; en++; }
      const [h, sat, l] = rgbToHsl(r, g, b);
      n++;
      const w = sat * Math.max(0, 1 - Math.abs(l - 0.55) * 1.6);
      if (w <= 0) continue;
      const bin = Math.floor(h / (360 / BINS)) % BINS;
      weight[bin] += w;
      satSum[bin] += sat * w;
      const rad = (h * Math.PI) / 180;
      hueX[bin] += Math.cos(rad) * w;
      hueY[bin] += Math.sin(rad) * w;
    }
  }
  if (n < 40) return null;
  // 이웃 칸까지 반 무게로 더해 가장 큰 칸
  let best = -1;
  let bestScore = 0;
  for (let b = 0; b < BINS; b++) {
    const score = weight[b] + 0.5 * (weight[(b + BINS - 1) % BINS] + weight[(b + 1) % BINS]);
    if (score > bestScore) { bestScore = score; best = b; }
  }
  if (best >= 0 && bestScore / n > 0.045) {
    const around = [(best + BINS - 1) % BINS, best, (best + 1) % BINS];
    let wx = 0, wy = 0, ws = 0, wsum = 0;
    around.forEach((b) => { wx += hueX[b]; wy += hueY[b]; ws += satSum[b]; wsum += weight[b]; });
    const hue = ((Math.atan2(wy, wx) * 180) / Math.PI + 360) % 360;
    return toneFromHue(hue, wsum > 0 ? ws / wsum : 0.3);
  }
  if (en < 20) return null;
  return toneFromRgb(er / en, eg / en, eb / en);
}

/** 기억해 둔 색(없으면 null) — 첫 그림에 바로 입힐 때 */
export function peekImageTone(src?: string | null): ImageTone | null {
  if (!src) return null;
  loadStore();
  return memory.get(toneKey(src)) ?? null;
}

export function getImageTone(src: string): Promise<ImageTone | null> {
  loadStore();
  const k = toneKey(src);
  if (memory.has(k)) return Promise.resolve(memory.get(k) ?? null);
  const running = pending.get(k);
  if (running) return running;
  const job = new Promise<ImageTone | null>((resolve) => {
    const img = new Image();
    try {
      if (new URL(src, window.location.href).origin !== window.location.origin) img.crossOrigin = 'anonymous';
    } catch { /* 이상한 주소 — 그대로 시도 */ }
    img.decoding = 'async';
    img.onload = () => {
      try { resolve(computeTone(img)); } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  }).then((tone) => {
    memory.set(k, tone);
    pending.delete(k);
    if (tone) saveStore();
    return tone;
  });
  pending.set(k, job);
  return job;
}

/** 사진 색 — 기억해 둔 게 있으면 그리기 전에 바로, 없으면 사진을 읽은 뒤 */
export function useImageTone(src?: string | null): ImageTone | null {
  const [tone, setTone] = useState<ImageTone | null>(null);
  useIsoLayoutEffect(() => {
    if (!src) { setTone(null); return; }
    const hit = peekImageTone(src);
    if (hit) { setTone(hit); return; }
    let alive = true;
    getImageTone(src).then((t) => { if (alive) setTone(t); });
    return () => { alive = false; };
  }, [src]);
  return tone;
}
