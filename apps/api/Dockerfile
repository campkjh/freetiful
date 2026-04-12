FROM node:20-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy monorepo root files
COPY package.json package-lock.json ./
COPY packages/types ./packages/types

# Copy API package
COPY apps/api ./apps/api

# Install all dependencies
RUN npm install --workspace=apps/api --include-workspace-root

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build NestJS
RUN cd apps/api && npx nest build

WORKDIR /app/apps/api

EXPOSE 4000

CMD ["node", "dist/main"]
