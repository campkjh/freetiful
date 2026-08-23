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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { ChatRealtimeService } from './chat-realtime.service';
import {
  CreateChatRoomDto,
  CreateRoomAsProDto,
  SendMessageDto,
  EditMessageDto,
  ReactToMessageDto,
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
  constructor(
    private readonly chatService: ChatService,
    private readonly chatRealtimeService: ChatRealtimeService,
  ) {}

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
  async sendMessage(@Req() req, @Param('roomId') roomId: string, @Body() dto: SendMessageDto) {
    const message = await this.chatService.sendMessage(roomId, req.user.id, dto);
    const knownMemberIds = Array.isArray((message as any).__participantIds)
      ? (message as any).__participantIds as string[]
      : null;
    Promise.resolve(knownMemberIds ?? this.chatService.getRoomMemberIds(roomId))
      .then((memberIds) => this.chatRealtimeService.emitPersistedMessage(roomId, message.id, {
        notifyUserIds: memberIds,
        roomUpdatedUserIds: memberIds,
        unreadUserIds: memberIds.filter((id) => id !== req.user.id),
        dashboardUserIds: memberIds,
      }))
      .catch(() => undefined);
    return message;
  }

  @Post('rooms/:roomId/auto-reply')
  @ApiOperation({ summary: '추천 질문 누르기 — 질문과 사회자 자동응답을 한 번에 남긴다' })
  sendAutoReply(@Req() req, @Param('roomId') roomId: string, @Body() body: { itemId: string }) {
    return this.chatService.sendAutoReply(roomId, req.user.id, String(body?.itemId || ''));
  }

  @Post('rooms/:roomId/images')
  @ApiOperation({ summary: '채팅 이미지 업로드' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadImage(
    @Req() req,
    @Param('roomId') roomId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.chatService.uploadImage(roomId, req.user.id, file);
  }

  // 채팅 미디어(사진/영상/파일) 멀티파트 업로드 → 공개 URL 반환.
  // base64 JSON POST 는 WKWebView(iOS 네이티브앱)가 큰 본문을 끊어 'request aborted' 나므로
  // 바이너리 멀티파트로 업로드해야 안정적. 업로드 후 클라가 content=URL 로 메시지를 보낸다.
  @Post('rooms/:roomId/media')
  @ApiOperation({ summary: '채팅 미디어(사진/영상/파일) 업로드' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 100 * 1024 * 1024 } }))
  uploadMedia(
    @Req() req,
    @Param('roomId') roomId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('type') type: string,
  ) {
    return this.chatService.uploadMedia(roomId, req.user.id, file, type);
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

  // ─── Photo Gallery ───────────────────────────────────────────────────────

  @Get('rooms/:roomId/photos')
  @ApiOperation({ summary: '채팅방 사진첩 (20일 후 자동 삭제)' })
  getPhotoGallery(@Req() req, @Param('roomId') roomId: string, @Query() query: PhotoGalleryQueryDto) {
    return this.chatService.getPhotoGallery(roomId, req.user.id, query);
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
