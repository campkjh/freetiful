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

# DB schema push 는 SKIP_PRISMA_DB_PUSH=1 환경변수로 끌 수 있음
# (Supabase session pooler 의 15-connection 한도에 걸리면 deploy 가 항상 실패하므로
#  현재는 schema 변경이 없을 때 push 를 건너뛰는 것이 안전함. 필요할 때만 수동 push)
CMD ["sh", "-c", "if [ \"$SKIP_PRISMA_DB_PUSH\" != \"1\" ]; then timeout 60 npx prisma db push --skip-generate --accept-data-loss || echo '[deploy] prisma db push skipped (continuing without schema sync)'; fi; if [ -f dist/main.js ]; then node dist/main.js; else node dist/src/main.js; fi"]
