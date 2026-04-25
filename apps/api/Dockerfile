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
# DB push가 실패한 상태로 새 앱을 띄우면 새 Prisma 필드 조회에서 500이 발생하므로 배포를 중단한다.
CMD ["sh", "-c", "timeout 180 npx prisma db push --skip-generate --accept-data-loss && if [ -f dist/main.js ]; then node dist/main.js; else node dist/src/main.js; fi"]
