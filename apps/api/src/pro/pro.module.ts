import { Module, forwardRef } from '@nestjs/common';
import { ProController } from './pro.controller';
import { ProService } from './pro.service';
import { DiscoveryModule } from '../discovery/discovery.module';
import { NotificationModule } from '../notification/notification.module';
import { PaymentModule } from '../payment/payment.module';
import { PuddingModule } from '../pudding/pudding.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [DiscoveryModule, NotificationModule, forwardRef(() => PaymentModule), PuddingModule, ChatModule],
  controllers: [ProController],
  providers: [ProService],
  exports: [ProService],
})
export class ProModule {}
