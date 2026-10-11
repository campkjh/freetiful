// 웨딩런 효과음 — Web Audio 합성(음원 파일 없음 → 사양서 [12] '음원 파일이 없으면 오류 없이 동작') (261011 사장 '웨딩런')
//  · AudioContext 는 사용자 입력(시작 버튼·점프 버튼) 안에서 처음 만든다 → 모바일 자동재생 정책 통과.
//  · 모든 호출은 실패해도 조용히 무시(오디오 미지원·차단 기기).
//  · 소리 켬/끔 저장(localStorage wr-sound)은 화면 담당 — 엔진은 setEnabled 로 상태만 받는다.

type Osc = OscillatorType;

const SCALE = [1047, 1175, 1319, 1568, 1760, 2093, 2349, 2637, 3136]; // 연속 수집 시 올라가는 음(C6 펜타토닉)

/* 잔잔한 오르골 배경음(I–V–vi–IV) */
const CHORDS: number[][] = [
  [262, 330, 392],
  [196, 247, 294],
  [220, 262, 330],
  [175, 220, 262],
];
const ARP = [0, 1, 2, 4, 2, 1, 3, 1];

export class WRSound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private enabled = true;
  private bgmOn = false;
  private bgmPaused = false;
  private bgmTimer: ReturnType<typeof setInterval> | null = null;
  private bgmNext = 0;
  private bgmStep = 0;
  private bgmMul = 1;

  /** 사용자 입력 안에서 부른다(처음 한 번 AudioContext 생성 + 잠금 해제) */
  unlock() {
    try {
      const c = this.getCtx();
      if (c && c.state === 'suspended') c.resume().catch(() => {});
    } catch {
      /* 무시 */
    }
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    try {
      if (this.ctx && this.master) {
        const now = this.ctx.currentTime;
        this.master.gain.cancelScheduledValues(now);
        this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), now);
        this.master.gain.exponentialRampToValueAtTime(on ? 0.8 : 0.0001, now + 0.12);
        if (on) this.bgmNext = now + 0.05;
      }
    } catch {
      /* 무시 */
    }
  }

  isEnabled() {
    return this.enabled;
  }

  private getCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC: typeof AudioContext | undefined =
        window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      try {
        this.ctx = new AC();
      } catch {
        return null;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.8 : 0.0001;
      this.master.connect(this.ctx.destination);
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.5;
      this.bgmGain.connect(this.master);
    }
    return this.ctx;
  }

  private env(g: GainNode, when: number, peak: number, attack: number, dur: number) {
    const p = Math.max(0.0002, peak);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(p, when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  }

  private blip(freq: number, when: number, dur: number, type: Osc, peak: number, slideTo?: number, out?: AudioNode | null) {
    const c = this.ctx;
    const dst = out ?? this.master;
    if (!c || !dst) return;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(1, freq), when);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), when + dur);
    const g = c.createGain();
    this.env(g, when, peak, Math.min(0.02, dur * 0.3), dur);
    o.connect(g).connect(dst);
    o.start(when);
    o.stop(when + dur + 0.03);
  }

  private bell(freq: number, when: number, dur: number, peak: number, out?: AudioNode | null) {
    this.blip(freq, when, dur, 'sine', peak, undefined, out);
    this.blip(freq * 2.01, when, dur * 0.6, 'sine', peak * 0.45, undefined, out);
    this.blip(freq * 3.03, when, dur * 0.35, 'sine', peak * 0.2, undefined, out);
  }

  private noise(when: number, dur: number, peak: number, filter: { type: BiquadFilterType; freq: number; q?: number; to?: number } | null) {
    const c = this.ctx;
    if (!c || !this.master) return;
    if (!this.noiseBuf) {
      this.noiseBuf = c.createBuffer(1, Math.ceil(c.sampleRate * 3.2), c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    let node: AudioNode = src;
    if (filter) {
      const f = c.createBiquadFilter();
      f.type = filter.type;
      f.frequency.setValueAtTime(filter.freq, when);
      if (filter.to) f.frequency.exponentialRampToValueAtTime(filter.to, when + dur);
      if (filter.q) f.Q.value = filter.q;
      src.connect(f);
      node = f;
    }
    const g = c.createGain();
    this.env(g, when, peak, 0.004, dur);
    node.connect(g).connect(this.master);
    src.start(when, Math.random() * 0.5);
    src.stop(when + dur + 0.03);
  }

  play(name: string, arg = 0) {
    if (!this.enabled) return;
    try {
      const c = this.ctx;
      if (!c || !this.master) return; // 사용자 입력 전에는 소리 없음
      if (c.state === 'suspended') c.resume().catch(() => {});
      const t = c.currentTime + 0.001;
      switch (name) {
        case 'start':
          this.bell(784, t, 0.7, 0.16);
          this.bell(1047, t + 0.18, 0.9, 0.16);
          break;
        case 'jump':
          this.blip(520, t, 0.15, 'sine', 0.2, 900);
          this.blip(1560, t + 0.02, 0.08, 'triangle', 0.05);
          break;
        case 'land':
          this.noise(t, 0.06, 0.06, { type: 'lowpass', freq: 600 });
          break;
        case 'slide':
          this.noise(t, 0.26, 0.13, { type: 'bandpass', freq: 2400, q: 0.8, to: 700 });
          break;
        case 'heart': {
          const f = SCALE[Math.max(0, Math.min(SCALE.length - 1, arg - 1))];
          this.blip(f, t, 0.16, 'sine', 0.13);
          this.blip(f * 1.5, t + 0.03, 0.12, 'triangle', 0.05);
          break;
        }
        case 'envelope':
          this.bell(1319, t, 0.3, 0.12);
          this.bell(1760, t + 0.07, 0.35, 0.12);
          this.noise(t, 0.12, 0.05, { type: 'highpass', freq: 6000 });
          break;
        case 'stage':
          [523, 659, 784, 1047].forEach((f, i) => this.bell(f, t + i * 0.09, 0.6, 0.12));
          this.noise(t + 0.3, 0.5, 0.04, { type: 'highpass', freq: 7000 });
          break;
        case 'groom':
          this.blip(110, t, 0.12, 'sine', 0.26, 80);
          this.blip(110, t + 0.18, 0.12, 'sine', 0.22, 80);
          [659, 784, 988, 1319].forEach((f, i) => this.bell(f, t + 0.3 + i * 0.08, 0.6, 0.11));
          break;
        case 'shutter':
          this.noise(t, 0.03, 0.4, { type: 'highpass', freq: 2500 });
          this.noise(t + 0.06, 0.04, 0.3, { type: 'highpass', freq: 3500 });
          this.blip(2400, t + 0.1, 0.35, 'sine', 0.04, 5200);
          break;
        case 'cheer':
          [523, 659, 784].forEach((f) => this.blip(f, t, 0.7, 'sine', 0.09));
          this.blip(880, t + 0.05, 0.16, 'sine', 0.12, 1320);
          this.blip(1175, t + 0.18, 0.18, 'sine', 0.1, 1760);
          break;
        case 'pop':
          this.blip(900, t, 0.08, 'sine', 0.22, 300);
          this.noise(t, 0.12, 0.16, { type: 'bandpass', freq: 1800, q: 1 });
          this.bell(1568, t + 0.08, 0.4, 0.08);
          break;
        case 'plane':
          [784, 659, 523, 392].forEach((f, i) => this.bell(f, t + i * 0.2, 0.7, 0.1));
          this.noise(t + 0.6, 1.8, 0.1, { type: 'bandpass', freq: 300, q: 0.7, to: 1800 });
          break;
        case 'bell':
          this.bell(1047, t, 0.8, 0.1);
          this.bell(1319, t + 0.15, 0.9, 0.1);
          break;
        case 'arrive': {
          const tr = [523, 523, 523, 698];
          tr.forEach((f, i) => {
            this.blip(f, t + i * 0.12, i === 3 ? 0.7 : 0.11, 'square', 0.07);
            this.blip(f * 2, t + i * 0.12, i === 3 ? 0.7 : 0.1, 'triangle', 0.06);
          });
          [1047, 1319, 1568, 2093].forEach((f, i) => this.bell(f, t + 0.6 + i * 0.07, 0.9, 0.08));
          this.noise(t + 0.5, 0.8, 0.05, { type: 'highpass', freq: 6000 });
          break;
        }
        case 'next':
          this.blip(392, t, 0.12, 'triangle', 0.14, 784);
          this.blip(784, t + 0.12, 0.2, 'triangle', 0.14, 1047);
          break;
        case 'trip':
          this.blip(660, t, 0.14, 'triangle', 0.16, 520);
          this.blip(520, t + 0.14, 0.14, 'triangle', 0.15, 400);
          this.blip(392, t + 0.28, 0.45, 'triangle', 0.15, 196);
          this.noise(t + 0.05, 0.12, 0.12, { type: 'lowpass', freq: 500 });
          break;
        case 'fall':
          this.blip(1100, t, 0.55, 'sine', 0.16, 200);
          this.blip(90, t + 0.55, 0.2, 'sine', 0.22, 45);
          break;
        case 'bump': // 연습 구간에서 살짝 부딪힘(통)
          this.blip(300, t, 0.1, 'sine', 0.16, 180);
          break;
        // ── (261011 사장 기믹) 예고·연출 합성음 — 모두 짧고 작게 ──
        case 'djump': // 2단 점프 '퐁'
          this.blip(700, t, 0.14, 'sine', 0.2, 1400);
          this.blip(2100, t + 0.03, 0.08, 'triangle', 0.05);
          break;
        case 'thunder': // 시어머니 벼락 예고(우르릉)
          this.noise(t, 0.7, 0.22, { type: 'lowpass', freq: 380, to: 120 });
          this.blip(70, t, 0.5, 'sine', 0.2, 45);
          break;
        case 'strike': // 번개 내리꽂힘(찌직)
          this.noise(t, 0.18, 0.3, { type: 'highpass', freq: 2200 });
          this.blip(1800, t, 0.12, 'square', 0.05, 300);
          break;
        case 'zap': // 감전(찌릿) — 충돌
          for (let i = 0; i < 4; i++) this.blip(1400 + i * 300, t + i * 0.04, 0.05, 'square', 0.06, 600);
          break;
        case 'hum': // 가전 '징—'
          this.blip(120, t, 0.9, 'sawtooth', 0.05, 125);
          this.blip(240, t, 0.9, 'square', 0.02, 250);
          this.noise(t + 0.3, 0.4, 0.06, { type: 'highpass', freq: 5000 });
          break;
        case 'flicker': // 정전 '지직'
          [0, 0.12, 0.3, 0.42].forEach((d) => this.noise(t + d, 0.06, 0.14, { type: 'bandpass', freq: 3000, q: 1 }));
          break;
        case 'ahem': // 아버지 '어흠!'
          this.blip(150, t, 0.16, 'triangle', 0.22, 120);
          this.blip(120, t + 0.2, 0.22, 'triangle', 0.2, 95);
          break;
        case 'coo': // 비둘기 '구구'
          this.blip(420, t, 0.16, 'sine', 0.12, 360);
          this.blip(420, t + 0.22, 0.2, 'sine', 0.12, 340);
          break;
        case 'rush': // 아이들 '우다다'
          for (let i = 0; i < 6; i++) this.noise(t + i * 0.07, 0.05, 0.1, { type: 'lowpass', freq: 700 });
          this.blip(880, t, 0.1, 'triangle', 0.06, 1100);
          break;
        case 'drum': // 북 '둥'
          this.blip(95, t, 0.28, 'sine', 0.3, 60);
          this.noise(t, 0.08, 0.08, { type: 'lowpass', freq: 400 });
          break;
        case 'squeak': // 행거 '끼익'
          this.blip(1900, t, 0.3, 'triangle', 0.07, 1300);
          break;
        case 'whirr': // 드라이어 '위잉'
          this.noise(t, 0.9, 0.12, { type: 'bandpass', freq: 900, q: 0.6, to: 1800 });
          break;
        case 'paper': // 서류 '사라락'
          this.noise(t, 0.5, 0.1, { type: 'highpass', freq: 4000 });
          break;
        case 'beep': // 사진사 3·2·1 삑삑
          [0, 0.25, 0.5].forEach((d) => this.blip(1760, t + d, 0.07, 'sine', 0.1));
          break;
        case 'dingdong': // 좌석벨트 '띵-동'
          this.bell(988, t, 0.5, 0.1);
          this.bell(784, t + 0.32, 0.7, 0.1);
          break;
        case 'monkey': // 원숭이 '끼끼'
          this.blip(1300, t, 0.07, 'square', 0.05, 1700);
          this.blip(1300, t + 0.11, 0.07, 'square', 0.05, 1700);
          break;
        case 'splash': // 파도 '촤아'
          this.noise(t, 0.6, 0.14, { type: 'bandpass', freq: 1600, q: 0.5, to: 600 });
          break;
        case 'robo': // 로봇청소기 '삐빅'
          this.blip(1500, t, 0.06, 'square', 0.05);
          this.blip(2000, t + 0.09, 0.06, 'square', 0.05);
          break;
        case 'meow': // 고양이 '야옹'
          this.blip(700, t, 0.32, 'triangle', 0.1, 1100);
          this.blip(1100, t + 0.2, 0.25, 'triangle', 0.08, 650);
          break;
        case 'clap': // 박수 '짝'
          this.noise(t, 0.05, 0.26, { type: 'bandpass', freq: 1800, q: 0.9 });
          break;
        case 'chime': // 꽃 아치 '딩'
          this.bell(1568, t, 0.5, 0.07);
          break;
        case 'shake': // 난기류 덜컹
          this.noise(t, 0.4, 0.14, { type: 'lowpass', freq: 220 });
          break;
        case 'flash': // 플래시 '팡'
          this.noise(t, 0.05, 0.3, { type: 'highpass', freq: 3000 });
          break;
        default:
          break;
      }
    } catch {
      /* 무시 */
    }
  }

  private bgmSchedule = () => {
    const c = this.ctx;
    if (!c || !this.bgmGain || !this.bgmOn || this.bgmPaused || !this.enabled) return;
    try {
      const eighth = 60 / (100 * this.bgmMul) / 2;
      if (this.bgmNext < c.currentTime) this.bgmNext = c.currentTime + 0.05;
      while (this.bgmNext < c.currentTime + 0.25) {
        const bar = Math.floor(this.bgmStep / 8) % CHORDS.length;
        const ch = CHORDS[bar];
        const k = ARP[this.bgmStep % 8];
        const f = k <= 2 ? ch[k] * 2 : k === 3 ? ch[0] * 4 : ch[1] * 4;
        this.blip(f, this.bgmNext, 0.55, 'sine', 0.045, undefined, this.bgmGain);
        this.blip(f * 2, this.bgmNext, 0.25, 'triangle', 0.01, undefined, this.bgmGain);
        if (this.bgmStep % 8 === 0) this.blip(ch[0] / 2, this.bgmNext, 0.9, 'sine', 0.045, undefined, this.bgmGain);
        this.bgmNext += eighth;
        this.bgmStep++;
      }
    } catch {
      /* 무시 */
    }
  };

  bgmStart() {
    this.bgmOn = true;
    this.bgmPaused = false;
    if (!this.ctx) return;
    if (!this.bgmTimer) this.bgmTimer = setInterval(this.bgmSchedule, 60);
  }
  bgmStop() {
    this.bgmOn = false;
    this.bgmStep = 0;
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }
  bgmPause(p: boolean) {
    this.bgmPaused = p;
    if (!p && this.ctx) this.bgmNext = this.ctx.currentTime + 0.05;
  }
  bgmTempo(mul: number) {
    this.bgmMul = Math.max(0.8, Math.min(1.35, mul));
  }

  destroy() {
    this.bgmStop();
    try {
      this.ctx?.close().catch(() => {});
    } catch {
      /* 무시 */
    }
    this.ctx = null;
    this.master = null;
    this.bgmGain = null;
  }
}
