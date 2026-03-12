#!/usr/bin/env bash
set -euo pipefail

# Inertia Studio — Provisioning Script
# Target: Fanless x86 or ARM Appliance (Debian Bookworm)

echo "=== Inertia Studio Provisioning ==="
echo "Target: $(hostname) ($(uname -m))"
echo ""

# ----- Version locks -----
NODE_MAJOR=22
CADDY_VERSION="2.8.4"

# ----- 1. System packages -----
echo "[1/7] Installing system packages..."
apt-get update -qq
apt-get install -y -qq \
  curl \
  gnupg \
  lsb-release \
  ca-certificates \
  git \
  build-essential \
  wireguard-tools \
  rsync

# ----- 2. Node.js -----
echo "[2/7] Installing Node.js ${NODE_MAJOR}..."
if ! command -v node &>/dev/null; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y -qq nodejs
fi
node --version
npm install -g pnpm@latest

# ----- 3. PostgreSQL -----
echo "[3/7] Installing PostgreSQL..."
if ! command -v psql &>/dev/null; then
  apt-get install -y -qq postgresql postgresql-contrib
fi

# Dynamically detect installed version for config paths
POSTGRES_VERSION=$(ls /etc/postgresql/ | head -1)

systemctl enable postgresql
systemctl start postgresql

# Create database and user
echo "[3b/7] Setting up database..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='inertia_app'" | grep -q 1 || \
  sudo -u postgres createuser inertia_app
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='inertia_studio'" | grep -q 1 || \
  sudo -u postgres createdb -O inertia_app inertia_studio

# Set password (idempotent)
sudo -u postgres psql -c "ALTER USER inertia_app WITH PASSWORD 'changeme';"

# PostgreSQL tuning
PGCONF="/etc/postgresql/${POSTGRES_VERSION}/main/postgresql.conf"
if ! grep -q "# Inertia tuning" "${PGCONF}"; then
  echo "" >> "${PGCONF}"
  echo "# Inertia tuning" >> "${PGCONF}"
  echo "shared_buffers = 1GB" >> "${PGCONF}"
  echo "effective_cache_size = 2GB" >> "${PGCONF}"
  echo "work_mem = 64MB" >> "${PGCONF}"
  echo "maintenance_work_mem = 256MB" >> "${PGCONF}"
  echo "max_connections = 20" >> "${PGCONF}"
  systemctl restart postgresql
fi

# ----- 4. Caddy -----
echo "[4/7] Installing Caddy ${CADDY_VERSION}..."
if ! command -v caddy &>/dev/null; then
  ARCH=$(uname -m)
  if [ "$ARCH" = "x86_64" ]; then
    DL_ARCH="amd64"
  elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
    DL_ARCH="arm64"
  else
    echo "Unsupported architecture for caddy script: $ARCH"
    exit 1
  fi
  
  curl -fsSL "https://github.com/caddyserver/caddy/releases/download/v${CADDY_VERSION}/caddy_${CADDY_VERSION}_linux_${DL_ARCH}.tar.gz" \
    -o /tmp/caddy.tar.gz
  tar -xzf /tmp/caddy.tar.gz -C /usr/local/bin caddy
  chmod +x /usr/local/bin/caddy
  rm /tmp/caddy.tar.gz
fi
caddy version

# Caddy config
mkdir -p /etc/caddy /var/log/caddy
cp /home/agent/inertia/sites/studio/deploy/Caddyfile /etc/caddy/Caddyfile

# Caddy systemd (if not already installed)
if [ ! -f /etc/systemd/system/caddy.service ]; then
  caddy environ | head -1 || true
  cat > /etc/systemd/system/caddy.service << 'CADDY_SVC'
[Unit]
Description=Caddy HTTP/2 web server
After=network.target

[Service]
Type=simple
User=caddy
Group=caddy
ExecStart=/usr/local/bin/caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
ExecReload=/usr/local/bin/caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
CADDY_SVC

  useradd --system --home /var/lib/caddy --shell /usr/sbin/nologin caddy 2>/dev/null || true
  systemctl daemon-reload
fi

systemctl enable caddy

# ----- 5. Chromium + Lighthouse (for /audit) -----
echo "[5/7] Installing Chromium and Lighthouse..."
apt-get install -y -qq chromium-browser 2>/dev/null || apt-get install -y -qq chromium 2>/dev/null || echo "WARN: Chromium not available via apt, /audit page will be unavailable"
if command -v npm &>/dev/null; then
  npm install -g lighthouse@latest
fi

# ----- 6. Application setup -----
echo "[6/7] Setting up application..."
APP_DIR="/home/agent/inertia"

if [ ! -d "${APP_DIR}" ]; then
  echo "ERROR: Clone the repo to ${APP_DIR} first"
  echo "  git clone <repo-url> ${APP_DIR}"
  exit 1
fi

cd "${APP_DIR}"
pnpm install --frozen-lockfile
pnpm build

# Copy environment file if not present
if [ ! -f "${APP_DIR}/.env" ]; then
  cp sites/studio/deploy/env.production "${APP_DIR}/.env"
  echo "IMPORTANT: Edit ${APP_DIR}/.env — change DB_PASSWORD and ADMIN_TOKEN"
fi

# Install systemd service
cp sites/studio/deploy/inertia-studio.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable inertia-studio

# ----- 7. Run migrations -----
echo "[7/7] Running database migrations..."
cd "${APP_DIR}"
# Migrations run automatically on server boot via entry.ts

echo ""
echo "=== Provisioning complete ==="
echo ""
echo "Next steps:"
echo "  1. Edit /home/agent/inertia/.env (set DB_PASSWORD, ADMIN_TOKEN)"
echo "  2. Generate WireGuard keys for appliance:"
echo "     wg genkey | tee /etc/wireguard/client-private.key | wg pubkey > /etc/wireguard/client-public.key"
echo "  3. Configure VPS relay and WireGuard tunnel according to the architecture spec"
echo "  4. Start services:"
echo "     sudo systemctl start inertia-studio"
echo "     sudo systemctl start caddy"
echo "     sudo systemctl start wg-quick@wg0"
echo "  5. Verify: curl http://localhost:3000/"
echo "  6. STOP and notify operator before DNS cutover"
echo ""
