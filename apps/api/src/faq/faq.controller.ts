import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FaqService } from './faq.service';
import { AdminGuard } from '../common/guards/admin.guard';

@ApiTags('faqs')
@Controller(['faqs', 'api/v1/faqs'])
export class FaqController {
  constructor(private service: FaqService) {}

  // 공개 목록 — 카테고리별 그룹핑은 프론트에서
  @Get()
  async list() {
    return this.service.listPublished();
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.service.getPublishedById(id);
  }
}

@ApiTags('admin')
@UseGuards(AdminGuard)
@Controller(['admin/faqs', 'api/v1/admin/faqs'])
export class AdminFaqController {
  constructor(private service: FaqService) {}

  @Get()
  async listAll() {
    return this.service.listAll();
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.service.getById(id);
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
