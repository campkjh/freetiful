'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { SettlementBillActions, SettlementBillCard, type SettlementBillData } from '@/components/settlement/SettlementBill';
import { adminFetch } from './adminFetch';

/** 정산 명세서(빌지) 창 — '정산하기' 뒤 바로 뜨고, 줄의 '빌지'로 다시 연다(261005 사장 '빌지 형태 · 카톡으로 이미지 공유').
 *  사회자도 같은 명세서를 정산 완료 푸시로 받는다(누르면 /my/settlement/:id). */
export function AdminBillModal({ id, fresh, onClose }: { id: string | null; fresh?: boolean; onClose: () => void }) {
  const [bill, setBill] = useState<SettlementBillData | null>(null);
  const [error, setError] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setBill(null);
    setError(false);
    adminFetch('GET', `/api/v1/admin/settlements/${id}/bill`, undefined, { cache: false })
      .then((d: SettlementBillData) => { if (alive) setBill(d); })
      .catch(() => { if (alive) setError(true); });
    const raf = requestAnimationFrame(() => setShown(true));
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => { alive = false; cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const close = () => {
    setShown(false);
    window.setTimeout(onClose, 220);
  };

  if (!id || typeof document === 'undefined') return null;
  return createPortal(
    <div className={`admin-shell adm-modal-root ${shown ? 'on' : ''}`} role="presentation">
      <button type="button" className="adm-modal-dim" aria-label="닫기" tabIndex={-1} onClick={close} />
      <div className="adm-modal adm-bill-modal" role="dialog" aria-modal="true" aria-label="정산 명세서">
        <div className="adm-bill-head">
          <div className="min-w-0">
            <p className="adm-modal-title">정산 명세서</p>
            <p className="adm-bill-sub">{fresh ? '정산 완료 처리했어요 · 사회자에게 푸시로도 보냈어요' : '이미지로 카카오톡에 보낼 수 있어요'}</p>
          </div>
          <button type="button" className="adm-bill-x" onClick={close} aria-label="닫기">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="adm-bill-stage">
          {error ? (
            <p className="adm-empty">명세서를 불러오지 못했어요</p>
          ) : !bill ? (
            <div className="adm-skel mx-auto h-[480px] w-full max-w-[360px] rounded-[24px]" />
          ) : (
            <SettlementBillCard bill={bill} />
          )}
        </div>
        {bill && (
          <div className="adm-bill-actions">
            <SettlementBillActions bill={bill} />
            {bill.note && <p className="adm-modal-note">관리자 메모 · {bill.note}</p>}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
