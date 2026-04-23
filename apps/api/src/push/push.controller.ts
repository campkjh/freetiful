import { Body, Controller, Logger, Post, Req, UseGuards } from '@nestjs/common';
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

  @Post('debug-bridge')
  async debugBridge(
    @Req() req: Request,
    @Body() body: { userId?: string; hasHandler?: boolean; stage?: string; userAgent?: string },
  ) {
    const authUserId = (req.user as { id?: string })?.id;
    this.logger.log(
      `[BridgeDiag] stage=${body.stage} authUserId=${authUserId} bodyUserId=${body.userId} hasHandler=${body.hasHandler} UA=${(body.userAgent || '').slice(0, 80)}`,
    );
    return { ok: true };
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
