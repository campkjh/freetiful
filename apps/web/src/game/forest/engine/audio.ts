// 소리 — 외부 음원 없이 Web Audio 로 합성(자산 출처 문제 없음).
//  · 음악: 마림바·피아노 느낌의 따뜻한 5음계 아르페지오 + 부드러운 화음. 밤엔 음을 줄이고, 대화 중엔 낮춘다.
//  · 발소리: 풀밭 · 흙길 · 나무 데크를 다르게. 같은 효과음도 조금씩 높낮이를 바꿔 반복감을 줄인다.
//  · 주민별 짧은 말소리(타자 효과와 함께).
export type Surface = 'grass' | 'dirt' | 'wood';

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class Sound {
  ctx: AudioContext | null = null;
  master!: GainNode;
  musicBus!: GainNode;
  sfxBus!: GainNode;
  private musicTimer: number | null = null;
  private beatIdx = 0;
  private duck = 1;
  private nightMix = 0;
  private ceremony = false;
  private vol = { master: 0.8, music: 0.5, sfx: 0.8 };
  private ambTimer: number | null = null;
  private noiseBuf: AudioBuffer | null = null;

  start() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx!;
    this.master = c.createGain();
    this.musicBus = c.createGain();
    this.sfxBus = c.createGain();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 3;
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.master.connect(comp);
    comp.connect(c.destination);
    // 잔향(짧은 방 느낌)
    const len = c.sampleRate * 1.4;
    const ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    const verb = c.createConvolver();
    verb.buffer = ir;
    const verbGain = c.createGain();
    verbGain.gain.value = 0.22;
    this.musicBus.connect(verb);
    verb.connect(verbGain);
    verbGain.connect(this.master);
    const nb = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    this.applyVolume();
    this.startMusic();
    this.startAmbience();
  }

  setVolume(v: { master: number; music: number; sfx: number }) {
    this.vol = v;
    this.applyVolume();
  }

  private applyVolume() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.master, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.55 * this.duck, t, 0.3);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
  }

  setDuck(on: boolean) {
    this.duck = on ? 0.45 : 1;
    this.applyVolume();
  }

  setNight(n: number) {
    this.nightMix = n;
  }

  setCeremony(on: boolean) {
    this.ceremony = on;
  }

  private tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; bus?: GainNode; attack?: number; when?: number; detune?: number; harmonics?: boolean } = {}) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + (opts.when ?? 0);
    const g = c.createGain();
    const peak = opts.gain ?? 0.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (opts.attack ?? 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(opts.bus ?? this.sfxBus);
    const o = c.createOscillator();
    o.type = opts.type ?? 'sine';
    o.frequency.value = freq;
    if (opts.detune) o.detune.value = opts.detune;
    o.connect(g);
    o.start(t);
    o.stop(t + dur + 0.05);
    if (opts.harmonics) {
      const o2 = c.createOscillator();
      const g2 = c.createGain();
      g2.gain.value = 0.28;
      o2.type = 'sine';
      o2.frequency.value = freq * 4;
      o2.connect(g2);
      g2.connect(g);
      o2.start(t);
      o2.stop(t + dur * 0.4);
    }
  }

  private noise(dur: number, filterFreq: number, q: number, gain: number, type: BiquadFilterType = 'bandpass', when = 0) {
    const c = this.ctx;
    if (!c || !this.noiseBuf) return;
    const t = c.currentTime + when;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = filterFreq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  // ── 효과음 ──
  click() {
    this.tone(880 + Math.random() * 40, 0.08, { gain: 0.08, type: 'triangle' });
  }
  open() {
    this.tone(660, 0.1, { gain: 0.07, type: 'triangle' });
    this.tone(990, 0.12, { gain: 0.06, type: 'triangle', when: 0.05 });
  }
  close() {
    this.tone(740, 0.09, { gain: 0.06, type: 'triangle' });
    this.tone(560, 0.11, { gain: 0.05, type: 'triangle', when: 0.04 });
  }
  pick() {
    const base = 72 + Math.floor(Math.random() * 2) * 2;
    this.tone(NOTE(base), 0.25, { gain: 0.14, harmonics: true });
    this.tone(NOTE(base + 7), 0.35, { gain: 0.12, harmonics: true, when: 0.07 });
  }
  reward() {
    [72, 76, 79, 84].forEach((n, i) => this.tone(NOTE(n), 0.5, { gain: 0.12, harmonics: true, when: i * 0.09 }));
  }
  memory() {
    [79, 84, 88, 91].forEach((n, i) => this.tone(NOTE(n), 0.8, { gain: 0.09, harmonics: true, when: i * 0.14 }));
  }
  error() {
    this.tone(330, 0.16, { gain: 0.08, type: 'triangle' });
    this.tone(262, 0.2, { gain: 0.07, type: 'triangle', when: 0.08 });
  }
  shake() {
    for (let i = 0; i < 4; i++) this.noise(0.18, 2200 + Math.random() * 1200, 0.8, 0.07, 'bandpass', i * 0.07);
  }
  thud() {
    this.tone(140, 0.18, { gain: 0.12, type: 'sine' });
    this.noise(0.08, 500, 1, 0.05);
  }
  place() {
    this.tone(196, 0.14, { gain: 0.12, type: 'triangle' });
    this.noise(0.06, 900, 1.2, 0.05);
  }
  rotate() {
    this.tone(520, 0.06, { gain: 0.05, type: 'triangle' });
  }
  shutter() {
    this.noise(0.05, 4000, 0.7, 0.12, 'highpass');
    this.noise(0.07, 2500, 0.7, 0.08, 'highpass', 0.08);
  }
  craft() {
    for (let i = 0; i < 3; i++) this.noise(0.09, 700 + i * 200, 2, 0.08, 'bandpass', i * 0.12);
    this.reward();
  }
  ring() {
    [88, 91, 96, 100].forEach((n, i) => this.tone(NOTE(n), 1.0, { gain: 0.07, when: i * 0.08 }));
  }
  applause(seconds = 3) {
    const c = this.ctx;
    if (!c) return;
    const n = Math.floor(seconds * 28);
    for (let i = 0; i < n; i++) this.noise(0.05, 1500 + Math.random() * 1800, 1.4, 0.035 + Math.random() * 0.03, 'bandpass', Math.random() * seconds);
  }
  step(surface: Surface) {
    if (surface === 'wood') {
      this.tone(170 + Math.random() * 30, 0.08, { gain: 0.06, type: 'triangle' });
      this.noise(0.05, 1200, 2, 0.03);
    } else if (surface === 'dirt') this.noise(0.07, 650 + Math.random() * 200, 1.2, 0.05);
    else this.noise(0.08, 1800 + Math.random() * 600, 0.6, 0.035, 'highpass');
  }
  talk(base: number, wave: OscillatorType) {
    const f = base * (0.85 + Math.random() * 0.35);
    this.tone(f, 0.06, { gain: 0.045, type: wave });
  }

  // ── 음악 ──
  private startMusic() {
    if (this.musicTimer) return;
    const tempo = 84;
    const beat = 60 / tempo / 2; // 8분음표
    // 화음 진행(Cmaj7 - Am7 - Fmaj7 - G6) — 따뜻하게
    const chords = [
      [60, 64, 67, 71],
      [57, 60, 64, 67],
      [53, 57, 60, 64],
      [55, 59, 62, 64],
    ];
    const wedding = [
      [60, 64, 67, 72],
      [65, 69, 72, 76],
      [57, 60, 64, 69],
      [55, 59, 62, 67],
    ];
    const pent = [0, 2, 4, 7, 9];
    const tick = () => {
      if (!this.ctx) return;
      const s = this.beatIdx++;
      const bar = Math.floor(s / 8) % 4;
      const set = this.ceremony ? wedding : chords;
      const ch = set[bar];
      const night = this.nightMix;
      // 화음(마디 첫 박)
      if (s % 8 === 0) {
        ch.forEach((n, i) => this.tone(NOTE(n - 12), beat * 7.5, { gain: 0.035, type: 'triangle', bus: this.musicBus, attack: 0.2, detune: i * 2 }));
      }
      // 베이스
      if (s % 4 === 0) this.tone(NOTE(ch[0] - 24), beat * 3.6, { gain: 0.05, type: 'sine', bus: this.musicBus, attack: 0.02 });
      // 마림바 아르페지오(밤엔 듬성듬성)
      const play = night > 0.5 ? s % 2 === 0 && Math.random() < 0.6 : Math.random() < 0.82;
      if (play) {
        const root = ch[0] + 12;
        const deg = pent[(s * 3 + bar) % pent.length];
        const oct = s % 8 > 5 ? 12 : 0;
        this.tone(NOTE(root + deg + oct), beat * 2.2, { gain: 0.05 * (1 - night * 0.35), harmonics: true, bus: this.musicBus });
      }
      // 피아노 멜로디(가끔)
      if (s % 16 === 6 && Math.random() < 0.7) {
        const m = ch[(s / 16) % 4 | 0] + 24;
        this.tone(NOTE(m), beat * 5, { gain: 0.035, type: 'sine', harmonics: true, bus: this.musicBus, attack: 0.01 });
      }
    };
    this.musicTimer = window.setInterval(tick, beat * 1000);
  }

  private startAmbience() {
    if (this.ambTimer) return;
    this.ambTimer = window.setInterval(() => {
      if (!this.ctx) return;
      if (this.nightMix < 0.5) {
        // 새소리
        if (Math.random() < 0.35) {
          const base = 2400 + Math.random() * 1400;
          const c = this.ctx;
          const t = c.currentTime;
          const o = c.createOscillator();
          const g = c.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(base, t);
          o.frequency.exponentialRampToValueAtTime(base * 1.3, t + 0.06);
          o.frequency.exponentialRampToValueAtTime(base * 0.9, t + 0.12);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.025, t + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
          o.connect(g);
          g.connect(this.sfxBus);
          o.start(t);
          o.stop(t + 0.16);
          if (Math.random() < 0.5) setTimeout(() => this.tone(base * 1.1, 0.08, { gain: 0.018 }), 160);
        }
      } else if (Math.random() < 0.6) {
        // 풀벌레
        for (let i = 0; i < 3; i++) this.tone(4200 + Math.random() * 300, 0.03, { gain: 0.012, type: 'square', when: i * 0.06 });
      }
    }, 900);
  }

  dispose() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    if (this.ambTimer) clearInterval(this.ambTimer);
    this.musicTimer = null;
    this.ambTimer = null;
    void this.ctx?.close();
    this.ctx = null;
  }
}
