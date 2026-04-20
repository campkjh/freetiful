import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { PlanTemplateService } from './plan-template.service';
import { PlanTemplateController, AdminPlanTemplateController } from './plan-template.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { DiscoveryModule } from '../discovery/discovery.module';
import { AdminGuard } from '../common/guards/admin.guard';

@Module({
  imports: [PrismaModule, DiscoveryModule, JwtModule.register({}), ConfigModule],
  controllers: [PlanTemplateController, AdminPlanTemplateController],
  providers: [PlanTemplateService, AdminGuard],
  exports: [PlanTemplateService],
})
export class PlanTemplateModule {}
