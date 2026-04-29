import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

function getRuntimeDatabaseUrl() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) return undefined;

  try {
    const url = new URL(rawUrl);
    const isSupabasePooler = url.hostname.includes('pooler.supabase.com');

    if (isSupabasePooler) {
      if (url.port === '5432') url.port = '6543';
      url.searchParams.set('pgbouncer', 'true');
      url.searchParams.set('connection_limit', process.env.DATABASE_CONNECTION_LIMIT || '1');
    }

    return url.toString();
  } catch {
    return rawUrl;
  }
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const databaseUrl = getRuntimeDatabaseUrl();
    super(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : undefined);
  }

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
