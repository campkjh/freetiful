import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { SettlementService } from './settlement.service';
import { SettlementController } from './settlement.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { AdminGuard } from '../common/guards/admin.guard';

@Module({
  imports: [
    PrismaModule,
    NotificationModule,
    JwtModule.register({}),
    ConfigModule,
  ],
  controllers: [SettlementController],
  providers: [SettlementService, AdminGuard],
  exports: [SettlementService],
})
export class SettlementModule {}
