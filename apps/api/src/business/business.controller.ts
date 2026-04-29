import { Controller, Get, Header, Param, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { BusinessService } from './business.service';

@ApiTags('business')
@Controller('business')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Get()
  @Header('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=1800')
  @ApiOperation({ summary: '업체 목록 조회' })
  getBusinesses(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('region') region?: string,
    @Query('filters') filters?: string,
    @Query('mode') mode?: string,
  ) {
    return this.businessService.getBusinesses(+page, +limit, search, category, region, filters, mode);
  }

  @Get('image-proxy')
  @Header('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800')
  @ApiOperation({ summary: '업체 외부 이미지 프록시' })
  proxyBusinessImage(@Query('url') url: string, @Res() res: Response) {
    return this.businessService.proxyBusinessImage(url, res);
  }

  @Get(':id')
  @Header('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=1800')
  @ApiOperation({ summary: '업체 상세 조회' })
  getBusinessDetail(@Param('id') id: string) {
    return this.businessService.getBusinessDetail(id);
  }
}
