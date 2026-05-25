# Portfolio Connector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Windows system tray app (`PortfolioConnector.exe`) that bundles moomoo-service and the push-agent logic into one double-click executable — no Python install required on the user's PC.

**Architecture:** A new `connector/` folder contains all Python source. PyInstaller bundles it with moomoo-service as a data directory into a single `.exe`. At runtime, the connector starts moomoo-service as a hidden subprocess, runs a push loop in a daemon thread, and exposes status via a pystray system tray icon with a right-click menu.

**Tech Stack:** Python 3.11, pystray, Pillow, tkinter (stdlib), httpx, PyInstaller, winreg (stdlib)

---

## File Map

| File | Purpose |
|------|---------|
| `connector/config.py` | Read/write `%APPDATA%\PortfolioConnector\config.json` |
| `connector/logger.py` | RotatingFileHandler → `%APPDATA%\PortfolioConnector\logs\connector.log` |
| `connector/autostart.py` | HKCU registry run key for Windows autostart |
| `connector/bridge.py` | Start/stop moomoo-service subprocess, health-check |
| `connector/state.py` | `AppState` dataclass shared between pusher and tray |
| `connector/pusher.py` | Push loop daemon thread |
| `connector/tray.py` | pystray Icon, menu rebuild, icon colour by state |
| `connector/windows/__init__.py` | Empty |
| `connector/windows/setup.py` | First-run tkinter dialog |
| `connector/windows/settings.py` | Settings tkinter window |
| `connector/windows/logs.py` | Log viewer tkinter window |
| `connector/assets/make_icons.py` | Script to generate 3 PNG icon files with Pillow |
| `connector/assets/icon_green.png` | Generated — connected state |
| `connector/assets/icon_yellow.png` | Generated — OpenD offline |
| `connector/assets/icon_red.png` | Generated — error / unconfigured |
| `connector/main.py` | Entry point — wires everything together |
| `connector/requirements.txt` | pystray, pillow, httpx, pyinstaller |
| `connector/build.spec` | PyInstaller one-file spec |
| `connector/tests/test_config.py` | Tests for config module |
| `connector/tests/test_autostart.py` | Tests for autostart module (mock winreg) |
| `connector/tests/test_pusher.py` | Tests for pusher logic (mock bridge + httpx) |

---

### Task 1: Project scaffold + config module

**Files:**
- Create: `connector/config.py`
- Create: `connector/requirements.txt`
- Create: `connector/tests/__init__.py`
- Create: `connector/tests/test_config.py`

- [ ] **Step 1: Create folder structure**

```bash
mkdir connector
mkdir connector\tests
mkdir connector\windows
mkdir connector\assets
echo. > connector\__init__.py
echo. > connector\windows\__init__.py
echo. > connector\tests\__init__.py
```

- [ ] **Step 2: Create `connector/requirements.txt`**

```
pystray==0.19.5
Pillow==10.4.0
httpx==0.27.2
pyinstaller==6.11.0
```

- [ ] **Step 3: Install deps**

```bash
cd connector
pip install -r requirements.txt
```

Expected: all 4 packages install without error.

- [ ] **Step 4: Write the failing tests for config**

Create `connector/tests/test_config.py`:

```python
import json
import os
import pytest
from pathlib import Path
from unittest.mock import patch, mock_open

# Adjust sys.path so we can import from connector/
import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from connector.config import load_config, save_config, config_path, DEFAULT_SERVER_URL


def test_config_path_is_in_appdata(tmp_path, monkeypatch):
    monkeypatch.setenv("APPDATA", str(tmp_path))
    from connector import config as cfg_mod
    import importlib; importlib.reload(cfg_mod)
    assert str(tmp_path) in str(cfg_mod.config_path())


def test_load_config_returns_defaults_when_missing(tmp_path, monkeypatch):
    monkeypatch.setenv("APPDATA", str(tmp_path))
    import importlib
    from connector import config as cfg_mod
    importlib.reload(cfg_mod)
    result = cfg_mod.load_config()
    assert result["server_url"] == DEFAULT_SERVER_URL
    assert result["api_key"] == ""
    assert result["push_interval_seconds"] == 300
    assert result["retry_interval_seconds"] == 30
    assert result["autostart"] is True


def test_save_and_reload_roundtrip(tmp_path, monkeypatch):
    monkeypatch.setenv("APPDATA", str(tmp_path))
    import importlib
    from connector import config as cfg_mod
    importlib.reload(cfg_mod)
    data = {
        "server_url": "https://example.com",
        "api_key": "agent_abc123",
        "push_interval_seconds": 600,
        "retry_interval_seconds": 60,
        "autostart": False,
    }
    cfg_mod.save_config(data)
    loaded = cfg_mod.load_config()
    assert loaded["api_key"] == "agent_abc123"
    assert loaded["push_interval_seconds"] == 600


def test_is_configured_false_when_no_key(tmp_path, monkeypatch):
    monkeypatch.setenv("APPDATA", str(tmp_path))
    import importlib
    from connector import config as cfg_mod
    importlib.reload(cfg_mod)
    assert cfg_mod.is_configured() is False


def test_is_configured_true_when_key_set(tmp_path, monkeypatch):
    monkeypatch.setenv("APPDATA", str(tmp_path))
    import importlib
    from connector import config as cfg_mod
    importlib.reload(cfg_mod)
    cfg_mod.save_config({"api_key": "agent_abc", "server_url": "https://x.com",
                         "push_interval_seconds": 300, "retry_interval_seconds": 30,
                         "autostart": True})
    assert cfg_mod.is_configured() is True
```

- [ ] **Step 5: Run tests — confirm they FAIL**

```bash
cd connector
python -m pytest tests/test_config.py -v
```

Expected: `ModuleNotFoundError: No module named 'connector.config'`

- [ ] **Step 6: Implement `connector/config.py`**

```python
# connector/config.py
import json
import os
from pathlib import Path

DEFAULT_SERVER_URL = "https://portfolioai.app"

_DEFAULTS = {
    "server_url": DEFAULT_SERVER_URL,
    "api_key": "",
    "push_interval_seconds": 300,
    "retry_interval_seconds": 30,
    "autostart": True,
}


def config_path() -> Path:
    appdata = os.environ.get("APPDATA", str(Path.home()))
    return Path(appdata) / "PortfolioConnector" / "config.json"


def load_config() -> dict:
    """Return config dict. Missing keys fall back to defaults."""
    path = config_path()
    if not path.exists():
        return dict(_DEFAULTS)
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        return {**_DEFAULTS, **data}
    except Exception:
        return dict(_DEFAULTS)


def save_config(data: dict) -> None:
    """Write config dict to disk, creating directory if needed."""
    path = config_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def is_configured() -> bool:
    """True if a non-empty api_key exists in config."""
    cfg = load_config()
    return bool(cfg.get("api_key", "").startswith("agent_"))
```

- [ ] **Step 7: Run tests — confirm they PASS**

```bash
python -m pytest tests/test_config.py -v
```

Expected: 5 tests PASS.

- [ ] **Step 8: Commit**

```bash
cd ..
git add connector/
git commit -m "feat(connector): scaffold + config module with tests"
```

---

### Task 2: Logging module

**Files:**
- Create: `connector/logger.py`

(No separate test file — logging setup is tested implicitly through other modules.)

- [ ] **Step 1: Create `connector/logger.py`**

```python
# connector/logger.py
import logging
import os
from logging.handlers import RotatingFileHandler
from pathlib import Path


def log_path() -> Path:
    appdata = os.environ.get("APPDATA", str(Path.home()))
    return Path(appdata) / "PortfolioConnector" / "logs" / "connector.log"


def setup_logger(name: str = "connector", level: int = logging.INFO) -> logging.Logger:
    """
    Set up and return a logger that writes to both stderr and a rotating file.
    Safe to call multiple times — returns same logger instance.
    """
    logger = logging.getLogger(name)
    if logger.handlers:
        return logger  # already configured

    logger.setLevel(level)
    fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S")

    # Console handler (visible in dev, hidden in PyInstaller --noconsole build)
    ch = logging.StreamHandler()
    ch.setFormatter(fmt)
    logger.addHandler(ch)

    # Rotating file handler
    path = log_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    fh = RotatingFileHandler(path, maxBytes=1_000_000, backupCount=3, encoding="utf-8")
    fh.setFormatter(fmt)
    logger.addHandler(fh)

    return logger


def get_logger() -> logging.Logger:
    return logging.getLogger("connector")
```

- [ ] **Step 2: Smoke-test manually**

```bash
cd connector
python -c "from logger import setup_logger; log = setup_logger(); log.info('test ok')"
```

Expected: `HH:MM:SS [INFO] test ok` printed to console. No errors.

- [ ] **Step 3: Commit**

```bash
cd ..
git add connector/logger.py
git commit -m "feat(connector): logging module with rotating file handler"
```

---

### Task 3: Autostart module

**Files:**
- Create: `connector/autostart.py`
- Create: `connector/tests/test_autostart.py`

- [ ] **Step 1: Write failing tests**

Create `connector/tests/test_autostart.py`:

```python
import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

# Mock winreg before import (not available outside Windows in CI)
winreg_mock = MagicMock()
sys.modules["winreg"] = winreg_mock

from connector.autostart import enable_autostart, disable_autostart, is_autostart_enabled

APP_NAME = "PortfolioConnector"


def test_enable_autostart_writes_registry():
    winreg_mock.reset_mock()
    winreg_mock.OpenKey.return_value.__enter__ = lambda s: MagicMock()
    winreg_mock.OpenKey.return_value.__exit__ = MagicMock(return_value=False)
    enable_autostart(exe_path="C:\\test\\PortfolioConnector.exe")
    winreg_mock.SetValueEx.assert_called_once()
    args = winreg_mock.SetValueEx.call_args[0]
    assert args[1] == APP_NAME
    assert "PortfolioConnector.exe" in args[4]


def test_disable_autostart_deletes_registry():
    winreg_mock.reset_mock()
    winreg_mock.OpenKey.return_value.__enter__ = lambda s: MagicMock()
    winreg_mock.OpenKey.return_value.__exit__ = MagicMock(return_value=False)
    disable_autostart()
    winreg_mock.DeleteValue.assert_called_once()
    args = winreg_mock.DeleteValue.call_args[0]
    assert args[1] == APP_NAME


def test_disable_autostart_ignores_missing_key():
    winreg_mock.reset_mock()
    winreg_mock.DeleteValue.side_effect = FileNotFoundError
    # Should not raise
    disable_autostart()
```

- [ ] **Step 2: Run tests — confirm FAIL**

```bash
cd connector
python -m pytest tests/test_autostart.py -v
```

Expected: `ImportError` or `ModuleNotFoundError` for `connector.autostart`.

- [ ] **Step 3: Implement `connector/autostart.py`**

```python
# connector/autostart.py
import sys
import winreg
from pathlib import Path

APP_NAME = "PortfolioConnector"
_RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"


def _exe_path() -> str:
    """Return path to the running executable."""
    return sys.executable if not getattr(sys, "frozen", False) else sys.executable


def enable_autostart(exe_path: str | None = None) -> None:
    """Add app to Windows startup via HKCU registry."""
    path = exe_path or _exe_path()
    with winreg.OpenKey(
        winreg.HKEY_CURRENT_USER, _RUN_KEY, 0, winreg.KEY_SET_VALUE
    ) as key:
        winreg.SetValueEx(key, APP_NAME, 0, winreg.REG_SZ, f'"{path}"')


def disable_autostart() -> None:
    """Remove app from Windows startup."""
    try:
        with winreg.OpenKey(
            winreg.HKEY_CURRENT_USER, _RUN_KEY, 0, winreg.KEY_SET_VALUE
        ) as key:
            winreg.DeleteValue(key, APP_NAME)
    except (FileNotFoundError, OSError):
        pass  # key didn't exist — that's fine


def is_autostart_enabled() -> bool:
    """Return True if the run key exists."""
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, _RUN_KEY) as key:
            winreg.QueryValueEx(key, APP_NAME)
            return True
    except (FileNotFoundError, OSError):
        return False
```

- [ ] **Step 4: Run tests — confirm PASS**

```bash
python -m pytest tests/test_autostart.py -v
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd ..
git add connector/autostart.py connector/tests/test_autostart.py
git commit -m "feat(connector): autostart module with HKCU registry + tests"
```

---

### Task 4: AppState dataclass

**Files:**
- Create: `connector/state.py`

- [ ] **Step 1: Create `connector/state.py`**

```python
# connector/state.py
"""
Shared mutable state between pusher thread and tray thread.
Only update via the provided helper methods (thread-safe via GIL for simple assignments).
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal

AppStatus = Literal["unconfigured", "starting", "opend_offline", "connected", "push_error"]


@dataclass
class AppState:
    status: AppStatus = "unconfigured"
    last_push_at: datetime | None = None
    next_push_in: int = 0          # seconds until next push
    opend_ok: bool = False
    server_ok: bool = True
    last_error: str = ""

    def status_line(self) -> str:
        """One-line summary for tray menu header."""
        opend = "Connected" if self.opend_ok else "Offline"
        server = "OK" if self.server_ok else "Error"
        return f"OpenD: {opend}  ·  Server: {server}"

    def push_line(self) -> str:
        """Push timing line for tray menu."""
        if self.last_push_at is None:
            return "Last push: Never"
        diff = int((datetime.now() - self.last_push_at).total_seconds())
        mins = diff // 60
        ago = f"{mins}m ago" if mins > 0 else "just now"
        nxt = f"{self.next_push_in // 60}m" if self.next_push_in >= 60 else f"{self.next_push_in}s"
        return f"Last push: {ago}  ·  Next: {nxt}"

    def icon_colour(self) -> str:
        """Return 'green', 'yellow', or 'red'."""
        if self.status == "connected":
            return "green"
        if self.status in ("starting", "opend_offline"):
            return "yellow"
        return "red"
```

- [ ] **Step 2: Quick smoke test**

```bash
cd connector
python -c "
from state import AppState
s = AppState()
print(s.icon_colour())   # red
s.status = 'connected'; s.opend_ok = True
print(s.icon_colour())   # green
print(s.status_line())   # OpenD: Connected  ·  Server: OK
"
```

Expected: `red`, `green`, `OpenD: Connected  ·  Server: OK`

- [ ] **Step 3: Commit**

```bash
cd ..
git add connector/state.py
git commit -m "feat(connector): AppState dataclass with status helpers"
```

---

### Task 5: Bridge module

**Files:**
- Create: `connector/bridge.py`
- Create: `connector/tests/test_bridge.py`

- [ ] **Step 1: Write failing tests**

Create `connector/tests/test_bridge.py`:

```python
import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from connector.bridge import Bridge


def test_is_healthy_returns_false_when_not_started():
    b = Bridge(service_dir=Path("."))
    assert b.is_healthy() is False


def test_is_healthy_returns_true_on_200(monkeypatch):
    b = Bridge(service_dir=Path("."))
    b._process = MagicMock()  # simulate started

    mock_resp = MagicMock()
    mock_resp.status_code = 200

    with patch("httpx.get", return_value=mock_resp):
        assert b.is_healthy() is True


def test_is_healthy_returns_false_on_connection_error(monkeypatch):
    import httpx
    b = Bridge(service_dir=Path("."))
    b._process = MagicMock()

    with patch("httpx.get", side_effect=httpx.ConnectError("refused")):
        assert b.is_healthy() is False


def test_stop_terminates_process():
    b = Bridge(service_dir=Path("."))
    mock_proc = MagicMock()
    b._process = mock_proc
    b.stop()
    mock_proc.terminate.assert_called_once()
    assert b._process is None
```

- [ ] **Step 2: Run tests — confirm FAIL**

```bash
cd connector
python -m pytest tests/test_bridge.py -v
```

Expected: `ModuleNotFoundError` for `connector.bridge`.

- [ ] **Step 3: Implement `connector/bridge.py`**

```python
# connector/bridge.py
"""
Manages the moomoo-service subprocess.
Uses sys._MEIPASS to locate the bundled service directory when running as a PyInstaller .exe.
"""
import subprocess
import sys
import time
from pathlib import Path

import httpx

from connector.logger import get_logger

MOOMOO_SERVICE_PORT = 8001
HEALTH_URL = f"http://127.0.0.1:{MOOMOO_SERVICE_PORT}/status"


def _bundled_service_dir() -> Path:
    """Return path to moomoo-service/ — works both in dev and inside a PyInstaller bundle."""
    if getattr(sys, "frozen", False):
        # Running inside PyInstaller bundle — data files are under sys._MEIPASS
        return Path(sys._MEIPASS) / "moomoo-service"
    # Dev mode — moomoo-service is a sibling of the connector/ folder
    return Path(__file__).parent.parent / "moomoo-service"


class Bridge:
    def __init__(self, service_dir: Path | None = None):
        self._service_dir = service_dir or _bundled_service_dir()
        self._process: subprocess.Popen | None = None
        self._log = get_logger()

    def start(self) -> None:
        """Start moomoo-service as a hidden subprocess."""
        if self._process and self._process.poll() is None:
            return  # already running

        main_py = self._service_dir / "main.py"
        if not main_py.exists():
            self._log.error("moomoo-service not found at %s", self._service_dir)
            return

        self._log.info("Starting moomoo-service from %s", self._service_dir)
        self._process = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "main:app",
             "--host", "127.0.0.1", "--port", str(MOOMOO_SERVICE_PORT),
             "--no-access-log"],
            cwd=str(self._service_dir),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
        )
        # Give it a moment to bind
        time.sleep(2)
        self._log.info("moomoo-service PID=%s", self._process.pid)

    def is_healthy(self) -> bool:
        """True if moomoo-service is running and /status returns 200."""
        if self._process is None:
            return False
        try:
            r = httpx.get(HEALTH_URL, timeout=3)
            return r.status_code == 200
        except Exception:
            return False

    def stop(self) -> None:
        """Terminate moomoo-service subprocess."""
        if self._process:
            self._log.info("Stopping moomoo-service (PID=%s)", self._process.pid)
            self._process.terminate()
            try:
                self._process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self._process.kill()
            self._process = None
```

- [ ] **Step 4: Run tests — confirm PASS**

```bash
python -m pytest tests/test_bridge.py -v
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd ..
git add connector/bridge.py connector/tests/test_bridge.py
git commit -m "feat(connector): bridge module starts/stops moomoo-service subprocess"
```

---

### Task 6: Pusher module

**Files:**
- Create: `connector/pusher.py`
- Create: `connector/tests/test_pusher.py`

- [ ] **Step 1: Write failing tests**

Create `connector/tests/test_pusher.py`:

```python
import sys
import threading
from pathlib import Path
from unittest.mock import MagicMock, patch
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from connector.state import AppState
from connector.pusher import Pusher


def _make_pusher(healthy=True, push_ok=True):
    bridge = MagicMock()
    bridge.is_healthy.return_value = healthy
    state = AppState()
    cfg = {
        "server_url": "https://example.com",
        "api_key": "agent_test",
        "push_interval_seconds": 1,
        "retry_interval_seconds": 1,
    }
    p = Pusher(bridge=bridge, state=state, cfg=cfg)
    return p, state


def test_pusher_sets_opend_offline_when_bridge_unhealthy():
    p, state = _make_pusher(healthy=False)
    with patch("connector.pusher.time.sleep"):
        p._tick()
    assert state.status == "opend_offline"
    assert state.opend_ok is False


def test_pusher_sets_connected_on_successful_push():
    p, state = _make_pusher(healthy=True)
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"ok": True, "received_at": "2026-01-01T00:00:00Z"}
    mock_resp.is_success = True

    mock_data = {"status": {"connected": True}}

    with patch("connector.pusher.httpx.get") as mock_get, \
         patch("connector.pusher.httpx.post") as mock_post:
        mock_get.return_value = MagicMock(status_code=200, json=lambda: mock_data)
        mock_post.return_value = mock_resp
        p._tick()

    assert state.status == "connected"
    assert state.opend_ok is True
    assert state.last_push_at is not None


def test_pusher_sets_push_error_on_401():
    p, state = _make_pusher(healthy=True)
    mock_resp = MagicMock()
    mock_resp.status_code = 401
    mock_resp.is_success = False

    mock_data = {"status": {"connected": True}}

    with patch("connector.pusher.httpx.get") as mock_get, \
         patch("connector.pusher.httpx.post") as mock_post:
        mock_get.return_value = MagicMock(status_code=200, json=lambda: mock_data)
        mock_post.return_value = mock_resp
        p._tick()

    assert state.status == "push_error"
    assert "API key" in state.last_error


def test_pusher_is_daemon_thread():
    p, _ = _make_pusher()
    t = p.start()
    assert t.daemon is True
    p.stop()
```

- [ ] **Step 2: Run tests — confirm FAIL**

```bash
cd connector
python -m pytest tests/test_pusher.py -v
```

Expected: `ModuleNotFoundError` for `connector.pusher`.

- [ ] **Step 3: Implement `connector/pusher.py`**

```python
# connector/pusher.py
import threading
import time
from datetime import datetime, timezone

import httpx

from connector.bridge import Bridge, MOOMOO_SERVICE_PORT
from connector.logger import get_logger
from connector.state import AppState

MOOMOO_BASE = f"http://127.0.0.1:{MOOMOO_SERVICE_PORT}"
AGENT_VERSION = "1.1.0"


class Pusher:
    def __init__(self, bridge: Bridge, state: AppState, cfg: dict):
        self._bridge = bridge
        self._state = state
        self._cfg = cfg
        self._stop_event = threading.Event()
        self._push_now_event = threading.Event()
        self._log = get_logger()

    def _fetch_local(self, path: str) -> dict | None:
        try:
            r = httpx.get(f"{MOOMOO_BASE}{path}", timeout=8)
            r.raise_for_status()
            return r.json()
        except Exception:
            return None

    def _build_payload(self) -> dict | None:
        status = self._fetch_local("/status")
        if status is None:
            return None
        paper = self._fetch_local("/paper/dashboard")
        payload: dict = {
            "push_type": "full",
            "agent_version": AGENT_VERSION,
            "status": status,
            "synced_at": datetime.now(timezone.utc).isoformat(),
        }
        if paper and not paper.get("error"):
            payload.update({
                "account":      paper.get("account"),
                "account_info": paper.get("account_info"),
                "positions":    paper.get("positions", []),
                "orders":       paper.get("orders", []),
                "deals":        paper.get("deals", []),
            })
        return payload

    def _push(self, payload: dict) -> bool:
        server_url = self._cfg["server_url"].rstrip("/")
        api_key = self._cfg["api_key"]
        url = f"{server_url}/api/agent/push"
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        try:
            r = httpx.post(url, json=payload, headers=headers, timeout=15)
            if r.status_code == 401:
                self._state.last_error = "Invalid API key — update in Settings."
                self._log.error("Push failed: invalid API key")
                return False
            if not r.is_success:
                self._state.last_error = f"Server error {r.status_code}"
                self._log.warning("Push failed: %s — %s", r.status_code, r.text[:200])
                return False
            self._log.info("Push OK — %s", r.json().get("received_at", ""))
            return True
        except httpx.ConnectError:
            self._state.last_error = f"Cannot reach {server_url}"
            self._log.warning("Push failed: cannot reach server")
            return False
        except Exception as exc:
            self._state.last_error = str(exc)
            self._log.warning("Push error: %s", exc)
            return False

    def _tick(self) -> int:
        """Run one push cycle. Returns seconds to sleep before next tick."""
        retry = int(self._cfg.get("retry_interval_seconds", 30))
        interval = int(self._cfg.get("push_interval_seconds", 300))

        if not self._bridge.is_healthy():
            self._state.status = "opend_offline"
            self._state.opend_ok = False
            self._state.next_push_in = retry
            return retry

        self._state.opend_ok = True
        payload = self._build_payload()
        if payload is None:
            self._state.status = "opend_offline"
            self._state.opend_ok = False
            self._state.next_push_in = retry
            return retry

        ok = self._push(payload)
        if ok:
            self._state.status = "connected"
            self._state.server_ok = True
            self._state.last_push_at = datetime.now()
            self._state.last_error = ""
            self._state.next_push_in = interval
            return interval
        else:
            self._state.status = "push_error"
            self._state.server_ok = False
            self._state.next_push_in = retry
            return retry

    def _run(self) -> None:
        self._log.info("Pusher started")
        while not self._stop_event.is_set():
            try:
                sleep_for = self._tick()
            except Exception as exc:
                self._log.error("Pusher unexpected error: %s", exc)
                sleep_for = int(self._cfg.get("retry_interval_seconds", 30))

            # Sleep in 1s chunks so stop/push_now events are responsive
            for _ in range(sleep_for):
                if self._stop_event.is_set() or self._push_now_event.is_set():
                    break
                time.sleep(1)
            self._push_now_event.clear()

        self._log.info("Pusher stopped")

    def start(self) -> threading.Thread:
        t = threading.Thread(target=self._run, daemon=True, name="pusher")
        t.start()
        return t

    def stop(self) -> None:
        self._stop_event.set()

    def push_now(self) -> None:
        """Trigger an immediate push outside the normal interval."""
        self._push_now_event.set()
```

- [ ] **Step 4: Run tests — confirm PASS**

```bash
python -m pytest tests/test_pusher.py -v
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd ..
git add connector/pusher.py connector/state.py connector/tests/test_pusher.py
git commit -m "feat(connector): pusher module + AppState — push loop with error handling"
```

---

### Task 7: Icon assets

**Files:**
- Create: `connector/assets/make_icons.py`
- Create: `connector/assets/icon_green.png`
- Create: `connector/assets/icon_yellow.png`
- Create: `connector/assets/icon_red.png`

- [ ] **Step 1: Create `connector/assets/make_icons.py`**

```python
#!/usr/bin/env python3
"""Run once to generate the three tray icon PNG files."""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).parent

ICONS = {
    "icon_green.png":  (34, 197, 94),   # green
    "icon_yellow.png": (234, 179, 8),   # yellow
    "icon_red.png":    (239, 68, 68),   # red
}

for filename, colour in ICONS.items():
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    # Outer circle
    draw.ellipse([4, 4, 60, 60], fill=(*colour, 255))
    # White "P" letter for "Portfolio"
    draw.ellipse([18, 18, 46, 46], fill=(255, 255, 255, 200))
    draw.ellipse([22, 22, 42, 42], fill=(*colour, 255))
    img.save(OUT / filename)
    print(f"Created {filename}")
```

- [ ] **Step 2: Run the script to generate icons**

```bash
cd connector/assets
python make_icons.py
```

Expected:
```
Created icon_green.png
Created icon_yellow.png
Created icon_red.png
```

Verify: 3 PNG files appear in `connector/assets/`.

- [ ] **Step 3: Commit**

```bash
cd ../..
git add connector/assets/
git commit -m "feat(connector): generate tray icon PNG assets"
```

---

### Task 8: Tray module

**Files:**
- Create: `connector/tray.py`

(pystray requires a real display to test — skip unit tests, test manually in Task 11.)

- [ ] **Step 1: Create `connector/tray.py`**

```python
# connector/tray.py
"""
System tray icon and right-click menu.
IMPORTANT: Always call icon.update_menu() after rebuilding the menu — pystray
requires this or the icon disappears on state change.
"""
import threading
from pathlib import Path

from PIL import Image
import pystray
from pystray import MenuItem as Item, Menu

from connector.state import AppState
from connector.logger import get_logger

ASSETS = Path(__file__).parent / "assets"


def _load_icon(colour: str) -> Image.Image:
    path = ASSETS / f"icon_{colour}.png"
    return Image.open(path).convert("RGBA")


class ConnectorTray:
    def __init__(self, state: AppState, on_push_now, on_settings, on_logs, on_exit):
        self._state = state
        self._on_push_now = on_push_now
        self._on_settings = on_settings
        self._on_logs = on_logs
        self._on_exit = on_exit
        self._log = get_logger()
        self._icon: pystray.Icon | None = None

    def _build_menu(self) -> Menu:
        s = self._state
        return Menu(
            Item(f"Portfolio Connector", None, enabled=False),
            Item(s.status_line(), None, enabled=False),
            Menu.SEPARATOR,
            Item(s.push_line(), None, enabled=False),
            Menu.SEPARATOR,
            Item("🔄 Push Now", lambda icon, item: self._on_push_now()),
            Item("⚙️  Settings", lambda icon, item: self._on_settings()),
            Item("📋 View Logs", lambda icon, item: self._on_logs()),
            Menu.SEPARATOR,
            Item("✕  Exit", lambda icon, item: self._on_exit()),
        )

    def _refresh_loop(self) -> None:
        """Poll state every 5s and update icon + menu."""
        import time
        last_colour = None
        while self._icon and self._icon.visible:
            colour = self._state.icon_colour()
            if colour != last_colour:
                try:
                    self._icon.icon = _load_icon(colour)
                    last_colour = colour
                except Exception as e:
                    self._log.warning("Icon update failed: %s", e)
            # Rebuild menu for updated timestamps
            self._icon.menu = self._build_menu()
            self._icon.update_menu()  # REQUIRED — pystray pitfall
            time.sleep(5)

    def run(self) -> None:
        """Start the tray icon. Blocks until exit is called."""
        colour = self._state.icon_colour()
        self._icon = pystray.Icon(
            "PortfolioConnector",
            icon=_load_icon(colour),
            title="Portfolio Connector",
            menu=self._build_menu(),
        )
        # Start refresh thread
        t = threading.Thread(target=self._refresh_loop, daemon=True, name="tray-refresh")
        t.start()
        self._icon.run()

    def stop(self) -> None:
        if self._icon:
            self._icon.stop()
```

- [ ] **Step 2: Commit**

```bash
cd ..
git add connector/tray.py
git commit -m "feat(connector): tray module with pystray icon and menu"
```

---

### Task 9: Setup window (first-run dialog)

**Files:**
- Create: `connector/windows/setup.py`

- [ ] **Step 1: Create `connector/windows/setup.py`**

```python
# connector/windows/setup.py
"""
First-run setup dialog.
IMPORTANT: tkinter must run on the main thread or a thread with its own mainloop().
Never call show() from the pusher or bridge threads.
"""
import threading
import tkinter as tk
from tkinter import ttk, messagebox

from connector.config import save_config, DEFAULT_SERVER_URL
from connector.autostart import enable_autostart, disable_autostart
from connector.logger import get_logger

_log = get_logger()


def show(on_complete: callable) -> None:
    """
    Open the setup dialog in a new thread with its own Tk mainloop.
    Calls on_complete(cfg: dict) when user clicks Connect successfully.
    """
    def _run():
        root = tk.Tk()
        root.title("Portfolio Connector — Setup")
        root.resizable(False, False)
        root.geometry("420x260")

        # Centre on screen
        root.update_idletasks()
        x = (root.winfo_screenwidth() - 420) // 2
        y = (root.winfo_screenheight() - 260) // 2
        root.geometry(f"+{x}+{y}")

        # ── Title ──
        tk.Label(root, text="Connect to Portfolio App",
                 font=("Segoe UI", 13, "bold")).pack(pady=(18, 4))
        tk.Label(root, text="Paste your API key from Settings → Agent",
                 font=("Segoe UI", 9), fg="#666").pack()

        # ── API Key ──
        tk.Label(root, text="API Key", anchor="w",
                 font=("Segoe UI", 9)).pack(fill="x", padx=24, pady=(14, 0))
        key_var = tk.StringVar()
        key_entry = ttk.Entry(root, textvariable=key_var, width=52, font=("Consolas", 9))
        key_entry.pack(padx=24, pady=(2, 0))
        key_entry.focus()

        # ── Server URL ──
        tk.Label(root, text="Server URL", anchor="w",
                 font=("Segoe UI", 9)).pack(fill="x", padx=24, pady=(10, 0))
        url_var = tk.StringVar(value=DEFAULT_SERVER_URL)
        ttk.Entry(root, textvariable=url_var, width=52).pack(padx=24, pady=(2, 0))

        # ── Autostart ──
        autostart_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(root, text="Start with Windows",
                        variable=autostart_var).pack(anchor="w", padx=24, pady=(10, 0))

        # ── Error label ──
        error_var = tk.StringVar()
        error_lbl = tk.Label(root, textvariable=error_var, fg="red", font=("Segoe UI", 8))
        error_lbl.pack()

        def on_connect():
            key = key_var.get().strip()
            url = url_var.get().strip()
            if not key.startswith("agent_"):
                error_var.set("API key must start with 'agent_'")
                return
            if not url.startswith("http"):
                error_var.set("Server URL must start with http:// or https://")
                return
            cfg = {
                "server_url": url,
                "api_key": key,
                "push_interval_seconds": 300,
                "retry_interval_seconds": 30,
                "autostart": autostart_var.get(),
            }
            save_config(cfg)
            if autostart_var.get():
                try:
                    enable_autostart()
                except Exception as e:
                    _log.warning("Autostart registration failed: %s", e)
            else:
                disable_autostart()
            root.destroy()
            on_complete(cfg)

        ttk.Button(root, text="Connect →", command=on_connect).pack(pady=(6, 0))
        root.mainloop()

    t = threading.Thread(target=_run, daemon=True, name="setup-window")
    t.start()
    t.join()  # Block main thread until setup is done
```

- [ ] **Step 2: Commit**

```bash
cd ..
git add connector/windows/setup.py
git commit -m "feat(connector): setup window — first-run API key dialog"
```

---

### Task 10: Settings and Logs windows

**Files:**
- Create: `connector/windows/settings.py`
- Create: `connector/windows/logs.py`

- [ ] **Step 1: Create `connector/windows/settings.py`**

```python
# connector/windows/settings.py
"""
Settings window — opened from tray menu.
Runs in its own thread with its own mainloop (tkinter thread safety).
"""
import threading
import tkinter as tk
from tkinter import ttk

from connector.config import load_config, save_config
from connector.autostart import enable_autostart, disable_autostart, is_autostart_enabled
from connector.logger import get_logger

_log = get_logger()


def show(on_saved: callable | None = None) -> None:
    """Open settings window in a daemon thread."""
    def _run():
        cfg = load_config()
        root = tk.Tk()
        root.title("Portfolio Connector — Settings")
        root.resizable(False, False)
        root.geometry("420x310")
        root.update_idletasks()
        x = (root.winfo_screenwidth() - 420) // 2
        y = (root.winfo_screenheight() - 310) // 2
        root.geometry(f"+{x}+{y}")

        tk.Label(root, text="Settings", font=("Segoe UI", 13, "bold")).pack(pady=(18, 10))

        fields = [
            ("API Key",            "api_key",                  cfg.get("api_key", "")),
            ("Server URL",         "server_url",               cfg.get("server_url", "")),
            ("Push interval (s)",  "push_interval_seconds",    str(cfg.get("push_interval_seconds", 300))),
            ("Retry interval (s)", "retry_interval_seconds",   str(cfg.get("retry_interval_seconds", 30))),
        ]
        vars_ = {}
        for label, key, val in fields:
            tk.Label(root, text=label, anchor="w",
                     font=("Segoe UI", 9)).pack(fill="x", padx=24, pady=(6, 0))
            v = tk.StringVar(value=val)
            vars_[key] = v
            font = ("Consolas", 9) if key == "api_key" else ("Segoe UI", 9)
            ttk.Entry(root, textvariable=v, width=52, font=font).pack(padx=24, pady=(1, 0))

        autostart_var = tk.BooleanVar(value=is_autostart_enabled())
        ttk.Checkbutton(root, text="Start with Windows",
                        variable=autostart_var).pack(anchor="w", padx=24, pady=(10, 0))

        status_var = tk.StringVar()
        tk.Label(root, textvariable=status_var, fg="#22c55e",
                 font=("Segoe UI", 8)).pack()

        def on_save():
            new_cfg = {k: (int(v.get()) if k.endswith("_seconds") else v.get().strip())
                       for k, v in vars_.items()}
            new_cfg["autostart"] = autostart_var.get()
            save_config(new_cfg)
            if autostart_var.get():
                try:
                    enable_autostart()
                except Exception as e:
                    _log.warning("Autostart failed: %s", e)
            else:
                disable_autostart()
            status_var.set("✓ Saved")
            if on_saved:
                on_saved(new_cfg)

        ttk.Button(root, text="Save", command=on_save).pack(pady=(4, 0))
        root.mainloop()

    threading.Thread(target=_run, daemon=True, name="settings-window").start()
```

- [ ] **Step 2: Create `connector/windows/logs.py`**

```python
# connector/windows/logs.py
"""
Log viewer window — tails connector.log and refreshes every 2 seconds.
Runs in its own thread with its own mainloop (tkinter thread safety).
"""
import threading
import tkinter as tk
from tkinter import ttk
from pathlib import Path
import os

from connector.logger import log_path


def show() -> None:
    """Open log viewer in a daemon thread."""
    def _run():
        root = tk.Tk()
        root.title("Portfolio Connector — Logs")
        root.geometry("680x420")
        root.update_idletasks()
        x = (root.winfo_screenwidth() - 680) // 2
        y = (root.winfo_screenheight() - 420) // 2
        root.geometry(f"+{x}+{y}")

        tk.Label(root, text="Connector Logs", font=("Segoe UI", 11, "bold")).pack(pady=(12, 4))

        frame = tk.Frame(root)
        frame.pack(fill="both", expand=True, padx=12, pady=(0, 12))

        text = tk.Text(frame, font=("Consolas", 8), wrap="none",
                       bg="#0d1117", fg="#c9d1d9", state="disabled")
        vsb = ttk.Scrollbar(frame, orient="vertical", command=text.yview)
        text.configure(yscrollcommand=vsb.set)
        vsb.pack(side="right", fill="y")
        text.pack(side="left", fill="both", expand=True)

        path = log_path()
        _last_size = [0]
        _follow = [True]

        def refresh():
            if not path.exists():
                root.after(2000, refresh)
                return
            size = path.stat().st_size
            if size != _last_size[0]:
                _last_size[0] = size
                with open(path, encoding="utf-8", errors="replace") as f:
                    content = f.read()
                text.configure(state="normal")
                text.delete("1.0", "end")
                text.insert("end", content)
                text.configure(state="disabled")
                if _follow[0]:
                    text.see("end")
            root.after(2000, refresh)

        follow_var = tk.BooleanVar(value=True)
        def toggle_follow():
            _follow[0] = follow_var.get()

        ttk.Checkbutton(root, text="Follow (auto-scroll)",
                        variable=follow_var, command=toggle_follow).pack(pady=(0, 6))

        root.after(100, refresh)
        root.mainloop()

    threading.Thread(target=_run, daemon=True, name="logs-window").start()
```

- [ ] **Step 3: Commit**

```bash
cd ..
git add connector/windows/settings.py connector/windows/logs.py
git commit -m "feat(connector): settings and logs tkinter windows"
```

---

### Task 11: main.py — wire everything together

**Files:**
- Create: `connector/main.py`

- [ ] **Step 1: Create `connector/main.py`**

```python
#!/usr/bin/env python3
# connector/main.py
"""
Portfolio Connector — entry point.
Bootstraps config, bridge, pusher, and tray.
"""
import sys

from connector.config import load_config, is_configured
from connector.logger import setup_logger
from connector.bridge import Bridge
from connector.pusher import Pusher
from connector.state import AppState
from connector import windows


def main() -> None:
    log = setup_logger()
    log.info("Portfolio Connector starting")

    state = AppState()

    # ── First-run setup ──────────────────────────────────────────────────────
    if not is_configured():
        log.info("No config found — opening setup window")
        state.status = "unconfigured"

        completed = []
        def on_setup_complete(cfg):
            completed.append(cfg)

        from connector.windows import setup
        setup.show(on_complete=on_setup_complete)

        if not completed:
            log.info("Setup cancelled — exiting")
            sys.exit(0)

    cfg = load_config()
    log.info("Config loaded — server: %s", cfg["server_url"])

    # ── Bridge ───────────────────────────────────────────────────────────────
    bridge = Bridge()
    state.status = "starting"
    bridge.start()

    # ── Pusher ───────────────────────────────────────────────────────────────
    pusher = Pusher(bridge=bridge, state=state, cfg=cfg)
    pusher.start()

    # ── Tray (blocks until Exit clicked) ────────────────────────────────────
    from connector.tray import ConnectorTray
    from connector.windows import settings, logs

    def on_push_now():
        pusher.push_now()

    def on_settings():
        def on_saved(new_cfg):
            # Hot-reload config into pusher
            pusher._cfg = new_cfg
            log.info("Settings saved and reloaded")
        settings.show(on_saved=on_saved)

    def on_logs():
        logs.show()

    def on_exit():
        log.info("Exit requested")
        pusher.stop()
        bridge.stop()
        tray.stop()

    tray = ConnectorTray(
        state=state,
        on_push_now=on_push_now,
        on_settings=on_settings,
        on_logs=on_logs,
        on_exit=on_exit,
    )
    tray.run()  # blocks
    log.info("Connector exited cleanly")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Smoke-test locally (requires OpenD running)**

```bash
cd connector
python main.py
```

Expected:
- If no config.json → setup window appears
- After entering key + clicking Connect → tray icon appears in system tray
- Right-click → menu shows status, Push Now, Settings, Logs, Exit
- Click Push Now → log shows "Push OK" or an error

- [ ] **Step 3: Commit**

```bash
cd ..
git add connector/main.py connector/windows/__init__.py
git commit -m "feat(connector): main.py — wires bridge, pusher, tray together"
```

---

### Task 12: PyInstaller build spec

**Files:**
- Create: `connector/build.spec`

- [ ] **Step 1: Create `connector/build.spec`**

```python
# connector/build.spec
# PyInstaller spec for PortfolioConnector.exe
# Run from connector/ directory: pyinstaller build.spec

import sys
from pathlib import Path

block_cipher = None

# Locate moomoo-service relative to this spec file
ROOT = Path(SPECPATH).parent
MOOMOO_SERVICE_DIR = ROOT / "moomoo-service"
ASSETS_DIR = Path(SPECPATH) / "assets"

a = Analysis(
    [str(Path(SPECPATH) / "main.py")],
    pathex=[str(ROOT)],
    binaries=[],
    datas=[
        # Bundle entire moomoo-service directory
        (str(MOOMOO_SERVICE_DIR), "moomoo-service"),
        # Bundle icon assets
        (str(ASSETS_DIR / "icon_green.png"),  "connector/assets"),
        (str(ASSETS_DIR / "icon_yellow.png"), "connector/assets"),
        (str(ASSETS_DIR / "icon_red.png"),    "connector/assets"),
    ],
    hiddenimports=[
        "pystray._win32",       # pystray pitfall — PyInstaller misses this
        "PIL._tkinter_finder",
        "tkinter",
        "tkinter.ttk",
        "uvicorn",
        "uvicorn.lifespan.on",
        "uvicorn.loops.auto",
        "uvicorn.protocols.http.auto",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="PortfolioConnector",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,          # No terminal window — tray app only
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(ASSETS_DIR / "icon_green.png"),
)
```

- [ ] **Step 2: Build the .exe**

```bash
cd connector
pyinstaller build.spec --clean
```

Expected: `connector/dist/PortfolioConnector.exe` created (~40–60 MB). Build may take 60–120 seconds.

- [ ] **Step 3: Test the built .exe**

```bash
dist\PortfolioConnector.exe
```

Expected:
- If no config → setup window appears (no terminal window)
- SmartScreen may show "Windows protected your PC" — click "More info → Run anyway"
- After setup → tray icon appears
- Right-click → menu works

- [ ] **Step 4: Add dist/ to .gitignore and commit spec**

Add to root `.gitignore`:
```
connector/dist/
connector/build/
connector/__pycache__/
```

```bash
cd ..
git add connector/build.spec .gitignore
git commit -m "feat(connector): PyInstaller build.spec — produces PortfolioConnector.exe"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| System tray app | Task 8 (tray.py) |
| pystray `update_menu()` pitfall | Task 8 (noted in tray.py comment) |
| Config in %APPDATA% | Task 1 |
| First-run dialog with API key + URL + autostart | Task 9 |
| HKCU registry autostart | Task 3 |
| Bridge starts moomoo-service subprocess | Task 5 |
| `sys._MEIPASS` path resolution | Task 5 (bridge.py) |
| Pusher push loop with retry | Task 6 |
| 5 states (unconfigured/starting/opend_offline/connected/push_error) | Task 4 (state.py) |
| RotatingFileHandler logging | Task 2 |
| Log viewer window auto-refresh | Task 10 |
| Settings window | Task 10 |
| PyInstaller one-file build | Task 12 |
| `pystray._win32` hiddenimport | Task 12 |
| tkinter thread safety | Tasks 9, 10 (threads with own mainloop) |
| SmartScreen note | Task 12 (step 3) |
| Push Now tray action | Task 6 (pusher.push_now) + Task 8 (menu) |

All spec requirements covered. No placeholders. Types consistent across tasks.
