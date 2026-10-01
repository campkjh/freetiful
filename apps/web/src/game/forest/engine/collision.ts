// 단순 충돌체 — 원 · 회전 사각형 · 호수(타원, 데크 위는 통과) · 바깥 경계(둥근 사각형).
// 겹치면 바깥으로 밀어내기만 해서 캐릭터가 장애물에 갇히지 않는다.
import { BOUNDS, LAKE } from '../data/world';

export type Collider =
  | { kind: 'circle'; x: number; z: number; r: number; group?: string }
  | { kind: 'box'; x: number; z: number; hw: number; hd: number; rot: number; group?: string };

export class Collision {
  list: Collider[] = [];

  add(c: Collider) {
    this.list.push(c);
  }

  circle(x: number, z: number, r: number, group?: string) {
    this.list.push({ kind: 'circle', x, z, r, group });
  }

  box(x: number, z: number, w: number, d: number, rot = 0, group?: string) {
    this.list.push({ kind: 'box', x, z, hw: w / 2, hd: d / 2, rot, group });
  }

  clearGroup(group: string) {
    this.list = this.list.filter((c) => c.group !== group);
  }

  /** 호수 안인지(데크 제외) */
  inWater(x: number, z: number, pad = 0): boolean {
    const d = LAKE.deck;
    if (x > d.minX && x < d.maxX && z > d.minZ && z < d.maxZ) return false;
    const nx = (x - LAKE.center[0]) / Math.max(0.1, LAKE.rx - 0.4 + pad);
    const nz = (z - LAKE.center[1]) / Math.max(0.1, LAKE.rz - 0.4 + pad);
    return nx * nx + nz * nz < 1;
  }

  /** 이동 결과 보정 — 원 반지름 r 인 캐릭터를 장애물 밖으로 */
  resolve(x: number, z: number, r: number, skipGroup?: string): [number, number] {
    let px = x;
    let pz = z;
    for (let iter = 0; iter < 2; iter++) {
      for (const c of this.list) {
        if (skipGroup && c.group === skipGroup) continue;
        if (c.kind === 'circle') {
          const dx = px - c.x;
          const dz = pz - c.z;
          const rr = c.r + r;
          const d2 = dx * dx + dz * dz;
          if (d2 < rr * rr) {
            const d = Math.sqrt(d2) || 0.0001;
            px = c.x + (dx / d) * rr;
            pz = c.z + (dz / d) * rr;
          }
        } else {
          const cos = Math.cos(-c.rot);
          const sin = Math.sin(-c.rot);
          const lx = (px - c.x) * cos - (pz - c.z) * sin;
          const lz = (px - c.x) * sin + (pz - c.z) * cos;
          const cx = Math.max(-c.hw, Math.min(c.hw, lx));
          const cz = Math.max(-c.hd, Math.min(c.hd, lz));
          let dx = lx - cx;
          let dz = lz - cz;
          const d2 = dx * dx + dz * dz;
          if (d2 < r * r) {
            let nlx: number;
            let nlz: number;
            if (d2 < 1e-8) {
              // 상자 안 — 가장 가까운 면으로
              const ox = c.hw - Math.abs(lx);
              const oz = c.hd - Math.abs(lz);
              if (ox < oz) {
                nlx = Math.sign(lx || 1) * (c.hw + r);
                nlz = lz;
              } else {
                nlx = lx;
                nlz = Math.sign(lz || 1) * (c.hd + r);
              }
            } else {
              const d = Math.sqrt(d2);
              dx /= d;
              dz /= d;
              nlx = cx + dx * r;
              nlz = cz + dz * r;
            }
            const cb = Math.cos(c.rot);
            const sb = Math.sin(c.rot);
            px = c.x + nlx * cb - nlz * sb;
            pz = c.z + nlx * sb + nlz * cb;
          }
        }
      }
      // 호수
      if (this.inWater(px, pz, r)) {
        const ex = px - LAKE.center[0];
        const ez = pz - LAKE.center[1];
        const ax = LAKE.rx - 0.4 + r;
        const az = LAKE.rz - 0.4 + r;
        const k = 1 / Math.sqrt((ex * ex) / (ax * ax) + (ez * ez) / (az * az) || 1);
        // 데크 쪽이면 데크로 붙여 준다
        const d = LAKE.deck;
        if (pz > d.minZ - 0.2 && pz < d.maxZ + 0.2 && px < d.maxX + 0.5) {
          pz = Math.max(d.minZ + r, Math.min(d.maxZ - r, pz));
        } else {
          px = LAKE.center[0] + ex * k * 1.001;
          pz = LAKE.center[1] + ez * k * 1.001;
        }
      }
    }
    return this.clampBounds(px, pz, r);
  }

  clampBounds(x: number, z: number, r: number): [number, number] {
    const b = BOUNDS;
    let px = Math.max(b.minX + r, Math.min(b.maxX - r, x));
    let pz = Math.max(b.minZ + r, Math.min(b.maxZ - r, z));
    // 둥근 모서리
    const cx = px < b.minX + b.corner ? b.minX + b.corner : px > b.maxX - b.corner ? b.maxX - b.corner : px;
    const cz = pz < b.minZ + b.corner ? b.minZ + b.corner : pz > b.maxZ - b.corner ? b.maxZ - b.corner : pz;
    const dx = px - cx;
    const dz = pz - cz;
    const lim = b.corner - r;
    if (dx * dx + dz * dz > lim * lim) {
      const d = Math.sqrt(dx * dx + dz * dz);
      px = cx + (dx / d) * lim;
      pz = cz + (dz / d) * lim;
    }
    return [px, pz];
  }

  /** 그 자리가 막혔는지(배치·재합류 지점 찾기) */
  blocked(x: number, z: number, r: number): boolean {
    const [rx, rz] = this.resolve(x, z, r);
    return Math.hypot(rx - x, rz - z) > 0.05;
  }

  /** 막히지 않은 가장 가까운 지점 */
  freeSpot(x: number, z: number, r: number): [number, number] {
    if (!this.blocked(x, z, r)) return [x, z];
    for (let ring = 1; ring <= 8; ring++) {
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const tx = x + Math.cos(a) * ring * 0.6;
        const tz = z + Math.sin(a) * ring * 0.6;
        if (!this.blocked(tx, tz, r)) return [tx, tz];
      }
    }
    return this.resolve(x, z, r);
  }
}
