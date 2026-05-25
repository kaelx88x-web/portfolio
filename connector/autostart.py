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
