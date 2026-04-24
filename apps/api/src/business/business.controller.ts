import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
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
  ) {
    return this.businessService.getBusinesses(+page, +limit, search);
  }

  @Get(':id')
  @Header('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=1800')
  @ApiOperation({ summary: '업체 상세 조회' })
  getBusinessDetail(@Param('id') id: string) {
    return this.businessService.getBusinessDetail(id);
  }
}
