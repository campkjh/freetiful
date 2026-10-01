// 땅 · 길 · 광장 · 정원 잔디 · 호수 물가. 마을 바깥은 완만한 언덕으로 감싸 경계를 안내한다.
import * as THREE from 'three';
import { BOUNDS, GARDEN, LAKE, PATHS, PLAZA, type V2 } from '../../data/world';
import { mat, shared } from '../materials';
import { bendU, BEND_CHUNK, BEND_HEAD } from '../bend';
import { merge, paint, place, rng } from '../geom';

/** 경계 밖 거리(안쪽이면 0 이하) */
export function outsideDist(x: number, z: number): number {
  const b = BOUNDS;
  const dx = Math.max(b.minX - x, 0, x - b.maxX);
  const dz = Math.max(b.minZ - z, 0, z - b.maxZ);
  return Math.hypot(dx, dz);
}

/** 잘게 나눈 타원 원판(둥근 땅 효과로 휘어도 땅과 같이 휘게) — uv = 타원 안 정규화 좌표 */
export function ellipseDisc(rx: number, rz: number, segs = 64, rings = 14): THREE.BufferGeometry {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  pos.push(0, 0, 0);
  uv.push(0, 0);
  for (let r = 1; r <= rings; r++) {
    const k = r / rings;
    for (let s = 0; s < segs; s++) {
      const a = (s / segs) * Math.PI * 2;
      pos.push(Math.cos(a) * rx * k, 0, Math.sin(a) * rz * k);
      uv.push(Math.cos(a) * k, Math.sin(a) * k);
    }
  }
  for (let s = 0; s < segs; s++) idx.push(0, 1 + ((s + 1) % segs), 1 + s);
  for (let r = 1; r < rings; r++) {
    const a0 = 1 + (r - 1) * segs;
    const a1 = 1 + r * segs;
    for (let s = 0; s < segs; s++) {
      const s1 = (s + 1) % segs;
      idx.push(a0 + s, a0 + s1, a1 + s);
      idx.push(a0 + s1, a1 + s1, a1 + s);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // 위를 보게(인덱스 순서가 아래를 보면 뒤집기)
  const n = g.attributes.normal as THREE.BufferAttribute;
  if (n.getY(0) < 0) {
    const ix = g.index!.array as Uint16Array | Uint32Array;
    for (let i = 0; i < ix.length; i += 3) {
      const t = ix[i + 1];
      ix[i + 1] = ix[i + 2];
      ix[i + 2] = t;
    }
    g.computeVertexNormals();
  }
  return g;
}

export function groundHeight(x: number, z: number): number {
  const d = outsideDist(x, z) - 1.5;
  if (d <= 0) return 0;
  const n = Math.sin(x * 0.21) * Math.cos(z * 0.17) * 0.6 + Math.sin(x * 0.07 + z * 0.11) * 0.8;
  return THREE.MathUtils.smoothstep(d, 0, 12) * (4.2 + n);
}

function noise(x: number, z: number) {
  return Math.sin(x * 0.13 + Math.cos(z * 0.09) * 2) * 0.5 + Math.sin(z * 0.19 + x * 0.05) * 0.35 + Math.sin((x + z) * 0.41) * 0.15;
}

export function buildGround(scene: THREE.Scene) {
  const size = 170;
  const seg = 136;
  const g = new THREE.PlaneGeometry(size, size, seg, seg);
  g.rotateX(-Math.PI / 2);
  g.translate(2, 0, -7);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const base = new THREE.Color('#90C16D');
  const light = new THREE.Color('#A7D183');
  const deep = new THREE.Color('#76AA59');
  const hill = new THREE.Color('#6E9E58');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = groundHeight(x, z);
    pos.setY(i, h);
    const n = noise(x, z);
    c.copy(base).lerp(n > 0 ? light : deep, Math.abs(n) * 0.55);
    if (h > 0.05) c.lerp(hill, Math.min(1, h / 3) * 0.8);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  const ground = new THREE.Mesh(g, mat('#ffffff', { vertexColors: true, rough: 1 }));
  ground.receiveShadow = true;
  ground.name = 'ground';
  scene.add(ground);
  return ground;
}

/** 길 리본(둥근 이음) */
function ribbon(pts: V2[], w: number, y: number, color: string): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const seg = new THREE.PlaneGeometry(w, len, 1, Math.max(1, Math.round(len)));
    seg.rotateX(-Math.PI / 2);
    const ang = Math.atan2(bx - ax, bz - az);
    place(seg, (ax + bx) / 2, y, (az + bz) / 2, 0, ang, 0);
    parts.push(paint(seg, color));
  }
  for (const [x, z] of pts) {
    const disc = new THREE.CircleGeometry(w / 2, 20);
    disc.rotateX(-Math.PI / 2);
    place(disc, x, y, z);
    parts.push(paint(disc, color));
  }
  return merge(parts);
}

export function buildPaths(scene: THREE.Scene) {
  const top: THREE.BufferGeometry[] = [];
  const edge: THREE.BufferGeometry[] = [];
  for (const p of PATHS) {
    top.push(ribbon(p.pts, p.w, 0.014, '#E4CFA6'));
    edge.push(ribbon(p.pts, p.w + 0.36, 0.011, '#CDB386'));
  }
  // 광장(둥근 흙마당 + 가장자리 디딤돌)
  const plaza = ellipseDisc(PLAZA.radius, PLAZA.radius, 56, 12);
  top.push(paint(place(plaza, PLAZA.center[0], 0.016, PLAZA.center[1]), '#EAD9B6'));
  const ring = new THREE.RingGeometry(PLAZA.radius, PLAZA.radius + 0.35, 48);
  ring.rotateX(-Math.PI / 2);
  edge.push(paint(place(ring, PLAZA.center[0], 0.012, PLAZA.center[1]), '#CDB386'));
  const stones: THREE.BufferGeometry[] = [];
  const r = rng(7);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const d = PLAZA.radius - 0.75 + (r() - 0.5) * 0.2;
    const s = new THREE.CircleGeometry(0.34 + r() * 0.12, 12);
    s.rotateX(-Math.PI / 2);
    stones.push(paint(place(s, Math.cos(a) * d, 0.02, Math.sin(a) * d, 0, 0, 0, 1, 1, 0.8 + r() * 0.3), '#F3E8D2'));
  }
  // 정원 잔디(조금 밝게) + 입장 통로 돌길
  const lawn = new THREE.PlaneGeometry(GARDEN.maxX - GARDEN.minX, GARDEN.maxZ - GARDEN.minZ, 16, 14);
  lawn.rotateX(-Math.PI / 2);
  const lawnMesh = new THREE.Mesh(paint(place(lawn, (GARDEN.minX + GARDEN.maxX) / 2, 0.008, (GARDEN.minZ + GARDEN.maxZ) / 2), '#A6CB85'), mat('#ffffff', { vertexColors: true, rough: 1 }));
  lawnMesh.receiveShadow = true;
  scene.add(lawnMesh);
  const a = GARDEN.aisle;
  for (let z = a.maxZ - 0.3; z > a.minZ + 0.2; z -= 0.72) {
    const s = new THREE.CircleGeometry(0.42, 16);
    s.rotateX(-Math.PI / 2);
    stones.push(paint(place(s, (z * 7.3) % 0.12, 0.02, z, 0, 0, 0, 1.25, 1, 0.75), '#F1E8D6'));
  }
  const pathMat = mat('#ffffff', { vertexColors: true, rough: 1 });
  pathMat.polygonOffset = true;
  pathMat.polygonOffsetFactor = -1;
  pathMat.polygonOffsetUnits = -1;
  const edgeMat = mat('#fffffe', { vertexColors: true, rough: 1 });
  const topMesh = new THREE.Mesh(merge(top), pathMat);
  const edgeMesh = new THREE.Mesh(merge(edge), edgeMat);
  const stoneMesh = new THREE.Mesh(merge(stones), mat('#fffffd', { vertexColors: true, rough: 0.95 }));
  for (const m of [topMesh, edgeMesh, stoneMesh]) {
    m.receiveShadow = true;
    scene.add(m);
  }
}

/** 호수 — 느린 물결, 가장자리 거품, 깊이감 */
export function buildLake(scene: THREE.Scene): THREE.ShaderMaterial {
  const [cx, cz] = LAKE.center;
  // 물가 모래 띠
  const shoreGeo = ellipseDisc(LAKE.rx + 1.1, LAKE.rz + 1.0, 72, 12);
  const shoreMesh = new THREE.Mesh(paint(place(shoreGeo, cx, 0.017, cz), '#DCCB9E'), mat('#ffffff', { vertexColors: true, rough: 1 }));
  shoreMesh.receiveShadow = true;
  scene.add(shoreMesh);
  const geo = ellipseDisc(LAKE.rx, LAKE.rz, 96, 16);
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uTime: shared.uTime,
      shallow: { value: new THREE.Color('#8CC3CF') },
      deep: { value: new THREE.Color('#5C9AB0') },
      foam: { value: new THREE.Color('#F4FAF6') },
      sky: { value: new THREE.Color('#DDEFF6') },
      fogColor: { value: new THREE.Color() },
      fogNear: { value: 30 },
      fogFar: { value: 110 },
      night: { value: 0 },
      uBendStart: bendU.uBendStart,
      uBend: bendU.uBend,
    },
    vertexShader: BEND_HEAD + /* glsl */ `varying vec2 vUv; varying vec3 vW; varying float vFogDepth;
      void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; vFogDepth = -mvPosition.z; gl_Position = projectionMatrix * mvPosition;
      ${BEND_CHUNK} }`,
    fragmentShader: /* glsl */ `uniform float uTime; uniform vec3 shallow; uniform vec3 deep; uniform vec3 foam; uniform vec3 sky; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar; uniform float night;
      varying vec2 vUv; varying vec3 vW; varying float vFogDepth;
      void main(){
        float r = length(vUv);
        vec3 col = mix(deep, shallow, smoothstep(0.85, 0.15, 1.0 - r));
        col = mix(col, shallow * 1.05, smoothstep(0.55, 1.0, r));
        float w1 = sin(vW.x * 1.7 + uTime * 0.9) * sin(vW.z * 1.3 - uTime * 0.7);
        float w2 = sin(vW.x * 0.6 - vW.z * 0.9 + uTime * 0.5);
        float glint = smoothstep(0.82, 1.0, w1 * 0.6 + w2 * 0.4);
        col += sky * glint * 0.18 * (1.0 - night * 0.6);
        float edge = smoothstep(0.86, 0.97, r + sin(atan(vUv.y, vUv.x) * 9.0 + uTime * 1.2) * 0.015);
        col = mix(col, foam, edge * 0.85);
        col *= mix(1.0, 0.62, night);
        float f = smoothstep(fogNear, fogFar, vFogDepth);
        col = mix(col, fogColor, f);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(cx, 0.03, cz);
  scene.add(mesh);
  return m;
}
