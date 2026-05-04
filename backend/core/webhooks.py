"""Webhook notifier — Slack & Discord for hot lead alerts."""
import os
import logging
import httpx
from typing import Optional

log = logging.getLogger("bidblitz.webhooks")


async def send_slack_webhook(text: str, blocks: Optional[list] = None) -> bool:
    """Send message to Slack incoming webhook. Returns True on success."""
    url = os.environ.get("SLACK_WEBHOOK_URL")
    if not url:
        log.debug("SLACK_WEBHOOK_URL not set, skipping")
        return False
    payload = {"text": text}
    if blocks:
        payload["blocks"] = blocks
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.post(url, json=payload)
            return r.status_code in (200, 204)
    except Exception as e:
        log.warning(f"Slack webhook failed: {e}")
        return False


async def send_discord_webhook(content: str, embeds: Optional[list] = None) -> bool:
    """Send message to Discord webhook. Returns True on success."""
    url = os.environ.get("DISCORD_WEBHOOK_URL")
    if not url:
        log.debug("DISCORD_WEBHOOK_URL not set, skipping")
        return False
    payload = {"content": content}
    if embeds:
        payload["embeds"] = embeds
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.post(url, json=payload)
            return r.status_code in (200, 204)
    except Exception as e:
        log.warning(f"Discord webhook failed: {e}")
        return False


async def notify_hot_lead(lead_email: str, score: int, category: str, reason: str, tags: list, session_id: str) -> dict:
    """Notify Slack + Discord about a hot lead. Returns {slack: bool, discord: bool}."""
    tag_str = ", ".join(tags) if tags else "—"
    text = f"🔥 HOT LEAD ({score}/100): {lead_email}"

    # Slack blocks (rich)
    slack_blocks = [
        {"type": "header", "text": {"type": "plain_text", "text": f"🔥 Hot Lead: {score}/100"}},
        {"type": "section", "fields": [
            {"type": "mrkdwn", "text": f"*Email:*\n{lead_email}"},
            {"type": "mrkdwn", "text": f"*Kategorie:*\n{category}"},
            {"type": "mrkdwn", "text": f"*Tags:*\n{tag_str}"},
            {"type": "mrkdwn", "text": f"*Session:*\n`{session_id[:16]}…`"},
        ]},
        {"type": "section", "text": {"type": "mrkdwn", "text": f"*Begründung:*\n_{reason or 'N/A'}_"}},
    ]

    # Discord embed (rich)
    color = 0xEF4444 if score >= 80 else 0xF59E0B
    discord_embeds = [{
        "title": f"🔥 Hot Lead: {score}/100",
        "color": color,
        "fields": [
            {"name": "Email", "value": lead_email, "inline": True},
            {"name": "Kategorie", "value": category, "inline": True},
            {"name": "Tags", "value": tag_str, "inline": False},
            {"name": "Begründung", "value": (reason or "—")[:1000], "inline": False},
            {"name": "Session", "value": f"`{session_id[:24]}`", "inline": True},
        ],
    }]

    slack_ok = await send_slack_webhook(text, slack_blocks)
    discord_ok = await send_discord_webhook(text, discord_embeds)
    return {"slack": slack_ok, "discord": discord_ok}
