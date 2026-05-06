import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DiscoveryModule } from '../discovery/discovery.module';
import { NotificationModule } from '../notification/notification.module';
import { ImageModule } from '../image/image.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [PrismaModule, DiscoveryModule, NotificationModule, ImageModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
