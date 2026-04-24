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
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import {
  CreateChatRoomDto,
  CreateRoomAsProDto,
  SendMessageDto,
  EditMessageDto,
  ReactToMessageDto,
  CreateScheduledMessageDto,
  CreateFrequentMessageDto,
  UpdateFrequentMessageDto,
  ChatRoomQueryDto,
  MessageQueryDto,
  PhotoGalleryQueryDto,
} from './dto/chat.dto';

@ApiTags('chat')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // ─── Chat Rooms ──────────────────────────────────────────────────────────

  @Post('rooms')
  @ApiOperation({ summary: '채팅방 생성 (전문가에게 문의)' })
  createRoom(@Req() req, @Body() dto: CreateChatRoomDto) {
    return this.chatService.createRoom(req.user.id, dto);
  }

  @Post('rooms/pro-initiate')
  @ApiOperation({ summary: '전문가가 매칭 요청 기반으로 먼저 채팅 시작' })
  createRoomAsPro(@Req() req, @Body() dto: CreateRoomAsProDto) {
    return this.chatService.createRoomAsPro(req.user.id, dto);
  }

  @Get('rooms')
  @ApiOperation({ summary: '채팅방 목록 조회' })
  getRooms(@Req() req, @Query() query: ChatRoomQueryDto) {
    return this.chatService.getRooms(req.user.id, query);
  }

  @Get('rooms/:roomId')
  @ApiOperation({ summary: '채팅방 상세 조회' })
  getRoom(@Req() req, @Param('roomId') roomId: string) {
    return this.chatService.getRoomById(roomId, req.user.id);
  }

  @Delete('rooms/:roomId')
  @ApiOperation({ summary: '채팅방 삭제 (내 측에서만)' })
  deleteRoom(@Req() req, @Param('roomId') roomId: string) {
    return this.chatService.deleteRoom(roomId, req.user.id);
  }

  @Post('rooms/:roomId/favorite')
  @ApiOperation({ summary: '채팅방 즐겨찾기 토글' })
  toggleFavorite(@Req() req, @Param('roomId') roomId: string) {
    return this.chatService.toggleFavorite(roomId, req.user.id);
  }

  @Post('rooms/:roomId/read')
  @ApiOperation({ summary: '채팅방 읽음 처리' })
  markAsRead(@Req() req, @Param('roomId') roomId: string) {
    return this.chatService.markAsRead(roomId, req.user.id);
  }

  // ─── Messages ────────────────────────────────────────────────────────────

  @Get('rooms/:roomId/messages')
  @ApiOperation({ summary: '메시지 목록 조회 (커서 기반 페이지네이션)' })
  getMessages(@Req() req, @Param('roomId') roomId: string, @Query() query: MessageQueryDto) {
    return this.chatService.getMessages(roomId, req.user.id, query);
  }

  @Post('rooms/:roomId/messages')
  @ApiOperation({ summary: '메시지 전송' })
  sendMessage(@Req() req, @Param('roomId') roomId: string, @Body() dto: SendMessageDto) {
    return this.chatService.sendMessage(roomId, req.user.id, dto);
  }

  @Put('messages/:messageId')
  @ApiOperation({ summary: '메시지 수정' })
  editMessage(@Req() req, @Param('messageId') messageId: string, @Body() dto: EditMessageDto) {
    return this.chatService.editMessage(messageId, req.user.id, dto);
  }

  @Delete('messages/:messageId')
  @ApiOperation({ summary: '메시지 삭제' })
  deleteMessage(@Req() req, @Param('messageId') messageId: string) {
    return this.chatService.deleteMessage(messageId, req.user.id);
  }

  @Post('messages/:messageId/reactions')
  @ApiOperation({ summary: '메시지 리액션 토글 (하트, 슬퍼요, 최고, 웃겨요 등)' })
  addReaction(@Req() req, @Param('messageId') messageId: string, @Body() dto: ReactToMessageDto) {
    return this.chatService.addReaction(messageId, req.user.id, dto);
  }

  @Get('rooms/:roomId/search')
  @ApiOperation({ summary: '채팅방 내 메시지 검색' })
  searchMessages(@Req() req, @Param('roomId') roomId: string, @Query('q') q: string) {
    return this.chatService.searchMessages(roomId, req.user.id, q);
  }

  // ─── Photo Gallery ───────────────────────────────────────────────────────

  @Get('rooms/:roomId/photos')
  @ApiOperation({ summary: '채팅방 사진첩 (20일 후 자동 삭제)' })
  getPhotoGallery(@Req() req, @Param('roomId') roomId: string, @Query() query: PhotoGalleryQueryDto) {
    return this.chatService.getPhotoGallery(roomId, req.user.id, query);
  }

  // ─── Scheduled Messages ──────────────────────────────────────────────────

  @Post('rooms/:roomId/scheduled')
  @ApiOperation({ summary: '예약 메시지 생성' })
  createScheduled(@Req() req, @Param('roomId') roomId: string, @Body() dto: CreateScheduledMessageDto) {
    return this.chatService.createScheduledMessage(roomId, req.user.id, dto);
  }

  @Get('rooms/:roomId/scheduled')
  @ApiOperation({ summary: '예약 메시지 목록' })
  getScheduled(@Req() req, @Param('roomId') roomId: string) {
    return this.chatService.getScheduledMessages(roomId, req.user.id);
  }

  @Delete('scheduled/:id')
  @ApiOperation({ summary: '예약 메시지 삭제' })
  deleteScheduled(@Req() req, @Param('id') id: string) {
    return this.chatService.deleteScheduledMessage(id, req.user.id);
  }

  // ─── Frequent Messages ───────────────────────────────────────────────────

  @Get('frequent-messages')
  @ApiOperation({ summary: '자주 쓰는 메시지 목록' })
  getFrequentMessages(@Req() req) {
    return this.chatService.getFrequentMessages(req.user.id);
  }

  @Post('frequent-messages')
  @ApiOperation({ summary: '자주 쓰는 메시지 추가' })
  createFrequentMessage(@Req() req, @Body() dto: CreateFrequentMessageDto) {
    return this.chatService.createFrequentMessage(req.user.id, dto);
  }

  @Put('frequent-messages/:id')
  @ApiOperation({ summary: '자주 쓰는 메시지 수정' })
  updateFrequentMessage(@Req() req, @Param('id') id: string, @Body() dto: UpdateFrequentMessageDto) {
    return this.chatService.updateFrequentMessage(id, req.user.id, dto);
  }

  @Delete('frequent-messages/:id')
  @ApiOperation({ summary: '자주 쓰는 메시지 삭제' })
  deleteFrequentMessage(@Req() req, @Param('id') id: string) {
    return this.chatService.deleteFrequentMessage(id, req.user.id);
  }
}
