// 하늘·빛·안개 — 태양 주광 1개 + 하늘 환경광. 아침 살구빛·얇은 안개 / 낮 맑은 초록 / 노을 금빛 측면광 / 밤 청록 환경광 + 따뜻한 전구.
// 시간대 사이는 노출과 색이 부드럽게 이어지도록 보간한다.
import * as THREE from 'three';
import { shared } from './materials';

interface Key {
  h: number;
  top: string;
  hor: string;
  sun: string;
  sunI: number;
  hs: string; // 반구광 하늘
  hg: string; // 반구광 땅
  hI: number;
  fog: string;
  near: number;
  far: number;
  exp: number;
  rim: string;
  rimI: number;
  lamps: number;
  stars: number;
}

const NIGHT: Omit<Key, 'h'> = { top: '#0D2236', hor: '#24505F', sun: '#9CC7D6', sunI: 0.5, hs: '#2F5E6B', hg: '#1A2A23', hI: 0.62, fog: '#1D3B45', near: 20, far: 78, exp: 1.05, rim: '#3B8494', rimI: 0.22, lamps: 1, stars: 1 };

const KEYS: Key[] = [
  { h: 0, ...NIGHT },
  { h: 4.6, ...NIGHT },
  { h: 6.0, top: '#7F9DC0', hor: '#F4C6A2', sun: '#FFB48C', sunI: 0.95, hs: '#C8D6E4', hg: '#6E7E5A', hI: 0.62, fog: '#EDD3C1', near: 18, far: 80, exp: 0.98, rim: '#F4B48C', rimI: 0.16, lamps: 0.45, stars: 0.15 },
  { h: 8.0, top: '#94C2DE', hor: '#EDE9DB', sun: '#FFE5C6', sunI: 2.0, hs: '#D7E6EE', hg: '#7D9862', hI: 0.78, fog: '#F0E7D9', near: 24, far: 92, exp: 1.0, rim: '#FFE4CC', rimI: 0.1, lamps: 0, stars: 0 },
  { h: 12, top: '#7DBBE2', hor: '#D3EBF0', sun: '#FFF6EA', sunI: 2.55, hs: '#DCEEF6', hg: '#86A568', hI: 0.92, fog: '#DAEAEA', near: 38, far: 118, exp: 1.0, rim: '#FFFFFF', rimI: 0.08, lamps: 0, stars: 0 },
  { h: 15.5, top: '#86BEDF', hor: '#E1ECE6', sun: '#FFF0DC', sunI: 2.3, hs: '#DFE9EC', hg: '#86A066', hI: 0.86, fog: '#E2E9E3', near: 34, far: 110, exp: 1.0, rim: '#FFF2E2', rimI: 0.09, lamps: 0, stars: 0 },
  { h: 17.6, top: '#7E9CC8', hor: '#F7B884', sun: '#FFAD69', sunI: 1.85, hs: '#E8C8B4', hg: '#7A6E50', hI: 0.64, fog: '#F2C8A4', near: 26, far: 98, exp: 1.03, rim: '#FFB27A', rimI: 0.2, lamps: 0.35, stars: 0 },
  { h: 19.0, top: '#3E4E7E', hor: '#CF8D8B', sun: '#FF9D84', sunI: 0.6, hs: '#7D7EA0', hg: '#393B34', hI: 0.55, fog: '#7C6878', near: 22, far: 84, exp: 1.02, rim: '#C88CA4', rimI: 0.2, lamps: 1, stars: 0.35 },
  { h: 20.6, ...NIGHT },
  { h: 24, ...NIGHT },
];

const ca = new THREE.Color();
const cb = new THREE.Color();
function mixHex(a: string, b: string, t: number, out: THREE.Color) {
  ca.set(a);
  cb.set(b);
  return out.copy(ca).lerp(cb, t);
}

export class DayNight {
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  sky: THREE.Mesh;
  stars: THREE.Points;
  fog: THREE.Fog;
  lampFactor = 0;
  night = 0;
  hour = 9;
  private skyMat: THREE.ShaderMaterial;
  private renderer: THREE.WebGLRenderer;
  private shadowSize = 2048;
  lamps: THREE.PointLight[] = [];
  emissives: Array<{ m: THREE.MeshStandardMaterial; base: number }> = [];

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer, quality: 'high' | 'low') {
    this.renderer = renderer;
    this.shadowSize = quality === 'high' ? 2048 : 1024;
    this.hemi = new THREE.HemisphereLight('#DCEEF6', '#86A568', 0.9);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#FFF6EA', 2.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(this.shadowSize, this.shadowSize);
    const sc = this.sun.shadow.camera;
    sc.left = -19;
    sc.right = 19;
    sc.top = 19;
    sc.bottom = -19;
    sc.near = 1;
    sc.far = 90;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.025;
    this.sun.shadow.radius = 3;
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.fog = new THREE.Fog('#DAEAEA', 38, 118);
    scene.fog = this.fog;
    // 하늘 돔
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { top: { value: new THREE.Color('#8CC2E0') }, hor: { value: new THREE.Color('#DBEEF1') }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color('#FFF6EA') }, sunVis: { value: 1 } },
      vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w; }`,
      fragmentShader: /* glsl */ `uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; uniform float sunVis; varying vec3 vDir;
        void main(){
          float y = clamp(vDir.y, -0.2, 1.0);
          float t = pow(clamp(y, 0.0, 1.0), 0.38);
          vec3 col = mix(hor, top, t);
          float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
          col += sunCol * (pow(s, 600.0) * 1.2 + pow(s, 12.0) * 0.18) * sunVis;
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.skyMat.userData.noBend = true;
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), this.skyMat);
    this.sky.userData.noBend = true;
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    scene.add(this.sky);
    // 별
    const starGeo = new THREE.BufferGeometry();
    const n = 420;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * Math.PI * 2;
      const v = Math.acos(1 - Math.random() * 0.95);
      pos[i * 3] = Math.sin(v) * Math.cos(u) * 280;
      pos[i * 3 + 1] = Math.cos(v) * 280;
      pos[i * 3 + 2] = Math.sin(v) * Math.sin(u) * 280;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#FFF6DA', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.stars.frustumCulled = false;
    this.stars.userData.noBend = true;
    scene.add(this.stars);
    // 구름 — 멀리 둥근 덩어리(시간대 색을 따라감)
    this.clouds = new THREE.Group();
    this.cloudMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF', fog: false, transparent: true, opacity: 0.92, depthWrite: false });
    const blobGeo = new THREE.SphereGeometry(1, 14, 10);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + Math.sin(i * 7.3) * 0.2;
      const d = 170 + Math.sin(i * 3.1) * 30;
      const c = new THREE.Group();
      const n = 4 + (i % 3);
      for (let k = 0; k < n; k++) {
        const m = new THREE.Mesh(blobGeo, this.cloudMat);
        const s = 9 + Math.sin(i * 5 + k * 2) * 3;
        m.scale.set(s * 1.4, s * 0.62, s);
        m.position.set((k - n / 2) * 9 + Math.sin(k * 3.7) * 3, Math.sin(k * 2.3) * 2.5, Math.cos(k * 1.9) * 4);
        c.add(m);
      }
      c.position.set(Math.cos(a) * d, 46 + Math.sin(i * 1.7) * 12, Math.sin(a) * d);
      c.lookAt(0, c.position.y, 0);
      c.renderOrder = -9;
      this.clouds.add(c);
    }
    this.clouds.traverse((o) => (o.frustumCulled = false));
    this.clouds.userData.noBend = true;
    scene.add(this.clouds);
  }
  clouds: THREE.Group;
  private cloudMat: THREE.MeshBasicMaterial;

  addLamp(scene: THREE.Scene, x: number, y: number, z: number, color = '#FFC58A', distance = 11) {
    const l = new THREE.PointLight(color, 0, distance, 1.6);
    l.position.set(x, y, z);
    scene.add(l);
    this.lamps.push(l);
    return l;
  }

  registerEmissive(m: THREE.MeshStandardMaterial, base = 1.6) {
    this.emissives.push({ m, base });
  }

  setQuality(q: 'high' | 'low') {
    // 낮음: 그림자 거리(범위)·해상도부터 줄인다(제작 프롬프트 15쪽 저품질 순서)
    const r = q === 'high' ? 19 : 12;
    const sc = this.sun.shadow.camera;
    sc.left = -r;
    sc.right = r;
    sc.top = r;
    sc.bottom = -r;
    sc.updateProjectionMatrix();
    const size = q === 'high' ? 2048 : 1024;
    if (size !== this.shadowSize) {
      this.shadowSize = size;
      this.sun.shadow.mapSize.set(size, size);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null as any;
    }
  }

  update(hour: number, focus: THREE.Vector3, sky: boolean) {
    this.hour = hour;
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].h <= hour) i++;
    const a = KEYS[i];
    const b = KEYS[i + 1];
    const t = THREE.MathUtils.smoothstep(hour, a.h, b.h);
    const lerp = (x: number, y: number) => x + (y - x) * t;
    // 태양/달 방향
    const day = hour > 5.4 && hour < 19.2;
    const dir = new THREE.Vector3();
    if (day) {
      const ang = ((hour - 6) / 12) * Math.PI;
      dir.set(Math.cos(ang) * 0.9, Math.max(0.16, Math.sin(ang)) * 1.0 + 0.08, 0.62).normalize();
    } else {
      dir.set(-0.35, 0.85, 0.5).normalize();
    }
    mixHex(a.sun, b.sun, t, this.sun.color);
    this.sun.intensity = lerp(a.sunI, b.sunI);
    this.sun.position.copy(focus).addScaledVector(dir, 40);
    this.sun.target.position.copy(focus);
    mixHex(a.hs, b.hs, t, this.hemi.color);
    mixHex(a.hg, b.hg, t, this.hemi.groundColor);
    this.hemi.intensity = lerp(a.hI, b.hI);
    mixHex(a.fog, b.fog, t, this.fog.color);
    this.fog.near = lerp(a.near, b.near);
    this.fog.far = lerp(a.far, b.far);
    this.renderer.toneMappingExposure = lerp(a.exp, b.exp);
    mixHex(a.top, b.top, t, this.skyMat.uniforms.top.value);
    mixHex(a.hor, b.hor, t, this.skyMat.uniforms.hor.value);
    this.skyMat.uniforms.sunDir.value.copy(dir);
    this.skyMat.uniforms.sunCol.value.copy(this.sun.color);
    this.skyMat.uniforms.sunVis.value = day ? 1 : 0.35;
    mixHex(a.rim, b.rim, t, shared.uRim.value).multiplyScalar(lerp(a.rimI, b.rimI));
    this.lampFactor = lerp(a.lamps, b.lamps);
    this.night = lerp(a.stars, b.stars);
    (this.stars.material as THREE.PointsMaterial).opacity = this.night * 0.9;
    this.sky.visible = sky;
    this.stars.visible = sky && this.night > 0.02;
    this.sky.position.copy(focus);
    this.stars.position.copy(focus);
    this.clouds.position.set(focus.x, 0, focus.z);
    this.clouds.rotation.y += 0.00004;
    // 구름 색: 낮 흰색 · 노을 살구 · 밤 짙은 청회색
    mixHex('#FFFFFF', '#F6C9A8', THREE.MathUtils.clamp(1 - Math.abs(hour - 18) / 2.2, 0, 1) * (day ? 1 : 0), this.cloudMat.color);
    this.cloudMat.color.lerp(new THREE.Color('#3A5466'), this.night * 0.85);
    this.cloudMat.opacity = 0.92 - this.night * 0.4;
    this.clouds.visible = sky;
    for (const l of this.lamps) l.intensity = this.lampFactor * 9;
    for (const e of this.emissives) e.m.emissiveIntensity = e.base * this.lampFactor;
  }
}
