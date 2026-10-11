'use client';

// 웨딩런 점프·슬라이드 버튼(261011 사장 사양서 [3]·[7] — slide.png 왼쪽 아래 · jump.png 오른쪽 아래, 두 버튼 동시 터치 안정 처리)
//  · pointer 이벤트 + setPointerCapture — 손가락마다 따로 잡아서 두 버튼을 함께 눌러도 서로 안 뺏긴다.
//    버튼 하나에 손가락 여럿이어도(빠른 연타) 마지막 손가락이 뗄 때만 '뗌'. 점프는 손가락마다 새로 누름(2단 점프, 261011).
//  · 누르는 그 순간(pointerdown) 엔진에 알린다 — click(뗄 때)을 기다리면 점프가 늦다.
//  · 누를 때 0.95배. 브라우저 길게 누르기 메뉴·확대·스크롤은 touch-action:none + contextmenu 막기.
//  · 재개(resyncKey 바뀜) 때 아직 누르고 있는 슬라이드를 엔진에 다시 알린다 — 엔진은 일시정지·재개 때 입력을 지우므로,
//    슬라이드를 누른 채 다른 손가락으로 일시정지→재개하면 버튼은 눌린 모양인데 엔진은 안 숙이던 문제(261011 검증 low).
//    점프는 누르는 순간 한 번 뛰는 버튼이라 다시 알리지 않는다(재개하자마자 저절로 뛰지 않게).
import { useEffect, useRef, useState } from 'react';
import { WR_UI } from '../assets';

type Kind = 'jump' | 'slide';

function CtrlButton({
  kind,
  onInput,
  pulse,
  showKey,
  resyncKey,
}: {
  kind: Kind;
  onInput: (kind: Kind, down: boolean) => void;
  pulse: boolean;
  showKey: boolean;
  resyncKey: number;
}) {
  const pointers = useRef(new Set<number>());
  const [down, setDown] = useState(false);
  const inputRef = useRef(onInput);
  inputRef.current = onInput;

  const press = (id: number) => {
    const was = pointers.current.size > 0;
    if (pointers.current.has(id)) return;
    pointers.current.add(id);
    if (!was) setDown(true);
    // (261011 검증 low) 점프는 손가락마다 '새로 누름' — 두 손가락으로 톡톡 치는 사람도 공중 재입력(2단 점프)이 나간다.
    // 슬라이드는 누르고 있는 버튼이라 첫 손가락만(뗌은 둘 다 마지막 손가락 기준)
    if (!was || kind === 'jump') inputRef.current(kind, true);
  };
  const release = (id: number) => {
    if (!pointers.current.delete(id)) return;
    if (pointers.current.size === 0) {
      setDown(false);
      inputRef.current(kind, false);
    }
  };

  // 재개 직후: 아직 누르고 있는 슬라이드를 엔진에 다시 알림
  useEffect(() => {
    if (resyncKey > 0 && kind === 'slide' && pointers.current.size > 0) inputRef.current(kind, true);
  }, [resyncKey, kind]);

  // 화면에서 사라질 때 눌린 채로 남지 않게
  useEffect(() => {
    const set = pointers.current;
    return () => {
      if (set.size > 0) inputRef.current(kind, false);
      set.clear();
    };
  }, [kind]);

  const ui = WR_UI[kind];
  return (
    <button
      type="button"
      className={`wr-ctrl is-${kind}${down ? ' is-down' : ''}${pulse ? ' is-pulse' : ''}`}
      aria-label={kind === 'jump' ? '점프' : '슬라이드'}
      onPointerDown={(e) => {
        e.preventDefault();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* 캡처 불가 — 그대로 */
        }
        press(e.pointerId);
      }}
      onPointerUp={(e) => release(e.pointerId)}
      onPointerCancel={(e) => release(e.pointerId)}
      onLostPointerCapture={(e) => release(e.pointerId)}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => e.preventDefault()}
      tabIndex={-1}
    >
      <img src={ui.src} alt="" draggable={false} />
      {showKey && <span className="wr-ctrl-key">{kind === 'jump' ? 'Space · ↑' : '↓'}</span>}
    </button>
  );
}

export default function Controls({
  onInput,
  pulse,
  showKeys,
  resyncKey = 0,
}: {
  onInput: (kind: Kind, down: boolean) => void;
  pulse: Kind | null;
  showKeys: boolean;
  /** 엔진 재개 때마다 1씩 늘린다 */
  resyncKey?: number;
}) {
  return (
    <>
      <CtrlButton kind="slide" onInput={onInput} pulse={pulse === 'slide'} showKey={showKeys} resyncKey={resyncKey} />
      <CtrlButton kind="jump" onInput={onInput} pulse={pulse === 'jump'} showKey={showKeys} resyncKey={resyncKey} />
    </>
  );
}
