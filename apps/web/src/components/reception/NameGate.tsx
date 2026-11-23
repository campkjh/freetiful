'use client';

// 이름 입력 — 자리 탭 첫 화면(사장 '처음에 거기 클릭하면 이름 입력하게끔'). 이벤트·설문도 이름이 없으면 같은 카드를 띄운다.
// 프리티풀에 로그인 안 한 손님 = 이름 칸 대신 '카카오로 가입하기'(사장 261109 '이름 입력하고 가입하기 버튼으로, 카카오 가입하기로')
//  → 카카오 로그인(가입 겸) 뒤 이 화면으로 돌아오면(rememberAuthReturnTo) 이름 칸, 계정 이름을 미리 채워 둔다.
// 가입돼 있는(로그인한) 사람은 이름만 넣는다(사장 '가입이 되어있는사람은 이름만 입력할 수 있게끔'). 이미 이름을 넣은 기기는 이 카드를 안 본다.
// 누르면 가벼운 진동(261122 사장 '이벤트 페이지들도 누르면 진동') — 닫기 · 카카오로 가입하기 · 이름 확인(빈 이름엔 없음). 글자 입력엔 없음.
// 이름을 넣으면 확인 알럿(261123 사장 '카톡 이름이랑 다른 경우가 있어서 정말로 맞는지 확인 — 실명을 입력 안 하면 점수가 등록 안 된다').
// 2부 이름 다시 받기(NameRecheckModal) — 서버 회차(pulse nc)가 기기에 남긴 회차와 다르면 공용 틀(ReceptionShell)이 닫을 수 없는 창으로 띄운다.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { haptic } from '@/lib/haptics';
import { cleanGuestName, saveGuestName } from '@/lib/reception/guest';
import { currentNameCheck } from '@/lib/reception/me';
import { rememberAuthReturnTo, startOAuth } from '@/lib/auth/oauth';
import { useAuthStore } from '@/lib/store/auth.store';
import { CloseIcon } from './ReceptionIcons';

type CardProps = { initial?: string; cta: string; hint: string; onDone: (name: string) => void; onClose?: () => void };

function KakaoMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fillRule="evenodd" clipRule="evenodd" d="M9 0C4.03 0 0 3.19 0 7.13c0 2.52 1.67 4.74 4.19 6.01L3.1 17.2a.3.3 0 0 0 .46.32L8.4 14a10.7 10.7 0 0 0 .6.02C13.97 14.02 18 10.83 18 6.89 18 2.94 13.97 0 9 0z" fill="#191919" />
    </svg>
  );
}

function Card(props: CardProps) {
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hasHydrated);
  const close = props.onClose && (
    <button type="button" className="rc-icon-btn rc-name-close" onClick={() => { haptic('light'); props.onClose?.(); }} aria-label="닫기">
      <CloseIcon size={20} />
    </button>
  );
  // 로그인 상태를 읽기 전엔 빈 카드(가입 버튼이 잠깐 비쳤다 사라지지 않게)
  if (!hydrated) return <div className="rc-glass rc-name-card rc-name-wait" aria-busy="true">{close}</div>;
  if (!user) {
    return (
      <div className="rc-glass rc-name-card rc-rise">
        {close}
        <p className="rc-eyebrow">Welcome</p>
        <h2 className="rc-name-title">카카오로 가입해 주세요</h2>
        <p className="rc-name-hint">가입하면 내 자리 확인 · 베스트드레서 어워즈 · 설문에 참여할 수 있어요.<br />이미 가입하셨다면 바로 로그인돼요.</p>
        <button
          type="button"
          className="rc-btn-kakao"
          onClick={() => {
            haptic('light');
            rememberAuthReturnTo();
            startOAuth('kakao');
          }}
        >
          <KakaoMark />
          카카오로 가입하기
        </button>
      </div>
    );
  }
  return <NameForm {...props} initial={props.initial || cleanGuestName(user.name || '')} close={close} />;
}

/** 실명 확인 알럿 — '○○○ 님이 맞나요?' · 실명이 아니면 점수가 등록되지 않는다. 다시 입력 = 알럿만 닫고 입력칸으로 */
function NameConfirm({ name, onYes, onNo }: { name: string; onYes: () => void; onNo: () => void }) {
  const yes = useRef<HTMLButtonElement>(null);
  useEffect(() => { yes.current?.focus({ preventScroll: true }); }, []);
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="rc-theme rc-modal rc-name-alert" role="alertdialog" aria-modal="true" aria-labelledby="rc-name-alert-title" aria-describedby="rc-name-alert-desc">
      <div className="rc-glass rc-name-card rc-rise">
        <p className="rc-eyebrow">확인해 주세요</p>
        <h2 id="rc-name-alert-title" className="rc-name-title">‘{name}’ 님이 맞나요?</h2>
        <p id="rc-name-alert-desc" className="rc-name-hint">
          카카오톡 이름이 아닌 <b>실명</b>인지 꼭 확인해 주세요.<br />
          <b className="rc-name-warn">실명을 입력하지 않으면 점수가 등록되지 않아요.</b>
        </p>
        <div className="rc-name-alert-btns">
          <button type="button" className="rc-btn-line" onClick={() => { haptic('light'); onNo(); }}>다시 입력</button>
          <button ref={yes} type="button" className="rc-btn-gold" onClick={() => { haptic('light'); onYes(); }}>네, 맞아요</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

type FormProps = CardProps & { close: React.ReactNode; eyebrow?: string; title?: string; note?: React.ReactNode };

function NameForm({ initial, cta, hint, onDone, close, eyebrow = 'Welcome', title = '성함을 입력해 주세요', note }: FormProps) {
  const [name, setName] = useState(initial || '');
  const [asking, setAsking] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { const t = setTimeout(() => input.current?.focus({ preventScroll: true }), 260); return () => clearTimeout(t); }, []);
  const value = cleanGuestName(name);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value) return input.current?.focus();
    haptic('light');
    input.current?.blur();
    setAsking(value);
  };
  const confirm = () => {
    if (!asking) return;
    // 지금 회차(2부 이름 다시 받기)를 같이 남긴다 — 모르면(첫 신호 전) 비워 두고, 회차가 있으면 한 번 더 묻게
    saveGuestName(asking, currentNameCheck());
    const done = asking;
    setAsking(null);
    onDone(done);
  };
  return (
    <form className="rc-glass rc-name-card rc-rise" onSubmit={submit}>
      {close}
      <p className="rc-eyebrow">{eyebrow}</p>
      <h2 className="rc-name-title">{title}</h2>
      <p className="rc-name-hint">{hint}</p>
      {note}
      <input
        ref={input}
        className="rc-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="예) 김프리"
        maxLength={20}
        autoComplete="name"
        enterKeyHint="done"
        aria-label="성함"
      />
      <button type="submit" className="rc-btn-gold" disabled={!value}>{cta}</button>
      {asking && <NameConfirm name={asking} onYes={confirm} onNo={() => { setAsking(null); setTimeout(() => input.current?.focus({ preventScroll: true }), 60); }} />}
    </form>
  );
}

/**
 * 2부 이름 다시 받기(261123) — 닫을 수 없는 창. 빈 칸에서 다시 적게 하고(카톡 이름이 미리 채워지지 않게) 지금 기기에 남은 이름은 아래 작게.
 * 로그인 여부와 상관없이 이름만 받는다(이미 들어와 이름을 넣었던 손님이라).
 */
export function NameRecheckModal({ current, onDone }: { current: string; onDone?: (name: string) => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(
    <div className="rc-theme rc-modal rc-name-recheck" role="dialog" aria-modal="true" aria-label="성함 다시 입력">
      <div>
        <NameForm
          close={null}
          eyebrow="PART 2"
          title="성함을 한 번 더 입력해 주세요"
          hint="카카오톡 이름과 실제 이름이 다른 분이 있어요. 명단에 있는 실명으로 입력해 주세요. 실명을 입력하지 않으면 점수가 등록되지 않아요."
          note={current ? <p className="rc-name-now">지금 저장된 이름 · <b>{current}</b></p> : null}
          cta="확인"
          onDone={(n) => onDone?.(n)}
        />
      </div>
    </div>,
    document.body,
  );
}

/** 자리 탭처럼 화면 안에 놓는 카드 */
export function NameGateInline(props: CardProps) {
  return <div className="rc-name-inline"><Card {...props} /></div>;
}

/** 이벤트·설문에서 이름이 필요할 때 위에 띄우는 카드 */
export function NameGateModal({ open, onDone, onClose, hint }: { open: boolean; onDone: (name: string) => void; onClose: () => void; hint: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!mounted || !open) return null;
  return createPortal(
    <div className="rc-theme rc-modal" role="dialog" aria-modal="true" aria-label="입장하기" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        <Card cta="확인" hint={hint} onDone={onDone} onClose={onClose} />
      </div>
    </div>,
    document.body,
  );
}
