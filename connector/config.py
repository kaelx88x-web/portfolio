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
