import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ReviewService } from './review.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('review')
@Controller('review')
export class ReviewController {
  constructor(private reviewService: ReviewService) {}

  /** 리뷰 작성 */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '리뷰 작성' })
  createReview(
    @Request() req: any,
    @Body()
    body: {
      paymentId: string;
      proProfileId: string;
      ratingSatisfaction: number;
      ratingComposition: number;
      ratingExperience: number;
      ratingAppearance: number;
      ratingVoice: number;
      ratingWit: number;
      comment?: string;
      photos?: string[];
      isAnonymous?: boolean;
    },
  ) {
    return this.reviewService.createReview(req.user.id, body);
  }

  /** 전문가의 리뷰 목록 (공개) */
  @Get('pro/:proProfileId')
  @ApiOperation({ summary: '전문가 리뷰 목록 조회' })
  getReviewsByPro(
    @Param('proProfileId') proProfileId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.reviewService.getReviewsByPro(proProfileId, +page, +limit);
  }

  /** 전문가가 리뷰에 답글 작성 */
  @Post(':reviewId/reply')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '리뷰 답글 작성 (전문가)' })
  replyToReview(
    @Request() req: any,
    @Param('reviewId') reviewId: string,
    @Body('reply') reply: string,
  ) {
    const proProfileId = req.user.proProfile?.id;
    return this.reviewService.replyToReview(proProfileId, reviewId, reply);
  }

  /** 내가 작성한 리뷰 목록 */
  @Get('mine')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '내 리뷰 목록 조회' })
  getMyReviews(
    @Request() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.reviewService.getMyReviews(req.user.id, +page, +limit);
  }
}
