# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy all files needed for build
COPY package*.json tsconfig*.json ./
COPY src ./src

# Install dependencies and build
RUN npm ci && npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json package-lock.json ./

# Install production dependencies only (skip prepare scripts like husky)
RUN npm ci --only=production --ignore-scripts

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Set environment to production
ENV NODE_ENV=production

# Set default PORT for Cloud Run (Cloud Run will override this)
ENV PORT=8080

# Expose port (Cloud Run uses 8080 by default)
EXPOSE 8080

# Health check - uses PORT environment variable for Cloud Run compatibility
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "const port = process.env.PORT || 8080; \
    require('http').get('http://localhost:' + port + '/health', (r) => { \
      process.exit(r.statusCode === 200 ? 0 : 1); \
    })"

# Run the application
CMD ["node", "dist/index.js"]
