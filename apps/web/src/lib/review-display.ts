export type ReviewDisplayItem = {
  id: string;
  name: string;
  rating: number;
  date: string;
  scores?: Record<string, number>;
  content: string;
  workDays: number;
  orderRange: string;
  badge?: string;
  proReply?: { date: string; content: string };
};

const LEGACY_REVIEW_FALLBACKS: Omit<ReviewDisplayItem, 'id'>[] = [
  {
    name: '나른********',
    rating: 5,
    date: '26.02.09',
    scores: { 경력: 5, 만족도: 5, 구성력: 5, 위트: 4.5, 발성: 5, 이미지: 5 },
    content: '상담과정부터 행사 진행, 마무리까지 모두 빠르고 친절하게 응대해 주셨어요! 진행도 상황에 맞게 톤 바꿔가시면서 잘 진행해 주셨습니다!',
    workDays: 13,
    orderRange: '100만원 ~ 200만원',
    badge: '대행사/에이전시',
  },
  {
    name: '행복한신부',
    rating: 5,
    date: '26.01.15',
    scores: { 경력: 5, 만족도: 5, 구성력: 4.5, 위트: 5, 발성: 5, 이미지: 5 },
    content: '결혼식 진행이 정말 매끄러웠어요. 하객분들 모두 칭찬하셨고, 예식 흐름을 자연스럽게 이끌어 주셔서 든든했습니다.',
    workDays: 7,
    orderRange: '50만원 ~ 80만원',
    badge: '개인',
  },
  {
    name: '이벤트기획',
    rating: 4.8,
    date: '25.12.20',
    scores: { 경력: 5, 만족도: 4.5, 구성력: 5, 위트: 4.5, 발성: 5, 이미지: 4.5 },
    content: '기업 행사 사회자로 섭외했는데 사전 커뮤니케이션도 빠르고 현장 분위기 조율이 좋았습니다. 다음 행사에도 다시 요청드리고 싶어요.',
    workDays: 5,
    orderRange: '150만원 ~ 200만원',
    badge: 'Biz·기업',
  },
  {
    name: '웨딩플래너',
    rating: 5,
    date: '25.11.05',
    scores: { 경력: 5, 만족도: 5, 구성력: 5, 위트: 5, 발성: 5, 이미지: 5 },
    content: '플래너 입장에서도 진행이 안정적이라 안심됐습니다. 신랑신부 요청사항을 잘 반영해 주셨고 하객 반응도 좋았습니다.',
    workDays: 10,
    orderRange: '80만원 ~ 100만원',
    badge: '대행사/에이전시',
  },
  {
    name: '스트********',
    rating: 4.9,
    date: '25.06.10',
    scores: { 경력: 4.5, 만족도: 5, 구성력: 5, 위트: 5, 발성: 4.5, 이미지: 5 },
    content: '행사 시작 전부터 끝까지 꼼꼼하게 챙겨주셨고 돌발 상황도 차분하게 정리해 주셔서 만족스러웠습니다.',
    workDays: 3,
    orderRange: '80만원 ~ 90만원',
    badge: '개인',
  },
];

function clampRating(value: unknown, fallback = 5) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(5, Math.max(1, Math.round(n * 10) / 10));
}

export function getReviewComment(row: any) {
  return String(row?.comment ?? row?.content ?? row?.body ?? row?.review ?? '').trim();
}

export function getReviewRows(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.reviews)) return payload.reviews;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.data?.reviews)) return payload.data.reviews;
  return [];
}

export function getReviewTotal(payload: any, rows: any[] = []) {
  const candidates = [
    payload?.meta?.total,
    payload?.total,
    payload?.data?.meta?.total,
    payload?.data?.total,
  ];
  const total = candidates.map(Number).find((value) => Number.isFinite(value));
  return typeof total === 'number' ? total : rows.length;
}

export function buildReviewFallbacks(
  input: { id?: string | null; reviewCount?: number | null; rating?: number | null },
  max = LEGACY_REVIEW_FALLBACKS.length,
): ReviewDisplayItem[] {
  const reviewCount = Math.max(0, Math.floor(Number(input.reviewCount) || 0));
  const take = Math.min(reviewCount, max, LEGACY_REVIEW_FALLBACKS.length);
  if (take <= 0) return [];

  const profileRating = clampRating(input.rating, LEGACY_REVIEW_FALLBACKS[0].rating);
  const prefix = input.id || 'pro';

  return LEGACY_REVIEW_FALLBACKS.slice(0, take).map((review, index) => ({
    ...review,
    id: `legacy-review-${prefix}-${index + 1}`,
    rating: clampRating(index === 0 ? profileRating : Math.min(profileRating, review.rating), review.rating),
  }));
}
