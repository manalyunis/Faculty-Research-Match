# Faculty Research Match - Production Dockerfile
# Multi-stage build for optimized production deployment

# Stage 1: Python environment for ML services
FROM python:3.11-slim as python-env

WORKDIR /app/python

# Install system dependencies for Python ML libraries
RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy Python requirements and install dependencies
COPY python/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy Python ML services
COPY python/ .

# Stage 2: Node.js environment
FROM node:20-alpine as node-base

WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build the Next.js application
RUN npm run build

# Stage 3: Production runtime
FROM node:20-alpine as production

WORKDIR /app

# Install Python for ML services
RUN apk add --no-cache \
    python3 \
    py3-pip \
    gcc \
    g++ \
    python3-dev \
    musl-dev \
    linux-headers

# Create app user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Copy Python environment from python-env stage
COPY --from=python-env /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=python-env /usr/local/bin /usr/local/bin
COPY --from=python-env /app/python /app/python

# Copy Node.js application from node-base stage
COPY --from=node-base /app/node_modules ./node_modules
COPY --from=node-base /app/.next ./.next
COPY --from=node-base /app/public ./public
COPY --from=node-base /app/package*.json ./

# Copy source code (excluding Python and node_modules)
COPY --chown=appuser:appgroup src ./src
COPY --chown=appuser:appgroup supabase ./supabase
COPY --chown=appuser:appgroup *.config.js ./
COPY --chown=appuser:appgroup *.json ./
COPY --chown=appuser:appgroup *.md ./

# Create necessary directories
RUN mkdir -p /app/logs /app/data && \
    chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Start application
CMD ["npm", "start"]