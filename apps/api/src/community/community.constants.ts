// 커뮤니티 상수 (스타디 커뮤니티 이식)

export const REACTION_TYPES = ['heart', 'sad', 'laugh', 'smile', 'devil', 'skull'] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

export const REPORT_REASONS = [
  '스팸/광고',
  '욕설/비방',
  '음란물/선정성',
  '혐오 발언',
  '개인정보 노출',
  '기타',
];

export const QUIZ_MAX_QUESTIONS_PER_POST = 5;
export const QUIZ_MAX_POSTS_PER_DAY = 3;

// 활동 점수 → 티어. 스타디와 동일 순서.
export const TIERS = [
  { key: 'iron', min: 0 },
  { key: 'silver', min: 50 },
  { key: 'gold', min: 150 },
  { key: 'emerald', min: 350 },
  { key: 'diamond', min: 700 },
  { key: 'master', min: 1200 },
  { key: 'grandmaster', min: 2000 },
  { key: 'gongsin', min: 3500 },
] as const;

export function tierForScore(score: number): string {
  let key = TIERS[0].key as string;
  for (const t of TIERS) if (score >= t.min) key = t.key;
  return key;
}

// 기본 카테고리(그룹) — 프리티풀(예식/행사 사회자 플랫폼) 맞춤.
export const DEFAULT_GROUPS: {
  name: string;
  slug: string;
  description?: string;
  tags: { name: string; slug: string }[];
}[] = [
  {
    name: '자유게시판',
    slug: 'free',
    tags: [
      { name: '수다', slug: 'talk' },
      { name: '일상', slug: 'daily' },
    ],
  },
  {
    name: '예식준비',
    slug: 'wedding',
    tags: [
      { name: '식순', slug: 'order' },
      { name: '예산', slug: 'budget' },
      { name: '드레스', slug: 'dress' },
    ],
  },
  {
    name: '사회자이야기',
    slug: 'mc',
    tags: [
      { name: '진행팁', slug: 'tips' },
      { name: '멘트', slug: 'script' },
    ],
  },
  {
    name: '후기/자랑',
    slug: 'review',
    tags: [
      { name: '예식후기', slug: 'wedding-review' },
      { name: '사회자후기', slug: 'mc-review' },
    ],
  },
  {
    name: '질문답변',
    slug: 'qna',
    tags: [
      { name: '궁금해요', slug: 'question' },
    ],
  },
  {
    name: '정보공유',
    slug: 'info',
    tags: [
      { name: '꿀팁', slug: 'honey-tip' },
      { name: '업체정보', slug: 'vendor' },
    ],
  },
];
