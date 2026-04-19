import { Controller, Post, Get, Patch, Headers, ForbiddenException, Param, Query, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';

function verifyKey(key: string) {
  const adminKey = process.env.ADMIN_SECRET_KEY;
  if (!adminKey || key !== adminKey) throw new ForbiddenException('Invalid admin key');
}

@ApiTags('admin')
@Controller('api/v1/admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Post('seed-pros')
  async seedPros(@Headers('x-admin-key') key: string) {
    verifyKey(key);
    return this.adminService.seedPros();
  }

  @Get('pros')
  async getPros(
    @Headers('x-admin-key') key: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    verifyKey(key);
    return this.adminService.getPros({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      status,
      search,
    });
  }

  @Patch('pros/:id/approve')
  async approvePro(@Headers('x-admin-key') key: string, @Param('id') id: string) {
    verifyKey(key);
    return this.adminService.approvePro(id);
  }

  @Patch('pros/:id/reject')
  async rejectPro(
    @Headers('x-admin-key') key: string,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    verifyKey(key);
    return this.adminService.rejectPro(id, reason);
  }

  @Patch('pros/:id/toggle-logo')
  async toggleLogo(@Headers('x-admin-key') key: string, @Param('id') id: string) {
    verifyKey(key);
    return this.adminService.togglePartnersLogo(id);
  }
}
