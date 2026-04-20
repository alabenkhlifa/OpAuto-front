FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl curl
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

# Uploads persist across container restarts via a named volume mounted at
# /app/uploads. The service's compiled path is /app/dist/src/maintenance so
# `../../uploads` resolves to /app/uploads.
VOLUME ["/app/uploads"]

EXPOSE 3000

# prisma migrate deploy applies any pending migrations in deterministic order
# and never drops columns — safe for production. Falls back to exit-non-zero
# on a drift so the container crashes rather than silently running stale.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
