import { Module } from '@nestjs/common';
import { RefDataController } from './ref-data.controller';
import { RefDataService } from './ref-data.service';

@Module({
  controllers: [RefDataController],
  providers: [RefDataService],
  exports: [RefDataService],
})
export class RefDataModule {}
