import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiConsumes } from '@nestjs/swagger';
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
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.adminService.getPros({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      status,
      search,
      startDate,
      endDate,
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

  @Post('pros/:id/pudding')
  async awardPudding(
    @Param('id') id: string,
    @Body() body: { amount: number; note?: string },
  ) {
    return this.adminService.awardPudding(id, Number(body.amount) || 0, body.note);
  }

  /** 어드민 → 유저(들)에게 쿠폰 발급 + 푸쉬 알림 */
  @Post('coupons/grant')
  async grantCoupon(@Body() body: { userIds: string[]; couponId: string }) {
    return this.adminService.grantCoupon(body.userIds || [], body.couponId);
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
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.adminService.getUsers({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      search,
      role,
      startDate,
      endDate,
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

  @Get('users/:id')
  async getUserDetail(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Patch('users/:id')
  async updateUser(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateUser(id, body);
  }

  @Post('cleanup-empty-profiles')
  async cleanupEmptyProfiles() {
    return this.adminService.cleanupEmptyProProfiles();
  }

  @Get('bookings')
  async getBookings(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.adminService.getBookings({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      status,
      startDate,
      endDate,
    });
  }

  @Get('payments')
  async getPayments(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.adminService.getPayments({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      status,
      startDate,
      endDate,
    });
  }

  @Get('reviews')
  async getReviews(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.adminService.getReviews({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      startDate,
      endDate,
    });
  }

  @Post('reviews')
  async createReview(@Body() body: any) {
    return this.adminService.createReview(body);
  }

  @Delete('reviews/:id')
  async deleteReview(@Param('id') id: string) {
    return this.adminService.deleteReview(id);
  }

  @Patch('quotations/:id')
  async updateQuotation(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateQuotation(id, body);
  }

  @Delete('quotations/:id')
  async deleteQuotation(@Param('id') id: string) {
    return this.adminService.deleteQuotation(id);
  }

  @Patch('payments/:id')
  async updatePayment(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updatePayment(id, body);
  }

  @Delete('payments/:id')
  async deletePayment(@Param('id') id: string) {
    return this.adminService.deletePayment(id);
  }

  @Patch('schedules/:id')
  async updateSchedule(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateSchedule(id, body);
  }

  @Delete('schedules/:id')
  async deleteSchedule(@Param('id') id: string) {
    return this.adminService.deleteSchedule(id);
  }

  @Patch('match-requests/:id')
  async updateMatchRequest(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateMatchRequest(id, body);
  }

  @Delete('match-requests/:id')
  async deleteMatchRequest(@Param('id') id: string) {
    return this.adminService.deleteMatchRequest(id);
  }

  @Patch('match-deliveries/:id')
  async updateMatchDelivery(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateMatchDelivery(id, body);
  }

  @Delete('match-deliveries/:id')
  async deleteMatchDelivery(@Param('id') id: string) {
    return this.adminService.deleteMatchDelivery(id);
  }

  @Delete('favorites/:id')
  async deleteFavorite(@Param('id') id: string) {
    return this.adminService.deleteFavorite(id);
  }

  @Patch('notifications/:id')
  async updateNotification(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateNotification(id, body);
  }

  @Delete('notifications/:id')
  async deleteNotification(@Param('id') id: string) {
    return this.adminService.deleteNotification(id);
  }

  @Delete('chat-rooms/:id')
  async deleteChatRoom(@Param('id') id: string) {
    return this.adminService.deleteChatRoom(id);
  }

  @Delete('messages/:id')
  async deleteMessage(@Param('id') id: string) {
    return this.adminService.deleteMessage(id);
  }

  // ─── 웨딩 파트너 업체 (BusinessProfile) 관리 ─────────────────────────────
  @Get('businesses')
  async getBusinesses(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.adminService.getBusinesses({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      search,
      startDate,
      endDate,
    });
  }

  @Get('businesses/:id')
  async getBusinessDetail(@Param('id') id: string) {
    return this.adminService.getBusinessDetail(id);
  }

  @Post('businesses')
  async createBusiness(@Body() body: any) {
    return this.adminService.createBusiness(body);
  }

  @Patch('businesses/:id')
  async updateBusiness(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateBusiness(id, body);
  }

  @Delete('businesses/:id')
  async deleteBusiness(@Param('id') id: string) {
    return this.adminService.deleteBusiness(id);
  }

  @Post('businesses/:id/images')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadBusinessImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.adminService.uploadBusinessImage(id, file);
  }

  @Delete('businesses/:id/images/:imageId')
  async deleteBusinessImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    return this.adminService.deleteBusinessImage(id, imageId);
  }

  @Patch('businesses/:id/images/reorder')
  async reorderBusinessImages(
    @Param('id') id: string,
    @Body('ids') ids: string[],
  ) {
    return this.adminService.reorderBusinessImages(id, ids || []);
  }

  @Get('business-categories')
  async getBusinessCategories() {
    return this.adminService.getBusinessCategories();
  }
}
