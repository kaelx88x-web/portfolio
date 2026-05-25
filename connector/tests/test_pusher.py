import sys
import threading
from pathlib import Path
from unittest.mock import MagicMock, patch
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from connector.state import AppState
from connector.pusher import Pusher


def _make_pusher(healthy=True, push_ok=True):
    bridge = MagicMock()
    bridge.is_healthy.return_value = healthy
    state = AppState()
    cfg = {
        "server_url": "https://example.com",
        "api_key": "agent_test",
        "push_interval_seconds": 1,
        "retry_interval_seconds": 1,
    }
    p = Pusher(bridge=bridge, state=state, cfg=cfg)
    return p, state


def test_pusher_sets_opend_offline_when_bridge_unhealthy():
    p, state = _make_pusher(healthy=False)
    with patch("connector.pusher.time.sleep"):
        p._tick()
    assert state.status == "opend_offline"
    assert state.opend_ok is False


def test_pusher_sets_connected_on_successful_push():
    p, state = _make_pusher(healthy=True)
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"ok": True, "received_at": "2026-01-01T00:00:00Z"}
    mock_resp.is_success = True

    mock_data = {"status": {"connected": True}}

    with patch("connector.pusher.httpx.get") as mock_get, \
         patch("connector.pusher.httpx.post") as mock_post:
        mock_get.return_value = MagicMock(status_code=200, json=lambda: mock_data)
        mock_post.return_value = mock_resp
        p._tick()

    assert state.status == "connected"
    assert state.opend_ok is True
    assert state.last_push_at is not None


def test_pusher_sets_push_error_on_401():
    p, state = _make_pusher(healthy=True)
    mock_resp = MagicMock()
    mock_resp.status_code = 401
    mock_resp.is_success = False

    mock_data = {"status": {"connected": True}}

    with patch("connector.pusher.httpx.get") as mock_get, \
         patch("connector.pusher.httpx.post") as mock_post:
        mock_get.return_value = MagicMock(status_code=200, json=lambda: mock_data)
        mock_post.return_value = mock_resp
        p._tick()

    assert state.status == "push_error"
    assert "API key" in state.last_error


def test_pusher_is_daemon_thread():
    p, _ = _make_pusher()
    t = p.start()
    assert t.daemon is True
    p.stop()
