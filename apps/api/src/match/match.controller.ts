import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MatchService } from './match.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('match')
@Controller('match')
export class MatchController {
  constructor(
    private matchService: MatchService,
    private prisma: PrismaService,
  ) {}

  /** 랜딩 페이지 익명 제출 — 전화번호로 간이 회원가입 + 다수견적 */
  @Post('quick-request')
  @ApiOperation({ summary: '간이 회원가입 + 다수견적 (랜딩페이지용)' })
  quickRequest(
    @Headers('authorization') authorization: string | undefined,
    @Body()
    body: {
      name?: string;
      phone: string;
      categoryId: string;
      eventCategoryId?: string;
      eventDate?: string;
      eventTime?: string;
      eventLocation?: string;
      type?: 'multi' | 'single';
      rawUserInput?: any;
    },
  ) {
    return this.matchService.createQuickRequest(authorization, body);
  }

  /** 매칭 요청 생성 */
  @Post('request')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '매칭 요청 생성' })
  createMatchRequest(
    @Request() req: any,
    @Body()
    body: {
      categoryId: string;
      eventCategoryId?: string;
      eventDate?: string;
      eventTime?: string;
      eventLocation?: string;
      budgetMin?: number;
      budgetMax?: number;
      type: 'multi' | 'single';
      styleOptionIds?: string[];
      personalityOptionIds?: string[];
      selectedProProfileIds?: string[];
      rawUserInput?: any;
    },
  ) {
    return this.matchService.createMatchRequest(req.user.id, body);
  }

  /** 내 매칭 요청 목록 */
  @Get('requests')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 매칭 요청 목록 조회' })
  getMatchRequests(@Request() req: any, @Query('skip') skip?: string, @Query('take') take?: string) {
    return this.matchService.getMatchRequests(req.user.id, Number(skip) || 0, Number(take) || 8);
  }

  /** 전문가에게 전달된 매칭 요청 목록 */
  @Get('pro/requests')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '전문가에게 전달된 매칭 요청 조회' })
  async getMatchRequestsForPro(@Request() req: any, @Query('limit') limit?: string, @Query('skip') skip?: string) {
    const proProfile = await this.prisma.proProfile.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    });
    if (!proProfile) {
      throw new Error('전문가 프로필이 없습니다.');
    }
    return this.matchService.getMatchRequestsForPro(proProfile.id, Number(limit) || 50, Number(skip) || 0);
  }

  /** 전문가가 매칭에 응답 */
  @Post('delivery/:id/respond')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '매칭 응답 (수락/거절)' })
  async respondToMatch(
    @Request() req: any,
    @Param('id') id: string,
    @Body('action') action: 'accept' | 'reject' | 'archive',
    @Body('message') message?: string,
  ) {
    const proProfile = await this.prisma.proProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!proProfile) {
      throw new Error('전문가 프로필이 없습니다.');
    }
    return this.matchService.respondToMatch(proProfile.id, id, action, message);
  }
}
