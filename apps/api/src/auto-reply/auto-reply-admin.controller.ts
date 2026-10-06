import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../common/guards/admin.guard';
import { AutoReplyLearnService } from './auto-reply-learn.service';
import { checkGeminiHealth } from '../ai/ai-health';

/** 어드민 — 사회자 말투·조건 학습(261006). 기본 대상 = 퀵매칭 지정 사회자 전원 */
@ApiTags('admin-auto-reply')
@UseGuards(AdminGuard)
@Controller(['admin/auto-reply', 'api/v1/admin/auto-reply'])
export class AutoReplyAdminController {
  constructor(private learn: AutoReplyLearnService) {}

  @Get('health')
  @ApiOperation({ summary: 'AI 상태(전체 Gemini) — status credits = AI Studio 크레딧 소진. 어드민 화면은 /admin/ai-health 를 쓴다' })
  health() {
    return checkGeminiHealth();
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
