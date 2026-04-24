'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Star, MessageCircle } from 'lucide-react';
import { reviewApi } from '@/lib/api/review.api';
import { useAuthStore } from '@/lib/store/auth.store';

type ReviewItem = {
  id: string;
  comment?: string | null;
  ratingSatisfaction?: number;
  ratingComposition?: number;
  ratingExperience?: number;
  ratingAppearance?: number;
  ratingVoice?: number;
  ratingWit?: number;
  reply?: string | null;
  proReply?: string | null;
  createdAt: string;
  reviewer?: { name?: string | null; profileImageUrl?: string | null };
  proProfile?: {
    user?: { name?: string | null; profileImageUrl?: string | null };
    images?: Array<{ imageUrl?: string }>;
  };
};

function avg(review: ReviewItem) {
  const values = [
    review.ratingSatisfaction,
    review.ratingComposition,
    review.ratingExperience,
    review.ratingAppearance,
    review.ratingVoice,
    review.ratingWit,
  ].map(Number).filter((v) => Number.isFinite(v) && v > 0);
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function date(value: string) {
  return new Date(value).toLocaleDateString('ko-KR');
}

export default function ReviewsPage() {
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [total, setTotal] = useState(0);
  const [average, setAverage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authUser) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    reviewApi.getMine({ page: 1, limit: 50 })
      .then((res: any) => {
        if (!alive) return;
        const data = Array.isArray(res?.data) ? res.data : [];
        setItems(data);
        setTotal(Number(res?.total || data.length || 0));
        setAverage(res?.avgRating != null ? Number(res.avgRating) : null);
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [authUser]);

  const computedAverage = average ?? (items.length ? items.reduce((sum, item) => sum + avg(item), 0) / items.length : 0);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-gray-100 bg-white/90 backdrop-blur-xl px-4 pt-12 pb-3">
        <button onClick={() => router.back()} className="p-1 active:scale-90 transition-transform"><ChevronLeft size={24} /></button>
        <h1 className="text-[18px] font-bold">내 리뷰 관리</h1>
      </header>

      <section className="px-4 pt-5">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] text-gray-400">전체 리뷰</p>
              <p className="mt-1 text-[28px] font-black text-gray-900">{loading ? '...' : total}</p>
            </div>
            <div className="text-right">
              <p className="text-[12px] text-gray-400">평균 평점</p>
              <p className="mt-1 flex items-center justify-end gap-1 text-[24px] font-black text-gray-900">
                <Star size={20} className="fill-yellow-400 text-yellow-400" />
                {loading ? '...' : computedAverage.toFixed(1)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pt-4 space-y-3">
        {loading ? (
          <div className="rounded-2xl bg-white p-5 text-[13px] text-gray-400">리뷰를 불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center">
            <MessageCircle size={34} className="mx-auto text-gray-300" />
            <p className="mt-3 text-[14px] font-semibold text-gray-600">아직 리뷰가 없습니다</p>
            <p className="mt-1 text-[12px] text-gray-400">거래가 완료되고 리뷰가 작성되면 이곳에서 관리할 수 있습니다</p>
          </div>
        ) : items.map((review) => {
          const targetName = review.proProfile?.user?.name || review.reviewer?.name || '고객';
          const image = review.proProfile?.images?.[0]?.imageUrl || review.proProfile?.user?.profileImageUrl || review.reviewer?.profileImageUrl || '/images/default-profile.svg';
          return (
            <article key={review.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <img src={image} alt="" className="h-11 w-11 rounded-full object-cover bg-gray-100" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[14px] font-bold text-gray-900">{targetName}</p>
                    <span className="shrink-0 text-[11px] text-gray-400">{date(review.createdAt)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1">
                    <Star size={14} className="fill-yellow-400 text-yellow-400" />
                    <span className="text-[13px] font-bold text-gray-900">{avg(review).toFixed(1)}</span>
                  </div>
                  {review.comment && (
                    <p className="mt-2 text-[13px] leading-relaxed text-gray-700">{review.comment}</p>
                  )}
                  {(review.proReply || review.reply) && (
                    <div className="mt-3 rounded-xl bg-blue-50 px-3 py-2">
                      <p className="text-[11px] font-bold text-blue-600">내 답글</p>
                      <p className="mt-1 text-[12px] text-gray-700">{review.proReply || review.reply}</p>
                    </div>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
