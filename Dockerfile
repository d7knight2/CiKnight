# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies without package-lock to avoid npm ci bug
RUN npm install

# Copy source and config files
COPY tsconfig*.json ./
COPY src ./src

# Build the application
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package.json ./

# Install production dependencies only (skip prepare scripts like husky)
RUN npm install --omit=dev --ignore-scripts

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Set environment to production
ENV NODE_ENV=production

# Expose port 8080 (default for Cloud Run and most cloud platforms)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:${PORT:-8080}/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run the application
CMD ["node", "dist/index.js"]
