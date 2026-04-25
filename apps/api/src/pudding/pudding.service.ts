import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ProStatus, PuddingReason, PuddingTransactionType } from '@prisma/client';

// 2026-04 재설계된 지급액. 기존 enum 값은 하위호환 위해 0 으로 둠(사용 안 함).
const PUDDING_AMOUNTS: Record<PuddingReason, number> = {
  // Legacy — 더 이상 트리거하지 않음
  quote_reply_single: 0,
  quote_reply_multi: 0,
  successful_match: 0,
  perfect_review: 0,
  info_registered: 0,
  referral_joined: 0,
  // 신규 활동 기반 규칙
  daily_attendance: 50,
  review_received: 100,
  deal_completed: 300,
  new_chat_received: 50,
  replied_to_customer: 50,
  review_reply: 100,
  profile_views_100: 100,
};

@Injectable()
export class PuddingService {
  private readonly logger = new Logger(PuddingService.name);

  constructor(private prisma: PrismaService) {}

  /** 내부: 실제로 balance를 증가시키고 트랜잭션 로그 기록 */
  async award(proProfileId: string, reason: PuddingReason, referenceId?: string, note?: string) {
    const amount = PUDDING_AMOUNTS[reason];
    if (!amount || amount <= 0) return; // legacy reason 등 0원은 무시
    await this.prisma.$transaction(async (tx) => {
      const pro = await tx.proProfile.update({
        where: { id: proProfileId },
        data: { puddingCount: { increment: amount } },
        select: { puddingCount: true },
      });
      await tx.puddingTransaction.create({
        data: {
          proProfileId,
          type: PuddingTransactionType.earn,
          amount,
          reason,
          referenceId,
          balanceAfter: pro.puddingCount,
          note,
        },
      });
    });
  }

  /** 매일 출석체크 — 하루에 한 번만 지급 */
  async awardDailyAttendance(proProfileId: string): Promise<{ granted: boolean; alreadyToday: boolean }> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const already = await this.prisma.puddingTransaction.findFirst({
      where: { proProfileId, reason: PuddingReason.daily_attendance, createdAt: { gte: startOfToday } },
      select: { id: true },
    });
    if (already) return { granted: false, alreadyToday: true };
    await this.award(proProfileId, PuddingReason.daily_attendance);
    return { granted: true, alreadyToday: false };
  }

  /** 고객 리뷰 작성 완료 시 */
  async awardReviewReceived(proProfileId: string, reviewId: string) {
    await this.award(proProfileId, PuddingReason.review_received, reviewId);
  }

  /** 거래 성사(결제 완료) 시 */
  async awardDealCompleted(proProfileId: string, paymentId: string) {
    // 중복 방지: 같은 paymentId 로 이미 지급했으면 skip
    const already = await this.prisma.puddingTransaction.findFirst({
      where: { proProfileId, reason: PuddingReason.deal_completed, referenceId: paymentId },
      select: { id: true },
    });
    if (already) return;
    await this.award(proProfileId, PuddingReason.deal_completed, paymentId);
  }

  /** 새 채팅 도착 — 채팅방 생성 시 전문가에게 지급 */
  async awardNewChatReceived(proProfileId: string, chatRoomId: string) {
    // 같은 chatRoomId 중복 방지
    const already = await this.prisma.puddingTransaction.findFirst({
      where: { proProfileId, reason: PuddingReason.new_chat_received, referenceId: chatRoomId },
      select: { id: true },
    });
    if (already) return;
    await this.award(proProfileId, PuddingReason.new_chat_received, chatRoomId);
  }

  /** 고객 채팅에 첫 답변 — 같은 고객에 대해 1회만 지급 */
  async awardRepliedToCustomer(proProfileId: string, customerUserId: string) {
    const already = await this.prisma.puddingTransaction.findFirst({
      where: {
        proProfileId,
        reason: PuddingReason.replied_to_customer,
        referenceId: customerUserId,
      },
      select: { id: true },
    });
    if (already) return;
    await this.award(proProfileId, PuddingReason.replied_to_customer, customerUserId);
  }

  /** 고객 리뷰에 답글 작성 시 */
  async awardReviewReply(proProfileId: string, reviewId: string) {
    const already = await this.prisma.puddingTransaction.findFirst({
      where: { proProfileId, reason: PuddingReason.review_reply, referenceId: reviewId },
      select: { id: true },
    });
    if (already) return;
    await this.award(proProfileId, PuddingReason.review_reply, reviewId);
  }

  /**
   * 프로필 조회수가 100회 단위를 넘을 때마다 지급 (100·200·300…).
   * 호출측이 현재 뷰 카운트 증가 "직전" 값을 알려주면 경계 체크.
   * beforeCount: 증가 전 view count, afterCount: 증가 후 view count.
   */
  async awardProfileViewsIfCrossed100(proProfileId: string, beforeCount: number, afterCount: number) {
    const beforeBucket = Math.floor(beforeCount / 100);
    const afterBucket = Math.floor(afterCount / 100);
    if (afterBucket <= beforeBucket) return;
    const crossed = afterBucket - beforeBucket;
    // 100회 단위마다 100푸딩 — 한번에 여러 경계 넘을 수 있음(배치 조회수 증가 등)
    for (let i = 0; i < crossed; i++) {
      const milestone = (beforeBucket + i + 1) * 100;
      const already = await this.prisma.puddingTransaction.findFirst({
        where: { proProfileId, reason: PuddingReason.profile_views_100, referenceId: String(milestone) },
        select: { id: true },
      });
      if (already) continue;
      await this.award(proProfileId, PuddingReason.profile_views_100, String(milestone), `프로필 조회 ${milestone}회 달성`);
    }
  }

  // Midnight KST = 15:00 UTC
  @Cron('0 15 * * *', { name: 'pudding_daily_reset', timeZone: 'UTC' })
  async dailyReset() {
    this.logger.log('Starting daily pudding ranking snapshot...');

    const allPros = await this.prisma.proProfile.findMany({
      where: { status: ProStatus.approved },
      orderBy: { puddingCount: 'desc' },
      select: { id: true, puddingCount: true },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let rank = 1;
    const rankData = allPros.map((pro, i) => {
      if (i > 0 && pro.puddingCount < allPros[i - 1].puddingCount) rank = i + 1;
      return { proProfileId: pro.id, rankDate: today, rank, puddingCount: pro.puddingCount };
    });

    // Parallel upsert: ranking record + proProfile rank field
    // 주의: 2026-04 재설계로 top-3 puddingCount 리셋은 더 이상 하지 않음
    // (푸딩은 소비재가 아니라 누적 활동 지표임). 일별 랭킹 스냅샷만 유지.
    await Promise.all(
      rankData.map((r) =>
        this.prisma.$transaction([
          this.prisma.puddingRanking.upsert({
            where: { proProfileId_rankDate: { proProfileId: r.proProfileId, rankDate: r.rankDate } },
            create: r,
            update: { rank: r.rank, puddingCount: r.puddingCount },
          }),
          this.prisma.proProfile.update({ where: { id: r.proProfileId }, data: { puddingRank: r.rank } }),
        ]),
      ),
    );

    this.logger.log(`Pudding ranking snapshot complete. Ranked ${rankData.length} pros.`);
  }

  // 매주 월요일 00:00 KST (= 일요일 15:00 UTC) 전체 프로 푸딩 잔액 리셋
  // 랭킹은 매주 초기화된 푸딩 누적량으로 다시 경쟁
  @Cron('0 15 * * 0', { name: 'pudding_weekly_reset', timeZone: 'UTC' })
  async weeklyReset() {
    this.logger.log('Starting weekly pudding balance reset...');

    const pros = await this.prisma.proProfile.findMany({
      where: { puddingCount: { gt: 0 } },
      select: { id: true, puddingCount: true },
    });

    for (const pro of pros) {
      await this.prisma.$transaction([
        this.prisma.proProfile.update({
          where: { id: pro.id },
          data: { puddingCount: 0, puddingRank: null },
        }),
        this.prisma.puddingTransaction.create({
          data: {
            proProfileId: pro.id,
            type: PuddingTransactionType.reset,
            amount: -pro.puddingCount,
            balanceAfter: 0,
            note: '주간 푸딩 리셋 (매주 월요일 00:00 KST)',
          },
        }),
      ]);
    }

    this.logger.log(`Weekly pudding reset complete. Reset ${pros.length} pros.`);
  }

  async getBalance(proProfileId: string) {
    const [pro, history, rank] = await Promise.all([
      this.prisma.proProfile.findUnique({
        where: { id: proProfileId },
        select: { puddingCount: true, puddingRank: true },
      }),
      this.prisma.puddingTransaction.findMany({
        where: { proProfileId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.getCurrentRank(proProfileId),
    ]);
    if (!pro) return { puddingCount: 0, puddingRank: null, rank: null, history };
    return { ...pro, puddingRank: rank, rank, history };
  }

  async getCurrentRank(proProfileId: string) {
    const profile = await this.prisma.proProfile.findUnique({
      where: { id: proProfileId },
      select: { puddingCount: true, status: true },
    });
    if (!profile || profile.status !== ProStatus.approved) return null;
    const higherCount = await this.prisma.proProfile.count({
      where: {
        status: ProStatus.approved,
        puddingCount: { gt: profile.puddingCount },
      },
    });
    return higherCount + 1;
  }

  async getRankings(page = 1, limit = 20) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(Math.max(1, Number(limit) || 20), 100);
    const skip = (safePage - 1) * safeLimit;
    const rows = await this.prisma.proProfile.findMany({
      where: { status: ProStatus.approved },
      orderBy: [
        { puddingCount: 'desc' },
        { updatedAt: 'asc' },
        { id: 'asc' },
      ],
      select: {
        id: true,
        puddingCount: true,
        user: { select: { id: true, name: true, profileImageUrl: true } },
      },
    });

    let rank = 1;
    const ranked = rows.map((pro, i) => {
      if (i > 0 && pro.puddingCount < rows[i - 1].puddingCount) rank = i + 1;
      return { ...pro, rank, puddingRank: rank };
    });
    const data = ranked.slice(skip, skip + safeLimit);
    return {
      data,
      total: ranked.length,
      page: safePage,
      limit: safeLimit,
      hasMore: skip + data.length < ranked.length,
    };
  }
}
