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
