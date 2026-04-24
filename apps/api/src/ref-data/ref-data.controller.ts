import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RefDataService } from './ref-data.service';

@ApiTags('ref-data')
@Controller('ref-data')
export class RefDataController {
  constructor(private refData: RefDataService) {}

  @Get('match-options')
  @ApiOperation({ summary: '매칭 요청 화면 선택지 조회' })
  getMatchOptions() {
    return this.refData.getMatchOptions();
  }
}
