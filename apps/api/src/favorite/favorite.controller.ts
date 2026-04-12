import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FavoriteService } from './favorite.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('favorite')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('favorite')
export class FavoriteController {
  constructor(private favoriteService: FavoriteService) {}

  @Post(':proProfileId')
  toggleFavorite(
    @Request() req: any,
    @Param('proProfileId') proProfileId: string,
  ) {
    return this.favoriteService.toggleFavorite(req.user.id, proProfileId);
  }

  @Get()
  getFavorites(
    @Request() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.favoriteService.getFavorites(req.user.id, +page, +limit);
  }

  @Get(':proProfileId/check')
  isFavorited(
    @Request() req: any,
    @Param('proProfileId') proProfileId: string,
  ) {
    return this.favoriteService.isFavorited(req.user.id, proProfileId);
  }
}
