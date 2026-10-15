'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from './admin-icons';

export function AdminProfilePhoto({ src, name }: { src: string | null; name: string }) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const el = dialog.current;
    el?.showModal();
    return () => { el?.close(); trigger.current?.focus({ preventScroll: true }); };
  }, [open]);

  if (!src || failed === src) return <div className="adm-ava">{name?.[0] || '?'}</div>;

  return <>
    <button ref={trigger} type="button" className="adm-photo-trigger" aria-label={`${name} 프로필 사진 크게 보기`} onClick={() => setOpen(true)}>
      <img src={src} alt="" className="adm-ava" loading="lazy" onError={() => setFailed(src)} />
    </button>
    {open && createPortal(
      <dialog ref={dialog} className="adm-photo-viewer" aria-label={`${name} 프로필 사진`} onCancel={(event) => { event.preventDefault(); setOpen(false); }} onClick={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
        <div className="adm-photo-heading"><span>{name}</span><button type="button" aria-label="사진 닫기" onClick={() => setOpen(false)}><X size={22} /></button></div>
        <img className="adm-photo-full" src={src} alt={`${name} 프로필 사진`} />
      </dialog>, document.body,
    )}
  </>;
}
