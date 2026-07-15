import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { LandingService } from './landing.service';
import { LandingController, AdminLandingController } from './landing.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminGuard } from '../common/guards/admin.guard';

@Module({
  imports: [PrismaModule, JwtModule.register({}), ConfigModule],
  controllers: [LandingController, AdminLandingController],
  providers: [LandingService, AdminGuard],
})
export class LandingModule {}
