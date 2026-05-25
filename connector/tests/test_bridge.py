# connector/tests/test_bridge.py
"""Tests for connector/bridge.py — in-process uvicorn architecture."""
import sys
import threading
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from connector.bridge import Bridge, HEALTH_URL, _bundled_service_dir


# ── _bundled_service_dir ─────────────────────────────────────────────────────

def test_bundled_service_dir_dev_mode():
    """In dev mode (not frozen), returns moomoo-service sibling of connector/."""
    # Ensure sys.frozen is absent (dev mode)
    frozen_existed = hasattr(sys, "frozen")
    if frozen_existed:
        frozen_val = sys.frozen
        del sys.frozen
    try:
        result = _bundled_service_dir()
    finally:
        if frozen_existed:
            sys.frozen = frozen_val
    assert result.name == "moomoo-service"
    assert result.parent.name == "portfolio"  # project root


def test_bundled_service_dir_frozen_mode(tmp_path):
    """In frozen mode, returns sys._MEIPASS / moomoo-service."""
    fake_meipass = tmp_path / "meipass"
    fake_meipass.mkdir()
    with patch.object(sys, "frozen", True, create=True), \
         patch.object(sys, "_MEIPASS", str(fake_meipass), create=True):
        result = _bundled_service_dir()
    assert result == fake_meipass / "moomoo-service"


# ── Bridge.start ─────────────────────────────────────────────────────────────

def test_start_raises_if_main_py_missing(tmp_path):
    """start() raises FileNotFoundError if main.py is not found."""
    bridge = Bridge(service_dir=tmp_path)
    with pytest.raises(FileNotFoundError, match="moomoo-service/main.py not found"):
        bridge.start()


def test_start_skips_if_already_running(tmp_path):
    """start() is a no-op if thread is already alive."""
    bridge = Bridge(service_dir=tmp_path)
    mock_thread = MagicMock(spec=threading.Thread)
    mock_thread.is_alive.return_value = True
    bridge._thread = mock_thread

    # Should return immediately without doing anything
    bridge.start()

    mock_thread.is_alive.assert_called_once()


def test_start_launches_uvicorn_thread(tmp_path):
    """start() creates a uvicorn.Server and starts a daemon thread."""
    # Create a fake main.py in tmp_path
    fake_main = tmp_path / "main.py"
    fake_main.write_text(
        "from fastapi import FastAPI\napp = FastAPI()\n", encoding="utf-8"
    )

    bridge = Bridge(service_dir=tmp_path)

    mock_server = MagicMock()
    mock_config = MagicMock()

    mock_thread = MagicMock()
    mock_thread.is_alive.return_value = False

    with patch("connector.bridge._import_app", return_value=MagicMock()) as mock_import, \
         patch("uvicorn.Config", return_value=mock_config) as mock_cfg_cls, \
         patch("uvicorn.Server", return_value=mock_server) as mock_srv_cls, \
         patch("threading.Thread", return_value=mock_thread) as mock_thread_cls, \
         patch("time.sleep"):

        bridge.start()

    mock_import.assert_called_once_with(tmp_path)
    mock_cfg_cls.assert_called_once_with(
        mock_import.return_value,
        host="127.0.0.1",
        port=8001,
        log_level="warning",
    )
    mock_srv_cls.assert_called_once_with(mock_config)
    mock_thread_cls.assert_called_once()
    mock_thread.start.assert_called_once()


# ── Bridge.is_healthy ────────────────────────────────────────────────────────

def test_is_healthy_false_when_no_thread():
    """is_healthy() returns False when no thread exists."""
    bridge = Bridge()
    assert bridge.is_healthy() is False


def test_is_healthy_false_when_thread_dead():
    """is_healthy() returns False when thread exists but is not alive."""
    bridge = Bridge()
    mock_thread = MagicMock(spec=threading.Thread)
    mock_thread.is_alive.return_value = False
    bridge._thread = mock_thread
    assert bridge.is_healthy() is False


def test_is_healthy_true_on_200(tmp_path):
    """is_healthy() returns True when thread alive and /status returns 200."""
    bridge = Bridge(service_dir=tmp_path)
    mock_thread = MagicMock(spec=threading.Thread)
    mock_thread.is_alive.return_value = True
    bridge._thread = mock_thread

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    with patch("connector.bridge.httpx.get", return_value=mock_resp):
        assert bridge.is_healthy() is True


def test_is_healthy_false_on_non_200(tmp_path):
    """is_healthy() returns False when /status returns non-200."""
    bridge = Bridge(service_dir=tmp_path)
    mock_thread = MagicMock(spec=threading.Thread)
    mock_thread.is_alive.return_value = True
    bridge._thread = mock_thread

    mock_resp = MagicMock()
    mock_resp.status_code = 503
    with patch("connector.bridge.httpx.get", return_value=mock_resp):
        assert bridge.is_healthy() is False


def test_is_healthy_false_on_exception(tmp_path):
    """is_healthy() returns False when httpx raises."""
    bridge = Bridge(service_dir=tmp_path)
    mock_thread = MagicMock(spec=threading.Thread)
    mock_thread.is_alive.return_value = True
    bridge._thread = mock_thread

    with patch("connector.bridge.httpx.get", side_effect=Exception("timeout")):
        assert bridge.is_healthy() is False


# ── Bridge.stop ──────────────────────────────────────────────────────────────

def test_stop_sets_should_exit_and_joins():
    """stop() sets server.should_exit and joins the thread."""
    bridge = Bridge()
    mock_server = MagicMock()
    mock_thread = MagicMock(spec=threading.Thread)
    bridge._server = mock_server
    bridge._thread = mock_thread

    bridge.stop()

    assert mock_server.should_exit is True
    mock_thread.join.assert_called_once_with(timeout=5)
    assert bridge._server is None
    assert bridge._thread is None


def test_stop_no_op_when_not_started():
    """stop() does nothing when bridge was never started."""
    bridge = Bridge()
    bridge.stop()  # should not raise
