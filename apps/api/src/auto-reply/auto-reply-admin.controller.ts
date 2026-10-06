import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../common/guards/admin.guard';
import { AutoReplyLearnService } from './auto-reply-learn.service';
import { AutoReplyAiService } from './auto-reply-ai.service';

/** 어드민 — 사회자 말투·조건 학습(261006). 기본 대상 = 퀵매칭 지정 사회자 전원 */
@ApiTags('admin-auto-reply')
@UseGuards(AdminGuard)
@Controller(['admin/auto-reply', 'api/v1/admin/auto-reply'])
export class AutoReplyAdminController {
  constructor(private learn: AutoReplyLearnService, private ai: AutoReplyAiService) {}

  @Get('health')
  @ApiOperation({ summary: 'AI 상태 — 마지막 모델 오류(402 = AI Studio 크레딧 소진)' })
  health() {
    const e = this.ai.lastError;
    return {
      enabled: this.ai.isEnabled(),
      lastError: e ? { code: e.code, message: e.message, at: new Date(e.at).toISOString() } : null,
      creditsDepleted: !!e && e.code === 402 && Date.now() - e.at < 6 * 3600000,
    };
  }

  @Post('learn')
  @ApiOperation({ summary: '사회자 말투·조건 학습(채팅+프로필 → 주제별 답). dryRun 이면 저장 안 함' })
  learnMany(@Body() body: { proProfileIds?: string[]; dryRun?: boolean }) {
    const ids = Array.isArray(body?.proProfileIds) ? body.proProfileIds.filter((v) => typeof v === 'string').slice(0, 40) : undefined;
    return this.learn.learnMany(ids, { dryRun: body?.dryRun === true });
  }

  @Get('learned/:proProfileId')
  @ApiOperation({ summary: '학습 결과 보기(말투 요약·조건·주제별 답)' })
  getLearned(@Param('proProfileId') proProfileId: string) {
    return this.learn.getLearned(proProfileId);
  }
}
