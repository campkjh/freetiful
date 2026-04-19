import { Controller, Post, Get, Patch, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminGuard } from '../common/guards/admin.guard';

@ApiTags('admin')
@UseGuards(AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Post('seed-pros')
  async seedPros() {
    return this.adminService.seedPros();
  }

  @Get('pros')
  async getPros(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getPros({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      status,
      search,
    });
  }

  @Get('pros/:id')
  async getProDetail(@Param('id') id: string) {
    return this.adminService.getProDetail(id);
  }

  @Patch('pros/:id')
  async updatePro(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updatePro(id, body);
  }

  @Patch('pros/:id/approve')
  async approvePro(@Param('id') id: string) {
    return this.adminService.approvePro(id);
  }

  @Patch('pros/:id/reject')
  async rejectPro(@Param('id') id: string, @Body('reason') reason?: string) {
    return this.adminService.rejectPro(id, reason);
  }

  @Patch('pros/:id/toggle-logo')
  async toggleLogo(@Param('id') id: string) {
    return this.adminService.togglePartnersLogo(id);
  }

  @Patch('pros/:id/featured')
  async toggleFeatured(@Param('id') id: string) {
    return this.adminService.toggleFeatured(id);
  }

  @Get('stats')
  async getStats() {
    return this.adminService.getStats();
  }

  @Get('users')
  async getUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('role') role?: string,
  ) {
    return this.adminService.getUsers({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      search,
      role,
    });
  }

  @Patch('users/:id/role')
  async updateUserRole(@Param('id') id: string, @Body('role') role: string) {
    return this.adminService.updateUserRole(id, role);
  }

  @Delete('users/:id')
  async deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  @Get('payments')
  async getPayments(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getPayments({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      status,
    });
  }

  @Get('reviews')
  async getReviews(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getReviews({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Delete('reviews/:id')
  async deleteReview(@Param('id') id: string) {
    return this.adminService.deleteReview(id);
  }
}
