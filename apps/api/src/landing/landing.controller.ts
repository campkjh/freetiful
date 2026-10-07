import { Body, Controller, Get, Headers, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LandingService, PageViewInput, VisitInput } from './landing.service';
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

  /** 페이지 조회 1건(261007 페이지별 인사이트) — 화면을 열 때 */
  @Post('pageview')
  pageView(@Body() body: PageViewInput, @Headers('user-agent') ua?: string) {
    return this.landing.recordPageView(body || ({} as PageViewInput), ua);
  }

  /** 그 화면 체류시간(누적 ms) — 떠날 때·탭이 숨을 때 */
  @Post('pageview/duration')
  pageViewDuration(@Body() body: { id: string; ms: number }) {
    return this.landing.updatePageViewDuration(body?.id, body?.ms);
  }
}

// 어드민 — 유입 지표
@ApiTags('admin')
@UseGuards(AdminGuard)
@Controller(['admin/landing-analytics', 'api/v1/admin/landing-analytics'])
export class AdminLandingController {
  constructor(private landing: LandingService) {}

  /** ?page=quick-match|wedding-mc|corporate-mc — 페이지별 유입 분석(261005). 없으면 랜딩 2개 합 */
  @Get()
  analytics(@Query('from') from?: string, @Query('to') to?: string, @Query('page') page?: string) {
    return this.landing.analytics(from, to, page);
  }

  @Get('recent')
  recent(@Query('limit') limit?: string, @Query('page') page?: string) {
    return this.landing.recentVisits(limit ? Number(limit) : 100, page);
  }

  /** 페이지별 인사이트(261007) — 기간 안 페이지마다 방문자·조회·체류시간·바로 나감 + 앞 기간 비교 + 흐름 */
  @Get('pages')
  pages(@Query('from') from?: string, @Query('to') to?: string) {
    return this.landing.pageInsights(from, to);
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
