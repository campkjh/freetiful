import { Module } from '@nestjs/common';
import { AutoReplyController } from './auto-reply.controller';
import { AutoReplyService } from './auto-reply.service';
import { AutoReplyAiService } from './auto-reply-ai.service';

@Module({
  controllers: [AutoReplyController],
  providers: [AutoReplyService, AutoReplyAiService],
  exports: [AutoReplyService],
})
export class AutoReplyModule {}
