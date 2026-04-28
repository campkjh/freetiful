'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, MoreHorizontal, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/lib/store/auth.store';
import { reviewApi } from '@/lib/api/review.api';
import { apiClient } from '@/lib/api/client';

const BRAND = '#3180F7';

function StarRating({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-0">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i < Math.floor(value) ? BRAND : '#E5E7EB'}>
          <path d="M12 2l2.9 6.5 7.1.8-5.3 4.9 1.5 7L12 17.8 5.8 21.2l1.5-7L2 9.3l7.1-.8L12 2z" />
        </svg>
      ))}
    </div>
  );
}

const REVIEWS = [
  { id: 'r1', name: '나른********', rating: 5.0, date: '26.02.09 13:18', scores: { 경력: 5.0, 만족도: 5.0, 구성력: 5.0, 위트: 4.5, 발성: 5.0, 이미지: 5.0 }, content: '상담과정부터 행사 진행, 마무리까지 모두 빠르고 친절하게 응대해 주셨어요! 진행도 상황에 맞게 톤 바꿔가시면서 잘 진행해 주셨습니다!', workDays: 13, orderRange: '100만원 ~ 200만원', badge: '대행사/에이전시', proReply: { date: '26.02.09', content: '어머 매니저님 빠른 후기 감사합니다 +_+!!' } },
  { id: 'r2', name: '스트********', rating: 5.0, date: '25.06.10 12:00', scores: { 경력: 4.5, 만족도: 5.0, 구성력: 5.0, 위트: 5.0, 발성: 4.5, 이미지: 5.0 }, content: '꼼꼼하고 안정적으로 촬영 잘 마쳤습니다~', workDays: 3, orderRange: '80만원 ~ 90만원', badge: 'Biz·기업' },
  { id: 'r3', name: '행복한신부', rating: 5.0, date: '26.01.15 09:30', scores: { 경력: 5.0, 만족도: 5.0, 구성력: 4.5, 위트: 5.0, 발성: 5.0, 이미지: 5.0 }, content: '결혼식 진행이 정말 매끄러웠어요. 하객분들 모두 칭찬하셨습니다.', workDays: 7, orderRange: '50만원 ~ 80만원', badge: '개인' },
  { id: 'r4', name: '이벤트기획', rating: 4.5, date: '25.12.20 15:00', scores: { 경력: 5.0, 만족도: 4.5, 구성력: 5.0, 위트: 4.0, 발성: 5.0, 이미지: 4.5 }, content: '기업 송년회 MC로 섭외했는데 분위기 띄우기를 잘 하시네요. 다음에도 부탁드립니다.', workDays: 5, orderRange: '150만원 ~ 200만원', badge: 'Biz·기업' },
  { id: 'r5', name: '웨딩플래너', rating: 5.0, date: '25.11.05 11:00', scores: { 경력: 5.0, 만족도: 5.0, 구성력: 5.0, 위트: 5.0, 발성: 5.0, 이미지: 5.0 }, content: '저희 플래너 측에서도 감탄한 진행이었습니다. 센스가 남다르세요!', workDays: 10, orderRange: '80만원 ~ 100만원', badge: '대행사/에이전시' },
];

type ReviewItem = (typeof REVIEWS)[number];

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
    content: r.comment || '',
    workDays: Number(r.workDays) || 0,
    orderRange: r.orderRange || '',
    badge: r.badge || '',
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
  const [apiReviews, setApiReviews] = useState<ReviewItem[] | null>(null);
  const [proName, setProName] = useState<string>('');
  const [detailReviewCount, setDetailReviewCount] = useState(0);
  const [detailAvgRating, setDetailAvgRating] = useState(0);

  // API에서 리뷰 가져오기
  useEffect(() => {
    if (!id) return;
    let alive = true;
    setApiReviews(null);

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
      const apiItems = Array.isArray((reviewPayload as any)?.data) ? (reviewPayload as any).data : [];
      const apiTotal = Number((reviewPayload as any)?.meta?.total) || 0;
      const reviews = mergeReviewRows(apiItems, detailReviews);
      setDetailReviewCount(Math.max(detailCount, apiTotal, reviews.length));
      setDetailAvgRating(detailRating);
      setApiReviews(reviews.map(mapApiReview));
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
      <div className="sticky top-0 z-30 bg-white border-b border-gray-50">
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
              리뷰 작성하기
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
            <p className="text-[11px] text-gray-400">
              행사일 : {review.workDays}일 | 주문 금액 : <span className="font-bold text-gray-600">{review.orderRange}</span>
            </p>
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
