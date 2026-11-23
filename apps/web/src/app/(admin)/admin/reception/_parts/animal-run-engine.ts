// Adapted from Oneline's employee/animal-run engine. The draw server owns the finish order.

import * as THREE from 'three'
import * as audio from './animal-run-sound'

const ANIMALS: AnimalCfg[] = [
  { key: 'capybara', name: '카피바라', emoji: '🦫', body: 0x9c6b3f, belly: 0xb98a5e, ear: 'round', feature: 'none' },
  { key: 'lion', name: '사자', emoji: '🦁', body: 0xe0a23a, belly: 0xf0c878, ear: 'round', feature: 'mane' },
  { key: 'duck', name: '오리', emoji: '🦆', body: 0xf2f2f2, belly: 0xffffff, ear: 'none', feature: 'beak' },
  { key: 'sheep', name: '양', emoji: '🐑', body: 0xf4f0e8, belly: 0xffffff, ear: 'round', feature: 'fluff' },
  { key: 'zebra', name: '얼룩말', emoji: '🦓', body: 0xf0f0f0, belly: 0xffffff, ear: 'pointy', feature: 'mane', stripes: true },
  { key: 'tiger', name: '호랑이', emoji: '🐯', body: 0xf08a2c, belly: 0xffe6c8, ear: 'round', feature: 'none', stripes: true },
  { key: 'turtle', name: '거북이', emoji: '🐢', body: 0x4caf6a, belly: 0xa5d6a7, ear: 'none', feature: 'shell' },
  { key: 'dino', name: '공룡', emoji: '🦕', body: 0x66bb6a, belly: 0xa5d6a7, ear: 'none', feature: 'neck' },
  { key: 'hamster', name: '햄스터', emoji: '🐹', body: 0xd9a86b, belly: 0xf0d9b5, ear: 'round', feature: 'none' },
]

export type AnimalRunEntry = { number: number; name: string }

type AnimalCfg = {
  key: string; name: string; emoji: string
  body: number; belly: number
  ear: 'round' | 'pointy' | 'none' | 'long'
  feature: 'none' | 'mane' | 'beak' | 'shell' | 'neck' | 'fluff'
  stripes?: boolean
  species?: string
}
export type ThemeKey = 'harbor' | 'city' | 'forest'
type Callbacks = {
  onCountdown: (txt: string) => void
  onFinish: (res: Array<{ key: string; name: string; rank: number }>) => void
  onPlace: (rank: number) => void
  onEvent?: (txt: string) => void
}

const FINISH_Z = 150        // 결승선 거리 (기믹 포함 선두 기준 ~16초)
const LANE_GAP = 2.2
const TRACK_W = (n: number) => Math.max(8, n * LANE_GAP + 4)

// 줄무늬 텍스처 (호랑이/얼룩말 — 세로 줄, 살짝 물결)
function stripeTexture(base: number, stripe: number, count: number, thickness: number): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128
  const ctx = c.getContext('2d')!
  const hex = (n: number) => '#' + n.toString(16).padStart(6, '0')
  ctx.fillStyle = hex(base); ctx.fillRect(0, 0, 256, 128)
  ctx.fillStyle = hex(stripe)
  const step = 256 / count
  for (let i = 0; i < count; i++) {
    const x = i * step + step * 0.5
    const w = step * thickness
    ctx.beginPath()
    ctx.moveTo(x - w + Math.sin(i) * 4, 0)
    ctx.bezierCurveTo(x + w * 0.4, 42, x - w * 0.4, 86, x + Math.sin(i + 1) * 4, 128)
    ctx.lineTo(x + w + Math.sin(i + 2) * 4, 128)
    ctx.bezierCurveTo(x + w * 1.4, 86, x + w * 0.6, 42, x + w + Math.sin(i) * 4, 0)
    ctx.closePath(); ctx.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping; tex.repeat.x = 2
  return tex
}

// ─── 동물 빌더 (모듈 스코프, 호출마다 자체 재질) ───
function buildAnimal(cfg: AnimalCfg): { group: THREE.Group; legs: THREE.Object3D[] } {
  const g = new THREE.Group()
  const legs: THREE.Object3D[] = []
  const mat = (c: number) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.72, metalness: 0 })
  const body = mat(cfg.body)
  const belly = mat(cfg.belly)
  const whiteMat = mat(0xffffff)
  const blackMat = mat(0x232323)
  const pinkMat = mat(0xe7a3a0)
  const sphere = (r: number, m: THREE.Material) => new THREE.Mesh(new THREE.SphereGeometry(r, 16, 13), m)

  const addEyes = (y: number, z: number, spread: number, r = 0.13) => {
    for (const sx of [-1, 1]) {
      const e = sphere(r, blackMat); e.position.set(sx * spread, y, z); g.add(e)
      const hl = new THREE.Mesh(new THREE.SphereGeometry(r * 0.4, 8, 8), whiteMat)
      hl.position.set(sx * spread + r * 0.28, y + r * 0.32, z + r * 0.7); g.add(hl)
    }
  }
  const addLeg = (x: number, z: number, len: number, m: THREE.Material, thick = 0.24, footMat?: THREE.Material) => {
    const pivot = new THREE.Object3D(); pivot.position.set(x, len, z)
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(thick, len * 0.7, 4, 8), m)
    leg.position.y = -len / 2; pivot.add(leg)
    const foot = sphere(thick * 1.15, footMat || m)
    foot.scale.set(1.1, 0.7, 1.4); foot.position.set(0, -len + thick * 0.2, thick * 0.6); pivot.add(foot)
    g.add(pivot); legs.push(pivot)
  }
  const quadLegs = (lenF: number, lenB: number, m: THREE.Material, w = 0.46, fz = 0.6, bz = -0.6, th = 0.24, fm?: THREE.Material) => {
    addLeg(-w, fz, lenF, m, th, fm); addLeg(w, fz, lenF, m, th, fm)
    addLeg(-w, bz, lenB, m, th, fm); addLeg(w, bz, lenB, m, th, fm)
  }

  switch (cfg.species ?? cfg.key) {
    case 'capybara': {
      const torso = sphere(1.05, body); torso.scale.set(1.05, 1.0, 1.35); torso.position.y = 1.1; g.add(torso)
      const head = sphere(0.82, body); head.scale.set(1.05, 1.0, 1.12); head.position.set(0, 1.5, 1.15); g.add(head)
      const snout = sphere(0.5, belly); snout.scale.set(1.1, 0.85, 0.8); snout.position.set(0, 1.32, 1.75); g.add(snout)
      const nose = sphere(0.16, blackMat); nose.scale.set(1.4, 0.8, 0.7); nose.position.set(0, 1.42, 2.05); g.add(nose)
      for (const sx of [-1, 1]) { const ear = sphere(0.22, body); ear.position.set(sx * 0.52, 2.08, 1.0); g.add(ear) }
      addEyes(1.66, 1.78, 0.36)
      quadLegs(0.62, 0.62, mat(0x80572f), 0.5, 0.55, -0.6, 0.27)
      break
    }
    case 'lion': {
      const torso = sphere(1.0, body); torso.scale.set(1.05, 0.98, 1.32); torso.position.y = 1.1; g.add(torso)
      const maneMat = mat(0x8a4a18)
      for (let layer = 0; layer < 2; layer++) {
        const cnt = 13, rad = 0.92 + layer * 0.16, rr = 0.4 - layer * 0.06
        for (let i = 0; i < cnt; i++) {
          const a = (i / cnt) * Math.PI * 2 + layer * 0.25
          const puff = sphere(rr, maneMat)
          puff.position.set(Math.cos(a) * rad, 1.72 + Math.sin(a) * rad, 1.02 - layer * 0.1); g.add(puff)
        }
      }
      const head = sphere(0.76, body); head.position.set(0, 1.72, 1.22); g.add(head)
      const muzzle = sphere(0.44, belly); muzzle.scale.set(1.15, 0.85, 0.95); muzzle.position.set(0, 1.55, 1.72); g.add(muzzle)
      const nose = sphere(0.13, blackMat); nose.position.set(0, 1.68, 1.98); g.add(nose)
      for (const sx of [-1, 1]) { const ear = sphere(0.19, body); ear.position.set(sx * 0.4, 2.2, 1.2); g.add(ear) }
      addEyes(1.84, 1.82, 0.27)
      quadLegs(0.66, 0.68, mat(0xc98c2e), 0.46, 0.55, -0.58)
      const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.8, 3, 6), body); tail.position.set(0, 1.4, -1.15); tail.rotation.x = 0.9; g.add(tail)
      const tuft = sphere(0.22, maneMat); tuft.position.set(0, 0.98, -1.6); g.add(tuft)
      break
    }
    case 'duck': {
      const torso = sphere(1.0, body); torso.scale.set(1.05, 1.1, 1.3); torso.position.y = 1.2; torso.rotation.x = -0.22; g.add(torso)
      const tailUp = sphere(0.45, body); tailUp.scale.set(0.85, 0.8, 1); tailUp.position.set(0, 1.78, -0.95); g.add(tailUp)
      const head = sphere(0.62, body); head.position.set(0, 2.1, 0.88); g.add(head)
      const beakMat = mat(0xf4a200)
      const upper = sphere(0.36, beakMat); upper.scale.set(1.5, 0.42, 1.5); upper.position.set(0, 2.04, 1.45); g.add(upper)
      const lower = sphere(0.28, beakMat); lower.scale.set(1.3, 0.35, 1.2); lower.position.set(0, 1.9, 1.38); g.add(lower)
      for (const sx of [-1, 1]) { const wing = sphere(0.52, body); wing.scale.set(0.32, 0.72, 1.0); wing.position.set(sx * 0.88, 1.25, 0.05); g.add(wing) }
      addEyes(2.22, 1.32, 0.25, 0.11)
      const footMat = mat(0xf4a200)
      addLeg(-0.3, 0.12, 0.5, footMat, 0.14, footMat); addLeg(0.3, 0.12, 0.5, footMat, 0.14, footMat)
      break
    }
    case 'sheep': {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2
        const layer = i % 2
        const ball = sphere(0.55 + (i % 3) * 0.07, whiteMat)
        ball.position.set(Math.cos(a) * (0.66 + layer * 0.08), 1.2 + Math.sin(a) * 0.46, -0.1 + (layer ? -0.42 : 0.42)); g.add(ball)
      }
      const topFluff = sphere(0.78, whiteMat); topFluff.position.set(0, 1.78, 0); g.add(topFluff)
      const faceMat = mat(0x3a3a44)
      const head = sphere(0.54, faceMat); head.scale.set(1.0, 1.05, 1.1); head.position.set(0, 1.55, 1.05); g.add(head)
      const woolTop = sphere(0.46, whiteMat); woolTop.position.set(0, 1.92, 0.95); g.add(woolTop)
      for (const sx of [-1, 1]) { const ear = sphere(0.2, faceMat); ear.scale.set(1.5, 0.55, 0.85); ear.position.set(sx * 0.54, 1.6, 1.0); g.add(ear) }
      addEyes(1.62, 1.5, 0.23, 0.1)
      quadLegs(0.58, 0.58, faceMat, 0.38, 0.45, -0.5, 0.16)
      break
    }
    case 'zebra': {
      const tex = stripeTexture(0xf2f2f2, 0x232323, 13, 0.5)
      const zmat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.72 })
      const torso = sphere(0.9, zmat); torso.scale.set(1.0, 1.0, 1.42); torso.position.y = 1.18; g.add(torso)
      const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.75, 4, 8), zmat); neck.position.set(0, 1.92, 0.92); neck.rotation.x = -0.62; g.add(neck)
      // 말상 긴 얼굴
      const head = sphere(0.4, zmat); head.scale.set(1.0, 1.05, 1.7); head.position.set(0, 2.34, 1.62); head.rotation.x = 0.32; g.add(head)
      const snout = sphere(0.3, mat(0x33312f)); snout.scale.set(1, 0.85, 0.7); snout.position.set(0, 2.1, 2.12); g.add(snout)
      const nostrilL = sphere(0.05, blackMat); nostrilL.position.set(-0.1, 2.12, 2.32); g.add(nostrilL)
      const nostrilR = sphere(0.05, blackMat); nostrilR.position.set(0.1, 2.12, 2.32); g.add(nostrilR)
      // 검은 모히칸 갈기
      for (let i = 0; i < 8; i++) { const m2 = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.4, 6), blackMat); m2.position.set(0, 2.2 + i * 0.03, 1.28 - i * 0.17); m2.rotation.x = -0.2; g.add(m2) }
      for (const sx of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.36, 7), zmat); ear.position.set(sx * 0.2, 2.66, 1.32); g.add(ear) }
      addEyes(2.46, 1.92, 0.22, 0.1)
      quadLegs(0.78, 0.78, zmat, 0.44, 0.6, -0.62, 0.18, blackMat)
      const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.6, 3, 6), zmat); tail.position.set(0, 1.45, -1.18); tail.rotation.x = 0.7; g.add(tail)
      const ttuft = sphere(0.13, blackMat); ttuft.position.set(0, 1.05, -1.45); g.add(ttuft)
      break
    }
    case 'tiger': {
      const tex = stripeTexture(0xf08a2c, 0x2a1c10, 9, 0.4)
      const tmat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.72 })
      const torso = sphere(0.96, tmat); torso.scale.set(1.05, 0.98, 1.35); torso.position.y = 1.1; g.add(torso)
      const bellyP = sphere(0.62, mat(0xffe6c8)); bellyP.scale.set(0.72, 0.62, 1.2); bellyP.position.set(0, 0.74, 0.12); g.add(bellyP)
      const head = sphere(0.76, tmat); head.position.set(0, 1.6, 1.16); g.add(head)
      const cheekMat = mat(0xffe6c8)
      for (const sx of [-1, 1]) { const cheek = sphere(0.3, cheekMat); cheek.position.set(sx * 0.34, 1.46, 1.6); g.add(cheek) }
      const muzzle = sphere(0.34, cheekMat); muzzle.scale.set(1.1, 0.85, 0.9); muzzle.position.set(0, 1.42, 1.74); g.add(muzzle)
      const nose = sphere(0.12, pinkMat); nose.position.set(0, 1.52, 1.96); g.add(nose)
      for (const sx of [-1, 1]) {
        const ear = sphere(0.22, tmat); ear.position.set(sx * 0.44, 2.12, 1.08); g.add(ear)
        const inner = sphere(0.11, mat(0x2a1c10)); inner.position.set(sx * 0.44, 2.16, 1.16); g.add(inner)
      }
      addEyes(1.7, 1.74, 0.28)
      quadLegs(0.68, 0.68, tmat)
      const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.9, 4, 8), tmat); tail.position.set(0, 1.4, -1.2); tail.rotation.x = 0.8; g.add(tail)
      break
    }
    case 'turtle': {
      const shellMat = mat(0x3c8d52)
      const shell = sphere(1.1, shellMat); shell.scale.set(1.2, 0.78, 1.5); shell.position.y = 1.05; g.add(shell)
      const plateMat = mat(0x2e6e40)
      const plates: [number, number][] = [[0, 0], [0, 0.72], [0, -0.72], [0.58, 0], [-0.58, 0]]
      for (const [px, pz] of plates) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.12, 6), plateMat); p.position.set(px, 1.65, pz); g.add(p) }
      const under = sphere(1.02, belly); under.scale.set(1.1, 0.42, 1.42); under.position.y = 0.78; g.add(under)
      const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.4, 4, 8), body); neck.position.set(0, 1.1, 1.45); neck.rotation.x = 1.35; g.add(neck)
      const head = sphere(0.42, body); head.position.set(0, 1.2, 1.95); g.add(head)
      addEyes(1.28, 2.22, 0.19, 0.09)
      quadLegs(0.36, 0.36, body, 0.74, 0.72, -0.72, 0.2)
      break
    }
    case 'dino': {
      const spotMat = mat(0x4f9e54)
      const torso = sphere(1.18, body); torso.scale.set(1.05, 1.0, 1.4); torso.position.y = 1.35; g.add(torso)
      const bellyP = sphere(0.8, belly); bellyP.scale.set(0.78, 0.62, 1.15); bellyP.position.set(0, 0.95, 0.25); g.add(bellyP)
      // 부드러운 긴 목
      const segs = 8
      for (let i = 0; i < segs; i++) {
        const t = i / (segs - 1)
        const seg = sphere(0.44 - t * 0.16, body)
        seg.position.set(0, 1.85 + t * 1.7, 0.95 + Math.sin(t * 1.1) * 0.75); g.add(seg)
      }
      const head = sphere(0.46, body); head.scale.set(1, 0.95, 1.15); head.position.set(0, 3.55, 1.92); g.add(head)
      const snout = sphere(0.3, belly); snout.scale.set(1, 0.8, 1.2); snout.position.set(0, 3.46, 2.28); g.add(snout)
      for (const sx of [-1, 1]) { const nostril = sphere(0.05, blackMat); nostril.position.set(sx * 0.1, 3.54, 2.5); g.add(nostril) }
      addEyes(3.7, 2.12, 0.2, 0.11)
      // 통통한 꼬리
      for (let i = 0; i < 7; i++) { const t = i / 6; const seg = sphere(0.4 - t * 0.28, body); seg.position.set(0, 1.25 - t * 0.35, -1.2 - t * 0.78); g.add(seg) }
      // 등 둥근 혹 + 점박이
      for (let i = 0; i < 4; i++) { const b = sphere(0.2, spotMat); b.scale.set(1.1, 0.7, 1.1); b.position.set(0, 2.4, 0.6 - i * 0.5); g.add(b) }
      const spots: [number, number, number][] = [[0.5, 1.8, 0.2], [-0.45, 1.5, -0.3], [0.3, 1.4, -0.6], [-0.5, 1.9, -0.1]]
      for (const [sx, sy, sz] of spots) { const sp = sphere(0.17, spotMat); sp.position.set(sx, sy, sz); g.add(sp) }
      quadLegs(0.85, 0.92, mat(0x4f9e54), 0.55, 0.7, -0.72, 0.32)
      break
    }
    default: { // hamster
      const torso = sphere(1.0, body); torso.scale.set(1.1, 1.05, 1.05); torso.position.y = 1.05; g.add(torso)
      const bellyP = sphere(0.64, belly); bellyP.scale.set(0.88, 0.92, 0.6); bellyP.position.set(0, 0.92, 0.72); g.add(bellyP)
      const head = sphere(0.74, body); head.position.set(0, 1.35, 0.78); g.add(head)
      for (const sx of [-1, 1]) { const cheek = sphere(0.34, belly); cheek.position.set(sx * 0.44, 1.16, 1.06); g.add(cheek) }
      const nose = sphere(0.09, pinkMat); nose.position.set(0, 1.22, 1.46); g.add(nose)
      for (const sx of [-1, 1]) {
        const ear = sphere(0.32, body); ear.scale.set(1, 1, 0.55); ear.position.set(sx * 0.52, 1.96, 0.72); g.add(ear)
        const inner = sphere(0.19, pinkMat); inner.scale.set(1, 1, 0.55); inner.position.set(sx * 0.52, 1.96, 0.8); g.add(inner)
      }
      addEyes(1.44, 1.4, 0.27)
      quadLegs(0.34, 0.36, body, 0.42, 0.42, -0.45, 0.17)
      break
    }
  }

  g.scale.setScalar(0.66)
  return { group: g, legs }
}

function disposeObject(o: THREE.Object3D) {
  o.traverse((c) => {
    const m = c as THREE.Mesh
    if (m.geometry) m.geometry.dispose()
    if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => {
      if ('map' in x && x.map instanceof THREE.Texture) x.map.dispose()
      x.dispose()
    })
  })
}

type Theme = {
  sky: number; fog: number
  trackTop: number; trackEdge: number
  centerLine: number; dashed: boolean
}
const THEMES: Record<ThemeKey, Theme> = {
  harbor: { sky: 0xbfe9ff, fog: 0xbfe9ff, trackTop: 0xf2eee0, trackEdge: 0xe2dcc4, centerLine: 0xf4b400, dashed: false },
  city: { sky: 0xa9d4ff, fog: 0xcfe6ff, trackTop: 0x4a4f57, trackEdge: 0x3a3e45, centerLine: 0xffffff, dashed: true },
  forest: { sky: 0xd4f0e6, fog: 0xd8efd0, trackTop: 0xb98a5e, trackEdge: 0x9c7048, centerLine: 0xd8b98a, dashed: true },
}

// ─── 레이스 ───
type Racer = {
  cfg: AnimalCfg; group: THREE.Group; legs: THREE.Object3D[]
  laneX: number; z: number; base: number; phase: number
  boost: number; boostMul: number; nextEvent: number
  finished: boolean; rank: number
  fly: number; flyStartZ: number; flyZTarget: number  // 운석 피격(공중 날아감)
  spin: number; ghost: number                          // 미끄러짐 / 텔레포트 점멸
  abduct: number; freeze: number                        // UFO 납치 / 얼음
  ufo: THREE.Object3D | null; ice: THREE.Object3D | null
  bath: number; tub: THREE.Object3D | null              // 온천욕 (1등만)
}

export function createAnimalRun(canvas: HTMLCanvasElement, entries: AnimalRunEntry[], ordered: number[], cb: Callbacks) {
  const animals = entries.map((entry, i) => ({ ...ANIMALS[i % ANIMALS.length], species: ANIMALS[i % ANIMALS.length].key, key: String(entry.number), name: entry.name }))
  const finishOrder = new Map(ordered.map((number, i) => [String(number), i]))
  const finishTime = (rank: number) => 12.4 + rank * 1.35
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  const scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0xbfe9ff, 80, 240)
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 600)
  camera.position.set(-4, 7, -11)
  scene.add(new THREE.AmbientLight(0xffffff, 0.85))
  const sun = new THREE.DirectionalLight(0xffffff, 1.05); sun.position.set(-30, 50, -20); scene.add(sun)

  const env = new THREE.Group(); scene.add(env)
  const trackGroup = new THREE.Group(); scene.add(trackGroup)
  const podiumGroup = new THREE.Group(); scene.add(podiumGroup)
  const fxGroup = new THREE.Group(); scene.add(fxGroup)  // 운석·포탈·먼지 등 이펙트

  let currentTheme: ThemeKey = 'harbor'
  let currentN = 4

  // 환경 빌더 (테마별)
  const M = (c: number, rough = 1) => new THREE.MeshStandardMaterial({ color: c, roughness: rough })
  function buildEnvironment(theme: ThemeKey) {
    disposeObject(env); env.clear()
    const t = THEMES[theme]
    scene.background = new THREE.Color(t.sky)
    if (scene.fog) (scene.fog as THREE.Fog).color.set(t.fog)

    if (theme === 'harbor') {
      const ocean = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), M(0x2fa8e0, 0.85)); ocean.rotation.x = -Math.PI / 2; ocean.position.y = -1.2; env.add(ocean)
      const island = (x: number, z: number, s: number) => { const grp = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(s * 1.3, s * 1.6, s * 0.5, 6), M(0xe8d8a0)); b.position.y = -1; grp.add(b); const h = new THREE.Mesh(new THREE.ConeGeometry(s, s * 1.4, 6), M(0x6fbf73)); h.position.y = s * 0.5; grp.add(h); grp.position.set(x, 0, z); env.add(grp) }
      const ship = (x: number, z: number, r: number) => { const grp = new THREE.Group(); const hull = new THREE.Mesh(new THREE.BoxGeometry(5, 2, 2), M(0x7a4a26)); grp.add(hull); const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6), M(0x5a3518)); mast.position.y = 3; grp.add(mast); const sail = new THREE.Mesh(new THREE.PlaneGeometry(3, 3.4), new THREE.MeshStandardMaterial({ color: 0xf3ead2, side: THREE.DoubleSide, roughness: 1 })); sail.position.set(0, 3.2, 0); grp.add(sail); grp.position.set(x, 0.3, z); grp.rotation.y = r; env.add(grp) }
      const lighthouse = (x: number, z: number) => { const grp = new THREE.Group(); const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.0, 5, 10), M(0xffffff)); tw.position.y = 1.5; grp.add(tw); const band = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.85, 1.4, 10), M(0xe24a4a)); band.position.y = 1.8; grp.add(band); const top = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1, 10), M(0xc0392b)); top.position.y = 4.5; grp.add(top); grp.position.set(x, 0, z); env.add(grp) }
      island(-46, 30, 9); island(52, 70, 11); island(-60, 95, 8); island(58, 18, 7)
      ship(-22, 60, 0.6); ship(30, 88, -0.5); ship(-26, 110, 0.2); ship(26, 35, -0.8)
      lighthouse(-14, 20); lighthouse(15, 100)
      for (let k = 0; k < 6; k++) { const buoy = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.2, 8), M(k % 2 ? 0xe24a4a : 0xffffff)); buoy.position.set((k % 2 ? 1 : -1) * 12, -0.3, 25 + k * 12); env.add(buoy) }
    } else if (theme === 'city') {
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), M(0x8fae6a)); ground.rotation.x = -Math.PI / 2; ground.position.y = -1.2; env.add(ground)
      const winMat = M(0xfff3b0, 0.5)
      const building = (x: number, z: number, w: number, h: number, c: number) => {
        const grp = new THREE.Group()
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), M(c)); b.position.y = h / 2; grp.add(b)
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 1.05, 0.4, w * 1.05), M(0x5a6470)); roof.position.y = h; grp.add(roof)
        const rows = Math.max(2, Math.floor(h / 1.6))
        for (let r = 0; r < rows; r++) for (let cI = 0; cI < 2; cI++) {
          const win = new THREE.Mesh(new THREE.BoxGeometry(w * 0.22, 0.5, 0.1), winMat)
          win.position.set((cI ? 1 : -1) * w * 0.22, 0.9 + r * 1.5, w / 2 + 0.05); grp.add(win)
        }
        grp.position.set(x, 0, z); env.add(grp)
      }
      const colors = [0xe8a0a0, 0xa0c4e8, 0xb8e0a0, 0xe8d0a0, 0xc8a0e8]
      for (let k = 0; k < 9; k++) { building(-(11 + (k % 3) * 4), 18 + k * 8, 3 + (k % 2), 4 + (k % 4) * 2.2, colors[k % 5]); building(11 + (k % 3) * 4, 14 + k * 9, 3 + ((k + 1) % 2), 4 + ((k + 2) % 4) * 2.2, colors[(k + 2) % 5]) }
      const tree = (x: number, z: number) => { const grp = new THREE.Group(); const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1, 6), M(0x8a5a2b)); tr.position.y = 0.5; grp.add(tr); const cr = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), M(0x5fae5f)); cr.position.y = 1.5; grp.add(cr); grp.position.set(x, 0, z); env.add(grp) }
      const lamp = (x: number, z: number) => { const grp = new THREE.Group(); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3, 6), M(0x4a4f57)); p.position.y = 1.5; grp.add(p); const hd = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), M(0xfff3b0)); hd.position.y = 3; grp.add(hd); grp.position.set(x, 0, z); env.add(grp) }
      for (let k = 0; k < 8; k++) { tree((k % 2 ? 1 : -1) * 7, 22 + k * 10); lamp((k % 2 ? -1 : 1) * 6.5, 16 + k * 11) }
    } else {
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), M(0x6fbf73)); ground.rotation.x = -Math.PI / 2; ground.position.y = -1.2; env.add(ground)
      const pine = (x: number, z: number, s: number) => { const grp = new THREE.Group(); const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * s, 0.4 * s, 1.4 * s, 6), M(0x7a4f2a)); tr.position.y = 0.7 * s; grp.add(tr); for (let i = 0; i < 3; i++) { const cone = new THREE.Mesh(new THREE.ConeGeometry((1.4 - i * 0.35) * s, 1.5 * s, 7), M(i % 2 ? 0x3f8f4f : 0x4fa05f)); cone.position.y = (1.5 + i * 1.0) * s; grp.add(cone) } grp.position.set(x, 0, z); env.add(grp) }
      const bush = (x: number, z: number) => { const grp = new THREE.Group(); for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), M(0x4fa05f)); b.position.set((i - 1) * 0.5, 0.4, 0); grp.add(b) } grp.position.set(x, 0, z); env.add(grp) }
      const mushroom = (x: number, z: number) => { const grp = new THREE.Group(); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.6, 6), M(0xf3ead2)); st.position.y = 0.3; grp.add(st); const cap = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), M(0xe24a4a)); cap.position.y = 0.6; grp.add(cap); grp.position.set(x, 0, z); env.add(grp) }
      for (let k = 0; k < 10; k++) { pine(-(8 + (k % 3) * 5), 16 + k * 8, 1 + (k % 3) * 0.4); pine(8 + (k % 3) * 5, 12 + k * 9, 1.1 + (k % 2) * 0.5) }
      for (let k = 0; k < 6; k++) { bush((k % 2 ? 1 : -1) * 6, 24 + k * 12); mushroom((k % 2 ? -1 : 1) * 5.5, 20 + k * 13) }
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 3, 8), M(0x7a4f2a)); log.rotation.z = Math.PI / 2; log.position.set(-6, 0, 70); env.add(log)
    }
  }

  let trackBuiltForN = 0, trackBuiltTheme: ThemeKey | null = null
  function buildTrack(n: number, theme: ThemeKey) {
    disposeObject(trackGroup); trackGroup.clear()
    const t = THEMES[theme]
    const w = TRACK_W(n)
    const lane = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, FINISH_Z + 50), M(t.trackTop)); lane.position.set(0, -0.2, FINISH_Z / 2 - 5); trackGroup.add(lane)
    // 가장자리 라인
    for (const sx of [-1, 1]) { const edge = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.06, FINISH_Z + 40), M(t.trackEdge)); edge.position.set(sx * (w / 2 - 0.4), 0.02, FINISH_Z / 2 - 5); trackGroup.add(edge) }
    // 중앙선 (실선/점선)
    if (t.dashed) {
      for (let z = 0; z < FINISH_Z + 20; z += 4) { const dash = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.04, 2), M(t.centerLine)); dash.position.set(0, 0.03, z); trackGroup.add(dash) }
    } else {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, FINISH_Z + 30), M(t.centerLine)); line.position.set(0, 0.03, FINISH_Z / 2 - 5); trackGroup.add(line)
    }
    // 결승선 체크무늬
    const tiles = Math.ceil(w / 1)
    for (let i = 0; i < tiles; i++) for (let j = 0; j < 2; j++) { const dark = (i + j) % 2 === 0; const tile = new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 1), M(dark ? 0x222222 : 0xffffff)); tile.position.set(-w / 2 + 0.5 + i, 0.06, FINISH_Z + j); trackGroup.add(tile) }
    trackBuiltForN = n; trackBuiltTheme = theme
  }

  function setTheme(theme: ThemeKey) {
    currentTheme = theme
    buildEnvironment(theme)
    buildTrack(currentN, theme)
    // 셋업/테마 변경 시 이전 시상식 잔재(시상대·컨페티·이펙트) 정리 + 유휴 카메라로
    if (podium || racers.length) { podium = false; running = false; clearPodium(); clearRacers(); clearFx() }
  }

  // ── 레이스 기믹(운석/텔레포트/부스트/미끄러짐) 이펙트 ──
  const fx: THREE.Object3D[] = []
  let worldT = 0
  let quakeT = 0
  const removeFx = (o: THREE.Object3D) => { const i = fx.indexOf(o); if (i >= 0) fx.splice(i, 1); fxGroup.remove(o); disposeObject(o) }
  function clearFx() { for (const o of [...fx]) removeFx(o) }
  const basicMat = (c: number, op = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: op < 1, opacity: op })
  function buildMeteor() {
    const grp = new THREE.Group()
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.75, 0), M(0x4a3f3a)); grp.add(rock)
    const glow = new THREE.Mesh(new THREE.SphereGeometry(1.05, 10, 10), basicMat(0xff7a2a, 0.4)); grp.add(glow)
    const trail = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.6, 8), basicMat(0xffc24a, 0.55)); trail.position.y = 1.6; grp.add(trail)
    return grp
  }
  function spawnPortal(x: number, z: number) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.18, 8, 22), basicMat(0x6cf0ff, 0.95))
    ring.position.set(x, 1.1, z); ring.rotation.x = Math.PI / 2; ring.userData = { kind: 'portal', t: 0 }
    fx.push(ring); fxGroup.add(ring)
  }
  function spawnDust(x: number, z: number) {
    const d = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.6, 18), new THREE.MeshBasicMaterial({ color: 0xffe0b0, transparent: true, opacity: 0.85, side: THREE.DoubleSide }))
    d.rotation.x = -Math.PI / 2; d.position.set(x, 0.12, z); d.userData = { kind: 'dust', t: 0 }
    fx.push(d); fxGroup.add(d)
  }
  const liveRacers = () => racers.filter((r) => !r.finished && r.fly <= 0 && r.spin <= 0 && r.abduct <= 0 && r.freeze <= 0 && r.bath <= 0)
  function fireMeteor() {
    const c = liveRacers(); if (!c.length) return
    c.sort((a, b) => b.z - a.z)
    const target = c[0] // 1등(맨 앞)만 정확히 노림 → 대역전
    const m = buildMeteor(); m.position.set(target.laneX, 17, target.z); m.userData = { kind: 'meteor', target, t: 0 }
    fx.push(m); fxGroup.add(m)
    audio.play('meteorLaunch')
    cb.onEvent?.('☄️ 운석 낙하!')
  }
  function buildUFO() {
    const g = new THREE.Group()
    const saucer = new THREE.Mesh(new THREE.SphereGeometry(1.0, 16, 10), M(0xb8c2cc)); saucer.scale.set(1.5, 0.42, 1.5); g.add(saucer)
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), basicMat(0x9be8ff, 0.7)); dome.position.y = 0.2; g.add(dome)
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const lt = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), basicMat(0x6cf0ff)); lt.position.set(Math.cos(a) * 1.35, -0.1, Math.sin(a) * 1.35); g.add(lt) }
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 1.4, 4, 14, 1, true), basicMat(0x8cf0c0, 0.22)); beam.position.y = -2.2; g.add(beam)
    return g
  }
  function buildIce() {
    const ice = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.8, 3.2), new THREE.MeshStandardMaterial({ color: 0x9be8ff, transparent: true, opacity: 0.42, roughness: 0.05, metalness: 0.1 }))
    ice.position.y = 1.8
    return ice
  }
  function fireAbduct() {
    const c = liveRacers(); if (!c.length) return
    c.sort((a, b) => b.z - a.z)
    const target = c[0] // 1등(맨 앞)만 — UFO 납치
    target.abduct = 1.4
    const ufo = buildUFO(); ufo.userData = { kind: 'ufo', target, t: 0 }; ufo.position.set(target.laneX, 6.5, target.z)
    fx.push(ufo); fxGroup.add(ufo)
    audio.play('abduct')
    cb.onEvent?.('🛸 UFO 납치!')
  }
  function fireFreeze() {
    const c = liveRacers(); if (!c.length) return
    const target = c[Math.floor(Math.random() * c.length)]
    target.freeze = 1.4
    const ice = buildIce(); target.group.add(ice); target.ice = ice
    audio.play('freeze')
    cb.onEvent?.('🧊 얼음!')
  }
  function fireQuake() { quakeT = 1.3; audio.play('quake'); cb.onEvent?.('🌋 지진!') }
  function buildBath() {
    const g = new THREE.Group()
    const tub = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 1.4, 18, 1, true), M(0x9a8a76)); tub.position.y = 0.7; g.add(tub)
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.25, 0.22, 8, 20), M(0x73624f)); rim.rotation.x = Math.PI / 2; rim.position.y = 1.4; g.add(rim)
    const water = new THREE.Mesh(new THREE.CylinderGeometry(2.18, 2.18, 0.12, 18), basicMat(0x7fd4e8, 0.72)); water.position.y = 1.3; g.add(water)
    const steam: THREE.Mesh[] = []
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const puff = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), basicMat(0xffffff, 0.4)); puff.position.set(Math.cos(a) * 1.1, 1.5 + Math.random() * 1.2, Math.sin(a) * 1.1); g.add(puff); steam.push(puff) }
    g.userData.steam = steam
    return g
  }
  function fireSpring() {
    const c = liveRacers(); if (!c.length) return
    c.sort((a, b) => b.z - a.z)
    const target = c[0] // 1등(맨 앞)만 — 느긋하게 온천욕
    target.bath = 1.9
    const tub = buildBath(); target.group.add(tub); target.tub = tub
    audio.play('spring')
    cb.onEvent?.('♨️ 온천욕!')
  }
  function fireTeleport() {
    const c = liveRacers(); if (c.length < 2) return
    c.sort((a, b) => a.z - b.z)
    const target = c[0] // 꼴찌가 순간이동으로 추격
    spawnPortal(target.laneX, target.z)
    target.z = Math.min(FINISH_Z - 2, target.z + 13 + Math.random() * 7)
    target.ghost = 0.45
    spawnPortal(target.laneX, target.z)
    audio.play('teleport')
    cb.onEvent?.('✨ 텔레포트!')
  }
  function fireBoost() {
    const c = liveRacers(); if (!c.length) return
    const target = c[Math.floor(Math.random() * c.length)]
    target.boost = 1.6 + Math.random() * 0.6; target.boostMul = 2.4 + Math.random() * 0.6
    audio.play('boost')
    cb.onEvent?.('🚀 로켓 부스트!')
  }
  function fireSpin() {
    const c = liveRacers(); if (!c.length) return
    c.sort((a, b) => b.z - a.z)
    const target = c[0] // 1등(맨 앞)만 — 미끄덩
    target.spin = 1.0
    audio.play('spin')
    cb.onEvent?.('🍌 미끄덩!')
  }
  function fireWorldEvent() {
    const roll = Math.random()
    if (roll < 0.14) fireMeteor()
    else if (roll < 0.28) fireTeleport()
    else if (roll < 0.41) fireBoost()
    else if (roll < 0.52) fireSpin()
    else if (roll < 0.66) fireAbduct()
    else if (roll < 0.79) fireFreeze()
    else if (roll < 0.89) fireQuake()
    else fireSpring()
  }

  // ── 시상식 ──
  const confetti: THREE.Mesh[] = []
  let racers: Racer[] = []
  let running = false, preRace = false, podium = false, raceTime = 0, finishedCount = 0
  let raceStartedAt = 0
  const timers: number[] = []
  const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms))
  const camTarget = { px: -4, py: 7, pz: -11, lx: 0, ly: 1.2, lz: 4 }
  const startTime = performance.now()
  let prevFrame = startTime

  function clearRacers() { for (const r of racers) { scene.remove(r.group); disposeObject(r.group) } racers = [] }
  function clearPodium() { disposeObject(podiumGroup); confetti.length = 0; podiumGroup.clear() }

  type Winner = { group: THREE.Group; baseY: number }
  type Clapper = { group: THREE.Group; phaseOff: number }
  let winners: Winner[] = []
  let clappers: Clapper[] = []

  function arrangePodium() {
    clearPodium(); clearFx()
    winners = []; clappers = []
    const sorted = racers.filter((r) => r.rank > 0).sort((a, b) => a.rank - b.rank)
    const boxMat = sorted.map((_, i) => M(i === 0 ? 0xffd45e : 0xc8d0da))
    const boxH = [2.0, 1.4]
    const boxX = sorted.length === 1 ? [0] : [1.5, -1.5]
    const baseZ = FINISH_Z + 5
    for (let i = 0; i < sorted.length; i++) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(2.0, boxH[i], 1.8), boxMat[i])
      box.position.set(boxX[i], boxH[i] / 2, baseZ); podiumGroup.add(box)
      const r = sorted[i]
      r.group.position.set(boxX[i], boxH[i], baseZ)
      r.group.rotation.set(0, 0, 0)
      r.group.scale.setScalar(0.66 * 1.1)
      winners.push({ group: r.group, baseY: boxH[i] })
    }
    // 4등 이하 — 시상대 앞에서 박수/점프
    const rest = racers.filter((r) => !r.rank)
    rest.forEach((r, i) => {
      const x = (i - (rest.length - 1) / 2) * 2.0
      r.group.position.set(x, 0, baseZ - 4.5)
      r.group.rotation.set(0, 0, 0)
      r.group.scale.setScalar(0.6)
      clappers.push({ group: r.group, phaseOff: i * 1.3 })
    })
    // 컨페티
    const cols = [0xFFD45E, 0xFF6CAB, 0x64A7FF, 0x5fd38a, 0xffffff]
    for (let i = 0; i < 70; i++) {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.34), new THREE.MeshStandardMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide, roughness: 1 }))
      c.position.set((Math.random() - 0.5) * 12, 6 + Math.random() * 8, baseZ + (Math.random() - 0.5) * 6)
      c.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3)
      c.userData.vy = 1.2 + Math.random() * 1.6
      c.userData.vr = (Math.random() - 0.5) * 4
      podiumGroup.add(c); confetti.push(c)
    }
    podium = true
    camTarget.px = 0; camTarget.py = 4.6; camTarget.pz = baseZ + 11; camTarget.lx = 0; camTarget.ly = 2.4; camTarget.lz = baseZ
  }

  function start(keys: string[], theme: ThemeKey) {
    clearRacers(); clearPodium(); clearFx(); podium = false; worldT = 1.4 + Math.random() * 1.0
    const n = keys.length; currentN = n
    if (theme !== currentTheme || trackBuiltTheme !== theme) setTheme(theme)
    else if (trackBuiltForN !== n) buildTrack(n, theme)
    finishedCount = 0; raceTime = 0
    keys.forEach((key, i) => {
      const cfg = animals.find((a) => a.key === key)!
      const { group, legs } = buildAnimal(cfg)
      const laneX = (i - (n - 1) / 2) * LANE_GAP
      group.position.set(laneX, 0, 0); scene.add(group)
      const label = document.createElement('canvas'); label.width = 256; label.height = 64
      const ctx = label.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#142b42'; ctx.beginPath(); ctx.roundRect(2, 2, 252, 60, 25); ctx.fill()
        ctx.font = 'bold 28px system-ui'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(`#${cfg.key} ${cfg.name}`, 128, 34, 232)
        const map = new THREE.CanvasTexture(label); map.colorSpace = THREE.SRGBColorSpace
        const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map, depthWrite: false }))
        tag.position.set(0, cfg.species === 'dino' ? 4.5 : 3.25, 0); tag.scale.set(3.5, 0.875, 1); group.add(tag)
      }
      racers.push({ cfg, group, legs, laneX, z: 0, base: 8.5 + Math.random() * 1, phase: Math.random() * Math.PI * 2, boost: 0, boostMul: 1, nextEvent: 0.4 + Math.random() * 1.1, finished: false, rank: 0, fly: 0, flyStartZ: 0, flyZTarget: 0, spin: 0, ghost: 0, abduct: 0, freeze: 0, ufo: null, ice: null, bath: 0, tub: null })
    })
    camera.position.set(-4, 7, -11)
    preRace = true; running = true
    // The stage can open without an audio gesture; keep playback optional.
    audio.resume(); audio.startBgm() // 출발 버튼(사용자 제스처) 안 → 모바일 자동재생 정책 통과
    cb.onCountdown('READY')
    later(() => { if (running) { cb.onCountdown('3'); audio.play('count') } }, 700)
    later(() => { if (running) { cb.onCountdown('2'); audio.play('count') } }, 1300)
    later(() => { if (running) { cb.onCountdown('1'); audio.play('count') } }, 1900)
    later(() => { if (running) { cb.onCountdown('GO!'); audio.play('go'); raceStartedAt = performance.now(); preRace = false } }, 2500)
    later(() => { if (running) cb.onCountdown('') }, 3100)
  }

  let raf = 0
  function tick() {
    raf = requestAnimationFrame(tick)
    if (document.hidden) return
    const now = performance.now()
    const dt = Math.min((now - prevFrame) / 1000, 0.10)
    prevFrame = now
    const t = (now - startTime) / 1000

    if (running && !preRace) {
      raceTime = (now - raceStartedAt) / 1000
      if (quakeT > 0) quakeT -= dt
      // 월드 이벤트 스케줄러 (0.8초 이후 ~ 결승 직전까지, 더 잦게)
      worldT -= dt
      let leadNow = 0; for (const r of racers) leadNow = Math.max(leadNow, r.z)
      if (worldT <= 0 && raceTime > 0.8 && leadNow < FINISH_Z - 4) { fireWorldEvent(); worldT = 1.1 + Math.random() * 1.4 }
      // 이펙트 업데이트
      for (const f of [...fx]) {
        const u = f.userData as { kind: string; t: number; target?: Racer }
        u.t += dt
        if (u.kind === 'meteor') {
          const p = Math.min(1, u.t / 0.7); const tg = u.target!
          f.position.set(tg.laneX, 17 * (1 - p) + 1.2 * p, tg.z)
          f.children[0].rotation.x += dt * 9; f.children[0].rotation.y += dt * 7
          if (p >= 1) { if (!tg.finished && tg.fly <= 0) { tg.fly = 1.05; tg.flyStartZ = tg.z; tg.flyZTarget = Math.max(0, tg.z - 12); audio.play('meteorImpact') } spawnDust(tg.laneX, tg.z); removeFx(f) }
        } else if (u.kind === 'portal') { const p = u.t / 0.5; f.scale.setScalar(0.5 + p * 1.8); (f as THREE.Mesh).material && (((f as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.95 * (1 - p)); if (p >= 1) removeFx(f) }
        else if (u.kind === 'dust') { const p = u.t / 0.5; f.scale.setScalar(1 + p * 3.5); (((f as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - p)); if (p >= 1) removeFx(f) }
        else if (u.kind === 'ufo') { const tg = u.target!; f.position.set(tg.laneX, 6.5, tg.z); f.rotation.y += dt * 2.2; if (tg.abduct <= 0 || tg.finished) removeFx(f) }
      }
      for (const r of racers) {
        if (r.finished) continue
        const rank = finishOrder.get(r.cfg.key)
        if (rank !== undefined && raceTime >= finishTime(rank)) {
          r.z = FINISH_Z; r.finished = true; r.rank = rank + 1; finishedCount++
          r.group.position.set(r.laneX, 0, FINISH_Z)
          r.group.rotation.set(0, 0, 0)
          cb.onPlace(finishedCount)
          continue
        }
        if (rank !== undefined && raceTime > finishTime(rank) - 3.4) {
          const approach = Math.max(0, Math.min(1, (raceTime - finishTime(rank) + 3.4) / 3.4))
          r.z = Math.max(r.z, FINISH_Z - 42 * (1 - approach))
          r.fly = 0; r.abduct = 0; r.freeze = 0; r.bath = 0; r.spin = 0; r.ghost = 0
        }
        // 운석 피격 — 공중으로 날아가 뒤로 밀림 (전진 정지)
        if (r.fly > 0) {
          r.fly -= dt; const p = 1 - r.fly / 1.05
          r.z = r.flyStartZ + (r.flyZTarget - r.flyStartZ) * Math.min(1, p * 1.5)
          r.group.position.set(r.laneX, Math.sin(p * Math.PI) * 3.2 + 0.1, r.z)
          r.group.rotation.x += dt * 11; r.group.rotation.z += dt * 7
          if (r.fly <= 0) { r.group.rotation.set(0, 0, 0) }
          continue
        }
        // UFO 납치 — 위로 끌려올라갔다가 떨어지며 뒤로 밀림
        if (r.abduct > 0) {
          r.abduct -= dt; const p = 1 - r.abduct / 1.4
          let y = 0
          if (p < 0.3) y = (p / 0.3) * 4.2
          else if (p < 0.72) y = 4.2 + Math.sin(p * 22) * 0.12
          else y = 4.2 * (1 - (p - 0.72) / 0.28)
          r.group.position.set(r.laneX, Math.max(0, y) + 0.05, r.z)
          r.group.rotation.y += dt * 4
          if (r.abduct <= 0) { r.z = Math.max(0, r.z - 6); r.group.rotation.set(0, 0, 0); r.group.position.y = 0 }
          continue
        }
        // 얼음 — 제자리 동결
        if (r.freeze > 0) {
          r.freeze -= dt; r.group.position.set(r.laneX, 0, r.z)
          if (r.freeze <= 0 && r.ice) { r.group.remove(r.ice); disposeObject(r.ice); r.ice = null }
          continue
        }
        // 온천욕 — 느긋하게 멈춰 목욕 (김 모락모락)
        if (r.bath > 0) {
          r.bath -= dt
          r.group.position.set(r.laneX, Math.sin(t * 2.5) * 0.06, r.z)
          if (r.tub) { const steam = r.tub.userData.steam as THREE.Mesh[]; for (const s of steam) { s.position.y += dt * 0.85; const op = 0.45 - (s.position.y - 1.5) * 0.18; (s.material as THREE.MeshBasicMaterial).opacity = Math.max(0, op); if (s.position.y > 3.6) s.position.y = 1.5 } }
          if (r.bath <= 0 && r.tub) { r.group.remove(r.tub); disposeObject(r.tub); r.tub = null; r.group.position.y = 0 }
          continue
        }
        // 미끄러짐 — 제자리 회전 (전진 정지)
        if (r.spin > 0) {
          r.spin -= dt; r.group.rotation.y += dt * 16
          r.group.position.set(r.laneX, 0, r.z)
          if (r.spin <= 0) r.group.rotation.y = 0
          continue
        }
        // 텔레포트 점멸(시각) — 전진은 정상
        if (r.ghost > 0) { r.ghost -= dt; r.group.scale.setScalar(0.66 * (0.35 + 0.65 * Math.abs(Math.sin(r.ghost * 42)))) }
        else if (Math.abs(r.group.scale.x - 0.66) > 0.001) r.group.scale.setScalar(0.66)

        r.nextEvent -= dt
        if (r.nextEvent <= 0) {
          const roll = Math.random()
          if (roll < 0.45) { r.boost = 0.4 + Math.random() * 0.45; r.boostMul = 1.55 + Math.random() * 0.5 }
          else if (roll < 0.68) { r.boost = 0.3 + Math.random() * 0.35; r.boostMul = 0.55 + Math.random() * 0.2 }
          else { r.boost = 0; r.boostMul = 1 }
          r.nextEvent = 0.5 + Math.random() * 1.3
        }
        let mul = 1; if (r.boost > 0) { r.boost -= dt; mul = r.boostMul }
        if (quakeT > 0) mul *= 0.4 // 지진: 전원 감속
        const speed = r.base * mul
        r.z = Math.min(FINISH_Z - (rank === undefined ? 3 : 0.6), r.z + speed * dt)
        r.phase += dt * (8 + speed * 0.5)
        r.legs.forEach((leg, i) => { leg.rotation.x = Math.sin(r.phase + (i % 2 === 0 ? 0 : Math.PI)) * 0.85 })
        r.group.position.set(r.laneX, Math.abs(Math.sin(r.phase)) * 0.25, r.z)
        r.group.rotation.z = Math.sin(r.phase) * 0.05 + (quakeT > 0 ? Math.sin(t * 45 + r.laneX) * 0.07 : 0)
      }
      // 카메라: 전체 필드가 보이게 — 꼴찌 뒤에서 높이·거리 자동 조절(벌어질수록 더 멀리)
      let front = 0, back = Infinity
      for (const r of racers) { if (r.z > front) front = r.z; if (r.z < back) back = r.z }
      if (!isFinite(back)) back = 0
      front = Math.min(front, FINISH_Z)
      const spread = Math.min(42, Math.max(0, front - back))
      camera.position.x += (-3 - camera.position.x) * 0.05
      camera.position.z += ((back - (13 + spread * 0.2)) - camera.position.z) * 0.07
      camera.position.y += ((9 + spread * 0.16) - camera.position.y) * 0.05
      // 지진 흔들림
      const sx = quakeT > 0 ? (Math.random() - 0.5) * (quakeT / 1.3) * 1.3 : 0
      const sy = quakeT > 0 ? (Math.random() - 0.5) * (quakeT / 1.3) * 1.3 : 0
      camera.position.x += sx; camera.position.y += sy
      camera.lookAt(sx * 0.4, 1.4 + sy * 0.4, back + spread * 0.55 + 3)
      if (finishedCount >= finishOrder.size) {
        running = false
        audio.stopBgm(); audio.play('fanfare')
        arrangePodium()
        const res = racers.filter((r) => r.rank > 0).map((r) => ({ key: r.cfg.key, name: r.cfg.name, rank: r.rank })).sort((a, b) => a.rank - b.rank)
        later(() => cb.onFinish(res), 1700)
      }
    } else if (preRace) {
      camera.position.set(-9, 10, -18)
      for (const r of racers) r.group.position.y = Math.abs(Math.sin(t * 6 + r.phase)) * 0.12
      camera.lookAt(0, 1.2, 4)
    } else if (podium) {
      winners.forEach((w, i) => { w.group.position.y = w.baseY + Math.sin(t * 3 + i) * 0.07; w.group.rotation.y = Math.sin(t * 1.2 + i) * 0.15 })
      clappers.forEach((c) => { const j = Math.abs(Math.sin(t * 7 + c.phaseOff)); c.group.position.y = j * 0.35; c.group.rotation.z = Math.sin(t * 7 + c.phaseOff) * 0.12 })
      for (const c of confetti) { c.position.y -= c.userData.vy * dt; c.rotation.x += c.userData.vr * dt; c.rotation.z += c.userData.vr * dt * 0.7; if (c.position.y < 0) c.position.y = 10 + Math.random() * 5 }
      camera.position.x += (camTarget.px - camera.position.x) * 0.06
      camera.position.y += (camTarget.py - camera.position.y) * 0.06
      camera.position.z += (camTarget.pz - camera.position.z) * 0.06
      camera.lookAt(camTarget.lx, camTarget.ly, camTarget.lz)
    } else {
      camera.position.set(Math.sin(t * 0.15) * 14, 9, -14 + Math.cos(t * 0.15) * 4)
      camera.lookAt(0, 1, 20)
    }
    renderer.render(scene, camera)
  }

  function resize() {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight)
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.fov = camera.aspect < 1 ? 77 : 55
    camera.updateProjectionMatrix()
  }
  resize()
  const observer = new ResizeObserver(resize); observer.observe(canvas)
  start(animals.map(a => a.key), 'forest')
  raf = requestAnimationFrame(tick)

  function dispose() { running = false; audio.stopBgm(); cancelAnimationFrame(raf); observer.disconnect(); timers.forEach(id => window.clearTimeout(id)); clearRacers(); clearPodium(); clearFx(); disposeObject(scene); renderer.dispose() }
  return { dispose, setSound: audio.setEnabled, getSound: audio.isEnabled }
}
