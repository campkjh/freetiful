import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      // DB 커넥션 풀 워밍업
      const start = Date.now();
      await this.$queryRaw`SELECT 1`;
      this.logger.log(`DB connection warmed up in ${Date.now() - start}ms`);
    } catch (error) {
      this.logger.warn(
        `DB warmup failed; continuing startup and Prisma will retry on demand. ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  // DB 커넥션 풀 상시 워밍 — 25초마다 가벼운 쿼리.
  // 원인: 풀이 유휴로 식으면 쿼리당 커넥션 재수립 비용(~2-3초)이 붙어
  //   새요청/방생성 등 인증 DB 경로가 11~22초까지 느려짐(기기 [ft.perf] 실측).
  //   컨테이너는 항상 떠있으므로(health 빠름) 내부 크론이 외부 핑보다 확실.
  @Interval(25000)
  async keepConnectionWarm() {
    try {
      await this.$queryRaw`SELECT 1`;
    } catch {
      // 일시 실패는 무시 — 다음 주기에 재시도
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
