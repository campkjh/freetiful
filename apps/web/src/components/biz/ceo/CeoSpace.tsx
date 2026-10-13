'use client';

import { useEffect, useRef, type MutableRefObject } from 'react';

/*
 * CEO 첫 장면 · 대표 한마디('검증되지 않은 사람은 연결하지 않는다') 뒤 우주 배경
 * (261013 사장 '서나웅 뒤에 배경은 내가 첨부한 이미지처럼 — 마치 우주 배경처럼, 완전 동일하게').
 * 궤도에서 본 밤 — 남흑색 하늘 · 드문 잔별(몇 개만 밝게, 아주 천천히 반짝 · 흐름) · 작은 회색 달(바다 무늬 · 또렷한 테두리 · 옅은 빛무리) ·
 * 오른쪽 위에서 비스듬히 내려오는 빛줄기(넓은 띠 둘 — 왼쪽 가장자리가 또렷한 주 띠 + 옆 띠, 왼쪽에 가는 실선 둘 — 가는 결, 천천히 일렁임) ·
 * 아래 둥근 지구 가장자리(얇게 빛나는 대기선 · 위로 번지는 푸른 안개 · 천천히 흐르는 구름 낀 어두운 파란 땅).
 * 맨 WebGL 조각 셰이더 한 장으로 그린다(사진 · 외부 이미지 · 내려받기 없음 — 견본은 남의 작품이라 색 · 밝기 곡선만 재어 새로 그림).
 * 하늘 · 땅의 세로 밝기는 견본에서 잰 값(아래 SKY · GROUND)을 256칸 표(LUT 텍스처)로 한 번 올려 그대로 따른다 — 지수 곡선 맞추기로는 오차가 18/255 였다.
 * 땅은 겹겹이 능선 4줄(먼 줄일수록 옅고 가까울수록 진함 — 능선 바로 아래가 가장 어둡다) + 구름 · 땅 얼룩(아래쪽은 갈보랏빛) — 평균은 표 밝기 그대로.
 * 구도(지평선 높이 · 달 · 빛줄기 모이는 점)는 판마다 JS 가 정한다 — 넓은 판(데스크톱 무대 · 768px 이상 태블릿 16:10 카드)은 대표가 오른쪽 가운데에 서므로
 *   달은 머리 왼쪽 위 빈 하늘, 빛줄기는 머리 오른쪽으로 내려와 어깨 뒤로 모인다(얼굴 둘레는 비움). 세로로 긴 폰 카드는 달 왼쪽 위 · 빛줄기 오른쪽 위.
 *   판 고르기는 CSS 그림(.cx-space)과 같은 조건이라 첫 장이 나타날 때 달 · 지평선이 옮겨 가지 않는다(261013 검토).
 *   한마디 자리(데스크톱 왼쪽 · 폰 아래)는 견본처럼 하늘 · 땅이 어두워 글이 읽힌다(CSS 그늘은 옅게).
 * 아끼는 장치는 CeoSilk 와 같다 — 해상도를 줄여 그리고(데스크톱 css px 당 0.6 × 화면배율 · 최대 1.5배, 단 0.75 아래로는 안 내림(잔별이 뭉개짐) ·
 *   터치 카드는 화면배율 × 0.75(최대 1.5배 · 터치는 한 장 56만 픽셀까지 — 폰 카드는 데스크톱의 1/3) · 터치 무대(iPad 가로)는 0.75), 화면 밖 · 탭 숨김이면 rAF 멈춤, 데스크톱 초당 60장 · 터치 30장,
 *   움직임 줄이기 · highp 없는 옛 GPU 면 한 장만. 컨텍스트는 화면 800px 안으로 다가올 때 만들고, 셰이더는 KHR_parallel_shader_compile 이 있으면
 *   기다리는 동안 메인 스레드를 막지 않는다(첫 장면 열림 애니메이션과 겹치지 않게). 첫 장이 그려져야 캔버스가 서서히 나타나고, 그 전 ·
 *   WebGL 없음 · 컨텍스트 잃음이면 상자의 CSS 그림(.cx-space — 견본 세로 밝기 그대로의 하늘 · 대기선 · 땅 + 달 점 + 빛줄기 띠)이 보인다.
 * 데스크톱 창은 작은 둥근 창 → 화면 가득으로 clip-path 만 바뀌므로 캔버스는 처음부터 무대 전체 크기(진행 중 크기 바뀜 · 다시 그림 없음).
 * motion(0~1, 선택)을 주면 스크롤 따라 지평선이 살짝 올라오고 별 · 달 · 빛줄기가 덜 움직인다(시차 — 지운 'Freetiful' 큰 글자 시차 대신).
 * 캔버스는 붙을 때마다 새로 만들고 떨어질 때 컨텍스트를 바로 돌려준다(loseContext — CeoSilk 와 같은 이유).
 */

const VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}';

const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 uRes;
uniform float uTime;
uniform float uPx;
uniform vec4 uHz;
uniform vec4 uMoon;
uniform vec4 uBeam;
uniform sampler2D uLut;
float h12(vec2 p){ vec3 q = fract(vec3(p.xyx)*0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y)*q.z); }
vec2 h22(vec2 p){ vec3 q = fract(vec3(p.xyx)*vec3(0.1031, 0.1030, 0.0973)); q += dot(q, q.yzx + 33.33); return fract((q.xx + q.yz)*q.zy); }
float vn(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0 - 2.0*f);
  return mix(mix(h12(i), h12(i + vec2(1.0, 0.0)), f.x), mix(h12(i + vec2(0.0, 1.0)), h12(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p){ float s = 0.0; float a = 0.5; for (int i = 0; i < 5; i++){ s += a*vn(p); p = mat2(1.6, 1.2, -1.2, 1.6)*p + vec2(3.1, 1.7); a *= 0.5; } return s; }
vec3 stars(vec2 p, float cells, float keep, float b0, float b1, float rad, float t, float seed){
  vec2 g = p*cells; vec2 id = floor(g);
  float r = h12(id + seed);
  if (r > keep) return vec3(0.0);
  r /= keep;
  vec2 d = (fract(g) - 0.18 - 0.64*h22(id + seed*1.7))/cells;
  float b = mix(b0, b1, r*r);
  float tw = 0.72 + 0.28*sin(t*(0.35 + 1.1*fract(r*31.7)) + r*60.0);
  vec3 tint = mix(vec3(0.78, 0.86, 1.0), vec3(1.0, 0.96, 0.9), fract(r*7.13));
  return tint*b*tw*exp(-dot(d, d)/(rad*rad));
}
float ridge(float x){ return 0.5*vn(vec2(x, 0.5)) + 0.3*vn(vec2(x*2.3, 3.5)) + 0.2*vn(vec2(x*5.1, 6.5)); }
float g1(float a, float c, float w){ float k = (a - c)/w; return exp(-0.5*k*k); }
float beams(vec2 p, float t){
  vec2 d = p - uBeam.xy;
  float a = atan(d.x, d.y) - uBeam.z;
  float L = length(d);
  float sp = 1.0 + 0.7*(1.0 - smoothstep(0.3, 0.62, L)); // 끝점이 뒤집힌 smoothstep 은 명세상 정의되지 않음(261013 검토)
  float s = (0.6*g1(a, 0.284, 0.016*sp) + 0.6*g1(a, 0.304, 0.016*sp) + 0.45*g1(a, 0.2715, 0.0032*sp))*(0.9 + 0.1*sin(t*0.31))
          + 0.5*g1(a, 0.355, 0.022*sp)*(0.85 + 0.15*sin(t*0.23 + 2.0))
          + 0.34*g1(a, 0.218, 0.0019*sp)*(0.8 + 0.2*sin(t*0.41 + 4.0))
          + 0.16*g1(a, 0.246, 0.0016*sp)*(0.8 + 0.2*sin(t*0.37 + 1.0))
          + 0.12*g1(a, 0.300, 0.085);
  float fil = 0.82 + 0.14*vn(vec2(a*120.0 + t*0.03, L*1.1)) + 0.09*vn(vec2(a*360.0 - t*0.05, L*2.2 + 7.0));
  return s*fil/mix(1.0, sp, 0.6);
}
void main(){
  vec2 uv = gl_FragCoord.xy/uRes;
  float asp = uRes.x/uRes.y;
  vec2 p = vec2(uv.x*asp, uv.y);
  float t = uTime;
  float sh = uHz.w;
  float dx = p.x - uHz.y;
  float h = p.y - (uHz.x - uHz.z*dx*dx + sh*0.026);
  vec3 col;
  if (h >= 0.0) {
    col = texture2D(uLut, vec2(sqrt(min(h, 1.0)), 0.25)).rgb;
    col += vec3(0.0, 0.022, 0.07)*smoothstep(0.42, 1.0, uv.x)*exp(-h/0.3);
    vec2 sp = p + vec2(t*0.0011, -sh*0.012);
    float px = uPx;
    vec3 st = stars(sp, 6.0, 0.30, 0.45, 1.05, px*1.25, t, 1.0)
            + stars(sp, 14.0, 0.30, 0.10, 0.42, px*0.95, t, 7.0)
            + stars(sp, 30.0, 0.35, 0.03, 0.13, px*0.85, t, 13.0);
    col += st*smoothstep(0.02, 0.32, h);
    vec2 m = (p - uMoon.xy - vec2(0.0, sh*0.014))/uMoon.z;
    float r2 = dot(m, m);
    if (r2 < 9.0) {
      float rr = sqrt(r2);
      col += vec3(0.62, 0.70, 0.90)*(0.08*exp(-max(rr - 1.0, 0.0)*1.6) + 0.10*exp(-max(rr - 1.0, 0.0)*6.0));
      if (rr < 1.2) {
        float e = 1.5*uPx/uMoon.z;
        float on = 1.0 - smoothstep(1.0 - e, 1.0 + e, rr);
        vec3 n = vec3(m, sqrt(max(0.0, 1.0 - r2)));
        float lam = clamp(dot(n, normalize(vec3(-0.22, 0.18, 0.96))), 0.0, 1.0);
        float mar = fbm(m*1.7 + vec2(4.2, 1.3));
        float alb = mix(1.0, 0.87, smoothstep(0.5, 0.7, mar))*(0.95 + 0.05*vn(m*8.0 + 2.0));
        vec3 mc = vec3(0.9, 0.88, 0.91)*alb*(0.56 + 0.44*lam)*(0.9 + 0.1*n.z);
        col = mix(col, mc, on);
      }
    }
  } else {
    float d = -h;
    col = texture2D(uLut, vec2(sqrt(min(d/0.3, 1.0)), 0.75)).rgb;
    float sx = dx + t*0.0035;
    float sh2 = 1.0;
    for (int i = 0; i < 4; i++) {
      float fi = float(i);
      float rl = 0.009 + 0.021*fi + 0.009*fi*fi + (0.005 + 0.009*fi)*(ridge(sx*(8.0 - 1.4*fi) + fi*17.0) - 0.5)*2.0;
      float e = 0.0015 + 0.0015*fi;
      float inl = smoothstep(rl - e, rl + e, d);
      float edge = exp(-max(d - rl, 0.0)/(0.005 + 0.008*fi));
      sh2 = mix(sh2, 1.05 - (0.24 - 0.035*fi)*edge, inl);
    }
    float z = 1.0/(d + 0.06);
    vec2 q = vec2(dx*z*0.9 + t*0.012, z*0.5);
    float n1 = fbm(q*1.1);
    float n2 = fbm(q*0.55 + 9.0);
    float n3 = fbm(vec2(dx*z*2.4, z*1.1) + 21.0);
    float k = sh2*(1.0 + 0.22*(n1 - 0.48) + 0.30*(n2 - 0.48) + 0.10*smoothstep(0.6, 0.86, n1))*(0.86 + 0.28*n3);
    col *= mix(1.0, k, smoothstep(0.003, 0.03, d));
    col = mix(col, col*vec3(1.3, 0.92, 0.78), smoothstep(0.03, 0.12, d)*smoothstep(0.38, 0.6, n3)*0.9);
  }
  // 빛줄기는 하늘에서만 — 땅 픽셀(가장 무거운 칸)에서는 계산하지 않는다(261013 검토)
  if (h > 0.004) col += vec3(0.78, 0.92, 0.90)*0.27*beams(p - vec2(0.0, sh*0.016), t)*uBeam.w*smoothstep(0.004, 0.07, h);
  float bx = uBeam.x + (uHz.x - uBeam.y)*tan(0.29 + uBeam.z);
  float bq = (p.x - bx)/0.2; // pow(음수, 2.0) 는 명세상 정의되지 않음 — 곱으로(261013 검토)
  col += vec3(0.05, 0.07, 0.09)*uBeam.w*exp(-bq*bq)*exp(-abs(h)/0.06);
  vec2 vg = (uv - vec2(0.6, 0.45))*vec2(asp*0.55, 1.0);
  col *= 1.0 - 0.22*smoothstep(0.35, 1.05, length(vg));
#ifdef GL_FRAGMENT_PRECISION_HIGH
  col += (h12(gl_FragCoord.xy + fract(t*3.7)*91.0) - 0.5)*(1.6/255.0);
#endif
  gl_FragColor = vec4(col, 1.0);
}`;

/*
 * 견본에서 잰 세로 밝기(sRGB 0~1) — [대기선 위(아래) 거리(화면 높이 비), r, g, b]. 열마다 대기선(가장 밝은 줄)을 찾아 그 위아래를 글 · 단추 없는 열들로 평균.
 * SKY: 대기선(맨 밝음) → 위로 푸른 안개 → 남흑색. GROUND: 대기선 → 아래로 빠르게 어두워지는 파란 땅.
 */
const SKY: [number, number, number, number][] = [
  [0, 0.555, 0.622, 0.727], [0.0049, 0.541, 0.618, 0.708], [0.0099, 0.523, 0.613, 0.714], [0.0164, 0.478, 0.597, 0.719], [0.0247, 0.416, 0.564, 0.72],
  [0.0329, 0.361, 0.52, 0.71], [0.0493, 0.286, 0.441, 0.678], [0.0658, 0.218, 0.367, 0.616], [0.0987, 0.143, 0.262, 0.507], [0.125, 0.115, 0.205, 0.43],
  [0.1645, 0.099, 0.154, 0.345], [0.2, 0.082, 0.118, 0.28], [0.2467, 0.072, 0.095, 0.229], [0.275, 0.058, 0.08, 0.196], [0.325, 0.047, 0.067, 0.145],
  [0.425, 0.031, 0.047, 0.108], [0.525, 0.025, 0.035, 0.08], [0.625, 0.02, 0.028, 0.07], [0.725, 0.017, 0.025, 0.064], [0.82, 0.016, 0.025, 0.06],
  [1, 0.014, 0.022, 0.054],
];
const GROUND: [number, number, number, number][] = [
  [0, 0.555, 0.622, 0.727], [0.0049, 0.469, 0.542, 0.678], [0.0099, 0.378, 0.472, 0.645], [0.0148, 0.315, 0.427, 0.625], [0.0197, 0.271, 0.395, 0.602],
  [0.0247, 0.244, 0.37, 0.581], [0.0329, 0.217, 0.328, 0.546], [0.0411, 0.19, 0.292, 0.508], [0.0493, 0.162, 0.257, 0.468], [0.0576, 0.142, 0.231, 0.437],
  [0.07, 0.13, 0.211, 0.406], [0.0822, 0.118, 0.192, 0.385], [0.0987, 0.109, 0.166, 0.353], [0.1151, 0.104, 0.153, 0.334], [0.1398, 0.09, 0.135, 0.312],
  [0.1645, 0.083, 0.119, 0.279], [0.3, 0.07, 0.1, 0.24],
];

/** 256칸 × 2줄 표 — 윗줄 = 하늘(u = √h), 아랫줄 = 땅(u = √(d/0.3)). 꺾인 자리가 줄무늬로 안 보이게 두 번 부드럽게 */
function lut(): Uint8Array {
  const N = 256;
  const row = (tab: [number, number, number, number][], span: number) => {
    const out: number[][] = [];
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      const x = u * u * span;
      let k = 0;
      while (k < tab.length - 2 && tab[k + 1][0] < x) k++;
      const a = tab[k];
      const b = tab[k + 1];
      const f = Math.max(0, Math.min(1, (x - a[0]) / (b[0] - a[0])));
      out.push([a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f]);
    }
    for (let pass = 0; pass < 2; pass++) {
      const src = out.map((c) => c.slice());
      for (let i = 2; i < N - 1; i++) for (let c = 0; c < 3; c++) out[i][c] = (src[i - 1][c] + 2 * src[i][c] + src[i + 1][c]) / 4;
    }
    return out;
  };
  const data = new Uint8Array(N * 2 * 4);
  [row(SKY, 1), row(GROUND, 0.3)].forEach((r, y) => r.forEach((c, i) => {
    const o = (y * N + i) * 4;
    data[o] = Math.round(c[0] * 255);
    data[o + 1] = Math.round(c[1] * 255);
    data[o + 2] = Math.round(c[2] * 255);
    data[o + 3] = 255;
  }));
  return data;
}

/** 첫 장(움직임 줄이기면 이 한 장) */
const T0 = 6;
/** 한 장 픽셀 상한 — 아주 넓은 모니터에서도 이만큼만 그리고 늘린다 */
const MAX_PX = 1_100_000;
/** 터치 기기 상한 — 화면배율 × 0.75 로 올린 뒤 큰 태블릿 카드(1024 세로 = 944×590)가 데스크톱만큼 그리지 않게(예전 1배와 같은 양, 261013 검토) */
const MAX_PX_TOUCH = 560_000;

type Gl = WebGLRenderingContext;
type U = 'uRes' | 'uTime' | 'uPx' | 'uHz' | 'uMoon' | 'uBeam' | 'uLut';
type Prog = { p: WebGLProgram; buf: WebGLBuffer; tex: WebGLTexture; u: Record<U, WebGLUniformLocation | null> };
type Pending = { p: WebGLProgram; vs: WebGLShader; fs: WebGLShader };

const dev = process.env.NODE_ENV !== 'production';

/** 컴파일 · 링크를 걸어만 둔다(병렬 컴파일 확장이 있으면 드라이버가 뒤에서 한다) */
function begin(gl: Gl): Pending | null {
  const vs = gl.createShader(gl.VERTEX_SHADER);
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  const p = gl.createProgram();
  if (!vs || !fs || !p) {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    if (p) gl.deleteProgram(p);
    return null;
  }
  gl.shaderSource(vs, VS);
  gl.shaderSource(fs, FS);
  gl.compileShader(vs);
  gl.compileShader(fs);
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.bindAttribLocation(p, 0, 'a');
  gl.linkProgram(p);
  return { p, vs, fs };
}

/** 결과 확인 · 버퍼 · 표 텍스처 — 실패면 null(캔버스는 붙이지 않는다 → CSS 그림 그대로) */
function finish(gl: Gl, k: Pending): Prog | null {
  const ok = !!gl.getProgramParameter(k.p, gl.LINK_STATUS);
  if (!ok && dev && !gl.isContextLost()) {
    console.warn('[CeoSpace] shader', gl.getShaderInfoLog(k.fs) || gl.getShaderInfoLog(k.vs) || gl.getProgramInfoLog(k.p));
  }
  gl.deleteShader(k.vs); // 붙은 셰이더는 프로그램과 함께 지워진다
  gl.deleteShader(k.fs);
  const buf = ok ? gl.createBuffer() : null;
  const tex = buf ? gl.createTexture() : null;
  if (!buf || !tex) {
    if (buf) gl.deleteBuffer(buf);
    gl.deleteProgram(k.p);
    return null;
  }
  gl.useProgram(k.p);
  // 화면 전체를 덮는 삼각형 하나
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  // 하늘 · 땅 밝기 표(256×2, 2의 거듭제곱 아닌 크기라 가장자리 고정 · 밉맵 없음)
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, lut());
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const names: U[] = ['uRes', 'uTime', 'uPx', 'uHz', 'uMoon', 'uBeam', 'uLut'];
  const u = {} as Record<U, WebGLUniformLocation | null>;
  names.forEach((n) => { u[n] = gl.getUniformLocation(k.p, n); });
  gl.uniform1i(u.uLut, 0);
  return { p: k.p, buf, tex, u };
}

export type SpaceVariant = 'stage' | 'card';

type Comp = { hz: number; apex: number; sag: number; moon: [number, number, number]; v: [number, number]; rot: number; beam: number };

/**
 * 구도 — 좌표는 화면 높이 단위(x 는 왼쪽부터 · y 는 아래부터). 견본: 대기선 높이 0.17 · 달 지름 3% · 빛줄기는 세로에서 8 · 12.5 · 16.5 · 20° 로 화면 아래 한 점에 모임(가는 실선 둘 · 넓은 띠 둘).
 * 넓은 판(데스크톱 무대 · 태블릿 16:10 카드): 대표 얼굴(가로 0.7) 둘레를 비우고 달은 머리 왼쪽 위(이마 높이 — 눈선과 짝지어 보이지 않게, 작은 창 첫 장면에서도
 *   창 왼쪽 끝에서 띄움, 261013 검토), 빛줄기는 머리 오른쪽 → 어깨 뒤.
 * 판 고르기는 CSS 그림과 같은 조건 — 무대는 비율과 상관없이 늘 넓은 판(정사각에 가까운 데스크톱 창도), 카드는 768px 이상(.cx-hm-card 가 16:10 이 되는 폭)이면 넓은 판.
 */
function compose(w: number, h: number, wide: boolean): Comp {
  const a = w / h;
  if (wide) {
    return { hz: 0.17, apex: 0.6 * a, sag: 0.014, moon: [0.575 * a, 0.82, 0.0165], v: [0.715 * a, -0.1], rot: 0, beam: 1 };
  }
  return { hz: 0.4, apex: 0.55 * a, sag: 0.02, moon: [0.19 * a, 0.83, 0.021], v: [0.63 * a, 0.1], rot: -0.07, beam: 0.85 };
}

const mq = (q: string) => {
  try { return window.matchMedia(q); } catch { return null; }
};

type Ext = { COMPLETION_STATUS_KHR: number };

/** 캔버스를 만들어 붙이고 돌린다 — 못 하면(WebGL 없음 · 컴파일 실패) 아무것도 붙이지 않는다 */
function start(box: HTMLElement, motion: MutableRefObject<number> | undefined, variant: SpaceVariant): (() => void) | null {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  let gl: Gl | null = null;
  try {
    gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'low-power' }) as Gl | null;
  } catch {
    gl = null;
  }
  if (!gl) return null;
  const g = gl;
  const release = () => {
    try { g.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* 이미 잃었다 */ }
  };
  const pend = begin(g);
  if (!pend) {
    release();
    return null;
  }

  let prog: Prog | null = null;
  let disposed = false;
  let waitRaf = 0;
  const offs: (() => void)[] = [];

  const reduceMq = mq('(prefers-reduced-motion: reduce)');
  const coarseMq = mq('(pointer: coarse)');
  const tabletMq = mq('(min-width: 768px)'); // styles.ts .cx-hm-card 16:10 · .cx-space[data-v=card] 넓은 판과 같은 폭
  const hi = g.getShaderPrecisionFormat(g.FRAGMENT_SHADER, g.HIGH_FLOAT);
  const lowp = !hi || hi.precision < 16; // highp 없음 → 정지 한 장
  let coarse = false;
  // 데스크톱 css px 당 0.6 × 화면배율(최대 1.5) · 0.75 아래로는 안 내림.
  // 터치 카드(폰 · 태블릿) = 화면배율(최대 2) × 0.75 — 2 · 3배 폰에서 1.5배(1배는 잔별 · 달 테두리가 3배 화면에서 뿌옇게 늘어났다, 261013 검토).
  // 터치 무대(iPad 가로 = 데스크톱 판, 무대 전체가 크다) = 0.75
  const scaleOf = () => {
    const dpr = window.devicePixelRatio || 1;
    if (!coarse) return Math.max(0.75, Math.min(dpr, 1.5) * 0.6);
    return variant === 'stage' ? 0.75 : Math.max(1, Math.min(dpr, 2) * 0.75);
  };
  const gapOf = () => (coarse ? 1000 / 30 - 4 : 1000 / 60 - 2);

  let raf = 0;
  let lastTs = 0;
  let lastDraw = 0;
  let t = T0;
  let onScreen = false;
  let lost = false;
  let comp = compose(16, 9, true);
  let cssH = 1;

  const frozen = () => lowp || !!reduceMq?.matches;
  const canRun = () => !!prog && !lost && onScreen && !document.hidden && !frozen();

  const draw = (time: number) => {
    if (!prog || lost) return;
    const w = canvas.width;
    const h = canvas.height;
    if (!w || !h) return;
    const u = prog.u;
    const k = Math.max(0, Math.min(1, motion?.current ?? 0));
    const c = comp;
    const far = Math.max(c.apex, w / h - c.apex);
    g.viewport(0, 0, w, h);
    g.uniform2f(u.uRes, w, h);
    g.uniform1f(u.uTime, time);
    // 잔별 크기는 css px 기준(줄여 그려도 같은 크기) — 단 캔버스 1칸 아래로는 안 내림(깜빡임)
    g.uniform1f(u.uPx, Math.max(1 / cssH, 0.8 / h));
    g.uniform4f(u.uHz, c.hz, c.apex, c.sag / (far * far), k);
    g.uniform4f(u.uMoon, c.moon[0], c.moon[1], c.moon[2], 0);
    g.uniform4f(u.uBeam, c.v[0], c.v[1], c.rot, c.beam);
    g.drawArrays(g.TRIANGLES, 0, 3);
    if (!canvas.hasAttribute('data-on')) canvas.setAttribute('data-on', '');
  };

  const frame = (ts: number) => {
    raf = 0;
    if (!canRun()) return;
    const dt = lastTs ? Math.min(ts - lastTs, 50) : 0; // 쉬다 돌아와도 한 번에 건너뛰지 않게
    lastTs = ts;
    t += dt / 1000;
    if (ts - lastDraw >= gapOf()) {
      lastDraw = ts;
      draw(t);
    }
    raf = requestAnimationFrame(frame);
  };

  const sync = () => {
    if (canRun()) {
      if (!raf) {
        lastTs = 0;
        raf = requestAnimationFrame(frame);
      }
    } else if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };

  // 크기 — 캔버스 크기를 바꾸면 그림이 지워지므로 바로 한 장 다시(CeoSilk 와 같은 이유). 구도도 판 모양에 맞춰 다시.
  // 레이아웃 크기(clientWidth)로 잰다 — getBoundingClientRect 는 끝 카드 scale(.92) 가 들어가 그 상태에서 크기가 바뀌면 8% 작게 남았다(261013 검토)
  const resize = () => {
    coarse = !!coarseMq?.matches || window.innerWidth < 768;
    const r = { width: canvas.clientWidth, height: canvas.clientHeight };
    let s = scaleOf();
    const cap = coarse ? MAX_PX_TOUCH : MAX_PX;
    if (r.width * r.height * s * s > cap) s = Math.sqrt(cap / (r.width * r.height));
    const w = Math.max(1, Math.round(r.width * s));
    const h = Math.max(1, Math.round(r.height * s));
    cssH = Math.max(1, r.height);
    const prev = comp;
    comp = compose(r.width || 16, r.height || 9, variant === 'stage' || (tabletMq ? tabletMq.matches : window.innerWidth >= 768));
    if (canvas.width === w && canvas.height === h) {
      if (comp.hz !== prev.hz || comp.moon[0] !== prev.moon[0]) draw(frozen() ? T0 : t); // 크기는 같고 판만 바뀜(멈춘 그림도 새 구도로)
      return;
    }
    canvas.width = w;
    canvas.height = h;
    draw(frozen() ? T0 : t);
  };

  const ready = () => {
    waitRaf = 0;
    if (disposed) return;
    prog = finish(g, pend);
    if (!prog) {
      release();
      return;
    }
    box.appendChild(canvas);
    resize();

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(canvas);
    if (!ro) window.addEventListener('resize', resize);
    offs.push(() => {
      ro?.disconnect();
      if (!ro) window.removeEventListener('resize', resize);
    });
    // 화면배율만 바뀌면(창을 다른 모니터로) ResizeObserver 가 오지 않는다 — 지금 배율에 걸어 두고 바뀌면 다시 건다
    let dprMq: MediaQueryList | null = null;
    const onDpr = () => {
      resize();
      watchDpr();
    };
    const watchDpr = () => {
      dprMq?.removeEventListener?.('change', onDpr);
      dprMq = mq(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      dprMq?.addEventListener?.('change', onDpr);
    };
    watchDpr();
    offs.push(() => dprMq?.removeEventListener?.('change', onDpr));

    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting;
      sync();
    }, { rootMargin: '80px 0px' });
    io.observe(canvas);
    offs.push(() => io.disconnect());

    const onVis = () => sync();
    document.addEventListener('visibilitychange', onVis);
    offs.push(() => document.removeEventListener('visibilitychange', onVis));
    const onReduce = () => {
      if (frozen()) draw(T0);
      sync();
    };
    reduceMq?.addEventListener?.('change', onReduce);
    offs.push(() => reduceMq?.removeEventListener?.('change', onReduce));

    const onLost = (e: Event) => {
      e.preventDefault(); // 이래야 restored 가 온다
      lost = true;
      prog = null;
      sync();
      canvas.removeAttribute('data-on');
    };
    const onRestored = () => {
      lost = false;
      const k = begin(g);
      prog = k ? finish(g, k) : null; // 실패하면 그리지 않는다(캔버스는 투명한 채 → CSS 그림)
      draw(frozen() ? T0 : t);
      sync();
    };
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    offs.push(() => {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    });
  };

  // 병렬 컴파일 — 끝날 때까지 프레임마다 묻기만 한다(링크 결과를 바로 물으면 그 자리에서 컴파일이 끝날 때까지 멈춘다)
  const par = g.getExtension('KHR_parallel_shader_compile') as Ext | null;
  if (par) {
    const wait = () => {
      waitRaf = 0;
      if (disposed) return;
      if (g.isContextLost() || g.getProgramParameter(pend.p, par.COMPLETION_STATUS_KHR)) ready();
      else waitRaf = requestAnimationFrame(wait);
    };
    waitRaf = requestAnimationFrame(wait);
  } else {
    ready();
    if (!prog) return null;
  }

  return () => {
    disposed = true;
    if (waitRaf) cancelAnimationFrame(waitRaf);
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    offs.forEach((f) => f());
    if (prog && !g.isContextLost()) {
      g.deleteBuffer(prog.buf);
      g.deleteTexture(prog.tex);
      g.deleteProgram(prog.p);
    }
    prog = null;
    release();
    canvas.remove();
  };
}

/**
 * 우주 배경 상자 — 부모를 가득 채운다(position:absolute; inset:0 은 .cx-space CSS).
 * active 일 때만 WebGL 을 켠다(서버 첫 그림 · 판이 정해지기 전에는 두 판이 다 있어 CSS 그림만).
 */
export default function CeoSpace({ variant, active, motion, className = '' }: { variant: SpaceVariant; active: boolean; motion?: MutableRefObject<number>; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const motionRef = useRef(motion);
  motionRef.current = motion;

  useEffect(() => {
    const box = ref.current;
    if (!box || !active) return undefined;
    let stop: (() => void) | null = null;
    let tried = false;
    const go = () => {
      if (tried) return;
      tried = true;
      stop = start(box, motionRef.current, variant);
    };
    if (typeof IntersectionObserver === 'undefined') {
      go();
      return () => stop?.();
    }
    // 화면 800px 안으로 다가오면 그때 컨텍스트를 만든다(첫 장면이라 대개 바로)
    const near = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      near.disconnect();
      go();
    }, { rootMargin: '800px 0px' });
    near.observe(box);
    return () => {
      near.disconnect();
      stop?.();
      stop = null;
    };
  }, [active, variant]);

  return <div ref={ref} className={`cx-space ${className}`} data-v={variant} aria-hidden />;
}
