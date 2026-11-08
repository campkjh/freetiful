import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ImageModule } from '../image/image.module';
import { ReceptionController } from './reception.controller';
import { ReceptionService } from './reception.service';

/** 송년회(261108 'Freetiful & WMAK 2026 Year-End RECEPTION') — 웹 /reception 이벤트 사진·좋아요/공감·설문 */
@Module({
  imports: [PrismaModule, ImageModule],
  controllers: [ReceptionController],
  providers: [ReceptionService],
})
export class ReceptionModule {}
