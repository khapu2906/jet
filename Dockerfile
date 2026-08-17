# ============================================================================
# Stage 1 — Base
# ============================================================================

FROM node:22-alpine AS base

WORKDIR /app


# ============================================================================
# Stage 2 — Install ALL dependencies
# ============================================================================

FROM base AS deps

COPY package.json package-lock.json ./

RUN npm ci


# ============================================================================
# Stage 3 — Build
# ============================================================================

FROM deps AS builder

COPY . .

RUN npm run build


# ============================================================================
# Stage 4 — Migration
#
# Contains:
# - source
# - migrations
# - drizzle.config.ts
# - drizzle-kit
# - all dependencies
#
# Nothing is executed during docker build.
# This stage is executed by the deployment pipeline.
# ============================================================================

FROM builder AS migration

CMD ["npm", "run", "db:migrate"]


# ============================================================================
# Stage 5 — Production dependencies
# ============================================================================

FROM base AS production-deps

COPY package.json package-lock.json ./

RUN npm ci --omit=dev


# ============================================================================
# Stage 6 — Runtime
# ============================================================================

FROM node:22-alpine AS runtime

WORKDIR /app

RUN addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -u 1001

# Production dependencies only
COPY --from=production-deps \
    --chown=nodejs:nodejs \
    /app/node_modules \
    ./node_modules

# Compiled application
COPY --from=builder \
    --chown=nodejs:nodejs \
    /app/dist \
    ./dist

COPY --from=builder \
    --chown=nodejs:nodejs \
    /app/package.json \
    ./package.json

USER nodejs

ENV NODE_ENV=production
ENV PORT=2906

EXPOSE 2906

CMD ["node", "dist/index.js"]
