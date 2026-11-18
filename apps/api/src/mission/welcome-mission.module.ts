import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { ImageModule } from '../image/image.module';
import { AdminGuard } from '../common/guards/admin.guard';
import { WelcomeMissionAdminController, WelcomeMissionController } from './welcome-mission.controller';
import { WelcomeMissionService } from './welcome-mission.service';

/** 신규가입 5,000원 미션(261110) — 출석 · 미션 판정 · 지급 신청 + 시크릿 미션 응모(261118) + 어드민. JwtModule · ConfigModule = AdminGuard 용, ImageModule = 스토리 캡처 저장 */
@Module({
  imports: [PrismaModule, NotificationModule, ImageModule, JwtModule.register({}), ConfigModule],
  controllers: [WelcomeMissionController, WelcomeMissionAdminController],
  providers: [WelcomeMissionService, AdminGuard],
})
export class WelcomeMissionModule {}
