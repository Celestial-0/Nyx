# syntax=docker/dockerfile:1

# ------------------------------------------------------------------------------
# Stage 1: Dependency resolution (Cached efficiently by lockfile)
# ------------------------------------------------------------------------------
FROM oven/bun:1.3-alpine AS deps
WORKDIR /app

# Copy dependency manifests
COPY package.json bun.lock ./

# Install dependencies (utilizing lockfile cache when available)
RUN bun install

# ------------------------------------------------------------------------------
# Stage 2: Production runtime (< 130MB total image footprint)
# ------------------------------------------------------------------------------
FROM oven/bun:1.3-alpine AS runner
WORKDIR /app

# Set production environment flag (All secrets and URLs are injected at runtime via environment)
ENV NODE_ENV=production

# Copy cached dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock tsconfig.json drizzle.config.ts ./

# Copy database schema & migrations
COPY drizzle ./drizzle

# Copy backend source code
COPY src ./src

# Expose API port
EXPOSE 5000

# Run automatic database migrations then boot Hono API server
CMD ["sh", "-c", "bun run db:migrate && bun run src/main.ts"]
