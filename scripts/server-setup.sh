#!/bin/bash
set -euo pipefail

echo "=== TG-Bots: Server setup for Ubuntu 24.04 ==="

# --- System update ---
echo "[1/5] Updating system packages..."
apt update && apt upgrade -y

# --- Install prerequisites ---
echo "[2/5] Installing prerequisites..."
apt install -y ca-certificates curl gnupg git ufw

# --- Install Docker ---
echo "[3/5] Installing Docker..."
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable docker
systemctl start docker

echo "Docker version: $(docker --version)"
echo "Docker Compose version: $(docker compose version)"

# --- Configure firewall ---
echo "[4/5] Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status

# --- Create app directory ---
echo "[5/5] Creating app directory..."
mkdir -p /opt/tg-bots

echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Clone repo:    cd /opt/tg-bots && git clone git@github.com:YOUR_USER/tg-bots.git ."
echo "  2. Create .env:   cp env.production.example docker/.env"
echo "  3. Fill secrets:  nano docker/.env"
echo "  4. First deploy:  bash scripts/deploy.sh"
