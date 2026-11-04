# Browser on your Linux VM

Mates (Browser, Research, Scout, Mimo) get real-browser tools: `browser_open`, `browser_read`, `browser_click`, `browser_type`, `browser_select`, `browser_press`, `browser_scroll`, `browser_back`, `browser_wait`, `browser_tabs`, `browser_screenshot`, `browser_close`.
They run on **your VM**: a pool of 2 headless Chromium instances, up to 4 isolated sessions (about 600 MB each worst case, 8 GB is plenty). Sessions close after 5 idle minutes.

## Install (once)
1. The VM must be **x86_64 or arm64** (`uname -m`). Chromium is not built for s390x (IBM LinuxONE), so Playwright cannot run there.
2. On the VM:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/StarDust-Git-Code/loop/main/backend/scripts/vm-browser-setup.sh -o setup.sh
   sudo SERVICE_SECRET='<the SERVICE_SECRET from your Render api service>' bash setup.sh --tunnel
   ```
   It installs Node 20, Chromium, a `loopmates-browser` systemd service (auto-restart, 6 GB memory cap) and a Cloudflare tunnel, then prints a `https://....trycloudflare.com` address.
3. On Render, api service: set `BROWSER_URL` to that address and redeploy.

A quick tunnel gets a new address when it restarts. For a permanent one: `cloudflared tunnel login`, `cloudflared tunnel create loopmates-browser`, route a hostname to `http://127.0.0.1:10000`, and run it as a service. Or put Caddy in front with a domain.

## Safety built in
- Every request is signed with `SERVICE_SECRET`; the service listens on localhost only behind the tunnel.
- Pages cannot reach private networks, localhost or cloud metadata (DNS is checked too). `BROWSER_ALLOW_PRIVATE=1` turns this off for testing.
- Password, card and one-time-code fields are refused: the Mate asks you to do that step.
- Downloads, permissions (camera, location) and service workers are off. Each chat/run gets its own isolated context.

## Check it
`curl -s localhost:10000/healthz` on the VM, and `node backend/scripts/browser-test.mjs` runs 10 end-to-end checks (set `BROWSER_EXECUTABLE` if Chromium is not installed by Playwright).
