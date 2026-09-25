'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/* ════════════════════════════════════════════════════════════════
 * 채팅 목록 한 줄 — 오른쪽→왼쪽으로 밀면 동그란 버튼(알림 끄기 · 삭제)이 드러난다(당근 채팅 목록 어법, 2026-09-25 사장 지시).
 * 당근 화면 녹화(0.1초 프레임)를 그대로 따랐다:
 *  · 버튼은 제자리에서 **점처럼 작게** 나타나 부드럽게 커지고, 끝에서 살짝 넘쳤다 자리 잡는다(스프링 ζ≈0.7).
 *    오른쪽(삭제)이 밀기 시작하자마자, 왼쪽(알림)은 그 자리가 드러날 때 — 순서대로.
 *  · 줄은 손가락을 1:1 로 따라오고, 손을 떼면 속도를 이어받아 스프링으로 멈춘다(휙 튕기면 그 방향으로).
 *    닫힐 때는 줄이 버튼 위로 스르륵 덮는다(버튼도 그 사이 작아진다).
 *  · 매끄러움: 움직이는 동안 React 를 다시 그리지 않고 requestAnimationFrame 에서 transform 만 바꾼다.
 *  · 세로 스크롤은 브라우저에(touch-action: pan-y) — 가로로 먼저 8px 움직일 때만 민다. 열린 줄을 누르면 이동 대신 닫힌다.
 *  · 누를 때 어두워지는 효과는 없다(사장 지시) — 탭 하이라이트도 끈다.
 * ════════════════════════════════════════════════════════════════ */

export type SwipeAction = {
  key: string;
  label: string;
  /** 동그라미 바탕색 */
  bg: string;
  /** public 아이콘 경로(흰색으로 칠한다) */
  icon: string;
  onClick: () => void;
};

const BTN = 52;
const GAP = 10;
const PAD_L = 8;
const PAD_R = 14;

// 스프링 — 버튼: 약 0.25초에 제 크기, 끝에서 5% 남짓 넘쳤다 자리(ζ≈0.61) / 줄: 거의 안 넘치고 멈춤
const BTN_K = 420;
const BTN_C = 25;
const ROW_K = 380;
const ROW_C = 36;
const FLICK = 450; // px/s — 이보다 빠르게 튕기면 그 방향으로 열고 닫는다

export default function ChatSwipeRow({
  open,
  onOpenChange,
  onSwipeStart,
  actions,
  disabled,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 가로 밀기가 시작됐다 — 꾹 누르기 타이머 끄기 등 */
  onSwipeStart?: () => void;
  actions: SwipeAction[];
  disabled?: boolean;
  children: ReactNode;
}) {
  const width = PAD_L + actions.length * BTN + (actions.length - 1) * GAP + PAD_R;
  const contentRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const sim = useRef({
    x: 0, // 드러난 폭
    vx: 0,
    target: 0,
    dragging: false,
    btn: actions.map(() => ({ s: 0, v: 0 })),
    raf: 0,
    last: 0,
  });
  const drag = useRef<{ x0: number; y0: number; base: number; dir: 'h' | 'v' | null; samples: { t: number; x: number }[] } | null>(null);
  const moved = useRef(false);
  const openRef = useRef(open);

  // 버튼이 튀어나오기 시작하는 자리 — 오른쪽 버튼은 밀기 시작하자마자, 왼쪽 버튼은 제 자리가 드러날 때
  const triggerAt = (fromRight: number) => PAD_R + fromRight * (BTN + GAP) + 4;

  const paint = () => {
    const s = sim.current;
    if (contentRef.current) contentRef.current.style.transform = `translate3d(${-s.x}px,0,0)`;
    const opened = s.x >= width - 1;
    s.btn.forEach((b, i) => {
      const el = btnRefs.current[i];
      if (!el) return;
      const sc = Math.max(0, b.s);
      el.style.transform = `scale(${sc.toFixed(4)})`;
      el.style.opacity = String(Math.min(1, sc * 4));
      el.style.visibility = sc < 0.01 ? 'hidden' : 'visible';
      el.tabIndex = opened ? 0 : -1;
    });
  };

  const step = (now: number) => {
    const s = sim.current;
    const dt = s.last ? Math.min(0.032, (now - s.last) / 1000) : 1 / 60;
    s.last = now;
    let busy = s.dragging;
    if (!s.dragging) {
      const a = -ROW_K * (s.x - s.target) - ROW_C * s.vx;
      s.vx += a * dt;
      s.x += s.vx * dt;
      if (Math.abs(s.x - s.target) < 0.3 && Math.abs(s.vx) < 6) {
        s.x = s.target;
        s.vx = 0;
      } else busy = true;
    }
    const n = s.btn.length;
    s.btn.forEach((b, i) => {
      const goal = s.x >= triggerAt(n - 1 - i) ? 1 : 0;
      const a = -BTN_K * (b.s - goal) - BTN_C * b.v;
      b.v += a * dt;
      b.s += b.v * dt;
      if (Math.abs(b.s - goal) < 0.002 && Math.abs(b.v) < 0.02) {
        b.s = goal;
        b.v = 0;
      } else busy = true;
    });
    paint();
    if (busy) s.raf = requestAnimationFrame(step);
    else {
      s.raf = 0;
      s.last = 0;
    }
  };

  const kick = () => {
    const s = sim.current;
    if (!s.raf) {
      s.last = 0;
      s.raf = requestAnimationFrame(step);
    }
  };

  useEffect(() => () => cancelAnimationFrame(sim.current.raf), []);

  // 부모가 열고 닫으면(다른 줄을 밀었다 · 스크롤) 따라간다
  useEffect(() => {
    openRef.current = open;
    const s = sim.current;
    if (s.dragging) return;
    s.target = open ? width : 0;
    kick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, width]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag.current = { x0: e.clientX, y0: e.clientY, base: sim.current.x, dir: null, samples: [{ t: e.timeStamp, x: e.clientX }] };
    moved.current = false;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const mx = e.clientX - d.x0;
    const my = e.clientY - d.y0;
    if (!d.dir) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      d.dir = Math.abs(mx) > Math.abs(my) ? 'h' : 'v';
      if (d.dir === 'h') {
        moved.current = true;
        sim.current.dragging = true;
        sim.current.vx = 0;
        onSwipeStart?.();
        try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
        kick();
      }
    }
    if (d.dir !== 'h') return;
    let next = d.base - mx; // 왼쪽으로 밀수록 +
    if (next < 0) next = 0;
    if (next > width) next = width + (next - width) * 0.22; // 끝에서는 고무줄
    sim.current.x = next;
    d.samples.push({ t: e.timeStamp, x: e.clientX });
    if (d.samples.length > 6) d.samples.shift();
  };

  const finish = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.dir !== 'h') return;
    const s = sim.current;
    s.dragging = false;
    // 손 뗄 때 속도(왼쪽이 +) — 최근 100ms 안의 움직임으로
    const lastT = d.samples[d.samples.length - 1]?.t ?? 0;
    const recent = d.samples.filter((p) => lastT - p.t <= 100);
    const a = recent[0];
    const b = recent[recent.length - 1];
    const v = a && b && b.t > a.t ? -((b.x - a.x) / ((b.t - a.t) / 1000)) : 0;
    s.vx = Math.max(-3000, Math.min(3000, v));
    const willOpen = v > FLICK ? true : v < -FLICK ? false : s.x > width * 0.42;
    s.target = willOpen ? width : 0;
    kick();
    if (willOpen !== openRef.current) onOpenChange(willOpen);
  };

  const closeNow = () => {
    sim.current.target = 0;
    kick();
    onOpenChange(false);
  };

  return (
    <div className="relative overflow-hidden" style={{ WebkitTapHighlightColor: 'transparent' }}>
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-end"
        style={{ width, paddingLeft: PAD_L, paddingRight: PAD_R, gap: GAP }}
      >
        {actions.map((a, i) => (
          <button
            key={a.key}
            ref={(el) => { btnRefs.current[i] = el; }}
            type="button"
            aria-label={a.label}
            title={a.label}
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              closeNow();
              a.onClick();
            }}
            className="flex shrink-0 items-center justify-center rounded-full"
            style={{
              width: BTN,
              height: BTN,
              background: a.bg,
              transform: 'scale(0)',
              opacity: 0,
              visibility: 'hidden',
              willChange: 'transform',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span
              aria-hidden="true"
              className="block h-[24px] w-[24px] bg-white"
              style={{ WebkitMaskImage: `url(${a.icon})`, maskImage: `url(${a.icon})`, WebkitMaskSize: 'contain', maskSize: 'contain', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskPosition: 'center' }}
            />
          </button>
        ))}
      </div>
      <div
        ref={contentRef}
        className="relative bg-white"
        style={{ touchAction: 'pan-y', willChange: 'transform' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onClickCapture={(e) => {
          // 밀고 뗀 직후의 클릭, 또는 열린 줄을 누른 클릭은 이동하지 않고 닫기만
          if (moved.current || openRef.current || sim.current.x > 1) {
            e.preventDefault();
            e.stopPropagation();
            moved.current = false;
            if (openRef.current || sim.current.x > 1) closeNow();
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
