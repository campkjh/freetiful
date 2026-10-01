// 둥근 땅(굴러가는 통나무) 효과 — 카메라에서 멀수록 화면에서 아래로 휘게 해 먼 나무 꼭대기와 하늘이 보이게.
// 최종 화면 위치(gl_Position)만 바꾸므로 그림자·조명 계산은 그대로(그림자가 물체에서 떨어지지 않는다).
import * as THREE from 'three';

export const bendU = {
  uBendStart: { value: 7.0 },
  uBend: { value: 0.0105 },
};

const BEND = /* glsl */ `
{
  float bendD = max(0.0, -mvPosition.z - uBendStart);
  vec4 bentP = mvPosition;
  bentP.y -= bendD * bendD * uBend;
  gl_Position = projectionMatrix * bentP;
}
`;

export const BEND_HEAD = 'uniform float uBendStart;\nuniform float uBend;\n';
export const BEND_CHUNK = BEND;

/** 재질에 휘기 주입(기존 onBeforeCompile 과 이어서) */
export function patchMaterial(m: THREE.Material) {
  if ((m as any).userData?.bend || (m as any).userData?.noBend) return;
  if ((m as THREE.ShaderMaterial).isShaderMaterial || (m as THREE.SpriteMaterial).isSpriteMaterial) return;
  m.userData = { ...(m.userData || {}), bend: true };
  const prev = m.onBeforeCompile?.bind(m);
  const prevKey = m.customProgramCacheKey?.bind(m);
  m.onBeforeCompile = (shader, renderer) => {
    if (prev) prev(shader, renderer);
    if (!shader.vertexShader.includes('#include <project_vertex>')) return;
    shader.uniforms.uBendStart = bendU.uBendStart;
    shader.uniforms.uBend = bendU.uBend;
    shader.vertexShader = BEND_HEAD + shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n' + BEND);
  };
  m.customProgramCacheKey = () => (prevKey ? prevKey() : '') + '|bend';
  m.needsUpdate = true;
}

/** 장면 전체(새로 생긴 물체 포함) — 아직 안 붙은 재질만.
 *  휘어 보이는 위치는 원래 절두체 밖일 수 있어, 큰 물체는 화면 밖 판정(culling)을 끈다(작은 꽃·화단은 keepCull 로 유지). */
export function patchScene(root: THREE.Object3D, keep = false) {
  for (const o of root.children) {
    if ((o as any).userData?.noBend) continue;
    const k = keep || !!o.userData?.keepCull;
    const mesh = o as THREE.Mesh;
    const mm = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (mm) {
      if (Array.isArray(mm)) mm.forEach(patchMaterial);
      else patchMaterial(mm);
      if (!k && (mesh as any).isMesh) mesh.frustumCulled = false;
    }
    if (o.children.length) patchScene(o, k);
  }
}
