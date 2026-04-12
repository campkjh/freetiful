import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { QuotationService } from './quotation.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('quotation')
@Controller('quotation')
export class QuotationController {
  constructor(
    private quotationService: QuotationService,
    private prisma: PrismaService,
  ) {}

  /** 견적서 생성 (전문가 전용) */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '견적서 생성 (전문가)' })
  async createQuotation(
    @Request() req: any,
    @Body()
    body: {
      userId: string;
      amount: number;
      title?: string;
      description?: string;
      eventDate?: string;
      eventTime?: string;
      eventLocation?: string;
      items?: any;
      validUntil?: string;
      chatRoomId?: string;
      matchDeliveryId?: string;
    },
  ) {
    const proProfile = await this.prisma.proProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!proProfile) {
      throw new Error('전문가 프로필이 없습니다.');
    }
    return this.quotationService.createQuotation(
      proProfile.id,
      body.userId,
      body,
    );
  }

  /** 전문가 대시보드 요약 */
  @Get('dashboard')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '전문가 대시보드 견적 요약' })
  async getDashboard(@Request() req: any) {
    const proProfile = await this.prisma.proProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!proProfile) {
      throw new Error('전문가 프로필이 없습니다.');
    }
    return this.quotationService.getQuotationsForProDashboard(proProfile.id);
  }

  /** 전문가가 보낸 견적서 목록 */
  @Get('pro')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '전문가 견적서 목록 조회' })
  async getQuotationsByPro(
    @Request() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    const proProfile = await this.prisma.proProfile.findUnique({
      where: { userId: req.user.id },
    });
    if (!proProfile) {
      throw new Error('전문가 프로필이 없습니다.');
    }
    return this.quotationService.getQuotationsByPro(
      proProfile.id,
      +page,
      +limit,
    );
  }

  /** 사용자가 받은 견적서 목록 */
  @Get('user')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '사용자 견적서 목록 조회' })
  getQuotationsByUser(
    @Request() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.quotationService.getQuotationsByUser(
      req.user.id,
      +page,
      +limit,
    );
  }

  /** 견적서 상세 조회 */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '견적서 상세 조회' })
  getQuotation(@Param('id') id: string) {
    return this.quotationService.getQuotation(id);
  }

  /** 견적서 상태 변경 (수락/취소) */
  @Put(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '견적서 상태 변경 (수락/취소)' })
  updateStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body('status') status: 'accepted' | 'cancelled',
  ) {
    return this.quotationService.updateStatus(id, req.user.id, status);
  }
}
