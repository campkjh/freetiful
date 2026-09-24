import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CommunityService } from './community.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';

@ApiTags('community')
@Controller('community')
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  private isAdmin(req: any) {
    return req.user?.role === 'admin';
  }

  // ── 카테고리 ──
  @Get('groups')
  @ApiOperation({ summary: '커뮤니티 카테고리(그룹/태그) 목록' })
  listGroups() {
    return this.community.listGroups();
  }

  @Get('tags')
  @ApiOperation({ summary: '태그 목록(그룹별)' })
  listTags(@Query('groupId') groupId?: string) {
    return this.community.listTags(groupId);
  }

  // ── 피드 ──
  @Get('posts')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: '피드 목록' })
  listPosts(
    @Request() req: any,
    @Query('groupId') groupId?: string,
    @Query('tagId') tagId?: string,
    @Query('q') q?: string,
    @Query('popular') popular?: string,
    @Query('sort') sort?: string,
  ) {
    return this.community.listPosts({ groupId, tagId, q, popular, sort, viewerId: req.user?.id });
  }

  @Post('posts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '글 작성' })
  createPost(@Request() req: any, @Body() body: any) {
    return this.community.createPost(req.user.id, body);
  }

  @Get('posts/:id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: '글 상세 + 댓글' })
  getPost(
    @Param('id') id: string,
    @Request() req: any,
    @Query('sort') sort?: string,
    @Query('track') track?: string,
  ) {
    return this.community.getPost(id, { viewerId: req.user?.id, sort, track: track === '1' });
  }

  @Patch('posts/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '글 수정' })
  updatePost(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.community.updatePost(id, req.user.id, this.isAdmin(req), body);
  }

  @Delete('posts/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '글 삭제' })
  deletePost(@Param('id') id: string, @Request() req: any) {
    return this.community.deletePost(id, req.user.id, this.isAdmin(req));
  }

  // ── 댓글 ──
  @Get('posts/:id/comments')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: '댓글 목록' })
  async listComments(@Param('id') id: string, @Request() req: any, @Query('sort') sort?: string) {
    const { comments } = await this.community.getPost(id, {
      viewerId: req.user?.id,
      sort,
      track: false,
    });
    return { comments, currentUserId: req.user?.id || null };
  }

  @Post('posts/:id/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '댓글 작성' })
  createComment(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.community.createComment(id, req.user.id, body);
  }

  // ── 리액션/투표/퀴즈/핀 ──
  @Post('posts/:id/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '글 리액션(6종)' })
  reactPost(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.community.reactPost(id, req.user.id, body?.type);
  }

  @Post('posts/:id/vote')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '투표' })
  vote(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.community.votePoll(id, req.user.id, body?.optionId);
  }

  @Post('posts/:id/quiz')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'OX 퀴즈 응답' })
  quiz(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.community.answerQuiz(id, req.user.id, body?.questionId, !!body?.answer);
  }

  @Post('posts/:id/pin')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '댓글 고정' })
  pin(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.community.pinComment(id, req.user.id, this.isAdmin(req), body?.commentId ?? null);
  }

  @Patch('comments/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '댓글 수정' })
  updateComment(@Param('id') id: string, @Request() req: any, @Body() body: any) {
    return this.community.updateComment(id, req.user.id, this.isAdmin(req), body?.content);
  }

  @Delete('comments/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '댓글 삭제' })
  deleteComment(@Param('id') id: string, @Request() req: any) {
    return this.community.deleteComment(id, req.user.id, this.isAdmin(req));
  }

  @Post('comments/:id/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '댓글 좋아요 토글' })
  likeComment(@Param('id') id: string, @Request() req: any) {
    return this.community.likeComment(id, req.user.id);
  }

  // ── 신고/차단 ──
  @Post('reports')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '신고' })
  report(@Request() req: any, @Body() body: any) {
    return this.community.createReport(req.user.id, body);
  }

  @Get('blocks')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '차단 목록' })
  listBlocks(@Request() req: any) {
    return this.community.listBlocks(req.user.id);
  }

  @Post('blocks')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '차단 토글' })
  toggleBlock(@Request() req: any, @Body() body: any) {
    return this.community.toggleBlock(req.user.id, body?.userId);
  }

  // ── 팔로우 ──
  @Post('follows')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '팔로우 토글' })
  toggleFollow(@Request() req: any, @Body() body: any) {
    return this.community.toggleFollow(req.user.id, body?.userId);
  }

  @Get('me/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '내가 댓글 단 글 목록' })
  myComments(@Request() req: any) {
    return this.community.myComments(req.user.id);
  }

  // ── 기타 ──
  @Get('latest')
  @ApiOperation({ summary: '최신 글 시각(새 글 배지용)' })
  latest() {
    return this.community.latest();
  }

  @Get('quiz-quota')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'OX 퀴즈 작성 가능 수' })
  quizQuota(@Request() req: any) {
    return this.community.quizQuota(req.user.id);
  }
}
