'use client';

import { useEffect, useRef, useState } from 'react';

const FRAGMENT = `
precision highp float;
uniform float time;
varying vec2 vUv;
void main() {
  vec2 p = (vUv * 2.0 - 1.0) / 0.82;
  float r = length(p);
  if (r > 1.06) discard;
  float z = sqrt(max(0.0, 1.0 - r*r));
  float t = time * 0.38;
  float curve = p.y + 0.30*sin(p.x*2.5 + t) + 0.09*sin(p.x*4.2 - t*0.7);
  float blue = exp(-pow((curve - 0.22) / 0.32, 2.0));
  float cyan = exp(-pow((curve + 0.28) / 0.24, 2.0));
  float violet = exp(-pow((curve - 0.02) / 0.18, 2.0)) * smoothstep(-0.5,0.9,p.x);
  vec3 color = mix(vec3(0.50,0.73,0.98),vec3(0.16,0.40,0.98),blue*0.85);
  color = mix(color,vec3(0.18,0.81,0.95),cyan*0.85);
  color = mix(color,vec3(0.48,0.35,0.98),violet*0.65);
  float lip = exp(-pow((curve + 0.39) / 0.022, 2.0));
  color += vec3(0.2,0.34,0.38)*lip*(0.5+0.5*p.x);
  float rim = pow(1.0-z, 3.4);
  color = mix(color,vec3(0.67,0.84,1.0),rim*0.7);
  color += vec3(0.17,0.2,0.24)*exp(-pow((r-0.985)/0.018,2.0));
  color += vec3(0.22)*exp(-length(p-vec2(-0.4,0.55))*12.0);
  float alpha = (0.2 + 0.4*max(blue,cyan) + 0.25*rim) * (1.0-smoothstep(0.99,1.015,r));
  if (r > 1.0) alpha *= 0.3;
  gl_FragColor = vec4(color,alpha);
}`;

/** A small transparent shader, loaded independently from the admin's data UI. */
export function AdminAiOrb() {
  const host = useRef<HTMLSpanElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void import('three').then((THREE) => {
      if (disposed || !host.current) return;
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(80, 80);
      renderer.setClearColor(0x000000, 0);
      renderer.domElement.setAttribute('aria-hidden', 'true');
      host.current.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const material = new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 } }, transparent: true, depthWrite: false,
        vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
        fragmentShader: FRAGMENT,
      });
      const geometry = new THREE.PlaneGeometry(2, 2);
      scene.add(new THREE.Mesh(geometry, material));
      const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
      let frame = 0;
      let previous = 0;
      const started = performance.now();
      const render = (now: number) => {
        if (disposed || document.hidden) return;
        if (now - previous >= 32 || !previous) {
          material.uniforms.time.value = motion.matches ? 0 : (now - started) / 1000;
          renderer.render(scene, camera);
          previous = now;
        }
        if (!motion.matches) frame = requestAnimationFrame(render);
      };
      const resume = () => { cancelAnimationFrame(frame); previous = 0; render(performance.now()); };
      document.addEventListener('visibilitychange', resume);
      motion.addEventListener('change', resume);
      render(performance.now());
      setReady(true);
      cleanup = () => {
        cancelAnimationFrame(frame);
        document.removeEventListener('visibilitychange', resume);
        motion.removeEventListener('change', resume);
        geometry.dispose(); material.dispose(); renderer.dispose(); renderer.domElement.remove();
      };
    }).catch(() => { /* The CSS sphere remains available without WebGL. */ });
    return () => { disposed = true; cleanup?.(); };
  }, []);
  return <span ref={host} className={`adm-ai-orb${ready ? ' ready' : ''}`} aria-hidden="true" />;
}
