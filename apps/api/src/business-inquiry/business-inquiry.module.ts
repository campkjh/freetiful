import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AdminGuard } from '../common/guards/admin.guard';
import { PrismaModule } from '../prisma/prisma.module';
import {
  AdminBusinessInquiryController,
  BusinessInquiryController,
} from './business-inquiry.controller';
import { BusinessInquiryService } from './business-inquiry.service';
import { BizTalkModule } from '../biztalk/biztalk.module';

@Module({
  imports: [PrismaModule, JwtModule.register({}), ConfigModule, BizTalkModule],
  controllers: [BusinessInquiryController, AdminBusinessInquiryController],
  providers: [BusinessInquiryService, AdminGuard],
})
export class BusinessInquiryModule {}
