'use client';

// 회전 가능한 3D 미리보기 — 외형을 바꾸기 전후를 같은 조명에서 확인(제작 프롬프트 5쪽).
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Avatar } from '../engine/characters/chibi';
import type { Appearance } from '../data/appearance';

export default function AvatarPreview({ look, height = 300, pose = 'idle' }: { look: Appearance; height?: number; pose?: 'idle' | 'wave' | 'hold' }) {
  const host = useRef<HTMLDivElement | null>(null);
  const state = useRef<{ renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; avatar: Avatar; yaw: number; drag: boolean; lastX: number; raf: number; base: number; t: number } | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setSize(el.clientWidth, height);
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#FFF8EC', '#C9D8B8', 1.25));
    const key = new THREE.DirectionalLight('#FFF4E2', 2.2);
    key.position.set(2, 3, 3);
    scene.add(key);
    const rim = new THREE.DirectionalLight('#DCEBFF', 0.8);
    rim.position.set(-2, 2, -3);
    scene.add(rim);
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.06, 40), new THREE.MeshStandardMaterial({ color: '#EADFC8', roughness: 0.9 }));
    pedestal.position.y = -0.03;
    scene.add(pedestal);
    const camera = new THREE.PerspectiveCamera(30, el.clientWidth / height, 0.1, 20);
    camera.position.set(0, 0.72, 2.5);
    camera.lookAt(0, 0.52, 0);
    const avatar = new Avatar(look);
    avatar.shadow.visible = false;
    scene.add(avatar.root);
    // 기본은 얼굴이 보이게 정면에서 살짝 좌우로 흔들리고, 끌면 자유롭게 돌린다
    const s = { renderer, scene, camera, avatar, yaw: 0, drag: false, lastX: 0, raf: 0, base: 0, t: 0 };
    state.current = s;
    let last = performance.now();
    const loop = () => {
      s.raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      s.t += dt;
      if (!s.drag) s.yaw += (s.base + Math.sin(s.t * 0.7) * 0.42 - s.yaw) * Math.min(1, dt * 3);
      avatar.snapYaw(s.yaw);
      avatar.animate(dt, now);
      renderer.render(scene, camera);
    };
    s.raf = requestAnimationFrame(loop);
    const down = (e: PointerEvent) => {
      s.drag = true;
      s.lastX = e.clientX;
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!s.drag) return;
      s.yaw += (e.clientX - s.lastX) * 0.012;
      s.base = s.yaw;
      s.t = 0;
      s.lastX = e.clientX;
    };
    const up = () => {
      s.drag = false;
    };
    renderer.domElement.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    const ro = new ResizeObserver(() => {
      renderer.setSize(el.clientWidth, height);
      camera.aspect = el.clientWidth / height;
      camera.updateProjectionMatrix();
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(s.raf);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      renderer.dispose();
      renderer.domElement.remove();
      state.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  useEffect(() => {
    state.current?.avatar.apply(look);
  }, [look]);

  useEffect(() => {
    const a = state.current?.avatar;
    if (!a) return;
    a.setPose(pose);
    if (pose === 'wave') a.setExpr('joy', 1200);
  }, [pose]);

  return <div ref={host} style={{ width: '100%', height, cursor: 'grab', borderRadius: 20, background: 'radial-gradient(circle at 50% 40%, #FFFDF7 0%, #F1E9D8 75%)', overflow: 'hidden' }} aria-label="캐릭터 미리보기 · 끌어서 돌려 보기" />;
}
