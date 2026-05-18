import { Module } from '@nestjs/common';
import { ProController } from './pro.controller';
import { ProService } from './pro.service';
import { DiscoveryModule } from '../discovery/discovery.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [DiscoveryModule, ChatModule],
  controllers: [ProController],
  providers: [ProService],
  exports: [ProService],
})
export class ProModule {}
