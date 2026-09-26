import { Injectable, Logger } from '@nestjs/common';
import * as sharp from 'sharp';
import { PrismaService } from '../prisma/prisma.service';

/**
 * 사진 색 — 홈 카드 바탕색(260926 사장 "사진 색을 추출해서 자연스럽게 이어지게", 웨딩 파트너 카드도 같은 결).
 * 업체 사진은 대부분 네이버·카카오 블로그 같은 외부 주소라 브라우저 canvas 로는 못 읽는다(교차 출처) → 서버가 대신 받아 작게 줄여 색을 뽑는다.
 *  · 받는 주소는 등록된 업체 사진(business_images.imageUrl)만 — 아무 주소나 대신 받아 주는 창구가 되지 않게.
 *  · 알고리즘은 웹 lib/image-tone 과 같다: 가장 많이 보이는 뚜렷한 색(채도 × 알맞은 밝기, 15° 칸) → 명도 90% 파스텔, 없으면 평균색 옅은 회색.
 *    scene(가로 16:9 가운데, 전체를 보되 아래쪽 가중) / portrait(4:5 위쪽, 얼굴 쪽 가운데 위 제외).
 *  · 결과는 메모리에 기억(같은 사진 동시 요청은 한 번만).
 */
export type ImageTone = { bg: string; line: string; sub: string };
export type ToneMode = 'scene' | 'portrait';

const MAX_BYTES = 12 * 1024 * 1024;
const CACHE_MAX = 3000;

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

function toneFromHue(h: number, s: number): ImageTone {
  const sat = Math.min(0.55, Math.max(0.2, s * 0.85));
  const light = 0.9;
  return { bg: hsl(h, sat, light), line: hsl(h, Math.min(0.6, sat + 0.05), light - 0.06), sub: hsl(h, Math.min(sat, 0.22), 0.34) };
}

function toneFromRgb(r: number, g: number, b: number): ImageTone {
  const [h, s, l] = rgbToHsl(r, g, b);
  const gray = s < 0.07;
  const hue = gray ? 214 : h;
  const sat = gray ? 0.1 : Math.min(0.5, Math.max(0.18, s * 0.85));
  const light = gray ? 0.94 : 0.885 + Math.max(0, Math.min(0.05, (l - 0.45) * 0.1));
  return { bg: hsl(hue, sat, light), line: hsl(hue, Math.min(0.6, sat + 0.05), light - 0.06), sub: hsl(hue, Math.min(sat, 0.2), 0.34) };
}

/** 픽셀(RGB 3채널) → 카드 색 */
export function toneFromPixels(data: Buffer | Uint8Array, W: number, H: number, channels: number, mode: ToneMode): ImageTone | null {
  const BINS = 24;
  const weight = new Array(BINS).fill(0);
  const satSum = new Array(BINS).fill(0);
  const hueX = new Array(BINS).fill(0);
  const hueY = new Array(BINS).fill(0);
  let ar = 0, ag = 0, ab = 0, an = 0;
  let n = 0;
  const upper = Math.round(H * 0.45);
  const edgeTop = Math.round(H * 0.12);
  const side = Math.max(2, Math.round(W * 0.13));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const edge = x < side || x >= W - side || y < edgeTop;
      if (mode === 'portrait' && y < upper && !edge) continue; // 얼굴 쪽 가운데 위는 뺀다
      const i = (y * W + x) * channels;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      // 가로 사진은 사진이 녹아드는 아래쪽을 더 크게 본다
      const k = mode === 'scene' && y >= H / 2 ? 1.5 : 1;
      if (mode === 'scene' || (edge && y < Math.round(H * 0.7))) { ar += r * k; ag += g * k; ab += b * k; an += k; }
      const [h, s, l] = rgbToHsl(r, g, b);
      n += k;
      const w = s * Math.max(0, 1 - Math.abs(l - 0.55) * 1.6) * k;
      if (w <= 0) continue;
      const bin = Math.floor(h / (360 / BINS)) % BINS;
      weight[bin] += w;
      satSum[bin] += s * w;
      const rad = (h * Math.PI) / 180;
      hueX[bin] += Math.cos(rad) * w;
      hueY[bin] += Math.sin(rad) * w;
    }
  }
  if (n < 40) return null;
  let best = -1;
  let bestScore = 0;
  for (let b = 0; b < BINS; b++) {
    const score = weight[b] + 0.5 * (weight[(b + BINS - 1) % BINS] + weight[(b + 1) % BINS]);
    if (score > bestScore) { bestScore = score; best = b; }
  }
  if (best >= 0 && bestScore / n > 0.045) {
    let wx = 0, wy = 0, ws = 0, wsum = 0;
    [(best + BINS - 1) % BINS, best, (best + 1) % BINS].forEach((b) => { wx += hueX[b]; wy += hueY[b]; ws += satSum[b]; wsum += weight[b]; });
    const hue = ((Math.atan2(wy, wx) * 180) / Math.PI + 360) % 360;
    return toneFromHue(hue, wsum > 0 ? ws / wsum : 0.3);
  }
  if (an <= 0) return null;
  return toneFromRgb(ar / an, ag / an, ab / an);
}

@Injectable()
export class BusinessImageToneService {
  private readonly logger = new Logger(BusinessImageToneService.name);
  private readonly cache = new Map<string, ImageTone | null>();
  private readonly inflight = new Map<string, Promise<ImageTone | null>>();
  private allow: { at: number; urls: Set<string> } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** 등록된 업체 사진 주소인지(10분마다 새로) */
  private async isKnownImage(src: string) {
    if (!this.allow || Date.now() - this.allow.at > 10 * 60 * 1000) {
      const rows = await this.prisma.businessImage.findMany({ select: { imageUrl: true } });
      this.allow = { at: Date.now(), urls: new Set(rows.map((r) => r.imageUrl)) };
    }
    return this.allow.urls.has(src);
  }

  async getTone(src: string, mode: ToneMode): Promise<{ tone: ImageTone | null; known: boolean }> {
    if (!/^https?:\/\//i.test(src) || src.length > 2000) return { tone: null, known: false };
    if (!(await this.isKnownImage(src))) return { tone: null, known: false };
    const key = `${mode}|${src}`;
    if (this.cache.has(key)) return { tone: this.cache.get(key) ?? null, known: true };
    const running = this.inflight.get(key);
    if (running) return { tone: await running, known: true };
    const job = this.compute(src, mode)
      .catch((error) => {
        this.logger.warn(`image tone failed: ${String(error?.message || error).slice(0, 120)}`);
        return null;
      })
      .then((tone) => {
        if (this.cache.size >= CACHE_MAX) this.cache.delete(this.cache.keys().next().value as string);
        this.cache.set(key, tone);
        return tone;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, job);
    return { tone: await job, known: true };
  }

  private async download(src: string, referer?: string): Promise<Buffer | null> {
    const res = await fetch(src, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FreetifulImageTone/1.0)',
        Accept: 'image/avif,image/webp,image/*,*/*;q=0.8',
        ...(referer ? { Referer: referer } : {}),
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    if (type && !type.startsWith('image/') && !type.includes('octet-stream')) return null;
    const size = Number(res.headers.get('content-length') || 0);
    if (size > MAX_BYTES) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 0 && buf.length <= MAX_BYTES ? buf : null;
  }

  private async compute(src: string, mode: ToneMode): Promise<ImageTone | null> {
    // 네이버 블로그 사진은 출처(Referer) 없이 막히는 경우가 있어 한 번 더
    const buf = (await this.download(src)) || (/pstatic\.net/i.test(src) ? await this.download(src, 'https://blog.naver.com/') : null);
    if (!buf) return null;
    const [W, H] = mode === 'portrait' ? [30, 38] : [32, 18];
    const { data, info } = await sharp(buf, { failOn: 'none' })
      .rotate()
      .resize(W, H, { fit: 'cover', position: mode === 'portrait' ? 'north' : 'centre' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return toneFromPixels(data, info.width, info.height, info.channels, mode);
  }
}
