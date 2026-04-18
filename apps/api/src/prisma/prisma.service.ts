import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    // DB 커넥션 풀 워밍업
    const start = Date.now();
    await this.$queryRaw`SELECT 1`;
    this.logger.log(`DB connection warmed up in ${Date.now() - start}ms`);
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
