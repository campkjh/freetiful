import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AdminGuard } from '../common/guards/admin.guard';
import { BusinessInquiryService } from './business-inquiry.service';

@ApiTags('business-inquiries')
@Controller(['business-inquiries', 'api/v1/business-inquiries'])
export class BusinessInquiryController {
  constructor(private service: BusinessInquiryService) {}

  @Post()
  async create(@Body() body: any, @Req() req: Request) {
    return this.service.create({
      ...body,
      metadata: {
        ...(body?.metadata && typeof body.metadata === 'object' ? body.metadata : {}),
        ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || null,
        userAgent: req.headers['user-agent'] || null,
      },
    });
  }
}

@ApiTags('admin')
@UseGuards(AdminGuard)
@Controller(['admin/business-inquiries', 'api/v1/admin/business-inquiries'])
export class AdminBusinessInquiryController {
  constructor(private service: BusinessInquiryService) {}

  @Get()
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.service.list({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      status,
      search,
      startDate,
      endDate,
    });
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
