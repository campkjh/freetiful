// 결혼식 연출(약 70초) — 도담의 인사 → 두 사람 입장 → 서로 바라보기 → 서약 → 반지 교환 → 박수와 꽃잎 → 단체 사진 → 완료.
// 전체·커플·하객 구도를 부드럽게 전환하고, 건너뛰어도 결과와 보상은 정상 처리. 중단하면 시작 전 상태로 돌아간다.
// 이동 경로와 대기 위치를 미리 정해 서로 겹치지 않게 한다.
import * as THREE from 'three';
import { DECOR } from '../data/decor';
import { GARDEN } from '../data/world';
import { GUESTS } from '../data/residents';
import { useGame } from '../state/store';
import { useUI } from '../state/ui';
import { putPhoto, makePhotoFromCanvas } from '../state/photos';
import { Animal, type Chibi } from './characters/chibi';
import { josa } from '../data/josa';
import type { ResidentActor, PartnerFollow } from './actors';
import type { CameraRig } from './camera';
import type { Particles } from './particles';
import type { Sound } from './audio';

export interface CeremonyHost {
  scene: THREE.Scene;
  rig: CameraRig;
  particles: Particles;
  sound: Sound;
  player: Chibi;
  playerPos: THREE.Vector3;
  playerDir: number;
  partner: PartnerFollow;
  residents: Record<string, ResidentActor>;
  hour: () => number;
  capture: (cb: (canvas: HTMLCanvasElement) => void) => void;
  save: (reason: string) => void;
  setPlayer: (x: number, z: number, dir: number) => void;
  flash: () => void;
}

type Actor = { body: Chibi; pos: THREE.Vector3; dir: number; seat?: boolean };

export class Ceremony {
  active = false;
  private h: CeremonyHost;
  private t = 0;
  private guests: Animal[] = [];
  private cast: Record<string, Actor> = {};
  private steps: Array<{ at: number; done: boolean; run: () => void }> = [];
  private walk: { from: number; to: number; t0: number; dur: number } | null = null;
  private arch = new THREE.Vector3(GARDEN.archSpot[0], 0, GARDEN.archSpot[1]);
  private captured = false;
  private finishing = false;
  private hadBouquet = false;
  private replay = false;

  constructor(h: CeremonyHost) {
    this.h = h;
  }

  private ensureGuests() {
    if (this.guests.length) return;
    for (const g of GUESTS) {
      const a = new Animal(g.look);
      a.root.visible = false;
      this.h.scene.add(a.root);
      this.guests.push(a);
    }
  }

  private caption(speaker: string | null, text: string | null, step: string) {
    const ui = useUI.getState();
    ui.set({ ceremony: { ...(ui.ceremony || { countdown: null, progress: 0 }), caption: text, speaker, step } as any });
    if (text && speaker) {
      // 짧은 말소리
      const base = speaker === '도담' ? 900 : speaker === '소담' ? 640 : 420;
      for (let i = 0; i < Math.min(8, Math.ceil(text.length / 4)); i++) setTimeout(() => this.h.sound.talk(base, speaker === '도담' ? 'square' : 'sine'), i * 70);
    }
  }

  start(replay: boolean) {
    const g = useGame.getState();
    this.replay = replay;
    this.ensureGuests();
    this.h.save('ceremony-before');
    g.ceremonyBegin();
    this.active = true;
    this.t = 0;
    this.captured = false;
    this.finishing = false;
    const archP = g.decor.garden.find((p) => DECOR[p.id]?.role === 'arch');
    if (archP) this.arch.set(archP.x, 0, archP.z);
    this.hadBouquet = this.h.player.bouquetHeld;
    const hasBouquet = g.count('bouquet') > 0;
    useUI.getState().set({ mode: 'ceremony', panel: null, dialogue: null, ceremony: { caption: null, speaker: null, step: 'intro', progress: 0, countdown: null } });
    this.h.sound.setCeremony(true);
    this.h.sound.setDuck(false);
    // 배치 — 하객 의자(통로에 가까운 순 6개)
    const seats = g.decor.garden
      .filter((p) => DECOR[p.id]?.role === 'seat')
      .sort((a, b) => Math.abs(a.x) - Math.abs(b.x) || b.z - a.z)
      .slice(0, 6)
      .sort((a, b) => b.z - a.z || a.x - b.x);
    const guestBodies: Array<[string, Chibi]> = [
      ['sodam', this.h.residents.sodam.body],
      ['woody', this.h.residents.woody.body],
      ...this.guests.map((b, i) => [GUESTS[i].id, b] as [string, Chibi]),
    ];
    this.cast = {};
    guestBodies.forEach(([id, body], i) => {
      const s = seats[i];
      const pos = s ? new THREE.Vector3(s.x, 0, s.z) : new THREE.Vector3((i % 2 ? 1 : -1) * (2 + Math.floor(i / 2)), 0, this.arch.z + 6 + Math.floor(i / 2));
      body.root.visible = true;
      this.cast[id] = { body, pos, dir: Math.PI, seat: !!s };
    });
    for (const id of ['sodam', 'woody', 'dodam']) this.h.residents[id].staged = true;
    const dodam = this.h.residents.dodam;
    this.cast.dodam = { body: dodam.body, pos: new THREE.Vector3(this.arch.x, 0, this.arch.z - 1.15), dir: 0 };
    dodam.body.holdItem('card');
    // 두 사람 — 통로 시작
    this.h.partner.staged = true;
    const startZ = GARDEN.aisle.maxZ - 0.6;
    this.cast.me = { body: this.h.player, pos: new THREE.Vector3(this.arch.x - 0.45, 0, startZ), dir: Math.PI };
    this.cast.partner = { body: this.h.partner.body, pos: new THREE.Vector3(this.arch.x + 0.45, 0, startZ), dir: Math.PI };
    if (hasBouquet) {
      this.h.player.bouquetHeld = true;
      this.h.player.holdItem('bouquet');
    }
    for (const a of Object.values(this.cast)) {
      a.body.setPose(a.seat ? 'sit' : 'idle');
      a.body.speed = 0;
      a.body.headYaw = 0;
    }
    const me = useGame.getState().me.name;
    const partner = useGame.getState().partner.name;
    const A = this.arch;
    const shot = (px: number, py: number, pz: number, lx: number, ly: number, lz: number, blend: number, fov = 40) => this.h.rig.setShot({ pos: new THREE.Vector3(px, py, pz), look: new THREE.Vector3(lx, ly, lz), blend, fov });
    this.steps = [
      { at: 0, done: false, run: () => { shot(A.x, 4.6, A.z + 13.5, A.x, 1.0, A.z + 1.5, 0, 42); this.caption('도담', '여러분, 오늘 서약의 정원에 와 주셔서 고마워요!', 'intro'); this.cast.dodam.body.setPose('wave'); } },
      { at: 3.2, done: false, run: () => { this.caption('도담', `${josa(me, '와/과')} ${partner}의 결혼식을 시작하겠습니다!`, 'intro'); this.cast.dodam.body.setPose('idle'); } },
      { at: 6, done: false, run: () => { this.caption('도담', '신랑 신부 입장~!', 'entrance'); this.walk = { from: startZ, to: A.z + 1.95, t0: this.t, dur: 10 }; this.h.sound.applause(1.5); } },
      { at: 6.2, done: false, run: () => shot(A.x + 0.2, 1.35, startZ - 3.2, A.x, 0.8, startZ, 1.2, 38) },
      { at: 11, done: false, run: () => shot(A.x - 3.6, 1.6, A.z + 6.4, A.x, 0.85, A.z + 3.2, 2.0, 40) },
      { at: 16.5, done: false, run: () => { this.caption('도담', '두 사람, 서로를 바라봐 주세요.', 'face'); this.cast.me.dir = Math.PI / 2; this.cast.partner.dir = -Math.PI / 2; this.cast.me.body.setExpr('shy', 4000); this.cast.partner.body.setExpr('shy', 4000); shot(A.x + 2.3, 1.3, A.z + 4.2, A.x, 0.85, A.z + 1.9, 1.6, 36); } },
      { at: 22, done: false, run: () => { this.caption(me, `${partner}, 이 숲에서 매일 함께 웃을게.`, 'vows'); this.cast.me.body.setExpr('smile', 3000); shot(A.x + 1.6, 1.15, A.z + 2.6, A.x - 0.45, 0.85, A.z + 1.95, 1.2, 34); } },
      { at: 27.5, done: false, run: () => { this.caption(partner, '나도. 오늘처럼 늘 곁에 있을게.', 'vows'); this.cast.partner.body.setExpr('joy', 3000); shot(A.x - 1.6, 1.15, A.z + 2.6, A.x + 0.45, 0.85, A.z + 1.95, 1.2, 34); } },
      { at: 33, done: false, run: () => { this.caption('도담', '반지를 교환해 주세요!', 'rings'); this.cast.me.body.setPose('ring'); this.cast.partner.body.setPose('ring'); shot(A.x + 1.0, 1.05, A.z + 3.1, A.x, 0.75, A.z + 1.95, 1.2, 30); } },
      { at: 35.5, done: false, run: () => { this.h.particles.sparkle(new THREE.Vector3(A.x, 0.62, A.z + 1.95), 14, '#FFF2B8', 0.25); this.h.sound.ring(); this.caption(null, '반짝 — 반지가 두 사람의 손에 꼭 맞아요.', 'rings'); } },
      { at: 39, done: false, run: () => { this.caption('도담', '이제 두 사람은 부부가 되었습니다! 축하의 박수를!', 'cheer'); this.cast.me.body.setPose('idle'); this.cast.partner.body.setPose('idle'); this.cast.me.body.setExpr('joy', 6000); this.cast.partner.body.setExpr('joy', 6000); this.h.sound.applause(5); this.h.particles.petalBurst(new THREE.Vector3(A.x, 0, A.z + 2.4), 3.2, 160); shot(A.x, 3.6, A.z + 9.5, A.x, 0.9, A.z + 2.2, 1.6, 44); this.guestsCheer(); } },
      { at: 44, done: false, run: () => { shot(A.x + 0.2, 1.6, A.z + 0.4, A.x, 0.7, A.z + 6.5, 1.4, 44); this.h.particles.petalBurst(new THREE.Vector3(A.x, 0, A.z + 4), 4, 90); } },
      { at: 49, done: false, run: () => this.setupPhoto() },
      { at: 52, done: false, run: () => this.countdown('하나') },
      { at: 53, done: false, run: () => this.countdown('둘') },
      { at: 54, done: false, run: () => this.countdown('셋!') },
      { at: 54.6, done: false, run: () => this.takePhoto() },
      { at: 58, done: false, run: () => this.finish() },
    ];
    this.layout(0);
  }

  private guestsCheer() {
    for (const [id, a] of Object.entries(this.cast)) {
      if (id === 'me' || id === 'partner' || id === 'dodam') continue;
      a.body.setPose(Math.random() < 0.5 ? 'clap' : 'cheer');
      a.seat = false;
      a.body.setExpr('joy', 6000);
    }
    this.cast.dodam.body.setPose('clap');
  }

  private setupPhoto() {
    const A = this.arch;
    useUI.getState().set({ fade: 1 });
    setTimeout(() => useUI.getState().set({ fade: 0 }), 380);
    const row = (id: string, x: number, z: number) => {
      const a = this.cast[id];
      if (!a) return;
      a.pos.set(A.x + x, 0, A.z + z);
      a.dir = 0;
      a.seat = false;
      a.body.setPose('idle');
    };
    row('lulu', -2.95, 1.0);
    row('sodam', -1.45, 0.85);
    row('dodam', 0, 0.75);
    row('woody', 1.45, 0.85);
    row('mori', 2.95, 1.0);
    row('bori', -1.7, 2.15);
    row('me', -0.45, 2.3);
    row('partner', 0.45, 2.3);
    row('harang', 1.7, 2.15);
    this.walk = null;
    this.h.rig.setShot({ pos: new THREE.Vector3(A.x, 1.75, A.z + 8.6), look: new THREE.Vector3(A.x, 0.9, A.z + 1.5), blend: 0, fov: 40 });
    this.caption('모리', '자, 단체 사진 찍을게요! 다들 이쪽을 봐 주세요~', 'photo');
  }

  private countdown(t: string) {
    const ui = useUI.getState();
    if (ui.ceremony) ui.set({ ceremony: { ...ui.ceremony, countdown: t } });
    this.h.sound.click();
    if (t === '셋!') {
      this.cast.me.body.setPose('heart');
      this.cast.partner.body.setPose('peace');
      for (const id of ['sodam', 'woody', 'lulu', 'mori', 'bori', 'harang']) this.cast[id]?.body.setPose(id === 'mori' ? 'peace' : 'cheer');
      this.cast.dodam.body.setPose('wave');
      for (const a of Object.values(this.cast)) a.body.setExpr('joy', 4000);
    }
  }

  private takePhoto() {
    if (this.captured) return;
    this.captured = true;
    // 사진은 UI 없이 렌더 결과에서
    this.h.capture((canvas) => {
      const rec = makePhotoFromCanvas(canvas, this.replay ? '결혼식 단체 사진' : '첫 결혼식 단체 사진', 'polaroid');
      this.photoId = rec.id;
      this.h.sound.shutter();
      this.h.flash();
      void putPhoto(rec).then((ok) => {
        const ui = useUI.getState();
        ui.set({ photo: { ...(ui.photo || { pose: 'idle', expr: 'smile', frame: 'none', dof: 0, zoom: 4 }), last: { id: rec.id, thumb: rec.thumb, ok } } as any });
        if (!ok) ui.toast('사진을 이 브라우저에 저장하지 못했어요. 메모리에만 남아 있어요.', 'warn');
      });
    });
    const ui = useUI.getState();
    if (ui.ceremony) ui.set({ ceremony: { ...ui.ceremony, countdown: null } });
  }

  private photoId: string | null = null;

  private finish() {
    if (this.finishing) return;
    this.finishing = true;
    const res = useGame.getState().ceremonyComplete(this.photoId);
    this.caption(null, res.first ? '축하해요! 첫 결혼식을 마쳤어요.' : '또 하나의 아름다운 예식을 마쳤어요.', 'done');
    this.h.sound.memory();
    setTimeout(() => this.restore(true), 2600);
  }

  /** 건너뛰기 — 단체 사진·완료 처리는 정상으로 */
  skip() {
    if (!this.active || this.finishing) return;
    for (const s of this.steps) if (s.at < 49) s.done = true;
    this.t = Math.max(this.t, 49);
    this.setupPhoto();
    for (const s of this.steps) if (s.at <= 49) s.done = true;
    this.countdown('셋!');
    // 포즈가 잡히도록 몇 프레임 뒤 촬영
    setTimeout(() => {
      this.takePhoto();
      setTimeout(() => this.finish(), 300);
    }, 450);
    for (const s of this.steps) s.done = true;
  }

  /** 중단 — 시작 전 상태로(완료 처리 전이라 보상 없음) */
  abort() {
    if (!this.active || this.finishing) return;
    useGame.getState().ceremonyAbort();
    this.restore(false);
  }

  private restore(done: boolean) {
    this.active = false;
    this.walk = null;
    for (const g of this.guests) g.root.visible = false;
    for (const id of ['sodam', 'woody', 'dodam']) {
      const r = this.h.residents[id];
      r.staged = false;
      r.place(this.h.hour());
      r.body.setPose('idle');
      r.body.root.position.y = 0;
    }
    this.h.residents.dodam.body.holdItem('card');
    this.h.partner.staged = false;
    this.h.player.setPose('idle');
    this.h.player.root.position.y = 0;
    this.h.partner.body.root.position.y = 0;
    this.h.player.bouquetHeld = this.hadBouquet;
    if (!this.hadBouquet) this.h.player.holdItem(null);
    this.h.setPlayer(GARDEN.entrance[0], GARDEN.entrance[1] - 1.2, 0);
    this.h.partner.place(new THREE.Vector3(GARDEN.entrance[0], 0, GARDEN.entrance[1] - 1.2), 0);
    this.h.rig.backToFollow();
    this.h.sound.setCeremony(false);
    useUI.getState().set({ mode: 'play', ceremony: null, fade: 0 });
    if (done) this.h.save('ceremony-done');
  }

  private layout(dt: number) {
    for (const a of Object.values(this.cast)) {
      a.body.root.position.copy(a.pos);
      a.body.root.position.y = a.seat ? 0.3 : 0;
      if (dt === 0) a.body.snapYaw(a.dir);
      else a.body.setYaw(a.dir, dt);
    }
  }

  update(dt: number, now: number) {
    if (!this.active) return;
    this.t += dt;
    for (const s of this.steps) {
      if (!s.done && this.t >= s.at) {
        s.done = true;
        s.run();
      }
    }
    const ui = useUI.getState();
    if (ui.ceremony) {
      const p = Math.min(1, this.t / 58);
      if (Math.abs(p - ui.ceremony.progress) > 0.01) ui.set({ ceremony: { ...ui.ceremony, progress: p } });
    }
    // 입장 걷기
    if (this.walk) {
      const k = Math.min(1, (this.t - this.walk.t0) / this.walk.dur);
      const z = this.walk.from + (this.walk.to - this.walk.from) * k;
      const moving = k < 1;
      for (const id of ['me', 'partner']) {
        const a = this.cast[id];
        a.pos.z = z;
        a.body.speed = moving ? 0.8 : 0;
      }
      // 하객이 두 사람을 바라본다
      for (const [id, a] of Object.entries(this.cast)) {
        if (id === 'me' || id === 'partner' || id === 'dodam') continue;
        const look = Math.atan2(this.arch.x - a.pos.x, z - a.pos.z);
        let rel = look - a.dir;
        while (rel > Math.PI) rel -= Math.PI * 2;
        while (rel < -Math.PI) rel += Math.PI * 2;
        a.body.headYaw = Math.max(-0.8, Math.min(0.8, rel));
      }
      if (!moving) this.walk = null;
    }
    this.layout(dt);
    for (const a of Object.values(this.cast)) {
      if (a.body !== this.h.player && a.body !== this.h.partner.body) a.body.animate(dt, now);
    }
    this.h.playerPos.copy(this.cast.me.pos);
    this.h.partner.pos.copy(this.cast.partner.pos);
  }
}
