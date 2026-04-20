import { Controller, Get, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PuddingService } from './pudding.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Pudding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class PuddingController {
  constructor(private pudding: PuddingService, private prisma: PrismaService) {}

  @Get('pro/pudding')
  async getMyBalance(@Request() req: any) {
    // userId 로부터 proProfile 을 찾아 balance 반환 (프론트가 { balance } 형태 기대)
    const profile = await this.prisma.proProfile.findUnique({
      where: { userId: req.user.id },
      select: { id: true, puddingCount: true, puddingRank: true },
    });
    if (!profile) return { balance: 0, rank: null, history: [] };
    const detail = await this.pudding.getBalance(profile.id);
    return {
      balance: profile.puddingCount,
      rank: profile.puddingRank,
      history: detail?.history || [],
    };
  }

  @Get('pro/pudding/rank')
  getRankings(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.pudding.getRankings(+page, +limit);
  }
}
