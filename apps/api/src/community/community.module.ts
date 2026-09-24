import { Module } from '@nestjs/common';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';
import { CommunityAiService } from './community-ai.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CommunityController],
  providers: [CommunityService, CommunityAiService],
  exports: [CommunityService],
})
export class CommunityModule {}
