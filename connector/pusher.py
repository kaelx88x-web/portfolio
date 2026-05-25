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
