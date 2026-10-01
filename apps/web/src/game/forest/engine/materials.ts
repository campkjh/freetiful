// 공용 재질 + 셰이더 주입.
//  · 가림 처리: 카메라와 아바타 사이에 있는 물체만 아바타 주변 원 안에서 디더로 비워 보이게(조상 투명도 없이 셰이더에서).
//  · 바람: 잎·풀·꽃은 밑동을 고정하고 위쪽만 같은 방향으로 흔들린다.
//  · 테두리 빛(캐릭터): 배경에서 실루엣이 분리되도록 아주 약한 역광.
import * as THREE from 'three';

export const shared = {
  uTime: { value: 0 },
  uWind: { value: 1 },
  uOccPx: { value: new THREE.Vector2(-9999, -9999) },
  uOccZ: { value: 0 },
  uOccR: { value: 130 },
  uOccOn: { value: 1 },
  /** 카메라 바로 앞 물체 비우기(미터) — 대화·사진에서 카메라가 나무 수관 뒤로 들어가도 막히지 않게 */
  uNearFade: { value: 2.6 },
  uRim: { value: new THREE.Color(0.1, 0.09, 0.07) },
};

const OCC_HEAD = /* glsl */ `
uniform vec2 uOccPx; uniform float uOccZ; uniform float uOccR; uniform float uOccOn; uniform float uNearFade; varying float vOccZ;
float wfBayer(vec2 p){
  int i = int(p.x) + int(p.y) * 4;
  float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
  return (m[i] + 0.5) / 16.0;
}
`;
const OCC_FRAG = /* glsl */ `
if (-vOccZ < uNearFade) {
  // 가까울수록 완전히 비운다(1.04 배 — 맨 끝 칸까지 지워 점무늬가 남지 않게)
  float nearT = 1.0 - smoothstep(uNearFade * 0.45, uNearFade, -vOccZ);
  if (wfBayer(mod(floor(gl_FragCoord.xy), 4.0)) < nearT * 1.04) discard;
}
if (uOccOn > 0.5 && vOccZ > uOccZ + 0.9) {
  float occD = distance(gl_FragCoord.xy, uOccPx);
  float occT = 1.0 - smoothstep(uOccR * 0.5, uOccR, occD);
  if (occT > 0.0 && wfBayer(mod(floor(gl_FragCoord.xy), 4.0)) < occT * 0.86) discard;
}
`;

const SWAY_HEAD = /* glsl */ `uniform float uTime; uniform float uWind; uniform float uSwayBase; uniform float uSwayAmp;`;
const SWAY_VERT = /* glsl */ `
#ifdef USE_INSTANCING
  vec2 swayO = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz;
#else
  vec2 swayO = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz;
#endif
float swayPh = swayO.x * 0.35 + swayO.y * 0.27;
float swayH = max(0.0, transformed.y - uSwayBase) * uSwayAmp * uWind;
transformed.x += sin(uTime * 1.3 + swayPh) * swayH;
transformed.z += cos(uTime * 1.05 + swayPh * 1.3) * swayH * 0.6;
`;

export interface MatOpts {
  rough?: number;
  metal?: number;
  occlude?: boolean;
  sway?: { base: number; amp: number };
  rim?: boolean;
  transparent?: boolean;
  opacity?: number;
  emissive?: string;
  emissiveIntensity?: number;
  side?: THREE.Side;
  vertexColors?: boolean;
  flat?: boolean;
  map?: THREE.Texture | null;
  depthWrite?: boolean;
}

const cache = new Map<string, THREE.MeshStandardMaterial>();

export function applyInjections(m: THREE.MeshStandardMaterial, o: MatOpts) {
  const occ = !!o.occlude;
  const sway = o.sway;
  const rim = !!o.rim;
  if (!occ && !sway && !rim) return;
  m.onBeforeCompile = (shader) => {
    if (occ) {
      shader.uniforms.uOccPx = shared.uOccPx;
      shader.uniforms.uOccZ = shared.uOccZ;
      shader.uniforms.uOccR = shared.uOccR;
      shader.uniforms.uOccOn = shared.uOccOn;
      shader.uniforms.uNearFade = shared.uNearFade;
      shader.vertexShader = 'varying float vOccZ;\n' + shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvOccZ = mvPosition.z;');
      shader.fragmentShader = OCC_HEAD + shader.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + OCC_FRAG);
    }
    if (sway) {
      shader.uniforms.uTime = shared.uTime;
      shader.uniforms.uWind = shared.uWind;
      shader.uniforms.uSwayBase = { value: sway.base };
      shader.uniforms.uSwayAmp = { value: sway.amp };
      shader.vertexShader = SWAY_HEAD + '\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + SWAY_VERT);
    }
    if (rim) {
      shader.uniforms.uRim = shared.uRim;
      shader.fragmentShader = 'uniform vec3 uRim;\n' + shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\nfloat rimF = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.4);\ntotalEmissiveRadiance += uRim * rimF;',
      );
    }
  };
  m.customProgramCacheKey = () => `wf${occ ? 'o' : ''}${sway ? `s${sway.base}_${sway.amp}` : ''}${rim ? 'r' : ''}`;
}

/** 같은 색·옵션이면 같은 재질을 나눠 쓴다(그리기 상태 전환 줄이기) */
export function mat(color: string | number, o: MatOpts = {}): THREE.MeshStandardMaterial {
  const key = JSON.stringify([color, o.rough, o.metal, !!o.occlude, o.sway, !!o.rim, !!o.transparent, o.opacity, o.emissive, o.emissiveIntensity, o.side, !!o.vertexColors, !!o.flat, o.map ? o.map.uuid : null, o.depthWrite]);
  const hit = cache.get(key);
  if (hit) return hit;
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color as any),
    roughness: o.rough ?? 0.9,
    metalness: o.metal ?? 0,
    transparent: !!o.transparent,
    opacity: o.opacity ?? 1,
    side: o.side ?? THREE.FrontSide,
    vertexColors: !!o.vertexColors,
    flatShading: !!o.flat,
    map: o.map ?? null,
  });
  if (o.emissive) {
    m.emissive = new THREE.Color(o.emissive);
    m.emissiveIntensity = o.emissiveIntensity ?? 1;
  }
  if (o.depthWrite === false) m.depthWrite = false;
  applyInjections(m, o);
  cache.set(key, m);
  return m;
}

/** 캐릭터용 재질(캐릭터마다 색을 바꿀 수 있게 새로 만든다) */
export function charMat(color: string, rough = 0.85): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: rough, metalness: 0 });
  applyInjections(m, { rim: true });
  return m;
}

/** 캔버스 글자 텍스처(표지판·이름표) */
export function textTexture(lines: string[], opts: { w?: number; h?: number; bg?: string; fg?: string; font?: number; weight?: number; radius?: number; border?: string } = {}): THREE.CanvasTexture {
  const w = opts.w ?? 512;
  const h = opts.h ?? 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  if (opts.bg) {
    g.fillStyle = opts.bg;
    const r = opts.radius ?? 36;
    g.beginPath();
    g.moveTo(r, 0);
    g.arcTo(w, 0, w, h, r);
    g.arcTo(w, h, 0, h, r);
    g.arcTo(0, h, 0, 0, r);
    g.arcTo(0, 0, w, 0, r);
    g.closePath();
    g.fill();
    if (opts.border) {
      g.lineWidth = 10;
      g.strokeStyle = opts.border;
      g.stroke();
    }
  }
  g.fillStyle = opts.fg ?? '#4A3626';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const size = opts.font ?? 64;
  lines.forEach((t, i) => {
    const fs = i === 0 ? size : size * 0.62;
    g.font = `${i === 0 ? opts.weight ?? 800 : 600} ${fs}px Pretendard, 'Apple SD Gothic Neo', sans-serif`;
    const y = h / 2 + (i - (lines.length - 1) / 2) * size * 0.95;
    g.fillText(t, w / 2, y);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** 발밑 접촉 그림자(부드러운 원) */
let blobTex: THREE.Texture | null = null;
export function blobShadowTexture(): THREE.Texture {
  if (blobTex) return blobTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grd.addColorStop(0, 'rgba(30,40,25,0.55)');
  grd.addColorStop(0.55, 'rgba(30,40,25,0.25)');
  grd.addColorStop(1, 'rgba(30,40,25,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  blobTex = new THREE.CanvasTexture(c);
  return blobTex;
}

export function blobShadow(size: number, opacity = 1): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false, opacity, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  m.renderOrder = 1;
  return m;
}
