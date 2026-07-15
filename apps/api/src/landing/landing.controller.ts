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
}
