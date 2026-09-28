'use client';

// PC 웨딩숲 '실시간 인기글' 칸(260928 사장 'PC 에서는 실시간 검색어 같은 UI' — 토스 숏텐츠 목록 참고).
//  · 검색 기록은 모으지 않으므로 '검색어'가 아니라 지금 반응이 많은 글(인기순 핫스코어 = 좋아요·댓글·조회 ÷ 경과시간)을 보여 준다.
//  · 한 줄 = 돋보기 · 굵은 제목 · 새 글(24시간 안) N · 사진.
//  · 줄을 누르면 흰 칸으로 떠오르며 아래에 미리보기(첫 문장 · 몇 시간 전 · 큰 사진)가 펼쳐지고, 미리보기를 누르면 글이 열린다.
//  · 화면을 보고 있을 때만 1분 30초마다 새로 받는다('오후 3:12 기준').
import { useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { cfetch } from '@/lib/community/cfetch';
import { formatRelativeTime } from '@/lib/relativeTime';

type TrendPost = { id: string; title: string; content: string; imageUrls: string[]; createdAt: string; isBlinded?: boolean };

function SearchGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="fcom-trend-glyph">
      <circle cx="10.5" cy="10.5" r="6.2" stroke="currentColor" strokeWidth="2.3" />
      <path d="M15.2 15.2L20 20" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" />
    </svg>
  );
}

const lines = (text: string) => (text || '').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
const headline = (p: TrendPost) => p.title?.trim() || lines(p.content)[0] || '';
const snippet = (p: TrendPost) => {
  const head = headline(p);
  return lines(p.content).filter((l) => l !== head).join(' ');
};
const isNew = (p: TrendPost) => Date.now() - new Date(p.createdAt).getTime() < 24 * 60 * 60 * 1000;
const clock = (d: Date) => `${d.getHours() < 12 ? '오전' : '오후'} ${((d.getHours() + 11) % 12) + 1}:${String(d.getMinutes()).padStart(2, '0')} 기준`;

export default function TrendPanel({ onOpen, compact = false }: { onOpen: (postId: string) => void; compact?: boolean }) {
  const [items, setItems] = useState<TrendPost[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [at, setAt] = useState<Date | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await cfetch('/api/community/posts?sort=popular');
        const data = await res.json();
        if (!alive || !res.ok) return;
        const next = ((data.posts || []) as TrendPost[]).filter((p) => !p.isBlinded && headline(p)).slice(0, compact ? 5 : 8);
        setItems(next);
        setAt(new Date());
      } catch { /* 다음 차례에 다시 */ }
    };
    load();
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') load(); }, 90_000);
    return () => { alive = false; window.clearInterval(t); };
  }, [compact]);

  if (items.length === 0) return null;

  return (
    <MotionConfig reducedMotion="user">
      <section className={`fcom-trend${compact ? ' is-compact' : ''}`} aria-label="실시간 인기글">
        <div className="fcom-trend-head">
          <h3>실시간 인기글</h3>
          {at && <span>{clock(at)}</span>}
        </div>
        <ol className="fcom-trend-list">
          {items.map((p, i) => {
            const open = openId === p.id;
            const photo = p.imageUrls?.[0];
            const more = snippet(p);
            return (
              <motion.li
                key={p.id}
                layout="position"
                className={`fcom-trend-item${open ? ' is-open' : ''}`}
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.04 * i, type: 'spring', stiffness: 420, damping: 34 }}
              >
                <button type="button" className="fcom-trend-row" onClick={() => setOpenId(open ? null : p.id)} aria-expanded={open}>
                  <SearchGlyph />
                  <span className="fcom-trend-title">{headline(p)}</span>
                  {isNew(p) && <span className="fcom-trend-n" aria-label="새 글">N</span>}
                  {photo && !open && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="" className="fcom-trend-thumb" loading="lazy" />
                  )}
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      key="more"
                      className="fcom-trend-more"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 40 }}
                    >
                      <button type="button" className="fcom-trend-card" onClick={() => onOpen(p.id)} aria-label={`${headline(p)} 글 열기`}>
                        <span className="fcom-trend-text">
                          {more && <span className="fcom-trend-snippet">{more}</span>}
                          <span className="fcom-trend-foot">
                            <span className="fcom-trend-time">{formatRelativeTime(p.createdAt)}</span>
                            <span className="fcom-trend-go">
                              글 보기
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </span>
                          </span>
                        </span>
                        {photo && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={photo} alt="" className="fcom-trend-photo" />
                        )}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.li>
            );
          })}
        </ol>
      </section>
    </MotionConfig>
  );
}
