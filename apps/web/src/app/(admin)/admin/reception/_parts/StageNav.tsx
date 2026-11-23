'use client';

/* 크게 보기 판 화면 옮기기 햄버거(261123 사장 '퀴즈에서 럭키드로우 · 베스트드레서로 화면전환하는거 추가해줘 옆에 햄버거로 이동할 수 있게').
 *  · 판 오른쪽 위 닫기 단추 옆 ☰ → 퀴즈 · 럭키드로우 · 베스트드레서 · 전체 화면.
 *  · 옮기면 다음 화면이 ?stage=1 로 크게 보기 판을 바로 연다(useStageFromQuery).
 *  · 전체 화면이 판 요소에 걸려 있으면 페이지를 옮길 때 판이 사라지며 풀린다 → 누르는 순간(사용자 동작 안) 문서 전체로 옮겨 두고 넘어간다.
 *    문서 전체 전체 화면은 같은 문서 안 이동(router.push)이면 그대로 남아, 다음 화면의 판(position:fixed inset 0)이 화면을 꽉 채운다. */
import { Maximize, Menu, Minimize } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export type StageScreen = 'quiz' | 'draw' | 'dresser';

/** 지금 화면 안에서 고르는 줄(261123 사장 '럭키드로우 햄버거에 어떤거 할건지도 다 뜨게끔') — 예: 럭키드로우 경품 종류 */
export type StageMenuSection = {
  title: string;
  items: { key: string; label: string; sub?: string; on?: boolean; disabled?: boolean; onSelect: () => void }[];
};

const SCREENS: { key: StageScreen; label: string; href: string }[] = [
  { key: 'quiz', label: '퀴즈', href: '/admin/reception/quiz' },
  { key: 'draw', label: '럭키드로우', href: '/admin/reception/draw' },
  { key: 'dresser', label: '베스트드레서', href: '/admin/reception/dresser' },
];

export function StageNav({ current, section }: { current: StageScreen; section?: StageMenuSection }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = () => setFull(!!document.fullscreenElement);
    sync();
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  // 바깥을 누르거나 ESC 면 닫기(ESC 는 판까지 닫지 않게 여기서 멈춘다)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const go = async (href: string) => {
    setOpen(false);
    const fe = document.fullscreenElement;
    if (fe && fe !== document.documentElement) await document.documentElement.requestFullscreen?.().catch(() => {});
    router.push(`${href}?stage=1`);
  };

  const toggleFull = async () => {
    setOpen(false);
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    else await document.documentElement.requestFullscreen?.().catch(() => {});
  };

  return (
    <div className="rca-stage-nav" ref={box}>
      <button type="button" className="rca-stage-close rca-stage-nav-btn" aria-label="화면 옮기기" aria-haspopup="menu" aria-expanded={open} title="화면 옮기기" onClick={() => setOpen((v) => !v)}>
        <Menu size={20} aria-hidden="true" />
      </button>
      {open && (
        <div className="rca-stage-menu" role="menu" aria-label="화면 옮기기">
          {section && section.items.length > 0 && (
            <>
              <p className="rca-stage-menu-title">{section.title}</p>
              {section.items.map((it) => (
                <button
                  key={it.key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={!!it.on}
                  className={`rca-stage-menu-item pick${it.on ? ' on' : ''}`}
                  disabled={it.disabled}
                  onClick={() => {
                    setOpen(false);
                    if (!it.on) it.onSelect();
                  }}
                >
                  <span className="rca-stage-menu-pick">
                    <b>{it.label}</b>
                    {it.sub && <small>{it.sub}</small>}
                  </span>
                </button>
              ))}
              <hr />
              <p className="rca-stage-menu-title">화면</p>
            </>
          )}
          {SCREENS.map((s) => (
            <button
              key={s.key}
              type="button"
              role="menuitem"
              className={`rca-stage-menu-item${s.key === current ? ' on' : ''}`}
              aria-current={s.key === current ? 'page' : undefined}
              onClick={() => (s.key === current ? setOpen(false) : void go(s.href))}
            >
              {s.label}
              {s.key === current && <small>지금 화면</small>}
            </button>
          ))}
          <hr />
          <button type="button" role="menuitem" className="rca-stage-menu-item" onClick={() => void toggleFull()}>
            {full ? <Minimize size={18} aria-hidden="true" /> : <Maximize size={18} aria-hidden="true" />}
            {full ? '전체 화면 끄기' : '전체 화면'}
          </button>
        </div>
      )}
    </div>
  );
}

/** ?stage=1 로 들어오면 크게 보기 판을 바로 연다(햄버거로 옮겨 온 화면) — 주소에서 stage 는 지운다(새로고침에 다시 안 열리게).
 *  useSearchParams 대신 location 을 읽는다(정적 빌드에서 Suspense 경계가 필요 없게). */
export function useStageFromQuery(openStage: () => void) {
  const ref = useRef(openStage);
  ref.current = openStage;
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get('stage') !== '1') return;
    q.delete('stage');
    const rest = q.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${rest ? `?${rest}` : ''}`);
    ref.current();
  }, []);
}
