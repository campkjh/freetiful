import { Body, Controller, Get, Header, Headers, HttpCode, Logger, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { GameRequestContext, GameService } from './game.service';
import { AbandonSessionBody, CreateSessionBody, SubmitScoreBody } from './game.dto';
import { resolveClientIp } from './game-ip';

/**
 * 웨딩런 '신혼집까지 달려!'(261011 사장 '에그점프처럼 점프게임, url 은 따로' — 웹 /wedding-run).
 * 전부 로그인 선택: 토큰이 있으면 계정으로, 없거나 무효면 게스트(deviceId) — 401 은 내지 않는다.
 * 본문은 인터페이스로 받아 서비스가 직접 검사한다(전역 ValidationPipe 의 forbidNonWhitelisted 를 피해 — game.dto.ts 주석).
 * (261011 랭킹 API 검증 보강) 요청자 IP 는 game-ip.ts(웹 비밀 머리글이 맞을 때만 x-forwarded-for 를 믿음), 읽기에도 속도 제한.
 * 순위의 deviceId 는 머리글 X-WR-Device 로 받는다(주소에 실으면 접근 기록에 남음) — 예전 ?deviceId= 도 당분간 받는다.
 * (261011 검증 반영) 응답 머리글 X-WR-IP-Mode = trusted | direct | legacy | legacy+proxy — WR_PROXY_SECRET 켜는 순서 확인용(game-ip.ts).
 *   판 포기 POST sessions/abandon — 그만둔 판·안 쓴 판 세션을 닫아 같은 IP 열린 판 상한에서 뺀다.
 */
@ApiTags('game')
@Controller('game/wedding-run')
export class GameController {
  private readonly logger = new Logger(GameController.name);
  private warnedLegacyIp = false;

  constructor(
    private readonly game: GameService,
    private readonly config: ConfigService,
  ) {}

  private ctx(req: any): GameRequestContext {
    const ip = resolveClientIp(req, this.config.get<string>('WR_PROXY_SECRET'));
    try {
      req?.res?.setHeader?.('X-WR-IP-Mode', ip.mode + (ip.proxySeen ? '+proxy' : ''));
    } catch {
      /* 머리글을 못 붙여도 요청은 그대로 */
    }
    if (ip.mode === 'legacy' && !this.warnedLegacyIp) {
      this.warnedLegacyIp = true;
      this.logger.warn('WR_PROXY_SECRET 미설정 — 웨딩런 속도 제한이 x-forwarded-for 를 그대로 믿는 중(직접 요청으로 우회 가능)');
    }
    return { ip: ip.ip, userId: req.user?.id ?? null };
  }

  @Post('sessions')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: '웨딩런 한 판 시작 — 세션 토큰 발급(30분, 한 번만)' })
  createSession(@Request() req: any, @Body() body: CreateSessionBody) {
    return this.game.createSession(body, this.ctx(req));
  }

  @Post('sessions/abandon')
  @HttpCode(200)
  @ApiOperation({ summary: '웨딩런 판 포기 — 그만둔·안 쓴 판의 세션을 닫는다(로그인 불필요, 토큰이 곧 증명)' })
  abandonSession(@Request() req: any, @Body() body: AbandonSessionBody) {
    return this.game.abandonSession(body, this.ctx(req));
  }

  @Post('scores')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: '웨딩런 점수 제출(한 판 한 번)' })
  submitScore(@Request() req: any, @Body() body: SubmitScoreBody) {
    return this.game.submitScore(body, this.ctx(req));
  }

  @Get('leaderboard')
  @UseGuards(OptionalJwtAuthGuard)
  // 응답의 me·isMe 가 머리글(X-WR-Device·로그인)마다 다른데 주소는 같다 — 웹 앞단(Vercel)·중간 캐시가 남의 순위를 돌려주지 않게(261011 통합)
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'Authorization, X-WR-Device')
  @ApiOperation({ summary: '웨딩런 순위 — ?period=today|week|all, 머리글 X-WR-Device(또는 예전 ?deviceId=)' })
  leaderboard(
    @Request() req: any,
    @Query('period') period?: string,
    @Query('deviceId') deviceIdQuery?: string,
    @Headers('x-wr-device') deviceIdHeader?: string,
  ) {
    const c = this.ctx(req);
    return this.game.leaderboard(period, deviceIdHeader || deviceIdQuery, c.userId, c);
  }

  @Get('scores/:id')
  @ApiOperation({ summary: '웨딩런 기록 한 건(공유 링크 도전 문구용, 공개 정보만)' })
  getScore(@Request() req: any, @Param('id') id: string) {
    return this.game.getScore(id, this.ctx(req));
  }
}
