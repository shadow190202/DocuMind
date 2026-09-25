# ==============================================================================
# DocuMind — Production Multi-Stage Dockerfile
# Base OS: Debian Bookworm Slim with Node.js 20 LTS
# Architecture: Single container on Linux VPS with persistent host storage mount
# Invariant: 100% JavaScript (.js/.jsx/.mjs only, zero TypeScript)
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Dependencies (deps)
# ------------------------------------------------------------------------------
FROM node:20-bookworm-slim AS deps
WORKDIR /app

# Install curl for container healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Copy package manifests
COPY package.json package-lock.json* ./

# Install production dependencies only (used in final runner)
RUN npm ci --omit=dev

# ------------------------------------------------------------------------------
# Stage 2: Builder (builder)
# ------------------------------------------------------------------------------
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Copy package manifests
COPY package.json package-lock.json* ./

# Install full dependencies for building Next.js application
RUN npm ci

# Copy application source code (excluding items in .dockerignore)
COPY . .

# Set production environment for Next.js build
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build the Next.js application
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 3: Production Runner (runner)
# ------------------------------------------------------------------------------
FROM node:20-bookworm-slim AS runner
WORKDIR /app

# Install curl for healthcheck liveness probe
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Set runtime production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create unprivileged system group and user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Create storage mount points with correct ownership for the non-root user
# These directories must be backed by a persistent host volume at runtime:
# Host: /var/data/documind/storage -> Container: /app/storage
RUN mkdir -p /app/storage/documents /app/storage/extracted && \
    chown -R nextjs:nodejs /app/storage

# Copy production node_modules from deps stage
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy built application assets from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/src ./src
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/next.config.mjs ./next.config.mjs
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# Declare persistent storage volume mount point
VOLUME ["/app/storage"]

# Switch to unprivileged runtime user
USER nextjs

# Expose standard application port
EXPOSE 3000

# Container liveness health check using minimal public endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start the Next.js production server
CMD ["node_modules/.bin/next", "start"]
