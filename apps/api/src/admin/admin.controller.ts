import { Controller, Post, Headers, ForbiddenException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';

@ApiTags('admin')
@Controller('api/v1/admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Post('seed-pros')
  async seedPros(@Headers('x-admin-key') key: string) {
    const adminKey = process.env.ADMIN_SECRET_KEY;
    if (!adminKey || key !== adminKey) {
      throw new ForbiddenException('Invalid admin key');
    }
    return this.adminService.seedPros();
  }
}
