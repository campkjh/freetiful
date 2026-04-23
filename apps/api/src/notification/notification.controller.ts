import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { NotificationService } from './notification.service';
import { Request } from 'express';

@ApiTags('notification')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getNotifications(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = (req.user as any).id;
    return this.notificationService.getNotifications(
      userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Post(':id/read')
  async markAsRead(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as any).id;
    return this.notificationService.markAsRead(userId, id);
  }

  @Post('read-all')
  async markAllAsRead(@Req() req: Request) {
    const userId = (req.user as any).id;
    return this.notificationService.markAllAsRead(userId);
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: Request) {
    const userId = (req.user as any).id;
    return this.notificationService.getUnreadCount(userId);
  }

  @Delete(':id')
  async deleteNotification(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as any).id;
    return this.notificationService.deleteNotification(userId, id);
  }

  @Delete()
  async deleteAll(@Req() req: Request) {
    const userId = (req.user as any).id;
    return this.notificationService.deleteAll(userId);
  }
}
