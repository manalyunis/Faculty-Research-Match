#!/bin/bash

# Faculty Research Match - Deployment Script
# Run this script as appuser in /opt/faculty-research-match

set -e

echo "🚀 Starting Faculty Research Match deployment..."

# Configuration
APP_DIR="/opt/faculty-research-match"
REPO_URL="https://github.com/your-username/faculty-research-match.git"  # Update this
BRANCH="main"
BACKUP_DIR="/opt/backups/faculty-research-match"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as appuser
if [ "$USER" != "appuser" ]; then
    log_error "This script should be run as appuser"
    log_info "Run: sudo su - appuser"
    exit 1
fi

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed or not accessible"
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null; then
    log_error "Docker Compose is not installed"
    exit 1
fi

# Create directories
log_info "Creating necessary directories..."
mkdir -p "$APP_DIR" "$BACKUP_DIR" "$APP_DIR/logs" "$APP_DIR/data"

# Change to app directory
cd "$APP_DIR"

# Backup existing deployment
if [ -d ".git" ]; then
    log_info "Creating backup of existing deployment..."
    BACKUP_NAME="backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR/$BACKUP_NAME"
    cp -r . "$BACKUP_DIR/$BACKUP_NAME/" 2>/dev/null || true
    log_info "Backup created at $BACKUP_DIR/$BACKUP_NAME"
fi

# Clone or update repository
if [ ! -d ".git" ]; then
    log_info "Cloning repository..."
    git clone "$REPO_URL" .
else
    log_info "Updating repository..."
    git fetch origin
    git reset --hard origin/$BRANCH
fi

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    log_warn ".env.production not found"
    if [ -f ".env.production.template" ]; then
        log_info "Creating .env.production from template..."
        cp .env.production.template .env.production
        log_warn "Please edit .env.production with your actual values"
        log_warn "Deployment will continue in 10 seconds..."
        sleep 10
    else
        log_error ".env.production.template not found. Cannot continue."
        exit 1
    fi
fi

# Stop existing services
log_info "Stopping existing services..."
docker-compose down --remove-orphans || true

# Pull latest images
log_info "Pulling latest base images..."
docker-compose pull || true

# Build application
log_info "Building application..."
docker-compose build --no-cache

# Start services
log_info "Starting services..."
docker-compose up -d

# Wait for services to start
log_info "Waiting for services to start..."
sleep 30

# Health check
log_info "Performing health check..."
MAX_ATTEMPTS=12
ATTEMPT=1

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
        log_info "✅ Application is healthy!"
        break
    else
        log_warn "Health check failed (attempt $ATTEMPT/$MAX_ATTEMPTS)"
        if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
            log_error "Health check failed after $MAX_ATTEMPTS attempts"
            log_info "Checking logs..."
            docker-compose logs --tail=50
            exit 1
        fi
        sleep 10
        ((ATTEMPT++))
    fi
done

# Setup SSL if domain is configured
if [ ! -z "$DOMAIN" ]; then
    log_info "Setting up SSL for domain: $DOMAIN"

    # Create SSL directory
    sudo mkdir -p /opt/faculty-research-match/deploy/ssl

    # Generate or obtain SSL certificate
    if [ "$SSL_METHOD" == "letsencrypt" ]; then
        log_info "Obtaining Let's Encrypt certificate..."
        sudo certbot certonly --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "$EMAIL"

        # Copy certificates to Docker volume
        sudo cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem /opt/faculty-research-match/deploy/ssl/
        sudo cp /etc/letsencrypt/live/$DOMAIN/privkey.pem /opt/faculty-research-match/deploy/ssl/
        sudo chown appuser:appuser /opt/faculty-research-match/deploy/ssl/*

        log_info "Restarting nginx to apply SSL..."
        docker-compose restart nginx
    else
        log_warn "SSL_METHOD not set to 'letsencrypt'. Skipping SSL setup."
        log_warn "Application will run on HTTP only."
    fi
fi

# Show status
log_info "Deployment completed successfully!"
echo ""
echo "📊 Service Status:"
docker-compose ps

echo ""
echo "🌐 Application URLs:"
echo "  HTTP:  http://$(hostname -I | awk '{print $1}'):80"
echo "  HTTPS: https://$(hostname -I | awk '{print $1}'):443"
if [ ! -z "$DOMAIN" ]; then
    echo "  Domain: https://$DOMAIN"
fi

echo ""
echo "📝 Useful commands:"
echo "  View logs:        docker-compose logs -f"
echo "  Restart services: docker-compose restart"
echo "  Stop services:    docker-compose down"
echo "  Update app:       ./deploy/deploy.sh"

echo ""
echo "🎉 Faculty Research Match is now running!"