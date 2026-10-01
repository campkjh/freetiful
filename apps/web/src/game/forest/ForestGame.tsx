'use client';

// 결혼의 숲 — 화면 뿌리. 3D 엔진(캔버스) 위에 HUD·대화·창·모드 화면을 겹친다.
import { useEffect, useRef, useState } from 'react';
import './forest.css';
import { Engine, engineRef } from './engine/Engine';
import { useUI } from './state/ui';
import { useGame } from './state/store';
import { loadGame } from './state/save';
import { Hud, Hint, Toasts, ZoneBanner, TouchControls, PerfMeter } from './ui/Hud';
import DialogueBox from './ui/Dialogue';
import PanelHost from './ui/Panels';
import { DecorToolbar, CeremonyOverlay, PhotoUI } from './ui/Modes';
import { TitleScreen, CreateScreen } from './ui/Title';

export default function ForestGame() {
  const host = useRef<HTMLDivElement | null>(null);
  const flashRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const screen = useUI((s) => s.screen);
  const mode = useUI((s) => s.mode);
  const fade = useUI((s) => s.fade);
  const bigText = useGame((s) => s.settings.bigText);
  const [touch, setTouch] = useState(false);
  const [dev, setDev] = useState(false);
  useEffect(() => setDev(/[?&]dev=1/.test(window.location.search)), []);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let engine: Engine | null = null;
    try {
      // 저장본이 있으면 설정(품질 등)을 먼저 반영
      const r = loadGame();
      if (r.data) useGame.getState().hydrate(r.data);
      else if (window.matchMedia?.('(pointer: coarse)').matches || Math.min(window.innerWidth, window.innerHeight) < 600) {
        // 휴대폰은 처음부터 '낮음'(그림자·풀 밀도·해상도 축소) — 설정에서 바꿀 수 있다
        useGame.getState().setSettings({ quality: 'low' });
      }
      useUI.getState().set({ loadIssue: r.damaged && r.source === 'none' ? '저장 데이터가 손상됐어요. 새로 시작해 주세요.' : r.damaged ? '최근 저장본이 손상돼 이전 정상 저장본으로 이어할 수 있어요.' : null });
      engine = new Engine(el);
      engine.setFlashEl(flashRef.current);
      useUI.getState().set({ screen: 'title' });
    } catch (e: any) {
      console.error(e);
      setFailed('3D 화면을 시작하지 못했어요. 브라우저의 하드웨어 가속(WebGL)을 켜거나 다른 브라우저로 열어 주세요.');
    }
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    setTouch(!!coarse || 'ontouchstart' in window);
    return () => {
      engine?.dispose();
    };
  }, []);

  // 전역 단축키 — Esc 메뉴/닫기 · I 가방 · M 지도 · J 앨범 · P 사진 · H 조작법
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      const ui = useUI.getState();
      if (ui.screen !== 'play') return;
      const eng = engineRef.current;
      if (e.code === 'Escape') {
        if (ui.dialogue) return;
        if (ui.panel) {
          eng?.sound.close();
          ui.close();
          return;
        }
        if (ui.mode === 'photo') {
          eng?.exitPhoto();
          return;
        }
        if (ui.mode === 'decor' || ui.mode === 'ceremony') return; // 각 화면이 확인을 띄운다
        ui.open('settings');
        eng?.sound.open();
        return;
      }
      if (ui.dialogue || ui.mode !== 'play') {
        if (ui.mode === 'decor' && (e.code === 'Enter' || e.code === 'NumpadEnter') && !ui.panel) eng?.exitDecor(true);
        return;
      }
      const toggle = (p: Parameters<typeof ui.open>[0]) => {
        if (ui.panel === p) {
          ui.close();
          eng?.sound.close();
        } else {
          ui.open(p);
          eng?.sound.open();
        }
      };
      if (e.code === 'KeyI') toggle('bag');
      else if (e.code === 'KeyM') toggle('map');
      else if (e.code === 'KeyJ') toggle('album');
      else if (e.code === 'KeyH') toggle('help');
      else if (e.code === 'KeyP' && !ui.panel) eng?.enterPhoto();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={`wf-root ${bigText ? 'wf-big' : ''} ${touch ? 'wf-touch' : ''}`}>
      <div ref={host} className="wf-canvas" />
      <div className="wf-layer">
        {screen === 'play' && (
          <>
            <Hint />
            {mode === 'play' && <Hud />}
            {mode === 'decor' && <DecorToolbar />}
            {mode === 'ceremony' && <CeremonyOverlay />}
            {mode === 'photo' && <PhotoUI />}
            {touch && <TouchControls />}
            <ZoneBanner />
            <PanelHost />
            <DialogueBox />
          </>
        )}
        {screen === 'title' && <TitleScreen />}
        {screen === 'create' && <CreateScreen />}
        {screen === 'loading' && !failed && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 22 }}>결혼의 숲을 불러오는 중…</div>
        )}
        {failed && (
          <div className="wf-modal-wrap">
            <div className="wf-panel" style={{ padding: 22, maxWidth: 440, lineHeight: 1.6, fontWeight: 650, wordBreak: 'keep-all' }}>
              {failed}
              <div style={{ marginTop: 12 }}>
                <button type="button" className="wf-btn" onClick={() => window.location.reload()}>
                  다시 시도
                </button>
              </div>
            </div>
          </div>
        )}
        <Toasts />
        {dev && <PerfMeter />}
        <div className="wf-fade" style={{ opacity: fade }} />
        <div ref={flashRef} className="wf-flash" />
      </div>
    </div>
  );
}
