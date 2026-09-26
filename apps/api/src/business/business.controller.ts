import { Controller, Get, Header, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { BusinessService } from './business.service';
import { BusinessImageToneService, type ToneMode } from './business-image-tone.service';

@ApiTags('business')
@Controller('business')
export class BusinessController {
  constructor(
    private readonly businessService: BusinessService,
    private readonly imageTone: BusinessImageToneService,
  ) {}

  @Get()
  @Header('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=1800')
  @ApiOperation({ summary: '업체 목록 조회' })
  getBusinesses(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
    @Query('category') category?: string,
  ) {
    return this.businessService.getBusinesses(+page, +limit, search, category);
  }

  // ':id' 보다 먼저 — 아니면 'image-tone' 이 업체 id 로 잡힌다
  @Get('image-tone')
  @ApiOperation({ summary: '업체 사진 색(홈 카드 바탕색) — 등록된 업체 사진만' })
  async getImageTone(
    @Query('src') src: string,
    @Query('mode') mode: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const toneMode: ToneMode = mode === 'portrait' ? 'portrait' : 'scene';
    const { tone, known } = await this.imageTone.getTone(String(src || ''), toneMode);
    // 뽑힌 색은 일주일, 못 뽑았으면(받기 실패) 한 시간만 기억
    res.setHeader('Cache-Control', tone ? 'public, max-age=604800, s-maxage=604800' : `public, max-age=${known ? 3600 : 600}`);
    return { data: tone };
  }

  @Get(':id')
  @Header('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=1800')
  @ApiOperation({ summary: '업체 상세 조회' })
  getBusinessDetail(@Param('id') id: string) {
    return this.businessService.getBusinessDetail(id);
  }
}
