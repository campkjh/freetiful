'use client';

import { useLayoutEffect, useRef, useState } from 'react';

/*
 * 토스 말풍선 바탕(꼬리 위) — 홈 퀵매칭 말풍선(모바일, 260927)과 PC 머리줄 '프리티풀 비즈' 말풍선(261007)이 같이 쓴다.
 * 모양·움직임은 globals .qm-bubble*(색만 바꾸는 건 .qm-bubble.biz 처럼 덧칠). 여기 숫자를 바꾸면 두 말풍선이 같이 바뀐다.
 */
/** 꼬리 높이·몸통 모서리(토스 실측) — globals .qm-bubble-body margin-top·.qm-bubble-shadow 와 같게 */
export const QM_TAIL_H = 13;
export const QM_RADIUS = 26;

/**
 * 말풍선 윤곽(꼬리 + 둥근 몸통) 한 줄 path — 유리 한 장을 이 모양으로 잘라 쓴다.
 * 꼬리(토스 실측, 밑동 28 · 높이 12.5 · 옆면 52° · 밑동 오목 · 끝 둥글게)를 몸통 윗변에 이어 그린다.
 */
export function quickMatchBubblePath(w: number, h: number, tailX: number) {
  const t = QM_TAIL_H;
  const r = Math.min(QM_RADIUS, (h - t) / 2);
  const x = Math.min(Math.max(tailX, r + 14), w - r - 14);
  const n = (v: number) => Math.round(v * 100) / 100;
  return [
    `M${n(r)} ${t}`,
    `L${n(x - 14)} ${t}`,
    `C${n(x - 11.4)} ${t} ${n(x - 10.7)} ${n(t - 1.8)} ${n(x - 9.8)} ${n(t - 2.9)}`,
    `L${n(x - 3.9)} ${n(t - 10.2)}`,
    `Q${n(x)} ${n(t - 14.6)} ${n(x + 3.9)} ${n(t - 10.2)}`,
    `L${n(x + 9.8)} ${n(t - 2.9)}`,
    `C${n(x + 10.7)} ${n(t - 1.8)} ${n(x + 11.4)} ${t} ${n(x + 14)} ${t}`,
    `L${n(w - r)} ${t}`,
    `A${n(r)} ${n(r)} 0 0 1 ${n(w)} ${n(t + r)}`,
    `L${n(w)} ${n(h - r)}`,
    `A${n(r)} ${n(r)} 0 0 1 ${n(w - r)} ${n(h)}`,
    `L${n(r)} ${n(h)}`,
    `A${n(r)} ${n(r)} 0 0 1 0 ${n(h - r)}`,
    `L0 ${n(t + r)}`,
    `A${n(r)} ${n(r)} 0 0 1 ${n(r)} ${t}`,
    'Z',
  ].join('');
}

/**
 * 말풍선 바탕 유리 — 꼬리와 몸통을 한 장으로(260927 사장 '꼬리랑 본체랑 잘리는 선').
 * 둘을 따로 흐리면 각자 뒤를 따로 흐려(꼬리는 사진만, 몸통은 사진+흰 틈) 만나는 자리에 색이 6단계 툭 끊겼다.
 * 제 크기를 재서(ResizeObserver) 윤곽 path 로 잘라 쓴다 — 크기를 재기 전엔 숨김.
 */
export function QuickMatchBubbleGlass({ tailX }: { tailX: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      setSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const clip = size ? `path('${quickMatchBubblePath(size.w, size.h, tailX)}')` : undefined;
  return <span ref={ref} className="qm-bubble-glass" aria-hidden="true" style={{ clipPath: clip, WebkitClipPath: clip, visibility: size ? undefined : 'hidden' }} />;
}
