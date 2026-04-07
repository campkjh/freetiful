import { Module } from '@nestjs/common';
import { PuddingService } from './pudding.service';
import { PuddingController } from './pudding.controller';

@Module({
  providers: [PuddingService],
  controllers: [PuddingController],
  exports: [PuddingService],
})
export class PuddingModule {}
