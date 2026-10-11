FROM node:20-slim

# Prisma engines need openssl on slim images
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

EXPOSE 4000

# Migrate (creates tables on first boot) and seed (idempotent) before starting the dev server
CMD ["sh", "-c", "npx prisma migrate deploy && (npx prisma db seed || echo 'seed skipped') && npx ts-node-dev --respawn --transpile-only src/index.ts"]
