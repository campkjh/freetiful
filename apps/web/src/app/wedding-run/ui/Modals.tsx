'use client';

// 웨딩런 팝업들(261011 사장 사양서 [7]·[8]) — 모두 modal_blank(빈 팝업) 위 동적 글자 + 개별 버튼 이미지.
//  · 일시정지: '잠깐 쉬어갈까요?' + 계속하기(resume) · 다시 도전(retry) · 홈(home) · 사운드(sound/sound_off). 재개 = 3·2·1 뒤.
//  · 홈 확인: 진행 중인 게임에서 홈을 누르면 — 닫기(close) · 계속하기(resume) · 나가기(home).
//  · 도움말: 점프/슬라이드 버튼 그림(jump/slide) + PC 키. 닫기(close).
//  · 닉네임: 랭킹에 보일 이름(2~12자, 서버와 같은 규칙) — 기본 '꾸밈말 동물'.
//  · 링크 직접 복사: 공유·복사가 모두 안 되는 브라우저에서 주소를 길게 눌러 복사하게.
//  · 3·2·1 카운트다운, 세로 화면 회전 안내.
import { useEffect, useRef, useState } from 'react';
import { WR_CHAR, WR_UI } from '../assets';
import { defaultNickname, nicknameError, normalizeNickname } from '../ranking';
import { Dim, ImgButton, ModalPanel } from './parts';
import { fmtScore, segmentName } from './text';

export function PauseModal({
  score,
  segment,
  soundOn,
  onResume,
  onRetry,
  onHome,
  onSound,
}: {
  score: number;
  segment: number;
  soundOn: boolean;
  onResume: () => void;
  onRetry: () => void;
  onHome: () => void;
  onSound: () => void;
}) {
  return (
    <Dim>
      <ModalPanel className="wr-pause" label="일시정지" restoreFocus={false}>
        <h2 className="wr-h1">
          잠깐 쉬어갈까요? <span className="wr-heart" aria-hidden />
        </h2>
        <p className="wr-sub">
          지금 <b className="wr-score-num">{fmtScore(score)}점</b> · {segmentName(segment)}
        </p>
        <ImgButton ui="resume" width="calc(var(--u) * 196)" label="계속하기" onClick={onResume} />
        <ImgButton ui="retry" width="calc(var(--u) * 196)" label="다시 도전" onClick={onRetry} />
        <div className="wr-icon-row">
          <div className="wr-icon-btn">
            <ImgButton ui="home" width="calc(var(--u) * 42)" label="홈으로" onClick={onHome} />
            <span>홈</span>
          </div>
          <div className="wr-icon-btn">
            <ImgButton ui={soundOn ? 'sound' : 'sound_off'} width="calc(var(--u) * 42)" label={soundOn ? '소리 끄기' : '소리 켜기'} onClick={onSound} />
            <span>{soundOn ? '소리 켜짐' : '소리 꺼짐'}</span>
          </div>
        </div>
      </ModalPanel>
    </Dim>
  );
}

export function ConfirmHomeModal({ onCancel, onLeave }: { onCancel: () => void; onLeave: () => void }) {
  return (
    <Dim onBackdrop={onCancel}>
      <ModalPanel className="wr-confirm" label="게임 나가기 확인">
        <div className="wr-panel-close">
          <ImgButton ui="close" width="calc(var(--u) * 38)" label="닫기" onClick={onCancel} />
        </div>
        <h2 className="wr-h2">게임을 그만하고 나갈까요?</h2>
        <p className="wr-sub">지금 나가면 이번 판 점수는 기록되지 않아요.</p>
        <div className="wr-icon-row" style={{ alignItems: 'center' }}>
          <ImgButton ui="resume" width="calc(var(--u) * 170)" label="계속하기" onClick={onCancel} />
          <div className="wr-icon-btn">
            <ImgButton ui="home" width="calc(var(--u) * 42)" label="나가기" onClick={onLeave} />
            <span>나가기</span>
          </div>
        </div>
      </ModalPanel>
    </Dim>
  );
}

export function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Dim onBackdrop={onClose}>
      <ModalPanel className="wr-help" label="조작 방법">
        <div className="wr-panel-close">
          <ImgButton ui="close" width="calc(var(--u) * 38)" label="닫기" onClick={onClose} />
        </div>
        <h2 className="wr-h2">
          이렇게 달려요 <span className="wr-heart" aria-hidden />
        </h2>
        <div className="wr-help-grid">
          <div className="wr-help-card">
            <img src={WR_UI.slide.src} alt="" draggable={false} />
            <b>슬라이드 · 왼쪽 아래</b>
            <span>
              누르고 있는 동안 몸을 낮춰요
              <br />
              머리 위로 오는 건 슬라이드!
              <br />
              PC <span className="wr-kbd">↓</span>
            </span>
          </div>
          <div className="wr-help-card">
            <img src={WR_UI.jump.src} alt="" draggable={false} />
            <b>점프 · 오른쪽 아래</b>
            <span>
              누르면 폴짝, 바닥 장애물·틈은 점프!
              <br />
              공중에서 한 번 더 = 2단 점프
              <br />
              PC <span className="wr-kbd">Space</span> <span className="wr-kbd">↑</span>
            </span>
          </div>
        </div>
        <p className="wr-sub">
          하트와 축의금 봉투를 모으면 점수가 올라요 · 기믹은 미리 신호를 줘요(번쩍·소리·오른쪽 끝 표시) · PC 일시정지 <span className="wr-kbd">Esc</span>
        </p>
      </ModalPanel>
    </Dim>
  );
}

export function NicknameModal({ current, onSave, onClose }: { current: string; onSave: (nick: string) => void; onClose: () => void }) {
  const [value, setValue] = useState(current);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const submit = () => {
    const e = nicknameError(value);
    if (e) {
      setErr(e);
      return;
    }
    onSave(normalizeNickname(value));
  };
  return (
    <Dim onBackdrop={onClose} className="is-top">
      <ModalPanel className="wr-nick" label="닉네임 바꾸기">
        <div className="wr-panel-close">
          <ImgButton ui="close" width="calc(var(--u) * 38)" label="닫기" onClick={onClose} />
        </div>
        <h2 className="wr-h2">랭킹에 보일 닉네임</h2>
        <div className="wr-input-row">
          <input
            ref={inputRef}
            className="wr-input"
            value={value}
            maxLength={24}
            enterKeyHint="done"
            autoComplete="off"
            aria-label="닉네임"
            onChange={(e) => {
              setValue(e.target.value);
              setErr(null);
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') onClose();
            }}
          />
          {/* (261011 통합) 서버는 '꾸밈말 동물' 모양을 직접 정할 수 없게 막는다(남의 기본 닉네임 사칭) — '랜덤' 대신 내 기본 닉네임으로 되돌리기 */}
          <button
            type="button"
            className="wr-pill-btn"
            onClick={() => {
              setValue(defaultNickname());
              setErr(null);
            }}
          >
            기본값
          </button>
        </div>
        <span className="wr-err" role="alert">
          {err || '2~12자 · 실명 대신 별명을 써 주세요'}
        </span>
        <button type="button" className="wr-pill-btn" style={{ width: '60%', background: 'linear-gradient(90deg,#a98ae0,#ff8fb3)', color: '#fff', border: 0 }} onClick={submit}>
          저장하기
        </button>
      </ModalPanel>
    </Dim>
  );
}

export function CopyFallbackModal({ text, onClose }: { text: string; onClose: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const t = ref.current;
    if (!t) return;
    try {
      t.focus();
      t.select();
    } catch {
      /* 선택 불가 */
    }
  }, []);
  return (
    <Dim onBackdrop={onClose}>
      <ModalPanel className="wr-nick" label="링크 복사">
        <div className="wr-panel-close">
          <ImgButton ui="close" width="calc(var(--u) * 38)" label="닫기" onClick={onClose} />
        </div>
        <h2 className="wr-h2">길게 눌러 복사해 주세요</h2>
        <textarea ref={ref} className="wr-copybox" readOnly value={text} onKeyDown={(e) => e.stopPropagation()} />
      </ModalPanel>
    </Dim>
  );
}

/** 3·2·1 — 다 세면 onDone(그때 엔진 resume) */
export function Countdown({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(3);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    if (n <= 0) {
      doneRef.current();
      return;
    }
    const t = setTimeout(() => setN((v) => v - 1), 700);
    return () => clearTimeout(t);
  }, [n]);
  if (n <= 0) return null;
  return (
    <div className="wr-count" aria-live="assertive">
      <b key={n}>{n}</b>
    </div>
  );
}

/** 세로 화면 안내 — 게임은 그대로(회전 중엔 화면이 일시정지시킨다) */
export function RotateNotice({ on, canLock, onLock }: { on: boolean; canLock: boolean; onLock: () => void }) {
  const bride = WR_CHAR[0].frames.run_02;
  return (
    <div className={`wr-rotate${on ? ' is-on' : ''}`} role="alertdialog" aria-hidden={!on} aria-label="휴대폰을 가로로 돌려주세요">
      <img className="wr-rotate-char" src={bride.src} alt="" draggable={false} />
      <div className="wr-rotate-phone" aria-hidden />
      <h2>휴대폰을 가로로 돌려주세요</h2>
      <p>
        웨딩런은 가로 화면에서 달려요.
        <br />
        화면이 안 돌아가면 자동 회전(화면 회전 잠금)을 확인해 주세요.
      </p>
      {canLock && (
        <button type="button" className="wr-rotate-btn" onClick={onLock}>
          전체 화면 가로로 보기
        </button>
      )}
    </div>
  );
}
