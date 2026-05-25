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
