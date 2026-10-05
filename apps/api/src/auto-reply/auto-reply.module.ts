import { Module } from '@nestjs/common';
import { AutoReplyController } from './auto-reply.controller';
import { AutoReplyService } from './auto-reply.service';
import { AutoReplyAiService } from './auto-reply-ai.service';
import { QuickMatchRosterModule } from '../match/quick-match-roster.module';

@Module({
  // 퀵매칭 지정 사회자 명단(같은 인스턴스·같은 기억) — AI 기본 켜기·플랫폼 기본 답 대상(261005)
  imports: [QuickMatchRosterModule],
  controllers: [AutoReplyController],
  providers: [AutoReplyService, AutoReplyAiService],
  exports: [AutoReplyService],
})
export class AutoReplyModule {}
