// 귀여운 2.6등신 캐릭터(사람 아바타 · 동물 주민 공용 뼈대).
//  키 1.0 기준: 다리 0.30 · 몸통 0.30 · 머리 지름 0.40(전체 키의 40%). 어깨 폭 ≈ 머리 폭의 65%.
//  부위: root(발밑) → body(흔들림) → hips(다리·치마·꼬리) / torso(팔·머리)
//  손 부착점(handR)은 부케·카드·망치 같은 소품이 같이 쓴다.
import * as THREE from 'three';
import { Face, FACE_H, FACE_W, type FaceExpr, type FaceSpec } from './face';
import { charMat, blobShadow } from '../materials';
import { lathe, merge } from '../geom';
import { HAIR_COLORS, OUTFITS, SHOES, SKINS, wornOutfit, type Appearance } from '../../data/appearance';
import type { AnimalLook } from '../../data/residents';

const HEAD_R = 0.2;

export type Pose = 'idle' | 'walk' | 'run' | 'reach' | 'shake' | 'sit' | 'cheer' | 'clap' | 'wave' | 'hold' | 'peace' | 'heart' | 'think' | 'bow' | 'ring';

export class Chibi {
  root = new THREE.Group();
  body = new THREE.Group();
  hips = new THREE.Group();
  torso = new THREE.Group();
  head = new THREE.Group();
  armL = new THREE.Group();
  armR = new THREE.Group();
  legL = new THREE.Group();
  legR = new THREE.Group();
  handR = new THREE.Group();
  handL = new THREE.Group();
  hairGroup = new THREE.Group();
  accGroup = new THREE.Group();
  skirtGroup = new THREE.Group();
  tail = new THREE.Group();
  face: Face;
  faceMesh: THREE.Mesh;
  shadow: THREE.Mesh;
  /** 갈아 끼우는 부품 */
  private dyn: THREE.Object3D[] = [];
  mats: Record<string, THREE.MeshStandardMaterial> = {};
  // 애니메이션 상태
  pose: Pose = 'idle';
  poseT = 0;
  speed = 0;
  phase = 0;
  yaw = 0;
  headYaw = 0;
  headPitch = 0;
  hairLag = 0;
  skirtSwing = 0;
  blinkAt = 1 + Math.random() * 3;
  blinkUntil = 0;
  exprUntil = 0;
  baseExpr: FaceExpr = 'normal';
  bouquet: THREE.Object3D | null = null;
  ringSpark: THREE.Object3D | null = null;
  hideLegs = false;

  constructor(spec: FaceSpec) {
    this.face = new Face(spec);
    this.root.add(this.body);
    this.body.add(this.hips);
    this.body.add(this.torso);
    this.hips.position.y = 0.3;
    this.torso.position.y = 0.3;
    this.hips.add(this.legL, this.legR, this.skirtGroup, this.tail);
    this.legL.position.set(-0.062, 0, 0);
    this.legR.position.set(0.062, 0, 0);
    this.torso.add(this.armL, this.armR, this.head);
    this.armL.position.set(-0.142, 0.265, 0);
    this.armR.position.set(0.142, 0.265, 0);
    this.head.position.y = 0.31;
    this.tail.position.set(0, 0.04, -0.11);
    // 얼굴 데칼 — 머리 앞쪽 구면 조각(u: 162°, v: 54°~144°)
    const phiLen = Math.PI * 0.9;
    const faceGeo = new THREE.SphereGeometry(HEAD_R, 40, 20, Math.PI / 2 - phiLen / 2, phiLen, Math.PI * 0.3, Math.PI * 0.5);
    this.faceMesh = new THREE.Mesh(faceGeo, new THREE.MeshStandardMaterial({ map: this.face.texture, transparent: true, roughness: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
    this.faceMesh.position.y = 0.19;
    // 머리 구와 같은 비율로 아주 조금 크게(얼굴 가장자리 볼터치까지 머리에 묻히지 않게)
    this.faceMesh.scale.set(1.02 * 1.008, 0.97 * 1.008, 0.98 * 1.008);
    this.faceMesh.renderOrder = 2;
    this.head.add(this.faceMesh);
    this.head.add(this.hairGroup, this.accGroup);
    this.shadow = blobShadow(0.62, 0.9);
    this.root.add(this.shadow);
    void FACE_H;
    void FACE_W;
  }

  protected track<T extends THREE.Object3D>(o: T): T {
    this.dyn.push(o);
    o.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) {
        c.castShadow = true;
        c.receiveShadow = false;
      }
    });
    return o;
  }

  protected clearDyn() {
    for (const o of this.dyn) {
      o.parent?.remove(o);
      o.traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.isMesh) m.geometry.dispose();
      });
    }
    this.dyn = [];
    if (this.bouquet) {
      this.bouquet.parent?.remove(this.bouquet);
      this.bouquet = null;
    }
  }

  protected m(key: string, color: string, rough = 0.85): THREE.MeshStandardMaterial {
    const cur = this.mats[key];
    if (cur) {
      cur.color.set(color);
      cur.roughness = rough;
      return cur;
    }
    const mm = charMat(color, rough);
    this.mats[key] = mm;
    return mm;
  }

  /** 공통 몸: 머리 구 · 몸통 · 팔 · 다리 */
  protected buildBase(skin: string, top: string, sleeves: 'short' | 'long' | 'none', topAccent: string | null, legColor: string, legUpper: string | null, shoe: string, shoeKind: 'sneaker' | 'dress' | 'sandal' | 'paw', accentKind: 'bib' | 'collar' | 'none' = 'bib') {
    const skinM = this.m('skin', skin, 0.9);
    const topM = this.m('top', top, 0.92);
    // 머리
    const headMesh = this.track(new THREE.Mesh(new THREE.SphereGeometry(HEAD_R, 40, 30), skinM));
    headMesh.position.y = 0.19;
    headMesh.scale.set(1.02, 0.97, 0.98);
    this.head.add(headMesh);
    // 목(짧게)
    const neck = this.track(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.05, 14), skinM));
    neck.position.y = 0.0;
    this.head.add(neck);
    // 몸통(둥근 통)
    const torsoGeo = lathe([
      [0.0, 0.0],
      [0.112, 0.0],
      [0.128, 0.05],
      [0.134, 0.13],
      [0.128, 0.22],
      [0.108, 0.28],
      [0.065, 0.31],
      [0.0, 0.315],
    ], 24);
    const torsoMesh = this.track(new THREE.Mesh(torsoGeo, topM));
    this.torso.add(torsoMesh);
    if (topAccent && accentKind === 'bib') {
      // 멜빵 턱받이 · 셔츠 앞판 — 몸통 앞을 감싸는 둥근 조각 + 어깨끈
      const front = this.track(new THREE.Mesh(new THREE.SphereGeometry(0.137, 24, 14, Math.PI / 2 - 0.7, 1.4, Math.PI * 0.26, Math.PI * 0.46), this.m('topAccent', topAccent, 0.9)));
      front.position.y = 0.13;
      front.scale.set(1.0, 1.06, 1.0);
      this.torso.add(front);
      // 어깨끈(앞에서 어깨 위로)
      for (const sx of [-1, 1]) {
        const strap = this.track(new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.07, 4, 8), this.m('topAccent', topAccent, 0.9)));
        strap.position.set(sx * 0.062, 0.268, 0.085);
        strap.rotation.x = -0.55;
        this.torso.add(strap);
      }
    } else if (topAccent && accentKind === 'collar') {
      // 둥근 옷깃
      const collar = this.track(new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.018, 8, 24), this.m('topAccent', topAccent, 0.9)));
      collar.rotation.x = Math.PI / 2;
      collar.position.y = 0.302;
      collar.scale.set(1.1, 1, 0.85);
      this.torso.add(collar);
    }
    // 팔
    for (const [arm, hand, side] of [
      [this.armL, this.handL, -1],
      [this.armR, this.handR, 1],
    ] as Array<[THREE.Group, THREE.Group, number]>) {
      const sleeveM = sleeves === 'long' ? topM : skinM;
      const upper = this.track(new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.11, 6, 12), sleeveM));
      upper.position.y = -0.085;
      arm.add(upper);
      if (sleeves === 'short') {
        const cuff = this.track(new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.052, 0.07, 14), topM));
        cuff.position.y = -0.03;
        arm.add(cuff);
      }
      const handMesh = this.track(new THREE.Mesh(new THREE.SphereGeometry(0.047, 16, 12), skinM));
      hand.position.y = -0.175;
      hand.add(handMesh);
      arm.add(hand);
      arm.rotation.z = side * 0.12;
    }
    // 다리
    const legM = this.m('leg', legColor, 0.9);
    for (const leg of [this.legL, this.legR]) {
      const l = this.track(new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.13, 6, 12), legM));
      l.position.y = -0.11;
      leg.add(l);
      if (legUpper) {
        const up = this.track(new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.058, 0.09, 14), this.m('legUpper', legUpper, 0.9)));
        up.position.y = -0.035;
        leg.add(up);
      }
      // 도톰한 신발
      const shoeM = this.m('shoe', shoe, shoeKind === 'dress' ? 0.45 : 0.85);
      const s = this.track(new THREE.Mesh(new THREE.SphereGeometry(0.062, 18, 12), shoeM));
      s.position.set(0, -0.255, 0.02);
      s.scale.set(1.0, shoeKind === 'sandal' ? 0.5 : 0.66, 1.42);
      leg.add(s);
    }
  }

  /** 소품 손에 들기 */
  holdItem(kind: 'bouquet' | 'card' | 'hammer' | 'camera' | 'watering' | null) {
    if (this.bouquet) {
      this.bouquet.parent?.remove(this.bouquet);
      this.bouquet = null;
    }
    if (!kind) return;
    const g = new THREE.Group();
    if (kind === 'bouquet') {
      const ribbon = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 12), charMat('#F4B9C9', 0.7));
      ribbon.rotation.x = Math.PI;
      ribbon.position.y = -0.03;
      g.add(ribbon);
      const flowerM = charMat('#FFFFFF', 0.8);
      const centerM = charMat('#F3CF5B', 0.7);
      const leafM = charMat('#7FAE62', 0.85);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const r = i === 0 ? 0 : 0.045;
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.034, 12, 10), flowerM);
        f.position.set(Math.cos(a) * r, 0.06 + (i === 0 ? 0.015 : 0), Math.sin(a) * r);
        f.scale.y = 0.7;
        g.add(f);
        const c = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), centerM);
        c.position.copy(f.position).add(new THREE.Vector3(0, 0.022, 0));
        g.add(c);
      }
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.3;
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), leafM);
        l.position.set(Math.cos(a) * 0.07, 0.035, Math.sin(a) * 0.07);
        l.scale.set(1.4, 0.5, 0.8);
        g.add(l);
      }
      g.position.set(0, -0.02, 0.03);
    } else if (kind === 'card') {
      const card = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.008), charMat('#FFFDF5', 0.9));
      card.position.set(0, 0.02, 0.04);
      card.rotation.x = -0.4;
      g.add(card);
    } else if (kind === 'hammer') {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8), charMat('#8E6A4C'));
      h.position.y = -0.03;
      g.add(h);
      const hd = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.04), charMat('#9AA0A6', 0.5));
      hd.position.y = 0.05;
      g.add(hd);
      g.rotation.x = 0.6;
    } else if (kind === 'camera') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.05), charMat('#3E3A38', 0.6));
      body.position.set(0, 0.02, 0.05);
      g.add(body);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.04, 12), charMat('#6B6763', 0.4));
      lens.rotation.x = Math.PI / 2;
      lens.position.set(0, 0.02, 0.09);
      g.add(lens);
    } else if (kind === 'watering') {
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.07, 12), charMat('#8FB9C9', 0.5));
      g.add(can);
    }
    g.traverse((c) => ((c as THREE.Mesh).isMesh ? ((c as THREE.Mesh).castShadow = true) : null));
    this.handR.add(g);
    this.bouquet = g;
  }

  setExpr(e: FaceExpr, ms = 1600) {
    this.face.setExpr(e);
    this.exprUntil = ms > 0 ? performance.now() + ms : 0;
  }

  setPose(p: Pose) {
    if (this.pose !== p) {
      this.pose = p;
      this.poseT = 0;
    }
  }

  /** 프레임마다 — speed(m/s) 에 맞춰 발 접지 주기, 대기·걷기·달리기 연결, 머리카락·치마는 조금 늦게 */
  animate(dt: number, now: number) {
    this.poseT += dt;
    const sp = this.speed;
    const moving = sp > 0.15;
    const run = sp > 3.6;
    const stride = run ? 0.62 : 0.4;
    if (moving) this.phase += (sp * dt) / stride * Math.PI;
    const t = this.phase;
    const amp = moving ? Math.min(1, sp / 2.6) * (run ? 0.95 : 0.62) : 0;
    let legL = Math.sin(t) * amp;
    let legR = -Math.sin(t) * amp;
    let armL = -Math.sin(t) * amp * 0.9;
    let armR = Math.sin(t) * amp * 0.9;
    let armLz = -0.12;
    let armRz = 0.12;
    let bob = moving ? Math.abs(Math.sin(t)) * (run ? 0.045 : 0.028) : Math.sin(now * 0.0021) * 0.004;
    let lean = run ? 0.16 : moving ? 0.05 : 0;
    let crouch = 0;
    let headPitchExtra = 0;
    const pt = this.poseT;
    switch (moving ? 'idle' : this.pose) {
      case 'reach': {
        const k = Math.sin(Math.min(1, pt / 0.6) * Math.PI);
        armR = -1.1 * k;
        armL = -0.3 * k;
        lean = 0.32 * k;
        crouch = 0.05 * k;
        headPitchExtra = 0.35 * k;
        break;
      }
      case 'shake': {
        const k = Math.min(1, pt / 0.15);
        armR = armL = -1.25 * k;
        armLz = 0.25;
        armRz = -0.25;
        lean = Math.sin(pt * 34) * 0.06 * k;
        break;
      }
      case 'sit':
        legL = legR = -1.45;
        crouch = 0.16;
        armL = armR = -0.35;
        break;
      case 'cheer':
        armL = armR = -2.7 + Math.sin(pt * 9) * 0.15;
        armLz = 0.35;
        armRz = -0.35;
        bob = Math.abs(Math.sin(pt * 6)) * 0.07;
        break;
      case 'clap': {
        const c = Math.sin(pt * 16);
        armL = armR = -1.25;
        armLz = 0.45 + c * 0.2;
        armRz = -0.45 - c * 0.2;
        break;
      }
      case 'wave':
        armR = -2.6;
        armRz = 0.25 + Math.sin(pt * 10) * 0.35;
        break;
      case 'hold':
        armR = -0.95;
        armL = -0.85;
        armLz = 0.42;
        armRz = -0.36;
        break;
      case 'ring':
        armR = -1.25;
        armL = -1.0;
        armLz = 0.3;
        armRz = -0.2;
        lean = 0.05;
        break;
      case 'peace':
        armR = -2.3;
        armRz = -0.25;
        break;
      case 'heart':
        armL = armR = -2.45;
        armLz = 0.62;
        armRz = -0.62;
        break;
      case 'think':
        armR = -1.6;
        armRz = -0.65;
        headPitchExtra = -0.1;
        break;
      case 'bow': {
        const k = Math.sin(Math.min(1, pt / 1.2) * Math.PI);
        lean = 0.45 * k;
        break;
      }
      default:
        break;
    }
    if (this.bouquet && this.pose === 'idle' && !moving && this.bouquetHeld) {
      armR = -0.95;
      armL = -0.8;
      armLz = 0.42;
      armRz = -0.36;
    }
    if (this.bouquet && moving && this.bouquetHeld) {
      armR = -0.9;
      armL = -0.7;
      armLz = 0.38;
      armRz = -0.32;
    }
    const k = 1 - Math.exp(-dt * 14);
    this.legL.rotation.x += (legL - this.legL.rotation.x) * k;
    this.legR.rotation.x += (legR - this.legR.rotation.x) * k;
    this.armL.rotation.x += (armL - this.armL.rotation.x) * k;
    this.armR.rotation.x += (armR - this.armR.rotation.x) * k;
    this.armL.rotation.z += (armLz - this.armL.rotation.z) * k;
    this.armR.rotation.z += (armRz - this.armR.rotation.z) * k;
    this.body.position.y = bob - crouch;
    this.body.rotation.x += (lean - this.body.rotation.x) * k;
    // 머리 — 시선(대상 바라보기)
    this.head.rotation.y += (this.headYaw - this.head.rotation.y) * (1 - Math.exp(-dt * 6));
    this.head.rotation.x += (this.headPitch + headPitchExtra - this.head.rotation.x) * (1 - Math.exp(-dt * 6));
    // 머리카락·치마 늦게 따라오기
    const turnRate = this.yawVel;
    this.hairLag += (-turnRate * 0.05 - this.hairLag) * (1 - Math.exp(-dt * 5));
    this.hairGroup.rotation.y = this.hairLag;
    this.hairGroup.rotation.x = -bob * 1.2;
    this.skirtSwing += ((moving ? Math.sin(t * 2) * 0.05 * amp : 0) - this.skirtSwing) * (1 - Math.exp(-dt * 8));
    this.skirtGroup.rotation.z = this.skirtSwing;
    this.skirtGroup.scale.set(1 + (moving ? 0.03 * amp : 0), 1, 1 + (moving ? 0.03 * amp : 0));
    this.tail.rotation.y = Math.sin(now * 0.003) * 0.15 + (moving ? Math.sin(t) * 0.2 : 0);
    // 눈 깜빡임
    const sec = now / 1000;
    if (sec > this.blinkAt) {
      this.face.setBlink(true);
      this.blinkUntil = sec + 0.12;
      this.blinkAt = sec + 2.2 + Math.random() * 3.4;
    }
    if (this.face.blink && sec > this.blinkUntil) this.face.setBlink(false);
    if (this.exprUntil && now > this.exprUntil) {
      this.exprUntil = 0;
      this.face.setExpr(this.baseExpr);
    }
    this.face.update();
    this.shadow.scale.setScalar(1 - bob * 2);
  }

  yawVel = 0;
  bouquetHeld = false;

  setYaw(y: number, dt: number) {
    let d = y - this.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const step = d * (1 - Math.exp(-dt * 12));
    this.yaw += step;
    this.yawVel = dt > 0 ? step / dt : 0;
    this.root.rotation.y = this.yaw;
  }

  snapYaw(y: number) {
    this.yaw = y;
    this.yawVel = 0;
    this.root.rotation.y = y;
  }
}

// ── 사람 아바타 ──────────────────────────────────────
export class Avatar extends Chibi {
  look: Appearance;

  constructor(look: Appearance) {
    super(Avatar.faceSpec(look));
    this.look = look;
    this.apply(look);
  }

  static faceSpec(look: Appearance): FaceSpec {
    const hair = HAIR_COLORS[look.hairColor] || HAIR_COLORS[0];
    return { kind: 'human', eyes: look.eyes, brows: look.brows, blush: look.blush, skin: SKINS[look.skin] || SKINS[1], browColor: shade(hair, -0.15), nose: 'human', mouth: 'smile' };
  }

  apply(look: Appearance) {
    this.look = { ...look };
    this.clearDyn();
    const held = this.bouquetHeld;
    const skin = SKINS[look.skin] || SKINS[1];
    const o = wornOutfit(look);
    const shoe = SHOES[look.shoes] || SHOES[0];
    const legColor = o.bottomKind === 'pants' ? o.bottom : skin;
    const legUpper = o.bottomKind === 'shorts' ? o.bottom : null;
    this.buildBase(skin, o.top, o.sleeves, o.accent !== o.top ? o.accent : null, legColor, legUpper, shoe.color, shoe.kind, o.accentKind ?? 'bib');
    this.face.setSpec(Avatar.faceSpec(look));
    this.buildBottom(o.bottomKind, o.bottom, o.id);
    this.buildHair(look);
    this.buildAccessory(look);
    if (o.id === 'tux') this.buildTuxDetails();
    if (o.id === 'aline') this.buildVeil();
    this.hideLegs = !!o.hidesLegs;
    this.legL.visible = this.legR.visible = !this.hideLegs;
    if (held) {
      this.bouquetHeld = true;
      this.holdItem('bouquet');
    }
  }

  private buildBottom(kind: string, color: string, outfitId: string) {
    const cm = this.m('bottom', color, outfitId === 'aline' ? 0.6 : 0.92);
    if (kind === 'skirt') {
      const g = lathe([
        [0.118, 0.13],
        [0.13, 0.08],
        [0.16, 0.0],
        [0.19, -0.08],
        [0.196, -0.1],
        [0.0, -0.1],
      ], 24);
      const sk = this.track(new THREE.Mesh(g, cm));
      this.skirtGroup.add(sk);
    } else if (kind === 'longdress') {
      // A라인 — 허리선을 높게, 밑단은 넓고 둥글게(작은 몸 비율이 느껴지게)
      const g = lathe([
        [0.12, 0.17],
        [0.128, 0.12],
        [0.15, 0.05],
        [0.19, -0.05],
        [0.235, -0.15],
        [0.262, -0.24],
        [0.268, -0.27],
        [0.24, -0.285],
        [0.0, -0.285],
      ], 32);
      const sk = this.track(new THREE.Mesh(g, cm));
      this.skirtGroup.add(sk);
      // 허리 리본 띠
      const sash = this.track(new THREE.Mesh(new THREE.TorusGeometry(0.128, 0.014, 8, 28), this.m('sash', '#F2DCC8', 0.6)));
      sash.rotation.x = Math.PI / 2;
      sash.position.y = 0.155;
      this.skirtGroup.add(sash);
      // 레이스 느낌의 밑단 점
      const dotM = this.m('lace', '#F1E6D6', 0.7);
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        const d = this.track(new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), dotM));
        d.position.set(Math.cos(a) * 0.262, -0.255, Math.sin(a) * 0.262);
        this.skirtGroup.add(d);
      }
    } else if (kind === 'pants' || kind === 'shorts') {
      // 엉덩이 부분 이음
      const g = lathe([
        [0.115, 0.06],
        [0.122, 0.0],
        [0.11, -0.04],
        [0.0, -0.045],
      ], 20);
      this.skirtGroup.add(this.track(new THREE.Mesh(g, cm)));
    }
  }

  private buildHair(look: Appearance) {
    const hc = HAIR_COLORS[look.hairColor] || HAIR_COLORS[0];
    const hm = this.m('hair', hc, 0.78);
    const cy = 0.19;
    // 머리카락 덩어리는 모두 같은 재질 — 한 메시로 합쳐 그리기 호출을 줄인다
    const parts: THREE.BufferGeometry[] = [];
    const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => {
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz)), new THREE.Vector3(sx, sy, sz));
      parts.push(geo.applyMatrix4(m));
    };
    // 정수리 덮개 — 이마선(약 65°)까지만(얼굴·눈을 가리지 않게)
    add(new THREE.SphereGeometry(HEAD_R * 1.07, 36, 20, 0, Math.PI * 2, 0, Math.PI * 0.37), 0, cy + 0.008, -0.004, 1.02, 1.0, 1.04);
    // 옆·뒷머리 — 얼굴 앞(±65°)은 비우고 뒤쪽을 감싼다
    add(new THREE.SphereGeometry(HEAD_R * 1.055, 30, 18, Math.PI * 0.86, Math.PI * 1.28, Math.PI * 0.28, Math.PI * 0.42), 0, cy, -0.006);
    // 앞머리(이마 위 둥근 덩어리 3개)
    const bang = (x: number, rot: number, s = 1) => add(new THREE.SphereGeometry(0.085, 16, 12), x, cy + 0.12, 0.13, 1.25 * s, 0.62 * s, 0.7, -0.35, rot);
    if (look.hair === 'short') {
      bang(-0.07, 0.3, 0.9);
      bang(0.02, -0.1, 0.95);
      bang(0.09, -0.35, 0.85);
      // 옆머리 짧게
      add(new THREE.SphereGeometry(0.07, 14, 10), -0.18, cy + 0.03, 0.03, 0.55, 1.0, 0.9);
      add(new THREE.SphereGeometry(0.07, 14, 10), 0.18, cy + 0.03, 0.03, 0.55, 1.0, 0.9);
    } else {
      bang(-0.08, 0.35);
      bang(0.0, 0.05, 1.05);
      bang(0.085, -0.35);
    }
    if (look.hair === 'bob') {
      // 턱선까지 둥근 단발
      const sideGeo = new THREE.SphereGeometry(0.11, 18, 14);
      add(sideGeo, -0.17, cy - 0.05, 0.0, 0.62, 1.25, 1.05);
      add(sideGeo, 0.17, cy - 0.05, 0.0, 0.62, 1.25, 1.05);
      add(new THREE.SphereGeometry(0.2, 24, 16), 0, cy - 0.04, -0.07, 1.06, 0.9, 0.78);
    } else if (look.hair === 'long') {
      const sideGeo = new THREE.SphereGeometry(0.1, 18, 14);
      add(sideGeo, -0.175, cy - 0.1, 0.02, 0.55, 1.9, 0.95);
      add(sideGeo, 0.175, cy - 0.1, 0.02, 0.55, 1.9, 0.95);
      // 등 뒤로 긴 머리(목 아래까지)
      add(new THREE.CapsuleGeometry(0.15, 0.2, 8, 18), 0, cy - 0.15, -0.09, 1.15, 1.0, 0.62);
    } else if (look.hair === 'bun') {
      add(new THREE.SphereGeometry(0.1, 18, 14), 0, cy + 0.2, -0.06, 1, 0.92, 1);
      const sideGeo = new THREE.SphereGeometry(0.075, 14, 10);
      add(sideGeo, -0.175, cy - 0.02, 0.03, 0.55, 1.15, 0.9);
      add(sideGeo, 0.175, cy - 0.02, 0.03, 0.55, 1.15, 0.9);
    } else {
      add(new THREE.SphereGeometry(0.19, 22, 14), 0, cy - 0.02, -0.06, 1.0, 0.8, 0.8);
    }
    this.hairGroup.add(this.track(new THREE.Mesh(merge(parts), hm)));
  }

  private buildAccessory(look: Appearance) {
    const cy = 0.19;
    const g = this.accGroup;
    if (look.glasses) {
      const gm = this.m('glasses', '#4A3B33', 0.5);
      for (const x of [-0.07, 0.07]) {
        const ring = this.track(new THREE.Mesh(new THREE.TorusGeometry(0.043, 0.0075, 8, 24), gm));
        ring.position.set(x, cy - 0.005, 0.192);
        g.add(ring);
      }
      const bridge = this.track(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 6), gm));
      bridge.rotation.z = Math.PI / 2;
      bridge.position.set(0, cy + 0.005, 0.2);
      g.add(bridge);
    }
    const acc = look.accessory;
    if (acc === 'crown') {
      const colors = ['#FFFFFF', '#F4B9C9', '#F6D46B'];
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const f = this.track(new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), this.m(`crown${i % 3}`, colors[i % 3], 0.8)));
        f.position.set(Math.cos(a) * 0.17, cy + 0.15 + Math.sin(a * 2) * 0.005, Math.sin(a) * 0.17);
        g.add(f);
      }
    } else if (acc === 'ribbon') {
      const rm = this.m('ribbonAcc', '#EE8FA8', 0.6);
      for (const side of [-1, 1]) {
        const c = this.track(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.09, 12), rm));
        c.rotation.z = (side * Math.PI) / 2;
        c.position.set(side * 0.05, cy + 0.17, -0.12);
        g.add(c);
      }
      const knot = this.track(new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), rm));
      knot.position.set(0, cy + 0.17, -0.12);
      g.add(knot);
    } else if (acc === 'straw') {
      const sm = this.m('straw', '#E8CF8F', 0.95);
      const brim = this.track(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.018, 32), sm));
      brim.position.set(0, cy + 0.15, -0.01);
      g.add(brim);
      const crownM = this.track(new THREE.Mesh(new THREE.SphereGeometry(0.19, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), sm));
      crownM.position.set(0, cy + 0.14, -0.01);
      crownM.scale.y = 0.75;
      g.add(crownM);
      const band = this.track(new THREE.Mesh(new THREE.CylinderGeometry(0.192, 0.192, 0.03, 32), this.m('strawBand', '#E7A0B4', 0.7)));
      band.position.set(0, cy + 0.165, -0.01);
      g.add(band);
    } else if (acc === 'pin') {
      const pm = this.m('pin', '#F4B9C9', 0.7);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const p = this.track(new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), pm));
        p.position.set(0.15 + Math.cos(a) * 0.02, cy + 0.11 + Math.sin(a) * 0.02, 0.1);
        g.add(p);
      }
      const c = this.track(new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 6), this.m('pinC', '#F6D46B', 0.6)));
      c.position.set(0.15, cy + 0.11, 0.115);
      g.add(c);
    }
  }

  private buildTuxDetails() {
    const bow = this.m('bow', '#E5A1B3', 0.6);
    for (const side of [-1, 1]) {
      const c = this.track(new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.045, 10), bow));
      c.rotation.z = (side * Math.PI) / 2;
      c.position.set(side * 0.022, 0.285, 0.085);
      this.torso.add(c);
    }
    // 부토니에르(가슴 꽃)
    const f = this.track(new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), this.m('bout', '#FFFFFF', 0.7)));
    f.position.set(-0.07, 0.22, 0.115);
    this.torso.add(f);
  }

  private buildVeil() {
    // 얇은 천(반투명) — 머리 뒤로 흐름
    const veilM = new THREE.MeshStandardMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.38, roughness: 0.6, side: THREE.DoubleSide, depthWrite: false });
    // 뒤쪽 140°만 덮고 등 쪽으로 길게 — 앞에서 보면 얼굴이 그대로 보인다
    const veil = this.track(new THREE.Mesh(new THREE.SphereGeometry(0.235, 28, 16, Math.PI * 1.11, Math.PI * 0.78, Math.PI * 0.16, Math.PI * 0.5), veilM));
    veil.position.set(0, 0.2, -0.035);
    veil.scale.set(1.0, 1.65, 1.0);
    veil.castShadow = false;
    this.hairGroup.add(veil);
    // 진주(작은 무광 광택)
    const pearl = this.m('pearl', '#FBF6EE', 0.35);
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * 0.62 + (i / 8) * Math.PI * 0.76;
      const p = this.track(new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), pearl));
      p.position.set(Math.cos(a) * 0.205, 0.33, Math.sin(a) * 0.205 - 0.01);
      this.hairGroup.add(p);
    }
  }
}

// ── 동물 주민 ────────────────────────────────────────
export class Animal extends Chibi {
  look: AnimalLook;

  constructor(look: AnimalLook) {
    super(Animal.faceSpec(look));
    this.look = look;
    this.build();
  }

  static faceSpec(l: AnimalLook): FaceSpec {
    const muzzle = ['bear', 'dog', 'fox', 'deer'].includes(l.species) ? l.light : null;
    return {
      kind: 'animal',
      eyes: 'dot',
      brows: 'none',
      blush: l.species === 'rabbit' || l.species === 'squirrel' || l.species === 'cat' ? 1 : 0,
      skin: l.fur,
      browColor: '#4A332A',
      muzzle,
      nose: l.species === 'rabbit' || l.species === 'cat' ? 'pink' : 'dark',
      mouth: l.species === 'rabbit' || l.species === 'cat' || l.species === 'squirrel' ? 'w' : 'smile',
      whiskers: l.species === 'cat',
      eyeGap: 1.08,
    };
  }

  private build() {
    const l = this.look;
    const legUpper = l.bottom === 'shorts' ? l.bottomColor : null;
    const legColor = l.bottom === 'pants' ? l.bottomColor : l.fur;
    this.buildBase(l.fur, l.outfit, 'short', l.outfitAccent !== l.outfit ? l.outfitAccent : null, legColor, legUpper, shade(l.fur, -0.12), 'paw', l.accentKind ?? 'collar');
    // 하의
    const bm = this.m('bottom', l.bottomColor, 0.9);
    if (l.bottom === 'skirt') {
      const g = lathe([
        [0.118, 0.13],
        [0.13, 0.08],
        [0.165, 0.0],
        [0.192, -0.07],
        [0.0, -0.075],
      ], 22);
      this.skirtGroup.add(this.track(new THREE.Mesh(g, bm)));
    } else {
      const g = lathe([
        [0.115, 0.06],
        [0.124, 0.0],
        [0.11, -0.04],
        [0.0, -0.045],
      ], 20);
      this.skirtGroup.add(this.track(new THREE.Mesh(g, bm)));
    }
    const furM = this.m('skin', l.fur, 0.92);
    const lightM = this.m('light', l.light, 0.92);
    const cy = 0.19;
    const head = this.head;
    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0, parent: THREE.Object3D = head) => {
      const mesh = this.track(new THREE.Mesh(geo, mat));
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      mesh.rotation.set(rx, ry, rz);
      parent.add(mesh);
      return mesh;
    };
    switch (l.species) {
      case 'rabbit':
        for (const s of [-1, 1]) {
          add(new THREE.CapsuleGeometry(0.048, 0.2, 8, 14), furM, s * 0.075, cy + 0.27, -0.02, 1, 1, 0.7, 0, 0, -s * 0.16);
          add(new THREE.CapsuleGeometry(0.028, 0.16, 6, 10), lightM, s * 0.078, cy + 0.27, 0.012, 1, 1, 0.4, 0, 0, -s * 0.16);
        }
        add(new THREE.SphereGeometry(0.05, 12, 10), furM, 0, 0.06, -0.12, 1, 1, 1, 0, 0, 0, this.hips);
        break;
      case 'bear':
        for (const s of [-1, 1]) {
          add(new THREE.SphereGeometry(0.065, 16, 12), furM, s * 0.14, cy + 0.15, -0.02, 1, 1, 0.7);
          add(new THREE.SphereGeometry(0.035, 12, 10), lightM, s * 0.14, cy + 0.15, 0.012, 1, 1, 0.5);
        }
        add(new THREE.SphereGeometry(0.045, 12, 10), furM, 0, 0.06, -0.12, 1, 1, 1, 0, 0, 0, this.hips);
        break;
      case 'squirrel': {
        for (const s of [-1, 1]) add(new THREE.ConeGeometry(0.045, 0.1, 12), furM, s * 0.12, cy + 0.19, -0.01, 1, 1, 0.7, 0, 0, -s * 0.35);
        // 큰 꼬리 — 등 뒤로 S자 곡선의 둥근 덩어리들
        const tailM = this.m('tail', l.fur, 0.95);
        const pts = [
          [0, 0.02, -0.05, 0.07],
          [0, 0.1, -0.12, 0.09],
          [0, 0.22, -0.15, 0.11],
          [0, 0.35, -0.12, 0.12],
          [0, 0.45, -0.05, 0.1],
          [0, 0.5, 0.02, 0.08],
        ];
        pts.forEach(([x, y, z, r]) => add(new THREE.SphereGeometry(r, 14, 12), tailM, x, y, z, 1, 1, 1, 0, 0, 0, this.tail));
        add(new THREE.SphereGeometry(0.06, 12, 10), lightM, 0, 0.47, 0.0, 1, 1, 1, 0, 0, 0, this.tail);
        break;
      }
      case 'cat':
        for (const s of [-1, 1]) {
          add(new THREE.ConeGeometry(0.06, 0.11, 4), furM, s * 0.12, cy + 0.18, -0.01, 1, 1, 0.75, 0, Math.PI / 4, -s * 0.28);
        }
        add(new THREE.CapsuleGeometry(0.025, 0.2, 6, 10), furM, 0, 0.12, -0.1, 1, 1, 1, -0.6, 0, 0, this.tail);
        break;
      case 'fox':
        for (const s of [-1, 1]) {
          add(new THREE.ConeGeometry(0.06, 0.13, 4), furM, s * 0.12, cy + 0.19, -0.01, 1, 1, 0.75, 0, Math.PI / 4, -s * 0.26);
          add(new THREE.ConeGeometry(0.03, 0.05, 4), this.m('earTip', '#4A3328', 0.9), s * 0.143, cy + 0.255, -0.01, 1, 1, 0.75, 0, Math.PI / 4, -s * 0.26);
        }
        add(new THREE.SphereGeometry(0.09, 14, 12), furM, 0, 0.12, -0.13, 0.9, 1.5, 0.9, -0.5, 0, 0, this.tail);
        add(new THREE.SphereGeometry(0.06, 12, 10), lightM, 0, 0.27, -0.2, 1, 1, 1, 0, 0, 0, this.tail);
        break;
      case 'dog':
        for (const s of [-1, 1]) add(new THREE.CapsuleGeometry(0.045, 0.1, 6, 12), this.m('ear', shade(l.fur, -0.18), 0.9), s * 0.19, cy + 0.03, 0.0, 0.7, 1, 1, 0, 0, s * 0.25);
        add(new THREE.CapsuleGeometry(0.025, 0.1, 6, 10), furM, 0, 0.1, -0.1, 1, 1, 1, -0.9, 0, 0, this.tail);
        break;
      case 'deer':
        for (const s of [-1, 1]) {
          add(new THREE.SphereGeometry(0.05, 12, 10), furM, s * 0.19, cy + 0.1, -0.01, 1.4, 0.55, 0.7, 0, 0, s * 0.3);
          const antM = this.m('antler', '#E8D8BE', 0.8);
          add(new THREE.CylinderGeometry(0.012, 0.016, 0.12, 8), antM, s * 0.07, cy + 0.24, -0.02, 1, 1, 1, 0, 0, -s * 0.25);
          add(new THREE.CylinderGeometry(0.01, 0.012, 0.06, 8), antM, s * 0.1, cy + 0.28, -0.02, 1, 1, 1, 0, 0, -s * 0.9);
        }
        add(new THREE.SphereGeometry(0.04, 10, 8), this.m('tailLight', '#FFFFFF', 0.9), 0, 0.06, -0.12, 1, 1, 1, 0, 0, 0, this.hips);
        break;
    }
    if (l.bow) {
      const bm2 = this.m('bow', l.bow, 0.6);
      for (const s of [-1, 1]) {
        const c = this.track(new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.05, 10), bm2));
        c.rotation.z = (s * Math.PI) / 2;
        c.position.set(s * 0.025, 0.285, 0.09);
        this.torso.add(c);
      }
    }
    if (l.hold) this.holdItem(l.hold);
  }
}

function shade(hex: string, amt: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt)));
  return `#${c.getHexString()}`;
}

export function outfitName(id: string) {
  return OUTFITS[id]?.name || id;
}
