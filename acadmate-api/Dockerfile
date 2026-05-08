FROM node:22-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
COPY tsconfig.json ./
COPY src ./src/
COPY nest-cli.json ./

RUN npm ci --ignore-scripts

RUN npx prisma generate

RUN npm run build

# ── Runtime ────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev --ignore-scripts

# Prisma schema (needed for db push at startup) + generated client from builder
COPY prisma ./prisma/
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Compiled NestJS output
COPY --from=builder /app/dist ./dist

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000

CMD ["sh", "-c", "node_modules/.bin/prisma db push --skip-generate && node dist/main"]
