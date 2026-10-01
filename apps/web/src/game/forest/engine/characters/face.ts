// 얼굴 — 머리 앞쪽에 붙인 투명 캔버스 텍스처. 표정 6종(웃음·기쁨·놀람·수줍음·슬픔·기본) + 눈 깜빡임 + 시선.
// 눈·입은 텍스처 교체로 바꾼다(제작 프롬프트 5쪽 '눈과 입은 표정 교체 또는 간단한 변형').
import * as THREE from 'three';
import type { BrowStyle, EyeStyle } from '../../data/appearance';

export type FaceExpr = 'normal' | 'smile' | 'joy' | 'surprise' | 'shy' | 'sad';

export interface FaceSpec {
  kind: 'human' | 'animal';
  eyes: EyeStyle | 'dot';
  brows: BrowStyle | 'none';
  blush: number;
  skin: string;
  browColor: string;
  muzzle?: string | null;
  nose: 'human' | 'pink' | 'dark';
  mouth: 'smile' | 'w';
  whiskers?: boolean;
  /** 눈 간격 배율(동물은 조금 넓게) */
  eyeGap?: number;
}

export const FACE_W = 512;
export const FACE_H = 256;
const EY = 122;
const INK = '#2A2320';

export class Face {
  canvas: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  spec: FaceSpec;
  expr: FaceExpr = 'normal';
  blink = false;
  lookX = 0;
  lookY = 0;
  private dirty = true;

  constructor(spec: FaceSpec) {
    this.spec = spec;
    this.canvas = document.createElement('canvas');
    this.canvas.width = FACE_W;
    this.canvas.height = FACE_H;
    this.g = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.draw();
  }

  setSpec(spec: FaceSpec) {
    this.spec = spec;
    this.dirty = true;
  }
  setExpr(e: FaceExpr) {
    if (this.expr !== e) {
      this.expr = e;
      this.dirty = true;
    }
  }
  setBlink(b: boolean) {
    if (this.blink !== b) {
      this.blink = b;
      this.dirty = true;
    }
  }
  setLook(x: number, y: number) {
    const nx = Math.round(x * 4) / 4;
    const ny = Math.round(y * 4) / 4;
    if (nx !== this.lookX || ny !== this.lookY) {
      this.lookX = nx;
      this.lookY = ny;
      this.dirty = true;
    }
  }

  update() {
    if (this.dirty) this.draw();
  }

  draw() {
    this.dirty = false;
    const g = this.g;
    const s = this.spec;
    g.clearRect(0, 0, FACE_W, FACE_H);
    const gap = 78 * (s.eyeGap ?? 1);
    const lx = 256 - gap;
    const rx = 256 + gap;
    // 주둥이(동물) — 코·입 뒤 밝은 면
    if (s.muzzle) {
      g.fillStyle = s.muzzle;
      g.beginPath();
      g.ellipse(256, 178, 80, 54, 0, 0, Math.PI * 2);
      g.fill();
    }
    // 볼터치
    if (s.blush > 0 || this.expr === 'shy') {
      const col = s.blush === 2 ? '247,170,140' : '244,160,180';
      const a = this.expr === 'shy' ? 0.85 : 0.55;
      for (const x of [256 - gap - 26, 256 + gap + 26]) {
        const grd = g.createRadialGradient(x, 168, 2, x, 168, 40);
        grd.addColorStop(0, `rgba(${col},${a})`);
        grd.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = grd;
        g.beginPath();
        g.ellipse(x, 168, 42, 27, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    // 눈썹
    if (s.brows !== 'none') this.drawBrows(lx, rx);
    // 눈
    const e = this.expr;
    const closedHappy = e === 'joy' || e === 'shy' || (s.eyes === 'smiley' && e !== 'surprise' && e !== 'sad');
    for (const [x, side] of [[lx, -1], [rx, 1]] as Array<[number, number]>) {
      if (this.blink && !closedHappy) this.drawClosed(x, false);
      else if (closedHappy) this.drawClosed(x, true);
      else this.drawEye(x, side);
    }
    // 코
    g.fillStyle = s.nose === 'pink' ? '#E79AAE' : s.nose === 'dark' ? '#4A332A' : 'rgba(170,110,80,0.55)';
    if (s.nose === 'human') {
      g.beginPath();
      g.ellipse(256, 160, 8, 6, 0, 0, Math.PI * 2);
      g.fill();
    } else {
      g.beginPath();
      g.moveTo(240, 156);
      g.quadraticCurveTo(256, 148, 272, 156);
      g.quadraticCurveTo(264, 174, 256, 176);
      g.quadraticCurveTo(248, 174, 240, 156);
      g.fill();
    }
    // 입
    this.drawMouth();
    // 수염
    if (s.whiskers) {
      g.strokeStyle = 'rgba(80,70,64,0.5)';
      g.lineWidth = 3;
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          g.beginPath();
          g.moveTo(256 + side * 60, 160 + i * 9);
          g.lineTo(256 + side * 112, 152 + i * 14);
          g.stroke();
        }
      }
    }
    this.texture.needsUpdate = true;
  }

  private drawBrows(lx: number, rx: number) {
    const g = this.g;
    const s = this.spec;
    g.strokeStyle = s.browColor;
    g.lineCap = 'round';
    g.lineWidth = s.kind === 'animal' ? 7 : 9;
    const lift = this.expr === 'surprise' ? -10 : this.expr === 'sad' ? -2 : 0;
    for (const [x, side] of [[lx, -1], [rx, 1]] as Array<[number, number]>) {
      const y = 62 + lift;
      g.beginPath();
      if (this.expr === 'sad') {
        g.moveTo(x - side * 22, y - 6);
        g.lineTo(x + side * 20, y + 4);
      } else if (s.brows === 'flat') {
        g.moveTo(x - 20, y);
        g.lineTo(x + 20, y);
      } else if (s.brows === 'up') {
        g.moveTo(x - side * 20, y + 5);
        g.lineTo(x + side * 20, y - 7);
      } else {
        g.moveTo(x - 21, y + 4);
        g.quadraticCurveTo(x, y - 9, x + 21, y + 4);
      }
      g.stroke();
    }
  }

  private drawEye(x: number, side: number) {
    const g = this.g;
    const s = this.spec;
    const e = this.expr;
    const ox = this.lookX * 7;
    const oy = this.lookY * 6 + (e === 'shy' ? 6 : 0);
    if (e === 'surprise') {
      g.fillStyle = '#FFFFFF';
      g.beginPath();
      g.ellipse(x, EY - 2, 34, 42, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 5;
      g.stroke();
      g.fillStyle = INK;
      g.beginPath();
      g.ellipse(x + ox * 0.5, EY + oy * 0.5, 14, 17, 0, 0, Math.PI * 2);
      g.fill();
      return;
    }
    const big = s.eyes === 'sparkle' ? 1.1 : s.eyes === 'dot' ? 0.78 : 1;
    const rxE = 30 * big;
    const ryE = 39 * big;
    g.fillStyle = INK;
    g.beginPath();
    g.ellipse(x + ox, EY + oy, rxE, ryE, 0, 0, Math.PI * 2);
    g.fill();
    // 반짝임
    g.fillStyle = '#FFFFFF';
    g.beginPath();
    g.ellipse(x + ox - rxE * 0.32, EY + oy - ryE * 0.38, rxE * 0.34, ryE * 0.3, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.arc(x + ox + rxE * 0.34, EY + oy + ryE * 0.34, rxE * 0.16, 0, Math.PI * 2);
    g.fill();
    if (s.eyes === 'sparkle') {
      g.beginPath();
      g.arc(x + ox + rxE * 0.1, EY + oy - ryE * 0.05, rxE * 0.1, 0, Math.PI * 2);
      g.fill();
    }
    // 나른한 눈 / 슬픔 — 둥근 윗눈꺼풀(눈 모양을 따라 깎는다)
    if (s.eyes === 'sleepy' || e === 'sad') {
      const cx = x + ox;
      const cy = EY + oy;
      const tilt = e === 'sad' ? side * 0.28 : 0;
      const cut = e === 'sad' ? 0.1 : 0.32;
      g.save();
      g.beginPath();
      g.ellipse(cx, cy, rxE + 1.5, ryE + 1.5, 0, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = s.skin;
      g.beginPath();
      g.ellipse(cx, cy - ryE * (1 + cut), rxE * 1.6, ryE * 1.05, tilt, 0, Math.PI * 2);
      g.fill();
      g.restore();
      g.strokeStyle = INK;
      g.lineWidth = 5;
      g.beginPath();
      g.ellipse(cx, cy - ryE * (1 + cut), rxE * 1.6, ryE * 1.05, tilt, Math.PI * 0.18, Math.PI * 0.82);
      g.stroke();
    }
  }

  private drawClosed(x: number, happy: boolean) {
    const g = this.g;
    g.strokeStyle = INK;
    g.lineCap = 'round';
    g.lineWidth = 9;
    g.beginPath();
    if (happy) {
      g.moveTo(x - 28, EY + 8);
      g.quadraticCurveTo(x, EY - 24, x + 28, EY + 8);
    } else {
      g.moveTo(x - 27, EY);
      g.quadraticCurveTo(x, EY + 12, x + 27, EY);
    }
    g.stroke();
  }

  private drawMouth() {
    const g = this.g;
    const s = this.spec;
    const e = this.expr;
    const my = s.kind === 'animal' ? 184 : 190;
    g.strokeStyle = '#5B3B33';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = 7;
    if (e === 'joy') {
      g.fillStyle = '#6B3A36';
      g.beginPath();
      g.moveTo(232, my - 6);
      g.quadraticCurveTo(256, my - 2, 280, my - 6);
      g.quadraticCurveTo(278, my + 24, 256, my + 26);
      g.quadraticCurveTo(234, my + 24, 232, my - 6);
      g.fill();
      g.fillStyle = '#F08C9C';
      g.beginPath();
      g.ellipse(256, my + 16, 12, 7, 0, 0, Math.PI * 2);
      g.fill();
      return;
    }
    if (e === 'surprise') {
      g.fillStyle = '#6B3A36';
      g.beginPath();
      g.ellipse(256, my + 4, 10, 13, 0, 0, Math.PI * 2);
      g.fill();
      return;
    }
    if (e === 'sad') {
      g.beginPath();
      g.moveTo(240, my + 8);
      g.quadraticCurveTo(256, my - 4, 272, my + 8);
      g.stroke();
      return;
    }
    if (e === 'shy') {
      g.beginPath();
      g.moveTo(240, my + 2);
      g.quadraticCurveTo(248, my - 4, 256, my + 2);
      g.quadraticCurveTo(264, my + 8, 272, my + 2);
      g.stroke();
      return;
    }
    if (s.mouth === 'w') {
      g.beginPath();
      g.moveTo(236, my - 2);
      g.quadraticCurveTo(246, my + 12, 256, my);
      g.quadraticCurveTo(266, my + 12, 276, my - 2);
      g.stroke();
      return;
    }
    const wide = e === 'smile' ? 26 : 18;
    const dip = e === 'smile' ? 16 : 10;
    g.beginPath();
    g.moveTo(256 - wide, my);
    g.quadraticCurveTo(256, my + dip, 256 + wide, my);
    g.stroke();
  }
}
