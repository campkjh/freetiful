import { Controller, Post, Get, Patch, Delete, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminGuard } from '../common/guards/admin.guard';

@ApiTags('admin')
@UseGuards(AdminGuard)
// 두 경로 모두 허용 (Railway 배포 타이밍 이슈 방지):
// - /api/v1/admin/* : 글로벌 prefix + 'admin'
// - /api/v1/api/v1/admin/* : 글로벌 prefix + 'api/v1/admin' (구 배포 호환)
@Controller(['admin', 'api/v1/admin'])
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Post('seed-pros')
  async seedPros() {
    return this.adminService.seedPros();
  }

  @Post('transfer-pro-profile')
  async transferProProfile(
    @Body('sourceEmail') sourceEmail: string,
    @Body('targetEmail') targetEmail: string,
  ) {
    return this.adminService.transferProProfile(sourceEmail, targetEmail);
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

  @Patch('pros/:id/full')
  async fullUpdatePro(@Param('id') id: string, @Body() body: any) {
    return this.adminService.fullUpdatePro(id, body);
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

  @Get('users/diagnose')
  async findUsersByEmail(@Query('email') email?: string) {
    return this.adminService.findUsersByEmail(email || '');
  }

  @Patch('users/:id/archive')
  async archiveUser(@Param('id') id: string) {
    return this.adminService.archiveUser(id);
  }

  @Post('cleanup-empty-profiles')
  async cleanupEmptyProfiles() {
    return this.adminService.cleanupEmptyProProfiles();
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
