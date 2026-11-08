import { BadRequestException, Controller, Get, Header, Param, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../common/guards/admin.guard';
import { ReceptionService } from './reception.service';
import { isReceptionEvent } from './reception.rules';

/** 어드민 — 송년회 참여자 · 설문 응답(261108 사장 'campkjh@nate.com 어드민에서 누가 참여했는지 누가 설문조사에 응답했는지'). AdminGuard = 총괄운영자 id 포함 */
@ApiTags('admin-reception')
@UseGuards(AdminGuard)
@Controller(['admin/reception', 'api/v1/admin/reception'])
export class ReceptionAdminController {
  constructor(private readonly reception: ReceptionService) {}

  @Get(':eventKey')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: '참여자(이름·첫/마지막 접속·사진·누른 수·설문 여부) + 설문 응답 + 요약' })
  overview(@Param('eventKey') eventKey: string) {
    if (!isReceptionEvent(eventKey)) throw new BadRequestException('없는 행사예요.');
    return this.reception.adminOverview(eventKey);
  }
}
