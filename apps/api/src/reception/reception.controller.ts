import { BadRequestException, Body, Controller, Delete, Get, Header, Headers, HttpCode, Param, Post, Put, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReceptionService } from './reception.service';
import { ReceptionLiveService } from './reception-live.service';
import { ReceptionQuizService } from './reception-quiz.service';
import { PHOTO_MAX_BYTES, ReceptionEventKey, isReceptionEvent, isVoteKind, parseDeviceId, parseTableNo } from './reception.rules';

/**
 * 송년회(261108 사장 'Freetiful & WMAK 2026 Year-End RECEPTION') — 웹 /reception 의 이벤트·설문 탭.
 * 로그인 없음: 손님 = 머리글 X-RC-Device(브라우저가 만든 UUID) + 본문 name(자리 탭에서 입력한 이름). 401 은 내지 않는다.
 * 본문은 인터페이스로 받아 서비스가 직접 검사한다(전역 ValidationPipe 의 forbidNonWhitelisted 를 피해 — game.dto.ts 와 같은 이유).
 */
@ApiTags('reception')
@Controller('reception/:eventKey')
export class ReceptionController {
  constructor(
    private readonly reception: ReceptionService,
    private readonly live: ReceptionLiveService,
    private readonly quizzes: ReceptionQuizService,
  ) {}

  private event(eventKey: string): ReceptionEventKey {
    if (!isReceptionEvent(eventKey)) throw new BadRequestException('없는 행사예요.');
    return eventKey;
  }

  private device(raw?: string): string {
    const id = parseDeviceId(raw);
    if (!id) throw new BadRequestException('기기 정보를 확인할 수 없어요. 새로고침해 주세요.');
    return id;
  }

  @Get('photos')
  // 응답의 mine·liked 가 기기마다 다른데 주소는 같다 — 앞단·중간 캐시가 남의 상태를 돌려주지 않게
  @Header('Cache-Control', 'private, no-store')
  @Header('Vary', 'X-RC-Device')
  @ApiOperation({ summary: '송년회 이벤트 사진 목록(최신순, 공감 순위 포함) — 머리글 X-RC-Device 가 있으면 내 투표·남은 수' })
  photos(@Param('eventKey') eventKey: string, @Headers('x-rc-device') device?: string) {
    return this.reception.feed(this.event(eventKey), parseDeviceId(device));
  }

  @Post('photos')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: PHOTO_MAX_BYTES } }))
  @ApiOperation({ summary: '송년회 사진 올리기(기기당 1장) — multipart file + name' })
  upload(
    @Param('eventKey') eventKey: string,
    @Headers('x-rc-device') device: string,
    @Body() body: { name?: string },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.reception.upload(this.event(eventKey), this.device(device), body?.name, file);
  }

  @Delete('photos/:id')
  @ApiOperation({ summary: '내 사진 지우기(받은 좋아요·공감도 같이 지움)' })
  remove(@Param('eventKey') eventKey: string, @Param('id') id: string, @Headers('x-rc-device') device: string) {
    return this.reception.remove(this.event(eventKey), this.device(device), id);
  }

  @Post('photos/:id/votes')
  @HttpCode(200)
  @ApiOperation({ summary: '좋아요·공감 누르기/거두기 — { kind: like|empathy, on: boolean }, 종류별 한 사람 10개까지' })
  vote(
    @Param('eventKey') eventKey: string,
    @Param('id') id: string,
    @Headers('x-rc-device') device: string,
    @Body() body: { kind?: string; on?: boolean },
  ) {
    if (!isVoteKind(body?.kind)) throw new BadRequestException('좋아요 또는 공감만 누를 수 있어요.');
    return this.reception.vote(this.event(eventKey), this.device(device), id, body.kind, body?.on !== false);
  }

  @Put('guest')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary:
      '손님 남기기 + 내 자리·응모권 — 자리 탭에서 넣은 이름(기기당 1줄). 명단 자리, 발급 열림이면 럭키드로우 응모권(이름당 1장)·당첨. 응답 ok 는 예전 그대로',
  })
  guest(@Param('eventKey') eventKey: string, @Headers('x-rc-device') device: string, @Body() body: { name?: string }) {
    return this.live.guest(this.event(eventKey), this.device(device), body?.name);
  }

  @Get('quiz')
  // 모든 손님 같은 내용 + table 별 mine — 앞단 캐시가 지난 상태를 돌려주지 않게
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: '송년회 퀴즈 — 진행 상태·문제(정답 없음)·공개된 문제의 테이블 답·점수판. ?table=1~19 면 우리 테이블 답(mine)' })
  quiz(@Param('eventKey') eventKey: string, @Query('table') table?: string) {
    return this.quizzes.publicView(this.event(eventKey), parseTableNo(table));
  }

  @Put('quiz/answer')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: '퀴즈 답 내기 — { questionId, table, answer, name }. 열린 문제만, 테이블당 1개(나중 답이 덮어씀)' })
  answer(
    @Param('eventKey') eventKey: string,
    @Headers('x-rc-device') device: string,
    @Body() body: { questionId?: string; table?: number; answer?: unknown; name?: string },
  ) {
    return this.quizzes.answer(this.event(eventKey), this.device(device), body || {});
  }

  @Get('survey')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: '내 설문 답(없으면 null)' })
  survey(@Param('eventKey') eventKey: string, @Headers('x-rc-device') device: string) {
    return this.reception.getSurvey(this.event(eventKey), this.device(device));
  }

  @Put('survey')
  @ApiOperation({ summary: '설문 내기(기기당 1건, 다시 내면 덮어씀)' })
  saveSurvey(@Param('eventKey') eventKey: string, @Headers('x-rc-device') device: string, @Body() body: { name?: string; answers?: unknown }) {
    return this.reception.saveSurvey(this.event(eventKey), this.device(device), body?.name, body?.answers);
  }
}
