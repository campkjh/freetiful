import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { ImageModule } from './image/image.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProModule } from './pro/pro.module';
import { BusinessModule } from './business/business.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { MatchModule } from './match/match.module';
import { ChatModule } from './chat/chat.module';
import { QuotationModule } from './quotation/quotation.module';
import { PaymentModule } from './payment/payment.module';
import { ReviewModule } from './review/review.module';
import { NotificationModule } from './notification/notification.module';
import { PushModule } from './push/push.module';
import { FavoriteModule } from './favorite/favorite.module';
import { AdminModule } from './admin/admin.module';
import { PuddingModule } from './pudding/pudding.module';
import { RefDataModule } from './ref-data/ref-data.module';
import { PlanTemplateModule } from './plan-template/plan-template.module';
import { BannerModule } from './banner/banner.module';
import { AiModule } from './ai/ai.module';
import { AnnouncementModule } from './announcement/announcement.module';
import { FaqModule } from './faq/faq.module';
import { SettlementModule } from './settlement/settlement.module';
import { BusinessInquiryModule } from './business-inquiry/business-inquiry.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    ImageModule,
    AuthModule,
    UsersModule,
    ProModule,
    BusinessModule,
    DiscoveryModule,
    MatchModule,
    ChatModule,
    QuotationModule,
    PaymentModule,
    ReviewModule,
    NotificationModule,
    PushModule,
    FavoriteModule,
    AdminModule,
    PuddingModule,
    RefDataModule,
    PlanTemplateModule,
    BannerModule,
    AiModule,
    AnnouncementModule,
    FaqModule,
    SettlementModule,
    BusinessInquiryModule,
  ],
})
export class AppModule {}
