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

// 기본 카테고리(그룹) — 프리티풀(예식/행사) 맞춤 웨딩·신혼 커뮤니티. 사장 지정 23종.
export const DEFAULT_GROUPS: {
  name: string;
  slug: string;
  icon?: string; // 프론트 리스트 아이콘 힌트(store 등)
  description?: string;
  tags: { name: string; slug: string }[];
}[] = [
  { name: '자유게시판', slug: 'free', tags: [] },
  { name: '궁금한점 질문답변', slug: 'curious-qna', tags: [] },
  { name: '힘들어요 위로해주세요', slug: 'comfort', tags: [] },
  { name: '결혼·신혼·육아 일기', slug: 'diary', tags: [] },
  { name: '예신·예랑 중고장터', slug: 'market', icon: 'store', tags: [] },
  { name: '남들은 어떻게 하나요?', slug: 'others', tags: [] },
  { name: '자주묻는질문(FAQ)', slug: 'faq', tags: [] },
  { name: '다이어트 질문답변', slug: 'diet', tags: [] },
  { name: '결혼준비 토론방', slug: 'prep-forum', tags: [] },
  { name: '나의 시댁은/처가댁은', slug: 'inlaws', tags: [] },
  { name: '선택장애 모여라', slug: 'choice', tags: [] },
  { name: '내 신랑·신부 자랑하기', slug: 'brag', tags: [] },
  { name: '나만의 요리비법', slug: 'recipe', tags: [] },
  { name: '신랑신부 갈등과 해소', slug: 'conflict', tags: [] },
  { name: '내가 결혼하는 이유', slug: 'why-marry', tags: [] },
  { name: '허니문 지역선정 이유', slug: 'honeymoon', tags: [] },
  { name: '결혼준비 자료실', slug: 'resources', tags: [] },
  { name: '다이렉트 블로거', slug: 'blogger', tags: [] },
  { name: '데이트 맛집 소개', slug: 'datefood', tags: [] },
  { name: '신혼 게시판', slug: 'newlywed', tags: [] },
  { name: '임신/출산/육아', slug: 'parenting', tags: [] },
  { name: '미용/시술/건강관리', slug: 'beauty', tags: [] },
  { name: '법률/부동산/전문정보', slug: 'legal', tags: [] },
];

// 구 카테고리(초기 6종 중 새 목록에 없는 것) — 재구성 시 정리 대상.
export const LEGACY_GROUP_SLUGS = ['wedding', 'mc', 'review', 'qna', 'info'];
