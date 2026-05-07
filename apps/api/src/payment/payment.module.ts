import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { PuddingModule } from '../pudding/pudding.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [PrismaModule, ConfigModule, NotificationModule, PuddingModule, ChatModule],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
