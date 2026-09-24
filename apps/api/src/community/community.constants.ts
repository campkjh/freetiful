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

// 카테고리 계층 — 대분류(아이콘) → 소분류(글이 속하는 곳) + 대분류별 태그.
// 소분류 slug 는 기존 23종을 그대로 재배치(기존 글 보존). 아이콘=public/icons/community/cat/{icon}.svg(토스 이모지).
export type SubDef = { name: string; slug: string };
export type MajorDef = { name: string; slug: string; icon: string; subs: SubDef[]; tags: string[] };

export const TAXONOMY: MajorDef[] = [
  {
    name: '결혼준비',
    slug: 'm-prep',
    icon: 'ring',
    subs: [
      { name: '결혼준비 토론방', slug: 'prep-forum' },
      { name: '결혼준비 자료실', slug: 'resources' },
      { name: '선택장애 모여라', slug: 'choice' },
      { name: '허니문 지역선정 이유', slug: 'honeymoon' },
      { name: '나의 시댁은/처가댁은', slug: 'inlaws' },
    ],
    tags: ['스드메', '예식장', '상견례', '청첩장', '예산', '혼수'],
  },
  {
    name: '신혼생활',
    slug: 'm-newlywed',
    icon: 'home',
    subs: [
      { name: '신혼 게시판', slug: 'newlywed' },
      { name: '결혼·신혼·육아 일기', slug: 'diary' },
      { name: '신랑신부 갈등과 해소', slug: 'conflict' },
      { name: '내 신랑·신부 자랑하기', slug: 'brag' },
    ],
    tags: ['신혼집', '인테리어', '집들이', '부부', '살림'],
  },
  {
    name: '임신·육아',
    slug: 'm-parenting',
    icon: 'baby',
    subs: [
      { name: '임신/출산/육아', slug: 'parenting' },
      { name: '다이어트 질문답변', slug: 'diet' },
    ],
    tags: ['임신', '출산', '육아', '태교', '산후조리'],
  },
  {
    name: '자유소통',
    slug: 'm-talk',
    icon: 'chat',
    subs: [
      { name: '자유게시판', slug: 'free' },
      { name: '궁금한점 질문답변', slug: 'curious-qna' },
      { name: '힘들어요 위로해주세요', slug: 'comfort' },
      { name: '남들은 어떻게 하나요?', slug: 'others' },
      { name: '내가 결혼하는 이유', slug: 'why-marry' },
    ],
    tags: ['수다', '고민', '질문', '위로', '공감'],
  },
  {
    name: '정보·꿀팁',
    slug: 'm-info',
    icon: 'bulb',
    subs: [
      { name: '자주묻는질문(FAQ)', slug: 'faq' },
      { name: '나만의 요리비법', slug: 'recipe' },
      { name: '데이트 맛집 소개', slug: 'datefood' },
      { name: '미용/시술/건강관리', slug: 'beauty' },
      { name: '법률/부동산/전문정보', slug: 'legal' },
      { name: '다이렉트 블로거', slug: 'blogger' },
    ],
    tags: ['꿀팁', '후기', '추천', '맛집', '정보'],
  },
  {
    name: '중고장터',
    slug: 'm-market',
    icon: 'store',
    subs: [
      { name: '예신·예랑 중고장터', slug: 'market' },
      { name: '나눔', slug: 'share' },
      { name: '삽니다', slug: 'buy' },
    ],
    tags: ['판매', '나눔', '삽니다', '웨딩용품', '직거래'],
  },
];

// 태그 slug — 한글 태그명을 그대로 식별자로 쓴다(그룹 내 unique).
export function tagSlug(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-');
}

// 구 카테고리(초기 6종 중 새 목록에 없는 것) — 재구성 시 정리 대상.
export const LEGACY_GROUP_SLUGS = ['wedding', 'mc', 'review', 'qna', 'info'];

// ─── 작성자 배지(토스 커뮤니티 '팔로워 부자'식) ─────────────────────
// 이름 옆 색 배지. 우선순위 순서대로 판정해 첫 번째를 대표로 보여준다(배열 전체도 내려줌).
// 임계값은 신생 커뮤니티 기준 — 활동이 쌓이면 올려도 된다.
export const BADGE_THRESHOLDS = {
  followerRich: 10, // 팔로워 N명 이상
  likeRich: 30, // 받은 좋아요 N개 이상
  commentRich: 30, // 쓴 댓글 N개 이상
  heavyWriter: 10, // 쓴 글 N개 이상
  newbieMaxPosts: 2, // 글 N개 이하 + 다른 배지 없음 → 새내기
};

export type BadgeTone = 'orange' | 'red' | 'blue' | 'purple' | 'green' | 'amber' | 'teal';
export type BadgeKey =
  | 'followerRich'
  | 'likeRich'
  | 'answerKing'
  | 'pickKing'
  | 'commentRich'
  | 'heavyWriter'
  | 'newbie';

export const BADGES: Record<BadgeKey, { label: string; tone: BadgeTone }> = {
  followerRich: { label: '팔로워 부자', tone: 'orange' },
  likeRich: { label: '좋아요 부자', tone: 'red' },
  answerKing: { label: '답변왕', tone: 'blue' },
  pickKing: { label: '채택왕', tone: 'purple' },
  commentRich: { label: '댓글 부자', tone: 'green' },
  heavyWriter: { label: '열혈 작가', tone: 'amber' },
  newbie: { label: '새내기', tone: 'teal' },
};

// 아바타 아래 역할 라벨(토스 '주주' 자리) — 프리티풀 회원 유형.
export const ROLE_LABELS: Record<string, string> = {
  pro: '사회자',
  business: '업체',
  admin: '운영자',
};
