import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../common/guards/admin.guard';
import { PolicyService } from './policy.service';

@ApiTags('policies')
@Controller(['policies', 'api/v1/policies'])
export class PolicyController {
  constructor(private service: PolicyService) {}

  @Get()
  async list() {
    return this.service.listPublished();
  }

  @Get(':slug')
  async detail(@Param('slug') slug: string) {
    return this.service.getPublished(slug);
  }
}

@ApiTags('admin')
@UseGuards(AdminGuard)
@Controller(['admin/policies', 'api/v1/admin/policies'])
export class AdminPolicyController {
  constructor(private service: PolicyService) {}

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
