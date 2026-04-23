import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { AnnouncementService } from './announcement.service';
import { AnnouncementController, AdminAnnouncementController } from './announcement.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminGuard } from '../common/guards/admin.guard';

@Module({
  imports: [PrismaModule, JwtModule.register({}), ConfigModule],
  controllers: [AnnouncementController, AdminAnnouncementController],
  providers: [AnnouncementService, AdminGuard],
  exports: [AnnouncementService],
})
export class AnnouncementModule {}
