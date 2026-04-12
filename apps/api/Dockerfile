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

CMD ["node", "dist/src/main"]
