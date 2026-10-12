'use client';

import { useEffect, useRef } from 'react';

/*
 * 이사진 소개 뒤 '일렁이는 고급스러운 3D 배경'(261012 사장 '배경을 일렁이는 고급스러운 3d배경 느낌으로').
 * 맨 WebGL 조각 셰이더 한 장 — 연하늘 → 흰 바탕 위로 반투명 유리 · 비단 띠 4줄이 천천히 휘고 비틀린다
 * (띠가 옆으로 서는 곳은 프레넬로 밝아지고, 가장자리에 아주 옅은 무지개빛). three.js 는 쓰지 않는다(웨딩런 묶음에만 있는 의존성).
 * 아끼는 장치: 해상도를 줄여 그리고(데스크톱 css px 당 0.6 × 화면배율 · 최대 1.5배, 터치폰 0.5 · 1배) CSS 로 늘린다 — 비단은 원래 부드러워 티가 안 난다.
 *   화면 밖 · 탭 숨김이면 rAF 멈춤, 데스크톱 초당 60장(120 · 144Hz 화면도) · 터치폰 30장. 움직임 줄이기면 한 장만 그리고 멈춘다.
 *   컨텍스트 · 셰이더 컴파일은 섹션이 800px 안으로 다가올 때 한다(페이지 첫 화면 하이드레이션과 겹치지 않게, 261012 검토).
 *   조각 셰이더 highp 가 없는 옛 GPU 는 시간이 커질수록 띠가 계단지므로 정지 한 장으로 둔다.
 * WebGL 이 없거나 컨텍스트를 잃으면 캔버스는 투명한 채로 두어 뒤의 CSS 그라데이션(.cx-ld 바탕)이 보인다 — 첫 장이 그려져야 캔버스가 서서히 나타난다.
 * 캔버스는 붙을 때마다 새로 만들고 떨어질 때 컨텍스트를 바로 돌려준다(loseContext) — 같은 캔버스를 다시 쓰면 잃은 컨텍스트가 되돌아와
 *   빠른 새로고침(HMR) 뒤 바탕이 비고, 안 돌려주면 페이지를 오가며 브라우저 WebGL 자리(16개 남짓)를 쌓는다.
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
uniform vec3 uFrame;
float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
vec3 film(float x){ return 0.5+0.5*cos(6.28318*(x+vec3(0.0,0.33,0.67))); }
vec4 ribbon(out float sh, vec2 q, float t, float y0, float a1, float f1, float a2, float f2, float ph, float sp, float wid, float tw, float curv, vec3 tint, float op){
  float x = q.x;
  float s1 = x*f1 + ph + t*sp;
  float s2 = x*f2 - ph*1.7 - t*sp*1.31;
  float c = y0 + a1*sin(s1) + a2*sin(s2);
  float dc = a1*f1*cos(s1) + a2*f2*cos(s2);
  float th = tw*x + ph + t*sp*0.7 + 0.9*sin(x*0.9 + t*sp*0.5 + ph*2.1);
  float ct = cos(th);
  float w = wid*(0.9 + 0.25*sin(x*1.7 + ph - t*0.1));
  float sl = sqrt(1.0 + dc*dc);
  float v = (q.y - c) / (sqrt(ct*ct + 0.004) * w * sl);
  float av = abs(v);
  sh = 1.0 - smoothstep(0.3, 1.8, abs((q.y + 0.035 - c) / (w * sl)));
  float edge = 1.0 - smoothstep(0.82, 1.0, av);
  if (edge <= 0.0) return vec4(0.0);
  float phi = th + curv*v;
  vec2 nd = normalize(vec2(-dc, 1.0));
  vec3 n = normalize(vec3(nd * -sin(phi), cos(phi)));
  vec3 L = normalize(vec3(-0.35, 0.55, 0.76));
  float diff = abs(dot(n, L));
  float nh = abs(dot(n, normalize(L + vec3(0.0, 0.0, 1.0))));
  float spec = pow(nh, 56.0) + 0.14*pow(nh, 8.0);
  float fres = pow(1.0 - abs(n.z), 1.6);
  vec3 col = mix(tint, vec3(1.0), 0.06 + 0.72*diff*diff*diff);
  col = mix(col, film(fres*0.9 + x*0.12 + t*0.02), 0.10*fres);
  col += spec*0.7;
  float rim = smoothstep(0.6, 0.98, av)*edge;
  col = mix(col, film(v*0.5 + x*0.2 + 0.1), rim*0.12);
  float a = edge * clamp(op*(0.32 + 0.85*fres) + spec*0.6 + rim*0.12, 0.0, 0.92);
  return vec4(col, a);
}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 q = (gl_FragCoord.xy - 0.5*uRes) / uFrame.x;
  q = vec2(q.x*uFrame.y + q.y*uFrame.z, -q.x*uFrame.z + q.y*uFrame.y);
  float t = uTime;
  float g = smoothstep(0.0, 1.25, (1.0-uv.y)*0.85 + uv.x*0.45);
  vec3 col = mix(vec3(0.995,0.997,1.0), vec3(0.86,0.91,1.0), smoothstep(0.0, 0.6, g));
  col = mix(col, vec3(0.58,0.72,0.97), smoothstep(0.5, 1.0, g));
  vec3 shade = vec3(0.93,0.955,1.0);
  vec4 r; float sh;
  r = ribbon(sh, q, t, -0.46, 0.14, 0.9, 0.05, 2.1, 0.4, 0.12, 0.46, 0.25, 0.9, vec3(0.38,0.55,0.96), 0.70); col *= mix(vec3(1.0), shade, sh*0.5); col = mix(col, r.rgb, r.a);
  r = ribbon(sh, q, t,  0.24, 0.20, 0.8, 0.06, 1.9, 2.1, 0.15, 0.32, 0.45, 1.5, vec3(0.52,0.69,1.00), 0.58); col *= mix(vec3(1.0), shade, sh*0.5); col = mix(col, r.rgb, r.a);
  r = ribbon(sh, q, t,  0.00, 0.16, 1.1, 0.05, 2.6, 4.0, 0.19, 0.16, 1.00, 1.2, vec3(0.66,0.79,1.00), 0.46); col *= mix(vec3(1.0), shade, sh*0.5); col = mix(col, r.rgb, r.a);
  r = ribbon(sh, q, t,  0.40, 0.10, 1.5, 0.04, 3.1, 5.3, 0.14, 0.06, 1.60, 1.4, vec3(0.84,0.90,1.00), 0.32); col *= mix(vec3(1.0), shade, sh*0.5); col = mix(col, r.rgb, r.a);
#ifdef GL_FRAGMENT_PRECISION_HIGH
  col += (hash(gl_FragCoord.xy + fract(t)) - 0.5) / 255.0;
#endif
  gl_FragColor = vec4(col, 1.0);
}`;

/** 첫 장(움직임 줄이기면 이 한 장) — 띠가 화면에 고루 퍼진 때부터 시작 */
const T0 = 8;
/** 한 장 픽셀 상한 — 아주 넓은 모니터(2560px 이상)에서도 이만큼만 그리고 늘린다 */
const MAX_PX = 1_100_000;

type Gl = WebGLRenderingContext;
type Prog = { p: WebGLProgram; buf: WebGLBuffer; uRes: WebGLUniformLocation | null; uTime: WebGLUniformLocation | null; uFrame: WebGLUniformLocation | null };

function compile(gl: Gl): Prog | null {
  const dev = process.env.NODE_ENV !== 'production';
  const made: WebGLShader[] = [];
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type);
    if (!s) return null;
    made.push(s);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      if (dev && !gl.isContextLost()) console.warn('[CeoSilk] shader', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  };
  const vs = sh(gl.VERTEX_SHADER, VS);
  const fs = vs ? sh(gl.FRAGMENT_SHADER, FS) : null;
  const p = vs && fs ? gl.createProgram() : null;
  let ok = false;
  if (p && vs && fs) {
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.bindAttribLocation(p, 0, 'a');
    gl.linkProgram(p);
    ok = !!gl.getProgramParameter(p, gl.LINK_STATUS);
    if (!ok && dev && !gl.isContextLost()) console.warn('[CeoSilk] link', gl.getProgramInfoLog(p));
  }
  made.forEach((x) => gl.deleteShader(x)); // 붙은 셰이더는 프로그램과 함께 지워진다
  const buf = ok ? gl.createBuffer() : null;
  if (!p || !buf) {
    if (p) gl.deleteProgram(p);
    return null;
  }
  gl.useProgram(p);
  // 화면 전체를 덮는 삼각형 하나
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  return { p, buf, uRes: gl.getUniformLocation(p, 'uRes'), uTime: gl.getUniformLocation(p, 'uTime'), uFrame: gl.getUniformLocation(p, 'uFrame') };
}

const mq = (q: string) => {
  try { return window.matchMedia(q); } catch { return null; }
};

/** 캔버스를 만들어 붙이고 돌린다 — 못 하면(WebGL 없음 · 컴파일 실패) 아무것도 붙이지 않고 null(CSS 그라데이션 그대로) */
function start(box: HTMLElement): (() => void) | null {
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
  let prog = compile(g);
  if (!prog) {
    release(); // 쓰지 않을 컨텍스트는 바로 돌려준다(캔버스도 붙이지 않는다)
    return null;
  }
  box.appendChild(canvas);

  const reduceMq = mq('(prefers-reduced-motion: reduce)');
  const coarseMq = mq('(pointer: coarse)');
  const hi = g.getShaderPrecisionFormat(g.FRAGMENT_SHADER, g.HIGH_FLOAT);
  const lowp = !hi || hi.precision < 16; // highp 없음 → 정지 한 장
  let coarse = false;
  const scaleOf = () => Math.min(window.devicePixelRatio || 1, coarse ? 1 : 1.5) * (coarse ? 0.5 : 0.6);
  const gapOf = () => (coarse ? 1000 / 30 - 4 : 1000 / 60 - 2); // 터치폰 초당 30장 · 데스크톱 60장

  let raf = 0;
  let lastTs = 0;
  let lastDraw = 0;
  let t = T0;
  let onScreen = false;
  let lost = false;

  const frozen = () => lowp || !!reduceMq?.matches;
  const canRun = () => !!prog && !lost && onScreen && !document.hidden && !frozen();

  const draw = (time: number) => {
    if (!prog || lost) return;
    const w = canvas.width;
    const h = canvas.height;
    if (!w || !h) return;
    // 넓은 화면은 띠가 살짝(약 7°) 오른쪽 위로, 세로로 긴 폰은 더 비스듬히 — 띠 굵기는 화면 크기에 맞춘다
    const k = Math.max(0, Math.min(1, (w / h - 0.6) / 0.8));
    const S = k * Math.min(h, w * 0.75) + (1 - k) * h * 0.62;
    const ang = 0.12 + (1 - k) * 0.38;
    g.viewport(0, 0, w, h);
    g.uniform2f(prog.uRes, w, h);
    g.uniform1f(prog.uTime, time);
    g.uniform3f(prog.uFrame, S, Math.cos(ang), Math.sin(ang));
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

  /*
   * 크기 — 캔버스 크기를 바꾸면 그림이 지워진다(alpha:false 라 검정). 돌고 있어도 바로 한 장 다시 그려야
   * 창을 끄는 동안 검은 장이 화면에 나가지 않는다(ResizeObserver 콜백은 그 프레임의 rAF 뒤 · 페인트 앞, 261012 검토).
   * 화면배율(레티나 ↔ 일반 모니터) · 터치폰 판정도 여기서 다시 본다.
   */
  const resize = () => {
    coarse = !!coarseMq?.matches || window.innerWidth < 768;
    const r = canvas.getBoundingClientRect();
    let s = scaleOf();
    if (r.width * r.height * s * s > MAX_PX) s = Math.sqrt(MAX_PX / (r.width * r.height));
    const w = Math.max(1, Math.round(r.width * s));
    const h = Math.max(1, Math.round(r.height * s));
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w;
    canvas.height = h;
    draw(frozen() ? T0 : t);
  };
  resize();

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  ro?.observe(canvas);
  if (!ro) window.addEventListener('resize', resize);
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

  const io = new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    sync();
  }, { rootMargin: '80px 0px' });
  io.observe(canvas);

  const onVis = () => sync();
  document.addEventListener('visibilitychange', onVis);
  const onReduce = () => {
    if (frozen()) draw(T0);
    sync();
  };
  reduceMq?.addEventListener?.('change', onReduce);

  const onLost = (e: Event) => {
    e.preventDefault(); // 이래야 restored 가 온다
    lost = true;
    prog = null;
    sync();
    canvas.removeAttribute('data-on');
  };
  const onRestored = () => {
    lost = false;
    prog = compile(g); // 실패하면 prog 가 비어 그리지 않는다(캔버스는 투명한 채 → CSS 그라데이션)
    draw(frozen() ? T0 : t);
    sync();
  };
  canvas.addEventListener('webglcontextlost', onLost);
  canvas.addEventListener('webglcontextrestored', onRestored);

  return () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    ro?.disconnect();
    if (!ro) window.removeEventListener('resize', resize);
    dprMq?.removeEventListener?.('change', onDpr);
    io.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    reduceMq?.removeEventListener?.('change', onReduce);
    canvas.removeEventListener('webglcontextlost', onLost);
    canvas.removeEventListener('webglcontextrestored', onRestored);
    if (prog && !g.isContextLost()) {
      g.deleteBuffer(prog.buf);
      g.deleteProgram(prog.p);
    }
    prog = null;
    release();
    canvas.remove();
  };
}

export default function CeoSilk({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = ref.current;
    if (!box) return undefined;
    let stop: (() => void) | null = null;
    let tried = false;
    const go = () => {
      if (tried) return;
      tried = true;
      stop = start(box);
    };
    if (typeof IntersectionObserver === 'undefined') {
      go();
      return () => stop?.();
    }
    // 섹션이 800px 안으로 다가오면 그때 컨텍스트를 만든다(그 전에는 CSS 그라데이션 — 보이는 차이 없음)
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
  }, []);

  return <div ref={ref} className={className} aria-hidden />;
}
