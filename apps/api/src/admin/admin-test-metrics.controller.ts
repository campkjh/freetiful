import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../common/guards/admin.guard';
import { TestMetricsEnvGuard } from '../common/guards/test-metrics-env.guard';
import { AdminTestMetricsService } from './admin-test-metrics.service';
import { actorFrom } from './admin-audit.service';

/**
 * 테스트 좋아요·조회수 — 개발·스테이징 전용(261004).
 * 가드 순서가 중요: TestMetricsEnvGuard 가 먼저 → 운영 서버면 관리자 여부와 상관없이 404(이 라우트가 없는 것과 같다).
 */
@ApiTags('admin')
@UseGuards(TestMetricsEnvGuard, AdminGuard)
@Controller(['admin/test-metrics', 'api/v1/admin/test-metrics'])
export class AdminTestMetricsController {
  constructor(private service: AdminTestMetricsService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Put(':postId')
  set(@Req() req: any, @Param('postId') postId: string, @Body() body: any) {
    return this.service.set(actorFrom(req), postId, body);
  }

  @Delete(':postId')
  reset(@Req() req: any, @Param('postId') postId: string) {
    return this.service.reset(actorFrom(req), postId);
  }

  @Post('reset-all')
  resetAll(@Req() req: any) {
    return this.service.resetAll(actorFrom(req));
  }
}
