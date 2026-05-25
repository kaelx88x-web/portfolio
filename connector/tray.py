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
            Item("Portfolio Connector", None, enabled=False),
            Item(s.status_line(), None, enabled=False),
            Menu.SEPARATOR,
            Item(s.push_line(), None, enabled=False),
            Menu.SEPARATOR,
            Item("Push Now", lambda icon, item: self._on_push_now()),
            Item("Settings", lambda icon, item: self._on_settings()),
            Item("View Logs", lambda icon, item: self._on_logs()),
            Menu.SEPARATOR,
            Item("Exit", lambda icon, item: self._on_exit()),
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
        t = threading.Thread(target=self._refresh_loop, daemon=True, name="tray-refresh")
        t.start()
        self._icon.run()

    def stop(self) -> None:
        if self._icon:
            self._icon.stop()
