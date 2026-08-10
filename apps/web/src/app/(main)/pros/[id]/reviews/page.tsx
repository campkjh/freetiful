'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, MoreHorizontal, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/store/auth.store';
import { reviewApi } from '@/lib/api/review.api';
import { apiClient } from '@/lib/api/client';
import {
  buildReviewFallbacks,
  getReviewComment,
  getReviewRows,
  getReviewTotal,
  type ReviewDisplayItem,
} from '@/lib/review-display';

const BRAND = '#3180F7';

function StarRating({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-0">
      {[0, 1, 2, 3, 4].map((i) => (
        // 별 모양은 제공받은 아이콘 그대로. 예전 자체 path 는 좌표 정밀도가 낮아
        // iOS 사파리에서 뾰족한 부분이 뭉개져 깨져 보였다.
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          shapeRendering="geometricPrecision"
          style={{ display: 'block', flexShrink: 0 }}
        >
          <path
            d="M21.5409 6.54807L24.6489 12.8481C24.7724 13.0978 24.9547 13.3138 25.1801 13.4775C25.4055 13.6413 25.6672 13.7478 25.9429 13.7881L32.8939 14.7981C33.2111 14.8441 33.5092 14.9779 33.7543 15.1845C33.9994 15.391 34.1819 15.6621 34.281 15.9669C34.3802 16.2717 34.3921 16.5982 34.3153 16.9094C34.2386 17.2207 34.0764 17.5042 33.8469 17.7281L28.8159 22.6281C28.6168 22.8228 28.4678 23.0629 28.3818 23.3278C28.2957 23.5927 28.2752 23.8745 28.3219 24.1491L29.5099 31.0721C29.5639 31.388 29.5286 31.7128 29.4077 32.0097C29.2869 32.3067 29.0855 32.5639 28.8262 32.7523C28.5669 32.9408 28.26 33.053 27.9403 33.0763C27.6206 33.0996 27.3008 33.033 27.0169 32.8841L20.7999 29.6171C20.5532 29.4872 20.2787 29.4193 19.9999 29.4193C19.7211 29.4193 19.4466 29.4872 19.1999 29.6171L12.9819 32.8861C12.698 33.035 12.3782 33.1016 12.0585 33.0783C11.7388 33.055 11.4319 32.9428 11.1726 32.7543C10.9133 32.5659 10.7119 32.3087 10.5911 32.0117C10.4703 31.7148 10.4349 31.39 10.4889 31.0741L11.6769 24.1511C11.7236 23.8765 11.7031 23.5947 11.6171 23.3298C11.531 23.0649 11.3821 22.8248 11.1829 22.6301L6.15191 17.7301C5.92245 17.5062 5.76019 17.2227 5.68347 16.9114C5.60676 16.6002 5.61864 16.2737 5.71779 15.9689C5.81694 15.6641 5.99939 15.393 6.24452 15.1865C6.48965 14.9799 6.78768 14.8461 7.10491 14.8001L14.0559 13.7901C14.3316 13.7498 14.5933 13.6433 14.8187 13.4795C15.0441 13.3158 15.2264 13.0998 15.3499 12.8501L18.4579 6.55007C18.5997 6.26234 18.8191 6.02002 19.0914 5.8505C19.3637 5.68098 19.678 5.59103 19.9988 5.59082C20.3195 5.59061 20.634 5.68015 20.9065 5.84932C21.179 6.01849 21.3988 6.26053 21.5409 6.54807Z"
            fill={i < Math.floor(value) ? '#FFCD00' : '#E5E7EB'}
          />
        </svg>
      ))}
    </div>
  );
}

type ReviewItem = ReviewDisplayItem;

function formatReviewDate(value?: string | Date | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' });
}

function maskReviewerName(name?: string | null, isAnonymous?: boolean) {
  if (isAnonymous) return '익명';
  if (!name) return '고객';
  return `${name.slice(0, 1)}**${'****'}`;
}

function getReviewPhotos(review: any) {
  const rows = Array.isArray(review?.images) ? review.images : Array.isArray(review?.photos) ? review.photos : [];
  return rows
    .map((item: any) => (typeof item === 'string' ? item : item?.imageUrl || item?.url))
    .filter(Boolean);
}

function mapApiReview(r: any): ReviewItem {
  return {
    id: String(r.id),
    name: maskReviewerName(r.reviewer?.name, r.isAnonymous),
    rating: Number(r.avgRating) || 0,
    date: formatReviewDate(r.createdAt),
    scores: {
      경력: Number(r.ratingExperience) || 0,
      만족도: Number(r.ratingSatisfaction) || 0,
      구성력: Number(r.ratingComposition) || 0,
      위트: Number(r.ratingWit) || 0,
      발성: Number(r.ratingVoice) || 0,
      이미지: Number(r.ratingAppearance) || 0,
    },
    content: getReviewComment(r),
    workDays: Number(r.workDays) || 14,
    orderRange: r.orderRange || '협의',
    badge: r.badge || '',
    photos: getReviewPhotos(r),
    proReply: r.proReply
      ? { date: formatReviewDate(r.proRepliedAt || r.updatedAt || r.createdAt), content: r.proReply }
      : undefined,
  };
}

function mergeReviewRows(primary: any[] = [], secondary: any[] = []) {
  const seen = new Set<string>();
  const merged: any[] = [];
  [...primary, ...secondary].forEach((review, index) => {
    const key = String(review?.id || `${review?.createdAt || ''}-${review?.comment || ''}-${index}`);
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(review);
  });
  return merged;
}

function mergeReviewItems(items: ReviewItem[]) {
  const seen = new Set<string>();
  return items.filter((review, index) => {
    const key = String(review.id || `${review.date}-${review.content}-${index}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function ReviewsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [userReviews, setUserReviews] = useState<ReviewItem[]>([]);
  const [canWriteReview, setCanWriteReview] = useState(false);
  const [canSelfReview, setCanSelfReview] = useState(false);
  const [apiReviews, setApiReviews] = useState<ReviewItem[] | null>(null);
  const [proName, setProName] = useState<string>('');
  const [detailReviewCount, setDetailReviewCount] = useState(0);
  const [detailAvgRating, setDetailAvgRating] = useState(0);

  // API에서 리뷰 가져오기
  useEffect(() => {
    if (!id) return;
    let alive = true;
    setApiReviews(null);
    setCanWriteReview(false);
    setCanSelfReview(false);

    Promise.allSettled([
      apiClient.get(`/api/v1/discovery/pros/${id}`, { params: { nocache: 1, _: Date.now() } }),
      reviewApi.getByPro(id, { limit: 100 }),
    ]).then(([detailResult, reviewsResult]) => {
      if (!alive) return;

      let detailReviews: any[] = [];
      let detailCount = 0;
      let detailRating = 0;
      if (detailResult.status === 'fulfilled') {
        const detail = detailResult.value.data;
        const name = detail?.user?.name || detail?.name || '';
        if (name) setProName(name);
        detailCount = Number(detail?.reviewCount) || 0;
        detailRating = Number(detail?.avgRating) || 0;
        detailReviews = Array.isArray(detail?.reviews) ? detail.reviews : [];
      }

      const reviewPayload = reviewsResult.status === 'fulfilled' ? reviewsResult.value : null;
      const apiItems = getReviewRows(reviewPayload);
      const apiTotal = getReviewTotal(reviewPayload, apiItems);
      const reviews = mergeReviewRows(apiItems, detailReviews);
      const displayItems = reviews.length > 0
        ? reviews.map(mapApiReview)
        : buildReviewFallbacks({ id, reviewCount: Math.max(detailCount, apiTotal), rating: detailRating });
      setDetailReviewCount(Math.max(detailCount, apiTotal, displayItems.length));
      setDetailAvgRating(detailRating);
      setApiReviews(displayItems);
    }).catch(() => {
      if (alive) setApiReviews([]);
    });

    // 결제 완료 건이 있는지 확인 (리뷰 작성 권한)
    if (authUser) {
      apiClient.get('/api/v1/payment', { params: { limit: 100 } })
        .then((res) => {
          const payments = res.data?.data || [];
          // 이 프로와 결제 완료된 건이 있는지 확인
          const hasCompletedPayment = payments.some((p: any) =>
            p.status === 'completed' &&
            !p.reviewId &&
            (p.proProfileId === id || p.proProfile?.id === id || p.quotations?.some((q: any) => q.proProfileId === id))
          );
          setCanWriteReview(hasCompletedPayment);
        })
        .catch(() => {});
      if (authUser.role === 'pro') {
        import('@/lib/api/pros.api').then(({ prosApi }) => {
          prosApi.getMyProfile()
            .then((profile: any) => {
              const isSelf = Boolean(profile?.id && (profile.id === id || profile.userId === id));
              setCanSelfReview(isSelf);
              if (isSelf) setCanWriteReview(true);
            })
            .catch(() => {});
        });
      } else {
        setCanSelfReview(false);
      }
    }

    // localStorage fallback
    try {
      const stored = JSON.parse(localStorage.getItem('freetiful-reviews') || '[]');
      const proReviews = stored.filter((r: any) => r.proId === id);
      setUserReviews(proReviews);
    } catch {}

    return () => { alive = false; };
  }, [id, authUser]);

  const allReviews = mergeReviewItems([...userReviews, ...(apiReviews || [])]);
  const hasMetricOnlyReviews = allReviews.length === 0 && detailReviewCount > 0 && detailAvgRating > 0;
  const displayedReviewCount = Math.max(allReviews.length, detailReviewCount);
  const missingReviewDetailCount = Math.max(0, displayedReviewCount - allReviews.length);
  const metricOnlyReviewMessage = '상세 후기 본문은 아직 등록되지 않았습니다. 등록된 평점과 리뷰 수를 기준으로 표시합니다.';

  const avgRating = allReviews.length > 0
    ? Math.round((allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length) * 10) / 10
    : detailAvgRating;

  const SCORE_KEYS = ['경력', '만족도', '구성력', '위트', '발성', '이미지'] as const;
  const categoryScores = SCORE_KEYS.map((label) => {
    const vals = allReviews.map((r) => (r.scores as Record<string, number>)[label] || 0).filter(Boolean);
    const avg = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : detailAvgRating;
    return { label, value: Math.round(avg * 10) / 10 };
  });

  return (
    <div className="bg-white min-h-screen pb-10" style={{ letterSpacing: '-0.02em' }}>
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-50" data-native-back-header>
        <div className="flex items-center px-3 h-[52px]">
          <button onClick={() => router.back()} className="p-1.5 active:scale-90 transition-transform">
            <ChevronLeft size={26} className="text-gray-900" />
          </button>
          <h1 className="ml-1 text-[18px] font-bold text-gray-900">리뷰 전체보기</h1>
        </div>
      </div>

      {/* Summary */}
      <div className="px-4 pt-6 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-3">
          <StarRating value={avgRating} size={22} />
          <span className="text-[26px] font-bold text-gray-900">{avgRating.toFixed(1)}</span>
          <span className="text-[15px] text-gray-400">({displayedReviewCount})</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {categoryScores.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="text-[12px] text-gray-500 w-12 shrink-0">{item.label}</span>
              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(item.value / 5) * 100}%`, background: `linear-gradient(90deg, ${BRAND}, #6BA5FA)` }} />
              </div>
              <span className="text-[12px] font-bold text-gray-900 tabular-nums w-6 text-right">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Review List */}
      <div className="px-4 divide-y divide-gray-100">
        {/* Write Review Button — 결제 완료 건이 있는 경우만 표시 */}
        {canWriteReview ? (
          <div className="px-4 py-3">
            <Link
              href={`/pros/${id}/reviews/write`}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#3180F7] text-white rounded-xl font-bold text-[14px] active:scale-[0.98] transition-transform"
            >
              <Pencil size={14} />
              {canSelfReview ? '본인 리뷰 작성하기' : '리뷰 작성하기'}
            </Link>
          </div>
        ) : authUser ? (
          <div className="px-4 py-3">
            <div className="w-full flex items-center justify-center gap-2 py-3 bg-gray-100 text-gray-400 rounded-xl font-bold text-[14px]">
              행사 완료 후 리뷰를 작성할 수 있습니다
            </div>
          </div>
        ) : null}

        {apiReviews === null && userReviews.length === 0 && (
          <div className="py-12 text-center text-[13px] text-gray-400">리뷰를 불러오는 중입니다</div>
        )}

        {apiReviews !== null && hasMetricOnlyReviews && (
          <div className="py-6">
            <div className="rounded-2xl bg-gray-50 px-4 py-5">
              <div className="mb-2 flex items-center gap-2">
                <StarRating value={avgRating} size={14} />
                <span className="text-[13px] font-bold text-gray-900">{avgRating.toFixed(1)}</span>
                <span className="text-[12px] text-gray-400">({displayedReviewCount})</span>
              </div>
              <p className="text-[14px] leading-[1.7] text-gray-800">{metricOnlyReviewMessage}</p>
            </div>
          </div>
        )}

        {apiReviews !== null && allReviews.length > 0 && missingReviewDetailCount > 0 && (
          <div className="py-3">
            <div className="rounded-xl bg-[#F5F8FF] px-4 py-3 text-[12px] font-semibold text-[#3180F7]">
              나머지 {missingReviewDetailCount.toLocaleString()}개 리뷰 상세를 동기화하고 있습니다.
            </div>
          </div>
        )}

        {apiReviews !== null && allReviews.length === 0 && !hasMetricOnlyReviews && (
          <div className="py-12 text-center">
            <p className="text-[14px] font-semibold text-gray-700">아직 표시할 리뷰가 없습니다</p>
            <p className="mt-1 text-[12px] text-gray-400">리뷰가 등록되면 이곳에 바로 보여집니다</p>
          </div>
        )}

        {allReviews.map((review) => (
          <div key={review.id} className="py-5 relative">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[13px]">🚀</div>
                <span className="text-[13px] text-gray-600">{review.name}</span>
              </div>
              <div className="relative">
                <button onClick={() => setMenuId(menuId === review.id ? null : review.id)} className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100">
                  <MoreHorizontal size={16} className="text-gray-400" />
                </button>
                {menuId === review.id && (
                  <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-20 min-w-[110px]">
                    <button onClick={() => { toast('신고 접수됨', { icon: '🚨' }); setMenuId(null); }} className="w-full text-left px-4 py-2 text-[13px] text-gray-700 hover:bg-gray-50">신고하기</button>
                    <button onClick={() => { toast('차단됨', { icon: '🚫' }); setMenuId(null); }} className="w-full text-left px-4 py-2 text-[13px] text-gray-700 hover:bg-gray-50">차단하기</button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 mb-2">
              <StarRating value={Number(review.rating) || 0} size={13} />
              <span className="text-[12px] font-bold text-gray-900">{(Number(review.rating) || 0).toFixed(1)}</span>
              <span className="text-[11px] text-gray-300">|</span>
              <span className="text-[11px] text-gray-400">{review.date}</span>
            </div>

            {/* 항목별 점수 태그 */}
            <div className="flex flex-wrap gap-1 mb-2.5">
              {Object.entries(review.scores).map(([key, val]) => (
                <span key={key} className="text-[10px] font-medium px-1.5 rounded-[5px] bg-gray-100 text-gray-600 flex items-center" style={{ height: 20 }}>
                  {key} <span className="font-bold text-[#3180F7] ml-1">{val}</span>
                </span>
              ))}
            </div>

            <p className="text-[13px] leading-[1.7] text-gray-800 mb-2">{review.content}</p>
            {review.photos && review.photos.length > 0 && (
              <div className="mb-3 flex gap-2 overflow-x-auto scrollbar-hide">
                {review.photos.slice(0, 5).map((photo, index) => (
                  <img
                    key={`${review.id}-photo-${index}`}
                    src={photo}
                    alt=""
                    className="h-20 w-20 shrink-0 rounded-xl object-cover"
                    loading="lazy"
                  />
                ))}
              </div>
            )}
            {review.badge && (
              <span className="inline-block text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full mt-1.5">{review.badge}</span>
            )}
            {review.proReply && (
              <div className="mt-3 bg-gray-50 rounded-xl p-3">
                <p className="text-[12px] font-semibold text-gray-800 mb-1">{proName || '사회자'} <span className="font-normal text-gray-400">{review.proReply.date}</span></p>
                <p className="text-[12px] leading-[1.6] text-gray-600">{review.proReply.content}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
