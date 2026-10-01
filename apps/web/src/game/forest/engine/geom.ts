// 도형 도우미 — 둥근 상자, 정점색 입히기, 합치기(정적인 물체는 한 메시로 묶어 그리기 호출을 줄인다).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function rbox(w: number, h: number, d: number, r = 0.08, seg = 3): THREE.BufferGeometry {
  const rr = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  return new RoundedBoxGeometry(w, h, d, seg, Math.max(0.001, rr));
}

const tmpColor = new THREE.Color();

/** 정점색 입히기 */
export function paint(g: THREE.BufferGeometry, color: string | number, jitter = 0): THREE.BufferGeometry {
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  tmpColor.set(color as any);
  for (let i = 0; i < n; i++) {
    const j = jitter ? 1 + (Math.sin(i * 12.9898) * 43758.5453 % 1) * jitter : 1;
    arr[i * 3] = tmpColor.r * j;
    arr[i * 3 + 1] = tmpColor.g * j;
    arr[i * 3 + 2] = tmpColor.b * j;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

/** 위치·회전·크기 적용 */
export function place(g: THREE.BufferGeometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): THREE.BufferGeometry {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  g.applyMatrix4(m);
  return g;
}

/** 색칠한 부품 하나 */
export function part(g: THREE.BufferGeometry, color: string | number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): THREE.BufferGeometry {
  return place(paint(g, color), x, y, z, rx, ry, rz, sx, sy, sz);
}

/** 서로 다른 도형 합치기(색인 여부·속성 맞춤) */
export function merge(geoms: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const anyNonIndexed = geoms.some((g) => !g.index);
  const prepared = geoms.map((g) => {
    let x = anyNonIndexed && g.index ? g.toNonIndexed() : g;
    if (!x.attributes.uv) {
      x.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2));
    }
    if (!x.attributes.color) x = paint(x, '#ffffff');
    // 합칠 때 속성 집합이 같아야 한다
    for (const k of Object.keys(x.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) x.deleteAttribute(k);
    return x;
  });
  const out = mergeGeometries(prepared, false);
  if (!out) throw new Error('merge failed');
  out.computeBoundingSphere();
  return out;
}

/** 부드러운 덩어리(나무 수관 등) — 구를 살짝 찌그러뜨림 */
export function blob(r: number, seg = 14): THREE.BufferGeometry {
  return new THREE.SphereGeometry(r, seg, Math.max(8, Math.round(seg * 0.75)));
}

/** 회전체(몸통·치마) */
export function lathe(profile: Array<[number, number]>, seg = 20): THREE.BufferGeometry {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y)), seg);
}

/** 결정적 난수(배치용) */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function damp(current: number, target: number, lambda: number, dt: number) {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function dampAngle(current: number, target: number, lambda: number, dt: number) {
  let d = target - current;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return current + d * (1 - Math.exp(-lambda * dt));
}

export function smooth(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}
