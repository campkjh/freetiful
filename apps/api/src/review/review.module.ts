import { Module } from '@nestjs/common';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';
import { ReviewSummaryService } from './review-summary.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { DiscoveryModule } from '../discovery/discovery.module';

@Module({
  imports: [PrismaModule, NotificationModule, DiscoveryModule],
  controllers: [ReviewController],
  providers: [ReviewService, ReviewSummaryService],
  exports: [ReviewService],
})
export class ReviewModule {}
