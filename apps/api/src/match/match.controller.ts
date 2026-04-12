import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Request,
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
  getMatchRequests(@Request() req: any) {
    return this.matchService.getMatchRequests(req.user.id);
  }

  /** 전문가에게 전달된 매칭 요청 목록 */
  @Get('pro/requests')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '전문가에게 전달된 매칭 요청 조회' })
  async getMatchRequestsForPro(@Request() req: any) {
    const proProfile = await this.prisma.proProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!proProfile) {
      throw new Error('전문가 프로필이 없습니다.');
    }
    return this.matchService.getMatchRequestsForPro(proProfile.id);
  }

  /** 전문가가 매칭에 응답 */
  @Post('delivery/:id/respond')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '매칭 응답 (수락/거절)' })
  async respondToMatch(
    @Request() req: any,
    @Param('id') id: string,
    @Body('action') action: 'accept' | 'reject',
  ) {
    const proProfile = await this.prisma.proProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!proProfile) {
      throw new Error('전문가 프로필이 없습니다.');
    }
    return this.matchService.respondToMatch(proProfile.id, id, action);
  }
}
