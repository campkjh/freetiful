import { Controller, Get, Patch, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminService } from './admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  async listUsers(@Req() req: Request, @Query('role') role?: 'general' | 'pro') {
    const userId = (req.user as any).id;
    return this.admin.listUsers(userId, role);
  }

  @Patch('users/:id/role')
  async updateRole(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { role: 'general' | 'pro' },
  ) {
    const userId = (req.user as any).id;
    return this.admin.updateUserRole(userId, id, body.role);
  }

  @Patch('users/:id/ban')
  async updateBan(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { isBanned: boolean },
  ) {
    const userId = (req.user as any).id;
    return this.admin.updateUserBan(userId, id, body.isBanned);
  }

  @Get('pros')
  async listPros(@Req() req: Request, @Query('status') status?: string) {
    const userId = (req.user as any).id;
    return this.admin.listProProfiles(userId, status);
  }

  @Patch('pros/:id/status')
  async updateProStatus(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { status: 'approved' | 'rejected' | 'pending' | 'suspended' | 'draft'; rejectionReason?: string },
  ) {
    const userId = (req.user as any).id;
    return this.admin.updateProProfileStatus(userId, id, body.status, body.rejectionReason);
  }
}
