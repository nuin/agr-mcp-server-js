# Enhanced AGR MCP Server - JavaScript Implementation
# Multi-stage Docker build for optimal performance and security

# Stage 1: Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for building)
RUN npm ci --include=dev

# Copy source code
COPY . .

# Run linting and tests
RUN npm run lint
RUN npm run test

# Build documentation
RUN npm run docs || true

# Remove dev dependencies and clean cache
RUN npm prune --production && npm cache clean --force

# Stage 2: Production stage
FROM node:20-alpine AS production

# Set environment variables
ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV PORT=3000

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Install production runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/src ./src
COPY --from=builder --chown=nodejs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nodejs:nodejs /app/docs ./docs
COPY --from=builder --chown=nodejs:nodejs /app/README.md ./

# Create necessary directories
RUN mkdir -p /app/logs /app/tmp && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node scripts/health-check.js || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "src/agr-server-enhanced.js"]

# Metadata
LABEL maintainer="Genomics Team <genomics@example.com>"
LABEL version="3.0.0"
LABEL description="Enhanced Alliance of Genome Resources MCP Server - JavaScript Implementation"
LABEL org.opencontainers.image.title="AGR MCP Server JS"
LABEL org.opencontainers.image.description="High-performance JavaScript implementation of AGR MCP server with caching and monitoring"
LABEL org.opencontainers.image.version="3.0.0"
LABEL org.opencontainers.image.vendor="Genomics Development Team"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.source="https://github.com/genomics/agr-mcp-server-js"
LABEL org.opencontainers.image.documentation="https://github.com/genomics/agr-mcp-server-js/blob/main/README.md"