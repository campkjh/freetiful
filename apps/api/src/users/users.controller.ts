import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UsersService } from './users.service';
import { Request } from 'express';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  async getProfile(@Req() req: Request) {
    const userId = (req.user as any).id;
    return this.usersService.getProfile(userId);
  }

  @Put('profile')
  async updateProfile(
    @Req() req: Request,
    @Body() body: { name?: string; phone?: string; profileImageUrl?: string; profileImageDataUrl?: string },
  ) {
    const userId = (req.user as any).id;
    return this.usersService.updateProfile(userId, body);
  }

  @Post('profile/image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadProfileImage(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const userId = (req.user as any).id;
    return this.usersService.uploadProfileImage(userId, file);
  }

  @Get('notification-settings')
  async getNotificationSettings(@Req() req: Request) {
    const userId = (req.user as any).id;
    return this.usersService.getNotificationSettings(userId);
  }

  @Put('notification-settings')
  async updateNotificationSettings(
    @Req() req: Request,
    @Body() body: Record<string, boolean>,
  ) {
    const userId = (req.user as any).id;
    return this.usersService.updateNotificationSettings(userId, body);
  }

  @Post('delete-account')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async deleteAccount(@Req() req: Request) {
    const userId = (req.user as any).id;
    return this.usersService.deleteAccount(userId);
  }

  @Get('referral-event')
  async getReferralEventStatus(@Req() req: Request) {
    const userId = (req.user as any).id;
    return this.usersService.getReferralEventStatus(userId);
  }

  @Post('referral-event/code')
  async applyReferralEventCode(
    @Req() req: Request,
    @Body() body: { code?: string },
  ) {
    const userId = (req.user as any).id;
    return this.usersService.applyReferralEventCode(userId, body.code || '');
  }

  @Post('referral-event/rewards/:step/claim')
  async claimReferralEventReward(
    @Req() req: Request,
    @Param('step') step: string,
  ) {
    const userId = (req.user as any).id;
    return this.usersService.claimReferralEventReward(userId, Number(step));
  }

  @Post('referral-event/claim')
  async submitReferralEventClaim(
    @Req() req: Request,
    @Body() body: { bankName?: string; accountHolder?: string; accountNumber?: string },
  ) {
    const userId = (req.user as any).id;
    return this.usersService.submitReferralEventClaim(userId, body);
  }
}
