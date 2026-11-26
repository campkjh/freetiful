import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { BizTalkService } from './biztalk.service';
import { MatchAlimtalkProvider } from './match-alimtalk-provider';
import { MatchAlimtalkService } from './match-alimtalk.service';

@Module({
  imports: [PrismaModule, ConfigModule],
  providers: [BizTalkService, MatchAlimtalkProvider, MatchAlimtalkService],
  exports: [BizTalkService, MatchAlimtalkService],
})
export class BizTalkModule {}
