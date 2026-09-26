'use client';

// '이 사회자의 스타일을 소개합니다' — 실제 리뷰 AI 요약 카드(260926 사장: 토스 '✦ 이런 서비스도 좋아하실 것 같아요' 카드 결).
//  · 목록 리뷰 시트(ProReviewsSheet)·사회자 상세(모바일 리뷰 칸 / PC 리뷰 옆 칸)가 같이 쓴다.
//  · 순서: 카드 페이드업 → 본문 칸 촤락 펼침 → 요약 문장 단어 단위 흐림→선명 → 특징 칩 차례로(globals .style-*).
//    화면에 보일 때 시작한다(상세처럼 아래쪽에 있으면 굴려서 닿는 순간).
//  · 데이터 = API GET /review/pro/:id/summary(실제 리뷰만 요약, 리뷰 2개 미만이면 null → 카드 안 띄움).
import { useEffect, useRef, useState } from 'react';
import { reviewApi } from '@/lib/api/review.api';
import AiIcon from '@/components/icons/AiIcon';

export type StyleSummary = { summary: string; keywords: string[]; source: 'ai' | 'rule'; reviewCount: number };

// 같은 사회자를 다시 열면 바로(서버도 하루 기억한다)
const summaryCache = new Map<string, { at: number; value: StyleSummary | null }>();

export function useProStyleSummary(proId: string | null | undefined, reviewCount: number) {
  const [state, setState] = useState<{ loading: boolean; value: StyleSummary | null }>(() => {
    const hit = proId ? summaryCache.get(proId) : undefined;
    return hit && Date.now() - hit.at < 10 * 60_000 ? { loading: false, value: hit.value } : { loading: false, value: null };
  });
  useEffect(() => {
    if (!proId) return;
    const hit = summaryCache.get(proId);
    if (hit && Date.now() - hit.at < 10 * 60_000) {
      setState({ loading: false, value: hit.value });
      return;
    }
    if (reviewCount < 2) {
      setState({ loading: false, value: null });
      return;
    }
    let alive = true;
    setState({ loading: true, value: null });
    reviewApi.getSummary(proId)
      .then((value) => {
        summaryCache.set(proId, { at: Date.now(), value });
        if (alive) setState({ loading: false, value });
      })
      .catch(() => { if (alive) setState({ loading: false, value: null }); });
    return () => { alive = false; };
  }, [proId, reviewCount]);
  return state;
}

export default function StyleIntroCard({
  summary,
  loading,
  compact = false,
  className = '',
}: {
  summary: StyleSummary | null;
  loading: boolean;
  /** PC 상세 리뷰 옆 좁은 칸 — 글자·여백을 줄이고 문장은 세 줄까지 */
  compact?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setSeen(true); io.disconnect(); }
    }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
    // 카드는 요약을 받기 시작할 때 생긴다 — 그때(loading·summary 가 바뀔 때) 다시 붙여야 보이는 걸 잡는다
  }, [seen, loading, summary]);

  if (!loading && !summary) return null;
  const words = summary ? summary.summary.split(/\s+/).filter(Boolean) : [];
  const wordBase = 0.55; // 칸이 펼쳐지기 시작한 뒤
  const chipBase = wordBase + words.length * 0.045 + 0.2;
  const open = seen && Boolean(summary);

  return (
    <div
      ref={ref}
      className={`style-intro rounded-[20px] border border-[#F5E4EE] ${compact ? 'px-4 py-3.5' : 'px-[18px] py-4'} ${seen ? '' : 'is-waiting'} ${className}`}
    >
      <div className="flex items-center gap-2">
        <AiIcon size={compact ? 18 : 20} tile={false} spin={loading && !summary} />
        <p className={`style-intro-title font-bold tracking-[-0.3px] ${compact ? 'text-[15px]' : 'text-[17px]'}`}>이 사회자의 스타일을 소개합니다</p>
      </div>
      {loading && !summary && (
        <p className={`style-intro-wait mt-2.5 tracking-[-0.2px] text-[#9A8FAE] ${compact ? 'text-[13px]' : 'text-[14px]'}`}>리뷰를 읽고 있어요…</p>
      )}
      <div className={`style-intro-body${open ? ' is-open' : ''}`}>
        <div className="min-h-0 overflow-hidden">
          {open && summary && (
            <>
              <p className={`tracking-[-0.3px] text-[#333D4B] ${compact ? 'mt-2 line-clamp-3 text-[13.5px] leading-[1.6]' : 'mt-3 text-[15.5px] leading-[1.7]'}`}>
                {words.map((word, i) => (
                  <span key={i} className="style-word" style={{ animationDelay: `${wordBase + i * 0.045}s` }}>
                    {word}{i < words.length - 1 ? ' ' : ''}
                  </span>
                ))}
              </p>
              {summary.keywords.length > 0 && (
                <div className={`flex flex-wrap gap-1.5 ${compact ? 'mt-2' : 'mt-3'}`}>
                  {summary.keywords.map((keyword, i) => (
                    <span
                      key={keyword}
                      className={`style-chip rounded-[8px] bg-white/80 font-semibold tracking-[-0.2px] text-[#6A4BB8] ring-1 ring-[#EFE6FB] ${compact ? 'px-2 py-[3px] text-[12px]' : 'px-2.5 py-[5px] text-[13px]'}`}
                      style={{ animationDelay: `${chipBase + i * 0.08}s` }}
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
