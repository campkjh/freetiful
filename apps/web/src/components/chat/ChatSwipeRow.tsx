'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/* ════════════════════════════════════════════════════════════════
 * 채팅 목록 한 줄 — 오른쪽→왼쪽으로 밀면 동그란 버튼(알림 끄기 · 삭제)이 드러난다(당근 채팅 목록 어법, 2026-09-25 사장 지시).
 *  · 버튼은 작게 숨어 있다가 **드러나는 순서대로**(오른쪽 삭제 → 왼쪽 알림) 통통 튀며 커진다(globals .swipe-act).
 *  · 세로 스크롤은 브라우저에 맡긴다(touch-action: pan-y) — 가로로 먼저 움직일 때만 민다.
 *  · 손을 떼면 절반 가까이 열렸으면 끝까지 열고, 아니면 닫는다. 열린 줄을 누르면 이동 대신 닫힌다.
 *  · 미는 동안엔 이 줄만 다시 그린다 — children 은 부모가 만든 같은 요소라 React 가 건너뛴다.
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
  const [dx, setDx] = useState(0); // 드러난 폭
  const [dragging, setDragging] = useState(false);
  const [snapOpening, setSnapOpening] = useState(false); // 손 떼서 끝까지 열리는 중 — 남은 버튼은 순서대로 늦게 튄다
  const dxRef = useRef(0);
  const start = useRef<{ x: number; y: number; base: number; dir: 'h' | 'v' | null } | null>(null);
  const moved = useRef(false);
  // 버튼마다 '한 번이라도 튀어나왔나' — 나온 적 있는 버튼만 닫힐 때 줄어드는 애니를 쓴다
  // (아직 안 나온 버튼에 줄어드는 애니를 걸면 밀기 시작 순간 한 번 번쩍 보였다 사라진다)
  const everIn = useRef<boolean[]>([]);

  const setReveal = (v: number) => {
    dxRef.current = v;
    setDx(v);
  };

  // 밖에서 열고 닫힘이 바뀌면(다른 줄을 건드림·스크롤) 따라간다
  useEffect(() => {
    if (dragging) return;
    setReveal(open ? width : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!snapOpening) return;
    const t = setTimeout(() => setSnapOpening(false), 450);
    return () => clearTimeout(t);
  }, [snapOpening]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    start.current = { x: e.clientX, y: e.clientY, base: open ? width : 0, dir: null };
    moved.current = false;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s) return;
    const mx = e.clientX - s.x;
    const my = e.clientY - s.y;
    if (!s.dir) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
      s.dir = Math.abs(mx) > Math.abs(my) ? 'h' : 'v';
      if (s.dir === 'h') {
        moved.current = true;
        setDragging(true);
        onSwipeStart?.();
        try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
      }
    }
    if (s.dir !== 'h') return;
    let next = s.base - mx; // 왼쪽으로 밀수록 +
    if (next < 0) next = 0;
    if (next > width) next = width + (next - width) * 0.25; // 끝에서는 고무줄
    setReveal(next);
  };

  const finish = () => {
    const s = start.current;
    start.current = null;
    if (!s || s.dir !== 'h') return;
    setDragging(false);
    const willOpen = dxRef.current > width * 0.42;
    if (willOpen && dxRef.current < width) setSnapOpening(true);
    setReveal(willOpen ? width : 0);
    onOpenChange(willOpen);
  };

  // 버튼이 드러나는 자리 — 오른쪽 끝부터 채워진다(오른쪽 버튼이 먼저)
  const revealAt = (fromRight: number) => PAD_R + fromRight * (BTN + GAP) + BTN * 0.5;

  return (
    <div className="relative overflow-hidden">
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-end"
        style={{ width, paddingLeft: PAD_L, paddingRight: PAD_R, gap: GAP }}
        aria-hidden={dx < width}
      >
        {actions.map((a, i) => {
          const fromRight = actions.length - 1 - i;
          const shown = dx >= revealAt(fromRight);
          const cls = shown ? 'is-in' : everIn.current[i] ? 'is-out' : '';
          if (shown) everIn.current[i] = true;
          return (
            <button
              key={a.key}
              type="button"
              aria-label={a.label}
              title={a.label}
              tabIndex={dx >= width ? 0 : -1}
              onClick={(e) => {
                e.stopPropagation();
                onOpenChange(false);
                a.onClick();
              }}
              className={`swipe-act flex shrink-0 items-center justify-center rounded-full ${cls}`}
              style={{
                width: BTN,
                height: BTN,
                background: a.bg,
                // 손 떼서 한 번에 열릴 땐 오른쪽부터 차례로 — 왼쪽 버튼일수록 늦게 튄다
                animationDelay: shown && snapOpening ? `${fromRight * 0.08}s` : undefined,
              }}
            >
              <span
                aria-hidden="true"
                className="block h-[24px] w-[24px] bg-white"
                style={{ WebkitMaskImage: `url(${a.icon})`, maskImage: `url(${a.icon})`, WebkitMaskSize: 'contain', maskSize: 'contain', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskPosition: 'center' }}
              />
            </button>
          );
        })}
      </div>
      <div
        className="relative bg-white"
        style={{
          transform: `translateX(${-dx}px)`,
          transition: dragging ? 'none' : 'transform 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.04)',
          touchAction: 'pan-y',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onClickCapture={(e) => {
          // 밀고 뗀 직후의 클릭, 또는 열린 줄을 누른 클릭은 이동하지 않고 닫기만
          if (moved.current || open) {
            e.preventDefault();
            e.stopPropagation();
            moved.current = false;
            if (open) onOpenChange(false);
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
