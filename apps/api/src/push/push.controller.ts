import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
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
  constructor(private readonly pushService: PushService) {}

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
