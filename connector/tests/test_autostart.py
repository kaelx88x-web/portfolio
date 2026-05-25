import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

# Mock winreg before import (not available outside Windows in CI)
winreg_mock = MagicMock()
sys.modules["winreg"] = winreg_mock

from connector.autostart import enable_autostart, disable_autostart, is_autostart_enabled

APP_NAME = "PortfolioConnector"


def test_enable_autostart_writes_registry():
    winreg_mock.reset_mock()
    winreg_mock.OpenKey.return_value.__enter__ = lambda s: MagicMock()
    winreg_mock.OpenKey.return_value.__exit__ = MagicMock(return_value=False)
    enable_autostart(exe_path="C:\\test\\PortfolioConnector.exe")
    winreg_mock.SetValueEx.assert_called_once()
    args = winreg_mock.SetValueEx.call_args[0]
    assert args[1] == APP_NAME
    assert args[4] == '"C:\\test\\PortfolioConnector.exe"'


def test_disable_autostart_deletes_registry():
    winreg_mock.reset_mock()
    winreg_mock.OpenKey.return_value.__enter__ = lambda s: MagicMock()
    winreg_mock.OpenKey.return_value.__exit__ = MagicMock(return_value=False)
    disable_autostart()
    winreg_mock.DeleteValue.assert_called_once()
    args = winreg_mock.DeleteValue.call_args[0]
    assert args[1] == APP_NAME


def test_disable_autostart_ignores_missing_key():
    winreg_mock.reset_mock()
    winreg_mock.DeleteValue.side_effect = FileNotFoundError
    # Should not raise
    disable_autostart()


def test_is_autostart_enabled_returns_true_when_key_exists():
    winreg_mock.reset_mock()
    winreg_mock.OpenKey.return_value.__enter__ = lambda s: MagicMock()
    winreg_mock.OpenKey.return_value.__exit__ = MagicMock(return_value=False)
    winreg_mock.QueryValueEx.return_value = ('"C:\\test\\app.exe"', 1)
    winreg_mock.QueryValueEx.side_effect = None
    assert is_autostart_enabled() is True


def test_is_autostart_enabled_returns_false_when_key_missing():
    winreg_mock.reset_mock()
    winreg_mock.OpenKey.side_effect = FileNotFoundError
    assert is_autostart_enabled() is False
