// 나무 · 풀 · 꽃 · 바위 · 갈대 · 덤불. 나무는 3~5개의 큰 수관 덩어리 + 짧은 줄기(제작 프롬프트 4쪽).
// 장식용은 인스턴싱(그리기 한 번), 흔들 수 있는 나무는 따로(흔들림 연출).
import * as THREE from 'three';
import { BOUNDS, GARDEN, GREENHOUSE, HOME, LAKE, PATHS, PLAZA, WORKSHOP, BOUTIQUE, SHAKE_TREES, FLOWER_SPOTS, NAV_NODES, ROCKS, GATE_SIGN, type V2 } from '../../data/world';
import { mat } from '../materials';
import { blob, merge, paint, part, place, rng } from '../geom';
import { groundHeight, outsideDist } from './terrain';

export type TreeKind = 'round' | 'pine' | 'fruit' | 'blossom';

// ── 수관/줄기 도형(정점색 굽기: 위 밝게 · 아래 어둡게 → 부드러운 입체감) ──
function crownGeo(kind: TreeKind): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  if (kind === 'pine') {
    const tiers: Array<[number, number, number, string]> = [
      [1.15, 1.35, 1.35, '#4E7E55'],
      [0.92, 1.15, 2.05, '#568A5C'],
      [0.64, 0.95, 2.7, '#62966A'],
    ];
    for (const [r, h, y, c] of tiers) {
      const cone = new THREE.ConeGeometry(r, h, 12, 2);
      parts.push(part(cone, c, 0, y, 0));
      // 아래 둥근 치마
      const skirt = new THREE.SphereGeometry(r * 0.92, 12, 6, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45);
      parts.push(part(skirt, c, 0, y - h * 0.5 + 0.12, 0, 0, 0, 0, 1, 0.35, 1));
    }
    return merge(parts);
  }
  const pal: Record<string, [string, string, string]> = {
    round: ['#78AB64', '#669A59', '#5A8A52'],
    fruit: ['#7CAD62', '#6C9D58', '#5F8E52'],
    blossom: ['#F6D3DE', '#EEBBCB', '#E6AABD'],
  };
  const [top, mid, low] = pal[kind];
  const blobs: Array<[number, number, number, number, string]> = [
    [0, 2.2, 0, 1.08, mid],
    [0.62, 1.95, 0.18, 0.78, low],
    [-0.58, 2.0, -0.1, 0.82, low],
    [0.12, 2.75, -0.12, 0.74, top],
    [-0.22, 1.82, 0.5, 0.7, mid],
  ];
  for (const [x, y, z, r, c] of blobs) parts.push(part(blob(r, 11), c, x, y, z));
  if (kind === 'fruit') {
    const fr = rng(31);
    for (let i = 0; i < 9; i++) {
      const a = fr() * Math.PI * 2;
      const yy = 1.7 + fr() * 1.1;
      const rr = 0.95 + fr() * 0.25;
      parts.push(part(new THREE.SphereGeometry(0.09, 10, 8), i % 2 ? '#E8836B' : '#F0A35E', Math.cos(a) * rr, yy, Math.sin(a) * rr));
    }
  }
  return merge(parts);
}

function trunkGeo(kind: TreeKind): THREE.BufferGeometry {
  const h = kind === 'pine' ? 1.2 : 1.55;
  const t = new THREE.CylinderGeometry(0.15, 0.23, h, 10);
  const parts = [part(t, '#8E6A4C', 0, h / 2, 0)];
  // 뿌리 쪽 살짝 퍼짐
  parts.push(part(new THREE.CylinderGeometry(0.23, 0.32, 0.18, 10), '#856247', 0, 0.09, 0));
  return merge(parts);
}

const crownCache = new Map<TreeKind, THREE.BufferGeometry>();
const trunkCache = new Map<TreeKind, THREE.BufferGeometry>();
export function getCrown(kind: TreeKind) {
  if (!crownCache.has(kind)) crownCache.set(kind, crownGeo(kind));
  return crownCache.get(kind)!;
}
export function getTrunk(kind: TreeKind) {
  if (!trunkCache.has(kind)) trunkCache.set(kind, trunkGeo(kind));
  return trunkCache.get(kind)!;
}

export const crownMat = () => mat('#ffffff', { vertexColors: true, rough: 0.92, occlude: true, sway: { base: 1.3, amp: 0.028 } });
export const trunkMat = () => mat('#fffffc', { vertexColors: true, rough: 0.95, occlude: true });

// ── 비워 둘 곳(길·건물·호수·정원·광장) ──
function distToSeg(px: number, pz: number, a: V2, b: V2) {
  const vx = b[0] - a[0];
  const vz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((px - a[0]) * vx + (pz - a[1]) * vz) / (vx * vx + vz * vz || 1)));
  return Math.hypot(px - (a[0] + vx * t), pz - (a[1] + vz * t));
}

const RECTS: Array<{ x: number; z: number; w: number; d: number }> = [
  { x: HOME.house[0], z: HOME.house[1], w: HOME.houseSize[0] + 1.6, d: HOME.houseSize[1] + 1.6 },
  { x: (HOME.yard.minX + HOME.yard.maxX) / 2, z: (HOME.yard.minZ + HOME.yard.maxZ) / 2, w: HOME.yard.maxX - HOME.yard.minX + 1.2, d: HOME.yard.maxZ - HOME.yard.minZ + 1.2 },
  { x: GREENHOUSE.center[0], z: GREENHOUSE.center[1], w: GREENHOUSE.size[0] + 2, d: GREENHOUSE.size[1] + 2 },
  { x: 17.2, z: 13.2, w: 3.6, d: 3.4 },
  { x: 10.8, z: 11.8, w: 3.2, d: 2.4 },
  { x: WORKSHOP.center[0], z: WORKSHOP.center[1], w: WORKSHOP.size[0] + 2, d: WORKSHOP.size[1] + 2 },
  { x: -13.4, z: 12.2, w: 9, d: 2.6 },
  { x: BOUTIQUE.center[0], z: BOUTIQUE.center[1], w: BOUTIQUE.size[0] + 2, d: BOUTIQUE.size[1] + 2 },
  { x: BOUTIQUE.mirror[0], z: BOUTIQUE.mirror[1], w: 2, d: 2 },
  { x: (GARDEN.minX + GARDEN.maxX) / 2, z: (GARDEN.minZ + GARDEN.maxZ) / 2, w: GARDEN.maxX - GARDEN.minX + 1.6, d: GARDEN.maxZ - GARDEN.minZ + 1.4 },
  { x: GATE_SIGN[0], z: GATE_SIGN[1], w: 2, d: 1.6 },
];

export function isFree(x: number, z: number, margin = 1.0, opts: { allowOutside?: boolean } = {}): boolean {
  if (!opts.allowOutside && outsideDist(x, z) > 0) return false;
  for (const p of PATHS) for (let i = 0; i < p.pts.length - 1; i++) if (distToSeg(x, z, p.pts[i], p.pts[i + 1]) < p.w / 2 + margin) return false;
  if (Math.hypot(x - PLAZA.center[0], z - PLAZA.center[1]) < PLAZA.radius + margin + 0.4) return false;
  const nx = (x - LAKE.center[0]) / (LAKE.rx + 1.4 + margin);
  const nz = (z - LAKE.center[1]) / (LAKE.rz + 1.4 + margin);
  if (nx * nx + nz * nz < 1) return false;
  for (const r of RECTS) if (Math.abs(x - r.x) < r.w / 2 + margin * 0.6 && Math.abs(z - r.z) < r.d / 2 + margin * 0.6) return false;
  for (const t of SHAKE_TREES) if (Math.hypot(x - t.pos[0], z - t.pos[1]) < 2.6) return false;
  for (const f of FLOWER_SPOTS) if (Math.hypot(x - f.pos[0], z - f.pos[1]) < 1.0) return false;
  for (const r of ROCKS) if (Math.hypot(x - r.pos[0], z - r.pos[1]) < 1.4) return false;
  for (const k of Object.values(NAV_NODES)) if (Math.hypot(x - k[0], z - k[1]) < 1.3) return false;
  return true;
}

export interface NatureBuild {
  treeColliders: Array<{ x: number; z: number; r: number }>;
  grassMesh: THREE.InstancedMesh | null;
}

export function buildNature(scene: THREE.Scene, quality: 'high' | 'low'): NatureBuild {
  const r = rng(2026);
  const trees: Record<TreeKind, Array<{ x: number; z: number; s: number; ry: number; y: number; inside: boolean }>> = { round: [], pine: [], fruit: [], blossom: [] };
  const colliders: Array<{ x: number; z: number; r: number }> = [];
  const occupied: Array<[number, number, number]> = [];
  const tryTree = (x: number, z: number, kind: TreeKind, s: number, inside: boolean) => {
    for (const [ox, oz, or] of occupied) if (Math.hypot(x - ox, z - oz) < or + s * 1.15) return false;
    const y = groundHeight(x, z);
    trees[kind].push({ x, z, s, ry: r() * Math.PI * 2, y, inside });
    occupied.push([x, z, s * 1.15]);
    if (inside) colliders.push({ x, z, r: 0.34 * s });
    return true;
  };
  // 마을 안 — 경계를 안내하는 나무·숲
  const insideTarget = quality === 'high' ? 96 : 70;
  let tries = 0;
  let placed = 0;
  while (placed < insideTarget && tries < 6000) {
    tries++;
    const x = BOUNDS.minX + 1 + r() * (BOUNDS.maxX - BOUNDS.minX - 2);
    const z = BOUNDS.minZ + 1 + r() * (BOUNDS.maxZ - BOUNDS.minZ - 2);
    // 가장자리·속삭임 숲 쪽에 더 많이
    const edge = Math.min(x - BOUNDS.minX, BOUNDS.maxX - x, z - BOUNDS.minZ, BOUNDS.maxZ - z);
    const whisper = x > 22 && z < 2 && z > -22;
    if (!whisper && edge > 9 && r() < 0.7) continue;
    if (!isFree(x, z, 1.3)) continue;
    const kind: TreeKind = whisper ? (r() < 0.55 ? 'pine' : 'round') : z < -30 ? (r() < 0.6 ? 'blossom' : 'round') : r() < 0.18 ? 'pine' : r() < 0.08 ? 'blossom' : 'round';
    if (tryTree(x, z, kind, 0.85 + r() * 0.45, true)) placed++;
  }
  // 정원 뒤 벚꽃 배경(예식 장면의 뒤쪽 숲)
  for (let i = 0; i < 9; i++) {
    const x = GARDEN.minX - 2 + (i / 8) * (GARDEN.maxX - GARDEN.minX + 4);
    tryTree(x + (r() - 0.5), GARDEN.minZ - 1.6 - r() * 1.2, i % 3 === 1 ? 'round' : 'blossom', 1.0 + r() * 0.3, true);
  }
  // 바깥 언덕 — 빽빽한 숲
  const outer = quality === 'high' ? 360 : 220;
  tries = 0;
  placed = 0;
  while (placed < outer && tries < 9000) {
    tries++;
    const x = BOUNDS.minX - 26 + r() * (BOUNDS.maxX - BOUNDS.minX + 52);
    const z = BOUNDS.minZ - 26 + r() * (BOUNDS.maxZ - BOUNDS.minZ + 52);
    const d = outsideDist(x, z);
    if (d < 0.8 || d > 24) continue;
    const kind: TreeKind = r() < 0.4 ? 'pine' : r() < 0.06 ? 'blossom' : 'round';
    if (tryTree(x, z, kind, 1.0 + r() * 0.7, false)) placed++;
  }
  // 인스턴싱
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  // 마을 안 나무만 그림자를 드리운다(바깥 언덕 숲은 그림자 범위 밖 — 그림자 그리기 비용 절약)
  const groups: Array<{ kind: TreeKind; inside: boolean; list: Array<{ x: number; z: number; s: number; ry: number; y: number; inside: boolean }> }> = [];
  (Object.keys(trees) as TreeKind[]).forEach((kind) => {
    for (const inside of [true, false]) groups.push({ kind, inside, list: trees[kind].filter((t) => t.inside === inside) });
  });
  groups.forEach(({ kind, inside, list }) => {
    if (!list.length) return;
    const crown = new THREE.InstancedMesh(getCrown(kind), crownMat(), list.length);
    const trunk = new THREE.InstancedMesh(getTrunk(kind), trunkMat(), list.length);
    list.forEach((t, i) => {
      dummy.position.set(t.x, t.y, t.z);
      dummy.rotation.set(0, t.ry, 0);
      dummy.scale.setScalar(t.s);
      dummy.updateMatrix();
      crown.setMatrixAt(i, dummy.matrix);
      trunk.setMatrixAt(i, dummy.matrix);
      tint.setHSL(0, 0, 0.92 + r() * 0.14);
      crown.setColorAt(i, tint);
    });
    crown.castShadow = trunk.castShadow = inside;
    crown.receiveShadow = inside;
    crown.computeBoundingSphere();
    trunk.computeBoundingSphere();
    scene.add(crown, trunk);
  });
  // 풀 포기(세 갈래 잎)
  const blade = new THREE.ConeGeometry(0.035, 0.26, 4);
  blade.translate(0, 0.13, 0);
  const tuft = merge([place(blade.clone(), 0, 0, 0, 0, 0, 0.18), place(blade.clone(), 0.04, 0, 0.02, 0.1, 0.8, -0.22, 0.9, 0.85, 0.9), place(blade.clone(), -0.03, 0, -0.03, -0.12, 1.6, 0.05, 0.8, 0.75, 0.8)]);
  const nGrass = quality === 'high' ? 4400 : 1600;
  const grass = new THREE.InstancedMesh(tuft, mat('#8DBA6B', { rough: 1, sway: { base: 0.04, amp: 0.22 } }), nGrass);
  let gi = 0;
  tries = 0;
  while (gi < nGrass && tries < nGrass * 8) {
    tries++;
    const x = BOUNDS.minX + r() * (BOUNDS.maxX - BOUNDS.minX);
    const z = BOUNDS.minZ + r() * (BOUNDS.maxZ - BOUNDS.minZ);
    if (!isFree(x, z, 0.35)) continue;
    dummy.position.set(x, 0, z);
    dummy.rotation.set(0, r() * Math.PI * 2, 0);
    dummy.scale.setScalar(0.8 + r() * 0.9);
    dummy.updateMatrix();
    grass.setMatrixAt(gi, dummy.matrix);
    tint.setHSL(0.24 + r() * 0.04, 0.35 + r() * 0.15, 0.42 + r() * 0.12);
    grass.setColorAt(gi, tint);
    gi++;
  }
  grass.count = gi;
  grass.receiveShadow = true;
  scene.add(grass);
  buildFlowerBeds(scene, r, quality);
  buildBushes(scene, r, colliders);
  buildReeds(scene, r);
  return { treeColliders: colliders, grassMesh: grass };
}

/** 장식 꽃(꽃길 양옆 · 정원 화단 · 광장 둘레) */
function buildFlowerBeds(scene: THREE.Scene, r: () => number, quality: 'high' | 'low') {
  const spots: Array<{ x: number; z: number; c: string }> = [];
  const cols = ['#FFFFFF', '#FFFFFF', '#F4B9C9', '#F6D46B', '#F7C9D7'];
  // 꽃길: 광장 → 서약의 정원 양옆
  for (let z = -7.6; z > -20.8; z -= 0.42) {
    for (const side of [-1, 1]) {
      const x = side * (1.75 + r() * 0.5);
      spots.push({ x, z: z + (r() - 0.5) * 0.3, c: cols[Math.floor(r() * cols.length)] });
      if (r() < 0.5) spots.push({ x: x + side * 0.35, z: z + (r() - 0.5) * 0.3, c: cols[Math.floor(r() * cols.length)] });
    }
  }
  // 정원 네 귀퉁이 화단 + 입구 양옆
  const beds: Array<[number, number, number]> = [
    [GARDEN.minX + 1.2, GARDEN.minZ + 1.0, 1.0],
    [GARDEN.maxX - 1.2, GARDEN.minZ + 1.0, 1.0],
    [GARDEN.minX + 1.0, GARDEN.maxZ - 0.9, 0.8],
    [GARDEN.maxX - 1.0, GARDEN.maxZ - 0.9, 0.8],
    [-12, -12.0, 0.6],
    [PLAZA.center[0] - 3, PLAZA.center[1] - 6.4, 0.7],
    [PLAZA.center[0] + 3, PLAZA.center[1] - 6.4, 0.7],
    [-7.8, -12.8, 0.6],
    [20, 14, 0.9],
  ];
  for (const [bx, bz, br] of beds) {
    const n = Math.round(br * 26);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * br;
      spots.push({ x: bx + Math.cos(a) * d, z: bz + Math.sin(a) * d, c: cols[Math.floor(r() * cols.length)] });
    }
  }
  // 들꽃 흩뿌리기
  const wild = quality === 'high' ? 620 : 240;
  let tries = 0;
  let k = 0;
  while (k < wild && tries < 4000) {
    tries++;
    const x = BOUNDS.minX + r() * (BOUNDS.maxX - BOUNDS.minX);
    const z = BOUNDS.minZ + r() * (BOUNDS.maxZ - BOUNDS.minZ);
    if (!isFree(x, z, 0.5)) continue;
    spots.push({ x, z, c: cols[Math.floor(r() * cols.length)] });
    k++;
  }
  const head = new THREE.SphereGeometry(0.07, 8, 6);
  head.scale(1, 0.55, 1);
  head.translate(0, 0.25, 0);
  const center = new THREE.SphereGeometry(0.028, 6, 4);
  center.translate(0, 0.285, 0);
  const stem = new THREE.CylinderGeometry(0.01, 0.012, 0.25, 4);
  stem.translate(0, 0.125, 0);
  const leaf = new THREE.SphereGeometry(0.045, 6, 4);
  leaf.scale(1.4, 0.35, 0.7);
  leaf.translate(0.04, 0.08, 0);
  const heads = new THREE.InstancedMesh(head, mat('#ffffff', { rough: 0.8, sway: { base: 0.05, amp: 0.25 } }), spots.length);
  const centers = new THREE.InstancedMesh(center, mat('#F2C14E', { rough: 0.7, sway: { base: 0.05, amp: 0.25 } }), spots.length);
  const stems = new THREE.InstancedMesh(merge([paint(stem, '#6E9E57'), paint(leaf, '#79A960')]), mat('#fffffb', { vertexColors: true, rough: 0.9, sway: { base: 0.05, amp: 0.25 } }), spots.length);
  const d = new THREE.Object3D();
  const c = new THREE.Color();
  spots.forEach((s, i) => {
    d.position.set(s.x, 0, s.z);
    d.rotation.set(0, r() * 6.28, 0);
    d.scale.setScalar(0.8 + r() * 0.5);
    d.updateMatrix();
    heads.setMatrixAt(i, d.matrix);
    centers.setMatrixAt(i, d.matrix);
    stems.setMatrixAt(i, d.matrix);
    heads.setColorAt(i, c.set(s.c));
  });
  for (const m of [heads, centers, stems]) {
    m.castShadow = false;
    m.receiveShadow = true;
    scene.add(m);
  }
}

/** 둥근 덤불 · 정원 산울타리 */
function buildBushes(scene: THREE.Scene, r: () => number, colliders: Array<{ x: number; z: number; r: number }>) {
  const parts: THREE.BufferGeometry[] = [];
  const addBush = (x: number, z: number, s: number, flowers = false) => {
    parts.push(part(blob(0.55 * s, 12), '#6A9C5C', x, 0.38 * s, z, 0, 0, 0, 1.15, 0.85, 1));
    parts.push(part(blob(0.4 * s, 10), '#78AA66', x + 0.35 * s, 0.32 * s, z + 0.15 * s));
    parts.push(part(blob(0.36 * s, 10), '#5E8F55', x - 0.32 * s, 0.28 * s, z - 0.12 * s));
    if (flowers) for (let i = 0; i < 6; i++) parts.push(part(new THREE.SphereGeometry(0.06 * s, 6, 5), i % 2 ? '#FFFFFF' : '#F4B9C9', x + (r() - 0.5) * 0.8 * s, 0.55 * s + r() * 0.15, z + (r() - 0.5) * 0.7 * s + 0.2 * s));
  };
  // 정원 산울타리(입구만 비움)
  const hedge = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / 1.05));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = x0 + (x1 - x0) * t;
      const z = z0 + (z1 - z0) * t;
      addBush(x, z, 0.9 + r() * 0.15, r() < 0.35);
      colliders.push({ x, z, r: 0.5 });
    }
  };
  const g = GARDEN;
  hedge(g.minX, g.minZ, g.maxX, g.minZ);
  hedge(g.minX, g.minZ + 1, g.minX, g.maxZ);
  hedge(g.maxX, g.minZ + 1, g.maxX, g.maxZ);
  hedge(g.minX + 1, g.maxZ, -1.9, g.maxZ);
  hedge(1.9, g.maxZ, g.maxX - 1, g.maxZ);
  // 마을 곳곳 덤불
  const spots: V2[] = [
    [-8.6, 4.4], [8.8, 4.0], [-3.6, 13.6], [3.8, 21.6], [-3.6, 21.8], [-19.6, -4.2], [-26.8, 1.6], [16.2, -4.0], [22.6, -11.6], [9.6, -24.0], [-10.2, -20.4], [-17.8, -15.4], [11.6, 17.4], [-20.8, 16.0], [24.8, 8.6], [27.8, 2.0],
  ];
  for (const [x, z] of spots) {
    addBush(x, z, 0.9 + r() * 0.3, r() < 0.4);
    colliders.push({ x, z, r: 0.55 });
  }
  const mesh = new THREE.Mesh(merge(parts), mat('#ffffff', { vertexColors: true, rough: 0.92, occlude: true }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

/** 갈대(호숫가) */
function buildReeds(scene: THREE.Scene, r: () => number) {
  const reed = new THREE.CapsuleGeometry(0.018, 0.55, 2, 4);
  reed.translate(0, 0.3, 0);
  const tip = new THREE.CapsuleGeometry(0.035, 0.12, 2, 6);
  tip.translate(0, 0.62, 0);
  const geo = merge([paint(reed, '#7C9A5B'), paint(tip, '#A27E57')]);
  const n = 70;
  const inst = new THREE.InstancedMesh(geo, mat('#fffffa', { vertexColors: true, rough: 0.9, sway: { base: 0.1, amp: 0.12 } }), n);
  const d = new THREE.Object3D();
  let k = 0;
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    // 데크 쪽(서쪽)은 비워 둔다
    if (Math.cos(a) < -0.75) continue;
    const rr = 0.94 + r() * 0.12;
    const x = LAKE.center[0] + Math.cos(a) * LAKE.rx * rr;
    const z = LAKE.center[1] + Math.sin(a) * LAKE.rz * rr;
    d.position.set(x, 0, z);
    d.rotation.set((r() - 0.5) * 0.2, r() * 6, (r() - 0.5) * 0.2);
    d.scale.setScalar(0.8 + r() * 0.6);
    d.updateMatrix();
    inst.setMatrixAt(k++, d.matrix);
  }
  inst.count = k;
  scene.add(inst);
}

/** 흔들 수 있는 나무(개별 메시) */
export function makeShakeTree(kind: TreeKind): { group: THREE.Group; crown: THREE.Mesh } {
  const group = new THREE.Group();
  const crown = new THREE.Mesh(getCrown(kind), crownMat());
  const trunk = new THREE.Mesh(getTrunk(kind), trunkMat());
  crown.castShadow = trunk.castShadow = true;
  crown.receiveShadow = true;
  group.add(trunk, crown);
  return { group, crown };
}
