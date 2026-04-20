import { Module } from '@nestjs/common';
import { ProController } from './pro.controller';
import { ProService } from './pro.service';
import { DiscoveryModule } from '../discovery/discovery.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [DiscoveryModule, NotificationModule],
  controllers: [ProController],
  providers: [ProService],
  exports: [ProService],
})
export class ProModule {}
