import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // 외부 핑(UptimeRobot 등) / Railway 헬스체크가 호출.
  // DB까지 가볍게 깨워서 컨테이너+Postgres 둘 다 웜 유지 → 콜드스타트 방지.
  @Get()
  async health() {
    let db = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = true;
    } catch {
      db = false;
    }
    // DB가 일시적으로 죽어도 컨테이너는 살아있으므로 200(ok:true) 유지 (배포 헬스체크 실패 방지)
    return { ok: true, db, service: 'prettyful-api' };
  }
}
