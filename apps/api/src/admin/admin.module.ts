import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminCommunityService } from './admin-community.service';
import { AdminAuditService } from './admin-audit.service';
import { AdminFunnelService } from './admin-funnel.service';
import { AdminOperatorService } from './admin-operator.service';
import { AdminTestMetricsService } from './admin-test-metrics.service';
import { AdminTestMetricsController } from './admin-test-metrics.controller';
import { TestMetricsEnvGuard } from '../common/guards/test-metrics-env.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { ProModule } from '../pro/pro.module';
import { DiscoveryModule } from '../discovery/discovery.module';
import { ImageModule } from '../image/image.module';
import { UsersModule } from '../users/users.module';
import { AdminGuard } from '../common/guards/admin.guard';
import { QuickMatchRosterModule } from '../match/quick-match-roster.module';

@Module({
  imports: [PrismaModule, NotificationModule, ProModule, DiscoveryModule, ImageModule, UsersModule, QuickMatchRosterModule, JwtModule.register({}), ConfigModule],
  controllers: [AdminController, AdminTestMetricsController],
  providers: [AdminService, AdminCommunityService, AdminAuditService, AdminOperatorService, AdminTestMetricsService, AdminFunnelService, AdminGuard, TestMetricsEnvGuard],
  exports: [AdminService],
})
export class AdminModule {}
