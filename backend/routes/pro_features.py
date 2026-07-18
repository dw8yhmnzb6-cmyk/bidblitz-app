"""
BidBlitz V2 - KYC Light Verification, Ad Banners, Affiliate Links, Tax Report
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone, timedelta
from core.database import db
from core.security import get_current_user
from core.config import TEST_MODE
import secrets, random

router = APIRouter(prefix="/api/pro", tags=["pro-features"])


# ═══ KYC LIGHT VERIFICATION ═══
EXPRESS_FEE = 4.99

class KYCSubmit(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    date_of_birth: str = ""
    selfie_url: str = ""
    id_front_url: str = ""
    express: bool = False

@router.post("/kyc/submit")
async def submit_kyc(req: KYCSubmit, request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    
    existing = await db.kyc_submissions.find_one({"user_email": email, "status": {"$in": ["pending", "approved"]}})
    if existing:
        if existing["status"] == "approved":
            return {"ok": True, "message": "Bereits verifiziert!", "status": "approved"}
        return {"ok": True, "message": "Verifizierung läuft bereits", "status": "pending"}
    
    if req.express:
        balance = user.get("balance", 0)
        if balance < EXPRESS_FEE:
            raise HTTPException(400, f"Express-Gebühr: €{EXPRESS_FEE:.2f}")
        await db.users.update_one({"email": email}, {"$inc": {"balance": -EXPRESS_FEE}})
    
    submission = {
        "kyc_id": secrets.token_hex(8),
        "user_email": email,
        "full_name": req.full_name,
        "date_of_birth": req.date_of_birth,
        "selfie_url": req.selfie_url,
        "id_front_url": req.id_front_url,
        "express": req.express,
        "status": "pending",
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "estimated_completion": "24h" if req.express else "72h",
    }
    await db.kyc_submissions.insert_one(submission)
    
    # Auto-approve for demo
    await db.kyc_submissions.update_one({"kyc_id": submission["kyc_id"]}, {"$set": {"status": "approved", "approved_at": datetime.now(timezone.utc).isoformat()}})
    await db.users.update_one({"email": email}, {"$set": {"verified": True, "kyc_status": "approved"}})
    
    return {"ok": True, "kyc_id": submission["kyc_id"], "status": "approved",
            "message": f"Verifizierung {'Express (24h)' if req.express else 'Standard (72h)'} eingereicht! (Demo: sofort genehmigt)"}

@router.get("/kyc/status")
async def kyc_status(request: Request):
    user = await get_current_user(request)
    sub = await db.kyc_submissions.find_one({"user_email": user.get("email", "")}, {"_id": 0})
    return {"submission": sub, "is_verified": True if TEST_MODE else user.get("verified", False)}


# ═══ AD BANNERS FOR MERCHANTS ═══
AD_PRICES = {"daily": 5.0, "weekly": 29.0, "monthly": 99.0}

class AdCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=60)
    description: str = Field("", max_length=120)
    link_route: str = ""
    duration: str = "daily"
    color: str = "#00C2FF"

@router.post("/ads/create")
async def create_ad(req: AdCreate, request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    price = AD_PRICES.get(req.duration, 5.0)
    balance = user.get("balance", 0)
    if balance < price:
        raise HTTPException(400, f"Benötigt: €{price:.2f}")
    
    await db.users.update_one({"email": email}, {"$inc": {"balance": -price}})
    
    hours = {"daily": 24, "weekly": 168, "monthly": 720}.get(req.duration, 24)
    now = datetime.now(timezone.utc)
    
    ad = {
        "ad_id": f"ad_{secrets.token_hex(6)}",
        "merchant_email": email,
        "merchant_name": user.get("name", ""),
        "title": req.title,
        "description": req.description,
        "link_route": req.link_route,
        "color": req.color,
        "duration": req.duration,
        "price": price,
        "impressions": 0,
        "clicks": 0,
        "status": "active",
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(hours=hours)).isoformat(),
    }
    await db.ad_banners.insert_one(ad)
    ad.pop("_id", None)
    return {"ok": True, "ad": ad, "message": f"Banner live für {req.duration} (€{price:.2f})!"}

@router.get("/ads/active")
async def get_active_ads():
    now = datetime.now(timezone.utc).isoformat()
    ads = await db.ad_banners.find({"status": "active", "expires_at": {"$gt": now}}, {"_id": 0}).sort("created_at", -1).to_list(10)
    # Increment impressions
    for ad in ads:
        await db.ad_banners.update_one({"ad_id": ad["ad_id"]}, {"$inc": {"impressions": 1}})
    return {"ads": ads}

@router.post("/ads/click/{ad_id}")
async def click_ad(ad_id: str):
    await db.ad_banners.update_one({"ad_id": ad_id}, {"$inc": {"clicks": 1}})
    return {"ok": True}

@router.get("/ads/prices")
async def ad_prices():
    return {"prices": AD_PRICES}

@router.get("/ads/my-ads")
async def my_ads(request: Request):
    user = await get_current_user(request)
    ads = await db.ad_banners.find({"merchant_email": user.get("email", "")}, {"_id": 0}).sort("created_at", -1).to_list(20)
    return {"ads": ads}


# ═══ AFFILIATE LINK SYSTEM ═══
AFFILIATE_RATE = 0.03  # 3%

@router.get("/affiliate/my-link")
async def get_affiliate_link(request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    code = await db.affiliate_codes.find_one({"user_email": email}, {"_id": 0})
    if not code:
        new_code = f"REF-{secrets.token_hex(3).upper()}"
        code = {"user_email": email, "code": new_code, "clicks": 0, "conversions": 0, "earned": 0,
                "created_at": datetime.now(timezone.utc).isoformat()}
        await db.affiliate_codes.insert_one(code)
        code.pop("_id", None)
    return code

@router.get("/affiliate/track/{code}")
async def track_affiliate(code: str):
    aff = await db.affiliate_codes.find_one({"code": code.upper()})
    if not aff:
        return {"ok": False}
    await db.affiliate_codes.update_one({"code": code.upper()}, {"$inc": {"clicks": 1}})
    return {"ok": True, "referrer": aff["user_email"]}

@router.get("/affiliate/stats")
async def affiliate_stats(request: Request):
    user = await get_current_user(request)
    code = await db.affiliate_codes.find_one({"user_email": user.get("email", "")}, {"_id": 0})
    return {"affiliate": code}


# ═══ TAX REPORT ═══
REPORT_FEE = 4.99

@router.get("/tax-report")
async def generate_tax_report(request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    is_premium = user.get("premium_plan") in ["pro", "elite"]
    
    if not is_premium:
        balance = user.get("balance", 0)
        if balance < REPORT_FEE:
            raise HTTPException(400, f"Steuerbericht: €{REPORT_FEE:.2f} (Gratis für Pro/Elite)")
        await db.users.update_one({"email": email}, {"$inc": {"balance": -REPORT_FEE}})
    
    # Collect all earnings
    resell_sales = await db.resell_transactions.find({"seller_email": email}, {"_id": 0, "price": 1, "fee": 1, "created_at": 1}).to_list(100)
    job_earnings = await db.blitz_jobs.find({"worker_email": email, "status": "completed"}, {"_id": 0, "worker_payout": 1, "completed_at": 1}).to_list(100)
    cashback = await db.cashback_claims.find({"user_email": email}, {"_id": 0, "cashback_amount": 1, "created_at": 1}).to_list(100)
    
    total_resell = sum(s.get("price", 0) - s.get("fee", 0) for s in resell_sales)
    total_jobs = sum(j.get("worker_payout", 0) for j in job_earnings)
    total_cashback = sum(c.get("cashback_amount", 0) for c in cashback)
    total_income = total_resell + total_jobs + total_cashback
    
    report = {
        "report_id": secrets.token_hex(6),
        "user_email": email,
        "year": datetime.now().year,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "income": {
            "reselling": round(total_resell, 2),
            "blitzjobs": round(total_jobs, 2),
            "cashback": round(total_cashback, 2),
            "total": round(total_income, 2),
        },
        "transactions": {
            "resell_count": len(resell_sales),
            "jobs_count": len(job_earnings),
            "cashback_count": len(cashback),
        },
        "fee_paid": 0 if is_premium else REPORT_FEE,
        "note": "Dies ist eine Übersicht. Für die Steuererklärung bitte einen Steuerberater konsultieren.",
    }
    
    await db.tax_reports.insert_one(report)
    report.pop("_id", None)
    return report
