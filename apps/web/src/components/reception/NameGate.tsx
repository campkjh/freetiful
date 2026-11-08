'use client';

// 이름 입력 — 자리 탭 첫 화면(사장 '처음에 거기 클릭하면 이름 입력하게끔'). 이벤트·설문도 이름이 없으면 같은 카드를 띄운다.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cleanGuestName, saveGuestName } from '@/lib/reception/guest';
import { CloseIcon } from './ReceptionIcons';

function Card({ initial, cta, hint, onDone, onClose }: { initial?: string; cta: string; hint: string; onDone: (name: string) => void; onClose?: () => void }) {
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
      {onClose && (
        <button type="button" className="rc-icon-btn rc-name-close" onClick={onClose} aria-label="닫기">
          <CloseIcon size={20} />
        </button>
      )}
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
export function NameGateInline(props: { initial?: string; cta: string; hint: string; onDone: (name: string) => void; onClose?: () => void }) {
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
    <div className="rc-theme rc-modal" role="dialog" aria-modal="true" aria-label="성함 입력" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        <Card cta="확인" hint={hint} onDone={onDone} onClose={onClose} />
      </div>
    </div>,
    document.body,
  );
}
