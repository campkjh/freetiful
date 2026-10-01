'use client';

// 모드별 화면 — 꾸미기 도구 막대 · 예식(자막·건너뛰기·중단) · 사진 모드(포즈·표정·프레임·심도·UI 숨김).
import { useEffect, useState } from 'react';
import { useGame, ceremonyReadiness } from '../state/store';
import { useUI } from '../state/ui';
import { DECOR } from '../data/decor';
import { ITEMS } from '../data/items';
import { engineRef } from '../engine/Engine';
import { Icon, ItemIcon } from './icons';

export function DecorToolbar() {
  const d = useUI((s) => s.decor);
  const bag = useGame((s) => s.bag);
  const data = useGame();
  const [confirm, setConfirm] = useState(false);
  if (!d) return null;
  const owned = Array.from(new Set(bag.filter(Boolean).map((s) => s!.id)))
    .filter((id) => ITEMS[id]?.decor && DECOR[ITEMS[id].decor!]?.areas.includes(d.area))
    .map((id) => ({ id, decor: ITEMS[id].decor!, n: bag.reduce((a, s) => a + (s && s.id === id ? s.qty : 0), 0) }));
  const ready = d.area === 'garden' ? ceremonyReadiness(data.snapshot()).items.filter((i) => ['arch', 'aisle', 'seats'].includes(i.key)) : [];
  const e = engineRef.current;
  const tone = d.tone === 'ok' ? '#46774A' : d.tone === 'warn' ? '#C98A2E' : '#C5533B';
  return (
    <>
      <div className="wf-card" style={{ position: 'absolute', top: 'max(14px, env(safe-area-inset-top))', left: '50%', transform: 'translateX(-50%)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, maxWidth: 'calc(100vw - 28px)' }}>
        <Icon name={d.tone === 'ok' ? 'check' : 'help'} size={20} color={tone} />
        <span style={{ fontWeight: 800, color: tone, wordBreak: 'keep-all' }}>{d.status}</span>
      </div>
      {ready.length > 0 && (
        <div className="wf-card" style={{ position: 'absolute', top: 'max(70px, calc(env(safe-area-inset-top) + 56px))', left: 'max(14px, env(safe-area-inset-left))', padding: 12, display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 260 }}>
          <div style={{ fontWeight: 850, fontSize: '0.9em' }}>예식 준비</div>
          {ready.map((i) => (
            <div key={i.key} className="wf-row" style={{ gap: 6, fontSize: '0.86em', fontWeight: 700 }}>
              <Icon name={i.ok ? 'check' : 'x'} size={16} color={i.ok ? '#46774A' : '#D9785F'} />
              <span style={{ wordBreak: 'keep-all' }}>
                {i.label} · {i.detail}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="wf-panel" style={{ position: 'absolute', left: '50%', bottom: 'max(14px, env(safe-area-inset-bottom))', transform: 'translateX(-50%)', width: 'min(900px, calc(100vw - 20px))', padding: 12 }}>
        <div className="wf-row" style={{ gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
          {owned.length === 0 && <span style={{ color: 'var(--wf-ink2)', fontWeight: 650, padding: '10px 4px' }}>가방에 놓을 장식이 없어요. 공방 작업대에서 만들어 보세요.</span>}
          {owned.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                e?.decorEditor.select(d.selected === o.decor ? null : o.decor);
                e?.sound.click();
              }}
              className={`wf-slot ${d.selected === o.decor ? 'on' : ''}`}
              style={{ width: 64, minWidth: 64, aspectRatio: '1' }}
              aria-label={`${ITEMS[o.id].name} ${o.n}개`}
            >
              <ItemIcon id={o.id} size={40} />
              <span className="wf-qty">{o.n}</span>
            </button>
          ))}
        </div>
        <div className="wf-row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="wf-btn small ghost" onClick={() => e?.decorEditor.rotate()}>
            <Icon name="rotate" size={18} /> 회전 <span className="wf-kbd wf-pc-only">R</span>
          </button>
          <button type="button" className="wf-btn small ghost" disabled={!d.hover} onClick={() => e?.decorEditor.retrieveHover({ place: () => e.sound.place() })}>
            <Icon name="bag" size={18} /> 회수 <span className="wf-kbd wf-pc-only">X</span>
          </button>
          <button type="button" className="wf-btn small ghost" onClick={() => useGame.getState().undoEdit()}>
            <Icon name="undo" size={18} /> 되돌리기
          </button>
          <button type="button" className={`wf-btn small ${d.snap ? '' : 'ghost'}`} onClick={() => e?.decorEditor.toggleSnap()}>
            <Icon name="grid" size={18} /> {d.snap ? '칸 맞추기' : '자유 배치'} <span className="wf-kbd wf-pc-only">G</span>
          </button>
          <span style={{ flex: 1 }} />
          {confirm ? (
            <>
              <span style={{ fontWeight: 700 }}>바꾼 배치를 버릴까요?</span>
              <button type="button" className="wf-btn small ghost" onClick={() => setConfirm(false)}>
                계속 꾸미기
              </button>
              <button type="button" className="wf-btn small pink" onClick={() => e?.exitDecor(false)}>
                버리기
              </button>
            </>
          ) : (
            <>
              <button type="button" className="wf-btn small ghost" onClick={() => setConfirm(true)}>
                취소
              </button>
              <button type="button" className="wf-btn small" onClick={() => e?.exitDecor(true)}>
                <Icon name="check" size={18} /> 완료
              </button>
            </>
          )}
        </div>
        <p className="wf-pc-only" style={{ marginTop: 8, fontSize: '0.8em', color: 'var(--wf-ink2)' }}>
          장식을 고르고 바닥을 눌러 놓아요 · 놓인 장식을 누르면 옮기기 · 키보드로는 WASD로 위치를 옮기고 E로 놓아요
        </p>
      </div>
    </>
  );
}

export function CeremonyOverlay() {
  const c = useUI((s) => s.ceremony);
  const photo = useUI((s) => s.photo);
  const [askAbort, setAskAbort] = useState(false);
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.code === 'Escape') setAskAbort((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  if (!c) return null;
  const e = engineRef.current;
  const done = c.step === 'done';
  return (
    <>
      <div className="wf-letterbox" style={{ top: 0 }} />
      <div className="wf-letterbox" style={{ bottom: 0 }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: '9vh', height: 4, background: 'rgba(255,255,255,0.15)' }}>
        <div style={{ width: `${c.progress * 100}%`, height: '100%', background: '#F6D46B', transition: 'width 300ms linear' }} />
      </div>
      {c.caption && (
        <div className="wf-caption" key={c.caption}>
          {c.speaker && <span style={{ display: 'inline-block', padding: '3px 12px', marginRight: 8, borderRadius: 999, background: c.speaker === '도담' ? '#C9824F' : '#7FA3C7', fontSize: '0.8em' }}>{c.speaker}</span>}
          {c.caption}
        </div>
      )}
      {c.countdown && (
        <div className="wf-count" key={c.countdown}>
          {c.countdown}
        </div>
      )}
      {photo?.last && c.step !== 'intro' && c.progress > 0.9 && (
        <div className="wf-card" style={{ position: 'absolute', right: 20, bottom: 'calc(9vh + 20px)', padding: 8, width: 220, transform: 'rotate(2deg)', animation: 'wfPop 300ms ease both' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.last.thumb} alt="단체 사진" style={{ width: '100%', borderRadius: 8, display: 'block' }} />
          <div style={{ fontSize: 12, fontWeight: 750, marginTop: 4 }}>{photo.last.ok ? '앨범에 저장했어요' : '저장 실패 · 메모리에만 있어요'}</div>
        </div>
      )}
      {!done && (
        <div style={{ position: 'absolute', top: 'calc(9vh + 14px)', right: 16, display: 'flex', gap: 8 }}>
          <button type="button" className="wf-btn small ghost" onClick={() => setAskAbort(true)}>
            중단
          </button>
          <button type="button" className="wf-btn small" onClick={() => e?.skipCeremony()}>
            건너뛰기 <Icon name="arrow" size={16} />
          </button>
        </div>
      )}
      {askAbort && !done && (
        <div className="wf-modal-wrap">
          <div className="wf-panel" style={{ padding: 20, width: 'min(420px, calc(100vw - 32px))' }}>
            <div style={{ fontWeight: 850, fontSize: '1.1em' }}>예식을 멈출까요?</div>
            <p style={{ marginTop: 8, lineHeight: 1.6, color: 'var(--wf-ink2)', wordBreak: 'keep-all' }}>시작 전 상태로 돌아가요. 보상은 예식을 마쳤을 때만 받을 수 있고, 언제든 다시 시작할 수 있어요.</p>
            <div className="wf-row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
              <button type="button" className="wf-btn ghost" onClick={() => setAskAbort(false)}>
                계속 보기
              </button>
              <button
                type="button"
                className="wf-btn pink"
                onClick={() => {
                  setAskAbort(false);
                  e?.abortCeremony();
                }}
              >
                멈추기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const POSES: Array<[string, string]> = [
  ['idle', '기본'],
  ['wave', '손 흔들기'],
  ['peace', '브이'],
  ['heart', '하트'],
  ['hold', '부케 들기'],
  ['think', '생각 중'],
];
const EXPRS: Array<[string, string]> = [
  ['smile', '웃음'],
  ['joy', '기쁨'],
  ['shy', '수줍음'],
  ['surprise', '놀람'],
  ['normal', '차분'],
];

export function PhotoUI() {
  const p = useUI((s) => s.photo);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const e = engineRef.current;
  useEffect(() => {
    if (!p) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.code === 'Space' || ev.code === 'Enter') {
        ev.preventDefault();
        void shoot();
      } else if (ev.code === 'KeyH') setHidden((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p, busy]);
  if (!p) return null;
  const set = (patch: Partial<typeof p>) => useUI.getState().set({ photo: { ...p, ...patch } });
  async function shoot() {
    if (busy || !e) return;
    setBusy(true);
    const prev = hidden;
    setHidden(true);
    await new Promise((r) => setTimeout(r, 60));
    const r = await e.capturePhoto();
    setHidden(prev);
    const cur = useUI.getState().photo;
    if (cur) useUI.getState().set({ photo: { ...cur, last: { id: r.id, thumb: r.thumb, ok: r.ok } } });
    setBusy(false);
  }
  if (hidden) {
    return (
      <button type="button" className="wf-btn ghost small" style={{ position: 'absolute', right: 16, bottom: 'max(16px, env(safe-area-inset-bottom))', opacity: busy ? 0 : 0.85 }} onClick={() => setHidden(false)}>
        UI 보이기 <span className="wf-kbd wf-pc-only">H</span>
      </button>
    );
  }
  const frameStyle: React.CSSProperties | null =
    p.frame === 'polaroid' ? { position: 'absolute', inset: 0, border: '3.5vw solid #FFFDF8', borderBottomWidth: '10.5vw', pointerEvents: 'none' } : p.frame === 'flower' ? { position: 'absolute', inset: 0, boxShadow: 'inset 0 0 0 1.8vw rgba(255,255,255,0.75), inset 0 0 0 2.6vw rgba(244,185,201,0.6)', pointerEvents: 'none' } : null;
  return (
    <>
      {frameStyle && <div style={frameStyle} />}
      <div className="wf-card" style={{ position: 'absolute', top: 'max(14px, env(safe-area-inset-top))', left: '50%', transform: 'translateX(-50%)', padding: '8px 14px', fontWeight: 750 }}>
        사진 모드 · 끌거나 A/D로 돌리고, W/S로 높이를 바꿔요
      </div>
      <div className="wf-panel" style={{ position: 'absolute', left: '50%', bottom: 'max(14px, env(safe-area-inset-bottom))', transform: 'translateX(-50%)', width: 'min(920px, calc(100vw - 20px))', padding: 12, display: 'grid', gap: 10 }}>
        <div className="wf-row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <span className="wf-label" style={{ margin: 0, minWidth: 34 }}>포즈</span>
          {POSES.map(([id, l]) => (
            <button
              key={id}
              type="button"
              className={`wf-chip ${p.pose === id ? 'on' : ''}`}
              onClick={() => {
                set({ pose: id });
                if (id === 'hold') e?.toggleBouquet();
                e?.setPhotoPose(id, p.expr);
              }}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="wf-row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <span className="wf-label" style={{ margin: 0, minWidth: 34 }}>표정</span>
          {EXPRS.map(([id, l]) => (
            <button
              key={id}
              type="button"
              className={`wf-chip ${p.expr === id ? 'on' : ''}`}
              onClick={() => {
                set({ expr: id });
                e?.setPhotoPose(p.pose, id);
              }}
            >
              {l}
            </button>
          ))}
          <span className="wf-label" style={{ margin: '0 0 0 10px', minWidth: 34 }}>프레임</span>
          {(
            [
              ['none', '없음'],
              ['polaroid', '폴라로이드'],
              ['flower', '꽃'],
            ] as const
          ).map(([id, l]) => (
            <button key={id} type="button" className={`wf-chip ${p.frame === id ? 'on' : ''}`} onClick={() => set({ frame: id })}>
              {l}
            </button>
          ))}
        </div>
        <div className="wf-row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <label style={{ flex: 1, minWidth: 160 }}>
            <div className="wf-label">거리</div>
            <input className="wf-range" type="range" min={2} max={9} step={0.1} value={p.zoom} onChange={(ev) => set({ zoom: Number(ev.target.value) })} />
          </label>
          <label style={{ flex: 1, minWidth: 160 }}>
            <div className="wf-label">배경 흐림</div>
            <input className="wf-range" type="range" min={0} max={3} step={0.5} value={p.dof} onChange={(ev) => set({ dof: Number(ev.target.value) })} />
          </label>
          <button type="button" className="wf-btn ghost" onClick={() => setHidden(true)}>
            UI 숨기기
          </button>
          <button type="button" className="wf-btn ghost" onClick={() => e?.exitPhoto()}>
            닫기
          </button>
          <button type="button" className="wf-btn gold" style={{ minWidth: 120, minHeight: 54 }} disabled={busy} onClick={() => void shoot()}>
            <Icon name="camera" size={22} /> {busy ? '찍는 중' : '찍기'}
          </button>
        </div>
        {p.last && (
          <div className="wf-row" style={{ gap: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.last.thumb} alt="방금 찍은 사진" style={{ width: 96, borderRadius: 10, border: '3px solid #fff', boxShadow: '0 4px 10px rgba(0,0,0,0.15)' }} />
            <span style={{ fontWeight: 750, color: p.last.ok ? 'var(--wf-green2)' : 'var(--wf-warn)' }}>{p.last.ok ? '앨범에 저장했어요' : '이 브라우저에 저장하지 못했어요 · 다시 찍어 주세요'}</span>
            {!p.last.ok && (
              <button type="button" className="wf-btn small" onClick={() => void shoot()}>
                다시 시도
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
