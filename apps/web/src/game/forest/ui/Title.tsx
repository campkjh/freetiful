'use client';

// 타이틀(대표 장면 위) · 새로 시작 / 이어하기 · 나와 파트너 만들기.
import { useState } from 'react';
import WardrobeEditor from './Wardrobe';
import { useGame, newGameData } from '../state/store';
import { useUI } from '../state/ui';
import { clearSave, hasSave, loadGame, saveGame } from '../state/save';
import { engineRef } from '../engine/Engine';
import { DEFAULT_PARTNER, DEFAULT_PLAYER, type Appearance } from '../data/appearance';

export function TitleScreen() {
  const loadIssue = useUI((s) => s.loadIssue);
  const [confirmNew, setConfirmNew] = useState(false);
  const saved = typeof window !== 'undefined' && hasSave();

  const begin = () => engineRef.current?.startAudio();

  const cont = () => {
    begin();
    const r = loadGame();
    if (!r.data) {
      useUI.getState().set({ loadIssue: '저장 데이터를 읽을 수 없어요. 새로 시작해 주세요.' });
      return;
    }
    useGame.getState().hydrate(r.data);
    const e = engineRef.current;
    e?.loadFromStore();
    e?.endTitle();
    useUI.getState().set({ screen: 'play', loadIssue: null });
    if (r.source === 'prev') useUI.getState().toast('최근 저장본이 손상돼 이전 정상 저장본으로 복구했어요', 'warn');
    else useUI.getState().toast('다시 만나서 반가워요!', 'ok');
  };

  const startNew = () => {
    begin();
    if (saved && !confirmNew) {
      setConfirmNew(true);
      return;
    }
    clearSave();
    useGame.getState().hydrate(newGameData());
    useUI.getState().set({ screen: 'create', loadIssue: null });
  };

  return (
    <div className="wf-title-wrap">
      <div className="wf-logo">결혼의 숲</div>
      <p className="wf-sub" style={{ fontSize: '1.05em', maxWidth: 520 }}>
        귀여운 아바타로 숲을 가꾸고, 동물 친구들과 우리의 결혼식과 일상을 만드는 게임
      </p>
      <div className="wf-panel wf-title-panel">
        {loadIssue && <p style={{ color: 'var(--wf-warn)', fontWeight: 700, lineHeight: 1.5, wordBreak: 'keep-all' }}>{loadIssue}</p>}
        {saved && !confirmNew && (
          <button type="button" className="wf-btn" style={{ minHeight: 54, fontSize: '1.08em' }} onClick={cont}>
            이어하기
          </button>
        )}
        {confirmNew ? (
          <>
            <p style={{ fontWeight: 700, lineHeight: 1.5, wordBreak: 'keep-all' }}>이 브라우저에 저장된 진행을 지우고 처음부터 시작할까요?</p>
            <div className="wf-row">
              <button type="button" className="wf-btn ghost" style={{ flex: 1 }} onClick={() => setConfirmNew(false)}>
                그만두기
              </button>
              <button type="button" className="wf-btn pink" style={{ flex: 1 }} onClick={startNew}>
                새로 시작
              </button>
            </div>
          </>
        ) : (
          <button type="button" className={`wf-btn ${saved ? 'ghost' : ''}`} style={{ minHeight: 54, fontSize: '1.08em' }} onClick={startNew}>
            새로 시작하기
          </button>
        )}
        <p style={{ fontSize: '0.8em', color: 'var(--wf-ink2)', lineHeight: 1.5, textAlign: 'center', wordBreak: 'keep-all' }}>진행은 이 브라우저에만 저장돼요 · PC는 WASD 이동, E 행동</p>
      </div>
    </div>
  );
}

export function CreateScreen() {
  const [step, setStep] = useState<'me' | 'partner'>('me');
  const [meName, setMeName] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [me, setMe] = useState<Appearance>({ ...DEFAULT_PLAYER });
  const [partner, setPartner] = useState<Appearance>({ ...DEFAULT_PARTNER });

  const finish = () => {
    const g = useGame.getState();
    g.setNames(meName || '지우', partnerName || '하루');
    g.setLook('me', me);
    g.setLook('partner', partner);
    g.startGame();
    saveGame(useGame.getState().snapshot());
    const e = engineRef.current;
    e?.loadFromStore();
    e?.endTitle();
    useUI.getState().set({ screen: 'play' });
    setTimeout(() => {
      useUI.getState().sayLines([
        { who: 'partner', text: `여기가 결혼의 숲이구나! ${meName || '지우'}, 우리 여기서 결혼식 올리자.`, expr: 'joy' },
        { who: 'sys', text: 'WASD(또는 방향키)로 걸어요. 화면에 뜨는 E 표시로 꽃을 따고 이웃과 이야기해요. 모바일은 왼쪽 아래를 끌어서 움직여요.' },
        { who: 'sys', text: '왼쪽 위의 목표를 따라가 보세요. 먼저 꽃잎 온실의 소담에게 인사해요!' },
      ]);
    }, 600);
  };

  const isMe = step === 'me';
  return (
    <div className="wf-modal-wrap" style={{ background: 'rgba(24,34,26,0.25)' }}>
      <div className="wf-panel wf-modal" style={{ width: 'min(900px, 100%)' }}>
        <div className="wf-modal-head">
          <div className="wf-modal-title">{isMe ? '나를 만들어요' : '함께할 파트너를 만들어요'}</div>
          <span style={{ fontWeight: 700, color: 'var(--wf-ink2)' }}>{isMe ? '1' : '2'} / 2</span>
        </div>
        <div className="wf-modal-body">
          <div style={{ marginBottom: 12 }}>
            <p className="wf-label">{isMe ? '내 이름' : '파트너 이름'}</p>
            <input
              className="wf-input"
              maxLength={8}
              placeholder={isMe ? '비워 두면 지우' : '비워 두면 하루'}
              value={isMe ? meName : partnerName}
              onChange={(e) => (isMe ? setMeName(e.target.value) : setPartnerName(e.target.value))}
            />
          </div>
          <WardrobeEditor value={isMe ? me : partner} original={isMe ? DEFAULT_PLAYER : DEFAULT_PARTNER} onChange={isMe ? setMe : setPartner} allowWedding={false} compact={typeof window !== 'undefined' && window.innerWidth < 700} />
          <div className="wf-row" style={{ marginTop: 18, justifyContent: 'flex-end' }}>
            {!isMe && (
              <button type="button" className="wf-btn ghost" onClick={() => setStep('me')}>
                이전
              </button>
            )}
            {isMe ? (
              <button type="button" className="wf-btn" onClick={() => setStep('partner')}>
                다음 · 파트너 만들기
              </button>
            ) : (
              <button type="button" className="wf-btn" onClick={finish}>
                숲으로 이사 가기
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
