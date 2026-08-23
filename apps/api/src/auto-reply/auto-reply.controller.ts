import { Body, Controller, Get, Param, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AutoReplyService } from './auto-reply.service';

@ApiTags('auto-reply')
@Controller(['pro-auto-replies', 'api/v1/pro-auto-replies'])
export class AutoReplyController {
  constructor(private service: AutoReplyService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 자동응답 설정 조회 (사회자)' })
  getMine(@Req() req: any) {
    return this.service.getMine(req.user.id);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 자동응답 설정 저장 (사회자)' })
  saveMine(@Req() req: any, @Body() body: any) {
    return this.service.saveMine(req.user.id, body);
  }

  @Get(':proProfileId')
  @ApiOperation({ summary: '사회자 자동응답 질문 목록 (고객 화면용)' })
  getPublic(@Param('proProfileId') proProfileId: string) {
    return this.service.getPublic(proProfileId);
  }
}
