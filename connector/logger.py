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
