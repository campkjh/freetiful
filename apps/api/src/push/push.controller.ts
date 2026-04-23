import { Body, Controller, Get, Logger, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SubscribeDto } from './dto/subscribe.dto';
import { OneSignalRegisterDto } from './dto/onesignal-register.dto';
import { PushService } from './push.service';

@ApiTags('push')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('push')
export class PushController {
  private readonly logger = new Logger(PushController.name);

  constructor(private readonly pushService: PushService) {}

  /**
   * 현재 로그인 유저의 OneSignal 상태 조회 + 테스트 푸시 발송 옵션
   * GET /push/debug → 조회만
   * POST /push/debug → { test: true }면 테스트 푸시까지 발송
   */
  @Get('debug')
  async debugGet(@Req() req: Request) {
    const userId = (req.user as { id: string }).id;
    return this.pushService.debugStatus(userId);
  }

  @Post('debug')
  async debugPost(
    @Req() req: Request,
    @Body() body: { test?: boolean },
  ) {
    const userId = (req.user as { id: string }).id;
    const status = await this.pushService.debugStatus(userId);
    let testResult: unknown = null;
    if (body?.test) {
      testResult = await this.pushService.sendOneSignalTest(userId);
    }
    return { ...status, testResult };
  }

  @Post('subscribe')
  async subscribe(@Req() req: Request, @Body() body: SubscribeDto) {
    const userId = (req.user as { id: string }).id;
    await this.pushService.saveSubscription(
      userId,
      body.endpoint,
      body.p256dh,
      body.auth,
    );
    return { ok: true };
  }

  @Post('onesignal/register')
  async registerOneSignal(
    @Req() req: Request,
    @Body() body: OneSignalRegisterDto,
  ) {
    const userId = (req.user as { id: string }).id;
    await this.pushService.saveOneSignalPlayerId(
      userId,
      body.playerId,
      body.platform || 'iOS',
    );
    return { ok: true };
  }
}
