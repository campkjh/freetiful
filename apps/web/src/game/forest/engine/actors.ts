// 주민·파트너의 움직임.
//  · 주민: 오전 업무 · 오후 산책 · 저녁 휴식 일정 → 이동 그래프(A*)로 걸어간다. 길이 막히면 잠시 기다렸다 비켜 가고,
//    대화가 끝나면 하던 일로 돌아간다. 가까이 오면 바라보고 손 흔들어 인사.
//  · 파트너: 적당한 거리에서 따라오고, 좁은 길에서 앞을 막지 않으며, 많이 벌어지면 화면 밖 자연스러운 지점에서 합류.
import * as THREE from 'three';
import { NAV_EDGES, NAV_NODES, PLAZA } from '../data/world';
import { RESIDENTS, type ResidentDef, type ScheduleSlot } from '../data/residents';
import { Animal, type Chibi } from './characters/chibi';
import type { Collision } from './collision';
import { dampAngle } from './geom';

const adj = new Map<string, string[]>();
for (const [a, b] of NAV_EDGES) {
  if (!adj.has(a)) adj.set(a, []);
  if (!adj.has(b)) adj.set(b, []);
  adj.get(a)!.push(b);
  adj.get(b)!.push(a);
}
const nodePos = (k: string) => new THREE.Vector3(NAV_NODES[k][0], 0, NAV_NODES[k][1]);

export function nearestNode(p: THREE.Vector3): string {
  let best = 'plaza_s';
  let bd = Infinity;
  for (const [k, [x, z]] of Object.entries(NAV_NODES)) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bd) {
      bd = d;
      best = k;
    }
  }
  return best;
}

export function findPath(from: string, to: string): string[] {
  if (from === to) return [to];
  const open = new Set([from]);
  const came = new Map<string, string>();
  const g = new Map<string, number>([[from, 0]]);
  const h = (k: string) => nodePos(k).distanceTo(nodePos(to));
  const f = new Map<string, number>([[from, h(from)]]);
  while (open.size) {
    let cur = '';
    let best = Infinity;
    for (const k of open) if ((f.get(k) ?? Infinity) < best) {
      best = f.get(k)!;
      cur = k;
    }
    if (cur === to) {
      const path = [cur];
      while (came.has(cur)) {
        cur = came.get(cur)!;
        path.unshift(cur);
      }
      return path;
    }
    open.delete(cur);
    for (const n of adj.get(cur) || []) {
      const tg = (g.get(cur) ?? Infinity) + nodePos(cur).distanceTo(nodePos(n));
      if (tg < (g.get(n) ?? Infinity)) {
        came.set(n, cur);
        g.set(n, tg);
        f.set(n, tg + h(n));
        open.add(n);
      }
    }
  }
  return [to];
}

export function slotAt(def: ResidentDef, hour: number): ScheduleSlot {
  for (const s of def.schedule) {
    const h = hour < s.from && s.to > 24 ? hour + 24 : hour;
    if (h >= s.from && h < s.to) return s;
  }
  return def.schedule[0];
}

export class ResidentActor {
  def: ResidentDef;
  body: Animal;
  pos = new THREE.Vector3();
  dir = 0;
  private path: THREE.Vector3[] = [];
  private goalNode = '';
  speed = 0;
  talking = false;
  /** 예식 등 연출 중엔 일정에서 빠진다 */
  staged = false;
  activity = '';
  private wait = 0;
  private idleT = 0;
  private greetedAt = -999;
  private near = false;

  constructor(id: string, scene: THREE.Scene) {
    this.def = RESIDENTS[id];
    this.body = new Animal(this.def.look);
    scene.add(this.body.root);
  }

  place(hour: number) {
    const s = slotAt(this.def, hour);
    const p = nodePos(s.node);
    this.pos.copy(p);
    this.goalNode = s.node;
    this.path = [];
    this.activity = s.label;
    this.body.root.position.copy(this.pos);
  }

  update(dt: number, now: number, hour: number, player: THREE.Vector3, col: Collision, others: THREE.Vector3[]) {
    if (this.staged) return;
    const s = slotAt(this.def, hour);
    this.activity = s.label;
    if (!this.talking && s.node !== this.goalNode) {
      const from = nearestNode(this.pos);
      const nodes = findPath(from, s.node);
      this.path = nodes.map(nodePos);
      this.goalNode = s.node;
    }
    let moving = false;
    if (!this.talking && this.path.length) {
      const tgt = this.path[0];
      const to = tgt.clone().sub(this.pos);
      to.y = 0;
      const d = to.length();
      if (d < 0.25) {
        this.path.shift();
      } else {
        // 앞을 플레이어가 막고 있으면 잠시 기다렸다가 비켜 간다
        const fwd = to.clone().normalize();
        const toP = player.clone().sub(this.pos);
        toP.y = 0;
        const blocked = toP.length() < 1.0 && fwd.dot(toP.clone().normalize()) > 0.5;
        if (blocked && this.wait < 1.2) {
          this.wait += dt;
        } else {
          let step = fwd.clone().multiplyScalar(1.6 * dt);
          if (blocked) step.add(new THREE.Vector3(-fwd.z, 0, fwd.x).multiplyScalar(1.4 * dt));
          // 다른 캐릭터와 너무 붙지 않게
          for (const o of others) {
            const dv = this.pos.clone().sub(o);
            dv.y = 0;
            const dd = dv.length();
            if (dd > 0.01 && dd < 0.75) step.add(dv.normalize().multiplyScalar((0.75 - dd) * 2 * dt));
          }
          const nx = this.pos.x + step.x;
          const nz = this.pos.z + step.z;
          const [rx, rz] = col.resolve(nx, nz, 0.26);
          this.pos.x = rx;
          this.pos.z = rz;
          this.dir = Math.atan2(fwd.x, fwd.z);
          moving = true;
          if (!blocked) this.wait = 0;
        }
      }
    }
    this.speed = moving ? 1.6 : 0;
    this.body.speed = this.speed;
    // 도착해서 하는 일
    const dP = Math.hypot(player.x - this.pos.x, player.z - this.pos.z);
    if (!moving && !this.talking) {
      this.idleT += dt;
      if (s.activity === 'rest' && this.goalNode === 'plaza_bench') this.body.setPose('sit');
      else if (s.activity === 'work' && Math.sin(this.idleT * 0.7) > 0.6) this.body.setPose('reach');
      else if (s.activity === 'work' && this.def.id === 'dodam' && Math.sin(this.idleT * 0.5) > 0.3) this.body.setPose('wave');
      else this.body.setPose('idle');
      // 일하는 방향(광장 쪽) 보기
      if (dP > 3.2) {
        const face = this.goalNode === 'plaza_bench' ? Math.atan2(PLAZA.center[0] - this.pos.x, PLAZA.center[1] - this.pos.z) : this.dir;
        this.dir = dampAngle(this.dir, face, 2, dt);
      }
    } else if (moving) {
      this.body.setPose('idle');
    }
    // 가까이 오면 바라보기 + 인사
    if (dP < 3.6 && !moving) {
      const look = Math.atan2(player.x - this.pos.x, player.z - this.pos.z);
      if (this.talking || dP < 2.2) this.dir = dampAngle(this.dir, look, 5, dt);
      let rel = look - this.dir;
      while (rel > Math.PI) rel -= Math.PI * 2;
      while (rel < -Math.PI) rel += Math.PI * 2;
      this.body.headYaw = Math.max(-0.7, Math.min(0.7, rel));
      if (!this.near && now / 1000 - this.greetedAt > 40 && !this.talking) {
        this.greetedAt = now / 1000;
        if (this.body.pose !== 'sit') {
          this.body.setPose('wave');
          setTimeout(() => this.body.pose === 'wave' && this.body.setPose('idle'), 1300);
        }
        this.body.setExpr('smile', 1500);
      }
      this.near = true;
    } else {
      this.body.headYaw = 0;
      if (dP > 5) this.near = false;
    }
    this.body.root.position.copy(this.pos);
    this.body.setYaw(this.dir, dt);
    this.body.animate(dt, now);
  }

  faceTo(p: THREE.Vector3) {
    this.dir = Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
  }
}

/** 파트너 동행 */
export class PartnerFollow {
  body: Chibi;
  pos = new THREE.Vector3();
  dir = 0;
  speed = 0;
  staged = false;
  sitting = false;
  private side = 1;

  constructor(body: Chibi) {
    this.body = body;
  }

  place(p: THREE.Vector3, dir: number) {
    this.pos.copy(p).add(new THREE.Vector3(Math.sin(dir + Math.PI) * 1.3 + 0.6, 0, Math.cos(dir + Math.PI) * 1.3));
    this.dir = dir;
    this.body.root.position.copy(this.pos);
    this.body.snapYaw(dir);
  }

  update(dt: number, now: number, player: THREE.Vector3, pdir: number, pvel: THREE.Vector3, col: Collision, camera: THREE.Camera) {
    if (this.staged) {
      this.body.animate(dt, now);
      return;
    }
    const back = new THREE.Vector3(-Math.sin(pdir), 0, -Math.cos(pdir));
    const sideV = new THREE.Vector3(Math.cos(pdir), 0, -Math.sin(pdir));
    // 뒤 1.0m · 옆 0.95m — 카메라와 플레이어 사이를 막지 않게 옆쪽에 선다
    const desired = player.clone().addScaledVector(back, 1.0).addScaledVector(sideV, 0.95 * this.side);
    const toD = desired.clone().sub(this.pos);
    toD.y = 0;
    const dist = player.distanceTo(this.pos);
    // 많이 벌어지면 화면 밖 자연스러운 지점에서 합류
    if (dist > 11) {
      const spot = this.rejoinSpot(player, pdir, col, camera);
      this.pos.copy(spot);
      this.body.root.position.copy(this.pos);
      return;
    }
    // 플레이어가 이쪽으로 걸어오면 옆으로 비켜 준다
    const toMe = this.pos.clone().sub(player);
    toMe.y = 0;
    if (pvel.lengthSq() > 0.5 && toMe.length() < 1.3 && pvel.clone().normalize().dot(toMe.clone().normalize()) > 0.55) {
      const perp = new THREE.Vector3(-pvel.z, 0, pvel.x).normalize();
      if (perp.dot(toMe) < 0) perp.negate();
      toD.copy(perp.multiplyScalar(1.2));
      this.side = Math.sign(perp.dot(sideV)) || this.side;
    }
    const d = toD.length();
    let moving = false;
    if (d > 0.35) {
      const sp = Math.min(Math.max(pvel.length() * 1.08, 2.2), d > 3 ? 5.2 : 3.4);
      const step = toD.normalize().multiplyScalar(Math.min(d, sp * dt));
      const [rx, rz] = col.resolve(this.pos.x + step.x, this.pos.z + step.z, 0.26);
      this.speed = Math.hypot(rx - this.pos.x, rz - this.pos.z) / Math.max(dt, 1e-4);
      this.pos.x = rx;
      this.pos.z = rz;
      this.dir = dampAngle(this.dir, Math.atan2(step.x, step.z), 10, dt);
      moving = this.speed > 0.2;
    } else {
      this.speed = 0;
      // 플레이어 쪽을 살짝 바라보기
      const look = Math.atan2(player.x - this.pos.x, player.z - this.pos.z);
      this.dir = dampAngle(this.dir, look, 2, dt);
    }
    if (!moving && !this.sitting && this.body.pose === 'sit') this.body.setPose('idle');
    this.body.speed = this.speed;
    this.body.root.position.copy(this.pos);
    this.body.setYaw(this.dir, dt);
    this.body.animate(dt, now);
  }

  private rejoinSpot(player: THREE.Vector3, pdir: number, col: Collision, camera: THREE.Camera): THREE.Vector3 {
    const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    for (let k = 0; k < 16; k++) {
      const a = pdir + Math.PI + (k % 2 ? 1 : -1) * Math.floor(k / 2) * 0.4;
      const p = player.clone().add(new THREE.Vector3(Math.sin(a) * 3.2, 0, Math.cos(a) * 3.2));
      if (col.blocked(p.x, p.z, 0.28)) continue;
      if (!frustum.containsPoint(p.clone().setY(0.5))) return p;
    }
    const [fx, fz] = col.freeSpot(player.x + 1.2, player.z + 1.2, 0.28);
    return new THREE.Vector3(fx, 0, fz);
  }
}
