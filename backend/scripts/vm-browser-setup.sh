#!/usr/bin/env bash
# Installs the Loopmates browser service on a Linux VM (Ubuntu/Debian, x86_64 or arm64) as a systemd service.
#   curl -fsSL https://raw.githubusercontent.com/StarDust-Git-Code/loop/main/backend/scripts/vm-browser-setup.sh -o setup.sh
#   sudo SERVICE_SECRET='<same value as on the Render api service>' bash setup.sh [--tunnel]
# --tunnel also installs cloudflared so Render can reach the VM without opening any port.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run with sudo."; exit 1; }
: "${SERVICE_SECRET:?Set SERVICE_SECRET to the same value the Render api service uses}"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|aarch64) ;;
  *) echo "This VM is $ARCH. Google does not ship Chromium for $ARCH, so Playwright cannot run here."
     echo "Use an x86_64 or arm64 VM (Oracle Always Free Ampere, GCP e2-small, any VPS) or tell me and we will pick another way."; exit 2 ;;
esac
RAM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
echo "VM: $ARCH, ${RAM_MB} MB RAM"

apt-get update -y
apt-get install -y curl git ca-certificates
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

id loopmates >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin loopmates
APP=/opt/loopmates
if [ -d "$APP/.git" ]; then git -C "$APP" pull --ff-only; else git clone --depth 1 https://github.com/StarDust-Git-Code/loop.git "$APP"; fi
cd "$APP/backend"
npm ci --omit=dev
export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
npx playwright-core install --with-deps chromium
chown -R loopmates:loopmates "$APP"

# 2 Chromium instances; at most 4 sessions (about 600 MB each in the worst case) leaves headroom on 8 GB
cat >/etc/loopmates-browser.env <<EOF
SERVICE_SECRET=$SERVICE_SECRET
PORT=10000
HOST=127.0.0.1
BROWSER_INSTANCES=2
BROWSER_MAX_SESSIONS=4
BROWSER_IDLE_SECONDS=300
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
NODE_ENV=production
EOF
chmod 600 /etc/loopmates-browser.env

cat >/etc/systemd/system/loopmates-browser.service <<EOF
[Unit]
Description=Loopmates browser service
After=network-online.target
Wants=network-online.target
[Service]
User=loopmates
WorkingDirectory=$APP/backend
EnvironmentFile=/etc/loopmates-browser.env
ExecStart=/usr/bin/node src/browser/index.js
Restart=always
RestartSec=3
MemoryMax=6G
NoNewPrivileges=true
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now loopmates-browser
sleep 3
curl -fsS http://127.0.0.1:10000/healthz && echo " <- browser service is up"

if [ "${1:-}" = "--tunnel" ]; then
  if ! command -v cloudflared >/dev/null; then
    ( [ "$ARCH" = x86_64 ] && F=cloudflared-linux-amd64.deb || F=cloudflared-linux-arm64.deb
      curl -fsSL -o /tmp/cf.deb "https://github.com/cloudflare/cloudflared/releases/latest/download/$F" && dpkg -i /tmp/cf.deb )
  fi
  cat >/etc/systemd/system/loopmates-tunnel.service <<EOF
[Unit]
Description=Cloudflare quick tunnel for Loopmates browser
After=loopmates-browser.service
[Service]
ExecStart=/usr/bin/cloudflared tunnel --no-autoupdate --url http://127.0.0.1:10000
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload; systemctl enable --now loopmates-tunnel; sleep 8
  echo; echo "Public address (set it as BROWSER_URL on the Render api service):"
  journalctl -u loopmates-tunnel --no-pager | grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' | tail -1
  echo "Note: a quick tunnel gets a NEW address whenever it restarts. For a permanent one use a named tunnel (see docs/browser-vm.md)."
fi
echo "Done. Logs: journalctl -u loopmates-browser -f"
