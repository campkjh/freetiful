import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RefDataService } from './ref-data.service';

@ApiTags('ref-data')
@Controller(['ref-data', 'api/v1/ref-data'])
export class RefDataController {
  constructor(private refData: RefDataService) {}

  @Get('match-options')
  @Header('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600')
  @ApiOperation({ summary: '매칭 요청 화면 선택지 조회' })
  getMatchOptions() {
    return this.refData.getMatchOptions();
  }
}
