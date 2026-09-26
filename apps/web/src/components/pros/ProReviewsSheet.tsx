'use client';

// 사회자 리뷰 시트 — 목록 카드의 '리뷰'를 누르면 페이지 이동 없이 댓글처럼(260926 사장 "리뷰 페이지네이션 말고 댓글처럼 모달로").
//  · 공용 시트(globals .ft-scrim/.ft-sheet) 위에 웨딩숲 댓글(.tcm) 계층: 프사 36 · 이름 15 굵게 + 별 · 본문 16 · 사진 · 회색 시간 13.5,
//    사회자 답글은 한 칸 들여 프사 28 + '사회자' 표시(웨딩숲 '작성자' 뱃지 결).
//  · 쪽 나눔 없이 아래로 굴리면 이어서 그린다(15개씩). 닫기 버튼은 없고(사장) 머리(손잡이·제목)를 끌어내리거나 바깥·Esc 로 닫힌다.
//  · 실제로 쓰인 리뷰만 — 본문 없는 사회자에게 예시 리뷰를 채우지 않는다(lib/pro-reviews).
import { useEffect, useRef, useState } from 'react';
import { loadProReviews, peekProReviews, type ProReviewItem } from '@/lib/pro-reviews';
import { getProfileImageUrl } from '@/lib/default-profile';
import { formatRelativeTime } from '@/lib/relativeTime';

export type ReviewSheetPro = { id: string; name: string; image?: string; rating: number; reviews: number };

const STEP = 15;

function Stars({ value, size = 13 }: { value: number; size?: number }) {
  const full = Math.round(value);
  return (
    <span className="inline-flex items-center gap-px" aria-label={`별점 ${value.toFixed(1)}`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2.8l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.6l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" fill={i < full ? '#FFC933' : '#E5E8EB'} />
        </svg>
      ))}
    </span>
  );
}

function ReviewComment({ review, pro, first }: { review: ProReviewItem; pro: ReviewSheetPro; first: boolean }) {
  return (
    <div className={`py-4 ${first ? '' : 'border-t border-[#F2F4F6]'}`}>
      <div className="flex gap-2.5">
        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#F2F4F6]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={getProfileImageUrl(review.avatar, review.id)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-h-[20px] flex-wrap items-center gap-x-1.5 gap-y-1">
            <span className="text-[15px] font-bold tracking-[-0.2px] text-[#333D4B]">{review.name}</span>
            {review.rating > 0 && <Stars value={review.rating} />}
          </div>
          {review.content && (
            <p className="mt-1 whitespace-pre-wrap break-words text-[16px] leading-[1.6] tracking-[-0.2px] text-[#191F28] [overflow-wrap:anywhere]">
              {review.content}
            </p>
          )}
          {review.photos.length > 0 && (
            <div className="mt-2.5 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {review.photos.slice(0, 6).map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src + i} src={src} alt="" loading="lazy" decoding="async" className="h-[84px] w-[84px] shrink-0 rounded-[12px] bg-[#F2F4F6] object-cover" />
              ))}
            </div>
          )}
          <p className="mt-1.5 text-[13.5px] tracking-[-0.2px] text-[#8B95A1]">{formatRelativeTime(review.createdAt)}</p>

          {/* 사회자 답글 — 한 칸 들여(프사 28) */}
          {review.proReply && (
            <div className="mt-3 flex gap-2">
              <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full bg-[#F2F4F6]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getProfileImageUrl(pro.image, pro.id)} alt="" loading="lazy" className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[14.5px] font-bold tracking-[-0.2px] text-[#333D4B]">{pro.name}</span>
                  <span className="inline-flex h-5 items-center rounded-[5px] bg-[#E8F3FF] px-1.5 text-[12px] font-bold text-[#3182F6]">사회자</span>
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-[15px] leading-[1.6] tracking-[-0.2px] text-[#191F28]">{review.proReply.content}</p>
                <p className="mt-1 text-[13px] text-[#8B95A1]">{formatRelativeTime(review.proReply.at)}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProReviewsSheet({ pro, onClose }: { pro: ReviewSheetPro | null; onClose: () => void }) {
  const [shownPro, setShownPro] = useState<ReviewSheetPro | null>(pro);
  const [closing, setClosing] = useState(false);
  const [data, setData] = useState<{ items: ProReviewItem[]; total: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [shown, setShown] = useState(STEP);
  const [dragY, setDragY] = useState(0);
  const dragRef = useRef<{ y: number; t: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  // 열릴 때 — 기억해 둔 게 있으면 바로, 없으면 받아 온다
  useEffect(() => {
    if (!pro) return;
    setShownPro(pro);
    setClosing(false);
    setDragY(0);
    setShown(STEP);
    setFailed(false);
    const hit = peekProReviews(pro.id);
    setData(hit ? { items: hit.items, total: hit.total } : null);
    let alive = true;
    loadProReviews(pro.id)
      .then((res) => { if (alive) setData(res); })
      .catch(() => { if (alive && !hit) setFailed(true); });
    return () => { alive = false; };
  }, [pro]);

  // 뒤 화면이 같이 굴러가지 않게
  useEffect(() => {
    if (!shownPro) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => { html.style.overflow = prev; };
  }, [shownPro]);

  const close = () => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(() => {
      setShownPro(null);
      setClosing(false);
      setDragY(0);
      onClose();
    }, 240);
  };

  useEffect(() => {
    if (!shownPro) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownPro, closing]);

  // 아래로 굴리면 15개씩 이어서
  const total = data?.items.length || 0;
  useEffect(() => {
    const root = listRef.current;
    const el = moreRef.current;
    if (!root || !el || shown >= total) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setShown((n) => Math.min(total, n + STEP));
    }, { root, rootMargin: '0px 0px 400px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [shown, total]);

  if (!shownPro) return null;
  const p = shownPro;
  const items = data?.items || [];
  const count = Math.max(data?.total || 0, p.reviews, items.length);
  const avg = items.length > 0
    ? items.reduce((s, r) => s + r.rating, 0) / items.length
    : p.rating;

  // 머리(손잡이·제목)를 끌어내리면 닫힘 — 110px 넘게 또는 빠르게 튕기면
  const onDown = (e: React.PointerEvent) => {
    dragRef.current = { y: e.clientY, t: performance.now() };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    setDragY(Math.max(0, e.clientY - dragRef.current.y));
  };
  const onUp = (e: React.PointerEvent) => {
    const start = dragRef.current;
    dragRef.current = null;
    if (!start) return;
    const dy = Math.max(0, e.clientY - start.y);
    const v = dy / Math.max(1, performance.now() - start.t);
    if (dy > 110 || v > 0.9) close();
    else setDragY(0);
  };

  return (
    <div
      className="ft-scrim"
      onClick={close}
      style={closing ? { opacity: 0, transition: 'opacity .24s ease' } : undefined}
    >
      <div
        className="ft-sheet flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label={`${p.name} 사회자 리뷰`}
        onClick={(e) => e.stopPropagation()}
        style={{
          height: 'min(86dvh, 760px)',
          maxWidth: 520,
          padding: 0,
          overflow: 'hidden',
          transform: closing ? 'translateY(100%)' : `translateY(${dragY}px)`,
          transition: dragRef.current ? 'none' : 'transform .26s cubic-bezier(.22,1,.36,1)',
        }}
      >
        {/* 머리 — 손잡이 · '리뷰 N' · 평균 별점. 닫기 버튼은 없음(260926 사장) — 여기를 끌어내리거나 바깥·Esc 로 닫힘 */}
        <div className="shrink-0 touch-none select-none px-5 pb-3 pt-3" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <div className="ft-grab" style={{ margin: '0 auto 14px' }} aria-hidden="true" />
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[19px] font-bold tracking-[-0.4px] text-[#191F28]">
                리뷰 <span className="text-[#3182F6]">{count}</span>
              </h2>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-[14px] tracking-[-0.2px] text-[#8B95A1]">
                {avg > 0 && (
                  <>
                    <Stars value={avg} size={13} />
                    <b className="font-semibold text-[#4E5968]">{avg.toFixed(1)}</b>
                    <span>·</span>
                  </>
                )}
                <span className="truncate">{p.name}</span>
              </p>
            </div>
          </div>
        </div>
        <div className="h-px shrink-0 bg-[#F2F4F6]" />

        {/* 목록 — 쪽 나눔 없이 굴리면 이어서 */}
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(20px+env(safe-area-inset-bottom,0px))]">
          {!data && !failed ? (
            <div aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={`flex gap-2.5 py-4 ${i ? 'border-t border-[#F2F4F6]' : ''}`}>
                  <div className="skeleton h-9 w-9 shrink-0" style={{ borderRadius: 9999 }} />
                  <div className="flex-1">
                    <div className="skeleton h-[15px] w-24" style={{ borderRadius: 6 }} />
                    <div className="skeleton mt-2.5 h-[15px] w-[88%]" style={{ borderRadius: 6 }} />
                    <div className="skeleton mt-2 h-[15px] w-[62%]" style={{ borderRadius: 6 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : failed ? (
            <div className="py-16 text-center">
              <p className="text-[16px] font-bold text-[#191F28]">리뷰를 불러오지 못했어요</p>
              <p className="mt-1 text-[14px] text-[#8B95A1]">잠시 후 다시 열어 주세요</p>
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-[16px] font-bold text-[#191F28]">{p.reviews > 0 ? '후기 본문은 아직 없어요' : '아직 리뷰가 없어요'}</p>
              <p className="mt-1 text-[14px] text-[#8B95A1]">
                {p.reviews > 0 ? '별점만 남긴 후기예요. 본문이 등록되면 여기에 보여요' : '행사를 마친 고객의 후기가 여기에 쌓여요'}
              </p>
            </div>
          ) : (
            <>
              {items.slice(0, shown).map((review, i) => (
                <div key={review.id} className={i < 8 ? 'qd-a-item' : ''} style={i < 8 ? { animationDelay: `${0.04 + i * 0.04}s` } : undefined}>
                  <ReviewComment review={review} pro={p} first={i === 0} />
                </div>
              ))}
              {shown < items.length && <div ref={moreRef} className="h-10" />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
