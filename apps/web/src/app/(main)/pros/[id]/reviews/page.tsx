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

export default function ReviewsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const authUser = useAuthStore((s) => s.user);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [userReviews, setUserReviews] = useState<typeof REVIEWS>([]);
  const [canWriteReview, setCanWriteReview] = useState(false);
  const [apiReviews, setApiReviews] = useState<typeof REVIEWS | null>(null);
  const [proName, setProName] = useState<string>('');

  // API에서 리뷰 가져오기
  useEffect(() => {
    if (!id) return;

    // Fetch pro name
    apiClient.get(`/api/v1/pros/${id}`)
      .then((res) => {
        const name = res.data?.user?.name || res.data?.name || '';
        if (name) setProName(name);
      })
      .catch(() => {});
    reviewApi.getByPro(id, { limit: 50 })
      .then((res: any) => {
        if (res.data?.length > 0) {
          setApiReviews(res.data.map((r: any) => ({
            id: r.id,
            name: r.isAnonymous ? '익명' : (r.reviewer?.name?.slice(0, 1) + '**' + '****') || '고객',
            rating: r.avgRating || 0,
            date: new Date(r.createdAt).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' }),
            scores: {
              경력: r.ratingExperience || 0,
              만족도: r.ratingSatisfaction || 0,
              구성력: r.ratingComposition || 0,
              위트: r.ratingWit || 0,
              발성: r.ratingVoice || 0,
              이미지: r.ratingAppearance || 0,
            },
            content: r.comment || '',
            workDays: 0,
            orderRange: '',
            badge: '',
            proReply: r.proReply ? { date: new Date(r.proReplyAt || r.updatedAt).toLocaleDateString('ko-KR'), content: r.proReply } : undefined,
          })));
        }
      })
      .catch(() => {});

    // 결제 완료 건이 있는지 확인 (리뷰 작성 권한)
    if (authUser) {
      apiClient.get('/api/v1/payment', { params: { limit: 100 } })
        .then((res) => {
          const payments = res.data?.data || [];
          // 이 프로와 결제 완료된 건이 있는지 확인
          const hasCompletedPayment = payments.some((p: any) =>
            p.status === 'completed' && !p.reviewId
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
  }, [id, authUser]);

  const allReviews = [...userReviews, ...(apiReviews || [])];

  const avgRating = allReviews.length > 0
    ? Math.round((allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length) * 10) / 10
    : 0;

  const SCORE_KEYS = ['경력', '만족도', '구성력', '위트', '발성', '이미지'] as const;
  const categoryScores = SCORE_KEYS.map((label) => {
    const vals = allReviews.map((r) => (r.scores as Record<string, number>)[label] || 0).filter(Boolean);
    const avg = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
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
          <span className="text-[15px] text-gray-400">({allReviews.length})</span>
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
              <StarRating value={review.rating} size={13} />
              <span className="text-[12px] font-bold text-gray-900">{review.rating}</span>
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
