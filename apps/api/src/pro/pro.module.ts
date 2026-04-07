import { Module } from '@nestjs/common';
import { ProController } from './pro.controller';
import { ProService } from './pro.service';

@Module({
  controllers: [ProController],
  providers: [ProService],
  exports: [ProService],
})
export class ProModule {}
