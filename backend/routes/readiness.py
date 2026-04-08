"""
BidBlitz V2 - Production Readiness & Go-Live Checklist
System health checks and launch preparation.
"""

import asyncio
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request

from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/readiness", tags=["Production Readiness"])


# ══════════════════════════════════════
# SYSTEM HEALTH CHECKS
# ══════════════════════════════════════

async def check_database() -> dict:
    """Check database connectivity."""
    try:
        await db.command("ping")
        user_count = await db.users.count_documents({})
        return {"status": "ok", "users": user_count}
    except Exception as e:
        return {"status": "error", "message": str(e)}


async def check_auth() -> dict:
    """Check auth system."""
    try:
        # Check if admin exists
        admin = await db.users.find_one({"role": "admin"})
        # Check JWT secret is set
        import os
        jwt_secret = os.environ.get("JWT_SECRET")
        
        return {
            "status": "ok" if admin and jwt_secret else "warning",
            "admin_exists": admin is not None,
            "jwt_configured": bool(jwt_secret),
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


async def check_wallet() -> dict:
    """Check wallet system."""
    try:
        # Check recent transactions
        recent = await db.transactions.find({}).sort("created_at", -1).limit(5).to_list(5)
        
        # Check for negative balances
        negative = await db.users.count_documents({"balance": {"$lt": 0}})
        
        return {
            "status": "ok" if negative == 0 else "warning",
            "recent_transactions": len(recent),
            "negative_balances": negative,
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


async def check_stripe() -> dict:
    """Check Stripe integration."""
    try:
        import os
        stripe_key = os.environ.get("STRIPE_API_KEY")
        
        # Check recent stripe sessions
        sessions = await db.payment_transactions.count_documents({"type": "stripe_checkout"})
        
        return {
            "status": "ok" if stripe_key else "error",
            "configured": bool(stripe_key),
            "total_sessions": sessions,
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


async def check_auctions() -> dict:
    """Check auction system."""
    try:
        total = await db.auctions.count_documents({})
        active = await db.auctions.count_documents({"status": "active"})
        
        return {
            "status": "ok",
            "total_auctions": total,
            "active_auctions": active,
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


async def check_mining() -> dict:
    """Check mining system."""
    try:
        miners = await db.mining_miners.count_documents({})
        packages = await db.mining_packages.count_documents({}) if hasattr(db, 'mining_packages') else 0
        
        return {
            "status": "ok",
            "total_miners": miners,
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


async def check_taxi() -> dict:
    """Check taxi system."""
    try:
        total = await db.taxi_rides.count_documents({})
        active = await db.taxi_rides.count_documents({"status": {"$in": ["requested", "accepted", "arriving", "started"]}})
        
        return {
            "status": "ok",
            "total_rides": total,
            "active_rides": active,
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


async def check_scooter() -> dict:
    """Check scooter system."""
    try:
        fleet = await db.scooters.count_documents({})
        available = await db.scooters.count_documents({"status": "available"})
        
        return {
            "status": "ok",
            "fleet_size": fleet,
            "available": available,
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


async def check_food() -> dict:
    """Check food delivery system."""
    try:
        restaurants = await db.food_restaurants.count_documents({})
        orders = await db.food_orders.count_documents({})
        
        return {
            "status": "ok",
            "restaurants": restaurants,
            "total_orders": orders,
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


async def check_security() -> dict:
    """Check security systems."""
    try:
        import os
        
        checks = {
            "jwt_secret": bool(os.environ.get("JWT_SECRET")),
            "audit_logs_enabled": await db.audit_logs.count_documents({}) > 0,
        }
        
        all_ok = all(checks.values())
        
        return {
            "status": "ok" if all_ok else "warning",
            "checks": checks,
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ══════════════════════════════════════
# ENDPOINTS
# ══════════════════════════════════════

@router.get("/health")
async def health_check():
    """Basic health check."""
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": "BidBlitz V2",
    }


@router.get("/full-check")
async def full_system_check(request: Request):
    """Admin: Full system health check."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    # Run all checks in parallel
    results = await asyncio.gather(
        check_database(),
        check_auth(),
        check_wallet(),
        check_stripe(),
        check_auctions(),
        check_mining(),
        check_taxi(),
        check_scooter(),
        check_food(),
        check_security(),
        return_exceptions=True
    )
    
    checks = {
        "database": results[0] if not isinstance(results[0], Exception) else {"status": "error", "message": str(results[0])},
        "auth": results[1] if not isinstance(results[1], Exception) else {"status": "error", "message": str(results[1])},
        "wallet": results[2] if not isinstance(results[2], Exception) else {"status": "error", "message": str(results[2])},
        "stripe": results[3] if not isinstance(results[3], Exception) else {"status": "error", "message": str(results[3])},
        "auctions": results[4] if not isinstance(results[4], Exception) else {"status": "error", "message": str(results[4])},
        "mining": results[5] if not isinstance(results[5], Exception) else {"status": "error", "message": str(results[5])},
        "taxi": results[6] if not isinstance(results[6], Exception) else {"status": "error", "message": str(results[6])},
        "scooter": results[7] if not isinstance(results[7], Exception) else {"status": "error", "message": str(results[7])},
        "food": results[8] if not isinstance(results[8], Exception) else {"status": "error", "message": str(results[8])},
        "security": results[9] if not isinstance(results[9], Exception) else {"status": "error", "message": str(results[9])},
    }
    
    # Overall status
    statuses = [c.get("status", "error") for c in checks.values()]
    if "error" in statuses:
        overall = "error"
    elif "warning" in statuses:
        overall = "warning"
    else:
        overall = "ok"
    
    return {
        "overall_status": overall,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checks": checks,
    }


@router.get("/checklist")
async def get_launch_checklist(request: Request):
    """Admin: Get launch readiness checklist."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    checklist = []
    
    # 1. Auth
    admin = await db.users.find_one({"role": "admin"})
    checklist.append({
        "category": "Auth",
        "item": "Admin account exists",
        "status": "ok" if admin else "error",
        "required": True,
    })
    
    # 2. Stripe
    import os
    stripe_key = os.environ.get("STRIPE_API_KEY")
    checklist.append({
        "category": "Payments",
        "item": "Stripe API configured",
        "status": "ok" if stripe_key else "error",
        "required": True,
    })
    
    # 3. Sample data
    auctions = await db.auctions.count_documents({})
    checklist.append({
        "category": "Content",
        "item": "Sample auctions created",
        "status": "ok" if auctions > 0 else "warning",
        "required": False,
    })
    
    restaurants = await db.food_restaurants.count_documents({})
    checklist.append({
        "category": "Content",
        "item": "Restaurants available",
        "status": "ok" if restaurants > 0 else "warning",
        "required": False,
    })
    
    scooters = await db.scooters.count_documents({})
    checklist.append({
        "category": "Content",
        "item": "Scooter fleet setup",
        "status": "ok" if scooters > 0 else "warning",
        "required": False,
    })
    
    # 4. Security
    audit_logs = await db.audit_logs.count_documents({})
    checklist.append({
        "category": "Security",
        "item": "Audit logging active",
        "status": "ok" if audit_logs > 0 else "warning",
        "required": True,
    })
    
    # 5. Legal pages
    privacy = await db.pages.find_one({"slug": "privacy"})
    checklist.append({
        "category": "Legal",
        "item": "Privacy policy page",
        "status": "ok" if privacy else "warning",
        "required": True,
    })
    
    terms = await db.pages.find_one({"slug": "terms"})
    checklist.append({
        "category": "Legal",
        "item": "Terms of service page",
        "status": "ok" if terms else "warning",
        "required": True,
    })
    
    # 6. Invite codes (for soft launch)
    invites = await db.invite_codes.count_documents({"used": False})
    checklist.append({
        "category": "Launch",
        "item": "Invite codes generated",
        "status": "ok" if invites > 0 else "warning",
        "required": False,
    })
    
    # Count status
    errors = len([c for c in checklist if c["status"] == "error" and c["required"]])
    warnings = len([c for c in checklist if c["status"] == "warning"])
    passed = len([c for c in checklist if c["status"] == "ok"])
    
    ready = errors == 0
    
    return {
        "ready_for_launch": ready,
        "summary": {
            "passed": passed,
            "warnings": warnings,
            "errors": errors,
            "total": len(checklist),
        },
        "checklist": checklist,
    }


@router.get("/stats")
async def get_platform_stats(request: Request):
    """Admin: Get platform statistics."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)
    
    stats = {
        "users": {
            "total": await db.users.count_documents({}),
            "today": await db.users.count_documents({"created_at": {"$gte": today_start.isoformat()}}),
            "week": await db.users.count_documents({"created_at": {"$gte": week_ago.isoformat()}}),
            "verified": await db.users.count_documents({"verification_status": "approved"}),
        },
        "transactions": {
            "total": await db.transactions.count_documents({}),
            "today": await db.transactions.count_documents({"created_at": {"$gte": today_start.isoformat()}}),
        },
        "taxi": {
            "total_rides": await db.taxi_rides.count_documents({}),
            "completed": await db.taxi_rides.count_documents({"status": "completed"}),
        },
        "scooter": {
            "total_rentals": await db.scooter_rentals.count_documents({}),
            "fleet_size": await db.scooters.count_documents({}),
        },
        "food": {
            "total_orders": await db.food_orders.count_documents({}),
            "restaurants": await db.food_restaurants.count_documents({}),
        },
        "auctions": {
            "total": await db.auctions.count_documents({}),
            "active": await db.auctions.count_documents({"status": "active"}),
        },
    }
    
    return {"stats": stats, "timestamp": now.isoformat()}


# ══════════════════════════════════════
# LEGAL PAGES
# ══════════════════════════════════════

@router.get("/pages/{slug}")
async def get_page(slug: str):
    """Get a static page (privacy, terms, etc.)."""
    page = await db.pages.find_one({"slug": slug}, {"_id": 0})
    
    if not page:
        # Return default pages
        defaults = {
            "privacy": {
                "title": "Datenschutzerklärung",
                "content": """
# Datenschutzerklärung

## 1. Verantwortlicher
BidBlitz V2 - Ihre Super-App für Mobilität und mehr.

## 2. Datenerhebung
Wir erheben folgende Daten:
- Registrierungsdaten (Name, E-Mail)
- Zahlungsinformationen
- Standortdaten (für Taxi, Scooter, Food)
- Nutzungsdaten

## 3. Zweck der Verarbeitung
- Bereitstellung unserer Dienste
- Zahlungsabwicklung
- Kundenservice
- Verbesserung unserer App

## 4. Ihre Rechte
Sie haben das Recht auf Auskunft, Berichtigung und Löschung Ihrer Daten.

Kontakt: datenschutz@bidblitz.com
                """,
            },
            "terms": {
                "title": "Allgemeine Geschäftsbedingungen",
                "content": """
# Allgemeine Geschäftsbedingungen

## 1. Geltungsbereich
Diese AGB gelten für alle Nutzer der BidBlitz App.

## 2. Leistungen
BidBlitz bietet:
- Taxi-Buchungen
- Scooter-Sharing
- Essenslieferung
- Penny-Auktionen
- Mining-Pakete

## 3. Zahlungen
- Zahlungen erfolgen über die BidBlitz Wallet
- Guthaben kann per Stripe aufgeladen werden
- Rückerstattungen erfolgen auf die Wallet

## 4. Haftung
BidBlitz haftet nur für vorsätzlich oder grob fahrlässig verursachte Schäden.

## 5. Kündigung
Nutzer können ihr Konto jederzeit löschen.

Kontakt: support@bidblitz.com
                """,
            },
            "imprint": {
                "title": "Impressum",
                "content": """
# Impressum

BidBlitz V2 GmbH (in Gründung)

E-Mail: info@bidblitz.com
                """,
            },
        }
        
        return defaults.get(slug, {"title": "Seite nicht gefunden", "content": "Diese Seite existiert nicht."})
    
    return page


@router.post("/pages/{slug}")
async def update_page(slug: str, request: Request):
    """Admin: Update a static page."""
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    
    body = await request.json()
    
    await db.pages.update_one(
        {"slug": slug},
        {"$set": {
            "slug": slug,
            "title": body.get("title", slug.title()),
            "content": body.get("content", ""),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "updated_by": str(user["_id"]),
        }},
        upsert=True
    )
    
    return {"ok": True, "slug": slug}
