import { BadRequestException, Body, Controller, Delete, Get, Header, HttpCode, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../common/guards/admin.guard';
import { ReceptionService } from './reception.service';
import { ReceptionLiveService } from './reception-live.service';
import { ReceptionQuizService } from './reception-quiz.service';
import { ReceptionPeopleService } from './reception-people.service';
import { ReceptionEventKey, isReceptionEvent } from './reception.rules';

/**
 * 어드민 — 송년회 참여자 · 설문 응답(261108 사장 'campkjh@nate.com 어드민에서 누가 참여했는지 누가 설문조사에 응답했는지'). AdminGuard = 총괄운영자 id 포함
 * + 2차(261122): 입장 현황(응모권) · 자리 명단 · 퀴즈 진행 · 럭키드로우. 새 경로는 ':eventKey/…' 로 두 칸 이상이라 ':eventKey' 하나와 겹치지 않는다.
 * + 3차(261122 사장 '참여자는 자리를 준 명단 전부 · 앱에 이름을 넣으면 실시간으로 맨 위'): 참여자 판(:eventKey/people). 어드민 '입장 현황' 탭은 없어지고
 *   발급 모드 · 응모권 지우기 · 지운 이름 풀기는 참여자 판으로 옮겼다(경로는 그대로, live 도 럭키드로우 화면이 아직 쓴다).
 */
@ApiTags('admin-reception')
@UseGuards(AdminGuard)
@Controller(['admin/reception', 'api/v1/admin/reception'])
export class ReceptionAdminController {
  constructor(
    private readonly reception: ReceptionService,
    private readonly live: ReceptionLiveService,
    private readonly quizzes: ReceptionQuizService,
    private readonly peopleBoard: ReceptionPeopleService,
  ) {}

  private event(eventKey: string): ReceptionEventKey {
    if (!isReceptionEvent(eventKey)) throw new BadRequestException('없는 행사예요.');
    return eventKey;
  }

  @Get(':eventKey')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: '참여자(이름·첫/마지막 접속·사진·누른 수·설문 여부) + 설문 응답 + 요약' })
  overview(@Param('eventKey') eventKey: string) {
    return this.reception.adminOverview(this.event(eventKey));
  }

  // ───────────── 참여자 판 ─────────────

  @Get(':eventKey/people')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: '참여자 판 — 자리 명단 전원 + 명단 밖 손님 · 도착(응모권) · 퀴즈 · 베스트드레서 · 설문 · 당첨 · 발급 모드 · 지운 이름 (?fresh=1 = 1초 묶음 건너뛰기)' })
  people(@Param('eventKey') eventKey: string, @Query('fresh') fresh?: string) {
    return this.peopleBoard.people(this.event(eventKey), fresh === '1' || fresh === 'true');
  }

  // ───────────── 입장 현황 · 자리 명단 · 응모권 ─────────────

  @Get(':eventKey/live')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: '입장 현황 — 응모권(=입장) 목록 · 명단 대조 · 테이블별 수 · 발급 모드' })
  liveView(@Param('eventKey') eventKey: string) {
    return this.live.live(this.event(eventKey));
  }

  @Put(':eventKey/seats')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: '자리 명단 통째로 바꾸기 — { rows: [{ name, table, seat? }] } (빈 배열 = 비우기, 400줄까지)' })
  putSeats(@Param('eventKey') eventKey: string, @Body() body: { rows?: unknown }) {
    return this.live.putSeats(this.event(eventKey), body?.rows);
  }

  // (261122 사장 '테이블배치 · 드래그엔 드롭으로 자리 위치 · 이름도 수정 · 인원도 추가') 어드민 테이블 배치 판 — 지금 DB 명단에 한 건만 적용
  @Post(':eventKey/seats/edit')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({
    summary:
      '자리 명단 한 건 고치기 — { op: move, nameKey, table, seat|null } · { op: swap, nameKey, otherKey } · { op: rename, nameKey, name } · { op: add, name, table, seat|null, ticketId? } · { op: remove, nameKey } (동시에 고쳐도 하나씩 · 동명이인 열쇠 다시 계산 · 응모권 열쇠도 따라감)',
  })
  editSeats(@Param('eventKey') eventKey: string, @Body() body: Record<string, unknown>) {
    return this.live.editSeats(this.event(eventKey), body);
  }

  @Post(':eventKey/tickets/mode')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: '응모권 발급 모드 — { mode: auto | open | closed } (auto = 행사 당일 15:00~다음 날 03:00)' })
  ticketsMode(@Param('eventKey') eventKey: string, @Body() body: { mode?: unknown }) {
    return this.live.setTicketsMode(this.event(eventKey), body?.mode);
  }

  @Delete(':eventKey/tickets/:id')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: '응모권 지우기(테스트·실수 정리 — 추첨 기록도 같이 지움). 지운 이름으로는 다시 안 나옴(blocked) — 풀려면 tickets/unblock' })
  deleteTicket(@Param('eventKey') eventKey: string, @Param('id') id: string) {
    return this.live.deleteTicket(this.event(eventKey), id);
  }

  @Post(':eventKey/tickets/unblock')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: '지운 이름 풀기 — { name } · 그 이름으로 다시 응모권을 받을 수 있게' })
  unblockTicket(@Param('eventKey') eventKey: string, @Body() body: { name?: unknown }) {
    return this.live.unblockTicket(this.event(eventKey), body?.name);
  }

  // ───────────── 퀴즈 ─────────────

  @Get(':eventKey/quiz')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: '퀴즈 진행판 — 상태 · 문제(정답 포함) · 문제별 테이블 답·채점 · 점수판(공개분/전체)' })
  quiz(@Param('eventKey') eventKey: string) {
    return this.quizzes.adminView(this.event(eventKey));
  }

  @Post(':eventKey/quiz/state')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: '퀴즈 진행 — { action: open|lock|reveal|unreveal|idle|board|reset, questionId?, on? }' })
  quizState(@Param('eventKey') eventKey: string, @Body() body: { action?: unknown; questionId?: unknown; on?: unknown }) {
    return this.quizzes.adminState(this.event(eventKey), body || {});
  }

  @Put(':eventKey/quiz/answer')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: '테이블 답·판정 고치기 — { questionId, table, answer?: string|null, correct?: boolean|null } (상태와 상관없이)' })
  quizAnswer(@Param('eventKey') eventKey: string, @Body() body: { questionId?: unknown; table?: unknown; answer?: unknown; correct?: unknown }) {
    return this.quizzes.adminAnswer(this.event(eventKey), body || {});
  }

  @Put(':eventKey/quiz/challenge')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: '미션 도전 판정 — { id: 도전 줄 id, result: success|fail|pending|cancel } (참여자 명단의 성공·실패 단추)' })
  quizChallenge(@Param('eventKey') eventKey: string, @Body() body: { id?: unknown; result?: unknown }) {
    return this.quizzes.judgeChallenge(this.event(eventKey), body || {});
  }

  // ───────────── 럭키드로우 ─────────────

  @Get(':eventKey/draws')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: '럭키드로우 — 경품별 남은 수 · 추첨 기록(최근 위) · 응모권 수 · 뽑을 수 있는 수' })
  draws(@Param('eventKey') eventKey: string) {
    return this.live.drawBoard(this.event(eventKey));
  }

  @Post(':eventKey/draws')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: '추첨하기 — { prize } · 한 번도 안 뽑힌 응모권 중 무작위 1장' })
  draw(@Param('eventKey') eventKey: string, @Body() body: { prize?: unknown }) {
    return this.live.draw(this.event(eventKey), body?.prize);
  }

  @Post(':eventKey/draws/batch')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: '경품의 남은 수량만큼 중복 없이 한 번에 추첨' })
  drawBatch(@Param('eventKey') eventKey: string, @Body() body: { prize?: unknown }) {
    return this.live.draw(this.event(eventKey), body?.prize, true);
  }

  @Post(':eventKey/draws/:id/cancel')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: '추첨 무효(자리에 없을 때) — 그 응모권은 다시 뽑지 않음' })
  cancelDraw(@Param('eventKey') eventKey: string, @Param('id') id: string) {
    return this.live.cancelDraw(this.event(eventKey), id);
  }

  @Post(':eventKey/draws/reset')
  @HttpCode(200)
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: '선택 행사 추첨 기록 전체 삭제 — 응모권과 자리 명단 유지' })
  resetDraws(@Param('eventKey') eventKey: string, @Body() body: { expectedIds?: unknown }) {
    return this.live.resetDraws(this.event(eventKey), body?.expectedIds);
  }
}
