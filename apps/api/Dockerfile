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

# 스키마 변경을 런타임에 적용하고 Nest 빌드 출력 경로를 자동 감지한다.
CMD ["sh", "-c", "timeout 30 npx prisma db push --skip-generate --accept-data-loss || echo 'prisma db push skipped/failed - continuing'; if [ -f dist/main.js ]; then node dist/main.js; else node dist/src/main.js; fi"]
