// 결혼의 숲 엔진 — 렌더러 · 월드 · 캐릭터 · 상호작용 · 모드(산책/꾸미기/예식/사진) · 저장 연결.
// 화면(React)은 useUI/useGame 상태를 보고, 버튼은 engineRef.current 의 메서드를 부른다.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { FLOWER_SPOTS, GARDEN, GREENHOUSE, HOME, HOME_SPAWN, LAKE, PATHS, PLAZA, ROCKS, SHAKE_TREES, SPAWN, WORKSHOP, BOUTIQUE, ZONES, GATE_SIGN, type V2 } from '../data/world';
import { ITEMS, itemName } from '../data/items';
import { DECOR, footprint, type DecorArea } from '../data/decor';
import { QUESTS } from '../data/quests';
import { RESIDENTS, RESIDENT_IDS } from '../data/residents';
import { chatLines, giftLines, residentDialogue, type DialogueCtx, type DNode } from '../data/dialogue';
import { ceremonyReadiness, dayOf, hourOf, onGameEvent, plotStage, useGame } from '../state/store';
import { useUI, uiBlocking } from '../state/ui';
import { saveGame } from '../state/save';
import { getPhoto, makePhotoFromCanvas, putPhoto } from '../state/photos';
import { currentQuestId } from '../state/objective';
import { Collision } from './collision';
import { Input } from './input';
import { CameraRig } from './camera';
import { DayNight } from './lighting';
import { Particles } from './particles';
import { Sound, type Surface } from './audio';
import { shared, mat } from './materials';
import { buildGround, buildLake, buildPaths } from './world/terrain';
import { buildNature, makeShakeTree } from './world/nature';
import { buildBuildings, type BuildingsBuild } from './world/buildings';
import { Avatar, type Pose } from './characters/chibi';
import { PartnerFollow, ResidentActor } from './actors';
import { DecorEditor } from './decorEditor';
import { Ceremony } from './ceremony';
import { buildDecor, setFramePhoto } from './decorModels';
import { blob, merge, part, rbox, dampAngle } from './geom';
import type { FaceExpr } from './characters/face';
import { josa } from '../data/josa';
import { patchScene, bendU } from './bend';

export const engineRef: { current: Engine | null } = { current: null };

type TargetKind = 'flower' | 'tree' | 'rock' | 'logs' | 'npc' | 'partner' | 'board' | 'bench' | 'mailbox' | 'storage' | 'workbench' | 'bouquet' | 'shop' | 'mirror' | 'plot' | 'gardenSign' | 'door' | 'promise' | 'frame' | 'sign';

interface Target {
  id: string;
  kind: TargetKind;
  pos: () => THREE.Vector3;
  r: number;
  h: number;
  label: () => string | null;
  ref?: string;
  extra?: any;
}

const WALK = 2.7;
const RUN = 5.0;
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const flat = (p: V2, y = 0) => new THREE.Vector3(p[0], y, p[1]);

function distSeg(px: number, pz: number, a: V2, b: V2) {
  const vx = b[0] - a[0];
  const vz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((px - a[0]) * vx + (pz - a[1]) * vz) / (vx * vx + vz * vz || 1)));
  return Math.hypot(px - (a[0] + vx * t), pz - (a[1] + vz * t));
}

export class Engine {
  container: HTMLElement;
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  rig: CameraRig;
  input: Input;
  col = new Collision();
  light: DayNight;
  particles: Particles;
  sound = new Sound();
  player: Avatar;
  playerPos = new THREE.Vector3();
  playerVel = new THREE.Vector3();
  playerDir = Math.PI;
  partner: PartnerFollow;
  residents: Record<string, ResidentActor> = {};
  decorEditor: DecorEditor;
  ceremony: Ceremony;
  clock = 540;
  private clockSynced = 540;
  private clockAcc = 0;
  private raf = 0;
  private last = performance.now();
  private targets: Target[] = [];
  private current: Target | null = null;
  private action: { until: number; at: number; fired: boolean; fire: () => void; pose: Pose } | null = null;
  private sitting: { pos: THREE.Vector3; dir: number } | null = null;
  private flowers = new Map<string, { group: THREE.Group; item: string; shown: boolean; pop: number; pos: THREE.Vector3 }>();
  private trees = new Map<string, { group: THREE.Group; crown: THREE.Mesh; wobble: number; fruit: boolean; pos: THREE.Vector3 }>();
  private plots = new Map<string, { pos: THREE.Vector3; sprout: THREE.Object3D; bud: THREE.Object3D; bloom: THREE.Object3D; headMat: THREE.MeshStandardMaterial }>();
  private decorObjs = new Map<string, THREE.Group>();
  private promiseTree: THREE.Group;
  private build: BuildingsBuild;
  private lakeMat: THREE.ShaderMaterial;
  private marker: THREE.Mesh;
  private rareMat: THREE.MeshStandardMaterial;
  private zoneId = '';
  private lastSave = 0;
  private lastAutosave = performance.now();
  private stepPhase = 0;
  private captureCbs: Array<(c: HTMLCanvasElement) => void> = [];
  private composer: EffectComposer | null = null;
  private bokeh: BokehPass | null = null;
  private unsub: Array<() => void> = [];
  hintEl: HTMLElement | null = null;
  private hintVisible = false;
  private titleArch: THREE.Group | null = null;
  private disposed = false;
  quality: 'high' | 'low' = 'high';
  private flashEl: HTMLElement | null = null;
  private talkingWith: ResidentActor | null = null;
  private interactCooldown = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    const st = useGame.getState();
    this.quality = st.settings.quality;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.applyPixelRatio();
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);
    this.rig = new CameraRig(container.clientWidth / Math.max(1, container.clientHeight));
    this.input = new Input(this.renderer.domElement);
    this.light = new DayNight(this.scene, this.renderer, this.quality);
    this.particles = new Particles(this.scene);
    this.particles.setQuality(this.quality);
    // 월드
    buildGround(this.scene);
    buildPaths(this.scene);
    this.lakeMat = buildLake(this.scene);
    const nature = buildNature(this.scene, this.quality);
    for (const c of nature.treeColliders) this.col.circle(c.x, c.z, c.r);
    this.build = buildBuildings(this.scene, this.col, this.light);
    this.rareMat = new THREE.MeshStandardMaterial({ color: '#E6F1FF', roughness: 0.5, emissive: new THREE.Color('#9FD4FF'), emissiveIntensity: 0.2 });
    this.buildGatherables();
    this.buildPlots();
    this.promiseTree = this.makePromiseTree();
    // 퀘스트 표시(떠 있는 잎 모양)
    this.marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), new THREE.MeshStandardMaterial({ color: '#F6D46B', emissive: new THREE.Color('#F6C14E'), emissiveIntensity: 0.6, roughness: 0.4 }));
    this.marker.scale.set(1, 1.5, 1);
    this.scene.add(this.marker);
    // 캐릭터
    this.player = new Avatar(st.me.look);
    this.scene.add(this.player.root);
    const partnerBody = new Avatar(st.partner.look);
    this.scene.add(partnerBody.root);
    this.partner = new PartnerFollow(partnerBody);
    for (const id of RESIDENT_IDS) this.residents[id] = new ResidentActor(id, this.scene);
    this.decorEditor = new DecorEditor(this.scene);
    this.ceremony = new Ceremony({
      scene: this.scene,
      rig: this.rig,
      particles: this.particles,
      sound: this.sound,
      player: this.player,
      playerPos: this.playerPos,
      playerDir: this.playerDir,
      partner: this.partner,
      residents: this.residents,
      hour: () => hourOf(this.clock),
      capture: (cb) => this.captureCbs.push(cb),
      save: (r) => this.save(r, true),
      setPlayer: (x, z, dir) => this.setPlayer(x, z, dir),
      flash: () => this.flash(),
    });
    this.buildTargets();
    this.loadFromStore();
    // 꽃·화단 같은 작은 것은 화면 밖 판정 유지
    for (const f of this.flowers.values()) f.group.userData.keepCull = true;
    for (const p of this.plots.values()) for (const g of [p.sprout, p.bud, p.bloom]) g.userData.keepCull = true;
    patchScene(this.scene);
    this.subscribe();
    this.onResize();
    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pagehide', this.onPageHide);
    engineRef.current = this;
    (window as any).__wf = { engine: this, game: useGame, ui: useUI };
    this.raf = requestAnimationFrame(this.loop);
  }

  // ── 설정 ──
  private applyPixelRatio() {
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(this.quality === 'high' ? Math.min(dpr, 2) : Math.min(dpr, 1.25));
  }

  setQuality(q: 'high' | 'low') {
    this.quality = q;
    this.applyPixelRatio();
    this.light.setQuality(q);
    this.particles.setQuality(q);
    this.applyCharacterShadows();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  /** 낮음 품질 — 캐릭터 실시간 그림자 끄기(발밑 접촉 그림자는 그대로) */
  applyCharacterShadows() {
    const on = this.quality === 'high';
    const bodies = [this.player, this.partner.body, ...Object.values(this.residents).map((r) => r.body)];
    for (const b of bodies) b.root.traverse((c) => ((c as THREE.Mesh).isMesh && c !== b.shadow ? ((c as THREE.Mesh).castShadow = on) : null));
  }

  // ── 상태 불러오기 ──
  loadFromStore() {
    const s = useGame.getState();
    this.clock = s.clock;
    this.clockSynced = s.clock;
    this.player.apply(s.me.look);
    (this.partner.body as Avatar).apply(s.partner.look);
    this.setPlayer(s.pos[0], s.pos[1], s.dir);
    this.partner.place(this.playerPos, this.playerDir);
    for (const r of Object.values(this.residents)) r.place(hourOf(this.clock));
    this.syncDecor();
    this.syncFlowers(true);
    this.syncPlots();
    this.syncPromise();
    this.syncMailbox();
    this.applySettings();
    this.light.setQuality(this.quality);
    this.applyCharacterShadows();
    this.rig.snapTo(this.playerPos);
  }

  private applySettings() {
    const st = useGame.getState().settings;
    this.sound.setVolume({ master: st.master, music: st.music, sfx: st.sfx });
    this.rig.shakeEnabled = st.shake;
    if (st.quality !== this.quality) this.setQuality(st.quality);
  }

  private subscribe() {
    this.unsub.push(
      useGame.subscribe((s, p) => {
        if (s.me.look !== p.me.look) {
          this.player.apply(s.me.look);
          this.applyCharacterShadows();
        }
        if (s.partner.look !== p.partner.look) {
          (this.partner.body as Avatar).apply(s.partner.look);
          this.applyCharacterShadows();
        }
        if (s.decor !== p.decor || s.framePhoto !== p.framePhoto) this.syncDecor();
        if (s.flowers !== p.flowers) this.syncFlowers(false);
        if (s.plots !== p.plots) this.syncPlots();
        if (s.promiseTree !== p.promiseTree) this.syncPromise();
        if (s.letters !== p.letters) this.syncMailbox();
        if (s.settings !== p.settings) this.applySettings();
      }),
      onGameEvent((e) => {
        const ui = useUI.getState();
        if (e.type === 'gain') {
          this.sound.pick();
          ui.toast(`${itemName(e.id)} +${e.qty}${e.toStorage ? ` · 가방이 가득 차서 ${e.toStorage}개는 집 보관함으로` : ''}`, e.toStorage ? 'warn' : 'ok', e.id);
          this.particles.sparkle(this.playerPos.clone().add(v3(0, 1.1, 0)), 5, '#FFF2B8', 0.4);
        } else if (e.type === 'bagFull') {
          this.sound.error();
          ui.toast('가방이 가득 찼어요. 집 보관함에 맡기거나 소담 가게에 팔아 보세요', 'warn');
        } else if (e.type === 'quest') {
          if (e.status === 'done') {
            this.sound.reward();
            ui.toast(`완료 · ${QUESTS[e.id]?.title ?? ''}`, 'gold');
            this.save('quest', false);
          } else if (e.status === 'active' && QUESTS[e.id]) {
            ui.toast(`새 목표 · ${QUESTS[e.id].title}`, 'info');
          } else if (e.status === 'ready') {
            this.sound.open();
          }
        } else if (e.type === 'memory') {
          this.sound.memory();
          ui.toast(`추억 카드 · ${e.title}`, 'gold');
        } else if (e.type === 'reward') {
          ui.toast(e.text, 'gold');
        }
      }),
    );
  }

  // ── 월드 상호작용 대상 ──
  private buildGatherables() {
    const colors: Record<string, string> = { white_flower: '#FFFFFF', pink_flower: '#F0AFC4', yellow_flower: '#F6D46B', rare_flower: '#E6F1FF' };
    // 꽃 한 자리 = 메시 1~2개(줄기·잎·꽃을 정점색으로 합침) — 그리기 호출 줄이기
    const vc = mat('#ffffff', { vertexColors: true, rough: 0.78 });
    for (const f of FLOWER_SPOTS) {
      const g = new THREE.Group();
      const rare = f.item === 'rare_flower';
      const n = rare ? 4 : 3;
      const base: THREE.BufferGeometry[] = [];
      const bells: THREE.BufferGeometry[] = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + 0.4;
        const r = i === 0 ? 0 : 0.14;
        const cx = Math.cos(a) * r;
        const cz = Math.sin(a) * r;
        base.push(part(new THREE.CylinderGeometry(0.012, 0.014, 0.32, 5), '#6E9E57', cx, 0.16, cz));
        base.push(part(new THREE.SphereGeometry(0.06, 8, 6), '#79A960', cx + 0.05, 0.08, cz, 0, 0, 0, 1.5, 0.4, 0.7));
        if (rare) {
          for (let k = 0; k < 3; k++) {
            const bell = new THREE.SphereGeometry(0.045, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.6);
            bells.push(part(bell, '#E6F1FF', cx + 0.05 * (k - 1), 0.36 - k * 0.03, cz, Math.PI, 0, 0));
          }
        } else {
          base.push(part(new THREE.SphereGeometry(0.075, 10, 8), colors[f.item], cx, 0.33, cz, 0, 0, 0, 1, 0.55, 1));
          base.push(part(new THREE.SphereGeometry(0.03, 8, 6), '#F2C14E', cx, 0.37, cz));
        }
      }
      g.add(new THREE.Mesh(merge(base), vc));
      if (bells.length) g.add(new THREE.Mesh(merge(bells), this.rareMat));
      g.position.set(f.pos[0], 0, f.pos[1]);
      this.scene.add(g);
      this.flowers.set(f.id, { group: g, item: f.item, shown: true, pop: 1, pos: flat(f.pos) });
    }
    for (const t of SHAKE_TREES) {
      const { group, crown } = makeShakeTree(t.fruit ? 'fruit' : 'round');
      group.position.set(t.pos[0], 0, t.pos[1]);
      group.scale.setScalar(1.05);
      this.scene.add(group);
      this.col.circle(t.pos[0], t.pos[1], 0.38);
      this.trees.set(t.id, { group, crown, wobble: 0, fruit: t.fruit, pos: flat(t.pos) });
    }
  }

  private buildPlots() {
    const all: Array<[string, V2]> = [...HOME.plots.map((p, i) => [`home${i}`, p] as [string, V2]), ...GREENHOUSE.plots.map((p, i) => [`gh${i}`, p] as [string, V2])];
    const vc = mat('#ffffff', { vertexColors: true, rough: 0.85 });
    for (const [id, p] of all) {
      // 새싹 · 봉오리 · 개화 — 단계마다 메시 하나(꽃잎만 씨앗 색을 바꾸는 따로 메시)
      const sprout = new THREE.Group();
      sprout.add(
        new THREE.Mesh(
          merge([
            part(new THREE.SphereGeometry(0.07, 8, 6), '#7FB565', -0.06, 0.2, 0, 0, 0, 0.4, 1.4, 0.4, 0.8),
            part(new THREE.SphereGeometry(0.07, 8, 6), '#7FB565', 0.06, 0.2, 0, 0, 0, -0.4, 1.4, 0.4, 0.8),
            part(new THREE.CylinderGeometry(0.012, 0.014, 0.16, 5), '#6E9E57', 0, 0.14, 0),
          ]),
          vc,
        ),
      );
      const bud = new THREE.Group();
      bud.add(new THREE.Mesh(merge([part(new THREE.CylinderGeometry(0.014, 0.016, 0.36, 5), '#6E9E57', 0, 0.25, 0), part(new THREE.SphereGeometry(0.06, 8, 6), '#9CCB7C', 0, 0.46, 0, 0, 0, 0, 1, 1.4, 1)]), vc));
      const bloom = new THREE.Group();
      const headMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.75 });
      const stems: THREE.BufferGeometry[] = [];
      const heads: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const x = Math.cos(a) * 0.12;
        const z = Math.sin(a) * 0.12;
        stems.push(part(new THREE.CylinderGeometry(0.014, 0.016, 0.4, 5), '#6E9E57', x, 0.2, z));
        stems.push(part(new THREE.SphereGeometry(0.035, 8, 6), '#F2C14E', x, 0.46, z));
        heads.push(part(new THREE.SphereGeometry(0.09, 10, 8), '#FFFFFF', x, 0.42, z, 0, 0, 0, 1, 0.55, 1));
      }
      bloom.add(new THREE.Mesh(merge(stems), vc), new THREE.Mesh(merge(heads), headMat));
      for (const g of [sprout, bud, bloom]) {
        g.position.set(p[0], 0.1, p[1]);
        g.visible = false;
        this.scene.add(g);
      }
      this.plots.set(id, { pos: flat(p), sprout, bud, bloom, headMat });
    }
  }

  private makePromiseTree(): THREE.Group {
    const g = new THREE.Group();
    const parts = [part(new THREE.CylinderGeometry(0.1, 0.14, 1.2, 8), '#8E6A4C', 0, 0.6, 0)];
    for (const [x, y, z, r, c] of [
      [0, 1.55, 0, 0.6, '#7FB26A'],
      [0.35, 1.35, 0.1, 0.42, '#6EA05D'],
      [-0.32, 1.4, -0.05, 0.45, '#6EA05D'],
      [0.05, 1.9, -0.05, 0.38, '#8CC077'],
    ] as Array<[number, number, number, number, string]>) parts.push(part(blob(r, 12), c, x, y, z));
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      parts.push(part(new THREE.SphereGeometry(0.06, 8, 6), i % 2 ? '#FFFFFF' : '#F4B9C9', Math.cos(a) * 0.55, 1.5 + Math.sin(a * 2) * 0.2, Math.sin(a) * 0.55));
    }
    const m = new THREE.Mesh(merge(parts), mat('#fffff9', { vertexColors: true, rough: 0.9, sway: { base: 1.0, amp: 0.03 } }));
    m.castShadow = true;
    g.add(m);
    // 작은 리본 팻말
    const sign = new THREE.Mesh(merge([part(rbox(0.06, 0.5, 0.06, 0.02), '#8E6A4C', 0, 0.25, 0), part(rbox(0.42, 0.22, 0.05, 0.03), '#F5E9D2', 0, 0.5, 0)]), mat('#fffff8', { vertexColors: true }));
    sign.position.set(0.7, 0, 0.5);
    g.add(sign);
    g.position.set(HOME.promiseTree[0], 0, HOME.promiseTree[1]);
    g.visible = false;
    this.scene.add(g);
    return g;
  }

  private buildTargets() {
    const T = this.targets;
    const st = () => useGame.getState();
    for (const f of FLOWER_SPOTS) {
      const pos = flat(f.pos);
      T.push({ id: `flower:${f.id}`, kind: 'flower', ref: f.id, pos: () => pos, r: 0.3, h: 0.7, label: () => (this.flowers.get(f.id)?.shown ? `${itemName(f.item)} 따기` : null) });
    }
    for (const t of SHAKE_TREES) {
      const pos = flat(t.pos);
      T.push({ id: `tree:${t.id}`, kind: 'tree', ref: t.id, extra: t.fruit, pos: () => pos, r: 0.55, h: 2.2, label: () => ((st().trees[t.id] || 0) > this.clock ? null : t.fruit ? '열매 나무 흔들기' : '나무 흔들기') });
    }
    for (const r of ROCKS) {
      const pos = flat(r.pos);
      T.push({ id: `rock:${r.id}`, kind: 'rock', ref: r.id, pos: () => pos, r: 0.65, h: 0.9, label: () => ((st().rocks[r.id] || 0) > this.clock ? null : '작은 돌 줍기') });
    }
    T.push({ id: 'logs', kind: 'logs', pos: () => flat(WORKSHOP.logs), r: 0.9, h: 1.4, label: () => (st().logs > this.clock ? null : '목재 가져가기') });
    for (const id of RESIDENT_IDS) {
      T.push({ id: `npc:${id}`, kind: 'npc', ref: id, pos: () => this.residents[id].pos, r: 0.35, h: 1.25, label: () => (this.residents[id].staged ? null : `${josa(RESIDENTS[id].name, '와/과')} 이야기`) });
    }
    T.push({ id: 'partner', kind: 'partner', pos: () => this.partner.pos, r: 0.32, h: 1.25, label: () => `${josa(st().partner.name, '와/과')} 이야기` });
    T.push({ id: 'board', kind: 'board', pos: () => flat(PLAZA.board), r: 0.7, h: 2.1, label: () => '게시판 보기' });
    T.push({ id: 'bench', kind: 'bench', extra: { seat: flat(PLAZA.bench), dir: 0.3 }, pos: () => flat(PLAZA.bench), r: 0.75, h: 1.1, label: () => '벤치에 앉기' });
    T.push({ id: 'deckbench', kind: 'bench', extra: { seat: v3(LAKE.deck.maxX - 0.95, 0, (LAKE.deck.minZ + LAKE.deck.maxZ) / 2), dir: -Math.PI / 2 }, pos: () => v3(LAKE.deck.maxX - 0.6, 0, (LAKE.deck.minZ + LAKE.deck.maxZ) / 2), r: 0.6, h: 1.0, label: () => '데크 벤치에 앉기' });
    T.push({ id: 'mailbox', kind: 'mailbox', pos: () => flat(HOME.mailbox), r: 0.45, h: 1.6, label: () => (st().letters.some((l) => !l.read) ? '우편함 열기 · 새 편지' : '우편함 열기') });
    T.push({ id: 'storage', kind: 'storage', pos: () => flat(HOME.storage), r: 0.6, h: 0.9, label: () => '보관함 열기' });
    T.push({ id: 'door', kind: 'door', pos: () => flat(HOME.door).add(v3(0, 0, 0.2)), r: 0.6, h: 2.0, label: () => '우리 집 현관' });
    T.push({ id: 'workbench', kind: 'workbench', pos: () => flat(WORKSHOP.workbench), r: 0.95, h: 1.3, label: () => '작업대 쓰기' });
    T.push({ id: 'bouquet', kind: 'bouquet', pos: () => flat(GREENHOUSE.bouquetTable), r: 0.65, h: 1.3, label: () => '부케 테이블 쓰기' });
    T.push({ id: 'shop', kind: 'shop', pos: () => flat(GREENHOUSE.counter), r: 1.0, h: 1.5, label: () => '꽃 가판대 보기' });
    T.push({ id: 'mirror', kind: 'mirror', pos: () => flat(BOUTIQUE.mirror), r: 0.5, h: 2.0, label: () => '거울 보기 · 옷 갈아입기' });
    T.push({ id: 'gardenSign', kind: 'gardenSign', pos: () => flat(GARDEN.sign), r: 0.5, h: 2.0, label: () => '서약의 정원 표지판' });
    T.push({ id: 'promise', kind: 'promise', pos: () => flat(HOME.promiseTree), r: 0.6, h: 1.8, label: () => (st().promiseTree ? '약속의 나무 보기' : null) });
    T.push({ id: 'gateSign', kind: 'sign', extra: '숲 입구 — 북쪽이 약속의 광장이에요. 광장 동남쪽은 꽃잎 온실, 서남쪽은 나뭇결 공방이에요.', pos: () => flat(GATE_SIGN), r: 0.5, h: 1.8, label: () => '표지판 읽기' });
    for (const [id, p] of this.plots) {
      T.push({
        id: `plot:${id}`,
        kind: 'plot',
        ref: id,
        pos: () => p.pos,
        r: 0.5,
        h: 0.8,
        label: () => {
          const s = st();
          const pl = s.plots[id];
          if (!pl) return null;
          const stage = plotStage(pl, this.clock);
          if (stage === 3) return '꽃 수확하기';
          if (stage > 0) return null;
          return s.count('seed_white') + s.count('seed_pink') > 0 ? '씨앗 심기' : null;
        },
      });
    }
  }

  // ── 동기화 ──
  syncDecor() {
    const s = useGame.getState();
    const want = new Map<string, { id: string; x: number; z: number; rot: number; area: DecorArea }>();
    for (const area of ['garden', 'home'] as DecorArea[]) for (const p of s.decor[area]) want.set(p.uid, { ...p, area });
    for (const [uid, obj] of this.decorObjs) {
      if (!want.has(uid)) {
        this.scene.remove(obj);
        this.decorObjs.delete(uid);
      }
    }
    this.col.clearGroup('decor');
    for (const [uid, p] of want) {
      let obj = this.decorObjs.get(uid);
      if (!obj) {
        obj = buildDecor(p.id);
        this.scene.add(obj);
        this.decorObjs.set(uid, obj);
        this.particles.sparkle(v3(p.x, 0.6, p.z), 6, '#FFFFFF', 0.6);
      }
      obj.position.set(p.x, 0, p.z);
      obj.rotation.y = (p.rot * Math.PI) / 2;
      const def = DECOR[p.id];
      if (def?.solid) {
        if (def.role === 'arch') {
          // 아치는 기둥만 막는다(가운데로 지나간다)
          const c = Math.cos((p.rot * Math.PI) / 2);
          const sn = Math.sin((p.rot * Math.PI) / 2);
          for (const sx of [-1.15, 1.15]) this.col.add({ kind: 'circle', x: p.x + sx * c, z: p.z - sx * sn, r: 0.22, group: 'decor' });
        } else {
          const fp = footprint(def, p.rot);
          this.col.add({ kind: 'box', x: p.x, z: p.z, hw: Math.max(0.12, fp.hw - 0.06), hd: Math.max(0.12, fp.hd - 0.06), rot: 0, group: 'decor' });
        }
      }
      if (p.id === 'photo_frame') {
        const fid = s.framePhoto;
        if (obj.userData.photo !== fid) {
          obj.userData.photo = fid;
          if (fid) void getPhoto(fid).then((rec) => setFramePhoto(obj!, rec?.full || null));
          else setFramePhoto(obj, null);
        }
      }
    }
  }

  private syncFlowers(instant: boolean) {
    const s = useGame.getState();
    for (const [id, f] of this.flowers) {
      const avail = (s.flowers[id] || 0) <= this.clock;
      if (avail !== f.shown) {
        f.shown = avail;
        f.pop = instant ? (avail ? 1 : 0) : f.pop;
        if (instant) f.group.visible = avail;
      }
    }
  }

  private syncPlots() {
    const s = useGame.getState();
    for (const [id, p] of this.plots) {
      const pl = s.plots[id];
      const stage = pl ? plotStage(pl, this.clock) : -1;
      p.sprout.visible = stage === 1;
      p.bud.visible = stage === 2;
      p.bloom.visible = stage === 3;
      if (pl?.seed) p.headMat.color.set(pl.seed === 'seed_pink' ? '#F0AFC4' : '#FFFFFF');
    }
  }

  private syncPromise() {
    const s = useGame.getState();
    if (!s.promiseTree) {
      this.promiseTree.visible = false;
      return;
    }
    this.promiseTree.visible = true;
    const age = dayOf(this.clock) - s.promiseTree;
    const k = age <= 0 ? 0.42 : age === 1 ? 0.55 : age < 4 ? 0.72 : age < 8 ? 0.88 : 1;
    this.promiseTree.scale.setScalar(k);
  }

  private syncMailbox() {
    const unread = useGame.getState().letters.some((l) => !l.read);
    this.build.mailboxFlag.rotation.z = unread ? 0 : -1.4;
  }

  // ── 플레이어 ──
  setPlayer(x: number, z: number, dir: number) {
    const [fx, fz] = this.col.freeSpot(x, z, 0.28);
    this.playerPos.set(fx, 0, fz);
    this.playerDir = dir;
    this.playerVel.set(0, 0, 0);
    this.player.root.position.copy(this.playerPos);
    this.player.snapYaw(dir);
    this.sitting = null;
    this.player.setPose('idle');
  }

  teleportHome() {
    this.setPlayer(HOME_SPAWN.pos[0], HOME_SPAWN.pos[1], HOME_SPAWN.dir);
    this.partner.place(this.playerPos, this.playerDir);
    this.rig.snapTo(this.playerPos);
    useUI.getState().toast('우리의 집 앞으로 왔어요', 'info');
  }

  private updatePlayer(dt: number, now: number) {
    const ui = useUI.getState();
    const blocked = uiBlocking() || ui.mode !== 'play';
    const mv = blocked ? { x: 0, z: 0, mag: 0, run: false } : this.input.move();
    const busy = !!this.action && now < this.action.until;
    if (this.sitting && mv.mag > 0.2) {
      this.sitting = null;
      this.player.setPose('idle');
    }
    const speed = busy || this.sitting ? 0 : (mv.run ? RUN : WALK) * mv.mag;
    const want = v3(mv.x * speed, 0, mv.z * speed);
    const k = 1 - Math.exp(-dt * (want.lengthSq() > 0 ? 12 : 16));
    this.playerVel.lerp(want, k);
    if (this.playerVel.lengthSq() < 0.0004) this.playerVel.set(0, 0, 0);
    if (this.playerVel.lengthSq() > 0) {
      const nx = this.playerPos.x + this.playerVel.x * dt;
      const nz = this.playerPos.z + this.playerVel.z * dt;
      let [rx, rz] = this.col.resolve(nx, nz, 0.28);
      // 주민·파트너 몸에 부딪힘
      for (const r of Object.values(this.residents)) {
        if (r.staged) continue;
        const dx = rx - r.pos.x;
        const dz = rz - r.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.55 && d > 0.0001) {
          rx = r.pos.x + (dx / d) * 0.55;
          rz = r.pos.z + (dz / d) * 0.55;
        }
      }
      const moved = Math.hypot(rx - this.playerPos.x, rz - this.playerPos.z);
      this.playerPos.x = rx;
      this.playerPos.z = rz;
      if (mv.mag > 0.1) this.playerDir = Math.atan2(mv.x, mv.z);
      this.player.speed = moved / Math.max(dt, 1e-4);
    } else {
      this.player.speed = 0;
    }
    if (this.sitting) {
      this.playerPos.copy(this.sitting.pos);
      this.playerDir = this.sitting.dir;
      this.player.setPose('sit');
      this.player.root.position.y = 0.3;
    } else this.player.root.position.y = 0;
    // 행동(따기·흔들기) 타이밍 — 손이 닿는 순간 처리
    if (this.action) {
      if (!this.action.fired && now >= this.action.at) {
        this.action.fired = true;
        this.action.fire();
      }
      if (now >= this.action.until) {
        this.action = null;
        if (!this.sitting) this.player.setPose('idle');
      }
    }
    this.player.root.position.x = this.playerPos.x;
    this.player.root.position.z = this.playerPos.z;
    this.player.setYaw(this.playerDir, dt);
    // 대상 바라보기
    if (this.current && !busy) {
      const tp = this.current.pos();
      let rel = Math.atan2(tp.x - this.playerPos.x, tp.z - this.playerPos.z) - this.playerDir;
      while (rel > Math.PI) rel -= Math.PI * 2;
      while (rel < -Math.PI) rel += Math.PI * 2;
      this.player.headYaw = Math.max(-0.6, Math.min(0.6, rel));
      this.player.headPitch = 0.12;
    } else {
      this.player.headYaw = 0;
      this.player.headPitch = 0;
    }
    this.player.animate(dt, now);
    // 발소리
    if (this.player.speed > 0.3) {
      const ph = Math.floor(this.player.phase / Math.PI);
      if (ph !== this.stepPhase) {
        this.stepPhase = ph;
        this.sound.step(this.surfaceAt(this.playerPos.x, this.playerPos.z));
      }
    }
  }

  private surfaceAt(x: number, z: number): Surface {
    const d = LAKE.deck;
    if (x > d.minX && x < d.maxX && z > d.minZ && z < d.maxZ) return 'wood';
    if (Math.hypot(x - PLAZA.center[0], z - PLAZA.center[1]) < PLAZA.radius) return 'dirt';
    for (const p of PATHS) for (let i = 0; i < p.pts.length - 1; i++) if (distSeg(x, z, p.pts[i], p.pts[i + 1]) < p.w / 2) return 'dirt';
    return 'grass';
  }

  // ── 상호작용 ──
  private pickTarget(): Target | null {
    let best: Target | null = null;
    let bs = Infinity;
    const fx = Math.sin(this.playerDir);
    const fz = Math.cos(this.playerDir);
    for (const t of this.targets) {
      const p = t.pos();
      const dx = p.x - this.playerPos.x;
      const dz = p.z - this.playerPos.z;
      const dist = Math.hypot(dx, dz);
      const edge = dist - t.r;
      if (edge > 1.15) continue;
      const lab = t.label();
      if (!lab) continue;
      const ang = dist > 0.001 ? Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / dist))) : 0;
      if (ang > 1.45 && edge > 0.2) continue;
      // 가장 가깝고 바라보는 방향에 있는 하나
      const score = edge + Math.max(0, ang - 0.35) * 1.3;
      if (score < bs) {
        bs = score;
        best = t;
      }
    }
    return best;
  }

  private startAction(pose: Pose, dur: number, at: number, fire: () => void, face?: THREE.Vector3) {
    const now = performance.now();
    if (face) this.playerDir = Math.atan2(face.x - this.playerPos.x, face.z - this.playerPos.z);
    this.player.setPose(pose);
    this.action = { until: now + dur * 1000, at: now + at * 1000, fired: false, fire, pose };
  }

  interact(t: Target) {
    const g = useGame.getState();
    const ui = useUI.getState();
    this.sound.click();
    switch (t.kind) {
      case 'flower': {
        const f = this.flowers.get(t.ref!)!;
        this.startAction('reach', 0.62, 0.33, () => {
          const r = g.pickFlower(t.ref!);
          if (r.ok) {
            this.player.setExpr('smile', 900);
            this.particles.sparkle(f.pos.clone().add(v3(0, 0.4, 0)), 6, '#FFFFFF', 0.3);
            this.save('pick', false);
          } else if (r.reason === 'full') this.player.setExpr('sad', 1200);
        }, f.pos);
        break;
      }
      case 'tree': {
        const tr = this.trees.get(t.ref!)!;
        this.startAction('shake', 0.75, 0.3, () => {
          const r = g.shakeTree(t.ref!, !!t.extra);
          tr.wobble = 1;
          this.sound.shake();
          this.rig.shake = 0.4;
          if (r.ok) {
            this.player.setExpr('surprise', 700);
            for (const d of r.drops) for (let i = 0; i < Math.min(3, d.qty); i++) this.particles.drop(d.id, tr.pos.clone().add(v3((Math.random() - 0.5) * 1.2, 2.2, 0.3)), () => this.playerPos);
            setTimeout(() => this.sound.thud(), 520);
            this.save('shake', false);
          }
        }, tr.pos);
        break;
      }
      case 'rock':
        this.startAction('reach', 0.62, 0.33, () => {
          if (g.hitRock(t.ref!).ok) this.save('rock', false);
        }, t.pos());
        break;
      case 'logs':
        this.startAction('reach', 0.62, 0.33, () => {
          if (g.takeLogs().ok) {
            this.sound.thud();
            this.save('logs', false);
          }
        }, t.pos());
        break;
      case 'npc':
        this.startTalk(this.residents[t.ref!]);
        break;
      case 'partner':
        this.partnerTalk();
        break;
      case 'board':
        ui.open('board');
        this.sound.open();
        break;
      case 'bench': {
        const seat = t.extra.seat as THREE.Vector3;
        this.sitting = { pos: seat.clone(), dir: t.extra.dir };
        this.playerPos.copy(seat);
        this.player.setExpr('smile', 1200);
        // 파트너도 곁에 앉는다
        break;
      }
      case 'mailbox':
        ui.open('letters');
        this.sound.open();
        break;
      case 'storage':
        ui.open('storage');
        this.sound.open();
        break;
      case 'workbench':
        ui.set({ craftStation: 'workbench' });
        ui.open('craft');
        this.sound.open();
        break;
      case 'bouquet':
        ui.set({ craftStation: 'bouquet_table' });
        ui.open('craft');
        this.sound.open();
        break;
      case 'shop':
        ui.open('shop');
        this.sound.open();
        break;
      case 'mirror':
        ui.set({ wardrobeFor: 'me', wardrobeMode: 'wedding' });
        ui.open('wardrobe');
        this.sound.open();
        break;
      case 'plot': {
        const pl = g.plots[t.ref!];
        const stage = plotStage(pl, this.clock);
        if (stage === 3) {
          this.startAction('reach', 0.62, 0.33, () => {
            if (g.harvest(t.ref!).ok) this.save('harvest', false);
          }, t.pos());
        } else {
          const seeds = (['seed_white', 'seed_pink'] as const).filter((sd) => g.count(sd) > 0);
          const plant = (sd: string) =>
            this.startAction('reach', 0.62, 0.33, () => {
              if (useGame.getState().plant(t.ref!, sd)) {
                ui.toast(`${josa(itemName(sd), '을/를')} 심었어요 · 조금 기다리면 꽃이 펴요`, 'ok');
                this.syncPlots();
                this.save('plant', false);
              }
            }, t.pos());
          if (seeds.length === 1) plant(seeds[0]);
          else
            ui.say(
              { lines: [{ who: 'sys', text: '어떤 씨앗을 심을까요?' }], choices: [...seeds.map((sd) => ({ label: itemName(sd), action: `plant:${t.ref}:${sd}` })), { label: '그만두기' }] },
              (a) => {
                if (a.startsWith('plant:')) {
                  const [, , sd] = a.split(':');
                  plant(sd);
                }
              },
            );
        }
        break;
      }
      case 'gardenSign':
        ui.say(
          {
            lines: [{ who: 'sys', text: '서약의 정원 — 아치는 통로 끝 표시 자리에, 하객 의자는 통로 양옆에 놓아 주세요.' }],
            choices: [
              { label: '정원 꾸미기', action: 'decor:garden' },
              { label: '예식 준비 확인', action: 'ready' },
              { label: '닫기' },
            ],
          },
          (a) => this.runAction(a),
        );
        break;
      case 'door':
        ui.say(
          {
            lines: [{ who: 'sys', text: `${josa(g.me.name, '와/과')} ${g.partner.name}의 작은 집. 앞마당을 꾸미거나 추억을 볼 수 있어요.` }],
            choices: [
              { label: '앞마당 꾸미기', action: 'decor:home' },
              { label: '추억 앨범 보기', action: 'album' },
              { label: '지금 저장하기', action: 'save' },
              { label: '닫기' },
            ],
          },
          (a) => this.runAction(a),
        );
        break;
      case 'promise': {
        const days = dayOf(this.clock) - (g.promiseTree || dayOf(this.clock));
        ui.sayLines([{ who: 'sys', text: days <= 0 ? '오늘 함께 심은 약속의 나무. 아직 작지만 잎이 반짝여요.' : `약속의 나무를 심은 지 ${days}일. 조금씩 자라고 있어요.` }]);
        break;
      }
      case 'frame':
        ui.open('album');
        break;
      case 'sign':
        ui.sayLines([{ who: 'sys', text: String(t.extra) }]);
        break;
    }
  }

  /** 대화·선택지·창에서 오는 행동 */
  runAction(a: string) {
    const g = useGame.getState();
    const ui = useUI.getState();
    if (!a || a === 'close') return;
    if (a.startsWith('q.complete:')) {
      const id = a.slice(11);
      g.completeQuest(id);
      return;
    }
    if (a.startsWith('q.accept:')) {
      g.acceptQuest(a.slice(9));
      this.save('accept', false);
      return;
    }
    if (a === 'shop.open') {
      setTimeout(() => ui.open('shop'), 0);
      return;
    }
    if (a.startsWith('gift.open:')) {
      const id = a.slice(10);
      setTimeout(() => ui.open('gift', id), 0);
      return;
    }
    if (a.startsWith('chat:')) {
      const id = a.slice(5);
      setTimeout(() => ui.sayLines(chatLines(id, this.dialogueCtx(id))), 0);
      return;
    }
    if (a === 'ceremony.start' || a === 'ceremony.replay') {
      const r = ceremonyReadiness(g.snapshot());
      if (!r.ok) {
        setTimeout(() => ui.open('ready'), 0);
        return;
      }
      setTimeout(() => this.startCeremony(a === 'ceremony.replay'), 50);
      return;
    }
    if (a === 'ceremony.check' || a === 'ready') {
      setTimeout(() => ui.open('ready'), 0);
      return;
    }
    if (a.startsWith('decor:')) {
      const area = a.slice(6) as DecorArea;
      setTimeout(() => this.enterDecor(area), 0);
      return;
    }
    if (a === 'album') {
      setTimeout(() => ui.open('album'), 0);
      return;
    }
    if (a === 'save') {
      this.save('manual', true);
      return;
    }
    if (a === 'photo') {
      setTimeout(() => this.enterPhoto(), 0);
      return;
    }
    if (a === 'sit') {
      return;
    }
  }

  dialogueCtx(id: string): DialogueCtx {
    const g = useGame.getState();
    const r = g.residents[id] || { affinity: 0, talkedDay: 0, giftDay: 0 };
    const ready = ceremonyReadiness(g.snapshot());
    return {
      me: g.me.name,
      partner: g.partner.name,
      quest: (q) => g.quests[q] || 'locked',
      count: (it) => g.count(it),
      affinity: r.affinity,
      talkedToday: r.talkedDay === dayOf(this.clock),
      hour: Math.floor(hourOf(this.clock)),
      day: dayOf(this.clock),
      weddings: g.wedding.count,
      ready: ready.ok,
      missing: ready.items.filter((i) => !i.ok && !i.optional).map((i) => `${i.label}: ${i.detail}`),
    };
  }

  startTalk(r: ResidentActor) {
    const ui = useUI.getState();
    const ctx = this.dialogueCtx(r.def.id);
    const node = residentDialogue(r.def.id, ctx);
    useGame.getState().talk(r.def.id);
    r.talking = true;
    r.faceTo(this.playerPos);
    r.body.setPose('idle');
    this.playerDir = Math.atan2(r.pos.x - this.playerPos.x, r.pos.z - this.playerPos.z);
    this.talkingWith = r;
    this.rig.talkCenter.copy(this.playerPos).lerp(r.pos, 0.5);
    this.rig.mode = 'talk';
    this.sound.setDuck(true);
    const expr = node.lines[0]?.expr;
    if (expr) r.body.setExpr(expr as FaceExpr, 2500);
    ui.say(node, (a) => this.runAction(a));
  }

  private partnerTalk() {
    const g = useGame.getState();
    const ui = useUI.getState();
    const lines = [
      `오늘은 어디 가 볼까, ${g.me.name}?`,
      '같이 걸으니까 숲이 더 예뻐 보여.',
      g.wedding.count > 0 ? '약속의 나무, 우리처럼 무럭무럭 자랐으면 좋겠다.' : '우리 결혼식, 생각만 해도 두근거려.',
      '꽃 냄새가 바람에 실려 와.',
    ];
    this.partner.body.setExpr('smile', 2000);
    this.rig.talkCenter.copy(this.playerPos).lerp(this.partner.pos, 0.5);
    this.rig.mode = 'talk';
    ui.say(
      {
        lines: [{ who: 'partner', text: lines[(dayOf(this.clock) + Math.floor(hourOf(this.clock))) % lines.length], expr: 'smile' }],
        choices: [{ label: '같이 사진 찍자', action: 'photo' }, { label: '함께 걷자', action: 'close' }],
      },
      (a) => this.runAction(a),
    );
  }

  /** 대화가 끝났을 때(화면이 부른다) */
  onDialogueClosed() {
    // 대화를 닫은 키(E/Space)가 같은 프레임에 다시 말 걸기로 이어지지 않게
    this.input.pressed.clear();
    this.interactCooldown = performance.now() + 320;
    if (this.talkingWith) {
      this.talkingWith.talking = false;
      this.talkingWith = null;
    }
    this.sound.setDuck(false);
    if (this.rig.mode === 'talk') this.rig.backToFollow();
  }

  giveGift(resident: string, item: string) {
    const ui = useUI.getState();
    const r = useGame.getState().gift(resident, item);
    const lines = giftLines(resident, itemName(item), r.liked, r.already);
    if (r.ok) {
      this.sound.reward();
      this.residents[resident]?.body.setExpr(r.liked ? 'joy' : 'smile', 2200);
      this.save('gift', false);
    }
    ui.close();
    setTimeout(() => ui.sayLines(lines), 0);
  }

  craft(recipeId: string): { ok: boolean; reason?: string } {
    const r = useGame.getState().craft(recipeId);
    if (r.ok) {
      this.sound.craft();
      const ui = useUI.getState();
      const at = ui.craftStation === 'workbench' ? flat(WORKSHOP.workbench) : flat(GREENHOUSE.bouquetTable);
      this.particles.sparkle(at.add(v3(0, 1.1, 0)), 12, '#FFF2B8', 0.6);
      this.player.setExpr('joy', 1500);
      if (recipeId === 'bouquet') {
        this.player.bouquetHeld = true;
        this.player.holdItem('bouquet');
      }
      this.save('craft', true);
    } else this.sound.error();
    return r;
  }

  toggleBouquet() {
    const g = useGame.getState();
    if (this.player.bouquetHeld) {
      this.player.bouquetHeld = false;
      this.player.holdItem(null);
    } else if (g.count('bouquet') > 0) {
      this.player.bouquetHeld = true;
      this.player.holdItem('bouquet');
    }
  }

  // ── 꾸미기 ──
  enterDecor(area: DecorArea) {
    const ui = useUI.getState();
    ui.close();
    this.decorEditor.enter(area);
    this.rig.decorCenter.copy(this.decorEditor.center());
    this.rig.decorDist = area === 'garden' ? 15.5 : 11;
    this.rig.mode = 'decor';
    this.build.archMarker.visible = area === 'garden';
    shared.uOccOn.value = 0;
    this.sound.open();
  }

  exitDecor(commit: boolean) {
    this.decorEditor.exit(commit);
    this.build.archMarker.visible = false;
    this.rig.backToFollow();
    shared.uOccOn.value = 1;
    this.sound.close();
    this.save(commit ? 'decor' : 'decor-cancel', true);
    useUI.getState().toast(commit ? '배치를 저장했어요' : '들어오기 전 배치로 되돌렸어요', 'info');
  }

  // ── 예식 ──
  startCeremony(replay = false) {
    const r = ceremonyReadiness(useGame.getState().snapshot());
    if (!r.ok) {
      useUI.getState().open('ready');
      return;
    }
    shared.uOccOn.value = 0;
    this.sitting = null;
    this.action = null;
    this.ceremony.start(replay || useGame.getState().wedding.count > 0);
  }

  skipCeremony() {
    this.ceremony.skip();
  }

  abortCeremony() {
    this.ceremony.abort();
    shared.uOccOn.value = 1;
    useUI.getState().toast('예식을 멈추고 시작 전으로 돌아왔어요. 언제든 다시 시작할 수 있어요', 'info');
  }

  // ── 사진 ──
  enterPhoto() {
    const ui = useUI.getState();
    ui.close();
    ui.set({ mode: 'photo', photo: { pose: 'idle', expr: 'smile', frame: 'none', dof: useGame.getState().settings.dof ? 1 : 0, zoom: 4.2, last: null } });
    this.rig.orbitCenter.copy(this.playerPos);
    this.rig.orbitYaw = 0;
    this.rig.orbitPitch = 0.32;
    this.rig.orbitDist = 4.2;
    this.rig.mode = 'orbit';
    shared.uOccOn.value = 1;
    this.sound.open();
  }

  exitPhoto() {
    const ui = useUI.getState();
    ui.set({ mode: 'play', photo: null });
    this.player.setPose('idle');
    this.player.setExpr('normal', 0);
    this.partner.body.setPose('idle');
    this.rig.backToFollow();
    shared.uOccOn.value = 1;
    this.sound.close();
  }

  setPhotoPose(pose: string, expr: string) {
    this.player.setPose(pose as Pose);
    this.player.baseExpr = expr as FaceExpr;
    this.player.setExpr(expr as FaceExpr, 0);
    if (this.partner.pos.distanceTo(this.playerPos) < 3.5) {
      const pp = pose === 'heart' ? 'heart' : pose === 'peace' ? 'peace' : pose === 'wave' ? 'wave' : 'idle';
      this.partner.body.setPose(pp as Pose);
      this.partner.body.setExpr(expr as FaceExpr, 0);
    }
  }

  capturePhoto(): Promise<{ ok: boolean; id: string; thumb: string }> {
    return new Promise((resolve) => {
      const ui = useUI.getState();
      const frame = ui.photo?.frame || 'none';
      this.captureCbs.push((canvas) => {
        const rec = makePhotoFromCanvas(canvas, `${dayOf(this.clock)}일차 · ${useGame.getState().me.name}`, frame);
        this.sound.shutter();
        this.flash();
        void putPhoto(rec).then((ok) => {
          if (ok) {
            useGame.getState().addPhoto(rec.id);
            this.save('photo', false);
          }
          resolve({ ok, id: rec.id, thumb: rec.thumb });
        });
      });
    });
  }

  flash() {
    if (!useGame.getState().settings.flash) return;
    const el = this.flashEl;
    if (!el) return;
    el.style.transition = 'none';
    el.style.opacity = '0.85';
    requestAnimationFrame(() => {
      el.style.transition = 'opacity 420ms ease-out';
      el.style.opacity = '0';
    });
  }

  setFlashEl(el: HTMLElement | null) {
    this.flashEl = el;
  }

  // ── 저장 ──
  save(reason: string, force: boolean) {
    const now = performance.now();
    if (!force && now - this.lastSave < 1500) return;
    this.lastSave = now;
    const g = useGame.getState();
    if (!g.started) return;
    if (this.decorEditor.active || this.ceremony.active) {
      // 편집·예식 중엔 들어오기 전 상태가 이미 저장돼 있다
      if (reason !== 'ceremony-before') return;
    }
    g.setPose([this.playerPos.x, this.playerPos.z], this.playerDir);
    useGame.setState({ clock: this.clock });
    const ui = useUI.getState();
    ui.set({ saving: 'saving' });
    const r = saveGame(useGame.getState().snapshot());
    if (r.ok) {
      ui.set({ saving: 'saved', saveError: null });
      setTimeout(() => useUI.getState().saving === 'saved' && useUI.getState().set({ saving: 'idle' }), 1400);
    } else {
      ui.set({ saving: 'error', saveError: r.error || '저장하지 못했어요' });
    }
    void reason;
  }

  setTime(hour: number) {
    const day = Math.floor(this.clock / 1440);
    this.clock = day * 1440 + hour * 60;
    useGame.setState({ clock: this.clock });
    this.clockSynced = this.clock;
    this.syncFlowers(true);
    this.syncPlots();
  }

  // ── 타이틀(대표 장면) ──
  private titleShot(t: number) {
    if (!this.titleArch && !useGame.getState().decor.garden.some((p) => p.id === 'arch')) {
      this.titleArch = buildDecor('arch');
      this.titleArch.position.set(GARDEN.archSpot[0], 0, GARDEN.archSpot[1]);
      this.scene.add(this.titleArch);
    }
    // 꽃길 위의 아바타와 토끼 주민
    const ax = -0.55;
    const az = -9.8;
    this.playerPos.set(ax, 0, az);
    this.player.root.position.copy(this.playerPos);
    this.player.snapYaw(0.25);
    this.player.speed = 0;
    this.player.setPose(t % 9 < 4.5 ? 'wave' : 'idle');
    const so = this.residents.sodam;
    so.staged = true;
    so.pos.set(0.65, 0, -10.3);
    so.body.root.position.copy(so.pos);
    so.body.snapYaw(-0.35);
    so.body.speed = 0;
    so.body.setPose('idle');
    this.partner.staged = true;
    this.partner.pos.set(-1.4, 0, -10.8);
    this.partner.body.root.position.copy(this.partner.pos);
    this.partner.body.snapYaw(0.55);
    this.rig.setShot({ pos: v3(1.0 + Math.sin(t * 0.05) * 0.3, 3.4, -2.0), look: v3(-0.5, 0.6, -20), blend: 0, fov: 48 });
  }

  endTitle() {
    if (this.titleArch) {
      this.scene.remove(this.titleArch);
      this.titleArch = null;
    }
    this.residents.sodam.staged = false;
    this.residents.sodam.place(hourOf(this.clock));
    this.partner.staged = false;
    const s = useGame.getState();
    this.setPlayer(s.pos[0], s.pos[1], s.dir);
    this.partner.place(this.playerPos, this.playerDir);
    this.rig.backToFollow();
    this.rig.snapTo(this.playerPos);
  }

  // ── 루프 ──
  perf = { fps: 0, ms: 0, calls: 0, tris: 0, worst: 0 };
  private perfAcc = { n: 0, t: 0, worst: 0 };

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const raw = (now - this.last) / 1000;
    const dt = Math.min(0.05, raw);
    this.last = now;
    // 성능 기록(프레임 시간 · 순간 멈춤)
    this.perfAcc.n++;
    this.perfAcc.t += raw;
    this.perfAcc.worst = Math.max(this.perfAcc.worst, raw);
    if (this.perfAcc.t >= 1) {
      this.perf.fps = Math.round(this.perfAcc.n / this.perfAcc.t);
      this.perf.ms = +((this.perfAcc.t / this.perfAcc.n) * 1000).toFixed(1);
      this.perf.worst = +(this.perfAcc.worst * 1000).toFixed(0);
      this.perf.calls = this.renderer.info.render.calls;
      this.perf.tris = this.renderer.info.render.triangles;
      this.perfAcc = { n: 0, t: 0, worst: 0 };
    }
    try {
      this.update(dt, now);
      this.render();
    } catch (e) {
      console.error('[wedding-forest]', e);
    }
    this.input.endFrame();
  };

  private titleT = 0;
  private patchT = 0;
  private titleHour = (() => {
    const m = typeof window !== 'undefined' ? /[?&]hour=([\d.]+)/.exec(window.location.search) : null;
    const h = m ? Number(m[1]) : 10.5;
    return Number.isFinite(h) ? Math.max(0, Math.min(23.99, h)) : 10.5;
  })();

  private update(dt: number, now: number) {
    const ui = useUI.getState();
    const g = useGame.getState();
    shared.uTime.value += dt;
    // 시간
    const rate = 1440 / (g.settings.dayMinutes * 60);
    if (ui.screen === 'play') {
      this.clock += dt * rate;
      this.clockAcc += dt;
      if (this.clockAcc > 0.5) {
        const delta = this.clock - this.clockSynced;
        this.clockSynced = this.clock;
        useGame.getState().tick(delta, this.clockAcc);
        this.clockAcc = 0;
        this.syncFlowers(false);
        this.syncPlots();
      }
    }
    // 타이틀(대표 장면)은 기본 오전 10:30 — ?hour=17.8 처럼 주면 같은 구도로 다른 시간대(낮·노을·밤 비교용)
    const hour = ui.screen !== 'play' ? this.titleHour : hourOf(this.clock);
    if (ui.screen !== 'play') {
      this.titleT += dt;
      this.titleShot(this.titleT);
    }
    // 모드별
    if (ui.screen === 'play') {
      if (ui.mode === 'play') {
        this.updatePlayer(dt, now);
        if (!uiBlocking() && !(this.action && now < this.action.until)) {
          const t = this.pickTarget();
          if (t !== this.current) {
            this.current = t;
            ui.set({ hint: t ? { label: t.label() || '', key: 'E' } : null });
          } else if (t) {
            const lab = t.label() || '';
            if (ui.hint?.label !== lab) ui.set({ hint: { label: lab, key: 'E' } });
          }
          if (this.current && now > this.interactCooldown && this.input.takeAction()) this.interact(this.current);
        } else if (this.current && (uiBlocking() || this.action)) {
          this.current = null;
          ui.set({ hint: null });
        }
      } else if (ui.mode === 'decor') {
        this.updatePlayer(dt, now);
        this.decorEditor.update(dt, this.input, this.rig.camera, { place: () => this.sound.place(), rotate: () => this.sound.rotate(), error: () => this.sound.error() });
        if (this.current) {
          this.current = null;
          ui.set({ hint: null });
        }
      } else if (ui.mode === 'photo') {
        this.updatePhotoControls(dt);
        this.player.speed = 0;
        this.player.setYaw(this.playerDir, dt);
        this.player.animate(dt, now);
        if (this.current) {
          this.current = null;
          ui.set({ hint: null });
        }
      } else if (ui.mode === 'ceremony') {
        this.ceremony.update(dt, now);
        this.player.animate(dt, now);
        if (this.current) {
          this.current = null;
          ui.set({ hint: null });
        }
      }
    } else {
      this.player.animate(dt, now);
    }
    // 파트너 · 주민
    const others = [this.playerPos, this.partner.pos];
    if (ui.screen === 'play') this.partner.update(dt, now, this.playerPos, this.playerDir, this.playerVel, this.col, this.rig.camera);
    else this.partner.body.animate(dt, now);
    for (const r of Object.values(this.residents)) {
      if (r.staged && ui.mode !== 'ceremony') {
        r.body.animate(dt, now);
        continue;
      }
      r.update(dt, now, hour, this.playerPos, this.col, others);
    }
    // 흔들 나무·꽃 피어나기·장식 움직임
    for (const tr of this.trees.values()) {
      if (tr.wobble > 0) {
        tr.wobble = Math.max(0, tr.wobble - dt * 1.6);
        tr.crown.rotation.z = Math.sin(tr.wobble * 30) * 0.06 * tr.wobble;
        tr.crown.rotation.x = Math.cos(tr.wobble * 26) * 0.04 * tr.wobble;
      }
    }
    for (const f of this.flowers.values()) {
      const target = f.shown ? 1 : 0;
      if (f.pop !== target) {
        f.pop += (target - f.pop) * Math.min(1, dt * (target ? 5 : 12));
        if (Math.abs(f.pop - target) < 0.01) f.pop = target;
      }
      f.group.visible = f.pop > 0.02;
      f.group.scale.setScalar(Math.max(0.001, f.pop));
    }
    this.rareMat.emissiveIntensity = 0.15 + this.light.night * 1.2;
    const t = shared.uTime.value;
    for (const obj of this.decorObjs.values()) {
      obj.traverse((c) => {
        if (c.userData.ribbonTail) c.rotation.z = Math.sin(t * 2.4 + c.userData.ribbonTail) * 0.25 * c.userData.ribbonTail;
        if (c.userData.lanternGlow) ((c as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity = 0.35 + this.light.lampFactor * 2.6;
      });
    }
    // 우편함 흔들림
    this.build.mailbox.rotation.z = Math.sin(t * 1.6) * 0.015;
    // 하루가 바뀌면 약속의 나무
    if (Math.floor(this.clock / 1440) !== Math.floor((this.clock - dt * rate) / 1440)) this.syncPromise();
    // 빛·하늘
    this.light.update(hour, this.playerPos, true);
    (this.lakeMat.uniforms.fogColor.value as THREE.Color).copy(this.light.fog.color);
    this.lakeMat.uniforms.fogNear.value = this.light.fog.near;
    this.lakeMat.uniforms.fogFar.value = this.light.fog.far;
    this.lakeMat.uniforms.night.value = this.light.night;
    this.sound.setNight(this.light.night);
    this.particles.update(dt, t, this.light.night, this.playerPos);
    // 카메라
    this.rig.update(dt, this.playerPos, this.playerVel);
    this.updateOcclusion();
    this.updateMarker(dt);
    this.updateHint();
    this.updateZone();
    // 새로 생긴 물체(장식·연출)에도 둥근 땅 효과
    this.patchT += dt;
    if (this.patchT > 1) {
      this.patchT = 0;
      patchScene(this.scene);
    }
    // 연출·사진·꾸미기 땐 둥근 땅을 약하게(구도가 정확하게)
    const bendTarget = ui.mode === 'play' && ui.screen === 'play' ? 0.0105 : ui.mode === 'decor' ? 0.0035 : 0.005;
    bendU.uBend.value += (bendTarget - bendU.uBend.value) * Math.min(1, dt * 3);
    // 자동 저장(1분마다)
    if (ui.screen === 'play' && ui.mode === 'play' && now - this.lastAutosave > 60000) {
      this.lastAutosave = now;
      this.save('auto', false);
    }
  }

  private updatePhotoControls(dt: number) {
    const ui = useUI.getState();
    if (uiBlocking() && ui.mode !== 'photo') return;
    const k = this.input.keys;
    if (k.has('KeyA') || k.has('ArrowLeft')) this.rig.orbitYaw -= dt * 1.4;
    if (k.has('KeyD') || k.has('ArrowRight')) this.rig.orbitYaw += dt * 1.4;
    if (k.has('KeyW') || k.has('ArrowUp')) this.rig.orbitPitch = Math.min(1.25, this.rig.orbitPitch + dt * 0.8);
    if (k.has('KeyS') || k.has('ArrowDown')) this.rig.orbitPitch = Math.max(0.05, this.rig.orbitPitch - dt * 0.8);
    if (this.input.mouse.down || this.input.mouse.right) {
      this.rig.orbitYaw -= this.input.mouse.dragDX * 0.008;
      this.rig.orbitPitch = Math.max(0.05, Math.min(1.25, this.rig.orbitPitch + this.input.mouse.dragDY * 0.005));
    }
    if (this.input.joy.active) {
      this.rig.orbitYaw += this.input.joy.x * dt * 1.6;
      this.rig.orbitPitch = Math.max(0.05, Math.min(1.25, this.rig.orbitPitch - this.input.joy.y * dt));
    }
    if (this.input.mouse.wheel) {
      const z = Math.max(2.0, Math.min(9, (ui.photo?.zoom ?? 4.2) + this.input.mouse.wheel * 0.4));
      if (ui.photo) ui.set({ photo: { ...ui.photo, zoom: z } });
    }
    this.rig.orbitDist = ui.photo?.zoom ?? 4.2;
    this.rig.orbitCenter.copy(this.playerPos);
  }

  private updateOcclusion() {
    const cam = this.rig.camera;
    const ui = useUI.getState();
    // 대화 중엔 두 사람 사이를, 사진에선 두 사람을 함께 감싸도록 조금 크게
    const talk = this.rig.mode === 'talk';
    const photo = ui.mode === 'photo';
    const center = talk ? this.rig.talkCenter : photo ? this.playerPos.clone().lerp(this.partner.pos, this.partner.pos.distanceTo(this.playerPos) < 3 ? 0.5 : 0) : this.playerPos;
    const head = center.clone().add(v3(0, 0.6, 0));
    const view = head.clone().applyMatrix4(cam.matrixWorldInverse);
    const ndc = head.clone().project(cam);
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    shared.uOccPx.value.set(((ndc.x + 1) / 2) * size.x, ((ndc.y + 1) / 2) * size.y);
    shared.uOccZ.value = view.z;
    shared.uOccR.value = size.y * (talk || photo ? 0.24 : 0.15);
  }

  private markerTarget(): THREE.Vector3 | null {
    const g = useGame.getState();
    const id = currentQuestId(g);
    const q = QUESTS[id];
    if (!q || id === 'free') return null;
    if (q.target.resident) {
      const r = this.residents[q.target.resident];
      if (!r || r.staged) return null;
      return r.pos.clone().add(v3(0, 1.55, 0));
    }
    if (q.target.pos) return v3(q.target.pos[0], 1.6, q.target.pos[1]);
    return null;
  }

  private updateMarker(dt: number) {
    const ui = useUI.getState();
    const tgt = ui.screen === 'play' && ui.mode === 'play' ? this.markerTarget() : null;
    const show = !!tgt && tgt.distanceTo(this.playerPos) > 2.2;
    this.marker.visible = show;
    if (show && tgt) {
      const t = shared.uTime.value;
      this.marker.position.set(tgt.x, tgt.y + 0.25 + Math.sin(t * 3) * 0.08, tgt.z);
      this.marker.rotation.y += dt * 2;
    }
  }

  private updateHint() {
    const el = this.hintEl;
    if (!el) return;
    const t = this.current;
    const ui = useUI.getState();
    const show = !!t && ui.screen === 'play' && ui.mode === 'play' && !uiBlocking();
    if (show !== this.hintVisible) {
      this.hintVisible = show;
      el.style.opacity = show ? '1' : '0';
    }
    if (!show || !t) return;
    const p = t.pos().clone().add(v3(0, t.h, 0)).project(this.rig.camera);
    const x = ((p.x + 1) / 2) * this.container.clientWidth;
    const y = ((1 - p.y) / 2) * this.container.clientHeight;
    el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) translate(-50%, -100%)`;
  }

  private updateZone() {
    const ui = useUI.getState();
    if (ui.screen !== 'play' || ui.mode !== 'play') return;
    let best = '';
    let bd = Infinity;
    for (const z of ZONES) {
      const d = Math.hypot(this.playerPos.x - z.center[0], this.playerPos.z - z.center[1]);
      if (d < z.radius && d < bd) {
        bd = d;
        best = z.id;
      }
    }
    if (best && best !== this.zoneId) {
      this.zoneId = best;
      const z = ZONES.find((q) => q.id === best)!;
      ui.set({ zoneBanner: { name: z.name, at: performance.now() } });
      this.save('zone', false);
    } else if (!best) this.zoneId = '';
  }

  private render() {
    const ui = useUI.getState();
    const usePost = ui.mode === 'photo' && (ui.photo?.dof ?? 0) > 0 && useGame.getState().settings.dof;
    if (usePost) {
      if (!this.composer) {
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.rig.camera));
        this.bokeh = new BokehPass(this.scene, this.rig.camera, { focus: 4, aperture: 0.002, maxblur: 0.008 });
        this.composer.addPass(this.bokeh);
        this.composer.addPass(new OutputPass());
      }
      this.composer.setSize(this.container.clientWidth, this.container.clientHeight);
      const dist = this.rig.camera.position.distanceTo(this.playerPos.clone().add(v3(0, 0.6, 0)));
      const u = (this.bokeh as any).uniforms;
      u.focus.value = dist;
      u.aperture.value = 0.0012 * (ui.photo?.dof ?? 1);
      u.maxblur.value = 0.006 * (ui.photo?.dof ?? 1);
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.rig.camera);
    }
    if (this.captureCbs.length) {
      const cbs = this.captureCbs.splice(0);
      for (const cb of cbs) cb(this.renderer.domElement);
    }
  }

  private onResize = () => {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.rig.camera.aspect = w / Math.max(1, h);
    this.rig.fitAspect(this.rig.camera.aspect);
    this.rig.camera.updateProjectionMatrix();
    this.composer?.setSize(w, h);
  };

  private onVisibility = () => {
    if (document.visibilityState === 'hidden') this.save('hidden', true);
    this.last = performance.now();
  };

  private onPageHide = () => {
    this.save('pagehide', true);
  };

  startAudio() {
    this.sound.start();
    this.applySettings();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('pagehide', this.onPageHide);
    this.unsub.forEach((f) => f());
    this.input.dispose();
    this.sound.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    if (engineRef.current === this) engineRef.current = null;
  }
}

void ITEMS;
void SPAWN;
void dampAngle;
void (null as unknown as DNode);
