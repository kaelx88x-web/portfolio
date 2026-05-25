# Portfolio Connector — Design Spec

## Goal

Build a Windows system tray application (`PortfolioConnector.exe`) that bundles `moomoo-service` and the agent push logic into a single distributable executable. Users install Moomoo OpenD as normal, then run this one `.exe` to connect their local broker data to the SaaS web app — no Python, no pip, no separate config files.

## Architecture

```
PortfolioConnector.exe  (PyInstaller bundle)
├── bridge.py           starts moomoo-service as hidden subprocess
├── pusher.py           polls moomoo-service, pushes to SaaS server
├── tray.py             pystray system tray icon + menu
├── windows/            tkinter popup windows (setup, settings, logs)
├── config.py           reads/writes config.json in %APPDATA%
└── autostart.py        Windows registry autostart
```

The connector starts `moomoo-service` internally as a hidden subprocess. From the user's perspective there is one thing running — the tray icon. The moomoo-service process is invisible and managed automatically.

## Tech Stack

- **Python 3.11** — bundled inside the .exe via PyInstaller
- **pystray** — system tray icon and menu
- **Pillow (PIL)** — generate tray icon images at runtime
- **tkinter** — built-in Python GUI for setup/settings/logs windows
- **httpx** — HTTP client for push requests and health checks
- **PyInstaller** — packages everything into one `PortfolioConnector.exe`
- **moomoo-openapi** — already used in `moomoo-service/main.py`

## File Structure

New folder `connector/` at project root:

```
connector/
├── main.py              Entry point. Bootstraps config, starts bridge + pusher, creates tray.
├── tray.py              pystray Icon subclass. Owns menu rebuild and icon state.
├── bridge.py            Manages moomoo-service subprocess. Health-checks /status endpoint.
├── pusher.py            Push loop thread. Polls bridge, POSTs to server, updates state.
├── config.py            Read/write %APPDATA%\PortfolioConnector\config.json
├── autostart.py         Add/remove HKCU registry run key for Windows autostart.
├── windows/
│   ├── __init__.py
│   ├── setup.py         First-run tkinter dialog: API key + server URL + autostart toggle.
│   ├── settings.py      Settings tkinter window: same fields as setup + push interval.
│   └── logs.py          Scrollable log viewer (reads log file, auto-refreshes).
├── assets/
│   ├── icon_green.png   16x16 tray icon — connected state
│   ├── icon_yellow.png  16x16 tray icon — OpenD offline
│   └── icon_red.png     16x16 tray icon — error / not configured
└── build.spec           PyInstaller spec: one-file mode, includes moomoo-service/
```

## Config

Stored at `%APPDATA%\PortfolioConnector\config.json`:

```json
{
  "server_url": "https://portfolioai.app",
  "api_key": "agent_...",
  "push_interval_seconds": 300,
  "retry_interval_seconds": 30,
  "autostart": true
}
```

Config is created on first successful setup. If missing at launch, the setup window opens automatically.

## States

| State | Tray Icon | Description |
|-------|-----------|-------------|
| `unconfigured` | 🔴 Red | No config.json — opens setup window |
| `starting` | 🟡 Yellow | moomoo-service subprocess starting |
| `opend_offline` | 🟡 Yellow | moomoo-service up, OpenD not reachable |
| `connected` | 🟢 Green | OpenD connected, pushing normally |
| `push_error` | 🔴 Red | Server unreachable or 401/500 response |

Icon colour updates whenever state changes. Tooltip shows state + last push time.

## Tray Menu

Right-click menu rendered by pystray:

```
● Portfolio Connector
  OpenD: Connected  ·  Server: OK
─────────────────────────────────
  📤 Last push: 2 min ago
  🔄 Next push: 3 min
─────────────────────────────────
  🔄 Push Now
  ⚙️  Settings
  📋  View Logs
─────────────────────────────────
  ✕  Exit
```

- **Push Now** — triggers immediate push outside normal interval
- **Settings** — opens settings window (tkinter)
- **View Logs** — opens log viewer window (tkinter)
- **Exit** — stops pusher thread, stops moomoo-service subprocess, exits

Menu is rebuilt (pystray requires full rebuild) whenever state changes.

## First Run Flow

1. `main.py` runs → checks for `config.json`
2. **Not found** → opens `windows/setup.py` (tkinter dialog):
   - Field: API Key (paste from web app Settings → Agent page)
   - Field: Server URL (pre-filled: `https://portfolioai.app`)
   - Checkbox: "Start with Windows" (default: checked)
   - Button: **Connect** → validate key format → save config → register autostart if checked → start services
3. **Found** → skip setup, start bridge + pusher, show tray icon

## Bridge (`bridge.py`)

Responsibilities:
- Locate `moomoo-service/main.py` (or bundled path in PyInstaller)
- Start `uvicorn` as subprocess with `stdout=PIPE, stderr=PIPE`
- Expose `is_healthy() → bool` — GET `http://127.0.0.1:8001/status`, returns True if 200
- Expose `stop()` — terminate subprocess gracefully
- Log subprocess stdout/stderr to app log file

moomoo-service listens on `127.0.0.1:8001` (not exposed externally).

## Pusher (`pusher.py`)

Runs in a daemon thread:

```
loop:
  if not bridge.is_healthy():
    state = opend_offline
    sleep(retry_interval)
    continue

  data = GET http://127.0.0.1:8001/paper/dashboard
  if data ok:
    POST server_url/api/agent/push  Bearer api_key  body=data
    if 200: state = connected, record last_push_at
    if 401: state = push_error, log "Invalid API key"
    if other error: state = push_error
    sleep(push_interval)
  else:
    state = opend_offline
    sleep(retry_interval)
```

Pusher updates a shared `AppState` dataclass that `tray.py` reads for menu text and icon.

## Logging

- Log file: `%APPDATA%\PortfolioConnector\logs\connector.log`
- Rotate at 1 MB, keep 3 files (RotatingFileHandler)
- Log viewer (`windows/logs.py`) tails the file, refreshes every 2 seconds
- Bridge subprocess stdout/stderr written to same log

## Build & Distribution

```bash
cd connector
pip install pyinstaller pystray pillow httpx
pyinstaller build.spec
# Output: connector/dist/PortfolioConnector.exe  (~40 MB)
```

`build.spec` uses `--onefile` mode. Bundles:
- All Python dependencies
- `moomoo-service/` folder (as data files)
- `assets/` icons

User downloads `PortfolioConnector.exe`, double-clicks, pastes API key, done.

## Known Pitfalls (must handle in implementation)

| Problem | Fix |
|---------|-----|
| Tray icon disappears on state change | Always call `icon.update_menu()` after rebuilding the menu |
| tkinter crashes from non-main thread | Run all tkinter windows with `root.after(0, ...)` or a separate `Thread` with its own `mainloop()` — never call tkinter from pusher/bridge threads directly |
| PyInstaller can't find moomoo-service | Use `sys._MEIPASS` path resolution in `bridge.py` to locate bundled `moomoo-service/` at runtime |
| SmartScreen blocks .exe on first run | Expected for unsigned code — spec must tell users to click "More info → Run anyway" in the setup guide |
| pystray hidden import missing | Add `"pystray._win32"` to `hiddenimports` in `build.spec` — PyInstaller misses it |

## What Is NOT in Scope

- macOS / Linux support (Windows only for MVP)
- Auto-update mechanism
- Code signing / SmartScreen bypass (user may see SmartScreen warning — acceptable for MVP)
- Multi-account support (one API key per install)
- Deep-link (`portfolioconnect://`) setup flow — add later

## Integration with Existing Codebase

- `moomoo-service/main.py` — used as-is, started as subprocess by `bridge.py`
- `portfolio-agent/agent.py` — logic ported into `pusher.py`, original file kept for reference
- `src/routes/settings/agent/+page.svelte` — no changes needed; user copies API key from here
- `src/routes/api/agent/push/+server.ts` — no changes needed; connector POSTs here
