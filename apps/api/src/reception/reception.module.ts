import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { ImageModule } from '../image/image.module';
import { AdminGuard } from '../common/guards/admin.guard';
import { ReceptionAdminController } from './reception-admin.controller';
import { ReceptionController } from './reception.controller';
import { ReceptionService } from './reception.service';

/** 송년회(261108 'Freetiful & WMAK 2026 Year-End RECEPTION') — 웹 /reception 이벤트 사진·좋아요/공감·설문·손님 + 어드민 참여자·설문 */
@Module({
  // JwtModule·ConfigModule = 어드민 참여자·설문 API 의 AdminGuard 용(어드민 모듈과 같은 구성)
  imports: [PrismaModule, ImageModule, JwtModule.register({}), ConfigModule],
  controllers: [ReceptionController, ReceptionAdminController],
  providers: [ReceptionService, AdminGuard],
})
export class ReceptionModule {}
