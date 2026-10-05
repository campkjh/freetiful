'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/* ────────────────────────────────────────────────────────────
 * 어드민 알림 창(261005 사장 '모든 알럿은 이렇게 — 완전 똑같이', Kind=Alert / Kind=Confirm 시안)
 *  · 카드 311 · r24 · 흰 바탕, 제목 20 굵게 rgba(0,12,30,.8), 설명 16/24 rgba(3,18,40,.7)
 *  · Alert = 오른쪽 아래 글자 버튼 '확인'(16 굵게 #2272EB) · Confirm = 버튼 둘(48 · r14 · 간격 8 · 양옆·아래 16) 회색 rgba(7,25,76,.05) / 파랑 #3182F6
 *  · window.confirm/alert 대신 `await adminConfirm('제목\n설명')` · `adminAlert(...)` — 줄바꿈(없으면 첫 문장 끝)에서 제목/설명을 나눈다.
 * ──────────────────────────────────────────────────────────── */

type DialogKind = 'alert' | 'confirm';
export type DialogOptions = { title: string; description?: ReactNode; confirmText?: string; cancelText?: string };
type Pending = DialogOptions & { kind: DialogKind; resolve: (ok: boolean) => void };

let pushDialog: ((d: Pending) => void) | null = null;

/** '제목\n설명' 또는 '…하시겠습니까? 설명' → 제목·설명 */
function split(message: string): DialogOptions {
  const text = String(message ?? '').trim();
  const nl = text.indexOf('\n');
  if (nl > 0) return { title: text.slice(0, nl).trim(), description: text.slice(nl + 1).trim() || undefined };
  const m = /^(.+?[?？.!])\s+(\S[\s\S]*)$/.exec(text);
  if (m && m[1].length <= 40) return { title: m[1], description: m[2] };
  return { title: text };
}

function open(kind: DialogKind, input: string | DialogOptions): Promise<boolean> {
  const opts = typeof input === 'string' ? split(input) : input;
  if (!pushDialog) {
    // 창을 띄울 자리가 아직 없으면(레이아웃 밖) 브라우저 기본 창으로
    const plain = [opts.title, typeof opts.description === 'string' ? opts.description : ''].filter(Boolean).join('\n');
    if (kind === 'confirm') return Promise.resolve(window.confirm(plain));
    window.alert(plain);
    return Promise.resolve(true);
  }
  return new Promise((resolve) => pushDialog!({ ...opts, kind, resolve }));
}

/** 확인/취소 — 확인이면 true */
export const adminConfirm = (input: string | DialogOptions) => open('confirm', input);
/** 알림 — 확인을 누르면 끝난다 */
export const adminAlert = (input: string | DialogOptions) => open('alert', input).then(() => undefined);

/** 레이아웃에 한 번 — 창은 body 포털(다른 서랍·창 위) */
export function AdminDialogHost() {
  const [queue, setQueue] = useState<Pending[]>([]);
  const [shown, setShown] = useState(false);
  const okRef = useRef<HTMLButtonElement>(null);
  const current = queue[0] || null;

  useEffect(() => {
    pushDialog = (d) => setQueue((q) => [...q, d]);
    return () => { pushDialog = null; };
  }, []);

  useEffect(() => {
    if (!current) return;
    setShown(false);
    const raf = requestAnimationFrame(() => { setShown(true); okRef.current?.focus(); });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(false); }
      if (e.key === 'Enter') { e.preventDefault(); close(true); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey, true); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const close = (ok: boolean) => {
    if (!current) return;
    const d = current;
    setShown(false);
    window.setTimeout(() => {
      d.resolve(d.kind === 'alert' ? true : ok);
      setQueue((q) => q.slice(1));
    }, 160);
  };

  if (!current || typeof document === 'undefined') return null;
  const isAlert = current.kind === 'alert';
  return createPortal(
    <div className={`adm-dlg-root ${shown ? 'on' : ''}`} role="presentation">
      <button type="button" className="adm-dlg-dim" aria-label="닫기" tabIndex={-1} onClick={() => close(false)} />
      <div className={`adm-dlg ${isAlert ? 'alert' : 'confirm'}`} role={isAlert ? 'alertdialog' : 'dialog'} aria-modal="true" aria-labelledby="adm-dlg-title">
        <p id="adm-dlg-title" className="adm-dlg-title">{current.title}</p>
        {current.description && <p className="adm-dlg-desc">{current.description}</p>}
        {isAlert ? (
          <div className="adm-dlg-actions alert">
            <button ref={okRef} type="button" className="adm-dlg-text" onClick={() => close(true)}>{current.confirmText || '확인'}</button>
          </div>
        ) : (
          <div className="adm-dlg-actions confirm">
            <button type="button" className="adm-dlg-btn weak" onClick={() => close(false)}>{current.cancelText || '취소'}</button>
            <button ref={okRef} type="button" className="adm-dlg-btn primary" onClick={() => close(true)}>{current.confirmText || '확인'}</button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
