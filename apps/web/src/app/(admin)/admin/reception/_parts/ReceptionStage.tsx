'use client';

/* 송년회 '크게 보기' 판(261122) — 프로젝터 · 대표님 손에 넘기는 태블릿용 전체 화면.
 *  · body 포털 + position:fixed inset:0 — 본문 카드의 등장 애니메이션(transform) 안에 있으면 fixed 가 카드 기준으로 갇혀서 밖으로 뺐다.
 *  · 어드민 머리·메뉴·떠 있는 단추를 다 덮는다(z 1250). 알림 창(adminConfirm, z 1300)은 이 위에 뜬다.
 *  · ESC · 닫기 단추로 닫는다 — 알림 창이 먼저 ESC 를 먹으면(defaultPrevented) 판은 그대로 둔다. */
import { X } from 'lucide-react';
import { useEffect, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { StageNav, type StageScreen } from './StageNav';

export function ReceptionStage({
  open,
  onClose,
  label,
  children,
  foot,
  presentation = false,
  surfaceRef,
  nav,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  /** 아래 단추 줄(운영자용) */
  foot?: ReactNode;
  presentation?: boolean;
  surfaceRef?: Ref<HTMLDivElement>;
  /** 닫기 옆 ☰ — 퀴즈 · 럭키드로우 · 베스트드레서 화면 옮기기(지금 화면). 없으면 안 보임 */
  nav?: StageScreen;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div ref={surfaceRef} className={`rca-stage${presentation ? ' rca-stage-presentation' : ''}`} role="dialog" aria-modal="true" aria-label={label}>
      <div className="rca-stage-top">
        {nav && <StageNav current={nav} />}
        <button type="button" className="rca-stage-close" onClick={onClose} aria-label="크게 보기 닫기" title="크게 보기 닫기">
          <X size={20} aria-hidden="true" />
          {!presentation && '닫기'}
        </button>
      </div>
      <div className="rca-stage-body">{children}</div>
      {foot && <div className="rca-stage-foot">{foot}</div>}
    </div>,
    document.body,
  );
}
