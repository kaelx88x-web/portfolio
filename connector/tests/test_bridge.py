import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from connector.bridge import Bridge


def test_is_healthy_returns_false_when_not_started():
    b = Bridge(service_dir=Path("."))
    assert b.is_healthy() is False


def test_is_healthy_returns_true_on_200():
    b = Bridge(service_dir=Path("."))
    b._process = MagicMock()  # simulate started

    mock_resp = MagicMock()
    mock_resp.status_code = 200

    with patch("connector.bridge.httpx.get", return_value=mock_resp):
        assert b.is_healthy() is True


def test_is_healthy_returns_false_on_connection_error():
    import httpx
    b = Bridge(service_dir=Path("."))
    b._process = MagicMock()

    with patch("connector.bridge.httpx.get", side_effect=httpx.ConnectError("refused")):
        assert b.is_healthy() is False


def test_stop_terminates_process():
    b = Bridge(service_dir=Path("."))
    mock_proc = MagicMock()
    b._process = mock_proc
    b.stop()
    mock_proc.terminate.assert_called_once()
    assert b._process is None
