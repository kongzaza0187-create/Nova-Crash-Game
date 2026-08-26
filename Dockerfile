# ==============================================================================
# STAGE 1: Builder
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* bun.lock* ./

RUN npm install --frozen-lockfile || npm install

COPY . .

RUN npm run build

# ==============================================================================
# STAGE 2: Production Runner
# ==============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV TZ=Europe/Malta

RUN apk add --no-cache tzdata \
    && cp /usr/share/zoneinfo/Europe/Malta /etc/localtime \
    && echo "Europe/Malta" > /etc/timezone

COPY package.json package-lock.json* bun.lock* ./

RUN npm install --only=production --ignore-scripts

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/index.html ./index.html

# Security hardening: Drop root privileges
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "dist/server.cjs"]
