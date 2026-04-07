import { Controller, Get, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PuddingService } from './pudding.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Pudding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class PuddingController {
  constructor(private pudding: PuddingService) {}

  @Get('pro/pudding')
  getMyBalance(@Request() req: any) {
    return this.pudding.getBalance(req.user.proProfile?.id);
  }

  @Get('pro/pudding/rank')
  getRankings(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.pudding.getRankings(+page, +limit);
  }
}
