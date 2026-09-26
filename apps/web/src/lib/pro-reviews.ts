// 사회자 리뷰 — 목록 카드의 리뷰 시트(components/pros/ProReviewsSheet)가 쓴다(260926).
// 리뷰 페이지(pros/[id]/reviews)와 같은 API·같은 가리기 규칙. 단, 본문 없는 사회자에게 예시 리뷰(buildReviewFallbacks)를 채우지 않는다 —
// 실제로 쓰인 리뷰만 보여 준다.
import { reviewApi } from '@/lib/api/review.api';
import { getReviewComment, getReviewRows, getReviewTotal } from '@/lib/review-display';

export type ProReviewItem = {
  id: string;
  /** 가린 이름(익명이면 '익명') */
  name: string;
  /** 리뷰어 프로필 사진(익명·없으면 null) */
  avatar: string | null;
  rating: number;
  createdAt: string;
  content: string;
  photos: string[];
  proReply?: { content: string; at: string };
};

function maskReviewerName(name?: string | null, isAnonymous?: boolean) {
  if (isAnonymous) return '익명';
  if (!name) return '고객';
  return `${name.slice(0, 1)}**`;
}

function reviewPhotos(review: any): string[] {
  const rows = Array.isArray(review?.images) ? review.images : Array.isArray(review?.photos) ? review.photos : [];
  return rows
    .map((item: any) => (typeof item === 'string' ? item : item?.imageUrl || item?.url))
    .filter((v: unknown): v is string => typeof v === 'string' && v.length > 0);
}

export function toProReviewItem(r: any): ProReviewItem {
  const anonymous = r?.isAnonymous === true || r?.isAnonymous === 'true';
  return {
    id: String(r?.id ?? ''),
    name: maskReviewerName(r?.reviewer?.name, anonymous),
    avatar: anonymous ? null : (r?.reviewer?.profileImageUrl || null),
    rating: Math.max(0, Math.min(5, Number(r?.avgRating) || 0)),
    createdAt: String(r?.createdAt || ''),
    content: getReviewComment(r),
    photos: reviewPhotos(r),
    proReply: r?.proReply ? { content: String(r.proReply), at: String(r.proRepliedAt || r.updatedAt || r.createdAt || '') } : undefined,
  };
}

// 같은 사회자를 다시 열면 바로 보이게 — 화면이 떠 있는 동안만 기억(5분)
const cache = new Map<string, { at: number; items: ProReviewItem[]; total: number }>();

export function peekProReviews(proId: string) {
  const hit = cache.get(proId);
  return hit && Date.now() - hit.at < 5 * 60_000 ? hit : null;
}

export async function loadProReviews(proId: string): Promise<{ items: ProReviewItem[]; total: number }> {
  const payload = await reviewApi.getByPro(proId, { limit: 100 });
  const rows = getReviewRows(payload);
  const seen = new Set<string>();
  const items = rows
    .map(toProReviewItem)
    .filter((item) => {
      if (!item.id || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const total = Math.max(getReviewTotal(payload, rows), items.length);
  cache.set(proId, { at: Date.now(), items, total });
  return { items, total };
}
