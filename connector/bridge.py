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
