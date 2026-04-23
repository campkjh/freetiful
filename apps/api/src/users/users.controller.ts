import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UsersService } from './users.service';
import { Request } from 'express';
import { UserRole } from '@prisma/client';

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
    @Body() body: { name?: string; phone?: string; profileImageUrl?: string },
  ) {
    const userId = (req.user as any).id;
    return this.usersService.updateProfile(userId, body);
  }

  @Get('points')
  async getPointBalance(@Req() req: Request) {
    const userId = (req.user as any).id;
    return this.usersService.getPointBalance(userId);
  }

  @Get('points/history')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getPointHistory(
    @Req() req: Request,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = (req.user as any).id;
    return this.usersService.getPointHistory(
      userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Post('role')
  async switchRole(
    @Req() req: Request,
    @Body() body: { role: 'general' | 'pro' },
  ) {
    const userId = (req.user as any).id;
    return this.usersService.switchRole(userId, body.role as UserRole);
  }

  @Post('delete-account')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async deleteAccount(@Req() req: Request) {
    const userId = (req.user as any).id;
    return this.usersService.deleteAccount(userId);
  }

  @Get('coupons')
  async getCoupons(@Req() req: Request) {
    const userId = (req.user as any).id;
    return this.usersService.getCoupons(userId);
  }
}
