// 꾸미기 편집기 — 바닥 칸 맞추기/자유 배치 · 회전 · 이동 · 회수 · 실행 취소. 미리보기는 유효(초록)·충돌(빨강)·통로 막힘(주황) + 짧은 문구.
// 확정하면 저장, 취소하면 들어오기 전 배치로 되돌린다(store.beginEdit/cancelEdit/commitEdit).
import * as THREE from 'three';
import { DECOR, footprint, type DecorArea } from '../data/decor';
import { GARDEN, HOME } from '../data/world';
import { checkPlacement, useGame } from '../state/store';
import { useUI } from '../state/ui';
import { makeGhost, setGhostTone } from './decorModels';
import type { Input } from './input';

export class DecorEditor {
  active = false;
  area: DecorArea = 'garden';
  private ghost: THREE.Group | null = null;
  private ghostId: string | null = null;
  private cursor = new THREE.Vector3();
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private hoverRing: THREE.Mesh;
  private scene: THREE.Scene;
  private keyCursor = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.hoverRing = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 32), new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.8, depthWrite: false }));
    this.hoverRing.rotation.x = -Math.PI / 2;
    this.hoverRing.visible = false;
    scene.add(this.hoverRing);
  }

  bounds() {
    return this.area === 'garden' ? GARDEN.edit : HOME.yard;
  }

  center(): THREE.Vector3 {
    const b = this.bounds();
    return new THREE.Vector3((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
  }

  enter(area: DecorArea) {
    this.area = area;
    this.active = true;
    useGame.getState().beginEdit(area);
    this.cursor.copy(this.center());
    useUI.getState().set({ mode: 'decor', decor: { area, selected: null, moving: null, hover: null, rot: 0, status: '가방의 장식을 골라 놓아 보세요', tone: 'ok', snap: true } });
  }

  exit(commit: boolean) {
    const g = useGame.getState();
    if (commit) g.commitEdit();
    else g.cancelEdit();
    this.active = false;
    this.setGhost(null);
    this.hoverRing.visible = false;
    useUI.getState().set({ mode: 'play', decor: null });
  }

  select(id: string | null) {
    const d = useUI.getState().decor;
    if (!d) return;
    useUI.getState().set({ decor: { ...d, selected: id, moving: null, rot: id === 'arch' ? 0 : d.rot } });
    this.setGhost(id);
  }

  rotate() {
    const d = useUI.getState().decor;
    if (!d) return;
    useUI.getState().set({ decor: { ...d, rot: (d.rot + 1) % 4 } });
  }

  toggleSnap() {
    const d = useUI.getState().decor;
    if (!d) return;
    useUI.getState().set({ decor: { ...d, snap: !d.snap } });
  }

  private setGhost(id: string | null) {
    if (this.ghostId === id) return;
    if (this.ghost) this.scene.remove(this.ghost);
    this.ghost = id ? makeGhost(id) : null;
    this.ghostId = id;
    if (this.ghost) this.scene.add(this.ghost);
  }

  /** 커서 아래(또는 가장 가까운) 배치 장식 */
  private hoverAt(x: number, z: number): string | null {
    const placed = useGame.getState().decor[this.area];
    let best: string | null = null;
    let bd = Infinity;
    for (const p of placed) {
      const def = DECOR[p.id];
      if (!def) continue;
      const fp = footprint(def, p.rot);
      if (Math.abs(x - p.x) <= fp.hw + 0.15 && Math.abs(z - p.z) <= fp.hd + 0.15) {
        const d = Math.hypot(x - p.x, z - p.z);
        if (d < bd) {
          bd = d;
          best = p.uid;
        }
      }
    }
    return best;
  }

  update(dt: number, input: Input, camera: THREE.Camera, sfx: { place: () => void; rotate: () => void; error: () => void }) {
    if (!this.active) return;
    const ui = useUI.getState();
    const d = ui.decor;
    if (!d || ui.panel || ui.dialogue) return;
    // 커서: 마우스(바닥 교차) 또는 키보드·조이스틱
    const mv = input.move();
    if (mv.mag > 0.1) {
      this.keyCursor = true;
      this.cursor.x += mv.x * dt * 4.2 * mv.mag;
      this.cursor.z += mv.z * dt * 4.2 * mv.mag;
    } else if (input.mouse.inside && !this.keyCursor) {
      this.ray.setFromCamera(new THREE.Vector2(input.mouse.ndcX, input.mouse.ndcY), camera);
      const hit = new THREE.Vector3();
      if (this.ray.ray.intersectPlane(this.plane, hit)) this.cursor.copy(hit);
    }
    if (input.mouse.dragDX || input.mouse.dragDY || input.mouse.clicked) this.keyCursor = false;
    const b = this.bounds();
    this.cursor.x = Math.max(b.minX - 0.5, Math.min(b.maxX + 0.5, this.cursor.x));
    this.cursor.z = Math.max(b.minZ - 0.5, Math.min(b.maxZ + 0.5, this.cursor.z));
    const snap = (v: number) => (d.snap ? Math.round(v * 4) / 4 : v);
    let x = snap(this.cursor.x);
    let z = snap(this.cursor.z);
    // 아치는 아치 자리에 가까우면 붙여 준다
    const placingId = d.moving ? useGame.getState().decor[this.area].find((p) => p.uid === d.moving)?.id ?? null : d.selected;
    if (placingId === 'arch' && Math.hypot(x - GARDEN.archSpot[0], z - GARDEN.archSpot[1]) < 1.4) {
      x = GARDEN.archSpot[0];
      z = GARDEN.archSpot[1];
    }
    // 키 조작
    if (input.hit('KeyR')) {
      this.rotate();
      sfx.rotate();
    }
    if (input.hit('KeyG')) this.toggleSnap();
    if ((input.keys.has('ControlLeft') || input.keys.has('MetaLeft') || input.keys.has('ControlRight') || input.keys.has('MetaRight')) && input.hit('KeyZ')) {
      if (useGame.getState().undoEdit()) sfx.rotate();
    }
    const hover = placingId ? null : this.hoverAt(x, z);
    if (hover !== d.hover) useUI.getState().set({ decor: { ...useUI.getState().decor!, hover } });
    if (input.hit('KeyX', 'Delete', 'Backspace') && hover) this.retrieve(hover, sfx);
    const dd = useUI.getState().decor!;
    // 미리보기
    if (placingId) {
      this.setGhost(placingId);
      const chk = checkPlacement(this.area, useGame.getState().decor[this.area], placingId, x, z, dd.rot, dd.moving || undefined);
      if (this.ghost) {
        this.ghost.position.set(x, 0.02, z);
        this.ghost.rotation.y = (dd.rot * Math.PI) / 2;
        setGhostTone(this.ghost, chk.tone);
      }
      if (chk.reason !== dd.status || chk.tone !== dd.tone) useUI.getState().set({ decor: { ...dd, status: chk.reason, tone: chk.tone } });
      const place = input.mouse.clicked || input.takeAction();
      if (place) {
        if (!chk.ok) {
          sfx.error();
        } else if (dd.moving) {
          const r = useGame.getState().moveDecor(dd.moving, x, z, dd.rot);
          if (r.ok) {
            sfx.place();
            useUI.getState().set({ decor: { ...useUI.getState().decor!, moving: null, status: '옮겼어요', tone: 'ok' } });
            this.setGhost(useUI.getState().decor!.selected);
          } else sfx.error();
        } else {
          const r = useGame.getState().placeDecor(placingId, x, z, dd.rot);
          if (r.ok) {
            sfx.place();
            const def = DECOR[placingId];
            const left = useGame.getState().count(def.item);
            if (left <= 0) this.select(null);
          } else sfx.error();
        }
      }
      this.hoverRing.visible = false;
    } else {
      this.setGhost(null);
      if (hover) {
        const p = useGame.getState().decor[this.area].find((q) => q.uid === hover);
        if (p) {
          const def = DECOR[p.id];
          const fp = footprint(def, p.rot);
          this.hoverRing.visible = true;
          this.hoverRing.position.set(p.x, 0.04, p.z);
          this.hoverRing.scale.setScalar(Math.max(fp.hw, fp.hd) * 2.2 + 0.4);
          if (dd.status !== `${def.name} — 눌러서 옮기기 · X 회수`) useUI.getState().set({ decor: { ...dd, status: `${def.name} — 눌러서 옮기기 · X 회수`, tone: 'ok' } });
          if (input.mouse.clicked || input.takeAction()) {
            useUI.getState().set({ decor: { ...dd, moving: hover, rot: p.rot, status: '옮길 자리를 골라 주세요', tone: 'ok' } });
            sfx.rotate();
          }
        }
      } else {
        this.hoverRing.visible = false;
        if (dd.status !== '가방의 장식을 골라 놓아 보세요' && !dd.moving) useUI.getState().set({ decor: { ...dd, status: '가방의 장식을 골라 놓아 보세요', tone: 'ok' } });
        input.takeAction();
      }
    }
  }

  retrieve(uid: string, sfx: { place: () => void }) {
    if (useGame.getState().retrieveDecor(uid)) {
      sfx.place();
      const d = useUI.getState().decor;
      if (d) useUI.getState().set({ decor: { ...d, hover: null, moving: d.moving === uid ? null : d.moving, status: '가방으로 회수했어요', tone: 'ok' } });
    }
  }

  retrieveHover(sfx: { place: () => void }) {
    const d = useUI.getState().decor;
    if (d?.hover) this.retrieve(d.hover, sfx);
  }
}
