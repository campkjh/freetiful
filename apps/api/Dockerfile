FROM node:20-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy everything (Railway uploads from project root)
COPY . .

# Install dependencies
RUN npm install

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build NestJS
RUN cd apps/api && npx nest build

WORKDIR /app/apps/api

EXPOSE 4000

# DB schema push 는 기본 스킵 (재시작마다 push 가 Supabase 15-conn 한도에 걸려 부팅을 최대 60초 지연 → 콜드스타트 원인).
# 스키마 변경 시에만 Railway 변수 SKIP_PRISMA_DB_PUSH=0 으로 1회 배포해 동기화.
ENV SKIP_PRISMA_DB_PUSH=1
CMD ["sh", "-c", "if [ \"$SKIP_PRISMA_DB_PUSH\" != \"1\" ]; then timeout 60 npx prisma db push --skip-generate --accept-data-loss || echo '[deploy] prisma db push skipped (continuing without schema sync)'; fi; if [ -f dist/main.js ]; then node dist/main.js; else node dist/src/main.js; fi"]
