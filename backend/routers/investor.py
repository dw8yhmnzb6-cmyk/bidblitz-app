"""Investor Portal Router - Investment Dashboard, Crowdfunding & Statistics with Stripe"""
from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel, Field
import uuid
import os

from config import db, logger
from dependencies import get_current_user, get_admin_user
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest

router = APIRouter(prefix="/investor", tags=["Investor Portal"])

# Stripe API Key
STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY")

# Investment packages (fixed amounts for security)
INVESTMENT_PACKAGES = {
    "starter": {"amount": 500.0, "label": "Starter", "equity": "0.01%", "perks": ["Monatliche Updates", "Investor Badge"]},
    "standard": {"amount": 2500.0, "label": "Standard", "equity": "0.05%", "perks": ["Monatliche Updates", "Investor Badge", "VIP-Zugang"]},
    "premium": {"amount": 10000.0, "label": "Premium", "equity": "0.2%", "perks": ["Wöchentliche Updates", "Investor Badge", "VIP-Zugang", "Exklusive Events"]},
    "partner": {"amount": 50000.0, "label": "Partner", "equity": "1%", "perks": ["Direkter Kontakt", "Advisory Board", "Alle Premium-Vorteile"]}
}

# ==================== MODELS ====================

class InvestmentCreate(BaseModel):
    amount: float = Field(..., gt=0, description="Investment amount in EUR")
    investment_type: str = Field(default="standard", description="standard, premium, partner")
    notes: Optional[str] = None

class InvestmentCheckoutRequest(BaseModel):
    package_id: str
    origin_url: str

class CrowdfundingProject(BaseModel):
    title: str
    description: str
    target_amount: float
    min_investment: float = 100
    reward_type: str = "equity"  # equity, revenue_share, perks
    image_url: Optional[str] = None

class CrowdfundingInvestment(BaseModel):
    project_id: str
    amount: float = Field(..., gt=0)

# ==================== PUBLIC STATISTICS ====================

@router.get("/public/stats")
async def get_public_stats():
    """Get public statistics for potential investors"""
    now = datetime.now(timezone.utc)
    last_30_days = now - timedelta(days=30)
    last_7_days = now - timedelta(days=7)
    
    # Total users
    total_users = await db.users.count_documents({})
    new_users_30d = await db.users.count_documents({
        "created_at": {"$gte": last_30_days.isoformat()}
    })
    
    # Total transactions
    total_transactions = await db.transactions.count_documents({})
    transactions_30d = await db.transactions.count_documents({
        "created_at": {"$gte": last_30_days.isoformat()}
    })
    
    # Revenue (from bid packages)
    pipeline = [
        {"$match": {"status": "completed", "type": "bid_purchase"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    revenue_result = await db.transactions.aggregate(pipeline).to_list(1)
    total_revenue = revenue_result[0]["total"] if revenue_result else 0
    
    # Auctions stats
    total_auctions = await db.auctions.count_documents({})
    completed_auctions = await db.auctions.count_documents({"status": "ended"})
    active_auctions = await db.auctions.count_documents({"status": "active"})
    
    # Calculate growth rates
    users_last_week = await db.users.count_documents({
        "created_at": {"$gte": last_7_days.isoformat()}
    })
    
    return {
        "platform_stats": {
            "total_users": total_users,
            "new_users_30d": new_users_30d,
            "user_growth_weekly": users_last_week,
            "total_transactions": total_transactions,
            "transactions_30d": transactions_30d
        },
        "financial_stats": {
            "total_revenue_eur": round(total_revenue, 2),
            "avg_transaction_value": round(total_revenue / max(total_transactions, 1), 2),
            "currency": "EUR"
        },
        "auction_stats": {
            "total_auctions": total_auctions,
            "completed_auctions": completed_auctions,
            "active_auctions": active_auctions,
            "success_rate": round(completed_auctions / max(total_auctions, 1) * 100, 1)
        },
        "growth_indicators": {
            "monthly_growth_rate": round(new_users_30d / max(total_users - new_users_30d, 1) * 100, 1),
            "platform_status": "growing",
            "market_position": "emerging"
        },
        "last_updated": now.isoformat()
    }

@router.get("/public/growth-chart")
async def get_growth_chart():
    """Get growth data for charts"""
    now = datetime.now(timezone.utc)
    
    # Generate last 12 months data
    months_data = []
    for i in range(12, 0, -1):
        month_start = now - timedelta(days=i*30)
        month_end = now - timedelta(days=(i-1)*30)
        
        users = await db.users.count_documents({
            "created_at": {
                "$gte": month_start.isoformat(),
                "$lt": month_end.isoformat()
            }
        })
        
        revenue_pipeline = [
            {"$match": {
                "status": "completed",
                "created_at": {
                    "$gte": month_start.isoformat(),
                    "$lt": month_end.isoformat()
                }
            }},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]
        revenue_result = await db.transactions.aggregate(revenue_pipeline).to_list(1)
        revenue = revenue_result[0]["total"] if revenue_result else 0
        
        months_data.append({
            "month": month_start.strftime("%b %Y"),
            "users": users,
            "revenue": round(revenue, 2)
        })
    
    return {"chart_data": months_data}

# ==================== INVESTMENT PACKAGES ====================

@router.get("/packages")
async def get_investment_packages():
    """Get available investment packages"""
    return {
        "packages": [
            {"id": k, **v} for k, v in INVESTMENT_PACKAGES.items()
        ],
        "currency": "EUR"
    }

# ==================== STRIPE CHECKOUT ====================

@router.post("/checkout")
async def create_investment_checkout(
    request: Request,
    checkout_data: InvestmentCheckoutRequest,
    user: dict = Depends(get_current_user)
):
    """Create Stripe checkout session for investment"""
    package_id = checkout_data.package_id
    origin_url = checkout_data.origin_url
    
    # Validate package
    if package_id not in INVESTMENT_PACKAGES:
        raise HTTPException(status_code=400, detail="Ungültiges Investment-Paket")
    
    package = INVESTMENT_PACKAGES[package_id]
    amount = package["amount"]
    
    # Create success/cancel URLs
    success_url = f"{origin_url}/investor?session_id={{CHECKOUT_SESSION_ID}}&success=true"
    cancel_url = f"{origin_url}/investor?cancelled=true"
    
    # Initialize Stripe
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/investor/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    # Create checkout session
    checkout_request = CheckoutSessionRequest(
        amount=amount,
        currency="eur",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "user_id": user["id"],
            "user_email": user.get("email", ""),
            "package_id": package_id,
            "investment_type": "direct",
            "equity": package["equity"]
        }
    )
    
    try:
        session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Create pending transaction record
        transaction_id = str(uuid.uuid4())
        await db.investment_transactions.insert_one({
            "id": transaction_id,
            "session_id": session.session_id,
            "user_id": user["id"],
            "user_email": user.get("email"),
            "package_id": package_id,
            "amount": amount,
            "currency": "EUR",
            "equity": package["equity"],
            "perks": package["perks"],
            "payment_status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        logger.info(f"Investment checkout created for {user.get('email')}: €{amount} ({package_id})")
        
        return {
            "checkout_url": session.url,
            "session_id": session.session_id
        }
    except Exception as e:
        logger.error(f"Stripe checkout error: {e}")
        raise HTTPException(status_code=500, detail="Fehler bei der Zahlungsverarbeitung")

@router.get("/checkout/status/{session_id}")
async def get_checkout_status(session_id: str, user: dict = Depends(get_current_user)):
    """Get status of checkout session"""
    # Initialize Stripe
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
    
    try:
        status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
        
        # Update transaction if payment completed
        if status.payment_status == "paid":
            # Check if already processed
            existing = await db.investment_transactions.find_one({
                "session_id": session_id,
                "payment_status": "completed"
            })
            
            if not existing:
                # Update to completed
                result = await db.investment_transactions.update_one(
                    {"session_id": session_id},
                    {"$set": {
                        "payment_status": "completed",
                        "completed_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
                
                if result.modified_count > 0:
                    # Get transaction details
                    transaction = await db.investment_transactions.find_one({"session_id": session_id})
                    
                    # Create investment record
                    await db.investor_investments.insert_one({
                        "id": str(uuid.uuid4()),
                        "user_id": transaction["user_id"],
                        "user_email": transaction.get("user_email"),
                        "amount": transaction["amount"],
                        "investment_type": transaction["package_id"],
                        "equity": transaction.get("equity"),
                        "perks": transaction.get("perks"),
                        "status": "completed",
                        "transaction_id": transaction["id"],
                        "created_at": datetime.now(timezone.utc).isoformat()
                    })
                    
                    logger.info(f"Investment completed: €{transaction['amount']} from {transaction.get('user_email')}")
        
        return {
            "status": status.status,
            "payment_status": status.payment_status,
            "amount": status.amount_total / 100,  # Convert from cents
            "currency": status.currency.upper()
        }
    except Exception as e:
        logger.error(f"Checkout status error: {e}")
        raise HTTPException(status_code=500, detail="Fehler beim Abrufen des Status")

@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    try:
        body = await request.body()
        signature = request.headers.get("Stripe-Signature")
        
        stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        logger.info(f"Stripe webhook received: {webhook_response.event_type}")
        
        if webhook_response.payment_status == "paid":
            # Update transaction
            await db.investment_transactions.update_one(
                {"session_id": webhook_response.session_id},
                {"$set": {
                    "payment_status": "completed",
                    "completed_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        
        return {"received": True}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"received": True}

# ==================== INVESTMENT MANAGEMENT ====================

@router.get("/investments")
async def get_my_investments(user: dict = Depends(get_current_user)):
    """Get user's investments"""
    investments = await db.investor_investments.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    total_invested = sum(inv.get("amount", 0) for inv in investments)
    
    return {
        "investments": investments,
        "total_invested": total_invested,
        "investor_since": investments[-1]["created_at"] if investments else None
    }

@router.post("/investments")
async def create_investment(
    investment: InvestmentCreate,
    user: dict = Depends(get_current_user)
):
    """Create a new investment (pending approval)"""
    investment_id = str(uuid.uuid4())
    
    doc = {
        "id": investment_id,
        "user_id": user["id"],
        "user_name": user.get("name", "Investor"),
        "user_email": user.get("email"),
        "amount": investment.amount,
        "investment_type": investment.investment_type,
        "notes": investment.notes,
        "status": "pending",  # pending, approved, completed, rejected
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.investor_investments.insert_one(doc)
    doc.pop("_id", None)
    
    logger.info(f"New investment request: {investment.amount} EUR from {user.get('email')}")
    
    return {
        "success": True,
        "investment": doc,
        "message": "Ihre Investitionsanfrage wurde eingereicht. Wir werden Sie kontaktieren."
    }

# ==================== CROWDFUNDING ====================

@router.get("/crowdfunding/projects")
async def get_crowdfunding_projects():
    """Get all active crowdfunding projects"""
    projects = await db.crowdfunding_projects.find(
        {"status": {"$in": ["active", "funded"]}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    # Add progress info
    for project in projects:
        investments = await db.crowdfunding_investments.find(
            {"project_id": project["id"], "status": "confirmed"}
        ).to_list(1000)
        
        total_funded = sum(inv.get("amount", 0) for inv in investments)
        project["total_funded"] = total_funded
        project["progress_percent"] = round(total_funded / project.get("target_amount", 1) * 100, 1)
        project["investor_count"] = len(set(inv.get("user_id") for inv in investments))
    
    return {"projects": projects}

@router.post("/crowdfunding/projects")
async def create_crowdfunding_project(
    project: CrowdfundingProject,
    admin: dict = Depends(get_admin_user)
):
    """Create a new crowdfunding project (admin only)"""
    project_id = str(uuid.uuid4())
    
    doc = {
        "id": project_id,
        **project.model_dump(),
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": admin.get("id")
    }
    
    await db.crowdfunding_projects.insert_one(doc)
    doc.pop("_id", None)
    
    return {"success": True, "project": doc}

@router.post("/crowdfunding/invest")
async def invest_in_project(
    investment: CrowdfundingInvestment,
    user: dict = Depends(get_current_user)
):
    """Invest in a crowdfunding project"""
    project = await db.crowdfunding_projects.find_one(
        {"id": investment.project_id},
        {"_id": 0}
    )
    
    if not project:
        raise HTTPException(status_code=404, detail="Projekt nicht gefunden")
    
    if project.get("status") != "active":
        raise HTTPException(status_code=400, detail="Projekt akzeptiert keine Investitionen mehr")
    
    if investment.amount < project.get("min_investment", 100):
        raise HTTPException(
            status_code=400, 
            detail=f"Mindestinvestition: €{project.get('min_investment', 100)}"
        )
    
    investment_id = str(uuid.uuid4())
    
    doc = {
        "id": investment_id,
        "project_id": investment.project_id,
        "user_id": user["id"],
        "user_name": user.get("name"),
        "user_email": user.get("email"),
        "amount": investment.amount,
        "status": "pending",  # pending, confirmed, refunded
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.crowdfunding_investments.insert_one(doc)
    doc.pop("_id", None)
    
    return {
        "success": True,
        "investment": doc,
        "message": f"Investition von €{investment.amount} eingereicht. Bitte überweisen Sie den Betrag."
    }

# ==================== ADMIN ENDPOINTS ====================

@router.get("/admin/investments")
async def admin_get_all_investments(admin: dict = Depends(get_admin_user)):
    """Get all investment requests (admin only)"""
    investments = await db.investor_investments.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).to_list(500)
    
    total_pending = sum(inv.get("amount", 0) for inv in investments if inv.get("status") == "pending")
    total_approved = sum(inv.get("amount", 0) for inv in investments if inv.get("status") == "approved")
    total_completed = sum(inv.get("amount", 0) for inv in investments if inv.get("status") == "completed")
    
    return {
        "investments": investments,
        "summary": {
            "total_pending": total_pending,
            "total_approved": total_approved,
            "total_completed": total_completed,
            "total_investors": len(set(inv.get("user_id") for inv in investments))
        }
    }

@router.put("/admin/investments/{investment_id}/status")
async def admin_update_investment_status(
    investment_id: str,
    status: str,
    admin: dict = Depends(get_admin_user)
):
    """Update investment status (admin only)"""
    if status not in ["pending", "approved", "completed", "rejected"]:
        raise HTTPException(status_code=400, detail="Ungültiger Status")
    
    result = await db.investor_investments.update_one(
        {"id": investment_id},
        {"$set": {
            "status": status,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": admin.get("id")
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Investition nicht gefunden")
    
    return {"success": True, "message": f"Status auf '{status}' aktualisiert"}

@router.get("/admin/dashboard")
async def admin_investor_dashboard(admin: dict = Depends(get_admin_user)):
    """Get investor dashboard for admin"""
    # Total investments
    all_investments = await db.investor_investments.find({}, {"_id": 0}).to_list(1000)
    crowdfunding_investments = await db.crowdfunding_investments.find({}, {"_id": 0}).to_list(1000)
    
    total_direct = sum(inv.get("amount", 0) for inv in all_investments if inv.get("status") == "completed")
    total_crowdfunding = sum(inv.get("amount", 0) for inv in crowdfunding_investments if inv.get("status") == "confirmed")
    
    # Active projects
    active_projects = await db.crowdfunding_projects.count_documents({"status": "active"})
    
    return {
        "total_investment_direct": total_direct,
        "total_investment_crowdfunding": total_crowdfunding,
        "total_investment": total_direct + total_crowdfunding,
        "pending_investments": len([inv for inv in all_investments if inv.get("status") == "pending"]),
        "total_investors": len(set(inv.get("user_id") for inv in all_investments)),
        "active_crowdfunding_projects": active_projects
    }
