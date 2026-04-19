import { Controller, Post, Get, Patch, Delete, Headers, ForbiddenException, Param, Query, Body } from '@nestjs/common';
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

  @Patch('pros/:id/featured')
  async toggleFeatured(@Headers('x-admin-key') key: string, @Param('id') id: string) {
    verifyKey(key);
    return this.adminService.toggleFeatured(id);
  }

  @Get('stats')
  async getStats(@Headers('x-admin-key') key: string) {
    verifyKey(key);
    return this.adminService.getStats();
  }

  @Get('users')
  async getUsers(
    @Headers('x-admin-key') key: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('role') role?: string,
  ) {
    verifyKey(key);
    return this.adminService.getUsers({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      search,
      role,
    });
  }

  @Patch('users/:id/role')
  async updateUserRole(
    @Headers('x-admin-key') key: string,
    @Param('id') id: string,
    @Body('role') role: string,
  ) {
    verifyKey(key);
    return this.adminService.updateUserRole(id, role);
  }

  @Delete('users/:id')
  async deleteUser(@Headers('x-admin-key') key: string, @Param('id') id: string) {
    verifyKey(key);
    return this.adminService.deleteUser(id);
  }

  @Get('payments')
  async getPayments(
    @Headers('x-admin-key') key: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    verifyKey(key);
    return this.adminService.getPayments({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      status,
    });
  }

  @Get('reviews')
  async getReviews(
    @Headers('x-admin-key') key: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    verifyKey(key);
    return this.adminService.getReviews({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Delete('reviews/:id')
  async deleteReview(@Headers('x-admin-key') key: string, @Param('id') id: string) {
    verifyKey(key);
    return this.adminService.deleteReview(id);
  }
}
