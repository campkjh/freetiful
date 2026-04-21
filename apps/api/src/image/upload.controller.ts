import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

// DB 에 저장된 업로드 파일을 /uploads/:id 경로로 서빙.
// 글로벌 prefix 'api/v1' 을 우회하기 위해 두 경로 모두 등록:
//   /uploads/:id        (main.ts 에서 prefix 제외되는 경우)
//   /api/v1/uploads/:id (prefix 적용될 때)
// 둘 다 히트해야 프론트가 /uploads/xxx 로 요청했을 때 정상 응답.
@Controller(['uploads', 'api/v1/uploads'])
export class UploadController {
  constructor(private prisma: PrismaService) {}

  @Get(':id')
  async serve(@Param('id') rawId: string, @Res() res: Response) {
    // 파일명이 .webp / .jpg 확장자를 달고 올 수 있으니 제거
    const id = rawId.replace(/\.[a-z0-9]+$/i, '');
    const file = await this.prisma.uploadedFile.findUnique({
      where: { id },
      select: { data: true, mimeType: true },
    });
    if (!file) throw new NotFoundException('파일을 찾을 수 없습니다');
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.end(Buffer.from(file.data));
  }
}
