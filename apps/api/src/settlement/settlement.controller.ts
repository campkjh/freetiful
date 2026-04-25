import { Controller, Get, Post, Body, Query, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SettlementService } from './settlement.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { SettlementStatus } from '@prisma/client';

@ApiTags('settlement')
@Controller()
export class SettlementController {
  constructor(private readonly svc: SettlementService) {}

  // ─── Pro 본인 ────────────────────────────────────────────

  @Get('pro/settlements')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '프로 본인의 정산 로그 목록' })
  getMyLogs(
    @Req() req: any,
    @Query('status') status?: SettlementStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.getMyLogs(req.user.id, {
      status,
      page: page ? +page : 1,
      limit: limit ? +limit : 50,
    });
  }

  // ─── Admin ─────────────────────────────────────────────────

  @Get('admin/settlements')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '관리자 — 전체 정산 목록' })
  adminList(
    @Query('status') status?: SettlementStatus,
    @Query('proProfileId') proProfileId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.svc.adminList({
      status,
      proProfileId,
      page: page ? +page : 1,
      limit: limit ? +limit : 30,
      startDate,
      endDate,
    });
  }

  @Post('admin/settlements/:id/settle')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '관리자 — 정산 완료 표시' })
  settle(
    @Req() req: any,
    @Param('id') id: string,
    @Body('note') note?: string,
  ) {
    return this.svc.markSettled(id, req.user.id, note);
  }

  @Post('admin/settlements/:id/unsettle')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '관리자 — 정산 완료 취소 (되돌리기)' })
  unsettle(@Param('id') id: string) {
    return this.svc.unmarkSettled(id);
  }
}
