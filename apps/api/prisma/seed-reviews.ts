import { PrismaClient, ProStatus, PaymentStatus, UserRole } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

const REVIEW_COMMENTS = [
  '상담부터 행사까지 친절하게 응대해주셨어요',
  '진행이 매끄럽고 분위기를 잘 띄워주셨습니다',
  '목소리 톤이 정말 좋으시고 편안한 분위기였어요',
  '하객분들 모두 칭찬하셨습니다. 완벽한 진행이었어요',
  '센스 있는 진행, 감사합니다!',
  '기업 행사였는데 품격있는 진행으로 만족스러웠습니다',
  '발음이 또렷하고 전달력이 좋으셨어요',
  '상황 대처 능력이 뛰어나셨고 분위기를 잘 이끌어주셨습니다',
  '위트 있는 멘트로 하객분들 모두 즐거워하셨어요',
  '사전 미팅부터 본식까지 모든 과정이 완벽했습니다',
  '긴장했는데 편안하게 이끌어주셔서 정말 감사드려요',
  '다음에도 또 부탁드리고 싶은 분입니다',
];

const REVIEWER_NAMES = [
  '행복한신부', '이벤트기획자', '웨딩플래너', '나른한오후', '스트로베리',
  '민트초코', '해피데이', '러블리웨딩', '드림하우스', '청춘기록',
  '봄날의기억', '반짝이는별', '포근한하루', '따뜻한바람', '설레는순간',
];

type RatingTier = 'perfect' | 'near-perfect' | 'mostly-good';

function pickTier(): RatingTier {
  const r = Math.random();
  if (r < 0.8) return 'perfect';
  if (r < 0.95) return 'near-perfect';
  return 'mostly-good';
}

function generateRatings(tier: RatingTier): {
  ratingSatisfaction: number;
  ratingComposition: number;
  ratingExperience: number;
  ratingAppearance: number;
  ratingVoice: number;
  ratingWit: number;
} {
  if (tier === 'perfect') {
    return {
      ratingSatisfaction: 5,
      ratingComposition: 5,
      ratingExperience: 5,
      ratingAppearance: 5,
      ratingVoice: 5,
      ratingWit: 5,
    };
  }
  if (tier === 'near-perfect') {
    // Mix 4.5 (stored as 4 since Int) and 5. We store as Int so use 4 or 5.
    const pick = () => (Math.random() < 0.5 ? 5 : 4);
    return {
      ratingSatisfaction: pick(),
      ratingComposition: pick(),
      ratingExperience: pick(),
      ratingAppearance: pick(),
      ratingVoice: pick(),
      ratingWit: pick(),
    };
  }
  // mostly-good: one or two 4s (acts as 4.0)
  const fields = [
    'ratingSatisfaction',
    'ratingComposition',
    'ratingExperience',
    'ratingAppearance',
    'ratingVoice',
    'ratingWit',
  ] as const;
  const result: any = {};
  for (const f of fields) result[f] = 5;
  const count = Math.random() < 0.5 ? 1 : 2;
  const shuffled = [...fields].sort(() => Math.random() - 0.5);
  for (let i = 0; i < count; i++) result[shuffled[i]] = 4;
  return result;
}

async function ensureReviewer(index: number) {
  const email = `reviewer${index + 1}@freetiful-test.com`;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  return prisma.user.create({
    data: {
      email,
      name: REVIEWER_NAMES[index % REVIEWER_NAMES.length],
      role: UserRole.general,
      referralCode: `RVW${Date.now().toString(36).slice(-4)}${index}`.toUpperCase().slice(0, 10),
    },
  });
}

async function main() {
  console.log('🌱 Seeding reviews for approved pros...\n');

  const pros = await prisma.proProfile.findMany({
    where: { status: ProStatus.approved },
    select: { id: true, userId: true },
  });

  console.log(`Found ${pros.length} approved pros.`);

  // Ensure a pool of reviewer users
  const reviewerPoolSize = 15;
  const reviewers = [] as { id: string }[];
  for (let i = 0; i < reviewerPoolSize; i++) {
    reviewers.push(await ensureReviewer(i));
  }
  console.log(`Prepared ${reviewers.length} reviewer users.`);

  let totalReviews = 0;

  for (const pro of pros) {
    // Skip if this pro already has reviews (idempotent-ish)
    const existingCount = await prisma.review.count({ where: { proProfileId: pro.id } });
    if (existingCount > 0) {
      console.log(`  ⏭  Pro ${pro.id} — already has ${existingCount} reviews, skipping`);
      continue;
    }

    const count = 5 + Math.floor(Math.random() * 11); // 5..15
    const avgRatings: number[] = [];

    for (let i = 0; i < count; i++) {
      const reviewer = reviewers[Math.floor(Math.random() * reviewers.length)];
      const tier = pickTier();
      const ratings = generateRatings(tier);
      const avg =
        (ratings.ratingSatisfaction +
          ratings.ratingComposition +
          ratings.ratingExperience +
          ratings.ratingAppearance +
          ratings.ratingVoice +
          ratings.ratingWit) /
        6;

      const comment = REVIEW_COMMENTS[Math.floor(Math.random() * REVIEW_COMMENTS.length)];
      const isAnonymous = Math.random() < 0.4;

      // Create a dummy Payment record (required FK) — completed/escrowed status
      const payment = await prisma.payment.create({
        data: {
          userId: reviewer.id,
          proProfileId: pro.id,
          amount: 450000,
          status: PaymentStatus.completed,
          method: 'card',
          pgProvider: 'seed',
          pgTransactionId: `seed-${pro.id}-${i}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          createdAt: new Date(Date.now() - Math.floor(Math.random() * 180) * 24 * 60 * 60 * 1000),
        },
      });

      // ~20% chance of pro reply
      const hasReply = Math.random() < 0.2;

      await prisma.review.create({
        data: {
          paymentId: payment.id,
          reviewerId: reviewer.id,
          proProfileId: pro.id,
          ...ratings,
          avgRating: new Decimal(avg.toFixed(2)),
          comment,
          isAnonymous,
          adminCreated: true,
          proReply: hasReply ? '소중한 후기 감사합니다! 즐거운 행사였어요 :)' : null,
          proRepliedAt: hasReply ? new Date() : null,
          createdAt: payment.createdAt,
        },
      });

      avgRatings.push(avg);
      totalReviews++;
    }

    const proAvg = avgRatings.reduce((a, b) => a + b, 0) / avgRatings.length;
    await prisma.proProfile.update({
      where: { id: pro.id },
      data: {
        avgRating: new Decimal(proAvg.toFixed(2)),
        reviewCount: count,
      },
    });

    console.log(`  ✓ Pro ${pro.id} — ${count} reviews, avg ${proAvg.toFixed(2)}`);
  }

  console.log(`\n✅ Done. Total reviews created: ${totalReviews}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
