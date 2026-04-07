import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { ProService } from './pro.service';

@ApiTags('pro')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('pro')
export class ProController {
  constructor(private readonly proService: ProService) {}

  // ─── Profile Images ──────────────────────────────────────────────────────

  @Post('profile/images')
  @ApiOperation({ summary: '프로필 이미지 업로드 (WebP 변환 + 얼굴 인식)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadImage(
    @Req() req,
    @UploadedFile() file: Express.Multer.File,
    @Body('brightness') brightness?: string,
    @Body('contrast') contrast?: string,
    @Body('saturation') saturation?: string,
    @Body('sharpen') sharpen?: string,
    @Body('cropX') cropX?: string,
    @Body('cropY') cropY?: string,
    @Body('cropWidth') cropWidth?: string,
    @Body('cropHeight') cropHeight?: string,
  ) {
    return this.proService.uploadImage(req.user.id, file, {
      brightness: brightness ? parseFloat(brightness) : undefined,
      contrast: contrast ? parseFloat(contrast) : undefined,
      saturation: saturation ? parseFloat(saturation) : undefined,
      sharpen: sharpen === 'true',
      cropX: cropX ? parseFloat(cropX) : undefined,
      cropY: cropY ? parseFloat(cropY) : undefined,
      cropWidth: cropWidth ? parseFloat(cropWidth) : undefined,
      cropHeight: cropHeight ? parseFloat(cropHeight) : undefined,
    });
  }

  @Get('profile/images')
  @ApiOperation({ summary: '프로필 이미지 목록 조회' })
  getImages(@Req() req) {
    return this.proService.getImages(req.user.id);
  }

  @Delete('profile/images/:id')
  @ApiOperation({ summary: '프로필 이미지 삭제' })
  deleteImage(@Req() req, @Param('id') id: string) {
    return this.proService.deleteImage(req.user.id, id);
  }

  @Put('profile/images/reorder')
  @ApiOperation({ summary: '프로필 이미지 순서 변경' })
  reorderImages(@Req() req, @Body('ids') ids: string[]) {
    return this.proService.reorderImages(req.user.id, ids);
  }

  @Put('profile/images/:id/adjust')
  @ApiOperation({ summary: '프로필 이미지 보정 (밝기/대비/채도/자르기)' })
  adjustImage(
    @Req() req,
    @Param('id') id: string,
    @Body() body: {
      brightness?: number;
      contrast?: number;
      saturation?: number;
      sharpen?: boolean;
      cropX?: number;
      cropY?: number;
      cropWidth?: number;
      cropHeight?: number;
    },
  ) {
    return this.proService.adjustImage(req.user.id, id, body);
  }
}
