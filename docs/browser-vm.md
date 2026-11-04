# Browser on your Linux VM

Mates (Browser, Research, Scout, Mimo) get real-browser tools: `browser_open`, `browser_read`, `browser_click`, `browser_type`, `browser_select`, `browser_press`, `browser_scroll`, `browser_back`, `browser_wait`, `browser_tabs`, `browser_screenshot`, `browser_close`.
They run on **your VM** and sessions close after 5 idle minutes. Two engines, picked automatically by CPU:

| VM | Engine | Capacity |
|---|---|---|
| x86_64 / arm64 | Playwright + Chromium | 2 Chromium processes, up to 4 isolated sessions |
| **s390x (IBM LinuxONE)** | WebDriver + **Firefox** + geckodriver | 2 Firefox processes, 2 sessions (one per browser) |

Chromium is not built for s390x, so LinuxONE uses Firefox. 8 GB is plenty for either.

## Install (once)
1. Any Ubuntu/Debian/RHEL-family VM on x86_64, arm64 or s390x (`uname -m`).
2. On the VM:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/StarDust-Git-Code/loop/main/backend/scripts/vm-browser-setup.sh -o setup.sh
   sudo SERVICE_SECRET='<the SERVICE_SECRET from your Render api service>' bash setup.sh --tunnel
   ```
   It installs Node 20, the browser, a `loopmates-browser` systemd service (auto-restart, 6 GB memory cap) and a free public tunnel, then prints an `https://` address. On s390x it installs Firefox from your distro and **builds geckodriver from source** (Mozilla ships no s390x binary; takes 5-15 minutes, about 2 GB RAM), and uses an ssh tunnel (localhost.run) because cloudflared has no s390x build.
3. On Render, api service: set `BROWSER_URL` to that address and redeploy.

A free quick tunnel gets a new address when it restarts. For a permanent one on x86_64/arm64: `cloudflared tunnel login`, `cloudflared tunnel create loopmates-browser`, route a hostname to `http://127.0.0.1:10000`, and run it as a service. Or put Caddy in front with a domain.

## Safety built in
- Every request is signed with `SERVICE_SECRET`; the service listens on localhost only behind the tunnel.
- Pages cannot reach private networks, localhost or cloud metadata (DNS is checked too). `BROWSER_ALLOW_PRIVATE=1` turns this off for testing. On the Chromium engine every request is checked; on the Firefox engine every page navigation is checked (a public page could still make background requests to private addresses, but the Mate can only read what the page shows).
- Password, card and one-time-code fields are refused: the Mate asks you to do that step.
- Downloads, permissions (camera, location) and service workers are off. Each chat/run gets its own isolated context.

## Check it
`curl -s localhost:10000/healthz` on the VM, and `node backend/scripts/browser-test.mjs` runs 10 end-to-end checks against either engine (`BROWSER_ENGINE=webdriver BROWSER_BINARY=... GECKODRIVER_PATH=...` for Firefox).

**Tested vs not:** both engines pass the 10 checks here (Playwright with Chromium; the WebDriver engine driven through chromedriver). Firefox + geckodriver on a real s390x machine has not been run yet, so expect to fix small things on first install.
