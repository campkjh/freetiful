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
  Logger,
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
  private readonly logger = new Logger(AdminController.name);

  constructor(private adminService: AdminService) {}

  private getFallbackStats() {
    const now = Date.now();
    const kstOffset = 9 * 60 * 60 * 1000;
    const dayMs = 24 * 60 * 60 * 1000;
    const dailySeries = Array.from({ length: 14 }, (_, idx) => {
      const key = new Date(now + kstOffset - (13 - idx) * dayMs).toISOString().slice(5, 10).replace('-', '.');
      return { date: key, users: 0, matchRequests: 0, payments: 0, chats: 0, messages: 0, revenue: 0 };
    });
    const zeroStatus = { pending: 0, completed: 0, cancelled: 0, settled: 0 };

    return {
      totalUsers: 0,
      allUsers: 0,
      activeUsers: 0,
      inactiveUsers: 0,
      bannedUsers: 0,
      newUsersToday: 0,
      newUsers7d: 0,
      newUsers30d: 0,
      userRoles: { general: 0, pro: 0, business: 0, admin: 0 },
      totalPros: 0,
      pendingPros: 0,
      totalReviews: 0,
      visibleReviews: 0,
      thisMonthRevenue: 0,
      totalRevenue: 0,
      revenue: { today: 0, last7d: 0, last30d: 0, thisMonth: 0, total: 0 },
      profiles: {
        proViews: 0,
        businessViews: 0,
        totalViews: 0,
        avgRating: 0,
        avgResponseRate: 0,
        proStatus: { approved: 0, pending: 0, draft: 0, rejected: 0, suspended: 0 },
        businessTotal: 0,
        businessStatus: { approved: 0, pending: 0, draft: 0, rejected: 0 },
      },
      engagement: {
        chatRooms: 0,
        chatRooms7d: 0,
        messages: 0,
        messages7d: 0,
        notifications: 0,
        unreadNotifications: 0,
        sentPushNotifications: 0,
        activePushTokens: 0,
        pushSubscriptions: 0,
      },
      funnel: {
        profileViews: 0,
        matchRequests: 0,
        deliveries: 0,
        viewedDeliveries: 0,
        repliedDeliveries: 0,
        chatRooms: 0,
        quotations: 0,
        paidQuotations: 0,
        payments: 0,
        completedPayments: 0,
        reviews: 0,
      },
      rates: {
        chatCtr: 0,
        deliveryViewRate: 0,
        deliveryReplyRate: 0,
        quotationPaidRate: 0,
        paymentSuccessRate: 0,
        reviewWriteRate: 0,
        pushSendRate: 0,
      },
      matchRequests: { total: 0, open: 0, matched: 0, cancelled: 0, expired: 0 },
      quotations: { total: 0, pending: 0, accepted: 0, paid: 0, cancelled: 0, refunded: 0, expired: 0 },
      payments: { total: 0, pending: 0, completed: 0, failed: 0, refunded: 0, escrowed: 0, settled: 0, completedAmount: 0, refundedAmount: 0 },
      settlements: { ...zeroStatus, pendingAmount: 0, settledAmount: 0 },
      dailySeries,
      topLists: { viewedPros: [], revenuePros: [] },
      degraded: true,
    };
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

  @Get('stats')
  async getStats() {
    try {
      return await this.adminService.getStats();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Admin stats failed: ${message}`);
      return this.getFallbackStats();
    }
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

  @Get('referral-event')
  async getReferralEventParticipants(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getReferralEventParticipants({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      search,
      status,
    });
  }

  @Patch('referral-event/claims/:id')
  async updateReferralEventClaim(
    @Param('id') id: string,
    @Body() body: { status?: string; adminNote?: string },
  ) {
    return this.adminService.updateReferralEventClaim(id, body);
  }

  @Post('cleanup-empty-profiles')
  async cleanupEmptyProfiles() {
    return this.adminService.cleanupEmptyProProfiles();
  }

  /** 구 /auth/kakao/mobile 쉼이 만든 합성 이메일 유저(kakao_{id}@kakao.freetiful.com) 목록 + 매칭되는 native 계정 정보 */
  @Get('legacy-kakao-pairs')
  async listLegacyKakaoPairs() {
    return this.adminService.listLegacyKakaoPairs();
  }

  /** 모든 레거시 카카오 합성 계정 → 매칭되는 native 계정으로 일괄 합병 (채팅/결제/견적 이관) */
  @Post('legacy-kakao-pairs/merge-all')
  async mergeAllLegacyKakaoPairs() {
    return this.adminService.mergeAllLegacyKakaoPairs();
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

  // 리치텍스트 에디터(상세페이지 HTML) 인라인 이미지 업로드
  @Post('editor-images')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async uploadEditorImage(@UploadedFile() file: Express.Multer.File) {
    return this.adminService.uploadEditorImage(file);
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

  // 채팅 매칭 현황 (사회자↔유저 연결/채팅 + 매칭률)
  @Get('chat-connections')
  async getChatConnections(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.adminService.getChatConnections({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      search,
      status,
      startDate,
      endDate,
    });
  }
}
