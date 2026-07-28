import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LandingService, VisitInput } from './landing.service';
import { AdminGuard } from '../common/guards/admin.guard';

// 공개 — 랜딩 방문/전환 기록(익명)
@ApiTags('landing')
@Controller(['landing', 'api/v1/landing'])
export class LandingController {
  constructor(private landing: LandingService) {}

  @Post('visit')
  visit(@Body() body: VisitInput) {
    return this.landing.recordVisit(body || ({} as VisitInput));
  }

  @Post('convert')
  convert(@Body() body: { page: string; sessionKey: string }) {
    return this.landing.markConverted(body?.page, body?.sessionKey);
  }
}

// 어드민 — 유입 지표
@ApiTags('admin')
@UseGuards(AdminGuard)
@Controller(['admin/landing-analytics', 'api/v1/admin/landing-analytics'])
export class AdminLandingController {
  constructor(private landing: LandingService) {}

  @Get()
  analytics(@Query('from') from?: string, @Query('to') to?: string) {
    return this.landing.analytics(from, to);
  }

  @Get('recent')
  recent(@Query('limit') limit?: string) {
    return this.landing.recentVisits(limit ? Number(limit) : 100);
  }

  /** 광고 집행비 조회 — ?month=2026-07 */
  @Get('ad-spend')
  adSpend(@Query('month') month?: string) {
    return this.landing.getAdSpend(month || '');
  }

  /** 광고 집행비 저장 */
  @Post('ad-spend')
  setAdSpend(@Body() body: { month: string; channel: string; amount: number }) {
    return this.landing.setAdSpend(body?.month, body?.channel, body?.amount);
  }
}
