# Running Loopmates on an IBM LinuxONE (s390x) or other Linux VM

The browser is now part of the single Loopmates server (`backend/src/browser/`), so there is no separate browser service to deploy. Install the whole server on the VM with `backend/install.sh`.

On s390x there is no Chromium build, so the server picks the WebDriver engine (Firefox + geckodriver) automatically:

```bash
sudo apt-get install -y firefox-esr   # or your distro's Firefox
# geckodriver for s390x: build it with cargo, or use your distro package if it has one
export GECKODRIVER_PATH=/usr/local/bin/geckodriver   # or set it on the setup page environment
```

`backend/scripts/vm-browser-setup.sh` has the tested commands for Firefox and geckodriver on s390x.

On a headless VM, open the setup page through an SSH tunnel: `ssh -L 8787:127.0.0.1:8787 user@vm`, then browse to the address `install.sh` printed.

Settings that still apply: `BROWSER_ENGINE` (auto | playwright | webdriver), `BROWSER_INSTANCES` (2), `BROWSER_MAX_SESSIONS` (4), `BROWSER_IDLE_SECONDS` (300), `BROWSER_BINARY`, `GECKODRIVER_PATH`, `BROWSER_EXECUTABLE`.
