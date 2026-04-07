import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ProStatus, PuddingReason, PuddingTransactionType } from '@prisma/client';

const PUDDING_AMOUNTS: Record<PuddingReason, number> = {
  quote_reply_single: 3,
  quote_reply_multi: 2,
  successful_match: 10,
  perfect_review: 8,
  info_registered: 3,
  referral_joined: 8,
};

@Injectable()
export class PuddingService {
  private readonly logger = new Logger(PuddingService.name);

  constructor(private prisma: PrismaService) {}

  async award(proProfileId: string, reason: PuddingReason, referenceId?: string) {
    const amount = PUDDING_AMOUNTS[reason];
    await this.prisma.$transaction(async (tx) => {
      const pro = await tx.proProfile.update({
        where: { id: proProfileId },
        data: { puddingCount: { increment: amount } },
        select: { puddingCount: true },
      });
      await tx.puddingTransaction.create({
        data: { proProfileId, type: PuddingTransactionType.earn, amount, reason, referenceId, balanceAfter: pro.puddingCount },
      });
    });
  }

  // Midnight KST = 15:00 UTC
  @Cron('0 15 * * *', { name: 'pudding_daily_reset', timeZone: 'UTC' })
  async dailyReset() {
    this.logger.log('Starting daily pudding reset...');

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const topThree = await this.prisma.puddingRanking.findMany({
      where: { rankDate: yesterday, rank: { in: [1, 2, 3] } },
    });

    // Parallel reset of top-3 (at most 3 items)
    await Promise.all(
      topThree
        .filter((e) => e.puddingCount > 0)
        .map((entry) =>
          this.prisma.$transaction(async (tx) => {
            await tx.proProfile.update({ where: { id: entry.proProfileId }, data: { puddingCount: 0 } });
            await tx.puddingTransaction.create({
              data: {
                proProfileId: entry.proProfileId,
                type: PuddingTransactionType.reset,
                amount: -entry.puddingCount,
                balanceAfter: 0,
                note: 'Daily top-3 reset',
              },
            });
          }),
        ),
    );

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

    // Parallel upsert: ranking record + proProfile rank field in one transaction per pro
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

    this.logger.log(`Pudding reset complete. Ranked ${rankData.length} pros.`);
  }

  async getBalance(proProfileId: string) {
    const [pro, history] = await Promise.all([
      this.prisma.proProfile.findUnique({
        where: { id: proProfileId },
        select: { puddingCount: true, puddingRank: true },
      }),
      this.prisma.puddingTransaction.findMany({
        where: { proProfileId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);
    return { ...pro, history };
  }

  async getRankings(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.proProfile.findMany({
        where: { status: ProStatus.approved, puddingRank: { not: null } },
        orderBy: { puddingRank: 'asc' },
        skip,
        take: limit,
        select: {
          id: true,
          puddingCount: true,
          puddingRank: true,
          user: { select: { name: true, profileImageUrl: true } },
        },
      }),
      this.prisma.proProfile.count({ where: { status: ProStatus.approved } }),
    ]);
    return { data, total, page, limit, hasMore: skip + data.length < total };
  }
}
