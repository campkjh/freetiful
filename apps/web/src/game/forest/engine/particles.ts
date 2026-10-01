// 작은 연출 — 획득 반짝임 · 축하 꽃잎 · 반딧불이(밤) · 나비(낮) · 나무에서 떨어지는 재료.
// 축하 꽃잎과 반짝임은 캐릭터 얼굴·대사를 가리지 않게 머리 위·옆에서만 생긴다.
import * as THREE from 'three';
import { ITEMS } from '../data/items';
import { FLOWER_SPOTS, WHISPER, GARDEN } from '../data/world';
import { bendU, BEND_CHUNK, BEND_HEAD } from './bend';

function starTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 30);
  grd.addColorStop(0, 'rgba(255,255,240,1)');
  grd.addColorStop(0.25, 'rgba(255,240,190,0.9)');
  grd.addColorStop(1, 'rgba(255,230,160,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.beginPath();
  g.moveTo(32, 4);
  g.lineTo(36, 28);
  g.lineTo(60, 32);
  g.lineTo(36, 36);
  g.lineTo(32, 60);
  g.lineTo(28, 36);
  g.lineTo(4, 32);
  g.lineTo(28, 28);
  g.closePath();
  g.fill();
  return new THREE.CanvasTexture(c);
}

interface Spark {
  s: THREE.Sprite;
  v: THREE.Vector3;
  life: number;
  max: number;
}
interface Petal {
  p: THREE.Vector3;
  v: THREE.Vector3;
  r: THREE.Euler;
  w: THREE.Vector3;
  life: number;
  color: THREE.Color;
}
interface Drop {
  m: THREE.Mesh;
  from: THREE.Vector3;
  t: number;
  land: THREE.Vector3;
  target: () => THREE.Vector3;
}
interface Fly {
  g: THREE.Group;
  wl: THREE.Mesh;
  wr: THREE.Mesh;
  home: THREE.Vector3;
  ph: number;
  pos: THREE.Vector3;
}

export class Particles {
  scene: THREE.Scene;
  private sparks: Spark[] = [];
  private sparkTex = starTexture();
  private petals: Petal[] = [];
  private petalMesh: THREE.InstancedMesh;
  private drops: Drop[] = [];
  private flies: Fly[] = [];
  private fireflies: THREE.Points;
  private ffBase: Float32Array;
  private ffMat: THREE.ShaderMaterial;
  private dummy = new THREE.Object3D();
  private quality: 'high' | 'low' = 'high';

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    // 꽃잎 인스턴스
    const petalGeo = new THREE.CircleGeometry(0.05, 6);
    petalGeo.scale(1, 0.62, 1);
    const petalMat = new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, roughness: 0.8 });
    this.petalMesh = new THREE.InstancedMesh(petalGeo, petalMat, 320);
    this.petalMesh.count = 0;
    this.petalMesh.frustumCulled = false;
    this.petalMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(320 * 3), 3);
    scene.add(this.petalMesh);
    // 반딧불이
    const n = 90;
    const pos = new Float32Array(n * 3);
    this.ffBase = new Float32Array(n * 4);
    const zones: Array<[number, number, number]> = [
      ...WHISPER.rare.map(([x, z]) => [x, z, 4] as [number, number, number]),
      [29, -10, 6],
      [(GARDEN.minX + GARDEN.maxX) / 2 - 5, GARDEN.minZ + 2, 3],
      [(GARDEN.minX + GARDEN.maxX) / 2 + 5, GARDEN.minZ + 2, 3],
      [7, -22, 4],
      [18, -10, 4],
    ];
    for (let i = 0; i < n; i++) {
      const [zx, zz, r] = zones[i % zones.length];
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * r;
      this.ffBase[i * 4] = zx + Math.cos(a) * d;
      this.ffBase[i * 4 + 1] = 0.4 + Math.random() * 1.6;
      this.ffBase[i * 4 + 2] = zz + Math.sin(a) * d;
      this.ffBase[i * 4 + 3] = Math.random() * 100;
      pos.set([this.ffBase[i * 4], this.ffBase[i * 4 + 1], this.ffBase[i * 4 + 2]], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const ph = new Float32Array(n);
    for (let i = 0; i < n; i++) ph[i] = Math.random() * 10;
    geo.setAttribute('phase', new THREE.BufferAttribute(ph, 1));
    this.ffMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uVis: { value: 0 }, uScale: { value: 1 }, uBendStart: bendU.uBendStart, uBend: bendU.uBend },
      vertexShader: BEND_HEAD + /* glsl */ `attribute float phase; uniform float uTime; uniform float uScale; varying float vA;
        void main(){ vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
          ${BEND_CHUNK}
          vA = 0.45 + 0.55 * sin(uTime * 2.3 + phase * 6.0);
          gl_PointSize = (90.0 / -mvPosition.z) * uScale; }`,
      fragmentShader: /* glsl */ `uniform float uVis; varying float vA;
        void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vec3(1.0, 0.95, 0.55) * (0.6 + a), a * vA * uVis); }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.fireflies = new THREE.Points(geo, this.ffMat);
    this.fireflies.frustumCulled = false;
    scene.add(this.fireflies);
    // 나비
    const wingM = [new THREE.MeshStandardMaterial({ color: '#FFF4C4', side: THREE.DoubleSide, roughness: 0.7 }), new THREE.MeshStandardMaterial({ color: '#F6C6D4', side: THREE.DoubleSide, roughness: 0.7 }), new THREE.MeshStandardMaterial({ color: '#CFE3F2', side: THREE.DoubleSide, roughness: 0.7 })];
    // 날개는 수평(XZ)으로 눕히고 몸통 축(z)을 기준으로 위아래로 파닥인다
    const wingGeo = new THREE.CircleGeometry(0.06, 8);
    wingGeo.translate(0.055, 0, 0);
    wingGeo.rotateX(-Math.PI / 2);
    const spots = FLOWER_SPOTS.filter((f) => f.item !== 'rare_flower');
    for (let i = 0; i < 8; i++) {
      const g = new THREE.Group();
      const m = wingM[i % 3];
      const wl = new THREE.Mesh(wingGeo, m);
      const wr = new THREE.Mesh(wingGeo, m);
      wr.scale.x = -1;
      g.add(wl, wr);
      const s = spots[(i * 5) % spots.length];
      const home = new THREE.Vector3(s.pos[0], 0.9, s.pos[1]);
      g.position.copy(home);
      scene.add(g);
      this.flies.push({ g, wl, wr, home, ph: Math.random() * 10, pos: home.clone() });
    }
  }

  setQuality(q: 'high' | 'low') {
    this.quality = q;
  }

  sparkle(at: THREE.Vector3, count = 8, color = '#FFF2B8', spread = 0.5) {
    const n = this.quality === 'low' ? Math.ceil(count / 2) : count;
    for (let i = 0; i < n; i++) {
      const mat = new THREE.SpriteMaterial({ map: this.sparkTex, color: new THREE.Color(color), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const s = new THREE.Sprite(mat);
      s.position.copy(at).add(new THREE.Vector3((Math.random() - 0.5) * spread, Math.random() * spread * 0.6, (Math.random() - 0.5) * spread));
      s.scale.setScalar(0.12 + Math.random() * 0.1);
      this.scene.add(s);
      const v = new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.6 + Math.random() * 0.9, (Math.random() - 0.5) * 0.8);
      this.sparks.push({ s, v, life: 0, max: 0.6 + Math.random() * 0.4 });
    }
  }

  /** 축하 꽃잎 — 중심 둘레 반지름 r, 머리 위 높이에서 */
  petalBurst(center: THREE.Vector3, r: number, count: number) {
    const n = this.quality === 'low' ? Math.ceil(count / 2) : count;
    const cols = ['#FFFFFF', '#F7C8D6', '#F4B0C4', '#FFF1D6'];
    for (let i = 0; i < n; i++) {
      if (this.petals.length >= 320) this.petals.shift();
      const a = Math.random() * Math.PI * 2;
      const d = 0.6 + Math.random() * r;
      this.petals.push({
        p: new THREE.Vector3(center.x + Math.cos(a) * d, center.y + 1.6 + Math.random() * 1.4, center.z + Math.sin(a) * d),
        v: new THREE.Vector3((Math.random() - 0.5) * 0.4, -0.35 - Math.random() * 0.3, (Math.random() - 0.5) * 0.4),
        r: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        w: new THREE.Vector3(Math.random() * 4, Math.random() * 4, Math.random() * 4),
        life: 0,
        color: new THREE.Color(cols[i % cols.length]),
      });
    }
  }

  /** 나무에서 떨어져 플레이어에게 들어가는 재료 */
  drop(item: string, from: THREE.Vector3, target: () => THREE.Vector3) {
    const def = ITEMS[item];
    const geo = item === 'fruit' ? new THREE.SphereGeometry(0.09, 12, 10) : item === 'branch' ? new THREE.CylinderGeometry(0.025, 0.03, 0.34, 8) : new THREE.CylinderGeometry(0.07, 0.07, 0.3, 10);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: def?.color || '#B88A5E', roughness: 0.8 }));
    if (item !== 'fruit') m.rotation.z = Math.PI / 2;
    m.castShadow = true;
    m.position.copy(from);
    this.scene.add(m);
    const land = new THREE.Vector3(from.x + (Math.random() - 0.5) * 1.4, 0.1, from.z + 0.6 + Math.random() * 0.6);
    this.drops.push({ m, from: from.clone(), t: 0, land, target });
  }

  update(dt: number, time: number, night: number, focus: THREE.Vector3) {
    // 반짝임
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life += dt;
      s.s.position.addScaledVector(s.v, dt);
      s.v.y -= dt * 0.8;
      const k = s.life / s.max;
      (s.s.material as THREE.SpriteMaterial).opacity = 1 - k;
      s.s.scale.multiplyScalar(1 - dt * 0.6);
      if (k >= 1) {
        this.scene.remove(s.s);
        (s.s.material as THREE.SpriteMaterial).dispose();
        this.sparks.splice(i, 1);
      }
    }
    // 꽃잎
    let idx = 0;
    for (let i = this.petals.length - 1; i >= 0; i--) {
      const p = this.petals[i];
      p.life += dt;
      p.v.x += Math.sin(time * 1.7 + i) * dt * 0.25;
      p.p.addScaledVector(p.v, dt);
      p.r.x += p.w.x * dt;
      p.r.y += p.w.y * dt;
      p.r.z += p.w.z * dt;
      if (p.p.y < 0.03) {
        p.p.y = 0.03;
        p.v.set(0, 0, 0);
        p.w.set(0, 0, 0);
      }
      if (p.life > 9) {
        this.petals.splice(i, 1);
        continue;
      }
    }
    for (const p of this.petals) {
      this.dummy.position.copy(p.p);
      this.dummy.rotation.copy(p.r);
      const fade = p.life > 7.5 ? Math.max(0.01, 1 - (p.life - 7.5) / 1.5) : 1;
      this.dummy.scale.setScalar(fade);
      this.dummy.updateMatrix();
      this.petalMesh.setMatrixAt(idx, this.dummy.matrix);
      this.petalMesh.setColorAt(idx, p.color);
      idx++;
    }
    this.petalMesh.count = idx;
    this.petalMesh.instanceMatrix.needsUpdate = true;
    if (this.petalMesh.instanceColor) this.petalMesh.instanceColor.needsUpdate = true;
    // 떨어지는 재료
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.t += dt;
      if (d.t < 0.55) {
        const k = d.t / 0.55;
        d.m.position.lerpVectors(d.from, d.land, k);
        d.m.position.y = d.from.y * (1 - k * k) + d.land.y + Math.sin(k * Math.PI) * 0.3;
        d.m.rotation.x += dt * 8;
      } else if (d.t < 0.8) {
        d.m.position.y = d.land.y + Math.abs(Math.sin((d.t - 0.55) * 12)) * 0.12 * (1 - (d.t - 0.55) / 0.25);
      } else {
        const tgt = d.target();
        const k = Math.min(1, (d.t - 0.8) / 0.3);
        d.m.position.lerp(new THREE.Vector3(tgt.x, tgt.y + 0.6, tgt.z), k);
        d.m.scale.setScalar(1 - k * 0.8);
        if (k >= 1) {
          this.scene.remove(d.m);
          d.m.geometry.dispose();
          (d.m.material as THREE.Material).dispose();
          this.drops.splice(i, 1);
        }
      }
    }
    // 반딧불이
    this.ffMat.uniforms.uTime.value = time;
    this.ffMat.uniforms.uVis.value = night;
    this.fireflies.visible = night > 0.05;
    if (this.fireflies.visible) {
      const pos = this.fireflies.geometry.attributes.position as THREE.BufferAttribute;
      const n = pos.count;
      const lim = this.quality === 'low' ? Math.floor(n / 2) : n;
      for (let i = 0; i < n; i++) {
        const b = i * 4;
        const ph = this.ffBase[b + 3];
        if (i >= lim) {
          pos.setXYZ(i, 0, -100, 0);
          continue;
        }
        pos.setXYZ(i, this.ffBase[b] + Math.sin(time * 0.4 + ph) * 0.9, this.ffBase[b + 1] + Math.sin(time * 0.9 + ph * 2) * 0.3, this.ffBase[b + 2] + Math.cos(time * 0.35 + ph) * 0.9);
      }
      pos.needsUpdate = true;
    }
    // 나비(낮) — 꽃 주변을 맴돈다
    const day = 1 - night;
    for (const f of this.flies) {
      f.g.visible = day > 0.4 && f.home.distanceTo(focus) < 40;
      if (!f.g.visible) continue;
      f.ph += dt;
      const tx = f.home.x + Math.sin(f.ph * 0.5) * 1.6 + Math.sin(f.ph * 1.3) * 0.4;
      const tz = f.home.z + Math.cos(f.ph * 0.42) * 1.4;
      const ty = 0.7 + Math.sin(f.ph * 1.9) * 0.25;
      const nx = new THREE.Vector3(tx, ty, tz);
      const dir = nx.clone().sub(f.pos);
      f.pos.copy(nx);
      f.g.position.copy(nx);
      if (dir.lengthSq() > 1e-6) f.g.rotation.y = Math.atan2(dir.x, dir.z);
      const flap = Math.sin(f.ph * 22) * 0.9;
      f.wl.rotation.z = flap;
      f.wr.rotation.z = -flap;
    }
  }
}
