import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PlanTemplateService } from './plan-template.service';
import { AdminGuard } from '../common/guards/admin.guard';

@ApiTags('plan-templates')
@Controller(['plan-templates', 'api/v1/plan-templates'])
export class PlanTemplateController {
  constructor(private service: PlanTemplateService) {}

  // 공개: 활성 템플릿만 반환 (pro-register/pricing 에서 사용)
  @Get()
  async list() {
    return this.service.listActive();
  }
}

@ApiTags('admin')
@UseGuards(AdminGuard)
@Controller(['admin/plan-templates', 'api/v1/admin/plan-templates'])
export class AdminPlanTemplateController {
  constructor(private service: PlanTemplateService) {}

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
