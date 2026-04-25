import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AdminGuard } from '../common/guards/admin.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminPolicyController, PolicyController } from './policy.controller';
import { PolicyService } from './policy.service';

@Module({
  imports: [PrismaModule, JwtModule.register({}), ConfigModule],
  controllers: [PolicyController, AdminPolicyController],
  providers: [PolicyService, AdminGuard],
  exports: [PolicyService],
})
export class PolicyModule {}
