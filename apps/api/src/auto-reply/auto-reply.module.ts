import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { AutoReplyController } from './auto-reply.controller';
import { AutoReplyAdminController } from './auto-reply-admin.controller';
import { AutoReplyService } from './auto-reply.service';
import { AutoReplyAiService } from './auto-reply-ai.service';
import { AutoReplyLearnService } from './auto-reply-learn.service';
import { QuickMatchRosterModule } from '../match/quick-match-roster.module';
import { AdminGuard } from '../common/guards/admin.guard';

@Module({
  // 퀵매칭 지정 사회자 명단(같은 인스턴스·같은 기억) — AI 기본 켜기·주제 답·말투 학습 대상(261005·261006)
  // JwtModule·ConfigModule = 어드민 학습 API 의 AdminGuard 용(어드민 모듈과 같은 구성)
  imports: [QuickMatchRosterModule, JwtModule.register({}), ConfigModule],
  controllers: [AutoReplyController, AutoReplyAdminController],
  providers: [AutoReplyService, AutoReplyAiService, AutoReplyLearnService, AdminGuard],
  exports: [AutoReplyService],
})
export class AutoReplyModule {}
