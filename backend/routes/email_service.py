"""
BidBlitz V2 — Email Notification Service
Sends outbid alerts, win notifications, new auction alerts,
welcome emails, booking confirmations, streak milestones.
Uses Resend when API key available, falls back to DB logging.
"""
import os
import asyncio
import logging
from datetime import datetime, timezone
from core.database import db

logger = logging.getLogger("bidblitz.email")

RESEND_KEY = os.environ.get("RESEND_API_KEY", "")
_configured_sender = os.environ.get("SENDER_EMAIL") or os.environ.get("FROM_EMAIL") or "onboarding@resend.dev"
SENDER = _configured_sender
DOMAIN = "https://bidblitz.ae"


async def _send_via_resend(to: str, subject: str, html: str):
    """Send email via Resend API (non-blocking)."""
    try:
        import resend
        resend.api_key = RESEND_KEY
        params = {"from": f"BidBlitz <{SENDER}>", "to": [to], "subject": subject, "html": html}
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email sent via Resend to {to}: {result.get('id', 'ok')}")
        return True
    except Exception as e:
        logger.error(f"Resend email failed: {e}")
        return False


async def send_email(to: str, subject: str, html: str, notif_type: str = "email"):
    """Send email — uses Resend if available, otherwise logs to DB."""
    sent = False
    if RESEND_KEY and to:
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
.title{font-size:18px;font-weight:800;margin:0 0 6px 0;color:#fff}
.sub{font-size:13px;color:#6b7280;margin:0 0 16px 0}
.price{font-size:28px;font-weight:900;color:#00E0FF;font-family:monospace}
.row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:13px}
.row:last-child{border:none}
.row b{color:#fff}
.btn{display:inline-block;padding:12px 28px;background:rgba(0,224,255,0.1);border:1px solid rgba(0,224,255,0.2);border-radius:12px;color:#00E0FF;font-weight:700;text-decoration:none;font-size:13px}
.btn-gold{background:rgba(255,209,102,0.1);border-color:rgba(255,209,102,0.2);color:#FFD166}
.btn-green{background:rgba(16,185,129,0.1);border-color:rgba(16,185,129,0.2);color:#10B981}
.ft{text-align:center;font-size:10px;color:#3a3f4b;margin-top:24px}
.hero{text-align:center;padding:40px 20px;background:linear-gradient(135deg,#FFD166 0%,#FF6B00 100%);border-radius:16px;margin-bottom:16px}
.hero h1{font-size:32px;color:#000;margin:0 0 6px 0}
.hero p{color:rgba(0,0,0,0.7);font-size:14px;margin:0}
</style>
"""


def _wrap(body: str) -> str:
    return f"""<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">{STYLE}</head><body><div class="c"><div class="hd"><div class="logo">Bid<span>Blitz</span></div></div>{body}<div class="ft">bidblitz.ae — Du erhältst diese E-Mail, weil du ein BidBlitz-Konto hast.</div></div></body></html>"""


def outbid_email(user_name: str, auction_title: str, auction_id: str, current_price: float):
    subject = f"Du wurdest überboten: {auction_title}"
    html = _wrap(f"""
<div class="card">
  <p class="title">Du wurdest überboten!</p>
  <p class="sub">{user_name}, jemand hat auf <strong>{auction_title}</strong> geboten.</p>
  <p>Aktueller Preis: <span class="price">&euro;{current_price:.2f}</span></p>
  <p style="margin-top:16px"><a href="{DOMAIN}" class="btn">Jetzt zurückbieten</a></p>
</div>""")
    return subject, html


def win_email(user_name: str, auction_title: str, final_price: float):
    subject = f"Gewonnen! {auction_title}"
    html = _wrap(f"""
<div class="card">
  <p class="title" style="color:#FFD166">Herzlichen Glückwunsch!</p>
  <p class="sub">{user_name}, du hast <strong>{auction_title}</strong> gewonnen!</p>
  <p>Endpreis: <span class="price">&euro;{final_price:.2f}</span></p>
  <p style="margin-top:16px"><a href="{DOMAIN}" class="btn btn-gold">Preis abholen</a></p>
</div>""")
    return subject, html


def new_auction_email(user_name: str, auction_title: str, retail_price: float):
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


def welcome_email(user_name: str):
    subject = "Willkommen bei BidBlitz!"
    html = _wrap(f"""
<div class="hero">
  <h1>Willkommen!</h1>
  <p>Hey {user_name}, schön dass du da bist.</p>
</div>
<div class="card">
  <p class="title">Deine Superapp ist startklar</p>
  <p class="sub">Zahlungen, Mobilität, Mining, Marketplace – alles in einer App.</p>
  <div class="row"><span>Wallet</span><b>Bereit für Zahlungen</b></div>
  <div class="row"><span>BlitzMine</span><b>Tippen & BLZ verdienen</b></div>
  <div class="row"><span>Auktionen</span><b>Bis zu 95% sparen</b></div>
  <div class="row"><span>Termine</span><b>Friseur, Arzt, Wellness</b></div>
  <p style="margin-top:20px;text-align:center"><a href="{DOMAIN}" class="btn">App öffnen</a></p>
</div>
<div class="card">
  <p class="title" style="font-size:14px">Tipp</p>
  <p class="sub">Tippe täglich auf den BlitzMine-Button – nach 3 Tagen bekommst du deinen ersten Streak-Bonus (+1 BLZ + 5% Rate dauerhaft).</p>
</div>""")
    return subject, html


def booking_confirmation_email(user_name: str, provider_name: str, service_name: str,
                                date: str, time: str, price: float, appointment_id: str):
    subject = f"Termin bestätigt: {service_name} am {date}"
    price_str = "Kostenlos" if price == 0 else f"&euro;{price:.2f}"
    html = _wrap(f"""
<div class="card">
  <p class="title" style="color:#10B981">Termin bestätigt</p>
  <p class="sub">{user_name}, deine Buchung ist verbindlich eingetragen.</p>
  <div class="row"><span>Anbieter</span><b>{provider_name}</b></div>
  <div class="row"><span>Service</span><b>{service_name}</b></div>
  <div class="row"><span>Datum</span><b>{date}</b></div>
  <div class="row"><span>Uhrzeit</span><b>{time}</b></div>
  <div class="row"><span>Preis</span><b style="color:#00E0FF">{price_str}</b></div>
  <div class="row"><span>Buchungs-ID</span><b style="font-family:monospace;font-size:11px">{appointment_id}</b></div>
  <p style="margin-top:16px;text-align:center"><a href="{DOMAIN}" class="btn btn-green">Termine ansehen</a></p>
</div>
<div class="card">
  <p class="title" style="font-size:14px">Erinnerung</p>
  <p class="sub">Bitte sei pünktlich. Falls du absagen musst, storniere bitte mindestens 24h vorher in der App.</p>
</div>""")
    return subject, html


def streak_milestone_email(user_name: str, title: str, days: int, bonus_blz: float, rate_bonus: int):
    subject = f"{title} freigeschaltet — {days} Tage Streak!"
    html = _wrap(f"""
<div class="hero">
  <h1>{title}</h1>
  <p>{days} Tage in Folge!</p>
</div>
<div class="card">
  <p class="title">Deine Belohnung</p>
  <p class="sub">{user_name}, dein BlitzMine-Streak hat ein neues Level erreicht.</p>
  <div class="row"><span>Sofort-Bonus</span><b style="color:#00E0FF">+{bonus_blz} BLZ</b></div>
  <div class="row"><span>Rate-Boost</span><b style="color:#FFD166">+{rate_bonus}% dauerhaft</b></div>
  <p style="margin-top:16px;text-align:center"><a href="{DOMAIN}" class="btn btn-gold">Weiter minen</a></p>
</div>""")
    return subject, html


def password_reset_email(user_name: str, reset_link: str):
    subject = "BidBlitz — Passwort zurücksetzen"
    html = _wrap(f"""
<div class="card">
  <p class="title">Passwort zurücksetzen</p>
  <p class="sub">{user_name}, du hast einen Reset-Link angefordert. Klick auf den Button, um ein neues Passwort zu setzen.</p>
  <p style="margin-top:16px;text-align:center"><a href="{reset_link}" class="btn">Passwort ändern</a></p>
  <p class="sub" style="margin-top:16px;font-size:11px">Der Link ist 30 Minuten gültig. Wenn du keinen Reset angefordert hast, ignoriere diese Mail.</p>
</div>""")
    return subject, html


# ═══════════════════════════════════════════
# TRIGGER FUNCTIONS
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


async def notify_welcome(user_email: str, user_name: str):
    subject, html = welcome_email(user_name)
    await send_email(user_email, subject, html, "welcome")


async def notify_booking_confirmed(user_email: str, user_name: str, provider_name: str,
                                   service_name: str, date: str, time: str,
                                   price: float, appointment_id: str):
    subject, html = booking_confirmation_email(
        user_name, provider_name, service_name, date, time, price, appointment_id
    )
    await send_email(user_email, subject, html, "booking_confirmed")


async def notify_streak_milestone(user_email: str, user_name: str, title: str,
                                  days: int, bonus_blz: float, rate_bonus: int):
    subject, html = streak_milestone_email(user_name, title, days, bonus_blz, rate_bonus)
    await send_email(user_email, subject, html, "streak_milestone")


async def notify_password_reset(user_email: str, user_name: str, reset_link: str):
    subject, html = password_reset_email(user_name, reset_link)
    await send_email(user_email, subject, html, "password_reset")


# ═══════════════════════════════════════════
# NEW EMAIL TEMPLATES (Phase 1 Expansion)
# ═══════════════════════════════════════════

def payment_received_email(user_name: str, amount: float, sender_name: str, reference: str):
    """Email when user receives money in wallet."""
    subject = f"Zahlung erhalten: €{amount:.2f}"
    html = _wrap(f"""
<div class="card">
  <p class="title" style="color:#10B981">Geld erhalten!</p>
  <p class="sub">{user_name}, du hast eine Zahlung erhalten.</p>
  <p>Betrag: <span class="price">&euro;{amount:.2f}</span></p>
  <div class="row"><span>Von</span><b>{sender_name}</b></div>
  <div class="row"><span>Referenz</span><b style="font-family:monospace;font-size:11px">{reference}</b></div>
  <p style="margin-top:16px;text-align:center"><a href="{DOMAIN}" class="btn btn-green">Wallet öffnen</a></p>
</div>""")
    return subject, html


def taxi_confirmed_email(user_name: str, driver_name: str, vehicle: str, pickup: str, dropoff: str, price: float, ride_id: str):
    """Email when taxi booking is confirmed."""
    subject = f"Taxi bestätigt — {driver_name} holt dich ab"
    html = _wrap(f"""
<div class="card">
  <p class="title" style="color:#10B981">Fahrt bestätigt!</p>
  <p class="sub">{user_name}, dein Fahrer ist unterwegs.</p>
  <div class="row"><span>Fahrer</span><b>{driver_name}</b></div>
  <div class="row"><span>Fahrzeug</span><b>{vehicle}</b></div>
  <div class="row"><span>Von</span><b>{pickup}</b></div>
  <div class="row"><span>Nach</span><b>{dropoff}</b></div>
  <div class="row"><span>Preis</span><b style="color:#00E0FF">&euro;{price:.2f}</b></div>
  <div class="row"><span>Fahrt-ID</span><b style="font-family:monospace;font-size:11px">{ride_id}</b></div>
  <p style="margin-top:16px;text-align:center"><a href="{DOMAIN}" class="btn">Live-Tracking</a></p>
</div>""")
    return subject, html


def premium_expiring_email(user_name: str, days_left: int, renew_url: str):
    """Email when Premium subscription is about to expire."""
    subject = f"Premium läuft in {days_left} Tagen ab"
    html = _wrap(f"""
<div class="card">
  <p class="title" style="color:#FFD166">Premium läuft bald ab</p>
  <p class="sub">{user_name}, dein Premium-Abo endet in {days_left} Tagen.</p>
  <p style="margin-top:16px"><strong>Was du verlierst:</strong></p>
  <div class="row"><span>2× Mining-Rate</span><b style="color:#888">Verloren</b></div>
  <div class="row"><span>0€ Auktions-Gebühren</span><b style="color:#888">Verloren</b></div>
  <div class="row"><span>5% Cashback</span><b style="color:#888">Verloren</b></div>
  <div class="row"><span>+50 BLZ/Monat</span><b style="color:#888">Verloren</b></div>
  <p style="margin-top:16px;text-align:center"><a href="{renew_url}" class="btn btn-gold">Jetzt verlängern</a></p>
</div>""")
    return subject, html


def low_balance_email(user_name: str, current_balance: float, topup_url: str):
    """Email when wallet balance is low."""
    subject = "Wallet-Guthaben niedrig"
    html = _wrap(f"""
<div class="card">
  <p class="title">Guthaben wird knapp</p>
  <p class="sub">{user_name}, dein Wallet-Guthaben ist niedrig.</p>
  <p>Aktueller Stand: <span class="price">&euro;{current_balance:.2f}</span></p>
  <p class="sub" style="margin-top:12px">Lade jetzt auf, damit du weiter bieten und bezahlen kannst.</p>
  <p style="margin-top:16px;text-align:center"><a href="{topup_url}" class="btn">Jetzt aufladen</a></p>
</div>""")
    return subject, html


def auction_ending_soon_email(user_name: str, auction_title: str, current_price: float, minutes_left: int):
    """Email when auction user is watching/bidding on is ending soon."""
    subject = f"Auktion endet in {minutes_left} Min: {auction_title}"
    html = _wrap(f"""
<div class="card">
  <p class="title" style="color:#FF6B00">Letzte Chance!</p>
  <p class="sub">{user_name}, diese Auktion endet bald.</p>
  <p><strong>{auction_title}</strong></p>
  <p>Preis: <span class="price">&euro;{current_price:.2f}</span></p>
  <p class="sub" style="color:#FF6B00">⏱ Noch {minutes_left} Minuten!</p>
  <p style="margin-top:16px;text-align:center"><a href="{DOMAIN}" class="btn">Jetzt bieten</a></p>
</div>""")
    return subject, html


# ═══════════════════════════════════════════
# NEW TRIGGER FUNCTIONS
# ═══════════════════════════════════════════

async def notify_payment_received(user_email: str, user_name: str, amount: float, sender_name: str, reference: str):
    subject, html = payment_received_email(user_name, amount, sender_name, reference)
    await send_email(user_email, subject, html, "payment_received")


async def notify_taxi_confirmed(user_email: str, user_name: str, driver_name: str, vehicle: str, 
                                pickup: str, dropoff: str, price: float, ride_id: str):
    subject, html = taxi_confirmed_email(user_name, driver_name, vehicle, pickup, dropoff, price, ride_id)
    await send_email(user_email, subject, html, "taxi_confirmed")


async def notify_premium_expiring(user_email: str, user_name: str, days_left: int):
    renew_url = f"{DOMAIN}/premium"
    subject, html = premium_expiring_email(user_name, days_left, renew_url)
    await send_email(user_email, subject, html, "premium_expiring")


async def notify_low_balance(user_email: str, user_name: str, current_balance: float):
    topup_url = f"{DOMAIN}/wallet"
    subject, html = low_balance_email(user_name, current_balance, topup_url)
    await send_email(user_email, subject, html, "low_balance")


async def notify_auction_ending_soon(user_email: str, user_name: str, auction_title: str, current_price: float, minutes_left: int):
    subject, html = auction_ending_soon_email(user_name, auction_title, current_price, minutes_left)
    await send_email(user_email, subject, html, "auction_ending_soon")
