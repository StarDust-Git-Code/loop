#!/usr/bin/env bash
# Installs the Loopmates browser service on a Linux VM (Ubuntu/Debian, x86_64 or arm64) as a systemd service.
#   curl -fsSL https://raw.githubusercontent.com/StarDust-Git-Code/loop/main/backend/scripts/vm-browser-setup.sh -o setup.sh
#   sudo SERVICE_SECRET='<same value as on the Render api service>' bash setup.sh [--tunnel]
# --tunnel also sets up a free public tunnel so Render can reach the VM without opening any port
# (cloudflared on x86_64/arm64, an ssh tunnel on s390x).
# Works on x86_64, arm64 (Chromium via Playwright) and s390x / IBM LinuxONE (Firefox + geckodriver).
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Run with sudo."; exit 1; }
: "${SERVICE_SECRET:?Set SERVICE_SECRET to the same value the Render api service uses}"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|aarch64) ENGINE=playwright ;;
  s390x) ENGINE=webdriver ;;   # IBM LinuxONE: no Chromium exists, so Firefox + geckodriver
  *) echo "Unsupported CPU: $ARCH"; exit 2 ;;
esac
RAM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
echo "VM: $ARCH, ${RAM_MB} MB RAM"

if command -v apt-get >/dev/null; then PM=apt; apt-get update -y; apt-get install -y curl git ca-certificates openssh-client
elif command -v dnf >/dev/null; then PM=dnf; dnf install -y curl git ca-certificates openssh-clients
else echo "Need apt or dnf (Debian/Ubuntu/RHEL family)."; exit 2; fi
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  if [ "$PM" = apt ]; then curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs
  else curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - && dnf install -y nodejs; fi
fi

id loopmates >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin loopmates
APP=/opt/loopmates
if [ -d "$APP/.git" ]; then git -C "$APP" pull --ff-only; else git clone --depth 1 https://github.com/StarDust-Git-Code/loop.git "$APP"; fi
cd "$APP/backend"
npm ci --omit=dev
EXTRA_ENV=""
if [ "$ENGINE" = playwright ]; then
  export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
  npx playwright-core install --with-deps chromium
  EXTRA_ENV="PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers"
else
  # s390x: Firefox from the distro, geckodriver built from source (Mozilla ships no s390x binary; Rust supports s390x)
  if [ "$PM" = apt ]; then
    apt-get install -y firefox-esr 2>/dev/null || { apt-get install -y software-properties-common && add-apt-repository -y ppa:mozillateam/ppa && printf 'Package: *\nPin: release o=LP-PPA-mozillateam\nPin-Priority: 1001\n' >/etc/apt/preferences.d/mozilla-firefox && apt-get update -y && apt-get install -y firefox-esr; }
    apt-get install -y cargo build-essential pkg-config libssl-dev xvfb fonts-dejavu-core
  else dnf install -y firefox cargo gcc openssl-devel dejavu-sans-fonts; fi
  FF="$(command -v firefox-esr || command -v firefox)"; [ -n "$FF" ] || { echo "Firefox could not be installed on this OS. Tell me the OS (cat /etc/os-release) and we will adapt."; exit 3; }
  if ! command -v geckodriver >/dev/null && [ ! -x /usr/local/bin/geckodriver ]; then
    echo "Building geckodriver (5-15 minutes, needs about 2 GB RAM)..."
    CARGO_HOME=/opt/cargo cargo install geckodriver --root /usr/local
  fi
  GD="$(command -v geckodriver || echo /usr/local/bin/geckodriver)"
  echo "Firefox: $($FF --version)  geckodriver: $($GD --version | head -1)"
  EXTRA_ENV="BROWSER_ENGINE=webdriver
BROWSER_BINARY=$FF
GECKODRIVER_PATH=$GD
MOZ_HEADLESS=1
HOME=/home/loopmates"
fi
chown -R loopmates:loopmates "$APP"

# 2 Chromium instances; at most 4 sessions (about 600 MB each in the worst case) leaves headroom on 8 GB
cat >/etc/loopmates-browser.env <<EOF
SERVICE_SECRET=$SERVICE_SECRET
PORT=10000
HOST=127.0.0.1
BROWSER_INSTANCES=2
BROWSER_MAX_SESSIONS=4
BROWSER_IDLE_SECONDS=300
NODE_ENV=production
$EXTRA_ENV
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
  if [ "$ARCH" = s390x ]; then
    # cloudflared has no s390x build: an ssh reverse tunnel needs no extra software (localhost.run, free, https address)
    cat >/etc/systemd/system/loopmates-tunnel.service <<EOF
[Unit]
Description=Public tunnel for Loopmates browser (localhost.run)
After=loopmates-browser.service network-online.target
[Service]
ExecStart=/usr/bin/ssh -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=30 -o ExitOnForwardFailure=yes -R 80:127.0.0.1:10000 nokey@localhost.run
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload; systemctl enable --now loopmates-tunnel; sleep 10
    echo; echo "Public address (set it as BROWSER_URL on the Render api service):"
    journalctl -u loopmates-tunnel --no-pager | grep -o 'https://[a-z0-9]*\.lhr\.life' | tail -1
  else
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
  fi
  echo "Note: a free quick tunnel gets a NEW address whenever it restarts. Re-run: journalctl -u loopmates-tunnel | grep https and update BROWSER_URL."
fi
echo "Done. Logs: journalctl -u loopmates-browser -f"
