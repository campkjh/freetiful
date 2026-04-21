import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { BannerService } from './banner.service';
import { BannerController, AdminBannerController } from './banner.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminGuard } from '../common/guards/admin.guard';

@Module({
  imports: [PrismaModule, JwtModule.register({}), ConfigModule],
  controllers: [BannerController, AdminBannerController],
  providers: [BannerService, AdminGuard],
  exports: [BannerService],
})
export class BannerModule {}
