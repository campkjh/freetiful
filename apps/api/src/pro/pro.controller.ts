import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { ProService } from './pro.service';
import { UpdateProProfileDto } from './dto/pro.dto';

@ApiTags('pro')
@Controller('pro')
export class ProController {
  constructor(private readonly proService: ProService) {}

  // ─── My Profile ──────────────────────────────────────────────────────────

  @Get('profile')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 프로 프로필 조회 (images/services/faqs/categories 포함)' })
  getMyProfile(@Req() req) {
    return this.proService.getProfile(req.user.id);
  }

  @Put('profile')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 프로 프로필 업데이트 (없으면 draft 생성)' })
  updateMyProfile(@Req() req, @Body() dto: UpdateProProfileDto) {
    return this.proService.updateProfile(req.user.id, dto);
  }

  @Post('profile')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 프로 프로필 생성 (draft)' })
  createMyProfile(@Req() req) {
    return this.proService.createProfile(req.user.id);
  }

  // ─── Registration ────────────────────────────────────────────────────────

  @Post('register')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: '파트너 신청 제출 — proProfile 생성/업데이트 후 status=pending' })
  submitRegistration(
    @Req() req,
    @Body()
    body: {
      name?: string;
      phone?: string;
      gender?: string;
      shortIntro?: string;
      mainExperience?: string;
      careerYears?: number;
      awards?: string;
      youtubeUrl?: string;
      detailHtml?: string;
      photos?: string[];
      mainPhotoIndex?: number;
      services?: { title: string; description?: string; basePrice?: number }[];
      faqs?: { question: string; answer: string }[];
      languages?: string[];
    },
  ) {
    return this.proService.submitRegistration(req.user.id, body);
  }

  // ─── Profile Images ──────────────────────────────────────────────────────

  @Post('profile/images')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: '프로필 이미지 업로드 (WebP 변환 + 얼굴 인식)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadImage(
    @Req() req,
    @UploadedFile() file: Express.Multer.File,
    @Body('brightness') brightness?: string,
    @Body('contrast') contrast?: string,
    @Body('saturation') saturation?: string,
    @Body('sharpen') sharpen?: string,
    @Body('cropX') cropX?: string,
    @Body('cropY') cropY?: string,
    @Body('cropWidth') cropWidth?: string,
    @Body('cropHeight') cropHeight?: string,
  ) {
    return this.proService.uploadImage(req.user.id, file, {
      brightness: brightness ? parseFloat(brightness) : undefined,
      contrast: contrast ? parseFloat(contrast) : undefined,
      saturation: saturation ? parseFloat(saturation) : undefined,
      sharpen: sharpen === 'true',
      cropX: cropX ? parseFloat(cropX) : undefined,
      cropY: cropY ? parseFloat(cropY) : undefined,
      cropWidth: cropWidth ? parseFloat(cropWidth) : undefined,
      cropHeight: cropHeight ? parseFloat(cropHeight) : undefined,
    });
  }

  @Get('profile/images')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: '프로필 이미지 목록 조회' })
  getImages(@Req() req) {
    return this.proService.getImages(req.user.id);
  }

  @Delete('profile/images/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: '프로필 이미지 삭제' })
  deleteImage(@Req() req, @Param('id') id: string) {
    return this.proService.deleteImage(req.user.id, id);
  }

  @Put('profile/images/reorder')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: '프로필 이미지 순서 변경' })
  reorderImages(@Req() req, @Body('ids') ids: string[]) {
    return this.proService.reorderImages(req.user.id, ids);
  }

  @Put('profile/images/:id/adjust')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: '프로필 이미지 보정 (밝기/대비/채도/자르기)' })
  adjustImage(
    @Req() req,
    @Param('id') id: string,
    @Body() body: {
      brightness?: number;
      contrast?: number;
      saturation?: number;
      sharpen?: boolean;
      cropX?: number;
      cropY?: number;
      cropWidth?: number;
      cropHeight?: number;
    },
  ) {
    return this.proService.adjustImage(req.user.id, id, body);
  }

  // ─── Schedule ─────────────────────────────────────────────────────────────

  @Get('schedule')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 스케줄 조회 (월별)' })
  getSchedule(@Req() req, @Query('month') month: string) {
    return this.proService.getSchedule(req.user.id, month);
  }

  @Put('schedule/:date')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: '스케줄 날짜 업데이트' })
  updateScheduleDate(
    @Req() req,
    @Param('date') date: string,
    @Body() body: { status: 'available' | 'unavailable' | 'booked'; eventTitle?: string; eventLocation?: string },
  ) {
    return this.proService.updateScheduleDate(req.user.id, date, body);
  }

  @Get(':proProfileId/booked-dates')
  @ApiOperation({ summary: '전문가 예약된 날짜 조회 (공개)' })
  getBookedDates(@Param('proProfileId') proProfileId: string) {
    return this.proService.getBookedDates(proProfileId);
  }

  // ─── Revenue ──────────────────────────────────────────────────────────────

  @Get('revenue')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: '사회자 수익 현황' })
  getRevenue(@Req() req) {
    return this.proService.getRevenue(req.user.id);
  }

  // ─── Profile View Increment ───────────────────────────────────────────────

  @Post(':proProfileId/view')
  @ApiOperation({ summary: '프로필 조회 카운트 증가' })
  incrementView(@Param('proProfileId') proProfileId: string) {
    return this.proService.incrementProfileView(proProfileId);
  }

  // ─── Schedule Requests (고객이 구매한 대기중 요청) ─────────────────────────

  @Get('schedule-requests')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: '내게 들어온 대기중 스케줄 요청 목록' })
  getScheduleRequests(@Req() req) {
    return this.proService.getScheduleRequests(req.user.id);
  }

  @Post('schedule-requests/:id/accept')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: '스케줄 요청 수락' })
  acceptScheduleRequest(@Req() req, @Param('id') id: string) {
    return this.proService.acceptScheduleRequest(req.user.id, id);
  }

  @Post('schedule-requests/:id/reject')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: '스케줄 요청 거절' })
  rejectScheduleRequest(
    @Req() req,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.proService.rejectScheduleRequest(req.user.id, id, reason);
  }
}
