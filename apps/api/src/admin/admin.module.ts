import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { ProModule } from '../pro/pro.module';
import { DiscoveryModule } from '../discovery/discovery.module';
import { ImageModule } from '../image/image.module';
import { UsersModule } from '../users/users.module';
import { AdminGuard } from '../common/guards/admin.guard';

@Module({
  imports: [PrismaModule, NotificationModule, ProModule, DiscoveryModule, ImageModule, UsersModule, JwtModule.register({}), ConfigModule],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard],
  exports: [AdminService],
})
export class AdminModule {}
