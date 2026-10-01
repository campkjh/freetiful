// 꾸미기 장식 3D — 아치 · 의자 · 꽃길 러그 · 센터피스 · 랜턴 · 케이크 테이블 · 꽃 화분 · 리본 기둥 · 기념 액자.
// 바닥 중심이 기준점(제작 프롬프트 15쪽 자산 규격). 같은 가구 구조에 색·꽃만 바꿔 테마를 넓힐 수 있게 색을 한곳에 모았다.
import * as THREE from 'three';
import { blob, merge, part, rbox } from './geom';
import { mat } from './materials';

export const THEME = {
  wood: '#C79A6B',
  woodDark: '#A77D5A',
  white: '#FFFFFF',
  ivory: '#F7EFE4',
  pink: '#F4B9C9',
  pinkDeep: '#EE9FB5',
  yellow: '#F6D46B',
  leaf: '#79A960',
  leafDeep: '#5E8F55',
};

function mesh(parts: THREE.BufferGeometry[], rough = 0.88): THREE.Mesh {
  const m = new THREE.Mesh(merge(parts), mat('#ffffff', { vertexColors: true, rough }));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function flowerCluster(parts: THREE.BufferGeometry[], x: number, y: number, z: number, n: number, spread: number, seed = 1) {
  let s = seed * 9301;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = 0; i < n; i++) {
    const c = rnd() < 0.6 ? THEME.white : rnd() < 0.5 ? THEME.pink : THEME.ivory;
    parts.push(part(new THREE.SphereGeometry(0.075, 8, 6), c, x + (rnd() - 0.5) * spread, y + (rnd() - 0.5) * spread * 0.6, z + (rnd() - 0.5) * spread * 0.5, 0, 0, 0, 1, 0.75, 1));
    if (i % 2 === 0) parts.push(part(new THREE.SphereGeometry(0.06, 6, 5), THEME.leaf, x + (rnd() - 0.5) * spread, y + (rnd() - 0.5) * spread * 0.6, z + (rnd() - 0.5) * spread * 0.5, 0, 0, 0, 1.4, 0.5, 0.8));
  }
}

export function buildDecor(id: string): THREE.Group {
  const g = new THREE.Group();
  g.userData.decorId = id;
  const P: THREE.BufferGeometry[] = [];
  switch (id) {
    case 'arch': {
      // 나무 기둥 2개 + 반원 아치, 흰 꽃으로 감싼다
      for (const s of [-1, 1]) {
        P.push(part(rbox(0.16, 2.1, 0.16, 0.06), THEME.white, s * 1.15, 1.05, 0));
        P.push(part(rbox(0.36, 0.16, 0.36, 0.06), THEME.ivory, s * 1.15, 0.08, 0));
      }
      const top = new THREE.TorusGeometry(1.15, 0.08, 10, 32, Math.PI);
      P.push(part(top, THEME.white, 0, 2.1, 0));
      for (let i = 0; i <= 22; i++) {
        const a = (i / 22) * Math.PI;
        flowerCluster(P, Math.cos(a) * 1.15, 2.1 + Math.sin(a) * 1.15, 0.02, 3, 0.28, i + 3);
      }
      for (const s of [-1, 1]) for (let k = 0; k < 6; k++) flowerCluster(P, s * 1.15, 0.5 + k * 0.28, 0.06, 2, 0.24, k * 7 + (s > 0 ? 1 : 2));
      // 리본
      for (const s of [-1, 1]) P.push(part(new THREE.ConeGeometry(0.08, 0.5, 8), THEME.pink, s * 1.32, 1.85, 0.08, 0, 0, s * 0.25));
      g.add(mesh(P));
      break;
    }
    case 'chair': {
      P.push(part(rbox(0.46, 0.07, 0.44, 0.03), THEME.wood, 0, 0.42, 0));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.push(part(rbox(0.06, 0.42, 0.06, 0.02), THEME.woodDark, sx * 0.19, 0.21, sz * 0.18));
      for (const sx of [-1, 1]) P.push(part(rbox(0.06, 0.48, 0.06, 0.02), THEME.woodDark, sx * 0.19, 0.68, -0.19));
      P.push(part(rbox(0.46, 0.2, 0.05, 0.02), THEME.wood, 0, 0.82, -0.19));
      P.push(part(new THREE.SphereGeometry(0.05, 8, 6), THEME.pink, 0.21, 0.92, -0.17));
      g.add(mesh(P));
      break;
    }
    case 'aisle_rug': {
      const rug = new THREE.Mesh(rbox(1.3, 0.025, 3.0, 0.012, 2), mat(THEME.ivory, { rough: 1 }));
      rug.position.y = 0.0225;
      rug.receiveShadow = true;
      g.add(rug);
      for (let i = 0; i < 36; i++) {
        const x = Math.sin(i * 12.3) * 0.55;
        const z = -1.4 + (i / 36) * 2.8;
        P.push(part(new THREE.CircleGeometry(0.04, 6), i % 3 ? THEME.pink : THEME.white, x, 0.037, z, -Math.PI / 2, 0, 0, 1, 0.6, 1));
      }
      for (const s of [-1, 1]) P.push(part(rbox(0.06, 0.03, 3.0, 0.01), THEME.pinkDeep, s * 0.62, 0.036, 0));
      const petals = mesh(P, 1);
      petals.castShadow = false;
      g.add(petals);
      break;
    }
    case 'centerpiece': {
      P.push(part(new THREE.CylinderGeometry(0.36, 0.36, 0.05, 20), THEME.white, 0, 0.72, 0));
      P.push(part(new THREE.CylinderGeometry(0.05, 0.07, 0.7, 10), THEME.ivory, 0, 0.35, 0));
      P.push(part(new THREE.CylinderGeometry(0.2, 0.22, 0.04, 16), THEME.ivory, 0, 0.02, 0));
      P.push(part(new THREE.CylinderGeometry(0.1, 0.08, 0.18, 12), '#CFE5EA', 0, 0.84, 0));
      flowerCluster(P, 0, 1.0, 0, 9, 0.3, 5);
      g.add(mesh(P));
      break;
    }
    case 'lantern': {
      P.push(part(new THREE.CylinderGeometry(0.035, 0.05, 1.05, 8), THEME.woodDark, 0, 0.52, 0));
      P.push(part(new THREE.CylinderGeometry(0.18, 0.2, 0.06, 10), THEME.woodDark, 0, 0.03, 0));
      P.push(part(rbox(0.26, 0.06, 0.26, 0.02), THEME.woodDark, 0, 1.06, 0));
      P.push(part(new THREE.ConeGeometry(0.2, 0.14, 4), THEME.woodDark, 0, 1.45, 0, 0, Math.PI / 4, 0));
      g.add(mesh(P));
      const glow = new THREE.Mesh(rbox(0.2, 0.3, 0.2, 0.04), new THREE.MeshStandardMaterial({ color: '#FFF1C8', emissive: new THREE.Color('#FFC27A'), emissiveIntensity: 0.4, roughness: 0.4 }));
      glow.position.y = 1.24;
      glow.userData.lanternGlow = true;
      g.add(glow);
      break;
    }
    case 'cake_table': {
      P.push(part(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 24), THEME.white, 0, 0.74, 0));
      P.push(part(new THREE.CylinderGeometry(0.52, 0.56, 0.5, 24, 1, true), THEME.ivory, 0, 0.5, 0));
      P.push(part(new THREE.CylinderGeometry(0.06, 0.08, 0.7, 10), THEME.woodDark, 0, 0.36, 0));
      const tiers: Array<[number, number, number]> = [
        [0.3, 0.2, 0.87],
        [0.22, 0.18, 1.06],
        [0.15, 0.16, 1.23],
      ];
      for (const [r, h, y] of tiers) {
        P.push(part(new THREE.CylinderGeometry(r, r, h, 24), '#FFFDF8', 0, y, 0));
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          P.push(part(new THREE.SphereGeometry(0.022, 6, 5), THEME.pink, Math.cos(a) * r, y - h / 2 + 0.02, Math.sin(a) * r));
        }
      }
      flowerCluster(P, 0, 1.36, 0, 4, 0.12, 9);
      g.add(mesh(P));
      break;
    }
    case 'flower_pot': {
      P.push(part(new THREE.CylinderGeometry(0.27, 0.2, 0.42, 16), '#D9876C', 0, 0.21, 0));
      P.push(part(new THREE.CylinderGeometry(0.29, 0.29, 0.07, 16), '#C97A60', 0, 0.42, 0));
      P.push(part(blob(0.26, 10), THEME.leafDeep, 0, 0.55, 0, 0, 0, 0, 1, 0.65, 1));
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        P.push(part(new THREE.SphereGeometry(0.07, 8, 6), i % 2 ? THEME.yellow : THEME.pink, Math.cos(a) * 0.17, 0.66 + (i % 3) * 0.04, Math.sin(a) * 0.17));
      }
      g.add(mesh(P));
      break;
    }
    case 'ribbon_post': {
      P.push(part(new THREE.CylinderGeometry(0.06, 0.07, 1.3, 10), THEME.white, 0, 0.65, 0));
      P.push(part(new THREE.SphereGeometry(0.09, 10, 8), THEME.ivory, 0, 1.34, 0));
      for (const s of [-1, 1]) P.push(part(new THREE.ConeGeometry(0.08, 0.16, 10), THEME.pink, s * 0.08, 1.12, 0.05, 0, 0, (s * Math.PI) / 2));
      P.push(part(new THREE.SphereGeometry(0.04, 8, 6), THEME.pinkDeep, 0, 1.12, 0.06));
      g.add(mesh(P));
      // 나풀거리는 리본 꼬리(따로 흔든다)
      const tailM = new THREE.MeshStandardMaterial({ color: THEME.pink, side: THREE.DoubleSide, roughness: 0.7 });
      for (const s of [-1, 1]) {
        const t = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.55, 1, 6), tailM);
        t.geometry.translate(0, -0.27, 0);
        t.position.set(s * 0.05, 1.1, 0.07);
        t.userData.ribbonTail = s;
        g.add(t);
      }
      break;
    }
    case 'photo_frame': {
      // 이젤 + 액자(사진은 setFramePhoto 로)
      P.push(part(rbox(0.06, 1.25, 0.06, 0.02), THEME.woodDark, -0.28, 0.6, 0.05, 0.12, 0, 0.1));
      P.push(part(rbox(0.06, 1.25, 0.06, 0.02), THEME.woodDark, 0.28, 0.6, 0.05, 0.12, 0, -0.1));
      P.push(part(rbox(0.06, 1.2, 0.06, 0.02), THEME.woodDark, 0, 0.6, -0.22, -0.3, 0, 0));
      P.push(part(rbox(0.86, 0.05, 0.12, 0.02), THEME.woodDark, 0, 0.62, 0.08));
      P.push(part(rbox(0.86, 0.66, 0.06, 0.04), '#E3B866', 0, 1.0, 0.06, -0.12, 0, 0));
      g.add(mesh(P, 0.6));
      const photo = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.54), new THREE.MeshStandardMaterial({ color: '#F3ECDD', roughness: 0.7 }));
      photo.position.set(0, 1.0, 0.095);
      photo.rotation.x = -0.12;
      photo.userData.framePhoto = true;
      g.add(photo);
      break;
    }
    default: {
      g.add(mesh([part(rbox(0.5, 0.5, 0.5, 0.1), '#CCCCCC', 0, 0.25, 0)]));
    }
  }
  return g;
}

/** 배치 미리보기(유효 = 초록 · 충돌 = 빨강 · 통로 막힘 = 주황) */
export function makeGhost(id: string): THREE.Group {
  const g = buildDecor(id);
  const ghostMat = new THREE.MeshBasicMaterial({ color: '#7BC47F', transparent: true, opacity: 0.45, depthWrite: false });
  g.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      m.material = ghostMat;
      m.castShadow = false;
      m.receiveShadow = false;
    }
  });
  g.userData.ghostMat = ghostMat;
  return g;
}

export function setGhostTone(g: THREE.Group, tone: 'ok' | 'bad' | 'warn') {
  const m = g.userData.ghostMat as THREE.MeshBasicMaterial;
  if (!m) return;
  m.color.set(tone === 'ok' ? '#7BC47F' : tone === 'warn' ? '#F0B35E' : '#E8796B');
}

const texLoader = new THREE.TextureLoader();
export function setFramePhoto(g: THREE.Group, dataUrl: string | null) {
  g.traverse((c) => {
    if (c.userData.framePhoto) {
      const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (!dataUrl) {
        m.map = null;
        m.color.set('#F3ECDD');
        m.needsUpdate = true;
        return;
      }
      texLoader.load(dataUrl, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        m.map = tex;
        m.color.set('#FFFFFF');
        m.needsUpdate = true;
      });
    }
  });
}
