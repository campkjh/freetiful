'use client';

// 이름 입력 — 자리 탭 첫 화면(사장 '처음에 거기 클릭하면 이름 입력하게끔'). 이벤트·설문도 이름이 없으면 같은 카드를 띄운다.
// 프리티풀에 로그인 안 한 손님 = 이름 칸 대신 '카카오로 가입하기'(사장 261109 '이름 입력하고 가입하기 버튼으로, 카카오 가입하기로')
//  → 카카오 로그인(가입 겸) 뒤 이 화면으로 돌아오면(rememberAuthReturnTo) 이름 칸, 계정 이름을 미리 채워 둔다.
// 가입돼 있는(로그인한) 사람은 이름만 넣는다(사장 '가입이 되어있는사람은 이름만 입력할 수 있게끔'). 이미 이름을 넣은 기기는 이 카드를 안 본다.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cleanGuestName, saveGuestName } from '@/lib/reception/guest';
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
    <button type="button" className="rc-icon-btn rc-name-close" onClick={props.onClose} aria-label="닫기">
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

function NameForm({ initial, cta, hint, onDone, close }: CardProps & { close: React.ReactNode }) {
  const [name, setName] = useState(initial || '');
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { const t = setTimeout(() => input.current?.focus({ preventScroll: true }), 260); return () => clearTimeout(t); }, []);
  const value = cleanGuestName(name);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value) return input.current?.focus();
    saveGuestName(value);
    onDone(value);
  };
  return (
    <form className="rc-glass rc-name-card rc-rise" onSubmit={submit}>
      {close}
      <p className="rc-eyebrow">Welcome</p>
      <h2 className="rc-name-title">성함을 입력해 주세요</h2>
      <p className="rc-name-hint">{hint}</p>
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
    </form>
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
