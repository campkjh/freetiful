'use client';

// 일반 화면 — 시간 · 도토리 · 추적 목표 1개 · 핵심 메뉴 · 행동 힌트 · 알림 · 구역 이름 · 저장 표시 · 모바일 조이스틱/행동 버튼.
import { useEffect, useRef, useState } from 'react';
import { useGame, dayOf, hourOf } from '../state/store';
import { useUI } from '../state/ui';
import { objectiveOf } from '../state/objective';
import { engineRef } from '../engine/Engine';
import { Icon, ItemIcon } from './icons';

function timeText(clock: number) {
  const h = hourOf(clock);
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  const ampm = hh < 12 ? '오전' : '오후';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${ampm} ${h12}:${String(Math.floor(mm / 10) * 10).padStart(2, '0')}`;
}

function periodOf(h: number) {
  if (h >= 5 && h < 9) return '아침';
  if (h >= 9 && h < 16.5) return '낮';
  if (h >= 16.5 && h < 19.5) return '노을';
  return '밤';
}

export function Hud() {
  const clock = useGame((s) => s.clock);
  const money = useGame((s) => s.money);
  const data = useGame();
  const saving = useUI((s) => s.saving);
  const saveError = useUI((s) => s.saveError);
  const mode = useUI((s) => s.mode);
  const obj = objectiveOf(data);
  const [flash, setFlash] = useState(false);
  const lastId = useRef(obj.id);
  useEffect(() => {
    if (lastId.current !== obj.id) {
      lastId.current = obj.id;
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 950);
      return () => clearTimeout(t);
    }
  }, [obj.id]);
  if (mode !== 'play') return null;
  const h = hourOf(clock);
  const night = h < 5.5 || h >= 19;
  const unread = data.letters.some((l) => !l.read);
  return (
    <>
      <div className="wf-hud-tl">
        <div className="wf-card wf-clock">
          <Icon name={night ? 'moon' : 'sun'} size={28} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: '1.02em' }}>
              {dayOf(clock)}일차 · {timeText(clock)}
            </div>
            <div style={{ fontSize: '0.8em', color: 'var(--wf-ink2)', fontWeight: 650 }}>{periodOf(h)}</div>
          </div>
          <div className="wf-row" style={{ gap: 4, fontWeight: 800 }}>
            <Icon name="acorn" size={22} />
            {money}
          </div>
        </div>
        <div className={`wf-card wf-goal ${flash ? 'flash' : ''}`} role="status" aria-live="polite">
          <div className="wf-row" style={{ gap: 6, fontSize: '0.8em', fontWeight: 750, color: 'var(--wf-green2)' }}>
            <Icon name="leaf" size={16} />
            {obj.status === 'ready' ? '완료 가능' : obj.status === 'available' ? '부탁 받기' : '지금 할 일'} · {obj.title}
          </div>
          <div style={{ marginTop: 4, fontWeight: 800, lineHeight: 1.4, wordBreak: 'keep-all' }}>{obj.next}</div>
          <div style={{ marginTop: 3, fontSize: '0.82em', color: 'var(--wf-ink2)', fontWeight: 650 }}>장소 · {obj.place}</div>
          {obj.progress && (
            <div className="wf-row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {obj.progress.map((p) => (
                <span key={p.label} className="wf-row" style={{ gap: 4, padding: '3px 9px', borderRadius: 999, background: p.have >= p.need ? '#E3EFD9' : '#fff', border: '2px solid var(--wf-line)', fontSize: '0.84em', fontWeight: 750 }}>
                  {p.have >= p.need && <Icon name="check" size={14} color="#46774A" />}
                  {p.label} {p.have}/{p.need}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="wf-hud-tr">
        {saving !== 'idle' && (
          <div className="wf-card wf-row" style={{ padding: '6px 12px', gap: 6, fontSize: '0.86em', fontWeight: 750, color: saving === 'error' ? 'var(--wf-warn)' : 'var(--wf-ink)' }}>
            <span style={{ display: 'inline-flex', animation: saving === 'saving' ? 'wfBob 600ms ease-in-out infinite' : undefined }}>
              <Icon name="save" size={18} />
            </span>
            {saving === 'saving' ? '저장 중' : saving === 'saved' ? '저장됨' : '저장 실패'}
            {saving === 'error' && (
              <button type="button" className="wf-btn small" onClick={() => engineRef.current?.save('retry', true)} title={saveError || ''}>
                다시
              </button>
            )}
          </div>
        )}
        <div className="wf-menu">
          <MenuBtn icon="bag" label="가방" kbd="I" onClick={() => useUI.getState().open('bag')} />
          <MenuBtn icon="map" label="지도" kbd="M" onClick={() => useUI.getState().open('map')} />
          <MenuBtn icon="album" label="앨범" kbd="J" onClick={() => useUI.getState().open('album')} dot={unread} />
          <MenuBtn icon="camera" label="사진" kbd="P" onClick={() => engineRef.current?.enterPhoto()} />
          <MenuBtn icon="gear" label="메뉴" kbd="Esc" onClick={() => useUI.getState().open('settings')} />
        </div>
      </div>
    </>
  );
}

function MenuBtn({ icon, label, kbd, onClick, dot }: { icon: any; label: string; kbd: string; onClick: () => void; dot?: boolean }) {
  return (
    <button
      type="button"
      className="wf-icon-btn"
      onClick={() => {
        engineRef.current?.sound.click();
        onClick();
      }}
      aria-label={`${label} (${kbd})`}
      title={`${label} (${kbd})`}
    >
      <Icon name={icon} size={26} />
      <span style={{ fontSize: 10, fontWeight: 750, marginTop: -1 }}>{label}</span>
      {dot && <span style={{ position: 'absolute', top: 6, right: 6, width: 9, height: 9, borderRadius: 9, background: '#E86F6F' }} />}
      <span className="wf-kbd wf-pc-only">{kbd}</span>
    </button>
  );
}

/** 행동 힌트(대상 위에 떠 있는 말풍선) — 위치는 엔진이 직접 옮긴다(매 프레임 React 다시 그리기 없이) */
export function Hint() {
  const ref = useRef<HTMLDivElement | null>(null);
  const hint = useUI((s) => s.hint);
  useEffect(() => {
    const e = engineRef.current;
    if (e) e.hintEl = ref.current;
    return () => {
      if (engineRef.current) engineRef.current.hintEl = null;
    };
  }, []);
  return (
    <div ref={ref} className="wf-hint" aria-hidden={!hint}>
      <div className="wf-hint-inner">
        <span className="wf-kbd wf-pc-only">E</span>
        <span>{hint?.label}</span>
      </div>
    </div>
  );
}

export function Toasts() {
  const toasts = useUI((s) => s.toasts);
  return (
    <div className="wf-toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`wf-toast ${t.tone}`}>
          {t.item ? <ItemIcon id={t.item} size={26} /> : <Icon name={t.tone === 'warn' ? 'help' : t.tone === 'gold' ? 'star' : 'leaf'} size={20} />}
          <span style={{ wordBreak: 'keep-all' }}>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

export function ZoneBanner() {
  const z = useUI((s) => s.zoneBanner);
  if (!z) return null;
  return (
    <div key={z.at} className="wf-zone">
      <div style={{ fontSize: '2.1em', fontWeight: 900, letterSpacing: -1 }}>{z.name}</div>
    </div>
  );
}

/** 모바일 — 왼쪽 가상 조이스틱 + 오른쪽 행동 버튼 */
export function TouchControls() {
  const [joy, setJoy] = useState<{ x: number; y: number; kx: number; ky: number } | null>(null);
  const hint = useUI((s) => s.hint);
  const mode = useUI((s) => s.mode);
  const blocking = useUI((s) => !!s.panel || !!s.dialogue);
  const idRef = useRef<number | null>(null);
  const start = (e: React.PointerEvent) => {
    if (idRef.current !== null) return;
    idRef.current = e.pointerId;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setJoy({ x: e.clientX, y: e.clientY, kx: 0, ky: 0 });
  };
  const move = (e: React.PointerEvent) => {
    if (e.pointerId !== idRef.current || !joy) return;
    let dx = e.clientX - joy.x;
    let dy = e.clientY - joy.y;
    const d = Math.hypot(dx, dy);
    const max = 52;
    if (d > max) {
      dx = (dx / d) * max;
      dy = (dy / d) * max;
    }
    setJoy({ ...joy, kx: dx, ky: dy });
    const inp = engineRef.current?.input;
    if (inp) {
      inp.joy.active = true;
      inp.joy.x = dx / max;
      inp.joy.y = dy / max;
    }
  };
  const end = (e: React.PointerEvent) => {
    if (e.pointerId !== idRef.current) return;
    idRef.current = null;
    setJoy(null);
    const inp = engineRef.current?.input;
    if (inp) {
      inp.joy.active = false;
      inp.joy.x = inp.joy.y = 0;
    }
  };
  if (blocking || mode === 'ceremony') return null;
  return (
    <>
      <div onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} style={{ position: 'absolute', left: 0, bottom: 0, width: '45%', height: '55%', touchAction: 'none' }} aria-label="이동 조이스틱 영역">
        {joy && (
          <div className="wf-joy" style={{ left: joy.x - 64, top: joy.y - 64 }}>
            <div className="wf-joy-knob" style={{ transform: `translate(${joy.kx}px, ${joy.ky}px)` }} />
          </div>
        )}
      </div>
      {mode === 'play' && (
        <button
          type="button"
          className={`wf-action ${hint ? 'on' : ''}`}
          onPointerDown={(e) => {
            e.preventDefault();
            const inp = engineRef.current?.input;
            if (inp) inp.action = true;
          }}
          aria-label={hint ? hint.label : '행동'}
        >
          {hint ? hint.label.slice(0, 12) : '행동'}
        </button>
      )}
    </>
  );
}

/** 개발용 성능 표시(?dev=1) */
export function PerfMeter() {
  const [p, setP] = useState({ fps: 0, ms: 0, calls: 0, tris: 0, worst: 0 });
  useEffect(() => {
    const t = setInterval(() => {
      const e = engineRef.current;
      if (e) setP({ ...e.perf });
    }, 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ position: 'absolute', left: 8, bottom: 8, padding: '4px 8px', borderRadius: 8, background: 'rgba(0,0,0,0.55)', color: '#fff', font: '600 11px ui-monospace, monospace', pointerEvents: 'none' }}>
      {p.fps}fps · {p.ms}ms · 최대 {p.worst}ms · draw {p.calls} · tri {(p.tris / 1000).toFixed(0)}k
    </div>
  );
}
