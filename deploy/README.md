# Faculty Research Match - VPS Deployment Guide

Complete deployment guide for your Ubuntu 24.04 VPS with 6 vCPU, 20GB RAM, 300GB NVMe.

## 🚀 Quick Start

### Prerequisites
- Ubuntu 24.04 LTS VPS with sudo access
- Domain name (optional, for SSL)
- Git installed on VPS

### Step 1: Upload Project Files
```bash
# Option A: Upload via git (recommended)
ssh root@your-vps-ip
cd /opt
git clone https://github.com/your-username/faculty-research-match.git
cd faculty-research-match

# Option B: Upload via SCP
scp -r /path/to/local/project root@your-vps-ip:/opt/faculty-research-match
```

### Step 2: Server Setup (as root)
```bash
cd /opt/faculty-research-match
chmod +x deploy/server-setup.sh
bash deploy/server-setup.sh
```

### Step 3: Application Deployment (as appuser)
```bash
sudo su - appuser
cd /opt/faculty-research-match
chmod +x deploy/deploy.sh

# Configure environment
cp .env.production.template .env.production
nano .env.production  # Edit with your values

# Deploy application
./deploy/deploy.sh
```

## 📋 Detailed Deployment Steps

### 1. Environment Configuration

Edit `.env.production` with your actual values:

```bash
# Required: Supabase credentials
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional: OpenAI for enhanced features
OPENAI_API_KEY=sk-your-openai-key

# Application URL (replace with your domain)
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### 2. SSL Certificate Setup (Optional)

For HTTPS with Let's Encrypt:

```bash
# Set environment variables before deployment
export DOMAIN="your-domain.com"
export SSL_METHOD="letsencrypt"
export EMAIL="your-email@domain.com"

# Run deployment
./deploy/deploy.sh
```

### 3. Manual SSL Setup

If automatic SSL fails:

```bash
# Generate certificate manually
sudo certbot certonly --nginx -d your-domain.com

# Copy certificates
sudo mkdir -p /opt/faculty-research-match/deploy/ssl
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /opt/faculty-research-match/deploy/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem /opt/faculty-research-match/deploy/ssl/
sudo chown appuser:appuser /opt/faculty-research-match/deploy/ssl/*

# Restart nginx
docker-compose restart nginx
```

## 🔧 Management Commands

### Service Management
```bash
# View service status
docker-compose ps

# View logs
docker-compose logs -f
docker-compose logs -f app  # Just application logs

# Restart services
docker-compose restart
docker-compose restart app  # Just application

# Stop all services
docker-compose down

# Update application
git pull origin main
docker-compose build --no-cache
docker-compose up -d
```

### Health Monitoring
```bash
# Check application health
curl http://localhost:3000/api/health

# Check individual services
docker-compose exec app curl http://localhost:3000/api/health
docker-compose exec redis redis-cli ping

# View resource usage
docker stats
```

### Database Management
```bash
# View database connection status
docker-compose exec app node -e "
const { createClient } = require('@supabase/supabase-js');
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
client.from('faculty').select('count').then(console.log);
"
```

## 🐛 Troubleshooting

### Common Issues

#### Application Won't Start
```bash
# Check logs
docker-compose logs app

# Common fixes
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

#### SSL Certificate Issues
```bash
# Check nginx configuration
docker-compose exec nginx nginx -t

# Manually renew certificate
sudo certbot renew

# Copy new certificates
sudo cp /etc/letsencrypt/live/your-domain.com/* /opt/faculty-research-match/deploy/ssl/
docker-compose restart nginx
```

#### Database Connection Issues
```bash
# Check environment variables
docker-compose exec app env | grep SUPABASE

# Test connection manually
docker-compose exec app node -e "console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)"
```

#### High Memory Usage
```bash
# Check memory usage
free -h
docker stats

# Restart services if needed
docker-compose restart
```

### Performance Optimization

#### For High Traffic
```bash
# Scale application containers
docker-compose up -d --scale app=3

# Monitor performance
htop
docker stats
```

#### ML Model Optimization
```bash
# Clear model cache
docker-compose exec app rm -rf /app/python/models/.cache

# Restart Python service
docker-compose restart app
```

## 📊 Monitoring and Maintenance

### Daily Checks
```bash
# Service health
curl -f http://localhost:3000/api/health

# Disk usage
df -h

# Memory usage
free -h

# Container status
docker-compose ps
```

### Weekly Maintenance
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Clean Docker images
docker system prune -f

# Backup configuration
cp .env.production /opt/backups/env-$(date +%Y%m%d).backup
```

### Log Management
```bash
# View application logs
tail -f logs/application.log

# Rotate logs manually
docker-compose exec app logrotate /etc/logrotate.d/faculty-research-match

# Clean old logs
find logs/ -name "*.log.*" -mtime +30 -delete
```

## 🔒 Security Best Practices

### Firewall Configuration
```bash
# Check firewall status
sudo ufw status

# Only these ports should be open
sudo ufw allow 22   # SSH
sudo ufw allow 80   # HTTP
sudo ufw allow 443  # HTTPS
```

### SSL Certificate Auto-Renewal
```bash
# Test certificate renewal
sudo certbot renew --dry-run

# Set up auto-renewal (crontab -e)
0 12 * * * /usr/bin/certbot renew --quiet && docker-compose -f /opt/faculty-research-match/docker-compose.yml restart nginx
```

### Environment Security
```bash
# Secure environment file
chmod 600 .env.production
chown appuser:appuser .env.production

# Regular security updates
sudo apt update && sudo apt upgrade -y
```

## 📈 Performance Metrics

### Expected Performance
- **Startup time**: 60-90 seconds
- **Memory usage**: 2-4GB (with ML models loaded)
- **Response time**: <200ms for similarity searches
- **Concurrent users**: 50-100 simultaneous

### Scaling Recommendations
- **CPU**: Current 6 vCPU is sufficient for 100+ concurrent users
- **RAM**: 20GB handles large datasets and ML models easily
- **Storage**: Monitor `/app/python/models` for model cache growth

## 🆘 Emergency Procedures

### Application Crash
```bash
# Quick restart
docker-compose restart app

# Full restart if needed
docker-compose down && docker-compose up -d
```

### Server Issues
```bash
# Check system resources
htop
df -h
free -h

# Emergency stop all services
docker-compose down

# Reboot server if needed
sudo reboot
```

### Backup and Recovery
```bash
# Create full backup
mkdir -p /opt/backups/$(date +%Y%m%d)
cp -r /opt/faculty-research-match /opt/backups/$(date +%Y%m%d)/
```

## 📞 Support Information

### Log Locations
- Application logs: `/opt/faculty-research-match/logs/`
- Nginx logs: `docker-compose logs nginx`
- System logs: `/var/log/syslog`

### Configuration Files
- Environment: `.env.production`
- Docker: `docker-compose.yml`
- Nginx: `deploy/nginx.conf`

### Health Check URLs
- Application: `http://your-server/api/health`
- Nginx: `http://your-server/health`

---

🎉 **Your Faculty Research Match system is now deployed and ready for production use!**