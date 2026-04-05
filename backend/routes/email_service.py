"""
BidBlitz V2 — Email Notification Service
Sends outbid alerts, win notifications, new auction alerts.
Uses Resend when API key available, falls back to DB logging.
"""
import os
import asyncio
import logging
from datetime import datetime, timezone
from core.database import db

logger = logging.getLogger("bidblitz.email")

RESEND_KEY = os.environ.get("RESEND_API_KEY", "")
SENDER = os.environ.get("SENDER_EMAIL", "noreply@bidblitz.ae")
DOMAIN = "https://bidblitz.ae"


async def _send_via_resend(to: str, subject: str, html: str):
    """Send email via Resend API (non-blocking)."""
    try:
        import resend
        resend.api_key = RESEND_KEY
        params = {"from": SENDER, "to": [to], "subject": subject, "html": html}
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email sent via Resend to {to}: {result.get('id', 'ok')}")
        return True
    except Exception as e:
        logger.error(f"Resend email failed: {e}")
        return False


async def send_email(to: str, subject: str, html: str, notif_type: str = "email"):
    """Send email — uses Resend if available, otherwise logs to DB."""
    sent = False
    if RESEND_KEY:
        sent = await _send_via_resend(to, subject, html)

    # Always log to DB
    await db.email_log.insert_one({
        "to": to,
        "subject": subject,
        "type": notif_type,
        "sent_via": "resend" if sent else "logged",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return sent


# ═══════════════════════════════════════════
# EMAIL TEMPLATES
# ═══════════════════════════════════════════

STYLE = """
<style>
body{margin:0;padding:0;background:#040610;font-family:'Segoe UI',system-ui,sans-serif;color:#c0c8d8}
.c{max-width:480px;margin:0 auto;padding:32px 20px}
.hd{text-align:center;margin-bottom:24px}
.logo{font-size:22px;font-weight:900;letter-spacing:-0.5px}
.logo span{color:#00E0FF}
.card{background:rgba(12,16,28,0.95);border:1px solid rgba(255,255,255,0.05);border-radius:16px;padding:24px;margin-bottom:16px}
.title{font-size:18px;font-weight:800;margin:0 0 6px 0}
.sub{font-size:13px;color:#6b7280;margin:0 0 16px 0}
.price{font-size:28px;font-weight:900;color:#00E0FF;font-family:monospace}
.btn{display:inline-block;padding:12px 28px;background:rgba(0,224,255,0.1);border:1px solid rgba(0,224,255,0.2);border-radius:12px;color:#00E0FF;font-weight:700;text-decoration:none;font-size:13px}
.btn-gold{background:rgba(255,209,102,0.1);border-color:rgba(255,209,102,0.2);color:#FFD166}
.ft{text-align:center;font-size:10px;color:#3a3f4b;margin-top:24px}
</style>
"""


def _wrap(body: str) -> str:
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">{STYLE}</head><body><div class="c"><div class="hd"><div class="logo">Bid<span>Blitz</span></div></div>{body}<div class="ft">bidblitz.ae</div></div></body></html>"""


def outbid_email(user_name: str, auction_title: str, auction_id: str, current_price: float) -> tuple:
    subject = f"Du wurdest überboten: {auction_title}"
    html = _wrap(f"""
<div class="card">
  <p class="title">Du wurdest überboten!</p>
  <p class="sub">{user_name}, jemand hat auf <strong>{auction_title}</strong> geboten.</p>
  <p>Aktueller Preis: <span class="price">&euro;{current_price:.2f}</span></p>
  <p style="margin-top:16px"><a href="{DOMAIN}" class="btn">Jetzt zurückbieten</a></p>
</div>""")
    return subject, html


def win_email(user_name: str, auction_title: str, final_price: float) -> tuple:
    subject = f"Gewonnen! {auction_title}"
    html = _wrap(f"""
<div class="card">
  <p class="title" style="color:#FFD166">Herzlichen Glückwunsch!</p>
  <p class="sub">{user_name}, du hast <strong>{auction_title}</strong> gewonnen!</p>
  <p>Endpreis: <span class="price">&euro;{final_price:.2f}</span></p>
  <p style="margin-top:16px"><a href="{DOMAIN}" class="btn btn-gold">Preis abholen</a></p>
</div>""")
    return subject, html


def new_auction_email(user_name: str, auction_title: str, retail_price: float) -> tuple:
    subject = f"Neue Auktion: {auction_title}"
    html = _wrap(f"""
<div class="card">
  <p class="title">Neue Auktion gestartet!</p>
  <p class="sub">{user_name}, ein neues Schnäppchen wartet auf dich.</p>
  <p><strong>{auction_title}</strong></p>
  <p>Wert: <span style="text-decoration:line-through;color:#555">&euro;{retail_price:.2f}</span> &mdash; Startpreis: <span class="price">&euro;0.00</span></p>
  <p style="margin-top:16px"><a href="{DOMAIN}" class="btn">Jetzt bieten</a></p>
</div>""")
    return subject, html


# ═══════════════════════════════════════════
# TRIGGER FUNCTIONS (called from auction logic)
# ═══════════════════════════════════════════

async def notify_outbid(user_email: str, user_name: str, auction_title: str, auction_id: str, price: float):
    subject, html = outbid_email(user_name, auction_title, auction_id, price)
    await send_email(user_email, subject, html, "outbid")


async def notify_win(user_email: str, user_name: str, auction_title: str, price: float):
    subject, html = win_email(user_name, auction_title, price)
    await send_email(user_email, subject, html, "win")


async def notify_new_auction(user_email: str, user_name: str, auction_title: str, retail_price: float):
    subject, html = new_auction_email(user_name, auction_title, retail_price)
    await send_email(user_email, subject, html, "new_auction")
