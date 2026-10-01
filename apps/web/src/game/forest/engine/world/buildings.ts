// 건물과 소품 — 짧고 넓은 몸체 · 폭신한 지붕 · 실제보다 조금 두툼한 소품(제작 프롬프트 4쪽).
// 정적인 부분은 정점색으로 합쳐 한 메시, 밤에 빛나는 창·전구는 따로(밤 연출).
import * as THREE from 'three';
import { BOUTIQUE, GARDEN, GATE_SIGN, GREENHOUSE, HOME, LAKE, PLAZA, ROCKS, WORKSHOP } from '../../data/world';
import { mat, textTexture } from '../materials';
import { blob, merge, paint, part, place, rbox } from '../geom';
import type { Collision } from '../collision';
import type { DayNight } from '../lighting';

class Parts {
  list: THREE.BufferGeometry[] = [];
  add(g: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    this.list.push(part(g, color, x, y, z, rx, ry, rz, sx, sy, sz));
  }
  mesh(occlude = true, rough = 0.9): THREE.Mesh {
    const m = new THREE.Mesh(merge(this.list), mat('#ffffff', { vertexColors: true, rough, occlude }));
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }
}

export interface BuildingsBuild {
  mailboxFlag: THREE.Object3D;
  mailbox: THREE.Object3D;
  windowMat: THREE.MeshStandardMaterial;
  bulbMat: THREE.MeshStandardMaterial;
  archMarker: THREE.Mesh;
  signs: THREE.Mesh[];
}

function sign(scene: THREE.Scene, text: string[], x: number, z: number, ry = 0, w = 1.5, h = 0.62, y = 1.3, postH = 1.0): THREE.Mesh {
  const p = new Parts();
  p.add(rbox(0.12, postH + 0.4, 0.12, 0.04), '#8E6A4C', -w * 0.36, (postH + 0.4) / 2, 0);
  p.add(rbox(0.12, postH + 0.4, 0.12, 0.04), '#8E6A4C', w * 0.36, (postH + 0.4) / 2, 0);
  p.add(rbox(w + 0.12, h + 0.12, 0.12, 0.06), '#9B7752', 0, y, -0.02);
  const base = p.mesh();
  base.position.set(x, 0, z);
  base.rotation.y = ry;
  scene.add(base);
  const tex = textTexture(text, { w: 512, h: Math.round(512 * (h / w)), bg: '#F5E9D2', fg: '#5A4330', font: text.length > 1 ? 70 : 84, radius: 26 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  face.position.set(0, y, 0.05);
  base.add(face);
  return base;
}

function lamp(scene: THREE.Scene, x: number, z: number, bulb: THREE.MeshStandardMaterial) {
  const p = new Parts();
  p.add(new THREE.CylinderGeometry(0.06, 0.09, 2.3, 10), '#5D5A57', 0, 1.15, 0);
  p.add(new THREE.CylinderGeometry(0.18, 0.22, 0.16, 12), '#5D5A57', 0, 0.08, 0);
  p.add(new THREE.CylinderGeometry(0.2, 0.16, 0.08, 12), '#4F4C49', 0, 2.62, 0);
  p.add(new THREE.ConeGeometry(0.24, 0.18, 12), '#4F4C49', 0, 2.76, 0);
  const m = p.mesh();
  m.position.set(x, 0, z);
  scene.add(m);
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), bulb);
  b.position.set(x, 2.45, z);
  scene.add(b);
}

export function buildBuildings(scene: THREE.Scene, col: Collision, light: DayNight): BuildingsBuild {
  const windowMat = new THREE.MeshStandardMaterial({ color: '#CFE5EA', roughness: 0.25, metalness: 0.05, emissive: new THREE.Color('#FFC77E'), emissiveIntensity: 0 });
  light.registerEmissive(windowMat, 1.25);
  const bulbMat = new THREE.MeshStandardMaterial({ color: '#FFF4D6', roughness: 0.4, emissive: new THREE.Color('#FFC27A'), emissiveIntensity: 0 });
  light.registerEmissive(bulbMat, 2.4);
  const signs: THREE.Mesh[] = [];

  // ── 우리의 집 ──
  {
    const [hx, hz] = HOME.house;
    const [w, d] = HOME.houseSize;
    const p = new Parts();
    p.add(rbox(w + 0.3, 0.26, d + 0.3, 0.08), '#D8D2C4', 0, 0.13, 0);
    p.add(rbox(w, 2.45, d, 0.22, 4), '#F7F2E7', 0, 0.26 + 1.22, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.add(rbox(0.22, 2.45, 0.22, 0.08), '#C9A27A', sx * (w / 2 - 0.05), 1.48, sz * (d / 2 - 0.05));
    // 폭신한 박공지붕(용마루는 x 방향)
    const slope = 0.58;
    for (const s of [-1, 1]) p.add(rbox(w + 0.75, 0.36, d / 2 + 0.75, 0.16, 4), '#C9785B', 0, 3.02, s * (d / 4 + 0.08), s * slope, 0, 0);
    p.add(new THREE.CylinderGeometry(0.2, 0.2, w + 0.8, 14), '#B5664C', 0, 3.7, 0, 0, 0, Math.PI / 2);
    // 박공 벽(양옆 삼각형) — 깊이 폭 삼각형을 집 너비만큼 밀어 y축 90° 회전
    const gable = new THREE.Shape();
    gable.moveTo(-d / 2, 0);
    gable.lineTo(d / 2, 0);
    gable.lineTo(0, 1.05);
    gable.closePath();
    const gg = new THREE.ExtrudeGeometry(gable, { depth: w - 0.2, bevelEnabled: false });
    gg.translate(0, 0, -(w - 0.2) / 2);
    p.add(gg, '#F3ECDD', 0, 2.68, 0, 0, Math.PI / 2, 0);
    // 굴뚝
    p.add(rbox(0.5, 1.0, 0.5, 0.08), '#CDB9A2', w / 2 - 0.9, 3.4, -0.6);
    p.add(rbox(0.62, 0.14, 0.62, 0.05), '#A8957E', w / 2 - 0.9, 3.95, -0.6);
    // 문
    p.add(rbox(1.0, 1.66, 0.16, 0.08), '#A77D5A', 0, 0.26 + 0.83, d / 2 + 0.02);
    p.add(new THREE.SphereGeometry(0.06, 10, 8), '#E3B866', 0.33, 1.05, d / 2 + 0.12);
    p.add(rbox(1.4, 0.12, 0.7, 0.05), '#D8D2C4', 0, 0.06, d / 2 + 0.45);
    // 창틀 · 화분 상자
    for (const sx of [-1, 1]) {
      p.add(rbox(0.98, 0.86, 0.12, 0.06), '#FFFFFF', sx * 1.35, 1.55, d / 2 + 0.02);
      p.add(rbox(1.02, 0.22, 0.28, 0.05), '#B98A62', sx * 1.35, 1.02, d / 2 + 0.16);
      for (let i = 0; i < 5; i++) p.add(new THREE.SphereGeometry(0.08, 8, 6), i % 2 ? '#F4B9C9' : '#FFFFFF', sx * 1.35 - 0.36 + i * 0.18, 1.17, d / 2 + 0.18);
    }
    const house = p.mesh();
    house.position.set(hx, 0, hz);
    scene.add(house);
    for (const sx of [-1, 1]) {
      const win = new THREE.Mesh(rbox(0.78, 0.66, 0.06, 0.04), windowMat);
      win.position.set(hx + sx * 1.35, 1.55, hz + d / 2 + 0.07);
      scene.add(win);
    }
    col.box(hx, hz, w + 0.3, d + 0.3);
    light.addLamp(scene, hx + 2.6, 2.4, hz + 2.4, '#FFC58A', 9);
    lamp(scene, hx + 2.6, hz + 2.4, bulbMat);
    col.circle(hx + 2.6, hz + 2.4, 0.2);
  }
  // 우편함(흔들림 · 편지 오면 깃발)
  const mailbox = new THREE.Group();
  {
    const p = new Parts();
    p.add(rbox(0.1, 1.0, 0.1, 0.03), '#8E6A4C', 0, 0.5, 0);
    p.add(rbox(0.46, 0.34, 0.6, 0.15), '#8FB9C9', 0, 1.1, 0);
    p.add(new THREE.CylinderGeometry(0.23, 0.23, 0.6, 16, 1, false, 0, Math.PI), '#8FB9C9', 0, 1.26, 0, Math.PI / 2, 0, Math.PI / 2);
    const m = p.mesh();
    mailbox.add(m);
    mailbox.position.set(HOME.mailbox[0], 0, HOME.mailbox[1]);
    scene.add(mailbox);
    col.circle(HOME.mailbox[0], HOME.mailbox[1], 0.3);
  }
  const mailboxFlag = new THREE.Group();
  {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.35, 6), mat('#6B5B4E'));
    pole.position.y = 0.17;
    const flag = new THREE.Mesh(rbox(0.16, 0.11, 0.025, 0.02), mat('#E86F6F', { rough: 0.6 }));
    flag.position.set(0.08, 0.3, 0);
    mailboxFlag.add(pole, flag);
    mailboxFlag.position.set(0.26, 1.05, 0.1);
    mailboxFlag.rotation.z = -1.4;
    mailbox.add(mailboxFlag);
  }
  // 보관함
  {
    const p = new Parts();
    p.add(rbox(0.9, 0.5, 0.56, 0.08), '#B98A62', 0, 0.25, 0);
    p.add(rbox(0.94, 0.14, 0.6, 0.06), '#A77D5A', 0, 0.55, 0);
    p.add(rbox(0.12, 0.14, 0.04, 0.02), '#E3B866', 0, 0.42, 0.3);
    const m = p.mesh();
    m.position.set(HOME.storage[0], 0, HOME.storage[1]);
    scene.add(m);
    col.box(HOME.storage[0], HOME.storage[1], 0.94, 0.6);
  }
  // 앞마당 화단 흙 · 약속의 나무 자리
  {
    const p = new Parts();
    for (const [x, z] of HOME.plots) p.add(rbox(0.96, 0.14, 0.96, 0.06), '#8A6A4E', x - HOME.plots[0][0], 0.07, z - HOME.plots[0][1]);
    const m = p.mesh(false, 1);
    m.position.set(HOME.plots[0][0], 0, HOME.plots[0][1]);
    scene.add(m);
    const mound = new THREE.Mesh(paint(new THREE.SphereGeometry(0.7, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#8A6A4E'), mat('#ffffff', { vertexColors: true, rough: 1 }));
    mound.scale.y = 0.18;
    mound.position.set(HOME.promiseTree[0], 0, HOME.promiseTree[1]);
    mound.receiveShadow = true;
    scene.add(mound);
    // 낮은 울타리(서쪽)
    const f = new Parts();
    for (let z = HOME.yard.minZ; z <= HOME.yard.maxZ + 0.01; z += 0.8) f.add(rbox(0.12, 0.62, 0.12, 0.05), '#F3ECDD', 0, 0.31, z - HOME.yard.minZ);
    f.add(rbox(0.07, 0.08, HOME.yard.maxZ - HOME.yard.minZ, 0.03), '#F3ECDD', 0, 0.45, (HOME.yard.maxZ - HOME.yard.minZ) / 2);
    f.add(rbox(0.07, 0.08, HOME.yard.maxZ - HOME.yard.minZ, 0.03), '#F3ECDD', 0, 0.22, (HOME.yard.maxZ - HOME.yard.minZ) / 2);
    const fm = f.mesh();
    fm.position.set(HOME.yard.minX - 0.5, 0, HOME.yard.minZ);
    scene.add(fm);
    col.box(HOME.yard.minX - 0.5, (HOME.yard.minZ + HOME.yard.maxZ) / 2, 0.2, HOME.yard.maxZ - HOME.yard.minZ);
  }
  signs.push(sign(scene, ['우리의 집'], HOME.house[0] - 3.1, HOME.house[1] + 2.9, 0.2, 1.3, 0.5, 1.05, 0.8));

  // ── 꽃잎 온실 ──
  {
    const [gx, gz] = GREENHOUSE.center;
    const [w, d] = GREENHOUSE.size;
    const p = new Parts();
    p.add(rbox(w + 0.2, 0.5, d + 0.2, 0.08), '#E7CDBE', 0, 0.25, 0);
    // 흰 골조
    for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) p.add(rbox(0.1, 2.2, 0.1, 0.03), '#FFFFFF', sx * (w / 2 - 0.05), 1.6, sz * (d / 2 - 0.05));
    for (const sx of [-1, 1]) p.add(rbox(0.1, 2.2, 0.1, 0.03), '#FFFFFF', sx * (w / 2 - 0.05), 1.6, 0);
    p.add(rbox(w, 0.1, 0.1, 0.03), '#FFFFFF', 0, 2.7, d / 2 - 0.05);
    p.add(rbox(w, 0.1, 0.1, 0.03), '#FFFFFF', 0, 2.7, -d / 2 + 0.05);
    p.add(rbox(w + 0.2, 0.12, 0.12, 0.04), '#FFFFFF', 0, 3.85, 0);
    // 안쪽 화분 선반 · 꽃
    p.add(rbox(w - 0.6, 0.1, 0.7, 0.03), '#B98A62', 0, 1.15, -d / 2 + 0.6);
    for (let i = 0; i < 9; i++) {
      const x = -w / 2 + 0.6 + i * ((w - 1.2) / 8);
      p.add(new THREE.CylinderGeometry(0.16, 0.12, 0.25, 10), '#D9876C', x, 1.33, -d / 2 + 0.6);
      p.add(blob(0.2, 10), ['#F4B9C9', '#FFFFFF', '#F6D46B', '#79A960'][i % 4], x, 1.58, -d / 2 + 0.6);
    }
    for (let i = 0; i < 4; i++) p.add(blob(0.42, 12), '#79A960', -w / 2 + 0.9 + i * 1.15, 0.85, 0.6, 0, 0, 0, 1, 0.8, 1);
    const base = p.mesh();
    base.position.set(gx, 0, gz);
    scene.add(base);
    // 유리
    const glassMat = new THREE.MeshStandardMaterial({ color: '#D6ECF0', transparent: true, opacity: 0.26, roughness: 0.1, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide });
    const glass = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, 2.15, d - 0.1), glassMat);
    glass.position.set(gx, 1.6, gz);
    glass.renderOrder = 3;
    scene.add(glass);
    for (const s of [-1, 1]) {
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.05, d / 2 + 0.35), glassMat);
      roof.position.set(gx, 3.25, gz + s * (d / 4 + 0.1));
      roof.rotation.x = s * 0.62;
      roof.renderOrder = 3;
      scene.add(roof);
    }
    col.box(gx, gz, w + 0.2, d + 0.2);
    // 소담의 가판대(줄무늬 차양)
    const [cx, cz] = GREENHOUSE.counter;
    const c = new Parts();
    c.add(rbox(1.9, 0.9, 0.75, 0.08), '#C79A6B', 0, 0.45, 0);
    c.add(rbox(2.0, 0.08, 0.85, 0.04), '#F3ECDD', 0, 0.93, 0);
    for (const s of [-1, 1]) c.add(new THREE.CylinderGeometry(0.04, 0.04, 2.0, 8), '#FFFFFF', s * 0.92, 1.0, -0.32);
    for (let i = 0; i < 6; i++) c.add(rbox(0.36, 0.06, 1.15, 0.03), i % 2 ? '#FFFFFF' : '#F0AFC4', -0.9 + i * 0.36, 2.0, 0.08, 0.32, 0, 0);
    for (let i = 0; i < 4; i++) {
      c.add(new THREE.CylinderGeometry(0.13, 0.11, 0.2, 10), '#8FB9C9', -0.6 + i * 0.4, 1.06, -0.05);
      c.add(blob(0.15, 10), ['#FFFFFF', '#F4B9C9', '#F6D46B', '#FFFFFF'][i], -0.6 + i * 0.4, 1.26, -0.05);
    }
    const counter = c.mesh();
    counter.position.set(cx, 0, cz);
    counter.rotation.y = -0.35;
    scene.add(counter);
    col.box(cx, cz, 1.9, 0.75, -0.35);
    // 부케 테이블
    const [bx, bz] = GREENHOUSE.bouquetTable;
    const t = new Parts();
    t.add(new THREE.CylinderGeometry(0.55, 0.55, 0.07, 24), '#FFFFFF', 0, 0.78, 0);
    t.add(new THREE.CylinderGeometry(0.06, 0.08, 0.76, 10), '#F3ECDD', 0, 0.38, 0);
    t.add(new THREE.CylinderGeometry(0.28, 0.32, 0.05, 16), '#F3ECDD', 0, 0.025, 0);
    t.add(new THREE.CylinderGeometry(0.09, 0.07, 0.2, 12), '#CFE5EA', 0.18, 0.92, -0.1);
    for (let i = 0; i < 3; i++) t.add(blob(0.07, 8), '#FFFFFF', 0.18 + (i - 1) * 0.06, 1.07, -0.1);
    t.add(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 16), '#F4B9C9', -0.2, 0.84, 0.1, Math.PI / 2, 0, 0);
    const table = t.mesh();
    table.position.set(bx, 0, bz);
    scene.add(table);
    col.circle(bx, bz, 0.55);
    // 온실 화단(흙)
    const f = new Parts();
    for (const [x, z] of GREENHOUSE.plots) f.add(rbox(0.96, 0.14, 0.96, 0.06), '#8A6A4E', x - GREENHOUSE.plots[0][0], 0.07, z - GREENHOUSE.plots[0][1]);
    const fm = f.mesh(false, 1);
    fm.position.set(GREENHOUSE.plots[0][0], 0, GREENHOUSE.plots[0][1]);
    scene.add(fm);
    signs.push(sign(scene, ['꽃잎 온실'], gx - 2.0, gz + 3.0, -0.3));
    lamp(scene, gx - 3.4, gz + 3.6, bulbMat);
    col.circle(gx - 3.4, gz + 3.6, 0.2);
  }

  // ── 나뭇결 공방 ──
  {
    const [wx, wz] = WORKSHOP.center;
    const [w, d] = WORKSHOP.size;
    const p = new Parts();
    p.add(rbox(w + 0.3, 0.24, d + 0.3, 0.08), '#C8BDAA', 0, 0.12, 0);
    p.add(rbox(w, 2.3, d, 0.2, 4), '#C49468', 0, 1.39, 0);
    for (let i = 0; i < 6; i++) p.add(rbox(w + 0.06, 0.07, d + 0.06, 0.03), '#A97A52', 0, 0.45 + i * 0.36, 0);
    const slope = 0.55;
    for (const s of [-1, 1]) p.add(rbox(w + 0.7, 0.36, d / 2 + 0.7, 0.16, 4), '#6E9A63', 0, 2.88, s * (d / 4 + 0.08), s * slope, 0, 0);
    p.add(new THREE.CylinderGeometry(0.19, 0.19, w + 0.75, 14), '#5E8A55', 0, 3.55, 0, 0, 0, Math.PI / 2);
    const gable = new THREE.Shape();
    gable.moveTo(-d / 2, 0);
    gable.lineTo(d / 2, 0);
    gable.lineTo(0, 0.95);
    gable.closePath();
    const gg = new THREE.ExtrudeGeometry(gable, { depth: w - 0.2, bevelEnabled: false });
    gg.translate(0, 0, -(w - 0.2) / 2);
    p.add(gg, '#B98A62', 0, 2.54, 0, 0, Math.PI / 2, 0);
    p.add(rbox(1.1, 1.7, 0.16, 0.08), '#8E6A4C', -0.6, 0.24 + 0.85, d / 2 + 0.02);
    p.add(rbox(0.95, 0.8, 0.12, 0.06), '#F3ECDD', 1.2, 1.5, d / 2 + 0.02);
    const cabin = p.mesh();
    cabin.position.set(wx, 0, wz);
    scene.add(cabin);
    const win = new THREE.Mesh(rbox(0.75, 0.62, 0.06, 0.04), windowMat);
    win.position.set(wx + 1.2, 1.5, wz + d / 2 + 0.07);
    scene.add(win);
    col.box(wx, wz, w + 0.3, d + 0.3);
    // 작업대
    const [bx, bz] = WORKSHOP.workbench;
    const b = new Parts();
    b.add(rbox(1.7, 0.14, 0.8, 0.05), '#C79A6B', 0, 0.86, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(rbox(0.12, 0.8, 0.12, 0.04), '#A77D5A', sx * 0.72, 0.4, sz * 0.3);
    b.add(rbox(0.9, 0.06, 0.28, 0.02), '#E2C49A', -0.2, 0.96, -0.12);
    b.add(rbox(0.5, 0.05, 0.22, 0.02), '#9AA0A6', 0.5, 0.95, 0.15, 0, 0.4, 0);
    b.add(new THREE.CylinderGeometry(0.02, 0.02, 0.26, 8), '#8E6A4C', 0.35, 0.97, -0.2, 0, 0, Math.PI / 2);
    b.add(rbox(0.12, 0.06, 0.06, 0.02), '#7F858B', 0.5, 0.98, -0.2);
    const bench = b.mesh();
    bench.position.set(bx, 0, bz);
    scene.add(bench);
    col.box(bx, bz, 1.7, 0.8);
    // 목재 더미
    const [lx, lz] = WORKSHOP.logs;
    const l = new Parts();
    const rows: Array<[number, number]> = [[0, 0.2], [0, 0.55], [0, 0.9]];
    rows.forEach(([, y], ri) => {
      const n = 4 - ri;
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * 0.38;
        l.add(new THREE.CylinderGeometry(0.19, 0.19, 1.3, 12), '#B07F55', x, y, 0, Math.PI / 2, 0, 0);
        l.add(new THREE.CylinderGeometry(0.15, 0.15, 1.32, 12), '#E2C49A', x, y, 0, Math.PI / 2, 0, 0);
      }
    });
    const logs = l.mesh();
    logs.position.set(lx, 0, lz);
    scene.add(logs);
    col.box(lx, lz, 1.7, 1.4);
    signs.push(sign(scene, ['나뭇결 공방'], wx + 2.9, wz + 2.8, 0.25));
    lamp(scene, wx + 2.9, wz + 3.9, bulbMat);
    col.circle(wx + 2.9, wz + 3.9, 0.2);
  }

  // ── 햇살 의상실(동쪽을 본다) ──
  {
    const [bx, bz] = BOUTIQUE.center;
    const [w, d] = BOUTIQUE.size;
    const p = new Parts();
    p.add(rbox(w + 0.3, 0.24, d + 0.3, 0.08), '#E4DCCD', 0, 0.12, 0);
    p.add(rbox(w, 2.5, d, 0.22, 4), '#F8E8DA', 0, 1.49, 0);
    const slope = 0.58;
    for (const s of [-1, 1]) p.add(rbox(w / 2 + 0.6, 0.36, d + 0.75, 0.16, 4), '#E2A5B8', s * (w / 4 + 0.06), 3.06, 0, 0, 0, -s * slope);
    p.add(new THREE.CylinderGeometry(0.2, 0.2, d + 0.8, 14), '#D493A7', 0, 3.8, 0, Math.PI / 2, 0, 0);
    const gable = new THREE.Shape();
    gable.moveTo(-w / 2, 0);
    gable.lineTo(w / 2, 0);
    gable.lineTo(0, 1.05);
    gable.closePath();
    const gg = new THREE.ExtrudeGeometry(gable, { depth: d - 0.2, bevelEnabled: false });
    gg.translate(0, 0, -(d - 0.2) / 2);
    p.add(gg, '#F3E0D2', 0, 2.72, 0);
    // 쇼윈도 틀 · 문 · 차양
    p.add(rbox(0.12, 1.5, 2.1, 0.05), '#FFFFFF', w / 2 + 0.02, 1.35, -0.9);
    p.add(rbox(0.16, 1.7, 1.0, 0.08), '#C98FA3', w / 2 + 0.02, 0.24 + 0.85, 1.25);
    for (let i = 0; i < 7; i++) p.add(rbox(1.0, 0.06, 0.48, 0.03), i % 2 ? '#FFFFFF' : '#F0AFC4', w / 2 + 0.42, 2.45, -1.7 + i * 0.48, 0, 0, -0.38);
    const shop = p.mesh();
    shop.position.set(bx, 0, bz);
    scene.add(shop);
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.3, 1.9), new THREE.MeshStandardMaterial({ color: '#E3F0F2', transparent: true, opacity: 0.35, roughness: 0.1, depthWrite: false }));
    win.position.set(bx + w / 2 + 0.06, 1.35, bz - 0.9);
    scene.add(win);
    // 쇼윈도 안 마네킹(드레스·턱시도)
    const mq = new Parts();
    mq.add(new THREE.ConeGeometry(0.42, 1.1, 20), '#FFFDF7', 0, 0.75, -0.45);
    mq.add(new THREE.SphereGeometry(0.17, 14, 10), '#FFFDF7', 0, 1.38, -0.45);
    mq.add(rbox(0.36, 0.7, 0.24, 0.1), '#3E4556', 0, 1.0, 0.45);
    mq.add(rbox(0.3, 0.55, 0.2, 0.06), '#3E4556', 0, 0.45, 0.45);
    mq.add(new THREE.SphereGeometry(0.15, 14, 10), '#F3ECDD', 0, 1.5, 0.45);
    const manq = mq.mesh(false);
    manq.position.set(bx + w / 2 - 0.55, 0.24, bz - 0.9);
    scene.add(manq);
    col.box(bx, bz, w + 0.3, d + 0.3);
    // 전신 거울
    const [mx, mz] = BOUTIQUE.mirror;
    const m = new Parts();
    m.add(rbox(0.12, 0.1, 0.5, 0.04), '#C79A6B', 0, 0.05, 0);
    m.add(new THREE.TorusGeometry(0.42, 0.06, 10, 28), '#E3B866', 0, 1.15, 0, 0, Math.PI / 2, 0, 1, 1.55, 1);
    const frame = m.mesh();
    frame.position.set(mx, 0, mz);
    scene.add(frame);
    const glassMirror = new THREE.Mesh(new THREE.CircleGeometry(0.4, 28), new THREE.MeshStandardMaterial({ color: '#DCEBF0', roughness: 0.05, metalness: 0.6 }));
    glassMirror.scale.y = 1.55;
    glassMirror.position.set(mx + 0.01, 1.15, mz);
    glassMirror.rotation.y = Math.PI / 2;
    scene.add(glassMirror);
    const glassBack = glassMirror.clone();
    glassBack.rotation.y = -Math.PI / 2;
    glassBack.position.x = mx - 0.01;
    scene.add(glassBack);
    col.circle(mx, mz, 0.35);
    signs.push(sign(scene, ['햇살 의상실'], bx + 3.4, bz - 2.6, Math.PI / 2 - 0.2));
  }

  // ── 약속의 광장 ──
  {
    const [tx, tz] = PLAZA.bigTree;
    const p = new Parts();
    p.add(new THREE.CylinderGeometry(0.45, 0.7, 2.4, 14), '#8E6A4C', 0, 1.2, 0);
    p.add(new THREE.CylinderGeometry(0.75, 1.0, 0.3, 14), '#856247', 0, 0.15, 0);
    for (const [x, y, z, r, c] of [
      [0, 3.6, 0, 2.2, '#6A9E5C'],
      [1.4, 3.1, 0.4, 1.5, '#5C8F53'],
      [-1.4, 3.2, -0.2, 1.6, '#5C8F53'],
      [0.3, 4.6, -0.3, 1.5, '#7AAD66'],
      [-0.5, 3.0, 1.2, 1.3, '#6A9E5C'],
      [0.5, 3.0, -1.3, 1.3, '#5C8F53'],
    ] as Array<[number, number, number, number, string]>) p.add(blob(r, 18), c, x, y, z);
    const tree = new THREE.Mesh(merge(p.list), mat('#ffffff', { vertexColors: true, rough: 0.92, occlude: true, sway: { base: 2.6, amp: 0.012 } }));
    tree.castShadow = true;
    tree.receiveShadow = true;
    tree.position.set(tx, 0, tz);
    scene.add(tree);
    col.circle(tx, tz, 0.85);
    // 나무 둘레 원형 벤치
    const rb = new Parts();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      rb.add(rbox(0.68, 0.1, 0.42, 0.04), '#C79A6B', Math.cos(a) * 1.35, 0.45, Math.sin(a) * 1.35, 0, -a + Math.PI / 2, 0);
      rb.add(rbox(0.1, 0.44, 0.1, 0.03), '#A77D5A', Math.cos(a) * 1.35, 0.22, Math.sin(a) * 1.35);
    }
    const ring = rb.mesh();
    ring.position.set(tx, 0, tz);
    scene.add(ring);
    col.circle(tx, tz, 1.6);
    // 게시판
    const [gx, gz] = PLAZA.board;
    const g = new Parts();
    for (const s of [-1, 1]) g.add(rbox(0.12, 1.9, 0.12, 0.04), '#8E6A4C', s * 0.75, 0.95, 0);
    g.add(rbox(1.7, 1.05, 0.12, 0.08), '#A77D5A', 0, 1.35, 0);
    g.add(rbox(1.5, 0.88, 0.04, 0.04), '#E9D5B4', 0, 1.35, 0.07);
    g.add(rbox(1.9, 0.14, 0.42, 0.06), '#6E9A63', 0, 1.98, 0);
    g.add(rbox(0.42, 0.5, 0.01, 0.01), '#FFFFFF', -0.42, 1.42, 0.1, 0, 0, 0.06);
    g.add(rbox(0.36, 0.42, 0.01, 0.01), '#FBE3EA', 0.08, 1.3, 0.1, 0, 0, -0.05);
    g.add(rbox(0.4, 0.34, 0.01, 0.01), '#FFF6D8', 0.5, 1.46, 0.1, 0, 0, 0.04);
    const board = g.mesh();
    board.position.set(gx, 0, gz);
    board.rotation.y = -0.25;
    scene.add(board);
    col.box(gx, gz, 1.9, 0.4, -0.25);
    // 벤치
    const [bx, bz] = PLAZA.bench;
    const b = new Parts();
    for (let i = 0; i < 3; i++) b.add(rbox(1.6, 0.07, 0.15, 0.03), '#C79A6B', 0, 0.45, -0.17 + i * 0.17);
    for (let i = 0; i < 2; i++) b.add(rbox(1.6, 0.13, 0.06, 0.03), '#C79A6B', 0, 0.72 + i * 0.2, -0.3, -0.15, 0, 0);
    for (const s of [-1, 1]) {
      b.add(rbox(0.1, 0.45, 0.42, 0.03), '#6B6560', s * 0.7, 0.225, 0);
      b.add(rbox(0.08, 0.5, 0.08, 0.03), '#6B6560', s * 0.7, 0.75, -0.3);
    }
    const bench = b.mesh();
    bench.position.set(bx, 0, bz);
    bench.rotation.y = 0.3;
    scene.add(bench);
    col.box(bx, bz, 1.6, 0.6, 0.3);
    PLAZA.lamps.forEach(([lx, lz], i) => {
      lamp(scene, lx, lz, bulbMat);
      col.circle(lx, lz, 0.2);
      if (i < 2) light.addLamp(scene, lx, 2.5, lz, '#FFC58A', 12);
    });
  }

  // ── 서약의 정원 ──
  {
    signs.push(sign(scene, ['서약의 정원', '꾸미기 · 예식'], GARDEN.sign[0], GARDEN.sign[1], -0.2, 1.6, 0.8, 1.35, 1.0));
    col.circle(GARDEN.sign[0], GARDEN.sign[1], 0.35);
    for (const s of [-1, 1]) {
      lamp(scene, s * 2.2, GARDEN.maxZ + 0.6, bulbMat);
      col.circle(s * 2.2, GARDEN.maxZ + 0.6, 0.2);
    }
    light.addLamp(scene, 0, 2.6, GARDEN.minZ + 4, '#FFC58A', 13);
    // 사회자 단(작은 나무 단)
    const p = new Parts();
    p.add(rbox(0.6, 0.95, 0.42, 0.06), '#C79A6B', 0, 0.475, 0);
    p.add(rbox(0.7, 0.08, 0.52, 0.04), '#E2C49A', 0, 0.98, 0, -0.25, 0, 0);
    for (let i = 0; i < 5; i++) p.add(new THREE.SphereGeometry(0.06, 8, 6), i % 2 ? '#FFFFFF' : '#F4B9C9', -0.24 + i * 0.12, 0.7, 0.23);
    const podium = p.mesh();
    podium.position.set(GARDEN.officiant[0] + 1.4, 0, GARDEN.officiant[1] + 0.2);
    scene.add(podium);
    col.box(GARDEN.officiant[0] + 1.4, GARDEN.officiant[1] + 0.2, 0.6, 0.42);
  }
  // 아치 자리 표시(꾸미기 때만)
  const archMarker = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.28, 40), new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.6, depthWrite: false }));
  archMarker.rotation.x = -Math.PI / 2;
  archMarker.position.set(GARDEN.archSpot[0], 0.03, GARDEN.archSpot[1]);
  archMarker.scale.set(1.25, 0.5, 1);
  archMarker.visible = false;
  scene.add(archMarker);

  // ── 달빛 호수 데크 ──
  {
    const dk = LAKE.deck;
    const p = new Parts();
    const len = dk.maxX - dk.minX;
    for (let i = 0; i < Math.round(len / 0.32); i++) p.add(rbox(0.3, 0.1, dk.maxZ - dk.minZ, 0.03), i % 2 ? '#C79A6B' : '#BD9063', dk.minX + 0.16 + i * 0.32, 0.28, (dk.minZ + dk.maxZ) / 2);
    for (const x of [dk.minX + 1.2, dk.maxX - 0.2]) for (const z of [dk.minZ + 0.1, dk.maxZ - 0.1]) p.add(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8), '#8E6A4C', x, 0.1, z);
    // 데크 끝 벤치
    p.add(rbox(1.2, 0.08, 0.36, 0.03), '#A77D5A', dk.maxX - 0.6, 0.62, (dk.minZ + dk.maxZ) / 2, 0, Math.PI / 2, 0);
    const deck = p.mesh();
    scene.add(deck);
    lamp(scene, dk.minX + 0.5, dk.minZ - 0.5, bulbMat);
    col.circle(dk.minX + 0.5, dk.minZ - 0.5, 0.2);
  }

  // ── 숲 입구(환영 아치) · 표지판 ──
  {
    const p = new Parts();
    for (const s of [-1, 1]) p.add(rbox(0.28, 3.0, 0.28, 0.1), '#9B7752', s * 1.7, 1.5, 0);
    p.add(rbox(4.0, 0.3, 0.36, 0.12), '#8E6A4C', 0, 3.05, 0);
    for (let i = 0; i < 16; i++) p.add(blob(0.16, 8), i % 3 ? '#79A960' : i % 2 ? '#FFFFFF' : '#F4B9C9', -1.8 + i * 0.24, 3.25 + Math.sin(i) * 0.06, 0.05);
    const gate = p.mesh();
    gate.position.set(0, 0, 24.2);
    scene.add(gate);
    col.circle(-1.7, 24.2, 0.25);
    col.circle(1.7, 24.2, 0.25);
    const tex = textTexture(['결혼의 숲'], { w: 512, h: 128, bg: '#F5E9D2', fg: '#5A4330', font: 80, radius: 30 });
    // 카메라 쪽(남)을 본다 — 카메라를 가리면 디더로 비워진다
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.55), mat('#ffffff', { map: tex, rough: 0.9, occlude: true }));
    plate.position.set(0, 2.55, 24.42);
    scene.add(plate);
    signs.push(sign(scene, ['약속의 광장 ↑', '꽃잎 온실 · 공방'], GATE_SIGN[0], GATE_SIGN[1], -0.3, 1.5, 0.7, 1.3));
    col.circle(GATE_SIGN[0], GATE_SIGN[1], 0.4);
    signs.push(sign(scene, ['속삭임 숲 →'], 20.6, -0.8, 0.1, 1.3, 0.5, 1.15));
    col.circle(20.6, -0.8, 0.35);
  }

  // ── 바위(작은 돌) ──
  for (const r of ROCKS) {
    const p = new Parts();
    p.add(new THREE.IcosahedronGeometry(0.55, 2), '#CFC8BA', 0, 0.32, 0, 0, 0.4, 0, 1.2, 0.72, 1);
    p.add(new THREE.IcosahedronGeometry(0.32, 2), '#BDB5A6', 0.5, 0.18, 0.25, 0, 0, 0, 1, 0.7, 1);
    const m = p.mesh(false);
    m.position.set(r.pos[0], 0, r.pos[1]);
    scene.add(m);
    col.circle(r.pos[0], r.pos[1], 0.6);
  }

  return { mailboxFlag, mailbox, windowMat, bulbMat, archMarker, signs };
}

export function placeOnGround(o: THREE.Object3D, x: number, z: number) {
  o.position.set(x, 0, z);
}
void place;
