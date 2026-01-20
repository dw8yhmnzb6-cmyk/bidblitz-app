"""Admin router - Dashboard stats, user management, email marketing"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone, timedelta
from typing import List, Optional
import uuid
import resend

from config import db, logger, RESEND_API_KEY, SENDER_EMAIL
from dependencies import get_admin_user

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
        "products": total_products
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

@router.post("/email/send-test")
async def send_test_email(
    to_email: str,
    subject: str,
    html_content: str,
    admin: dict = Depends(get_admin_user)
):
    """Send a test email"""
    if not RESEND_API_KEY or RESEND_API_KEY == 're_123_placeholder':
        raise HTTPException(status_code=503, detail="Email service not configured")
    
    try:
        resend.Emails.send({
            "from": SENDER_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": html_content
        })
        return {"message": f"Test email sent to {to_email}"}
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
