import { Module } from '@nestjs/common';
import { BusinessController } from './business.controller';
import { BusinessService } from './business.service';
import { BusinessImageToneService } from './business-image-tone.service';

@Module({
  controllers: [BusinessController],
  providers: [BusinessService, BusinessImageToneService],
  exports: [BusinessService],
})
export class BusinessModule {}
