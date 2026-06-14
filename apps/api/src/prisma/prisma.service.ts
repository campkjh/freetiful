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

  // DB 커넥션 풀 워밍 — 20초마다 단일 가벼운 쿼리.
  // 주의: 병렬 N개로 데우려다 작은 풀(Supabase)을 keepalive 가 점유 → 요청과 경쟁해
  //   오히려 P2024(풀 타임아웃, 500) 유발했음. 동시성 0 인 단일 쿼리로 유지.
  // 30초 주기 — 커넥션 풀 워밍(DB 동일리전 이전 후 비용 작아 보수적 주기).
  @Interval(30000)
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
