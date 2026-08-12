import os
from datetime import datetime, timezone

import httpx

from core.database import db


def _mask_secret(value: str) -> str:
    if not value:
        return ""
    if len(value) <= 8:
        return "****"
    return f"{value[:4]}…{value[-4:]}"


def get_telegram_settings() -> dict:
    token = (os.environ.get("TELEGRAM_BOT_TOKEN") or "").strip()
    chat_id = (os.environ.get("TELEGRAM_CHAT_ID") or "").strip()
    mode = (os.environ.get("MONITORING_TELEGRAM_MODE") or "critical_and_daily").strip().lower()
    return {
        "configured": bool(token and chat_id),
        "mode": mode,
        "chat_id": chat_id,
        "chat_id_masked": _mask_secret(chat_id),
        "token_masked": _mask_secret(token),
    }


def alert_should_telegram(alert: dict, mode: str) -> bool:
    severity = (alert.get("severity") or "").lower()
    if mode == "all":
        return severity in {"critical", "warning"}
    if mode == "daily_only":
        return False
    if mode == "critical_and_daily":
        return severity == "critical"
    return severity == "critical"


def daily_should_telegram(mode: str) -> bool:
    return mode in {"all", "daily_only", "critical_and_daily"}


def _telegram_escape(text: str) -> str:
    value = str(text or "")
    for token in ["_", "*", "[", "]", "(", ")", "~", "`", ">", "#", "+", "-", "=", "|", "{", "}", ".", "!"]:
        value = value.replace(token, f"\\{token}")
    return value


def build_alert_message(alert: dict) -> str:
    severity = (alert.get("severity") or "warning").upper()
    title = _telegram_escape(alert.get("label") or "Systemwarnung")
    message = _telegram_escape(alert.get("message") or "Die Fehlerzentrale hat eine Änderung erkannt.")
    alert_type = _telegram_escape(alert.get("type") or "alert")
    updated_at = _telegram_escape(alert.get("updated_at") or datetime.now(timezone.utc).isoformat())
    return (
        "🚨 *BidBlitz Monitoring Alarm*\n"
        f"*Titel:* {title}\n"
        f"*Typ:* {alert_type}\n"
        f"*Schweregrad:* {severity}\n"
        f"*Zeit:* {updated_at}\n"
        f"*Info:* {message}"
    )


def build_daily_report_message(report: dict) -> str:
    summary = report.get("summary") or {}
    status = _telegram_escape((report.get("status") or "ok").upper())
    return (
        "📊 *BidBlitz Tagesreport*\n"
        f"*Status:* {status}\n"
        f"*Frontend-Fehler 24h:* {summary.get('frontend_errors_24h', 0)}\n"
        f"*Incidents 24h:* {summary.get('incidents_24h', 0)}\n"
        f"*Fehlende Kern-Checks:* {summary.get('failing_probes', 0)}"
    )


async def send_telegram_message(text: str, notification_type: str, extra_meta: dict | None = None) -> dict:
    settings = get_telegram_settings()
    result = {
        "configured": settings["configured"],
        "sent": False,
        "status_code": None,
        "error": "",
        "mode": settings["mode"],
        "chat_id_masked": settings["chat_id_masked"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if not settings["configured"]:
        await db.monitoring_telegram_deliveries.insert_one({
            "notification_type": notification_type,
            "result": result,
            "meta": extra_meta or {},
            "created_at": result["created_at"],
        })
        return result

    token = (os.environ.get("TELEGRAM_BOT_TOKEN") or "").strip()
    chat_id = settings["chat_id"]
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                json={
                    "chat_id": chat_id,
                    "text": text,
                    "parse_mode": "MarkdownV2",
                    "disable_web_page_preview": True,
                },
            )
        result["status_code"] = response.status_code
        if response.is_success:
            result["sent"] = True
        else:
            result["error"] = response.text[:1000]
    except Exception as exc:
        result["error"] = str(exc)

    await db.monitoring_telegram_deliveries.insert_one({
        "notification_type": notification_type,
        "result": result,
        "meta": extra_meta or {},
        "created_at": result["created_at"],
    })
    return result