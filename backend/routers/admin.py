"""Admin router - Dashboard stats, user management, email marketing"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import uuid
import resend

from config import db, logger, RESEND_API_KEY, SENDER_EMAIL
from dependencies import get_admin_user
from utils.email_translations import (
    get_email_template, 
    generate_email_html, 
    SUPPORTED_EMAIL_LANGUAGES,
    EMAIL_TRANSLATIONS
)

router = APIRouter(prefix="/admin", tags=["Admin"])

# ==================== DASHBOARD STATS ====================

@router.get("/stats")
async def get_admin_stats(admin: dict = Depends(get_admin_user)):
    """Get dashboard statistics"""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    week_ago = (now - timedelta(days=7)).isoformat()
    month_ago = (now - timedelta(days=30)).isoformat()
    
    # User counts
    total_users = await db.users.count_documents({"is_admin": {"$ne": True}})
    new_users_today = await db.users.count_documents({"created_at": {"$gte": today_start}})
    new_users_week = await db.users.count_documents({"created_at": {"$gte": week_ago}})
    
    # Auction counts
    total_auctions = await db.auctions.count_documents({})
    active_auctions = await db.auctions.count_documents({"status": "active"})
    ended_auctions = await db.auctions.count_documents({"status": "ended"})
    
    # Revenue
    completed_transactions = await db.transactions.find(
        {"status": "completed"},
        {"amount": 1}
    ).to_list(10000)
    total_revenue = sum(t.get("amount", 0) for t in completed_transactions)
    
    # Recent transactions
    recent_revenue = await db.transactions.find(
        {"status": "completed", "completed_at": {"$gte": week_ago}},
        {"amount": 1}
    ).to_list(1000)
    week_revenue = sum(t.get("amount", 0) for t in recent_revenue)
    
    # Product count
    total_products = await db.products.count_documents({})
    
    return {
        "users": {
            "total": total_users,
            "today": new_users_today,
            "this_week": new_users_week
        },
        "auctions": {
            "total": total_auctions,
            "active": active_auctions,
            "ended": ended_auctions
        },
        "revenue": {
            "total": round(total_revenue, 2),
            "this_week": round(week_revenue, 2)
        },
        "products": total_products,
        "total_products": total_products,
        "active_auctions": active_auctions,
        "total_users": total_users,
        "completed_transactions": len(completed_transactions)
    }

@router.get("/stats/detailed")
async def get_detailed_stats(admin: dict = Depends(get_admin_user)):
    """Get detailed statistics for charts and reports."""
    now = datetime.now(timezone.utc)
    
    # Revenue and transactions - use transactions collection
    payments = await db.transactions.find({"status": "completed"}, {"_id": 0}).to_list(1000)
    total_revenue = sum(p.get("amount", 0) for p in payments)
    total_bids_sold = sum(p.get("bids", 0) for p in payments)
    
    # Revenue by day (last 7 days)
    revenue_by_day = []
    for i in range(7):
        day = now - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        day_revenue = sum(
            p.get("amount", 0) for p in payments 
            if p.get("created_at") and 
            day_start.isoformat() <= p.get("created_at", "") < day_end.isoformat()
        )
        revenue_by_day.append({
            "date": day_start.strftime("%d.%m"),
            "revenue": round(day_revenue, 2),
            "day_name": day_start.strftime("%a")
        })
    revenue_by_day.reverse()
    
    # Auctions stats
    auctions = await db.auctions.find({}, {"_id": 0}).to_list(1000)
    ended_auctions = [a for a in auctions if a.get("status") == "ended"]
    total_bids = sum(a.get("total_bids", 0) for a in auctions)
    
    # Bids by day (last 7 days)
    bids_by_day = []
    for i in range(7):
        day = now - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        day_bids = 0
        for auction in auctions:
            for bid in auction.get("bid_history", []):
                bid_time = bid.get("timestamp", "")
                if day_start.isoformat() <= bid_time < day_end.isoformat():
                    day_bids += 1
        bids_by_day.append({
            "date": day_start.strftime("%d.%m"),
            "bids": day_bids,
            "day_name": day_start.strftime("%a")
        })
    bids_by_day.reverse()
    
    # Users stats
    users = await db.users.find({}, {"_id": 0, "is_admin": 1, "bids_balance": 1, "created_at": 1}).to_list(10000)
    total_users = len(users)
    total_user_bids = sum(u.get("bids_balance", 0) for u in users)
    
    # New users by day (last 7 days)
    users_by_day = []
    for i in range(7):
        day = now - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        new_users = sum(
            1 for u in users 
            if u.get("created_at") and 
            day_start.isoformat() <= u.get("created_at", "") < day_end.isoformat()
        )
        users_by_day.append({
            "date": day_start.strftime("%d.%m"),
            "users": new_users,
            "day_name": day_start.strftime("%a")
        })
    users_by_day.reverse()
    
    # Auction status distribution
    status_distribution = {
        "active": await db.auctions.count_documents({"status": "active"}),
        "scheduled": await db.auctions.count_documents({"status": "scheduled"}),
        "ended": await db.auctions.count_documents({"status": "ended"})
    }
    
    # Top products (by bids) - need to fetch product names
    products_map = {}
    products_list = await db.products.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(1000)
    for p in products_list:
        products_map[p["id"]] = p.get("name", "Unknown")
    
    top_products = sorted(
        [(products_map.get(a.get("product_id"), "Unknown"), a.get("total_bids", 0)) for a in auctions],
        key=lambda x: x[1],
        reverse=True
    )[:5]
    
    return {
        "summary": {
            "total_revenue": round(total_revenue, 2),
            "total_transactions": len(payments),
            "total_bids_sold": total_bids_sold,
            "total_bids_placed": total_bids,
            "total_users": total_users,
            "total_user_bids_balance": total_user_bids,
            "ended_auctions": len(ended_auctions),
            "avg_bids_per_auction": round(total_bids / len(auctions), 1) if auctions else 0
        },
        "charts": {
            "revenue_by_day": revenue_by_day,
            "bids_by_day": bids_by_day,
            "users_by_day": users_by_day,
            "status_distribution": status_distribution,
            "top_products": [{"name": p[0], "bids": p[1]} for p in top_products]
        }
    }

# ==================== USER MANAGEMENT ====================

@router.get("/users")
async def get_all_users(admin: dict = Depends(get_admin_user)):
    """Get all users"""
    users = await db.users.find(
        {},
        {"_id": 0, "password": 0, "two_factor_secret": 0}
    ).sort("created_at", -1).to_list(1000)
    return users

@router.get("/users/{user_id}")
async def get_user(user_id: str, admin: dict = Depends(get_admin_user)):
    """Get single user details"""
    user = await db.users.find_one(
        {"id": user_id},
        {"_id": 0, "password": 0, "two_factor_secret": 0}
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.put("/users/{user_id}/bids")
async def adjust_user_bids(user_id: str, bids: int, admin: dict = Depends(get_admin_user)):
    """Adjust user's bid balance"""
    result = await db.users.update_one(
        {"id": user_id},
        {"$inc": {"bids_balance": bids}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "bids_balance": 1})
    return {"message": f"Bids adjusted by {bids}", "new_balance": user["bids_balance"]}

@router.put("/users/{user_id}/add-bids")
async def add_user_bids(user_id: str, bids: int, admin: dict = Depends(get_admin_user)):
    """Add bids to user's balance (alias for /bids)"""
    result = await db.users.update_one(
        {"id": user_id},
        {"$inc": {"bids_balance": bids}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Benutzer nicht gefunden")
    
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "bids_balance": 1, "name": 1})
    return {
        "message": f"{bids} Gebote hinzugefügt für {user.get('name', 'Benutzer')}", 
        "new_balance": user["bids_balance"]
    }

@router.put("/users/{user_id}/block")
async def toggle_user_block(user_id: str, admin: dict = Depends(get_admin_user)):
    """Toggle user block status"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    new_status = not user.get("is_blocked", False)
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_blocked": new_status}}
    )
    
    return {"message": f"User {'blocked' if new_status else 'unblocked'}", "is_blocked": new_status}

@router.put("/users/{user_id}/guaranteed-winner")
async def toggle_guaranteed_winner(user_id: str, admin: dict = Depends(get_admin_user)):
    """Toggle guaranteed winner status - User will always win when bidding"""
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    new_status = not user.get("is_guaranteed_winner", False)
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"is_guaranteed_winner": new_status}}
    )
    
    logger.info(f"🏆 Guaranteed winner status changed for {user.get('name')}: {new_status}")
    
    return {
        "message": f"Garantierter Gewinner {'aktiviert' if new_status else 'deaktiviert'}", 
        "is_guaranteed_winner": new_status
    }

# ==================== EMAIL MARKETING ====================

@router.get("/email/stats")
async def get_email_stats(admin: dict = Depends(get_admin_user)):
    """Get email marketing statistics"""
    total_users = await db.users.count_documents({"is_admin": {"$ne": True}})
    
    # Active users (logged in within 30 days)
    month_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    active_users = await db.users.count_documents({
        "last_login_ip": {"$ne": None},
        "$or": [
            {"last_purchase_at": {"$gte": month_ago}},
            {"created_at": {"$gte": month_ago}}
        ]
    })
    
    # Users who made purchases
    paying_users = await db.users.count_documents({"total_deposits": {"$gt": 0}})
    
    # Inactive users (no purchase, registered > 7 days ago)
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    inactive_users = await db.users.count_documents({
        "total_deposits": {"$eq": 0},
        "created_at": {"$lt": week_ago}
    })
    
    return {
        "total_users": total_users,
        "active_users": active_users,
        "paying_users": paying_users,
        "inactive_users": inactive_users,
        "email_configured": bool(RESEND_API_KEY and RESEND_API_KEY != 're_123_placeholder')
    }

@router.get("/email/user-stats")
async def get_email_user_stats(admin: dict = Depends(get_admin_user)):
    """Get user statistics for email targeting - includes all segment counts"""
    now = datetime.now(timezone.utc)
    week_ago = (now - timedelta(days=7)).isoformat()
    month_ago = (now - timedelta(days=30)).isoformat()
    
    # Total users (excluding admins)
    total = await db.users.count_documents({"is_admin": {"$ne": True}})
    
    # Active users (logged in within 30 days or made purchase)
    active = await db.users.count_documents({
        "is_admin": {"$ne": True},
        "$or": [
            {"last_login_ip": {"$ne": None}},
            {"created_at": {"$gte": month_ago}}
        ]
    })
    
    # Inactive users (no purchase, registered > 7 days ago)
    inactive = await db.users.count_documents({
        "is_admin": {"$ne": True},
        "$or": [
            {"total_deposits": {"$eq": 0}},
            {"total_deposits": {"$exists": False}}
        ],
        "created_at": {"$lt": week_ago}
    })
    
    # Winners (users who have won auctions)
    winners = await db.users.count_documents({
        "is_admin": {"$ne": True},
        "won_auctions": {"$exists": True, "$not": {"$size": 0}}
    })
    
    # New users (registered within last 7 days)
    new_users = await db.users.count_documents({
        "is_admin": {"$ne": True},
        "created_at": {"$gte": week_ago}
    })
    
    return {
        "total": total,
        "active": active,
        "inactive": inactive,
        "winners": winners,
        "new_users": new_users,
        "all": total  # Alias for dropdown
    }

@router.get("/email/templates")
async def get_email_templates(admin: dict = Depends(get_admin_user)):
    """Get predefined email templates"""
    return [
        {
            "id": "welcome_back",
            "name": "Willkommen zurück",
            "subject": "Wir vermissen dich bei BidBlitz! 🎁",
            "preview": "Komm zurück und sichere dir 5 Gratis-Gebote..."
        },
        {
            "id": "special_offer",
            "name": "Sonderangebot",
            "subject": "Nur heute: 50% mehr Gebote! 🔥",
            "preview": "Kaufe jetzt Gebote und erhalte 50% Extra..."
        },
        {
            "id": "new_auctions",
            "name": "Neue Auktionen",
            "subject": "Neue Produkte warten auf dich! 🛍️",
            "preview": "Entdecke unsere neuesten Auktionen..."
        },
        {
            "id": "winner_congrats",
            "name": "Gewinner Glückwünsche",
            "subject": "Herzlichen Glückwunsch zum Gewinn! 🏆",
            "preview": "Du hast eine Auktion gewonnen..."
        }
    ]

class EmailCampaignRequest(BaseModel):
    subject: str
    html_content: str
    target_group: str = "all"

@router.post("/email/send-campaign")
async def send_email_campaign(
    data: EmailCampaignRequest,
    admin: dict = Depends(get_admin_user)
):
    """Send email campaign to user segment"""
    if not RESEND_API_KEY or RESEND_API_KEY == 're_123_placeholder':
        raise HTTPException(status_code=503, detail="Email service not configured. Please add RESEND_API_KEY.")
    
    # Build query based on target group
    query = {"is_admin": {"$ne": True}}
    
    if data.target_group == "active":
        month_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        query["$or"] = [
            {"last_purchase_at": {"$gte": month_ago}},
            {"created_at": {"$gte": month_ago}}
        ]
    elif data.target_group == "paying":
        query["total_deposits"] = {"$gt": 0}
    elif data.target_group == "inactive":
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        query["total_deposits"] = {"$eq": 0}
        query["created_at"] = {"$lt": week_ago}
    elif data.target_group == "winners":
        query["won_auctions"] = {"$exists": True, "$not": {"$size": 0}}
    elif data.target_group == "new_users":
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        query["created_at"] = {"$gte": week_ago}
    
    users = await db.users.find(query, {"_id": 0, "email": 1, "name": 1}).to_list(10000)
    
    if not users:
        return {"sent": 0, "failed": 0, "message": "Keine Benutzer in dieser Zielgruppe"}
    
    # Send emails
    sent_count = 0
    failed_count = 0
    
    for user in users:
        try:
            # Personalize content with user name
            user_name = user.get("name") or user.get("email", "").split("@")[0]
            personalized_content = data.html_content.replace("{name}", user_name)
            
            resend.Emails.send({
                "from": SENDER_EMAIL,
                "to": [user["email"]],
                "subject": data.subject,
                "html": personalized_content
            })
            sent_count += 1
        except Exception as e:
            logger.error(f"Failed to send email to {user['email']}: {e}")
            failed_count += 1
    
    # Log campaign
    await db.email_campaigns.insert_one({
        "id": str(uuid.uuid4()),
        "subject": data.subject,
        "target_group": data.target_group,
        "sent_count": sent_count,
        "failed_count": failed_count,
        "sent_by": admin["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "sent": sent_count,
        "failed": failed_count,
        "message": f"Kampagne an {sent_count} Benutzer gesendet ({failed_count} fehlgeschlagen)"
    }

@router.post("/email/send-localized")
async def send_localized_email_campaign(
    template_id: str,
    target_group: str = "all",
    custom_params: dict = None,
    admin: dict = Depends(get_admin_user)
):
    """Send localized email campaign - each user receives email in their preferred language"""
    if not RESEND_API_KEY or RESEND_API_KEY == 're_123_placeholder':
        raise HTTPException(status_code=503, detail="Email service not configured")
    
    # Validate template exists
    if template_id not in EMAIL_TRANSLATIONS.get("de", {}):
        raise HTTPException(status_code=400, detail=f"Template '{template_id}' not found")
    
    # Build query based on target group
    query = {"is_admin": {"$ne": True}, "is_bot": {"$ne": True}}
    
    if target_group == "active":
        month_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
        query["$or"] = [
            {"last_purchase_at": {"$gte": month_ago}},
            {"created_at": {"$gte": month_ago}}
        ]
    elif target_group == "paying":
        query["total_deposits"] = {"$gt": 0}
    elif target_group == "inactive":
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        query["total_deposits"] = {"$eq": 0}
        query["created_at"] = {"$lt": week_ago}
    
    # Get users with their preferred language
    users = await db.users.find(
        query, 
        {"_id": 0, "email": 1, "name": 1, "preferred_language": 1}
    ).to_list(10000)
    
    if not users:
        return {"sent": 0, "failed": 0, "message": "No users in target group"}
    
    sent_count = 0
    failed_count = 0
    languages_sent = {}
    
    for user in users:
        try:
            # Get user's preferred language (default to German)
            user_lang = user.get("preferred_language", "de")
            if user_lang not in SUPPORTED_EMAIL_LANGUAGES:
                user_lang = "de"
            
            # Get user name
            user_name = user.get("name") or user.get("email", "").split("@")[0]
            
            # Build template parameters
            params = {"name": user_name}
            if custom_params:
                params.update(custom_params)
            
            # Get localized template
            template = get_email_template(template_id, user_lang, **params)
            html_content = generate_email_html(template, "https://bidblitz.de/auctions")
            
            # Send email
            resend.Emails.send({
                "from": SENDER_EMAIL,
                "to": [user["email"]],
                "subject": template.get("subject", "BidBlitz Update"),
                "html": html_content
            })
            
            sent_count += 1
            languages_sent[user_lang] = languages_sent.get(user_lang, 0) + 1
            
        except Exception as e:
            logger.error(f"Failed to send localized email to {user.get('email')}: {e}")
            failed_count += 1
    
    # Log campaign
    await db.email_campaigns.insert_one({
        "id": str(uuid.uuid4()),
        "type": "localized",
        "template_id": template_id,
        "target_group": target_group,
        "sent_count": sent_count,
        "failed_count": failed_count,
        "languages": languages_sent,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin["id"]
    })
    
    return {
        "sent": sent_count,
        "failed": failed_count,
        "languages": languages_sent,
        "message": f"Localized campaign sent to {sent_count} users in {len(languages_sent)} languages"
    }

@router.get("/email/languages")
async def get_supported_email_languages(admin: dict = Depends(get_admin_user)):
    """Get list of supported email languages"""
    language_names = {
        "de": "Deutsch",
        "en": "English",
        "sq": "Shqip (Albanian)",
        "el": "Ελληνικά (Greek)",
        "tr": "Türkçe (Turkish)",
        "fr": "Français",
        "es": "Español",
        "it": "Italiano"
    }
    
    return {
        "languages": [
            {"code": code, "name": language_names.get(code, code)}
            for code in SUPPORTED_EMAIL_LANGUAGES
        ]
    }

@router.post("/email/preview")
async def preview_email_template(
    template_id: str,
    language: str = "de",
    admin: dict = Depends(get_admin_user)
):
    """Preview an email template in a specific language"""
    if template_id not in EMAIL_TRANSLATIONS.get("de", {}):
        raise HTTPException(status_code=400, detail=f"Template '{template_id}' not found")
    
    # Example parameters for preview
    preview_params = {
        "name": "Max Mustermann",
        "bids": "5",
        "count": "10",
        "products": "iPhone 15, Apple Watch, PlayStation 5",
        "product": "Apple AirPods Pro",
        "price": "12.50"
    }
    
    template = get_email_template(template_id, language, **preview_params)
    html_content = generate_email_html(template, "https://bidblitz.de/auctions")
    
    return {
        "template_id": template_id,
        "language": language,
        "subject": template.get("subject"),
        "html": html_content
    }

class TestEmailRequest(BaseModel):
    to_email: str
    subject: str
    html_content: str

@router.post("/email/send-test")
async def send_test_email(
    data: TestEmailRequest,
    admin: dict = Depends(get_admin_user)
):
    """Send a test email"""
    if not RESEND_API_KEY or RESEND_API_KEY == 're_123_placeholder':
        raise HTTPException(status_code=503, detail="Email service not configured. Please add RESEND_API_KEY.")
    
    try:
        resend.Emails.send({
            "from": SENDER_EMAIL,
            "to": [data.to_email],
            "subject": data.subject,
            "html": data.html_content
        })
        return {"message": f"Test email sent to {data.to_email}"}
    except Exception as e:
        logger.error(f"Failed to send test email: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== TRANSACTIONS ====================

@router.get("/transactions")
async def get_transactions(admin: dict = Depends(get_admin_user)):
    """Get all transactions"""
    transactions = await db.transactions.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    return transactions

# ==================== SECURITY LOGS ====================

@router.get("/security-logs")
async def get_security_logs(admin: dict = Depends(get_admin_user), limit: int = 100):
    """Get recent security logs"""
    logs = await db.security_logs.find(
        {},
        {"_id": 0}
    ).sort("timestamp", -1).to_list(limit)
    return logs


# ==================== ADMIN CONFIGURATION ====================

class GameConfig(BaseModel):
    # Daily Login Rewards
    daily_reward_enabled: bool = True
    daily_reward_min_bids: int = 1
    daily_reward_max_bids: int = 5
    streak_bonus_day_7: int = 10
    streak_bonus_day_14: int = 20
    streak_bonus_day_30: int = 50
    
    # Free Auctions
    free_auction_enabled: bool = True
    free_auction_max_participants: int = 100
    
    # Beginner Auctions
    beginner_auction_enabled: bool = True
    beginner_max_wins: int = 10
    
    # Night Auctions (23:30-06:00) - Half price bids
    night_auction_enabled: bool = True
    night_auction_bid_discount: int = 50  # 50% = half price bids
    night_auction_start_hour: float = 23.5  # 23:30 Uhr
    night_auction_end_hour: int = 6
    
    # Achievements
    achievements_enabled: bool = True
    
    # Referral
    referral_reward_bids: int = 10
    referral_min_deposit: float = 5.0


@router.get("/config/game")
async def get_game_config(admin: dict = Depends(get_admin_user)):
    """Get game configuration settings"""
    config = await db.game_config.find_one({"id": "main"}, {"_id": 0})
    if not config:
        # Return defaults
        return GameConfig().model_dump()
    return config


@router.put("/config/game")
async def update_game_config(config: GameConfig, admin: dict = Depends(get_admin_user)):
    """Update game configuration settings"""
    config_dict = config.model_dump()
    config_dict["id"] = "main"
    config_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    config_dict["updated_by"] = admin["id"]
    
    await db.game_config.update_one(
        {"id": "main"},
        {"$set": config_dict},
        upsert=True
    )
    
    logger.info(f"Game config updated by admin {admin['id']}")
    return {"message": "Configuration updated", "config": config_dict}


# ==================== ACHIEVEMENTS SYSTEM ====================

ACHIEVEMENT_DEFINITIONS = [
    {"id": "first_win", "name": "Erster Sieg", "name_en": "First Win", "description": "Gewinne deine erste Auktion", "icon": "🏆", "bids_reward": 5},
    {"id": "wins_10", "name": "Sammler", "name_en": "Collector", "description": "Gewinne 10 Auktionen", "icon": "🎯", "bids_reward": 20},
    {"id": "wins_50", "name": "Profi", "name_en": "Pro", "description": "Gewinne 50 Auktionen", "icon": "⭐", "bids_reward": 100},
    {"id": "wins_100", "name": "Meister", "name_en": "Master", "description": "Gewinne 100 Auktionen", "icon": "👑", "bids_reward": 250},
    {"id": "night_owl", "name": "Nachteule", "name_en": "Night Owl", "description": "Gewinne 5 Nacht-Auktionen", "icon": "🦉", "bids_reward": 15},
    {"id": "early_bird", "name": "Frühaufsteher", "name_en": "Early Bird", "description": "Biete vor 8 Uhr morgens", "icon": "🐦", "bids_reward": 5},
    {"id": "big_spender", "name": "Großzügig", "name_en": "Big Spender", "description": "Kaufe Gebote für über €100", "icon": "💎", "bids_reward": 30},
    {"id": "lucky_winner", "name": "Glückspilz", "name_en": "Lucky Winner", "description": "Gewinne mit nur 1 Gebot", "icon": "🍀", "bids_reward": 10},
    {"id": "streak_7", "name": "Wochensieger", "name_en": "Week Champion", "description": "7 Tage Login-Streak", "icon": "🔥", "bids_reward": 10},
    {"id": "streak_30", "name": "Monatssieger", "name_en": "Month Champion", "description": "30 Tage Login-Streak", "icon": "💪", "bids_reward": 50},
    {"id": "referral_5", "name": "Werber", "name_en": "Recruiter", "description": "Werbe 5 Freunde", "icon": "👥", "bids_reward": 25},
    {"id": "beginner_champ", "name": "Anfänger-Champion", "name_en": "Beginner Champ", "description": "Gewinne 3 Anfänger-Auktionen", "icon": "🎓", "bids_reward": 15},
]


@router.get("/achievements/all")
async def get_all_achievements(admin: dict = Depends(get_admin_user)):
    """Get all achievement definitions"""
    return {"achievements": ACHIEVEMENT_DEFINITIONS}


@router.post("/achievements/grant/{user_id}/{achievement_id}")
async def grant_achievement(user_id: str, achievement_id: str, admin: dict = Depends(get_admin_user)):
    """Manually grant an achievement to a user"""
    # Find achievement definition
    achievement = next((a for a in ACHIEVEMENT_DEFINITIONS if a["id"] == achievement_id), None)
    if not achievement:
        raise HTTPException(status_code=404, detail="Achievement not found")
    
    # Check if user exists
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if already has achievement
    existing = await db.user_achievements.find_one({
        "user_id": user_id,
        "achievement_id": achievement_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="User already has this achievement")
    
    # Grant achievement
    await db.user_achievements.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "achievement_id": achievement_id,
        "granted_at": datetime.now(timezone.utc).isoformat(),
        "granted_by": "admin"
    })
    
    # Grant bids reward
    if achievement.get("bids_reward", 0) > 0:
        await db.users.update_one(
            {"id": user_id},
            {"$inc": {"bids_balance": achievement["bids_reward"]}}
        )
    
    logger.info(f"Achievement {achievement_id} granted to user {user_id} by admin")
    return {"message": f"Achievement '{achievement['name']}' granted", "bids_reward": achievement.get("bids_reward", 0)}


# ==================== DAILY REWARDS ADMIN ====================

@router.get("/daily-rewards/stats")
async def get_daily_rewards_stats(admin: dict = Depends(get_admin_user)):
    """Get daily rewards statistics"""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    week_ago = (now - timedelta(days=7)).isoformat()
    
    # Today's claims
    today_claims = await db.daily_rewards.count_documents({
        "claimed_at": {"$gte": today_start}
    })
    
    # Week's claims
    week_claims = await db.daily_rewards.count_documents({
        "claimed_at": {"$gte": week_ago}
    })
    
    # Total bids given
    pipeline = [
        {"$group": {"_id": None, "total_bids": {"$sum": "$bids_given"}}}
    ]
    result = await db.daily_rewards.aggregate(pipeline).to_list(1)
    total_bids_given = result[0]["total_bids"] if result else 0
    
    # Users with streaks
    users_with_streaks = await db.users.count_documents({
        "login_streak": {"$gte": 7}
    })
    
    return {
        "today_claims": today_claims,
        "week_claims": week_claims,
        "total_bids_given": total_bids_given,
        "users_with_7day_streak": users_with_streaks
    }


# ==================== BULK AUCTION CREATION ====================

class BulkAuctionCreate(BaseModel):
    product_ids: List[str]
    duration_minutes: int = 10
    is_beginner_only: bool = False
    is_free_auction: bool = False
    is_night_auction: bool = False
    is_vip_only: bool = False
    stagger_minutes: int = 5  # Time between each auction start


@router.post("/auctions/bulk-create")
async def bulk_create_auctions(data: BulkAuctionCreate, admin: dict = Depends(get_admin_user)):
    """Create multiple auctions at once"""
    now = datetime.now(timezone.utc)
    created_auctions = []
    
    for i, product_id in enumerate(data.product_ids):
        # Check product exists
        product = await db.products.find_one({"id": product_id}, {"_id": 0})
        if not product:
            continue
        
        # Calculate start time (staggered)
        start_time = now + timedelta(minutes=i * data.stagger_minutes)
        end_time = start_time + timedelta(minutes=data.duration_minutes)
        
        auction = {
            "id": str(uuid.uuid4()),
            "product_id": product_id,
            "status": "active" if i == 0 else "scheduled",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "current_price": 0.00,
            "start_price": 0.00,
            "total_bids": 0,
            "bid_history": [],
            "is_beginner_only": data.is_beginner_only,
            "is_free_auction": data.is_free_auction,
            "is_night_auction": data.is_night_auction,
            "is_vip_only": data.is_vip_only,
            "auto_restart": True,
            "original_duration_minutes": data.duration_minutes,
            "created_at": now.isoformat(),
            "created_by": admin["id"]
        }
        
        await db.auctions.insert_one(auction)
        created_auctions.append(auction["id"])
    
    logger.info(f"Bulk created {len(created_auctions)} auctions by admin {admin['id']}")
    return {
        "message": f"{len(created_auctions)} auctions created",
        "auction_ids": created_auctions
    }


# ==================== PRODUCT BULK IMPORT ====================

class ProductImport(BaseModel):
    name: str
    description: str = ""
    retail_price: float
    category: str = "Elektronik"
    image_url: str = ""


@router.post("/products/bulk-import")
async def bulk_import_products(products: List[ProductImport], admin: dict = Depends(get_admin_user)):
    """Import multiple products at once"""
    now = datetime.now(timezone.utc)
    created_products = []
    
    for p in products:
        product = {
            "id": str(uuid.uuid4()),
            "name": p.name,
            "description": p.description,
            "retail_price": p.retail_price,
            "category": p.category,
            "image_url": p.image_url or f"https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400",
            "created_at": now.isoformat(),
            "created_by": admin["id"]
        }
        await db.products.insert_one(product)
        created_products.append(product["id"])
    
    logger.info(f"Bulk imported {len(created_products)} products by admin {admin['id']}")
    return {
        "message": f"{len(created_products)} products imported",
        "product_ids": created_products
    }


# ==================== STAFF/MITARBEITER MANAGEMENT ====================

# Available staff roles with permissions
STAFF_ROLES = {
    "editor": {
        "name": "Editor",
        "description": "Kann Produkte und Auktionen bearbeiten",
        "permissions": ["products.view", "products.edit", "auctions.view", "auctions.edit"]
    },
    "support": {
        "name": "Support",
        "description": "Kann Benutzer verwalten und Support-Anfragen bearbeiten",
        "permissions": ["users.view", "users.edit", "support.view", "support.manage"]
    },
    "marketing": {
        "name": "Marketing",
        "description": "Kann E-Mail-Kampagnen und Gutscheine verwalten",
        "permissions": ["email.view", "email.send", "vouchers.view", "vouchers.create"]
    },
    "manager": {
        "name": "Manager",
        "description": "Vollständiger Zugriff auf alle Bereiche außer Mitarbeiter-Verwaltung",
        "permissions": ["products.*", "auctions.*", "users.*", "email.*", "vouchers.*", "stats.view"]
    },
    "admin": {
        "name": "Administrator",
        "description": "Vollständiger Zugriff auf alle Bereiche inkl. Mitarbeiter-Verwaltung",
        "permissions": ["*"]
    }
}

ALL_PERMISSIONS = {
    "products.view": "Produkte ansehen",
    "products.edit": "Produkte bearbeiten",
    "products.create": "Produkte erstellen",
    "products.delete": "Produkte löschen",
    "auctions.view": "Auktionen ansehen",
    "auctions.edit": "Auktionen bearbeiten",
    "auctions.create": "Auktionen erstellen",
    "auctions.delete": "Auktionen löschen",
    "users.view": "Benutzer ansehen",
    "users.edit": "Benutzer bearbeiten",
    "users.ban": "Benutzer sperren",
    "email.view": "E-Mails ansehen",
    "email.send": "E-Mails senden",
    "vouchers.view": "Gutscheine ansehen",
    "vouchers.create": "Gutscheine erstellen",
    "vouchers.delete": "Gutscheine löschen",
    "stats.view": "Statistiken ansehen",
    "support.view": "Support-Anfragen ansehen",
    "support.manage": "Support-Anfragen bearbeiten",
    "staff.view": "Mitarbeiter ansehen",
    "staff.manage": "Mitarbeiter verwalten"
}


class StaffCreate(BaseModel):
    email: str
    password: str
    name: str = ""
    role: str = "editor"


class StaffUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("/staff/roles")
async def get_staff_roles(admin: dict = Depends(get_admin_user)):
    """Get all available staff roles"""
    return STAFF_ROLES


@router.get("/staff/permissions")
async def get_all_permissions(admin: dict = Depends(get_admin_user)):
    """Get all available permissions"""
    return ALL_PERMISSIONS


@router.get("/staff")
async def get_all_staff(admin: dict = Depends(get_admin_user)):
    """Get all staff members"""
    staff_members = await db.staff.find({}, {"_id": 0, "password_hash": 0}).to_list(100)
    
    # Add role name to each staff member
    for member in staff_members:
        role_id = member.get("role", "editor")
        role_info = STAFF_ROLES.get(role_id, STAFF_ROLES["editor"])
        member["role_name"] = role_info["name"]
        member["permissions"] = role_info["permissions"]
    
    return staff_members


@router.post("/staff")
async def create_staff(data: StaffCreate, admin: dict = Depends(get_admin_user)):
    """Create a new staff member"""
    import bcrypt
    
    # Check if email already exists
    existing = await db.staff.find_one({"email": data.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="E-Mail bereits vergeben")
    
    # Validate role
    if data.role not in STAFF_ROLES:
        raise HTTPException(status_code=400, detail=f"Ungültige Rolle. Verfügbar: {list(STAFF_ROLES.keys())}")
    
    # Hash password
    password_hash = bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode()
    
    now = datetime.now(timezone.utc)
    staff_member = {
        "id": str(uuid.uuid4()),
        "email": data.email.lower(),
        "password_hash": password_hash,
        "name": data.name or data.email.split("@")[0],
        "role": data.role,
        "is_active": True,
        "created_at": now.isoformat(),
        "created_by": admin["id"]
    }
    
    await db.staff.insert_one(staff_member)
    
    logger.info(f"Staff member created: {data.email} with role {data.role}")
    
    # Return without password
    staff_member.pop("password_hash", None)
    staff_member.pop("_id", None)
    staff_member["role_name"] = STAFF_ROLES[data.role]["name"]
    
    return staff_member


@router.put("/staff/{staff_id}")
async def update_staff(staff_id: str, data: StaffUpdate, admin: dict = Depends(get_admin_user)):
    """Update a staff member"""
    staff_member = await db.staff.find_one({"id": staff_id})
    if not staff_member:
        raise HTTPException(status_code=404, detail="Mitarbeiter nicht gefunden")
    
    updates = {}
    if data.name is not None:
        updates["name"] = data.name
    if data.role is not None:
        if data.role not in STAFF_ROLES:
            raise HTTPException(status_code=400, detail=f"Ungültige Rolle")
        updates["role"] = data.role
    if data.is_active is not None:
        updates["is_active"] = data.is_active
    
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.staff.update_one({"id": staff_id}, {"$set": updates})
    
    updated = await db.staff.find_one({"id": staff_id}, {"_id": 0, "password_hash": 0})
    updated["role_name"] = STAFF_ROLES.get(updated.get("role", "editor"), {}).get("name", "Editor")
    
    return updated


@router.delete("/staff/{staff_id}")
async def delete_staff(staff_id: str, admin: dict = Depends(get_admin_user)):
    """Delete a staff member"""
    result = await db.staff.delete_one({"id": staff_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Mitarbeiter nicht gefunden")
    
    logger.info(f"Staff member deleted: {staff_id}")
    return {"message": "Mitarbeiter gelöscht"}



# ==================== BANNER MANAGEMENT ====================

class BannerCreate(BaseModel):
    title: str
    image_url: str
    link_url: Optional[str] = None
    position: str = "homepage_middle"  # homepage_middle, homepage_top, sidebar
    is_active: bool = True
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class BannerUpdate(BaseModel):
    title: Optional[str] = None
    image_url: Optional[str] = None
    link_url: Optional[str] = None
    position: Optional[str] = None
    is_active: Optional[bool] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None


@router.get("/banners")
async def get_banners(admin: dict = Depends(get_admin_user)):
    """Get all banners"""
    banners = await db.banners.find({}, {"_id": 0}).to_list(100)
    return banners


@router.post("/banners")
async def create_banner(data: BannerCreate, admin: dict = Depends(get_admin_user)):
    """Create a new banner"""
    now = datetime.now(timezone.utc)
    
    banner = {
        "id": str(uuid.uuid4()),
        "title": data.title,
        "image_url": data.image_url,
        "link_url": data.link_url,
        "position": data.position,
        "is_active": data.is_active,
        "start_date": data.start_date,
        "end_date": data.end_date,
        "clicks": 0,
        "views": 0,
        "created_at": now.isoformat(),
        "created_by": admin["id"]
    }
    
    await db.banners.insert_one(banner)
    banner.pop("_id", None)
    
    logger.info(f"Banner created: {data.title} by admin {admin['id']}")
    return banner


@router.put("/banners/{banner_id}")
async def update_banner(banner_id: str, data: BannerUpdate, admin: dict = Depends(get_admin_user)):
    """Update a banner"""
    banner = await db.banners.find_one({"id": banner_id})
    if not banner:
        raise HTTPException(status_code=404, detail="Banner nicht gefunden")
    
    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.banners.update_one({"id": banner_id}, {"$set": update_data})
    
    updated = await db.banners.find_one({"id": banner_id}, {"_id": 0})
    return updated


@router.delete("/banners/{banner_id}")
async def delete_banner(banner_id: str, admin: dict = Depends(get_admin_user)):
    """Delete a banner"""
    result = await db.banners.delete_one({"id": banner_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Banner nicht gefunden")
    
    logger.info(f"Banner deleted: {banner_id}")
    return {"message": "Banner gelöscht"}


# Public endpoint for banners (no auth required)
@router.get("/public/banners")
async def get_public_banners(position: str = "homepage_middle"):
    """Get active banners for a position (public endpoint)"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Simple query - just check position and is_active
    banners = await db.banners.find({
        "position": position,
        "is_active": True
    }, {"_id": 0}).to_list(10)
    
    # Filter by date if set
    active_banners = []
    for b in banners:
        # Check start_date
        start_ok = b.get("start_date") is None or b.get("start_date") <= now
        # Check end_date
        end_ok = b.get("end_date") is None or b.get("end_date") >= now
        
        if start_ok and end_ok:
            active_banners.append(b)
            # Increment view count
            await db.banners.update_one({"id": b["id"]}, {"$inc": {"views": 1}})
    
    return active_banners


@router.post("/public/banners/{banner_id}/click")
async def track_banner_click(banner_id: str):
    """Track a banner click (public endpoint)"""
    result = await db.banners.update_one({"id": banner_id}, {"$inc": {"clicks": 1}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Banner nicht gefunden")
    return {"success": True}
