import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../common/guards/admin.guard';
import { actorFrom } from '../admin/admin-audit.service';
import { GameService } from './game.service';
import { AdminHideScoreBody, AdminPlayerBody } from './game.dto';

/**
 * 웨딩런 운영(261011 랭킹 API 검증 보강 — 예전엔 기록을 숨기거나 지울 길이 없어 DB 를 직접 고쳐야 했다).
 * AdminGuard(어드민 JWT 또는 x-admin-key). 바꾼 내용은 admin_audit_logs(action 'game.wedding_run.*')에 남는다.
 *  · GET  admin/scores?sort=recent|top|long&hidden=1|0|auto(자동 보류만)&playerOf=<판 id>&limit=&page=  — 최근·높은 점수·오래 달린 판(초당 점수 포함)
 *  · POST admin/scores/:id/hide    { hidden?: boolean(기본 true), reason? }              — 판 숨김/해제(순위 요약 다시 계산)
 *  · POST admin/scores/:id/player  { hidden?, resetNickname?, lockNickname?, reason? }   — 그 판을 낸 플레이어 숨김/해제·닉네임 초기화(+잠금)
 * 공개 화면에 playerKey 를 내보내지 않으니 플레이어는 '그 사람의 판 id'(공유 링크 ?c= 값·운영 목록)로 가리킨다.
 */
@ApiTags('game-admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('game/wedding-run/admin')
export class GameAdminController {
  constructor(private readonly game: GameService) {}

  @Get('scores')
  @ApiOperation({ summary: '웨딩런 운영 — 판 목록' })
  list(
    @Query('sort') sort?: string,
    @Query('hidden') hidden?: string,
    @Query('playerOf') playerOf?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    return this.game.adminListScores({ sort, hidden, playerOf, limit, page });
  }

  @Post('scores/:id/hide')
  @ApiOperation({ summary: '웨딩런 운영 — 판 숨김/해제' })
  hide(@Request() req: any, @Param('id') id: string, @Body() body: AdminHideScoreBody) {
    return this.game.adminHideScore(id, body, actorFrom(req));
  }

  @Post('scores/:id/player')
  @ApiOperation({ summary: '웨딩런 운영 — 플레이어 숨김/해제·닉네임 초기화' })
  player(@Request() req: any, @Param('id') id: string, @Body() body: AdminPlayerBody) {
    return this.game.adminUpdatePlayer(id, body, actorFrom(req));
  }
}
