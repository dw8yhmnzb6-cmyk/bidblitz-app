import importlib
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def test_telegram_settings_do_not_expose_raw_credentials(monkeypatch):
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "123456789:super-secret-bot-token")
    monkeypatch.setenv("TELEGRAM_CHAT_ID", "-1001234567890")

    module = importlib.import_module("services.monitoring_telegram")
    settings = module.get_telegram_settings()

    assert settings["configured"] is True
    assert settings["chat_id_masked"]
    assert settings["token_masked"]
    assert "chat_id" not in settings
    assert "token" not in settings
    assert "-1001234567890" not in str(settings)
    assert "super-secret-bot-token" not in str(settings)


def test_telegram_settings_unconfigured_without_credentials(monkeypatch):
    monkeypatch.delenv("TELEGRAM_BOT_TOKEN", raising=False)
    monkeypatch.delenv("TELEGRAM_CHAT_ID", raising=False)

    module = importlib.import_module("services.monitoring_telegram")
    settings = module.get_telegram_settings()

    assert settings["configured"] is False
    assert settings["chat_id_masked"] == ""
    assert settings["token_masked"] == ""
