"""
BidBlitz V2 — Full Investor & Revenue Distribution System
Real profit sharing, revenue tracking, automated payouts.
"""
import secrets
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from bson import ObjectId
from core.database import db

router = APIRouter(prefix="/api/investor", tags=["Investor"])
logger = logging.getLogger("bidblitz.investor")

# Investment tiers (configurable by admin)
DEFAULT_TIERS = [
    {"min_amount": 1000, "max_amount": 4999, "share_percent": 1.0},
    {"min_amount": 5000, "max_amount": 9999, "share_percent": 3.0},
    {"min_amount": 10000, "max_amount": 49999, "share_percent": 5.0},
    {"min_amount": 50000, "max_amount": 99999, "share_percent": 10.0},
    {"min_amount": 100000, "max_amount": None, "share_percent": 15.0},  # Custom negotiated
]

# Profit split defaults
DEFAULT_PROFIT_SPLIT = {
    "investors_percent": 30.0,
    "company_percent": 60.0,
    "reinvest_percent": 10.0,
}


async def get_current_user(request: Request):
    from routes.auth import get_current_user as auth_user
    return await auth_user(request)


async def get_profit_config():
    cfg = await db.profit_config.find_one({"_id": "global"}, {"_id": 0})
    return cfg or DEFAULT_PROFIT_SPLIT


async def get_investment_tiers():
    tiers = await db.investment_tiers.find({}, {"_id": 0}).sort("min_amount", 1).to_list(20)
    return tiers if tiers else DEFAULT_TIERS


# ══════════════════════════════════════════════════════════════════════════════
# INVESTOR APPLICATION & MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════

class InvestorApplicationReq(BaseModel):
    amount: float = Field(..., ge=1000)
    company: str = ""
    message: str = ""


class AdminApproveReq(BaseModel):
    application_id: str
    share_percent: Optional[float] = None  # Override tier if custom


@router.post("/apply")
async def apply_as_investor(req: InvestorApplicationReq, request: Request):
    """User applies to become an investor."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Check existing
    existing = await db.investors.find_one({"user_id": user_id, "status": {"$ne": "rejected"}})
    if existing:
        raise HTTPException(status_code=400, detail="You already have an active or pending investment")
    
    # Determine tier
    tiers = await get_investment_tiers()
    share_percent = 0
    for tier in tiers:
        if req.amount >= tier["min_amount"]:
            if tier["max_amount"] is None or req.amount <= tier["max_amount"]:
                share_percent = tier["share_percent"]
                break
    
    now = datetime.now(timezone.utc)
    application = {
        "application_id": secrets.token_hex(8),
        "user_id": user_id,
        "user_email": user.get("email", ""),
        "user_name": user.get("name", ""),
        "investment_amount": req.amount,
        "proposed_share_percent": share_percent,
        "company": req.company,
        "message": req.message,
        "status": "pending",
        "created_at": now.isoformat(),
    }
    await db.investor_applications.insert_one(application)
    application.pop("_id", None)
    
    logger.info(f"New investor application: {user.get('email')} for €{req.amount}")
    return {
        "ok": True,
        "application": application,
        "message": f"Application submitted. Proposed share: {share_percent}%",
    }


@router.get("/my-status")
async def get_investor_status(request: Request):
    """Get current user's investor status."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    # Check if active investor
    investor = await db.investors.find_one({"user_id": user_id, "status": "active"}, {"_id": 0})
    if investor:
        # Calculate earnings
        earnings = await db.investor_payouts.find({"investor_id": user_id}).to_list(100)
        total_earned = sum(e.get("amount", 0) for e in earnings)
        pending = sum(e.get("amount", 0) for e in earnings if e.get("status") == "pending")
        paid = sum(e.get("amount", 0) for e in earnings if e.get("status") == "credited")
        
        return {
            "is_investor": True,
            **investor,
            "total_earned": round(total_earned, 2),
            "pending_payout": round(pending, 2),
            "total_paid": round(paid, 2),
            "recent_payouts": [e for e in earnings[:20] if "_id" not in e or e.pop("_id", None) is None or True],
        }
    
    # Check pending application
    application = await db.investor_applications.find_one(
        {"user_id": user_id, "status": "pending"}, {"_id": 0}
    )
    if application:
        return {"is_investor": False, "has_pending_application": True, "application": application}
    
    return {"is_investor": False, "has_pending_application": False}


@router.get("/dashboard")
async def get_investor_dashboard(request: Request):
    """Full investor dashboard with analytics."""
    user = await get_current_user(request)
    user_id = str(user["_id"])
    
    investor = await db.investors.find_one({"user_id": user_id, "status": "active"})
    if not investor:
        raise HTTPException(status_code=403, detail="Not an active investor")
    
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    # Get earnings
    all_payouts = await db.investor_payouts.find({"investor_id": user_id}).to_list(500)
    
    total_earned = sum(p.get("amount", 0) for p in all_payouts)
    today_earned = sum(p.get("amount", 0) for p in all_payouts 
                       if p.get("created_at") and p["created_at"] >= today_start.isoformat())
    month_earned = sum(p.get("amount", 0) for p in all_payouts 
                       if p.get("created_at") and p["created_at"] >= month_start.isoformat())
    
    # Platform stats for investor
    platform_revenue = await db.platform_revenue.find().sort("date", -1).to_list(30)
    
    return {
        "investor": {k: v for k, v in investor.items() if k != "_id"},
        "earnings": {
            "total": round(total_earned, 2),
            "today": round(today_earned, 2),
            "this_month": round(month_earned, 2),
            "pending": round(sum(p.get("amount", 0) for p in all_payouts if p.get("status") == "pending"), 2),
        },
        "share_percent": investor.get("share_percent", 0),
        "invested_amount": investor.get("invested_amount", 0),
        "recent_payouts": [{k: v for k, v in p.items() if k != "_id"} for p in all_payouts[:15]],
        "platform_revenue_30d": [{k: v for k, v in r.items() if k != "_id"} for r in platform_revenue],
    }


# ══════════════════════════════════════════════════════════════════════════════
# REVENUE TRACKING
# ══════════════════════════════════════════════════════════════════════════════

REVENUE_SOURCES = [
    "auction_credits",
    "mining_packages",
    "kids_subscription",
    "merchant_fees",
    "taxi_fees",
    "scooter_fees",
    "food_fees",
    "stripe_topup_fees",
    "other",
]


async def record_platform_revenue(source: str, amount: float, metadata: dict = None):
    """Record a revenue event for profit distribution."""
    if source not in REVENUE_SOURCES:
        source = "other"
    
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    
    event = {
        "event_id": secrets.token_hex(8),
        "source": source,
        "amount": round(amount, 2),
        "date": today,
        "created_at": now.isoformat(),
        "metadata": metadata or {},
    }
    await db.revenue_events.insert_one(event)
    
    # Update daily aggregate
    await db.platform_revenue.update_one(
        {"date": today},
        {
            "$inc": {
                "total": round(amount, 2),
                f"by_source.{source}": round(amount, 2),
            },
            "$setOnInsert": {"created_at": now.isoformat()},
        },
        upsert=True,
    )
    
    return event


@router.get("/admin/revenue")
async def get_revenue_stats(request: Request):
    """Admin: Get platform revenue statistics."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    
    # Last 30 days
    days_30_ago = (now - timedelta(days=30)).strftime("%Y-%m-%d")
    revenue_data = await db.platform_revenue.find(
        {"date": {"$gte": days_30_ago}}
    ).sort("date", -1).to_list(30)
    
    total_30d = sum(r.get("total", 0) for r in revenue_data)
    today_revenue = next((r.get("total", 0) for r in revenue_data if r.get("date") == today), 0)
    
    # By source aggregation
    by_source = {}
    for r in revenue_data:
        for src, amt in r.get("by_source", {}).items():
            by_source[src] = by_source.get(src, 0) + amt
    
    return {
        "total_30_days": round(total_30d, 2),
        "today": round(today_revenue, 2),
        "by_source": {k: round(v, 2) for k, v in by_source.items()},
        "daily_breakdown": [{k: v for k, v in r.items() if k != "_id"} for r in revenue_data],
    }


# ══════════════════════════════════════════════════════════════════════════════
# PROFIT DISTRIBUTION ENGINE
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/admin/distribute-profits")
async def distribute_profits(request: Request):
    """Admin: Distribute profits to investors based on their share."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    body = await request.json()
    period = body.get("period", "today")  # today | week | month | custom
    custom_amount = body.get("amount")  # For manual distribution
    
    now = datetime.now(timezone.utc)
    
    if custom_amount:
        profit_to_distribute = float(custom_amount)
    else:
        # Calculate from revenue
        if period == "today":
            date_filter = now.strftime("%Y-%m-%d")
            revenue = await db.platform_revenue.find_one({"date": date_filter})
            profit_to_distribute = revenue.get("total", 0) if revenue else 0
        elif period == "week":
            week_ago = (now - timedelta(days=7)).strftime("%Y-%m-%d")
            revenues = await db.platform_revenue.find({"date": {"$gte": week_ago}}).to_list(7)
            profit_to_distribute = sum(r.get("total", 0) for r in revenues)
        elif period == "month":
            month_start = now.replace(day=1).strftime("%Y-%m-%d")
            revenues = await db.platform_revenue.find({"date": {"$gte": month_start}}).to_list(31)
            profit_to_distribute = sum(r.get("total", 0) for r in revenues)
        else:
            profit_to_distribute = 0
    
    if profit_to_distribute <= 0:
        return {"ok": False, "message": "No profit to distribute"}
    
    # Get profit split config
    config = await get_profit_config()
    investor_pool = profit_to_distribute * (config.get("investors_percent", 30) / 100)
    
    # Get active investors
    investors = await db.investors.find({"status": "active"}).to_list(100)
    if not investors:
        return {"ok": False, "message": "No active investors"}
    
    # Calculate total shares
    total_shares = sum(inv.get("share_percent", 0) for inv in investors)
    if total_shares <= 0:
        return {"ok": False, "message": "No investor shares configured"}
    
    payouts = []
    for inv in investors:
        share = inv.get("share_percent", 0)
        if share <= 0:
            continue
        
        # Each investor gets their proportion of the investor pool
        payout_amount = (share / total_shares) * investor_pool
        payout_amount = round(payout_amount, 2)
        
        if payout_amount < 0.01:
            continue
        
        # Create payout record
        payout = {
            "payout_id": secrets.token_hex(8),
            "investor_id": inv["user_id"],
            "investor_email": inv.get("user_email", ""),
            "amount": payout_amount,
            "share_percent": share,
            "period": period,
            "profit_pool": round(investor_pool, 2),
            "status": "pending",
            "created_at": now.isoformat(),
        }
        await db.investor_payouts.insert_one(payout)
        payouts.append(payout)
    
    # Record distribution event
    await db.profit_distributions.insert_one({
        "distribution_id": secrets.token_hex(8),
        "period": period,
        "total_profit": round(profit_to_distribute, 2),
        "investor_pool": round(investor_pool, 2),
        "payouts_count": len(payouts),
        "created_at": now.isoformat(),
        "created_by": str(user["_id"]),
    })
    
    return {
        "ok": True,
        "total_profit": round(profit_to_distribute, 2),
        "investor_pool": round(investor_pool, 2),
        "payouts_created": len(payouts),
        "payouts": [{k: v for k, v in p.items() if k != "_id"} for p in payouts],
    }


@router.post("/admin/credit-payouts")
async def credit_pending_payouts(request: Request):
    """Admin: Credit pending investor payouts to their wallets."""
    from core.payment_engine import credit_wallet, TransactionType
    
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    pending = await db.investor_payouts.find({"status": "pending"}).to_list(500)
    if not pending:
        return {"ok": False, "message": "No pending payouts"}
    
    credited = 0
    failed = 0
    now = datetime.now(timezone.utc)
    
    for payout in pending:
        try:
            result = await credit_wallet(
                user_id=payout["investor_id"],
                amount=payout["amount"],
                tx_type=TransactionType.INVESTOR_PROFIT,
                description=f"Investor Profit ({payout.get('period', 'manual')})",
                reference=f"INV-{payout['payout_id'][:8].upper()}",
                source="profit_distribution",
                metadata={"payout_id": payout["payout_id"]}
            )
            
            if result.success:
                await db.investor_payouts.update_one(
                    {"payout_id": payout["payout_id"]},
                    {"$set": {"status": "credited", "credited_at": now.isoformat(), "transaction_id": result.transaction_id}}
                )
                credited += 1
            else:
                failed += 1
        except Exception as e:
            logger.error(f"Failed to credit payout {payout['payout_id']}: {e}")
            failed += 1
    
    return {"ok": True, "credited": credited, "failed": failed}


# ══════════════════════════════════════════════════════════════════════════════
# ADMIN: INVESTOR MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/applications")
async def list_applications(request: Request):
    """Admin: List investor applications."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    apps = await db.investor_applications.find({}).sort("created_at", -1).to_list(100)
    return {"applications": [{k: v for k, v in a.items() if k != "_id"} for a in apps]}


@router.post("/admin/approve")
async def approve_investor(req: AdminApproveReq, request: Request):
    """Admin: Approve an investor application."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    app = await db.investor_applications.find_one({"application_id": req.application_id})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    if app.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Application already processed")
    
    now = datetime.now(timezone.utc)
    share_percent = req.share_percent or app.get("proposed_share_percent", 1.0)
    
    # Create investor record
    investor = {
        "investor_id": secrets.token_hex(8),
        "user_id": app["user_id"],
        "user_email": app.get("user_email", ""),
        "user_name": app.get("user_name", ""),
        "invested_amount": app["investment_amount"],
        "share_percent": share_percent,
        "status": "active",
        "approved_at": now.isoformat(),
        "approved_by": str(user["_id"]),
        "created_at": now.isoformat(),
    }
    await db.investors.insert_one(investor)
    
    # Update application
    await db.investor_applications.update_one(
        {"application_id": req.application_id},
        {"$set": {"status": "approved", "approved_at": now.isoformat()}}
    )
    
    # Update user role
    await db.users.update_one(
        {"_id": ObjectId(app["user_id"])},
        {"$set": {"is_investor": True}}
    )
    
    logger.info(f"Investor approved: {app.get('user_email')} with {share_percent}% share")
    return {"ok": True, "investor": {k: v for k, v in investor.items() if k != "_id"}}


@router.get("/admin/investors")
async def list_investors(request: Request):
    """Admin: List all investors."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    investors = await db.investors.find({}).sort("created_at", -1).to_list(100)
    
    # Add earnings to each
    result = []
    for inv in investors:
        payouts = await db.investor_payouts.find({"investor_id": inv["user_id"]}).to_list(100)
        inv_data = {k: v for k, v in inv.items() if k != "_id"}
        inv_data["total_earned"] = round(sum(p.get("amount", 0) for p in payouts), 2)
        inv_data["pending_payout"] = round(sum(p.get("amount", 0) for p in payouts if p.get("status") == "pending"), 2)
        result.append(inv_data)
    
    return {"investors": result, "total": len(result)}


@router.post("/admin/profit-config")
async def update_profit_config(request: Request):
    """Admin: Update profit split configuration."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    body = await request.json()
    update = {}
    if "investors_percent" in body:
        update["investors_percent"] = float(body["investors_percent"])
    if "company_percent" in body:
        update["company_percent"] = float(body["company_percent"])
    if "reinvest_percent" in body:
        update["reinvest_percent"] = float(body["reinvest_percent"])
    
    if update:
        update["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.profit_config.update_one({"_id": "global"}, {"$set": update}, upsert=True)
    
    cfg = await get_profit_config()
    return {"config": cfg}


@router.get("/tiers")
async def get_tiers():
    """Get investment tiers (public)."""
    tiers = await get_investment_tiers()
    return {"tiers": tiers}


# ══════════════════════════════════════════════════════════════════════════════
# ANALYTICS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/analytics")
async def get_analytics(request: Request):
    """Admin: Full platform analytics."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    yesterday = (now - timedelta(days=1)).strftime("%Y-%m-%d")
    week_ago = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    month_ago = (now - timedelta(days=30)).strftime("%Y-%m-%d")
    
    # User stats
    total_users = await db.users.count_documents({})
    active_today = await db.users.count_documents({"last_active_date": today})
    new_today = await db.users.count_documents({"created_at": {"$regex": f"^{today}"}})
    
    # Revenue
    revenue_30d = await db.platform_revenue.find({"date": {"$gte": month_ago}}).to_list(30)
    total_revenue_30d = sum(r.get("total", 0) for r in revenue_30d)
    
    # Transactions
    total_transactions = await db.transactions.count_documents({})
    transactions_today = await db.transactions.count_documents({"created_at": {"$regex": f"^{today}"}})
    
    # Investors
    total_investors = await db.investors.count_documents({"status": "active"})
    total_invested = 0
    investors = await db.investors.find({"status": "active"}).to_list(100)
    total_invested = sum(inv.get("invested_amount", 0) for inv in investors)
    
    # Influencers
    total_influencers = await db.influencers.count_documents({"status": "active"})
    
    return {
        "users": {
            "total": total_users,
            "active_today": active_today,
            "new_today": new_today,
        },
        "revenue": {
            "total_30_days": round(total_revenue_30d, 2),
            "daily_average": round(total_revenue_30d / 30, 2) if total_revenue_30d else 0,
        },
        "transactions": {
            "total": total_transactions,
            "today": transactions_today,
        },
        "investors": {
            "total": total_investors,
            "total_invested": round(total_invested, 2),
        },
        "influencers": {
            "total": total_influencers,
        },
    }
