// 카메라 — 살짝 높은 3인칭(내려다보는 각 약 35°, 세로 시야각 40°). 아바타 키가 화면 세로의 약 19% 가 되는 거리.
// 이동 방향 앞쪽이 조금 더 보이고, 방향을 바꾸면 짧고 부드럽게 따라온다. 대화·사진·꾸미기·예식 뒤엔 원래 시점으로 복귀.
import * as THREE from 'three';
import { damp, smooth } from './geom';

export type CamMode = 'follow' | 'talk' | 'decor' | 'orbit' | 'shot';

export interface Shot {
  pos: THREE.Vector3;
  look: THREE.Vector3;
  fov?: number;
  /** 이전 컷에서 넘어오는 시간(0 = 바로 컷) */
  blend: number;
}

export class CameraRig {
  camera: THREE.PerspectiveCamera;
  mode: CamMode = 'follow';
  pitch = 0.55;
  dist = 7.4;
  zoom = 7.4;
  target = new THREE.Vector3();
  pos = new THREE.Vector3();
  look = new THREE.Vector3();
  private lead = new THREE.Vector3();
  // 대화
  talkCenter = new THREE.Vector3();
  // 꾸미기
  decorCenter = new THREE.Vector3();
  decorDist = 13;
  // 사진(궤도)
  orbitYaw = 0;
  orbitPitch = 0.35;
  orbitDist = 4.2;
  orbitCenter = new THREE.Vector3();
  // 연출
  private shotFrom = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 40 };
  private shotTo: Shot | null = null;
  private shotT = 0;
  shake = 0;
  shakeEnabled = true;
  /** 기본 시야각(세로 화면은 넓게) */
  baseFov = 40;

  /** 화면 비율에 맞춰 — 세로(휴대폰)는 더 멀리·조금 더 위에서·시야 넓게 */
  fitAspect(aspect: number) {
    const portrait = aspect < 0.85;
    this.baseFov = portrait ? 50 : 40;
    this.pitch = portrait ? 0.68 : 0.55;
    if (portrait && this.zoom < 9) this.zoom = 9.6;
    if (!portrait && this.zoom > 9.2) this.zoom = 7.4;
  }

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 400);
  }

  setShot(s: Shot) {
    this.shotFrom.pos.copy(this.camera.position);
    this.shotFrom.look.copy(this.look);
    this.shotFrom.fov = this.camera.fov;
    this.shotTo = s;
    this.shotT = s.blend <= 0 ? 1 : 0;
    this.mode = 'shot';
  }

  snapTo(focus: THREE.Vector3) {
    this.target.copy(focus).add(new THREE.Vector3(0, 0.55, 0));
    this.pos.copy(this.target).add(this.offset(this.pitch, this.dist));
    this.camera.position.copy(this.pos);
    this.look.copy(this.target);
    this.camera.lookAt(this.look);
  }

  private offset(pitch: number, dist: number, yaw = 0): THREE.Vector3 {
    return new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist);
  }

  update(dt: number, focus: THREE.Vector3, vel: THREE.Vector3) {
    const cam = this.camera;
    let fov = this.baseFov;
    if (this.mode === 'follow') {
      // 앞쪽을 조금 더 보이게(이동 속도에 비례, 최대 1.6m)
      const want = vel.clone().multiplyScalar(0.5);
      if (want.length() > 1.6) want.setLength(1.6);
      this.lead.x = damp(this.lead.x, want.x, 2.2, dt);
      this.lead.z = damp(this.lead.z, want.z, 2.2, dt);
      const t = focus.clone().add(this.lead).add(new THREE.Vector3(0, 0.55, 0));
      this.target.x = damp(this.target.x, t.x, 6, dt);
      this.target.y = damp(this.target.y, t.y, 6, dt);
      this.target.z = damp(this.target.z, t.z, 6, dt);
      this.dist = damp(this.dist, this.zoom, 6, dt);
      const p = this.target.clone().add(this.offset(this.pitch, this.dist));
      this.pos.lerp(p, 1 - Math.exp(-dt * 9));
      this.look.lerp(this.target, 1 - Math.exp(-dt * 12));
    } else if (this.mode === 'talk') {
      const p = this.talkCenter.clone().add(new THREE.Vector3(0, 0.5, 0)).add(this.offset(0.45, 4.8));
      this.pos.lerp(p, 1 - Math.exp(-dt * 4));
      this.look.lerp(this.talkCenter.clone().add(new THREE.Vector3(0, 0.62, 0)), 1 - Math.exp(-dt * 5));
      this.target.copy(focus).add(new THREE.Vector3(0, 0.55, 0));
    } else if (this.mode === 'decor') {
      const p = this.decorCenter.clone().add(this.offset(0.98, this.decorDist));
      this.pos.lerp(p, 1 - Math.exp(-dt * 4));
      this.look.lerp(this.decorCenter, 1 - Math.exp(-dt * 5));
    } else if (this.mode === 'orbit') {
      const p = this.orbitCenter.clone().add(new THREE.Vector3(0, 0.6, 0)).add(this.offset(this.orbitPitch, this.orbitDist, this.orbitYaw));
      this.pos.lerp(p, 1 - Math.exp(-dt * 8));
      this.look.lerp(this.orbitCenter.clone().add(new THREE.Vector3(0, 0.6, 0)), 1 - Math.exp(-dt * 10));
    } else if (this.mode === 'shot' && this.shotTo) {
      const s = this.shotTo;
      this.shotT = Math.min(1, this.shotT + (s.blend > 0 ? dt / s.blend : 1));
      const k = smooth(this.shotT);
      this.pos.lerpVectors(this.shotFrom.pos, s.pos, k);
      this.look.lerpVectors(this.shotFrom.look, s.look, k);
      fov = this.shotFrom.fov + ((s.fov ?? 40) * (this.baseFov / 40) - this.shotFrom.fov) * k;
    }
    cam.position.copy(this.pos);
    if (this.shake > 0 && this.shakeEnabled) {
      cam.position.x += (Math.random() - 0.5) * this.shake * 0.12;
      cam.position.y += (Math.random() - 0.5) * this.shake * 0.08;
      this.shake = Math.max(0, this.shake - dt * 3);
    }
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    cam.lookAt(this.look);
  }

  /** 원래 시점으로 부드럽게 */
  backToFollow() {
    this.mode = 'follow';
  }
}
