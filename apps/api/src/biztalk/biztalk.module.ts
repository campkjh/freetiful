import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { BizTalkService } from './biztalk.service';

@Module({
  imports: [PrismaModule, ConfigModule],
  providers: [BizTalkService],
  exports: [BizTalkService],
})
export class BizTalkModule {}
