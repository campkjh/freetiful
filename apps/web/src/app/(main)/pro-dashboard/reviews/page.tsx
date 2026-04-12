'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

/* ─── Icons ─── */

const BackIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M15 19L8 12L15 5" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SmallStarIcon = ({ filled = true }: { filled?: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path
      d="M7 1L8.55 4.63L12.5 5.13L9.75 7.57L10.49 11.47L7 9.39L3.51 11.47L4.25 7.57L1.5 5.13L5.45 4.63L7 1Z"
      fill={filled ? '#FACC15' : '#E5E7EB'}
    />
  </svg>
);

const BigStarIcon = () => (
  <img src="/images/평균 평점.svg" alt="" width={36} height={36} className="shrink-0" />
);

const ReplyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M6 4L2 8L6 12V9.5C10 9.5 12.5 10.5 14 13C13.5 9 11 6.5 6 6V4Z" fill="#3180F7" />
  </svg>
);

/* ─── Types ─── */

interface Review {
  id: string;
  author: string;
  rating: number;
  text: string;
  date: string;
  badge: '개인' | 'Biz' | '에이전시';
  orderRange: string;
  scores: Record<string, number>;
}

/* ─── Data ─── */

const CATEGORY_LABELS = ['경력', '만족도', '구성력', '위트', '발성', '이미지'] as const;

const REVIEWS: Review[] = [
  {
    id: 'r1', author: '김**', rating: 5,
    text: '정말 프로페셔널하시고, 분위기를 완벽하게 이끌어주셨어요. 하객분들 모두 만족하셨습니다! 다음에 또 기회가 되면 꼭 부탁드리고 싶습니다.',
    date: '2026-04-05', badge: '개인', orderRange: '₩1,500,000 ~ ₩2,000,000',
    scores: { 경력: 5, 만족도: 5, 구성력: 5, 위트: 4, 발성: 5, 이미지: 5 },
  },
  {
    id: 'r2', author: '이**', rating: 5,
    text: '아이 돌잔치를 정말 따뜻하고 감동적으로 진행해주셔서 감사합니다. 가족들 모두 행복했어요.',
    date: '2026-03-29', badge: 'Biz', orderRange: '₩1,000,000 ~ ₩1,500,000',
    scores: { 경력: 5, 만족도: 5, 구성력: 4, 위트: 5, 발성: 5, 이미지: 4 },
  },
  {
    id: 'r3', author: '박**', rating: 4,
    text: '전문적인 진행과 세심한 배려가 인상적이었습니다. 다음에도 부탁드릴게요.',
    date: '2026-03-22', badge: '개인', orderRange: '₩1,000,000 ~ ₩1,500,000',
    scores: { 경력: 4, 만족도: 4, 구성력: 4, 위트: 4, 발성: 5, 이미지: 4 },
  },
  {
    id: 'r4', author: '정**', rating: 5,
    text: '기업 세미나를 정말 깔끔하게 진행해주셨어요. 참석자분들 반응이 정말 좋았습니다.',
    date: '2026-03-15', badge: '에이전시', orderRange: '₩3,000,000 ~ ₩3,500,000',
    scores: { 경력: 5, 만족도: 5, 구성력: 5, 위트: 3, 발성: 5, 이미지: 5 },
  },
  {
    id: 'r5', author: '한**', rating: 4,
    text: '시간 약속을 잘 지켜주시고 사전 미팅도 꼼꼼하게 진행해주셨어요. 감사합니다.',
    date: '2026-03-08', badge: '개인', orderRange: '₩1,500,000 ~ ₩2,000,000',
    scores: { 경력: 4, 만족도: 5, 구성력: 4, 위트: 4, 발성: 4, 이미지: 5 },
  },
];

const BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  '개인': { bg: 'bg-emerald-50', text: 'text-emerald-600' },
  'Biz': { bg: 'bg-blue-50', text: 'text-blue-600' },
  '에이전시': { bg: 'bg-purple-50', text: 'text-purple-600' },
};

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

export default function ReviewsPage() {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [savedReplies, setSavedReplies] = useState<Record<string, string>>({});
  const [hasDemoData, setHasDemoData] = useState(false);

  useEffect(() => {
    setHasDemoData(localStorage.getItem('freetiful-has-demo-data') === 'true');
    const stored = localStorage.getItem('pro-review-replies');
    if (stored) {
      try { setSavedReplies(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, []);

  function saveReply(reviewId: string) {
    const text = replyTexts[reviewId];
    if (!text?.trim()) return;
    const updated = { ...savedReplies, [reviewId]: text };
    setSavedReplies(updated);
    localStorage.setItem('pro-review-replies', JSON.stringify(updated));
    setReplyingTo(null);
    setReplyTexts((prev) => ({ ...prev, [reviewId]: '' }));
  }

  const reviews = hasDemoData ? REVIEWS : [];
  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '0.0';
  const avgScores: Record<string, number> = {};
  CATEGORY_LABELS.forEach((cat) => {
    avgScores[cat] = reviews.length > 0 ? Number((reviews.reduce((s, r) => s + (r.scores[cat] || 0), 0) / reviews.length).toFixed(1)) : 0;
  });

  return (
    <div className="bg-gray-50 min-h-screen pb-28">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="px-4 pt-12 pb-3 flex items-center gap-3">
          <Link href="/pro-dashboard">
            <motion.div whileTap={{ scale: 0.9 }}><BackIcon /></motion.div>
          </Link>
          <h1 className="text-lg font-bold text-gray-900">리뷰 관리</h1>
        </div>
      </div>

      {/* Rating Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-4 mt-5"
      >
        <div className="bg-white rounded-2xl p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-4 mb-4">
            <BigStarIcon />
            <div>
              <p className="text-3xl font-bold text-gray-900">{avgRating}</p>
              <div className="flex gap-0.5 mt-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <SmallStarIcon key={s} filled={s <= Math.round(Number(avgRating))} />
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">총 {reviews.length}개 리뷰</p>
            </div>
          </div>

          {/* Category Averages */}
          <div className="grid grid-cols-3 gap-2">
            {CATEGORY_LABELS.map((cat) => (
              <div key={cat} className="bg-gray-50 rounded-lg px-2.5 py-2 text-center">
                <p className="text-[10px] text-gray-400">{cat}</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{avgScores[cat]}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Review List */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="px-4 mt-6"
      >
        <h2 className="text-base font-bold text-gray-900 mb-4">전체 리뷰</h2>

        {reviews.map((review, idx) => (
          <motion.div
            key={review.id}
            variants={fadeUp}
            className={`py-4 ${idx < reviews.length - 1 ? 'border-b border-gray-100' : ''}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900">{review.author}</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <SmallStarIcon key={s} filled={s <= review.rating} />
                  ))}
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${BADGE_COLORS[review.badge].bg} ${BADGE_COLORS[review.badge].text}`}>
                  {review.badge}
                </span>
              </div>
              <span className="text-[11px] text-gray-300">{review.date}</span>
            </div>

            {/* Order Range */}
            <p className="text-[10px] text-gray-400 mb-1.5">{review.orderRange}</p>

            {/* Category Scores */}
            <div className="flex gap-1.5 flex-wrap mb-2">
              {CATEGORY_LABELS.map((cat) => (
                <span key={cat} className="text-[10px] text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                  {cat} <span className="font-bold text-gray-600">{review.scores[cat]}</span>
                </span>
              ))}
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">{review.text}</p>

            {/* Reply */}
            {savedReplies[review.id] ? (
              <div className="mt-2.5 bg-blue-50 rounded-lg px-3 py-2">
                <p className="text-[11px] text-blue-600 font-medium">내 답글</p>
                <p className="text-xs text-blue-800 mt-0.5">{savedReplies[review.id]}</p>
              </div>
            ) : (
              <>
                <AnimatePresence>
                  {replyingTo === review.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-2.5 overflow-hidden"
                    >
                      <textarea
                        value={replyTexts[review.id] || ''}
                        onChange={(e) => setReplyTexts((prev) => ({ ...prev, [review.id]: e.target.value }))}
                        placeholder="답글을 입력하세요..."
                        className="w-full border border-gray-200 rounded-lg p-2.5 text-[16px] text-gray-700 placeholder-gray-300 focus:outline-none focus:border-[#3180F7] focus:ring-1 focus:ring-[#3180F7] resize-none h-20"
                      />
                      <div className="flex gap-2 mt-1.5">
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setReplyingTo(null)}
                          className="px-3 py-1.5 text-[11px] text-gray-400 font-medium"
                        >
                          취소
                        </motion.button>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => saveReply(review.id)}
                          disabled={!replyTexts[review.id]?.trim()}
                          className="px-3 py-1.5 bg-[#3180F7] text-white text-[11px] font-bold rounded-lg disabled:opacity-40"
                        >
                          등록
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {replyingTo !== review.id && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setReplyingTo(review.id)}
                    className="flex items-center gap-1 mt-2.5 text-[11px] text-[#3180F7] font-medium"
                  >
                    <ReplyIcon /> 답글 작성
                  </motion.button>
                )}
              </>
            )}
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
