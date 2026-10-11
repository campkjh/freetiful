import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminGuard } from '../common/guards/admin.guard';
import { GameController } from './game.controller';
import { GameAdminController } from './game-admin.controller';
import { GameService } from './game.service';

/**
 * 미니게임(261011 사장 '프리티풀도 에그점프처럼 게임 하나') — 지금은 웨딩런 하나.
 * JwtModule 은 기본 비밀 없이 등록 — 세션 토큰은 서비스가 JWT_SECRET 에서 파생한 비밀을 매번 넘겨 서명한다
 * (AdminGuard 도 JWT_SECRET 을 직접 넘겨 확인하므로 같은 JwtService 로 된다).
 * (261011 랭킹 API 검증 보강) 운영 컨트롤러 추가. GameService 를 내보내 두면 users 모듈이 탈퇴 때 forgetUser 를 부를 수 있다.
 */
@Module({
  imports: [PrismaModule, ConfigModule, JwtModule.register({})],
  controllers: [GameController, GameAdminController],
  providers: [GameService, AdminGuard],
  exports: [GameService],
})
export class GameModule {}
