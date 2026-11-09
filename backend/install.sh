#!/usr/bin/env bash
# Loopmates server installer for Linux (Ubuntu/Debian, Fedora, others with systemd). x86_64, arm64 and s390x.
#   ./install.sh            per-user service (systemd --user, starts at boot with lingering enabled)
#   ./install.sh --system   system service (needs sudo; runs as the current user)
#   ./install.sh --uninstall
# What it does: installs Node.js 22 if missing, runs npm ci, creates ~/.local/share/loopmates, registers the service,
# links the `loopmates` command into ~/.local/bin, starts the server and prints the setup address.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
MODE="user"; [ "${1:-}" = "--system" ] && MODE="system"
UNIT=loopmates.service

if [ "${1:-}" = "--uninstall" ]; then
  systemctl --user disable --now $UNIT 2>/dev/null || true; rm -f "$HOME/.config/systemd/user/$UNIT"
  sudo systemctl disable --now $UNIT 2>/dev/null || true; sudo rm -f "/etc/systemd/system/$UNIT" 2>/dev/null || true
  rm -f "$HOME/.local/bin/loopmates"
  echo "Uninstalled. Your data stays in ${XDG_DATA_HOME:-$HOME/.local/share}/loopmates."; exit 0
fi

node_major() { node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/' || echo 0; }
if [ "$(node_major)" -lt 22 ] 2>/dev/null || ! command -v node >/dev/null; then
  echo "Installing Node.js 22..."
  if command -v apt-get >/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs
  elif command -v dnf >/dev/null; then
    curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash - && sudo dnf install -y nodejs
  else
    echo "Install Node.js 22+ from https://nodejs.org (or your package manager), then run this again."; exit 1
  fi
fi
echo "Node $(node -v) on $(uname -m)"
command -v git >/dev/null || echo "Note: git is not installed. The coder needs it for repositories (sudo apt install git)."

cd "$ROOT"
npm ci --omit=dev
mkdir -p "${XDG_DATA_HOME:-$HOME/.local/share}/loopmates" "$HOME/.local/bin"
ln -sf "$ROOT/bin/loopmates.js" "$HOME/.local/bin/loopmates"; chmod +x "$ROOT/bin/loopmates.js"
NODE="$(command -v node)"

if [ "$(uname -m)" = "s390x" ]; then
  echo "s390x: the Browser Mate uses Firefox + geckodriver (see scripts/vm-browser-setup.sh)."
fi

if [ "$MODE" = "system" ]; then
  sudo tee "/etc/systemd/system/$UNIT" >/dev/null <<EOF
[Unit]
Description=Loopmates server
After=network-online.target
Wants=network-online.target
[Service]
User=$USER
WorkingDirectory=$ROOT
Environment=HOME=$HOME
ExecStart=$NODE $ROOT/bin/loopmates.js run
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
EOF
  sudo systemctl daemon-reload && sudo systemctl enable --now $UNIT
else
  mkdir -p "$HOME/.config/systemd/user"
  cat > "$HOME/.config/systemd/user/$UNIT" <<EOF
[Unit]
Description=Loopmates server
After=network-online.target
[Service]
WorkingDirectory=$ROOT
ExecStart=$NODE $ROOT/bin/loopmates.js run
Restart=always
RestartSec=5
[Install]
WantedBy=default.target
EOF
  systemctl --user daemon-reload && systemctl --user enable --now $UNIT
  loginctl enable-linger "$USER" 2>/dev/null || echo "Tip: run 'sudo loginctl enable-linger $USER' so Loopmates also runs when you are logged out."
fi

for i in $(seq 1 40); do curl -fsS http://127.0.0.1:8787/healthz >/dev/null 2>&1 && break; sleep 0.5; done
KEY="$(cat "${XDG_DATA_HOME:-$HOME/.local/share}/loopmates/setup.key" 2>/dev/null || true)"
echo
echo "Loopmates is running. Open the setup page on this computer:"
echo "  http://localhost:8787/setup?key=$KEY"
echo "On a headless server, tunnel the port first:  ssh -L 8787:127.0.0.1:8787 $USER@<this-machine>"
command -v xdg-open >/dev/null && [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ] && xdg-open "http://localhost:8787/setup?key=$KEY" >/dev/null 2>&1 || true
