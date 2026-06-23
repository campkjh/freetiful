import { Controller, Get, Param, Req, Res, NotFoundException } from '@nestjs/common';
import { Request, Response } from 'express';
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
  async serve(@Param('id') rawId: string, @Req() req: Request, @Res() res: Response) {
    // 파일명이 .webp / .jpg / .mp4 확장자를 달고 올 수 있으니 제거
    const id = rawId.replace(/\.[a-z0-9]+$/i, '');
    const file = await this.prisma.uploadedFile.findUnique({
      where: { id },
      select: { data: true, mimeType: true },
    });
    if (!file) throw new NotFoundException('파일을 찾을 수 없습니다');

    const buf = Buffer.from(file.data);
    const mime = file.mimeType || 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    // iOS WebKit 은 <video> 재생 시 Range 요청을 보내고, 206(부분응답)이 없으면 재생을 거부한다
    // → 동영상 말풍선이 빈칸으로 뜨던 원인. Range 를 지원해 부분 응답을 돌려준다.
    res.setHeader('Accept-Ranges', 'bytes');
    // 동영상은 공유 CDN(Vercel)이 전체를 캐시한 뒤 Range 요청에 200+부분바디로 응답해
    // iOS 가 "100바이트짜리 영상"으로 오인 → 재생 실패. 그래서 영상은 CDN 캐시를 끄고
    // 항상 origin 이 직접 206 을 돌려주게 한다. (이미지는 그대로 장기 캐시)
    if (mime.startsWith('video/')) {
      res.setHeader('Cache-Control', 'no-store');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }

    const rangeHeader = req.headers.range;
    if (rangeHeader) {
      const m = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
      if (m) {
        const start = m[1] ? parseInt(m[1], 10) : 0;
        const end = m[2] ? parseInt(m[2], 10) : buf.length - 1;
        const s = Math.max(0, start);
        const e = Math.min(end, buf.length - 1);
        if (Number.isNaN(s) || Number.isNaN(e) || s > e) {
          res.status(416).setHeader('Content-Range', `bytes */${buf.length}`).end();
          return;
        }
        res.status(206);
        res.setHeader('Content-Range', `bytes ${s}-${e}/${buf.length}`);
        res.setHeader('Content-Length', String(e - s + 1));
        res.end(buf.subarray(s, e + 1));
        return;
      }
    }

    res.setHeader('Content-Length', String(buf.length));
    res.end(buf);
  }
}
