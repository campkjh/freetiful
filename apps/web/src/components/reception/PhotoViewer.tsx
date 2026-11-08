'use client';

// 사진 크게 보기 — 좋아요 · 공감 누르기(종류별 한 사람 10개), 내 사진이면 지우기. 좌우로 밀거나 화살표로 다음 사진.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReceptionPhoto, VoteKind } from '@/lib/reception/api';
import { CloseIcon, CrownIcon, HeartIcon, ThumbIcon } from './ReceptionIcons';

export default function PhotoViewer({
  photos,
  index,
  onIndex,
  onClose,
  onVote,
  onDelete,
  likesLeft,
  empathiesLeft,
}: {
  photos: ReceptionPhoto[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  onVote: (p: ReceptionPhoto, kind: VoteKind) => void;
  onDelete: (p: ReceptionPhoto) => Promise<void>;
  likesLeft: number;
  empathiesLeft: number;
}) {
  const p = photos[index];
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const go = (d: number) => { if (photos.length > 1) onIndex((index + d + photos.length) % photos.length); };

  useEffect(() => { setConfirmDelete(false); }, [p?.id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }); // eslint-disable-line react-hooks/exhaustive-deps

  if (!p) return null;
  const ranked = p.empathies > 0 && p.rank <= 3;
  return createPortal(
    <div className="rc-theme rc-viewer" role="dialog" aria-modal="true" aria-label={`${p.name} 님의 사진`}>
      <header className="rc-viewer-head">
        <div className="rc-viewer-who">
          {ranked && <span className={`rc-rank-crown r${p.rank}`}><CrownIcon size={16} /></span>}
          <b>{p.name}</b>
          <span className="rc-viewer-rank">공감 {p.rank}위</span>
        </div>
        <button type="button" className="rc-icon-btn" onClick={onClose} aria-label="닫기"><CloseIcon size={22} /></button>
      </header>

      <div
        className="rc-viewer-stage"
        onClick={onClose}
        onTouchStart={(e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }}
        onTouchEnd={(e) => {
          const s = touch.current;
          touch.current = null;
          if (!s) return;
          const dx = e.changedTouches[0].clientX - s.x;
          const dy = e.changedTouches[0].clientY - s.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
        }}
      >
        <img
          key={p.id}
          src={p.imageUrl}
          alt={`${p.name} 님의 사진`}
          className="rc-viewer-img"
          onClick={(e) => e.stopPropagation()}
        />
        {photos.length > 1 && (
          <>
            <button type="button" className="rc-viewer-nav prev" onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="이전 사진">‹</button>
            <button type="button" className="rc-viewer-nav next" onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="다음 사진">›</button>
          </>
        )}
      </div>

      <footer className="rc-viewer-foot">
        {p.mine ? (
          <div className="rc-viewer-mine">
            <p>내 사진 · 좋아요 {p.likes} · 공감 {p.empathies}</p>
            {confirmDelete ? (
              <div className="rc-viewer-confirm">
                <span>지우면 받은 좋아요·공감도 사라져요.</span>
                <button type="button" className="rc-btn-line sm" onClick={() => setConfirmDelete(false)}>그대로 두기</button>
                <button
                  type="button"
                  className="rc-btn-danger sm"
                  disabled={deleting}
                  onClick={async () => { setDeleting(true); try { await onDelete(p); } finally { setDeleting(false); } }}
                >
                  {deleting ? '지우는 중…' : '지우기'}
                </button>
              </div>
            ) : (
              <button type="button" className="rc-btn-line sm" onClick={() => setConfirmDelete(true)}>사진 지우기</button>
            )}
          </div>
        ) : (
          <>
            <div className="rc-vote-row">
              <button type="button" className={`rc-vote ${p.liked ? 'on' : ''}`} onClick={() => onVote(p, 'like')} aria-pressed={p.liked}>
                <ThumbIcon size={22} /><span>좋아요</span><b>{p.likes}</b>
              </button>
              <button type="button" className={`rc-vote empathy ${p.empathized ? 'on' : ''}`} onClick={() => onVote(p, 'empathy')} aria-pressed={p.empathized}>
                <HeartIcon size={22} /><span>공감</span><b>{p.empathies}</b>
              </button>
            </div>
            <p className="rc-vote-left">남은 좋아요 {likesLeft}개 · 남은 공감 {empathiesLeft}개</p>
          </>
        )}
      </footer>
    </div>,
    document.body,
  );
}
