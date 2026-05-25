# connector/bridge.py
"""
Manages the moomoo-service by running it in-process via uvicorn.Server in a daemon thread.
Uses sys._MEIPASS to locate the bundled service directory when running as a PyInstaller .exe.
"""
import importlib.util
import sys
import threading
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


def _import_app(service_dir: Path):
    """Import and return the FastAPI app from moomoo-service/main.py."""
    main_py = service_dir / "main.py"
    # Add service dir to sys.path so moomoo-service can import its own modules
    service_str = str(service_dir)
    if service_str not in sys.path:
        sys.path.insert(0, service_str)
    spec = importlib.util.spec_from_file_location("moomoo_service_main", str(main_py))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.app


class Bridge:
    def __init__(self, service_dir: Path | None = None):
        self._service_dir = service_dir or _bundled_service_dir()
        self._server = None
        self._thread: threading.Thread | None = None
        self._log = get_logger()

    def start(self) -> None:
        """Start moomoo-service in-process via uvicorn.Server in a daemon thread."""
        if self._thread and self._thread.is_alive():
            return  # already running

        main_py = self._service_dir / "main.py"
        if not main_py.exists():
            self._log.error("moomoo-service not found at %s", self._service_dir)
            raise FileNotFoundError(
                f"moomoo-service/main.py not found at {self._service_dir}"
            )

        self._log.info("Starting moomoo-service from %s", self._service_dir)

        import uvicorn

        app = _import_app(self._service_dir)
        config = uvicorn.Config(
            app,
            host="127.0.0.1",
            port=MOOMOO_SERVICE_PORT,
            log_level="warning",
        )
        self._server = uvicorn.Server(config)
        self._thread = threading.Thread(
            target=self._server.run,
            daemon=True,
            name="moomoo-service",
        )
        self._thread.start()
        # Give uvicorn a moment to bind
        time.sleep(2)
        self._log.info(
            "moomoo-service started in-process on port %s", MOOMOO_SERVICE_PORT
        )

    def is_healthy(self) -> bool:
        """True if moomoo-service thread is alive and /status returns 200."""
        if self._thread is None or not self._thread.is_alive():
            return False
        try:
            r = httpx.get(HEALTH_URL, timeout=3)
            return r.status_code == 200
        except Exception:
            return False

    def stop(self) -> None:
        """Stop the in-process uvicorn server."""
        if self._server:
            self._log.info("Stopping moomoo-service")
            self._server.should_exit = True
            if self._thread:
                self._thread.join(timeout=5)
        self._server = None
        self._thread = None
