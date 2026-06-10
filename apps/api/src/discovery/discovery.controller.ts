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
    @Query('sort') sort?: 'rating' | 'reviews' | 'price' | 'experience',
    @Query('gender') gender?: string,
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
    @Query('featured') featured?: boolean,
    @Query('region') region?: string,
    @Query('withTotal') withTotal?: string,
    @Res({ passthrough: true }) res?: any,
  ) {
    // 프로필 수정 반영 지연 최소화 — CDN 캐시 짧게(서버 인메모리 5분 캐시가 부하 흡수)
    res?.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
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
  @Header('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120')
  @ApiOperation({ summary: '전문가 상세 조회' })
  getProDetail(@Param('id') id: string, @Query('nocache') nocache?: string) {
    if (nocache === '1') this.discovery.invalidateCache(id);
    return this.discovery.getProDetail(id);
  }
}
