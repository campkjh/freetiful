import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BannerService } from './banner.service';
import { AdminGuard } from '../common/guards/admin.guard';

@ApiTags('banners')
@Controller(['banners', 'api/v1/banners'])
export class BannerController {
  constructor(private service: BannerService) {}

  // 공개: 활성 배너만 반환 (홈/웨딩파트너 배너에서 사용)
  @Get()
  async list(@Query('placement') placement?: string) {
    return this.service.listActive(placement);
  }
}

@ApiTags('admin')
@UseGuards(AdminGuard)
@Controller(['admin/banners', 'api/v1/admin/banners'])
export class AdminBannerController {
  constructor(private service: BannerService) {}

  @Get()
  async listAll(@Query('placement') placement?: string) {
    return this.service.listAll(placement);
  }

  @Post()
  async create(@Body() body: any) {
    return this.service.create(body);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
