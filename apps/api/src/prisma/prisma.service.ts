import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
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

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
