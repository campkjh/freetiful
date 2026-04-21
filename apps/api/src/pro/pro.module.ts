import { Module, forwardRef } from '@nestjs/common';
import { ProController } from './pro.controller';
import { ProService } from './pro.service';
import { DiscoveryModule } from '../discovery/discovery.module';
import { NotificationModule } from '../notification/notification.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [DiscoveryModule, NotificationModule, forwardRef(() => PaymentModule)],
  controllers: [ProController],
  providers: [ProService],
  exports: [ProService],
})
export class ProModule {}
