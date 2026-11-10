import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { AdminGuard } from '../common/guards/admin.guard';
import { WelcomeMissionAdminController, WelcomeMissionController } from './welcome-mission.controller';
import { WelcomeMissionService } from './welcome-mission.service';

/** 신규가입 5,000원 미션(261110) — 출석 · 미션 판정 · 지급 신청 + 어드민. JwtModule · ConfigModule = AdminGuard 용 */
@Module({
  imports: [PrismaModule, NotificationModule, JwtModule.register({}), ConfigModule],
  controllers: [WelcomeMissionController, WelcomeMissionAdminController],
  providers: [WelcomeMissionService, AdminGuard],
})
export class WelcomeMissionModule {}
