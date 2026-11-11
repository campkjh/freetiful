import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { AutoReplyController } from './auto-reply.controller';
import { AutoReplyAdminController } from './auto-reply-admin.controller';
import { AutoReplyService } from './auto-reply.service';
import { AutoReplyAiService } from './auto-reply-ai.service';
import { AutoReplyLearnService } from './auto-reply-learn.service';
import { AdminGuard } from '../common/guards/admin.guard';

@Module({
  // AI 기본 켜기·주제 답·말투 학습은 261111 부터 사회자 전원이라 퀵매칭 지정 명단(QuickMatchRosterModule)을 안 쓴다
  // JwtModule·ConfigModule = 어드민 학습 API 의 AdminGuard 용(어드민 모듈과 같은 구성)
  imports: [JwtModule.register({}), ConfigModule],
  controllers: [AutoReplyController, AutoReplyAdminController],
  providers: [AutoReplyService, AutoReplyAiService, AutoReplyLearnService, AdminGuard],
  exports: [AutoReplyService],
})
export class AutoReplyModule {}
