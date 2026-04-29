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

# Nest 빌드 출력 경로를 자동 감지한다. 스키마 변경이 필요한 배포에서만
# RUN_PRISMA_DB_PUSH_ON_STARTUP=true를 지정해 시작 전 db push를 실행한다.
CMD ["sh", "-c", "if [ \"$RUN_PRISMA_DB_PUSH_ON_STARTUP\" = \"true\" ]; then timeout 180 npx prisma db push --skip-generate --accept-data-loss; fi && if [ -f dist/main.js ]; then node dist/main.js; else node dist/src/main.js; fi"]
