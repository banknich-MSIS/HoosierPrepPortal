# Multi-stage build for React/Vite frontend

# Build stage
FROM node:20-alpine as builder

WORKDIR /build

# Copy package files first for better caching
COPY web/package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY web/src ./src
COPY web/index.html ./
COPY web/public ./public
COPY web/tsconfig.json ./
COPY web/vite.config.ts ./

# Copy assets - need to be at ../assets relative to src for imports
# Since src is at /build/src and imports are ../../assets, we need assets at /assets
# So copy to parent directory
WORKDIR /
COPY assets ./assets

# Back to build directory
WORKDIR /build

# Build argument for API URL
ARG VITE_API_URL=http://localhost:8000/api
ENV VITE_API_URL=${VITE_API_URL}

# Build the application
RUN npm run build

# Production stage with nginx
FROM nginx:alpine

# Copy built assets from builder
COPY --from=builder /build/dist-vite /usr/share/nginx/html

# Copy nginx configuration (from web directory)
COPY web/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
