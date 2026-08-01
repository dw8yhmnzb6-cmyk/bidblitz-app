from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from core.database import db
from core.investor_portal_auth import get_current_investor_account
from core.rate_limit import RATE_ADMIN_ACTION, limiter
from core.security import get_current_user

router = APIRouter(prefix="/api/investor-dashboard", tags=["investor-dashboard"])

BUILD_INFO_PATH = Path(__file__).resolve().parent.parent / "build_info.json"
SUPPORTED_LANGUAGES = ["de", "en", "en-US", "sq", "sq-XK", "tr", "fr", "es", "it", "pt", "nl", "pl", "ru", "ar", "ar-AE"]


class DashboardDevStatusItem(BaseModel):
    key: str
    label: str
    status: Literal["In Planung", "In Entwicklung", "Beta", "Live"]
    last_update: str = ""


class DashboardRoadmapItem(BaseModel):
    title: str
    stage: Literal["Completed", "Current", "Next", "Planned"]
    note: str = ""


class DashboardModuleItem(BaseModel):
    key: str
    title: str
    current_status: str = ""
    development_phase: str = ""
    next_milestone: str = ""


class FundingRoundConfig(BaseModel):
    status_label: str = "Noch nicht freigegeben"
    target_amount: Optional[float] = None
    amount_reserved: Optional[float] = None
    remaining_allocation: Optional[float] = None
    minimum_investment: Optional[float] = None
    maximum_total_equity_available: Optional[float] = None
    notes: str = ""


class CapitalAllocationItem(BaseModel):
    key: str
    label: str
    percentage: float = Field(..., ge=0, le=100)


class DashboardContact(BaseModel):
    investor_relations_name: str = "Investor Relations"
    meeting_request_url: str = "/investor-portal/meetings"
    email: str = ""
    telephone: str = ""


class DashboardUpdateItem(BaseModel):
    title: str
    date: str
    category: str
    description: str


class DashboardDocumentItem(BaseModel):
    title: str
    download_url: str = ""
    version: str = ""
    date: str = ""


class InvestorDashboardConfigIn(BaseModel):
    development_status: list[DashboardDevStatusItem] = Field(default_factory=list)
    roadmap_progress: list[DashboardRoadmapItem] = Field(default_factory=list)
    product_modules: list[DashboardModuleItem] = Field(default_factory=list)
    funding_round: FundingRoundConfig = Field(default_factory=FundingRoundConfig)
    use_of_capital: list[CapitalAllocationItem] = Field(default_factory=list)
    contact: DashboardContact = Field(default_factory=DashboardContact)


async def _require_admin(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin Zugriff erforderlich")
    return user


async def _allow_investor_dashboard_access(request: Request):
    try:
        user = await get_current_user(request)
        if user.get("role") in {"admin", "investor", "merchant", "reviewer"}:
            return {"mode": "app-user", "user": user}
    except Exception:
        pass

    try:
        account = await get_current_investor_account(request)
        return {"mode": "investor-portal", "account": account}
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Investor Dashboard erfordert einen freigegebenen Zugriff.") from exc


async def _get_build_info() -> dict[str, Any]:
    if not BUILD_INFO_PATH.exists():
        return {}
    import json
    return json.loads(BUILD_INFO_PATH.read_text())


async def _get_dashboard_config() -> dict[str, Any]:
    doc = await db.investor_dashboard_config.find_one({"config_id": "default"}, {"_id": 0})
    return doc or {}


def _default_development_status(last_update: str) -> list[dict[str, Any]]:
    return [
        {"key": "web", "label": "Web Platform", "status": "Beta", "last_update": last_update},
        {"key": "wallet", "label": "Wallet", "status": "Beta", "last_update": last_update},
        {"key": "ios", "label": "iOS", "status": "Beta", "last_update": last_update},
        {"key": "android", "label": "Android", "status": "Beta", "last_update": last_update},
        {"key": "merchant_platform", "label": "Merchant Platform", "status": "Beta", "last_update": last_update},
        {"key": "pos", "label": "POS", "status": "Beta", "last_update": last_update},
        {"key": "admin_dashboard", "label": "Admin Dashboard", "status": "Beta", "last_update": last_update},
        {"key": "api", "label": "API", "status": "Beta", "last_update": last_update},
        {"key": "languages", "label": "Languages", "status": "Live", "last_update": last_update},
        {"key": "security", "label": "Security", "status": "In Entwicklung", "last_update": last_update},
    ]


def _default_roadmap() -> list[dict[str, Any]]:
    return [
        {"title": "Produktidee & Architektur", "stage": "Completed", "note": "Grundstruktur und Module definiert"},
        {"title": "Wallet, Merchant, Investor Portal", "stage": "Current", "note": "Fokus auf Plattform-Reife und Tests"},
        {"title": "App Store & Google Play Vorbereitung", "stage": "Next", "note": "Release-Härtung und Pilotkunden"},
        {"title": "Markteinführung & internationale Skalierung", "stage": "Planned", "note": "Schrittweiser Ausbau mit Partnern"},
    ]


def _default_modules() -> list[dict[str, Any]]:
    return [
        {"key": "wallet", "title": "Wallet", "current_status": "Beta", "development_phase": "Aktiv", "next_milestone": "App Store Vorbereitung"},
        {"key": "merchant", "title": "Merchant", "current_status": "Beta", "development_phase": "Aktiv", "next_milestone": "Mehr Händler freischalten"},
        {"key": "pos", "title": "POS", "current_status": "Beta", "development_phase": "Aktiv", "next_milestone": "Pilotbetrieb"},
        {"key": "admin", "title": "Admin", "current_status": "Beta", "development_phase": "Aktiv", "next_milestone": "Operations-Härtung"},
        {"key": "qr", "title": "QR Payments", "current_status": "Beta", "development_phase": "Aktiv", "next_milestone": "Mehr Tests"},
        {"key": "rewards", "title": "Rewards", "current_status": "In Entwicklung", "development_phase": "Ausbau", "next_milestone": "Optimierung der Flows"},
        {"key": "investor_portal", "title": "Investor Portal", "current_status": "In Entwicklung", "development_phase": "Phase 2", "next_milestone": "Freigaben und Meetings"},
        {"key": "taxi", "title": "Taxi", "current_status": "Beta", "development_phase": "Aktiv", "next_milestone": "UX-Verfeinerung"},
        {"key": "hotels", "title": "Hotels", "current_status": "In Planung", "development_phase": "Konzept", "next_milestone": "Partnerdefinition"},
        {"key": "gaming", "title": "Gaming", "current_status": "In Planung", "development_phase": "Konzept", "next_milestone": "Modulplanung"},
    ]


async def _live_kpis() -> list[dict[str, Any]]:
    build_info = await _get_build_info()
    api_status = "Operational"
    db_status = "Connected"
    try:
        await db.command("ping")
    except Exception:
        db_status = "Degraded"
    try:
        users = await db.users.count_documents({})
    except Exception:
        users = None
    try:
        merchants = await db.merchants.count_documents({"status": "approved"})
    except Exception:
        merchants = None
    return [
        {"key": "registered_users", "label": "Registered users", "verified": users is not None, "value": users, "display": str(users) if users is not None else "Daten werden nach dem offiziellen Start veröffentlicht.", "source": "live-db" if users is not None else "unavailable"},
        {"key": "verified_merchants", "label": "Verified merchants", "verified": merchants is not None, "value": merchants, "display": str(merchants) if merchants is not None else "Daten werden nach dem offiziellen Start veröffentlicht.", "source": "live-db" if merchants is not None else "unavailable"},
        {"key": "countries", "label": "Countries", "verified": False, "value": None, "display": "Daten werden nach dem offiziellen Start veröffentlicht.", "source": "unavailable"},
        {"key": "languages", "label": "Languages", "verified": True, "value": len(SUPPORTED_LANGUAGES), "display": str(len(SUPPORTED_LANGUAGES)), "source": "supported-language-config"},
        {"key": "app_versions", "label": "App versions", "verified": bool(build_info), "value": build_info.get("frontend_version"), "display": build_info.get("frontend_version") or "Daten werden nach dem offiziellen Start veröffentlicht.", "source": "build-info" if build_info else "unavailable"},
        {"key": "current_beta_testers", "label": "Current beta testers", "verified": False, "value": None, "display": "Daten werden nach dem offiziellen Start veröffentlicht.", "source": "unavailable"},
        {"key": "system_uptime", "label": "System uptime", "verified": False, "value": None, "display": "Daten werden nach dem offiziellen Start veröffentlicht.", "source": "unavailable"},
        {"key": "api_status", "label": "API status", "verified": True, "value": api_status, "display": api_status, "source": "live-health"},
        {"key": "database_status", "label": "Database status", "verified": True, "value": db_status, "display": db_status, "source": "live-health"},
    ]


@router.get("")
async def get_investor_dashboard(request: Request):
    await _allow_investor_dashboard_access(request)
    config = await _get_dashboard_config()
    build_info = await _get_build_info()
    generated_at = build_info.get("generated_at") or datetime.now(timezone.utc).isoformat()
    updates = await db.investor_updates.find({"is_active": True}, {"_id": 0, "title": 1, "published_at": 1, "summary": 1, "body": 1, "category": 1}).sort("published_at", -1).limit(20).to_list(20)
    documents = await db.investor_documents.find({"is_active": True}, {"_id": 0, "title": 1, "version": 1, "published_at": 1, "download_url": 1}).sort("published_at", -1).limit(20).to_list(20)

    latest_updates = [
        {"title": item.get("title", ""), "date": item.get("published_at", "")[:10], "category": item.get("category", "Investor Update"), "description": item.get("summary") or item.get("body", "")}
        for item in updates
    ]
    latest_documents = [
        {"title": item.get("title", ""), "download_url": item.get("download_url", ""), "version": item.get("version", ""), "date": item.get("published_at", "")[:10]}
        for item in documents
    ]

    return {
        "header": {
            "title": "BidBlitz Investor Dashboard",
            "subtitle": "Aktueller Entwicklungsstand und Unternehmensübersicht.",
            "generated_at": generated_at,
        },
        "development_status": config.get("development_status") or _default_development_status(generated_at),
        "roadmap_progress": config.get("roadmap_progress") or _default_roadmap(),
        "business_kpis": await _live_kpis(),
        "product_modules": config.get("product_modules") or _default_modules(),
        "funding_round": config.get("funding_round") or FundingRoundConfig().model_dump(),
        "use_of_capital": config.get("use_of_capital") or [
            {"key": "technology", "label": "Technology", "percentage": 35},
            {"key": "security", "label": "Security", "percentage": 15},
            {"key": "compliance", "label": "Compliance", "percentage": 15},
            {"key": "marketing", "label": "Marketing", "percentage": 15},
            {"key": "operations", "label": "Operations", "percentage": 10},
            {"key": "reserve", "label": "Reserve", "percentage": 10},
        ],
        "latest_updates": latest_updates,
        "documents": latest_documents,
        "contact": config.get("contact") or DashboardContact().model_dump(),
        "data_mode": {
            "funding_round": "admin-entered",
            "business_kpis": "live-or-explicitly-unavailable",
            "updates": "real-investor-updates",
            "documents": "real-investor-documents",
        },
    }


@router.get("/admin/config")
async def get_investor_dashboard_admin_config(request: Request):
    await _require_admin(request)
    config = await _get_dashboard_config()
    return {
        "config": {
            "development_status": config.get("development_status") or _default_development_status(datetime.now(timezone.utc).isoformat()),
            "roadmap_progress": config.get("roadmap_progress") or _default_roadmap(),
            "product_modules": config.get("product_modules") or _default_modules(),
            "funding_round": config.get("funding_round") or FundingRoundConfig().model_dump(),
            "use_of_capital": config.get("use_of_capital") or [],
            "contact": config.get("contact") or DashboardContact().model_dump(),
        }
    }


@router.put("/admin/config")
@limiter.limit(RATE_ADMIN_ACTION)
async def update_investor_dashboard_admin_config(request: Request, payload: InvestorDashboardConfigIn):
    await _require_admin(request)
    config_doc = payload.model_dump()
    config_doc.update({"config_id": "default", "updated_at": datetime.now(timezone.utc).isoformat()})
    await db.investor_dashboard_config.update_one({"config_id": "default"}, {"$set": config_doc}, upsert=True)
    return {"success": True}