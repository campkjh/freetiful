// 웨딩런 코드로 그린 그래픽 (261011 사장 '웨딩런' — 사양서 [2] '부족한 기능은 코드로 보완', 이모지·기본 도형 대체 금지)
//  · 첨부 이미지에 없는 것만: 하트·축의금 봉투(수집), 꽃잎·반짝임·먼지·빛(효과), 보호막, 신혼집(도착 표지), 연습 말풍선, 바닥 틈 그늘.
//  · 색은 연보라·아이보리·연핑크(사양서 [1]), 외곽선은 첨부 그림처럼 진한 보라 갈색 계열로 부드럽게.
import type * as PhaserNS from 'phaser';

type Scene = PhaserNS.Scene;

export const TEX = {
  heart: 'wr-heart',
  envelope: 'wr-envelope',
  petal: 'wr-petal',
  sparkle: 'wr-sparkle',
  dust: 'wr-dust',
  glow: 'wr-glow',
  shield: 'wr-shield',
  house: 'wr-house',
  houseLit: 'wr-house-lit',
  hintJump: 'wr-hint-jump',
  hintSlide: 'wr-hint-slide',
  pit: 'wr-pit',
  white: 'wr-white',
  warm: 'wr-warm',
  // (261011 사장 기믹 — 새 그림 없이 코드로) 번개·전기 띠·말풍선·리본·경고 아이콘·땅 번개 표시·호통·그림자·눈빛·카운트다운·좌석벨트·바람·종이·2단 고리
  bolt: 'wr-g-bolt',
  zap: 'wr-g-zap',
  ribbon: 'wr-g-ribbon',
  warnGround: 'wr-warn-ground',
  warnHead: 'wr-warn-head',
  warnSky: 'wr-warn-sky',
  boltMark: 'wr-bolt-mark',
  shout: 'wr-shout',
  shadow: 'wr-shadow',
  eyes: 'wr-eyes',
  seatbelt: 'wr-seatbelt',
  wind: 'wr-wind',
  paper: 'wr-paper',
  ring: 'wr-ring',
} as const;

/** 잔소리 말풍선(문구별) 텍스처 키 */
export const bubbleKey = (i: number) => `wr-g-bubble-${i}`;
/** 카운트다운 숫자 */
export const countKey = (n: number) => `wr-count-${n}`;
/** 기믹 첫 등장 안내 말풍선(문구별) — makeTextures 가 hintKeys 로 돌려줌 */
const hintKeyMap = new Map<string, string>();
export const hintKeyOf = (text: string) => hintKeyMap.get(text) ?? TEX.hintJump;

const FONT = '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif';
const LINE = '#6E557F'; // 첨부 그림 외곽선 톤(보라 갈색)

function canvas(scene: Scene, key: string, w: number, h: number): CanvasRenderingContext2D | null {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const t = scene.textures.createCanvas(key, w, h);
  if (!t) return null;
  return t.getContext();
}
function done(scene: Scene, key: string) {
  const t = scene.textures.get(key) as PhaserNS.Textures.CanvasTexture;
  t.refresh();
}

function heartPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // (x,y) = 위 가운데 홈, w×h 상자
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.27);
  ctx.bezierCurveTo(x, y, x - w / 2, y, x - w / 2, y + h * 0.3);
  ctx.bezierCurveTo(x - w / 2, y + h * 0.58, x - w * 0.12, y + h * 0.78, x, y + h);
  ctx.bezierCurveTo(x + w * 0.12, y + h * 0.78, x + w / 2, y + h * 0.58, x + w / 2, y + h * 0.3);
  ctx.bezierCurveTo(x + w / 2, y, x, y, x, y + h * 0.27);
  ctx.closePath();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 하트(수집 +10) — 연핑크 그라데이션 + 흰 테 + 윤기 */
function makeHeart(scene: Scene) {
  const S = 96;
  const ctx = canvas(scene, TEX.heart, S, S);
  if (!ctx) return;
  const x = S / 2;
  const y = 14;
  const w = 76;
  const h = 70;
  ctx.shadowColor = 'rgba(255,120,170,0.55)';
  ctx.shadowBlur = 8;
  heartPath(ctx, x, y, w, h);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#FFB3CF');
  g.addColorStop(0.55, '#FF7FAE');
  g.addColorStop(1, '#F25C93');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#FFFFFF';
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(190,70,120,0.55)';
  heartPath(ctx, x, y - 1, w + 7, h + 7);
  ctx.stroke();
  // 윤기
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(x - 17, y + 20, 9, 6, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - 5, y + 13, 3, 0, Math.PI * 2);
  ctx.fill();
  done(scene, TEX.heart);
}

/** 축의금 봉투(수집 +30) — 아이보리 봉투 + 금색 테 + 분홍 '祝' 봉인 */
function makeEnvelope(scene: Scene) {
  const W = 112;
  const H = 84;
  const ctx = canvas(scene, TEX.envelope, W, H);
  if (!ctx) return;
  ctx.shadowColor = 'rgba(200,150,90,0.45)';
  ctx.shadowBlur = 7;
  roundRect(ctx, 8, 10, W - 16, H - 20, 9);
  const g = ctx.createLinearGradient(0, 10, 0, H - 10);
  g.addColorStop(0, '#FFFDF7');
  g.addColorStop(1, '#F6EBDD');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = '#D9B26A';
  ctx.stroke();
  // 덮개 V
  ctx.beginPath();
  ctx.moveTo(12, 14);
  ctx.lineTo(W / 2, H / 2 + 4);
  ctx.lineTo(W - 12, 14);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#E2C48C';
  ctx.stroke();
  // 봉인
  ctx.beginPath();
  ctx.arc(W / 2, H / 2 + 4, 15, 0, Math.PI * 2);
  const sg = ctx.createRadialGradient(W / 2 - 4, H / 2, 2, W / 2, H / 2 + 4, 15);
  sg.addColorStop(0, '#FF8FB3');
  sg.addColorStop(1, '#E2557F');
  ctx.fillStyle = sg;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#FFFFFF';
  ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 17px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('祝', W / 2, H / 2 + 5);
  done(scene, TEX.envelope);
}

function makePetal(scene: Scene) {
  const ctx = canvas(scene, TEX.petal, 28, 20);
  if (!ctx) return;
  ctx.beginPath();
  ctx.moveTo(2, 10);
  ctx.bezierCurveTo(8, 0, 22, 0, 26, 7);
  ctx.lineTo(22, 10);
  ctx.lineTo(26, 13);
  ctx.bezierCurveTo(22, 20, 8, 20, 2, 10);
  ctx.closePath();
  const g = ctx.createLinearGradient(2, 0, 26, 20);
  g.addColorStop(0, '#FFE0EA');
  g.addColorStop(1, '#FF9FBF');
  ctx.fillStyle = g;
  ctx.fill();
  done(scene, TEX.petal);
}

function makeSparkle(scene: Scene) {
  const S = 48;
  const ctx = canvas(scene, TEX.sparkle, S, S);
  if (!ctx) return;
  const c = S / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,240,200,0.9)');
  g.addColorStop(1, 'rgba(255,220,240,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(c, 0);
  ctx.quadraticCurveTo(c + 4, c - 4, S, c);
  ctx.quadraticCurveTo(c + 4, c + 4, c, S);
  ctx.quadraticCurveTo(c - 4, c + 4, 0, c);
  ctx.quadraticCurveTo(c - 4, c - 4, c, 0);
  ctx.fill();
  done(scene, TEX.sparkle);
}

function makeDust(scene: Scene) {
  const S = 40;
  const ctx = canvas(scene, TEX.dust, S, S);
  if (!ctx) return;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,250,255,0.95)');
  g.addColorStop(0.6, 'rgba(236,224,246,0.7)');
  g.addColorStop(1, 'rgba(236,224,246,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  done(scene, TEX.dust);
}

function makeGlow(scene: Scene) {
  const S = 128;
  const ctx = canvas(scene, TEX.glow, S, S);
  if (!ctx) return;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,245,252,0.6)');
  g.addColorStop(1, 'rgba(255,240,250,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  done(scene, TEX.glow);
  const ctx2 = canvas(scene, TEX.warm, S, S);
  if (!ctx2) return;
  const g2 = ctx2.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g2.addColorStop(0, 'rgba(255,226,150,0.95)');
  g2.addColorStop(0.45, 'rgba(255,214,160,0.45)');
  g2.addColorStop(1, 'rgba(255,200,170,0)');
  ctx2.fillStyle = g2;
  ctx2.fillRect(0, 0, S, S);
  done(scene, TEX.warm);
}

/** 커플 응원 보호막 — 비눗방울 같은 연핑크 테 */
function makeShield(scene: Scene) {
  const S = 256;
  const ctx = canvas(scene, TEX.shield, S, S);
  if (!ctx) return;
  const c = S / 2;
  const g = ctx.createRadialGradient(c, c, c * 0.55, c, c, c);
  g.addColorStop(0, 'rgba(255,230,245,0)');
  g.addColorStop(0.7, 'rgba(255,200,230,0.18)');
  g.addColorStop(0.92, 'rgba(255,170,215,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c, c, c, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(c, c, c - 8, Math.PI * 1.1, Math.PI * 1.45);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(c, c, c - 8, Math.PI * 1.55, Math.PI * 1.62);
  ctx.stroke();
  done(scene, TEX.shield);
}

/** 신혼집 도착 표지(창문 꺼짐/켜짐 두 장) — 연보라 지붕·아이보리 벽·분홍 문·'우리집' 팻말 */
function makeHouse(scene: Scene, lit: boolean) {
  const W = 300;
  const H = 300;
  const key = lit ? TEX.houseLit : TEX.house;
  const ctx = canvas(scene, key, W, H);
  if (!ctx) return;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // 굴뚝
  roundRect(ctx, 196, 44, 30, 62, 6);
  ctx.fillStyle = '#F4B9CF';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = LINE;
  ctx.stroke();
  // 벽
  roundRect(ctx, 52, 128, 196, 162, 14);
  const wg = ctx.createLinearGradient(0, 128, 0, 290);
  wg.addColorStop(0, '#FFFBF4');
  wg.addColorStop(1, '#F7ECE0');
  ctx.fillStyle = wg;
  ctx.fill();
  ctx.stroke();
  // 지붕
  ctx.beginPath();
  ctx.moveTo(26, 146);
  ctx.quadraticCurveTo(22, 136, 32, 128);
  ctx.lineTo(140, 40);
  ctx.quadraticCurveTo(150, 32, 160, 40);
  ctx.lineTo(268, 128);
  ctx.quadraticCurveTo(278, 136, 274, 146);
  ctx.closePath();
  const rg = ctx.createLinearGradient(0, 36, 0, 146);
  rg.addColorStop(0, '#CDBDF0');
  rg.addColorStop(1, '#A992DA');
  ctx.fillStyle = rg;
  ctx.fill();
  ctx.stroke();
  // 지붕 하트 창
  heartPath(ctx, 150, 78, 34, 30);
  ctx.fillStyle = lit ? '#FFE48F' : '#E9DDF8';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.stroke();
  // 창문 두 개
  const win = (x: number) => {
    roundRect(ctx, x, 168, 46, 42, 8);
    if (lit) {
      const g = ctx.createRadialGradient(x + 23, 189, 2, x + 23, 189, 30);
      g.addColorStop(0, '#FFF6C8');
      g.addColorStop(1, '#FFD36E');
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = '#A99CC4';
    }
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 23, 170);
    ctx.lineTo(x + 23, 208);
    ctx.moveTo(x + 2, 189);
    ctx.lineTo(x + 44, 189);
    ctx.lineWidth = 3;
    ctx.stroke();
  };
  win(70);
  win(184);
  // 문
  ctx.beginPath();
  ctx.moveTo(122, 290);
  ctx.lineTo(122, 222);
  ctx.quadraticCurveTo(122, 196, 150, 196);
  ctx.quadraticCurveTo(178, 196, 178, 222);
  ctx.lineTo(178, 290);
  ctx.closePath();
  const dg = ctx.createLinearGradient(0, 196, 0, 290);
  dg.addColorStop(0, '#FFB8D0');
  dg.addColorStop(1, '#F28DB2');
  ctx.fillStyle = dg;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.stroke();
  heartPath(ctx, 150, 214, 22, 20);
  ctx.fillStyle = lit ? '#FFF2B0' : '#FFE3EE';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(169, 258, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#E9C46A';
  ctx.fill();
  // 팻말
  roundRect(ctx, 104, 132, 92, 30, 15);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#E58BAE';
  ctx.stroke();
  ctx.fillStyle = '#D5487D';
  ctx.font = `800 19px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('우리집 ♥', 150, 148);
  done(scene, key);
}

/** 연습 장애물 위 말풍선('점프!'·'슬라이드!') */
function makeHint(scene: Scene, key: string, text: string, color: string) {
  // 글자 길이에 맞춰 폭(기믹 안내 '파도는 슬라이드!' 처럼 긴 문구도 눌리지 않게)
  let W = 220;
  try {
    const m = document.createElement('canvas').getContext('2d');
    if (m) {
      m.font = `800 34px ${FONT}`;
      W = Math.max(220, Math.ceil(m.measureText(text).width) + 64);
    }
  } catch {
    /* 측정 불가 — 기본 폭 */
  }
  const H = 96;
  const ctx = canvas(scene, key, W, H);
  if (!ctx) return;
  ctx.font = `800 34px ${FONT}`;
  const tw = Math.min(W - 20, ctx.measureText(text).width + 40);
  const x = (W - tw) / 2;
  ctx.shadowColor = 'rgba(110,85,127,0.35)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  roundRect(ctx, x, 6, tw, 58, 29);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.lineWidth = 4;
  ctx.strokeStyle = color;
  ctx.stroke();
  // 아래 꼬리(장애물 쪽)
  ctx.beginPath();
  ctx.moveTo(W / 2 - 12, 62);
  ctx.lineTo(W / 2, 84);
  ctx.lineTo(W / 2 + 12, 62);
  ctx.closePath();
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(W / 2 - 12, 64);
  ctx.lineTo(W / 2, 84);
  ctx.lineTo(W / 2 + 12, 64);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, 36);
  done(scene, key);
}

function makePit(scene: Scene) {
  const ctx = canvas(scene, TEX.pit, 8, 128);
  if (!ctx) return;
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, 'rgba(80,58,118,0.15)');
  g.addColorStop(0.25, 'rgba(62,44,96,0.6)');
  g.addColorStop(1, 'rgba(38,26,64,0.9)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 128);
  done(scene, TEX.pit);
}

function makeWhite(scene: Scene) {
  const ctx = canvas(scene, TEX.white, 4, 4);
  if (!ctx) return;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, 4, 4);
  done(scene, TEX.white);
}

export function makeTextures(scene: Scene, hint: { jump: string; slide: string }) {
  makeHeart(scene);
  makeEnvelope(scene);
  makePetal(scene);
  makeSparkle(scene);
  makeDust(scene);
  makeGlow(scene);
  makeShield(scene);
  makeHouse(scene, false);
  makeHouse(scene, true);
  makeHint(scene, TEX.hintJump, hint.jump, '#E2557F');
  makeHint(scene, TEX.hintSlide, hint.slide, '#7E68B0');
  makePit(scene);
  makeWhite(scene);
}

/* ───────── 기믹 그림(261011 사장 기믹 — 새 그림 없이 코드로, 이모지 대신 도형) ───────── */

function boltPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // 번개 모양(위 → 아래 지그재그)
  ctx.beginPath();
  ctx.moveTo(x + w * 0.62, y);
  ctx.lineTo(x + w * 0.12, y + h * 0.56);
  ctx.lineTo(x + w * 0.46, y + h * 0.56);
  ctx.lineTo(x + w * 0.3, y + h);
  ctx.lineTo(x + w * 0.9, y + h * 0.38);
  ctx.lineTo(x + w * 0.54, y + h * 0.38);
  ctx.lineTo(x + w * 0.78, y);
  ctx.closePath();
}

/** 시어머니의 벼락 — 위에서 아래로 긴 번개(노랑·흰 심) */
function makeBolt(scene: Scene) {
  const W = 44;
  const H = 400;
  const ctx = canvas(scene, TEX.bolt, W, H);
  if (!ctx) return;
  const pts: Array<[number, number]> = [];
  let x = W / 2;
  for (let y = 0; y <= H; y += 26) {
    pts.push([x, y]);
    x = W / 2 + (Math.random() - 0.5) * 22;
  }
  pts[pts.length - 1] = [W / 2, H];
  const line = (w: number, color: string, blur: number) => {
    ctx.save();
    ctx.shadowColor = '#FFE36B';
    ctx.shadowBlur = blur;
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.stroke();
    ctx.restore();
  };
  line(14, 'rgba(255,214,90,0.55)', 14);
  line(7, '#FFD84D', 8);
  line(3, '#FFFFFF', 0);
  done(scene, TEX.bolt);
}

/** 가전 바닥 전기 — 가로로 긴 띠(잘라서 씀, 최대 폭 640): 하늘색 전류 + 노란 불꽃 */
function makeZap(scene: Scene) {
  const W = 640;
  const H = 34;
  const ctx = canvas(scene, TEX.zap, W, H);
  if (!ctx) return;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(120,220,255,0)');
  g.addColorStop(0.45, 'rgba(120,220,255,0.55)');
  g.addColorStop(1, 'rgba(90,170,255,0.25)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 6, W, H - 6);
  const wave = (amp: number, w: number, color: string, phase: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let x = 0; x <= W; x += 8) {
      const y = H * 0.62 + Math.sin(x * 0.21 + phase) * amp + (Math.random() - 0.5) * amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  ctx.shadowColor = '#8FE8FF';
  ctx.shadowBlur = 8;
  wave(6, 3, '#BFF3FF', 0);
  wave(4, 2, '#FFFFFF', 1.7);
  ctx.shadowBlur = 0;
  // 불꽃 점
  for (let x = 12; x < W; x += 46) {
    ctx.fillStyle = '#FFE36B';
    boltPath(ctx, x, 4, 12, 18);
    ctx.fill();
  }
  done(scene, TEX.zap);
}

/** 잔소리 말풍선(흰 바탕·보라 테·꼬리는 아래 왼쪽) */
function makeBubble(scene: Scene, key: string, text: string) {
  const W = 78;
  const H = 52;
  const ctx = canvas(scene, key, W, H);
  if (!ctx) return;
  ctx.shadowColor = 'rgba(110,85,127,0.35)';
  ctx.shadowBlur = 5;
  roundRect(ctx, 3, 3, W - 6, H - 14, 16);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#8A6FB8';
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(18, H - 12);
  ctx.lineTo(12, H - 2);
  ctx.lineTo(28, H - 12);
  ctx.closePath();
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#5B437A';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let fs = 17;
  ctx.font = `800 ${fs}px ${FONT}`;
  while (ctx.measureText(text).width > W - 16 && fs > 10) {
    fs--;
    ctx.font = `800 ${fs}px ${FONT}`;
  }
  ctx.fillText(text, W / 2, (H - 12) / 2 + 2);
  done(scene, key);
}

/** 박수 꽃가루 리본(가로 줄 + 꽃잎) */
function makeRibbon(scene: Scene) {
  const W = 84;
  const H = 40;
  const ctx = canvas(scene, TEX.ribbon, W, H);
  if (!ctx) return;
  ctx.strokeStyle = '#E58BAE';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(2, 8);
  ctx.quadraticCurveTo(W / 2, 26, W - 2, 8);
  ctx.stroke();
  const cols = ['#FFB3CF', '#FFE48F', '#CDBDF0', '#BFF3D8'];
  for (let i = 0; i < 7; i++) {
    const x = 8 + i * 11.5;
    const y = 12 + Math.sin((i / 6) * Math.PI) * 12;
    ctx.fillStyle = cols[i % cols.length];
    ctx.beginPath();
    ctx.moveTo(x - 6, y);
    ctx.lineTo(x + 6, y);
    ctx.lineTo(x, y + 14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(110,85,127,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  done(scene, TEX.ribbon);
}

/** 화면 오른쪽 끝 경고 아이콘(땅 = 분홍 '!', 머리 = 노랑 번개, 하늘 = 파랑 그림자) */
function makeWarn(scene: Scene, key: string, kind: 'ground' | 'head' | 'sky') {
  const S = 64;
  const ctx = canvas(scene, key, S, S);
  if (!ctx) return;
  const c = S / 2;
  const fill = kind === 'ground' ? '#FF7FAE' : kind === 'head' ? '#FFD84D' : '#8FC8FF';
  ctx.shadowColor = 'rgba(60,40,90,0.45)';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(c, c, c - 6, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#FFFFFF';
  ctx.stroke();
  ctx.fillStyle = kind === 'head' ? '#7A4A00' : '#FFFFFF';
  if (kind === 'ground') {
    roundRect(ctx, c - 4, 16, 8, 22, 4);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(c, 45, 4.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'head') {
    boltPath(ctx, c - 11, 13, 22, 38);
    ctx.fill();
  } else {
    // 아래 화살표 + 그림자
    ctx.beginPath();
    ctx.moveTo(c - 10, 18);
    ctx.lineTo(c + 10, 18);
    ctx.lineTo(c + 10, 28);
    ctx.lineTo(c + 17, 28);
    ctx.lineTo(c, 42);
    ctx.lineTo(c - 17, 28);
    ctx.lineTo(c - 10, 28);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.ellipse(c, 49, 13, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  done(scene, key);
}

/** 땅 번개 표시(번개가 떨어질 자리) */
function makeBoltMark(scene: Scene) {
  const W = 56;
  const H = 40;
  const ctx = canvas(scene, TEX.boltMark, W, H);
  if (!ctx) return;
  const g = ctx.createRadialGradient(W / 2, H - 8, 2, W / 2, H - 8, 26);
  g.addColorStop(0, 'rgba(255,230,110,0.85)');
  g.addColorStop(1, 'rgba(255,230,110,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#FFD84D';
  ctx.strokeStyle = '#7A4A00';
  ctx.lineWidth = 2;
  boltPath(ctx, W / 2 - 9, 3, 18, 32);
  ctx.fill();
  ctx.stroke();
  done(scene, TEX.boltMark);
}

/** 시어머니 호통 '!!' */
function makeShout(scene: Scene) {
  const W = 70;
  const H = 48;
  const ctx = canvas(scene, TEX.shout, W, H);
  if (!ctx) return;
  ctx.shadowColor = 'rgba(110,40,60,0.35)';
  ctx.shadowBlur = 5;
  roundRect(ctx, 4, 4, W - 8, H - 12, 14);
  ctx.fillStyle = '#FFF2F5';
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#E2557F';
  ctx.stroke();
  ctx.fillStyle = '#E2557F';
  ctx.font = `900 24px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('호통!', W / 2, (H - 8) / 2 + 1);
  done(scene, TEX.shout);
}

function makeShadow(scene: Scene) {
  const W = 120;
  const H = 30;
  const ctx = canvas(scene, TEX.shadow, W, H);
  if (!ctx) return;
  const g = ctx.createRadialGradient(W / 2, H / 2, 2, W / 2, H / 2, W / 2);
  g.addColorStop(0, 'rgba(50,30,80,0.5)');
  g.addColorStop(1, 'rgba(50,30,80,0)');
  ctx.fillStyle = g;
  ctx.save();
  ctx.scale(1, H / W);
  ctx.beginPath();
  ctx.arc(W / 2, W / 2, W / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  done(scene, TEX.shadow);
}

/** 고양이 눈빛(노란 점 두 개) */
function makeEyes(scene: Scene) {
  const W = 48;
  const H = 22;
  const ctx = canvas(scene, TEX.eyes, W, H);
  if (!ctx) return;
  for (const x of [14, 34]) {
    const g = ctx.createRadialGradient(x, 11, 0, x, 11, 10);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(0.35, '#FFE36B');
    g.addColorStop(1, 'rgba(255,227,107,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 11, 0, 22, 22);
  }
  done(scene, TEX.eyes);
}

function makeCount(scene: Scene, n: number) {
  const S = 44;
  const key = countKey(n);
  const ctx = canvas(scene, key, S, S);
  if (!ctx) return;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S / 2 - 3, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#7E68B0';
  ctx.stroke();
  ctx.fillStyle = '#7E68B0';
  ctx.font = `900 24px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(n), S / 2, S / 2 + 1);
  done(scene, key);
}

/** 좌석벨트 표시(난기류) — 둥근 판 + 벨트 + 버클 */
function makeSeatbelt(scene: Scene) {
  const W = 72;
  const H = 44;
  const ctx = canvas(scene, TEX.seatbelt, W, H);
  if (!ctx) return;
  roundRect(ctx, 2, 2, W - 4, H - 4, 12);
  ctx.fillStyle = '#3E3560';
  ctx.fill();
  ctx.strokeStyle = '#FFD84D';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(10, 30);
  ctx.quadraticCurveTo(W / 2, 40, W - 10, 30);
  ctx.stroke();
  roundRect(ctx, W / 2 - 9, 26, 18, 10, 3);
  ctx.fillStyle = '#FFD84D';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W / 2, 14, 7, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  done(scene, TEX.seatbelt);
}

/** 드라이어 바람 줄 — 밝은 바닥·배경에서도 보이게 하늘색 심 + 흰 테 */
function makeWind(scene: Scene) {
  const W = 96;
  const H = 12;
  const ctx = canvas(scene, TEX.wind, W, H);
  if (!ctx) return;
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, 'rgba(90,170,255,0)');
  g.addColorStop(0.35, 'rgba(90,170,255,0.95)');
  g.addColorStop(0.7, 'rgba(150,205,255,0.9)');
  g.addColorStop(1, 'rgba(150,205,255,0)');
  ctx.fillStyle = g;
  roundRect(ctx, 0, 3, W, 6, 3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(W * 0.2, 4);
  ctx.lineTo(W * 0.85, 4);
  ctx.stroke();
  done(scene, TEX.wind);
}

function makePaper(scene: Scene) {
  const W = 18;
  const H = 22;
  const ctx = canvas(scene, TEX.paper, W, H);
  if (!ctx) return;
  ctx.fillStyle = '#FFFDF7';
  ctx.fillRect(1, 1, W - 2, H - 2);
  ctx.strokeStyle = '#B9A6D8';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(1, 1, W - 2, H - 2);
  ctx.fillStyle = '#CDBDF0';
  for (let y = 6; y < H - 3; y += 4) ctx.fillRect(4, y, W - 8, 1.5);
  done(scene, TEX.paper);
}

function makeRing(scene: Scene) {
  const S = 64;
  const ctx = canvas(scene, TEX.ring, S, S);
  if (!ctx) return;
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(S / 2, S / 2, S / 2 - 4, S / 4, 0, 0, Math.PI * 2);
  ctx.stroke();
  done(scene, TEX.ring);
}

/** 기믹 그림 전부 + 첫 등장 안내 말풍선(문구별) */
export function makeGimmickTextures(scene: Scene, hints: string[], nagLines: string[]) {
  makeBolt(scene);
  makeZap(scene);
  makeRibbon(scene);
  makeWarn(scene, TEX.warnGround, 'ground');
  makeWarn(scene, TEX.warnHead, 'head');
  makeWarn(scene, TEX.warnSky, 'sky');
  makeBoltMark(scene);
  makeShout(scene);
  makeShadow(scene);
  makeEyes(scene);
  [1, 2, 3].forEach((n) => makeCount(scene, n));
  makeSeatbelt(scene);
  makeWind(scene);
  makePaper(scene);
  makeRing(scene);
  nagLines.forEach((t, i) => makeBubble(scene, bubbleKey(i), t));
  const uniq = Array.from(new Set(hints));
  uniq.forEach((t, i) => {
    const key = `wr-hint-g${i}`;
    makeHint(scene, key, t, /슬라이드|숙/.test(t) ? '#7E68B0' : '#E2557F');
    hintKeyMap.set(t, key);
  });
}
