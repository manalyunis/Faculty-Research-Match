#!/bin/bash

# Faculty Research Match - VPS Setup Script for Ubuntu 24.04 LTS
# Run this script on your fresh Ubuntu VPS with sudo privileges

set -e

echo "🚀 Starting Faculty Research Match VPS Setup..."

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install essential packages
echo "🛠️ Installing essential packages..."
apt install -y curl wget git htop unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release

# Install Docker
echo "🐳 Installing Docker..."
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Start and enable Docker
systemctl start docker
systemctl enable docker

# Install Nginx
echo "🌐 Installing Nginx..."
apt install -y nginx

# Configure firewall
echo "🔥 Configuring firewall..."
ufw allow 22/tcp  # SSH
ufw allow 80/tcp  # HTTP
ufw allow 443/tcp # HTTPS
ufw --force enable

# Create application user
echo "👤 Creating application user..."
useradd -m -s /bin/bash -G docker appuser

# Create application directory
echo "📁 Setting up application directories..."
mkdir -p /opt/faculty-research-match
chown appuser:appuser /opt/faculty-research-match

# Install Docker Compose (standalone)
echo "🔧 Installing Docker Compose..."
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Create log directories
echo "📝 Setting up logging..."
mkdir -p /var/log/faculty-research-match
chown appuser:appuser /var/log/faculty-research-match

# Install Certbot for SSL (optional)
echo "🔒 Installing Certbot for SSL..."
apt install -y certbot python3-certbot-nginx

# Set up basic Nginx configuration
echo "⚙️ Configuring Nginx..."
rm -f /etc/nginx/sites-enabled/default

# Create basic maintenance page
cat > /var/www/html/maintenance.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>Faculty Research Match - Setting Up</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
        .container { max-width: 600px; margin: 0 auto; }
        .loading { color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Faculty Research Match</h1>
        <p class="loading">🚀 Deployment in progress...</p>
        <p>The application will be available shortly.</p>
    </div>
</body>
</html>
EOF

# Enable Nginx
systemctl start nginx
systemctl enable nginx

# Configure system limits for ML workloads
echo "⚡ Optimizing system for ML workloads..."
cat >> /etc/security/limits.conf << 'EOF'
appuser soft nofile 65536
appuser hard nofile 65536
appuser soft nproc 32768
appuser hard nproc 32768
EOF

# Configure kernel parameters
cat >> /etc/sysctl.conf << 'EOF'
# Optimize for ML workloads
vm.max_map_count=262144
net.core.somaxconn=1024
net.ipv4.tcp_fin_timeout=30
EOF
sysctl -p

# Set up log rotation
cat > /etc/logrotate.d/faculty-research-match << 'EOF'
/var/log/faculty-research-match/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    sharedscripts
    postrotate
        docker-compose -f /opt/faculty-research-match/docker-compose.yml restart > /dev/null 2>&1 || true
    endscript
}
EOF

echo "✅ Server setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Switch to appuser: sudo su - appuser"
echo "2. Clone your repository to /opt/faculty-research-match"
echo "3. Run the deployment script"
echo ""
echo "🔧 Useful commands:"
echo "- Check Docker: docker --version"
echo "- Check Nginx: systemctl status nginx"
echo "- View logs: journalctl -u docker"
echo ""
echo "🌟 Your VPS is ready for Faculty Research Match deployment!"