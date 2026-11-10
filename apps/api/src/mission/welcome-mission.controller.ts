import { Body, Controller, Get, Header, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { WelcomeMissionService } from './welcome-mission.service';

/** 신규가입 5,000원 미션(261110) — 웹 /mission */
@ApiTags('mission')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('mission/welcome')
export class WelcomeMissionController {
  constructor(private readonly mission: WelcomeMissionService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: '미션 진행(출석 · 웨딩숲 글 · 견적)과 지급 신청 상태' })
  status(@Req() req: Request) {
    return this.mission.status((req.user as any).id);
  }

  @Post('checkin')
  @ApiOperation({ summary: '오늘 출석(KST 하루 한 번) — 처음이면 justCheckedIn' })
  checkin(@Req() req: Request) {
    return this.mission.checkin((req.user as any).id);
  }

  @Post('claim')
  @ApiOperation({ summary: '5,000원 지급 신청 — 연락처 · 은행 · 계좌번호 · 예금주' })
  claim(@Req() req: Request, @Body() body: unknown) {
    return this.mission.claim((req.user as any).id, body);
  }
}

/** 어드민 — 신규가입 미션 지급 신청 확인 · 보냄 처리 */
@ApiTags('admin-mission')
@UseGuards(AdminGuard)
@Controller(['admin/mission/welcome', 'api/v1/admin/mission/welcome'])
export class WelcomeMissionAdminController {
  constructor(private readonly mission: WelcomeMissionService) {}

  @Get('claims')
  @Header('Cache-Control', 'private, no-store')
  list(@Query('status') status?: string, @Query('q') q?: string) {
    return this.mission.adminList({ status, q });
  }

  @Patch('claims/:id')
  update(@Param('id') id: string, @Body() body: { status?: string; adminNote?: string }) {
    return this.mission.adminUpdate(id, body);
  }
}
