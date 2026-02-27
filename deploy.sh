#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────
# Signature OS — IONOS VPS Deployment Script
# Run ON the VPS as root or with sudo
# ─────────────────────────────────────────────────────────────

APP_DIR="/var/www/sigcrm"
DATA_DIR="/var/data/signature-cleans/files"
LOG_DIR="/var/log/signature-os"
REPO="https://github.com/nels111/sigcrm.git"
DOMAIN="app.signature-cleans.co.uk"
DB_NAME="signature_cleans"
DB_USER="sigclean"

echo "=========================================="
echo "  Signature OS — VPS Deployment"
echo "=========================================="

# ── 1. System dependencies ─────────────────────────
echo ""
echo "[1/9] Installing system dependencies..."
apt-get update -qq
apt-get install -y -qq curl git nginx certbot python3-certbot-nginx postgresql postgresql-contrib

# Node.js 20 LTS via NodeSource
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
fi

# PM2 globally
if ! command -v pm2 &>/dev/null; then
  npm install -g pm2
fi

echo "  Node $(node -v) | npm $(npm -v) | PM2 $(pm2 -v)"

# ── 2. PostgreSQL setup ────────────────────────────
echo ""
echo "[2/9] Setting up PostgreSQL..."
systemctl enable postgresql
systemctl start postgresql

# Create user and database if they don't exist
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD 'CHANGE_ME_NOW';"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

echo "  Database '${DB_NAME}' ready (user: ${DB_USER})"
echo "  *** IMPORTANT: Change the DB password! ***"
echo "  Run: sudo -u postgres psql -c \"ALTER USER ${DB_USER} WITH PASSWORD 'your_strong_password';\""

# ── 3. Directory structure ─────────────────────────
echo ""
echo "[3/9] Creating directories..."
mkdir -p "${APP_DIR}"
mkdir -p "${DATA_DIR}"/{quotes,contracts,audits,documents}
mkdir -p "${LOG_DIR}"

# ── 4. Clone / pull repository ─────────────────────
echo ""
echo "[4/9] Fetching code..."
if [ -d "${APP_DIR}/.git" ]; then
  cd "${APP_DIR}"
  git fetch origin
  git reset --hard origin/main
else
  git clone "${REPO}" "${APP_DIR}"
  cd "${APP_DIR}"
fi

# ── 5. Environment file ───────────────────────────
echo ""
echo "[5/9] Checking .env..."
if [ ! -f "${APP_DIR}/.env" ]; then
  cp "${APP_DIR}/.env.production.example" "${APP_DIR}/.env"
  echo "  *** .env created from template — EDIT IT NOW with real credentials! ***"
  echo "  nano ${APP_DIR}/.env"
  echo ""
  read -rp "  Press Enter after editing .env to continue..."
fi

# ── 6. Install, generate, build ───────────────────
echo ""
echo "[6/9] Installing dependencies and building..."
cd "${APP_DIR}"
npm ci --production=false
npx prisma generate
npx prisma db push
npm run build

# Seed database (idempotent — uses upsert)
npx tsx prisma/seed.ts

# ── 7. PM2 setup ──────────────────────────────────
echo ""
echo "[7/9] Starting app with PM2..."
cd "${APP_DIR}"
pm2 delete signature-os 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

echo "  App running on http://localhost:3000"

# ── 8. Nginx + SSL ────────────────────────────────
echo ""
echo "[8/9] Configuring Nginx + SSL..."
cp "${APP_DIR}/nginx/app.signature-cleans.co.uk.conf" /etc/nginx/sites-available/${DOMAIN}
ln -sf /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/${DOMAIN}

# Remove default site if present
rm -f /etc/nginx/sites-enabled/default

# Test config
nginx -t

# Get SSL cert if not already present
if [ ! -d "/etc/letsencrypt/live/${DOMAIN}" ]; then
  echo "  Obtaining SSL certificate..."
  # Temporarily use HTTP-only config for certbot
  cat > /etc/nginx/sites-available/${DOMAIN} <<'TMPNGINX'
server {
    listen 80;
    server_name app.signature-cleans.co.uk;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
TMPNGINX
  nginx -t && systemctl reload nginx
  certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m nelson@signature-cleans.co.uk
  # Restore full config
  cp "${APP_DIR}/nginx/app.signature-cleans.co.uk.conf" /etc/nginx/sites-available/${DOMAIN}
fi

nginx -t && systemctl reload nginx
systemctl enable nginx

# ── 9. Summary ─────────────────────────────────────
echo ""
echo "=========================================="
echo "  Deployment Complete!"
echo "=========================================="
echo ""
echo "  URL:      https://${DOMAIN}"
echo "  App Dir:  ${APP_DIR}"
echo "  Data Dir: ${DATA_DIR}"
echo "  Logs:     ${LOG_DIR}/"
echo ""
echo "  PM2 commands:"
echo "    pm2 status"
echo "    pm2 logs signature-os"
echo "    pm2 restart signature-os"
echo ""
echo "  Default login:"
echo "    nelson@signature-cleans.co.uk / changeme123"
echo "    nick@signature-cleans.co.uk   / changeme123"
echo ""
echo "  *** CHANGE PASSWORDS AFTER FIRST LOGIN ***"
echo ""
