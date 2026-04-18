"""
Re-Engagement System — Sendet inaktiven Usern eine E-Mail + 5€ Gutschein.
Anti-Spam: Jeder User max. 1x alle 30 Tage.
"""
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from bson import ObjectId
import logging

from core.database import db
from core.security import get_current_user
from routes.email_service import send_email

logger = logging.getLogger("bidblitz.reengage")
router = APIRouter(prefix="/api/admin/reengage", tags=["re-engagement"])

REWARD_EUR = 5.0
INACTIVITY_DAYS = 5
COOLDOWN_DAYS = 30


def _oid(s):
    try:
        return ObjectId(s)
    except Exception:
        return s


async def _require_admin(request: Request):
    user = await get_current_user(request)
    if user.get("role") not in ("admin", "super_admin"):
        raise HTTPException(403, "Admin only")
    return user


async def _find_eligible_users(inactive_days: int, cooldown_days: int) -> list:
    """User, die X Tage inaktiv sind UND in den letzten 30 Tagen KEINE Reengage-Mail bekommen haben."""
    now = datetime.now(timezone.utc)
    inactive_cutoff = (now - timedelta(days=inactive_days)).isoformat()
    cooldown_cutoff = (now - timedelta(days=cooldown_days)).isoformat()
    query = {
        "banned": {"$ne": True},
        "email": {"$exists": True, "$ne": ""},
        "$and": [
            # Inaktiv: last_seen älter als X Tage ODER nie eingeloggt aber Konto > X Tage alt
            {"$or": [
                {"last_seen": {"$lt": inactive_cutoff}},
                {"$and": [
                    {"last_seen": {"$exists": False}},
                    {"created_at": {"$lt": inactive_cutoff}},
                ]},
            ]},
            # Noch keine Reengage-Mail ODER älter als Cooldown
            {"$or": [
                {"last_reengage_at": {"$exists": False}},
                {"last_reengage_at": {"$lt": cooldown_cutoff}},
            ]},
        ],
    }
    users = await db.users.find(
        query,
        {"_id": 1, "email": 1, "name": 1, "last_seen": 1, "created_at": 1, "last_reengage_at": 1},
    ).limit(500).to_list(length=500)
    return users


def _email_html(name: str, amount: float) -> str:
    return f"""<!DOCTYPE html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; background:#f5f7fa; margin:0; padding:20px;">
  <div style="max-width:520px; margin:0 auto; background:white; border-radius:20px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#00C2FF,#A855F7); padding:40px 30px; text-align:center; color:white;">
      <div style="font-size:48px; margin-bottom:8px;">🎁</div>
      <h1 style="margin:0; font-size:26px; font-weight:800;">Wir vermissen dich, {name or 'Freund'}!</h1>
    </div>
    <div style="padding:30px;">
      <p style="font-size:16px; color:#333; line-height:1.6;">
        Schön, dass du bei BidBlitz bist! Wir haben dich eine Weile nicht gesehen —
        deshalb schenken wir dir einen kleinen Willkommen-zurück-Bonus:
      </p>
      <div style="background:linear-gradient(135deg,#00D26A,#00C2FF); color:white; text-align:center; padding:20px; border-radius:14px; margin:24px 0;">
        <div style="font-size:14px; opacity:0.9; text-transform:uppercase; letter-spacing:1.5px;">Deine Belohnung</div>
        <div style="font-size:42px; font-weight:900; margin:4px 0;">+{amount:.2f} €</div>
        <div style="font-size:12px; opacity:0.9;">sofort in deiner Wallet</div>
      </div>
      <p style="font-size:15px; color:#555;">Das erwartet dich bei BidBlitz:</p>
      <ul style="color:#555; font-size:14px; line-height:1.8;">
        <li>🎰 Live-Auktionen mit bis zu 80% Rabatt</li>
        <li>🛒 SMM Boost für Instagram, TikTok & mehr</li>
        <li>🎮 Arcade mit 30+ Games + Casino</li>
        <li>💰 BLZ-Token verdienen täglich</li>
      </ul>
      <div style="text-align:center; margin-top:30px;">
        <a href="https://bidblitz.ae/wallet" style="display:inline-block; background:#00C2FF; color:white; padding:14px 32px; text-decoration:none; border-radius:999px; font-weight:700; font-size:15px;">
          Jetzt einsehen →
        </a>
      </div>
    </div>
    <div style="padding:20px; text-align:center; color:#999; font-size:11px;">
      Du erhältst diese Mail weil du bei BidBlitz registriert bist.<br>
      Maximale E-Mail-Frequenz: 1× alle 30 Tage.
    </div>
  </div>
</body></html>"""


@router.get("/preview")
async def preview_reengage(request: Request, inactive_days: int = INACTIVITY_DAYS):
    """Zeigt, welche User eine Mail bekommen würden (ohne zu senden)."""
    await _require_admin(request)
    eligible = await _find_eligible_users(inactive_days, COOLDOWN_DAYS)
    return {
        "count": len(eligible),
        "reward_per_user": REWARD_EUR,
        "total_cost": round(len(eligible) * REWARD_EUR, 2),
        "inactive_days": inactive_days,
        "cooldown_days": COOLDOWN_DAYS,
        "users": [
            {
                "user_id": str(u["_id"]),
                "email": u.get("email", ""),
                "name": u.get("name", "") or "",
                "last_seen": u.get("last_seen"),
                "created_at": u.get("created_at"),
                "last_reengage_at": u.get("last_reengage_at"),
            }
            for u in eligible[:100]
        ],
    }


class RunReengageRequest(BaseModel):
    inactive_days: int = INACTIVITY_DAYS
    dry_run: bool = False


@router.post("/run")
async def run_reengage(req: RunReengageRequest, request: Request):
    """Führt Re-Engagement aus: credits Wallet, sendet Mail, markiert User."""
    admin = await _require_admin(request)
    admin_id = str(admin.get("_id") or admin.get("id"))
    eligible = await _find_eligible_users(req.inactive_days, COOLDOWN_DAYS)

    if req.dry_run:
        return {"dry_run": True, "would_process": len(eligible), "total_cost": len(eligible) * REWARD_EUR}

    now = datetime.now(timezone.utc).isoformat()
    credited = 0
    emailed = 0
    failed = 0
    for u in eligible:
        uid = u["_id"]
        uid_str = str(uid)
        try:
            # 1. Credit Wallet (+5€)
            await db.users.update_one(
                {"_id": uid},
                {"$inc": {"balance": REWARD_EUR}, "$set": {"last_reengage_at": now}},
            )
            await db.transactions.insert_one({
                "user_id": uid_str,
                "type": "bonus",
                "amount": REWARD_EUR,
                "currency": "EUR",
                "status": "completed",
                "description": "Willkommen-zurück-Bonus",
                "merchant_name": "BidBlitz",
                "category": "reengagement",
                "reference": f"REENG-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uid_str[-6:]}",
                "date": now,
                "created_at": now,
                "admin_id": admin_id,
            })
            credited += 1

            # 2. E-Mail senden
            try:
                name = u.get("name", "") or u.get("email", "").split("@")[0]
                html = _email_html(name, REWARD_EUR)
                result = await send_email(
                    u["email"],
                    "🎁 Willkommen zurück — dein Bonus wartet!",
                    html,
                    "reengagement",
                )
                if result:
                    emailed += 1
            except Exception as e:
                logger.warning(f"Email failed for {u.get('email')}: {e}")

            # 3. Log-Event
            await db.reengage_log.insert_one({
                "user_id": uid_str,
                "email": u.get("email"),
                "amount": REWARD_EUR,
                "sent_at": now,
                "admin_id": admin_id,
            })
        except Exception as e:
            logger.error(f"Reengage failed for {u.get('email')}: {e}")
            failed += 1

    return {
        "ok": True,
        "eligible": len(eligible),
        "credited": credited,
        "emailed": emailed,
        "failed": failed,
        "total_cost": round(credited * REWARD_EUR, 2),
    }


@router.get("/history")
async def reengage_history(request: Request, limit: int = 100):
    """Historie aller Re-Engagement-Aktionen."""
    await _require_admin(request)
    cursor = db.reengage_log.find({}, {"_id": 0}).sort("sent_at", -1).limit(limit)
    logs = await cursor.to_list(length=limit)
    return {"history": logs, "count": len(logs)}
