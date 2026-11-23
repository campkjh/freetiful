// 동물런 사운드 — Web Audio 절차적 합성. 외부 오디오 파일 없음(번들 0KB, 오프라인 동작, 라이선스 무관).
// 효과음(기믹별) + 배경 칩튠 루프. AudioContext는 첫 사용자 제스처(출발 버튼) 안에서 생성.

let ctx: AudioContext | null = null
let master: GainNode | null = null
let bgmGain: GainNode | null = null
let bgmTimer: ReturnType<typeof setTimeout> | null = null
let enabled = true
try { enabled = typeof localStorage !== 'undefined' ? localStorage.getItem('animalrun_sound') !== 'off' : true } catch { /* noop */ }

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC: typeof AudioContext | undefined = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = enabled ? 1 : 0
    master.connect(ctx.destination)
  }
  return ctx
}

// 게인 엔벨로프 (지수 — 톡 치고 사라지는 느낌). exponentialRamp는 0 불가 → 0.0001 바닥.
function env(g: GainNode, when: number, peak: number, attack: number, dur: number) {
  const p = Math.max(0.0002, peak)
  g.gain.setValueAtTime(0.0001, when)
  g.gain.exponentialRampToValueAtTime(p, when + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
}

// 단음 오실레이터 (+선택적 주파수 슬라이드)
function blip(freq: number, when: number, dur: number, type: OscillatorType, peak: number, slideTo?: number, dest?: AudioNode) {
  const c = getCtx(); if (!c || !master) return
  const o = c.createOscillator(); o.type = type
  o.frequency.setValueAtTime(Math.max(1, freq), when)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), when + dur)
  const g = c.createGain()
  env(g, when, peak, Math.min(0.02, dur * 0.4), dur)
  o.connect(g).connect(dest || master)
  o.start(when); o.stop(when + dur + 0.03)
}

// 화이트노이즈 버스트 (충격/얼음/물보라용) — 짧으므로 매번 생성해도 부담 없음
function noiseBurst(when: number, dur: number, peak: number, filter: { type: BiquadFilterType; freq: number; q?: number } | null, dest?: AudioNode) {
  const c = getCtx(); if (!c || !master) return
  const len = Math.max(1, Math.ceil(c.sampleRate * dur))
  const buf = c.createBuffer(1, len, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  const src = c.createBufferSource(); src.buffer = buf
  let node: AudioNode = src
  if (filter) { const f = c.createBiquadFilter(); f.type = filter.type; f.frequency.value = filter.freq; if (filter.q) f.Q.value = filter.q; src.connect(f); node = f }
  const g = c.createGain()
  env(g, when, peak, 0.004, dur)
  node.connect(g).connect(dest || master)
  src.start(when); src.stop(when + dur + 0.03)
}

// UFO 워블 — 상승 톤 + 비브라토(LFO로 주파수 변조)
function ufoWarble(t: number) {
  const c = getCtx(); if (!c || !master) return
  const o = c.createOscillator(); o.type = 'sawtooth'
  o.frequency.setValueAtTime(280, t)
  o.frequency.exponentialRampToValueAtTime(840, t + 0.9)
  const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 15
  const lfoGain = c.createGain(); lfoGain.gain.value = 70
  lfo.connect(lfoGain).connect(o.frequency)
  const g = c.createGain(); env(g, t, 0.16, 0.05, 1.0)
  o.connect(g).connect(master)
  o.start(t); lfo.start(t); o.stop(t + 1.02); lfo.stop(t + 1.02)
}

export function play(name: string) {
  if (!enabled) return
  const c = getCtx(); if (!c || !master) return
  if (c.state === 'suspended') c.resume()
  const t = c.currentTime + 0.001
  switch (name) {
    case 'count': // 카운트다운 3·2·1
      blip(680, t, 0.13, 'square', 0.22); break
    case 'go': // 출발 신호
      blip(900, t, 0.1, 'square', 0.26); blip(1350, t + 0.09, 0.2, 'square', 0.26); break
    case 'meteorLaunch': // 운석 낙하(휘이익)
      blip(1500, t, 0.55, 'sawtooth', 0.16, 240)
      noiseBurst(t, 0.55, 0.1, { type: 'bandpass', freq: 1100, q: 0.7 }); break
    case 'meteorImpact': // 운석 명중(쾅)
      blip(120, t, 0.42, 'sine', 0.55, 40)
      noiseBurst(t, 0.34, 0.45, { type: 'lowpass', freq: 420 }); break
    case 'abduct': // UFO 납치
      ufoWarble(t); break
    case 'freeze': // 얼음(쩌적)
      noiseBurst(t, 0.2, 0.18, { type: 'highpass', freq: 4200 })
      blip(2300, t, 0.26, 'triangle', 0.12, 1300)
      blip(3100, t + 0.06, 0.22, 'triangle', 0.1, 1700); break
    case 'quake': // 지진(우르릉)
      noiseBurst(t, 1.1, 0.45, { type: 'lowpass', freq: 130 })
      blip(58, t, 1.1, 'sine', 0.4); blip(44, t + 0.1, 1.0, 'sine', 0.3); break
    case 'spring': { // 온천(보글보글)
      for (let i = 0; i < 7; i++) { const f = 360 + i * 36 + Math.random() * 60; blip(f, t + i * 0.085, 0.13, 'sine', 0.14, f * 1.7) }
      noiseBurst(t, 0.5, 0.05, { type: 'bandpass', freq: 2200, q: 1 }); break
    }
    case 'teleport': // 텔레포트(슈웅)
      blip(300, t, 0.18, 'sawtooth', 0.2, 1800)
      blip(2000, t + 0.12, 0.24, 'triangle', 0.13, 560); break
    case 'boost': // 로켓 부스트
      blip(220, t, 0.5, 'sawtooth', 0.18, 1250)
      noiseBurst(t, 0.5, 0.16, { type: 'highpass', freq: 900 }); break
    case 'spin': // 미끄덩(삐용)
      blip(1250, t, 0.22, 'sine', 0.2, 420)
      blip(520, t + 0.18, 0.26, 'sine', 0.2, 1450); break
    case 'fanfare': { // 우승 팡파레
      const notes = [523, 659, 784, 1047] // C5 E5 G5 C6
      notes.forEach((f, i) => blip(f, t + i * 0.13, 0.42, 'square', 0.24))
      const chord = [523, 659, 784, 1047]
      chord.forEach((f) => blip(f, t + 0.55, 0.7, 'triangle', 0.14))
      break
    }
    default: break
  }
}

// ── 배경 칩튠 루프 (C–G–Am–F, 134 BPM) ──
const BPM = 134
const STEP = (60 / BPM) / 2 // 8분음표
const BASS = [36, 43, 45, 41] // C2 G2 A2 F2
const MINOR = [false, false, true, false]
const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

function scheduleLoop(startAt: number) {
  const c = getCtx(); if (!c || !bgmGain) return
  let t = startAt
  for (let ch = 0; ch < 4; ch++) {
    const root = BASS[ch]
    const third = MINOR[ch] ? 3 : 4
    const leadRoot = root + 24
    const leadPat = [0, 7, third, 7, 12, 7, third, 7]
    for (let s = 0; s < 8; s++) {
      const st = t + s * STEP
      if (s % 2 === 0) { blip(midi(root), st, STEP * 1.7, 'triangle', 0.2, undefined, bgmGain); blip(70, st, 0.12, 'sine', 0.32, 40, bgmGain) }
      blip(midi(leadRoot + leadPat[s]), st, STEP * 0.82, 'square', 0.13, undefined, bgmGain)
      if (s % 2 === 1) noiseBurst(st, 0.03, 0.05, { type: 'highpass', freq: 7000 }, bgmGain)
    }
    t += 8 * STEP
  }
  const loopDur = 32 * STEP
  bgmTimer = setTimeout(() => scheduleLoop(t), Math.max(50, (loopDur - 0.12) * 1000))
}

export function startBgm() {
  if (!enabled) return
  const c = getCtx(); if (!c || !master) return
  if (c.state === 'suspended') c.resume()
  stopBgm()
  if (!bgmGain) { bgmGain = c.createGain(); bgmGain.connect(master) }
  bgmGain.gain.cancelScheduledValues(c.currentTime)
  bgmGain.gain.setValueAtTime(0.0001, c.currentTime)
  bgmGain.gain.exponentialRampToValueAtTime(0.2, c.currentTime + 0.6)
  scheduleLoop(c.currentTime + 0.06)
}

export function stopBgm() {
  if (bgmTimer != null) { clearTimeout(bgmTimer); bgmTimer = null }
  if (ctx && bgmGain) {
    const now = ctx.currentTime
    bgmGain.gain.cancelScheduledValues(now)
    bgmGain.gain.setValueAtTime(Math.max(0.0001, bgmGain.gain.value), now)
    bgmGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25)
  }
}

// 사용자 제스처 안에서 호출 → 모바일 자동재생 정책 통과
export function resume() {
  const c = getCtx(); if (!c) return
  if (c.state === 'suspended') c.resume()
}

export function setEnabled(on: boolean) {
  enabled = on
  try { if (typeof localStorage !== 'undefined') localStorage.setItem('animalrun_sound', on ? 'on' : 'off') } catch { /* noop */ }
  if (!on) stopBgm()
  if (ctx && master) {
    const now = ctx.currentTime
    master.gain.cancelScheduledValues(now)
    master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now)
    master.gain.exponentialRampToValueAtTime(on ? 1 : 0.0001, now + 0.15)
  }
}

export function isEnabled() { return enabled }
