import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AnnouncementService } from './announcement.service';
import { AdminGuard } from '../common/guards/admin.guard';

@ApiTags('announcements')
@Controller(['announcements', 'api/v1/announcements'])
export class AnnouncementController {
  constructor(private service: AnnouncementService) {}

  // 공개 목록 (게시된 공지만, 고정 → 최신순)
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
@Controller(['admin/announcements', 'api/v1/admin/announcements'])
export class AdminAnnouncementController {
  constructor(private service: AnnouncementService) {}

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
