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
    
    # Revenue and transactions
    payments = await db.payment_transactions.find({"status": "paid"}, {"_id": 0}).to_list(1000)
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

@router.post("/email/send-campaign")
async def send_email_campaign(
    subject: str,
    html_content: str,
    target_group: str = "all",
    admin: dict = Depends(get_admin_user)
):
    """Send email campaign to user segment"""
    if not RESEND_API_KEY or RESEND_API_KEY == 're_123_placeholder':
        raise HTTPException(status_code=503, detail="Email service not configured")
    
    # Build query based on target group
    query = {"is_admin": {"$ne": True}}
    
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
    
    users = await db.users.find(query, {"email": 1}).to_list(10000)
    
    if not users:
        return {"sent": 0, "message": "No users in target group"}
    
    # Send emails
    sent_count = 0
    failed_count = 0
    
    for user in users:
        try:
            resend.Emails.send({
                "from": SENDER_EMAIL,
                "to": [user["email"]],
                "subject": subject,
                "html": html_content
            })
            sent_count += 1
        except Exception as e:
            logger.error(f"Failed to send email to {user['email']}: {e}")
            failed_count += 1
    
    # Log campaign
    await db.email_campaigns.insert_one({
        "id": str(uuid.uuid4()),
        "subject": subject,
        "target_group": target_group,
        "sent_count": sent_count,
        "failed_count": failed_count,
        "sent_by": admin["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "sent": sent_count,
        "failed": failed_count,
        "message": f"Campaign sent to {sent_count} users"
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
