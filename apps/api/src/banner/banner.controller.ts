import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BannerService } from './banner.service';
import { AdminGuard } from '../common/guards/admin.guard';

@ApiTags('banners')
@Controller(['banners', 'api/v1/banners'])
export class BannerController {
  constructor(private service: BannerService) {}

  // 공개: 활성 배너만 반환 (홈 StackBanner 에서 사용)
  @Get()
  async list() {
    return this.service.listActive();
  }
}

@ApiTags('admin')
@UseGuards(AdminGuard)
@Controller(['admin/banners', 'api/v1/admin/banners'])
export class AdminBannerController {
  constructor(private service: BannerService) {}

  @Get()
  async listAll() {
    return this.service.listAll();
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
