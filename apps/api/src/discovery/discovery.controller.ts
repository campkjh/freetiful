import { Controller, Get, Header, Param, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DiscoveryService } from './discovery.service';

@ApiTags('discovery')
@Controller('discovery')
export class DiscoveryController {
  constructor(private discovery: DiscoveryService) {}

  @Get('recommendation/daily')
  @Header('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200')
  @ApiOperation({ summary: '오늘의 추천 전문가' })
  getDailyRecommendation() {
    return this.discovery.getDailyRecommendation();
  }

  @Get('pros')
  @ApiOperation({ summary: '전문가 목록 (검색, 필터, 정렬)' })
  getProList(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('sort') sort?: 'rating' | 'reviews' | 'price' | 'experience' | 'pudding',
    @Query('gender') gender?: string,
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
    @Query('featured') featured?: boolean,
    @Query('region') region?: string,
    @Query('withTotal') withTotal?: string,
    @Res({ passthrough: true }) res?: any,
  ) {
    if (sort === 'pudding') {
      res?.setHeader('Cache-Control', 'no-store, max-age=0');
    } else {
      res?.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
    }
    return this.discovery.getProList({
      page,
      limit,
      search,
      sort,
      gender,
      minPrice,
      maxPrice,
      featured,
      region,
      withTotal: String(withTotal) !== 'false',
    });
  }

  @Get('pros/:id')
  @Header('Cache-Control', 'public, s-maxage=180, stale-while-revalidate=600')
  @ApiOperation({ summary: '전문가 상세 조회' })
  getProDetail(@Param('id') id: string, @Query('nocache') nocache?: string) {
    if (nocache === '1') this.discovery.invalidateCache(id);
    return this.discovery.getProDetail(id);
  }
}
