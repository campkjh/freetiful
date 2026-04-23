import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { FaqService } from './faq.service';
import { FaqController, AdminFaqController } from './faq.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminGuard } from '../common/guards/admin.guard';

@Module({
  imports: [PrismaModule, JwtModule.register({}), ConfigModule],
  controllers: [FaqController, AdminFaqController],
  providers: [FaqService, AdminGuard],
  exports: [FaqService],
})
export class FaqModule {}
