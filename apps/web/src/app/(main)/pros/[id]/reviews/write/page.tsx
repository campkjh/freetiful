'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Camera, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const BRAND = '#3180F7';

const SCORE_CATEGORIES = ['경력', '만족도', '구성력', '위트', '발성', '이미지'] as const;
const BADGE_OPTIONS = ['개인', 'Biz·기업', '대행사/에이전시'];
const ORDER_RANGES = ['30만원 이하', '30만원 ~ 50만원', '50만원 ~ 80만원', '80만원 ~ 100만원', '100만원 ~ 200만원', '200만원 이상'];

function InteractiveStars({ value, onChange, size = 32 }: { value: number; onChange: (v: number) => void; size?: number }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <motion.button
          key={star}
          whileTap={{ scale: 1.3 }}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(star === value ? star - 0.5 : star)}
          className="p-0.5"
        >
          <svg width={size} height={size} viewBox="0 0 24 24" fill={(hover || value) >= star ? BRAND : '#E5E7EB'}>
            <path d="M12 2l2.9 6.5 7.1.8-5.3 4.9 1.5 7L12 17.8 5.8 21.2l1.5-7L2 9.3l7.1-.8L12 2z" />
          </svg>
        </motion.button>
      ))}
      <span className="ml-2 text-[18px] font-bold text-gray-900">{value.toFixed(1)}</span>
    </div>
  );
}

function MiniStars({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-[14px] text-gray-700 font-medium">{label}</span>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <motion.button
            key={star}
            whileTap={{ scale: 1.2 }}
            onClick={() => onChange(star === value ? star - 0.5 : star)}
            className="p-0"
          >
            <svg width={18} height={18} viewBox="0 0 24 24" fill={value >= star ? BRAND : '#E5E7EB'}>
              <path d="M12 2l2.9 6.5 7.1.8-5.3 4.9 1.5 7L12 17.8 5.8 21.2l1.5-7L2 9.3l7.1-.8L12 2z" />
            </svg>
          </motion.button>
        ))}
        <span className="ml-1.5 text-[13px] font-bold text-gray-500 w-6 text-right">{value.toFixed(1)}</span>
      </div>
    </div>
  );
}

export default function WriteReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [overallRating, setOverallRating] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>(
    Object.fromEntries(SCORE_CATEGORIES.map(c => [c, 0]))
  );
  const [content, setContent] = useState('');
  const [badge, setBadge] = useState('');
  const [orderRange, setOrderRange] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const updateScore = (key: string, val: number) => {
    setScores(prev => ({ ...prev, [key]: val }));
  };

  const handleAddPhoto = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => setPhotos(prev => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const isValid = overallRating > 0 && content.trim().length >= 10 && badge;

  const handleSubmit = async () => {
    if (!isValid) return;
    setSubmitting(true);

    // Save review to localStorage
    const review = {
      id: `r_${Date.now()}`,
      proId: id,
      name: '나' + '*'.repeat(8),
      rating: overallRating,
      date: new Date().toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace('.', ''),
      scores,
      content: content.trim(),
      badge,
      orderRange,
      photos,
      createdAt: Date.now(),
    };

    const existing = JSON.parse(localStorage.getItem('freetiful-reviews') || '[]');
    existing.unshift(review);
    localStorage.setItem('freetiful-reviews', JSON.stringify(existing));

    await new Promise(r => setTimeout(r, 1000));
    setSubmitting(false);
    setShowSuccess(true);
  };

  // Success page
  if (showSuccess) {
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center px-8" style={{ height: '100dvh' }}>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center mb-6"
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <path d="M12 2l2.9 6.5 7.1.8-5.3 4.9 1.5 7L12 17.8 5.8 21.2l1.5-7L2 9.3l7.1-.8L12 2z" fill={BRAND} />
          </svg>
        </motion.div>
        <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-[22px] font-bold text-gray-900 text-center">
          리뷰가 등록되었습니다!
        </motion.h2>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="text-[14px] text-gray-500 text-center mt-2">
          소중한 후기 감사합니다.
        </motion.p>
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => router.push(`/pros/${id}/reviews`)}
          className="mt-8 w-full max-w-xs py-4 bg-[#3180F7] text-white rounded-2xl font-bold text-[16px]"
        >
          리뷰 보러가기
        </motion.button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white flex flex-col" style={{ height: '100dvh' }}>
      {/* Header */}
      <div className="shrink-0 sticky top-0 z-30 bg-white border-b border-gray-100">
        <div className="flex items-center px-3 h-[52px]">
          <motion.button onClick={() => router.back()} whileTap={{ scale: 0.9 }} className="p-1.5">
            <ChevronLeft size={24} className="text-gray-900" />
          </motion.button>
          <h1 className="ml-1 text-[18px] font-bold text-gray-900">리뷰 작성</h1>
        </div>
      </div>

      {/* Content — scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        {/* Overall Rating */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <p className="text-[16px] font-bold text-gray-900 mb-3">전체 만족도를 평가해주세요</p>
          <div className="flex justify-center">
            <InteractiveStars value={overallRating} onChange={setOverallRating} size={36} />
          </div>
        </motion.div>

        {/* Category Scores */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6">
          <p className="text-[13px] font-bold text-gray-400 uppercase tracking-wider mb-2">항목별 평가</p>
          <div className="bg-gray-50 rounded-2xl px-4 divide-y divide-gray-100">
            {SCORE_CATEGORIES.map((cat) => (
              <MiniStars key={cat} label={cat} value={scores[cat]} onChange={(v) => updateScore(cat, v)} />
            ))}
          </div>
        </motion.div>

        {/* Badge Selection */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-6">
          <p className="text-[13px] font-bold text-gray-400 uppercase tracking-wider mb-2">고객 유형</p>
          <div className="flex gap-2">
            {BADGE_OPTIONS.map((b) => (
              <motion.button
                key={b}
                whileTap={{ scale: 0.95 }}
                onClick={() => setBadge(b)}
                className={`px-4 py-2.5 rounded-xl text-[14px] font-medium transition-colors ${
                  badge === b ? 'bg-[#3180F7] text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {b}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Order Range */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-6">
          <p className="text-[13px] font-bold text-gray-400 uppercase tracking-wider mb-2">결제 금액대</p>
          <div className="flex flex-wrap gap-2">
            {ORDER_RANGES.map((r) => (
              <motion.button
                key={r}
                whileTap={{ scale: 0.95 }}
                onClick={() => setOrderRange(orderRange === r ? '' : r)}
                className={`px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                  orderRange === r ? 'bg-[#3180F7] text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {r}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Review Content */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="mb-6">
          <p className="text-[13px] font-bold text-gray-400 uppercase tracking-wider mb-2">후기 작성</p>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="서비스 이용 후기를 10자 이상 작성해주세요"
            className="w-full h-32 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-[16px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#3180F7] resize-none transition-colors"
          />
          <div className="flex items-center justify-between mt-1.5">
            <p className={`text-[12px] ${content.length >= 10 ? 'text-[#3180F7]' : 'text-gray-400'}`}>
              {content.length}자 / 최소 10자
            </p>
          </div>
        </motion.div>

        {/* Photo Upload */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mb-6">
          <p className="text-[13px] font-bold text-gray-400 uppercase tracking-wider mb-2">사진 첨부 (선택)</p>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleAddPhoto}
              className="w-[72px] h-[72px] shrink-0 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1"
            >
              <Camera size={18} className="text-gray-400" />
              <span className="text-[10px] text-gray-400">{photos.length}/5</span>
            </motion.button>
            <AnimatePresence>
              {photos.map((photo, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="relative w-[72px] h-[72px] shrink-0 rounded-xl overflow-hidden"
                >
                  <img src={photo} alt="" className="w-full h-full object-cover" />
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
                  >
                    <X size={10} className="text-white" />
                  </motion.button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Submit Button */}
      <div className="shrink-0 px-4 pb-8 pt-3 bg-white border-t border-gray-100">
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          animate={{
            backgroundColor: isValid ? '#3180F7' : '#F3F4F6',
            color: isValid ? '#FFFFFF' : '#9CA3AF',
          }}
          transition={{ duration: 0.25 }}
          className="w-full py-4 rounded-2xl font-bold text-[16px] disabled:opacity-70"
        >
          {submitting ? '등록 중...' : '리뷰 등록'}
        </motion.button>
      </div>
    </div>
  );
}
