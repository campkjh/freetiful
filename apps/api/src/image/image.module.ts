import { Global, Module } from '@nestjs/common';
import { ImageService } from './image.service';
import { VideoCompressService } from './video-compress.service';
import { UploadController } from './upload.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [UploadController],
  providers: [ImageService, VideoCompressService],
  exports: [ImageService, VideoCompressService],
})
export class ImageModule {}
