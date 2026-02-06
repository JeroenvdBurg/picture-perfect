# Use official Node.js LTS image for x86-64 architecture
FROM node:20-alpine AS build

# Set working directory
WORKDIR /app

ENV VITE_EVROC_ENDPOINT=https://storage.services.evroc.cloud/
ENV VITE_EVROC_REGION=sto-1
ENV VITE_EVROC_ACCESS_KEY=7N5KDVEX5G4VPOK73YQW
ENV VITE_EVROC_SECRET_KEY=KFMUTGIFMBBFK2JYDEQJ4K4OOLN75JSEYQDO2GWR
ENV VITE_EVROC_BUCKET=my-bucket

# Copy package files and install dependencies
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && \
    pnpm config set store-dir /tmp/.pnpm-store && \
    pnpm install --no-frozen-lockfile

# Copy application source and build
COPY . .
RUN pnpm run build

# Production stage with Node.js
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Create a non-root user and group as required by evroc Run
# UID/GID 1001 to avoid conflicts with existing system users
RUN addgroup -g 1001 appgroup && \
    adduser -u 1001 -G appgroup -s /bin/sh -D appuser

# Copy built assets and server from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.js ./server.js
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/pnpm-lock.yaml ./pnpm-lock.yaml

# Install production dependencies only (express, multer, aws-sdk)
RUN npm install -g pnpm && \
    pnpm config set store-dir /tmp/.pnpm-store && \
    pnpm install --prod --no-frozen-lockfile && \
    pnpm store prune && \
    npm cache clean --force

# Change ownership of app files to non-root user
RUN chown -R appuser:appgroup /app

# Switch to non-root user - REQUIRED by evroc Run
USER 1001:1001

# Expose port (will be set via PORT environment variable)
# Default to 8080 but evroc Run will set PORT env var
ENV PORT=8080
EXPOSE 8080

# Set evroc credentials as runtime environment variables
ENV VITE_EVROC_ENDPOINT=https://storage.services.evroc.cloud/
ENV VITE_EVROC_REGION=sto-1
ENV VITE_EVROC_ACCESS_KEY=7N5KDVEX5G4VPOK73YQW
ENV VITE_EVROC_SECRET_KEY=KFMUTGIFMBBFK2JYDEQJ4K4OOLN75JSEYQDO2GWR
ENV VITE_EVROC_BUCKET=my-bucket

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 8080) + '/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "server.js"]