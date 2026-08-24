import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
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

  @Get('me/persona')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 자아(말투) 설정 조회' })
  getPersona(@Req() req: any) {
    return this.service.getMyPersona(req.user.id);
  }

  @Put('me/persona')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 자아(말투) 설정 저장' })
  savePersona(@Req() req: any, @Body() body: any) {
    return this.service.savePersona(req.user.id, body);
  }

  @Post('me/persona-draft')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '프로필로 자아 초안 자동 작성' })
  draftPersona(@Req() req: any) {
    return this.service.draftPersonaForMe(req.user.id);
  }

  @Post('me/rewrite')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 말투로 문구 다듬기 (폼에만 반영, 저장은 별도)' })
  rewrite(@Req() req: any, @Body() body: { text?: string }) {
    return this.service.rewriteForMe(req.user.id, body?.text || '');
  }

  @Post('me/preview')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '이렇게 물어보면 뭐라고 답하는지 미리보기' })
  preview(@Req() req: any, @Body() body: { text?: string }) {
    return this.service.previewForMe(req.user.id, body?.text || '');
  }

  @Get(':proProfileId')
  @ApiOperation({ summary: '사회자 자동응답 질문 목록 (고객 화면용)' })
  getPublic(@Param('proProfileId') proProfileId: string) {
    return this.service.getPublic(proProfileId);
  }
}
