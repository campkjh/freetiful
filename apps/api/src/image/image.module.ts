import { Global, Module } from '@nestjs/common';
import { ImageService } from './image.service';
import { UploadController } from './upload.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [UploadController],
  providers: [ImageService],
  exports: [ImageService],
})
export class ImageModule {}
