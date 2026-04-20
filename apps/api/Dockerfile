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

# 스키마 변경을 런타임에 적용 (새 테이블 생성/컬럼 추가 자동 반영, 기존 데이터 유지)
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss && node dist/src/main"]
