"""Developer publication plans and entitlements for BidBlitz Games.

No payment is fabricated here. Public publication requires an active entitlement
that references a verified payment/contract. Checkout stays disabled until
business prices and a payment provider are explicitly configured.
"""

import os
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, field_validator

from core.database import db
from core.security import get_current_user


router = APIRouter(prefix="/api/games/developer", tags=["games-developer"])
admin_router = APIRouter(prefix="/api/admin/game-studio/developer-entitlements", tags=["admin-game-studio"])

STARTER_LIMIT = max(1, int(os.environ.get("GAMES_STARTER_MAX_PUBLISHED", "1")))
STUDIO_LIMIT = max(STARTER_LIMIT, int(os.environ.get("GAMES_STUDIO_MAX_PUBLISHED", "10")))
STARTER_PRICE_CENTS = max(0, int(os.environ.get("GAMES_STARTER_PRICE_EUR_CENTS", "0")))
STUDIO_PRICE_CENTS = max(0, int(os.environ.get("GAMES_STUDIO_PRICE_EUR_CENTS", "0")))
BILLING_READY = os.environ.get("GAMES_BILLING_READY", "false").lower() == "true"

def _duplicate_key(exc: Exception) -> bool:
    return exc.__class__.__name__ == "DuplicateKeyError" or getattr(exc, "code", None) == 11000


PLANS = {
    "starter": {
        "id": "starter",
        "max_published_games": STARTER_LIMIT,
        "price_eur_cents": STARTER_PRICE_CENTS or None,
    },
    "studio": {
        "id": "studio",
        "max_published_games": STUDIO_LIMIT,
        "price_eur_cents": STUDIO_PRICE_CENTS or None,
    },
}


class EntitlementGrant(BaseModel):
    plan: Literal["starter", "studio"]
    payment_reference: str = Field(min_length=6, max_length=200)
    valid_until: datetime | None = None
    note: str = Field(default="", max_length=500)

    @field_validator("payment_reference", "note", mode="before")
    @classmethod
    def trim_text(cls, value):
        return str(value or "").strip()


async def _owner(request: Request) -> str:
    user = await get_current_user(request)
    return str(user["_id"])


async def _admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") not in {"admin", "super_admin"}:
        raise HTTPException(403, "Admin only")
    return user


def _active_entitlement(doc: dict | None, now: datetime | None = None) -> bool:
    if not doc or doc.get("status") != "active" or doc.get("plan") not in PLANS:
        return False
    valid_until = doc.get("valid_until")
    if valid_until is None:
        return True
    if isinstance(valid_until, str):
        try:
            valid_until = datetime.fromisoformat(valid_until.replace("Z", "+00:00"))
        except ValueError:
            return False
    if not isinstance(valid_until, datetime):
        return False
    if valid_until.tzinfo is None:
        valid_until = valid_until.replace(tzinfo=timezone.utc)
    return valid_until > (now or datetime.now(timezone.utc))


def _public_entitlement(doc: dict | None) -> dict | None:
    if not doc:
        return None
    return {
        "plan": doc.get("plan"),
        "status": doc.get("status"),
        "valid_until": doc.get("valid_until"),
        "started_at": doc.get("started_at"),
        "updated_at": doc.get("updated_at"),
    }


async def _draft_owner(draft_id: str) -> str:
    draft = await db.game_studio_drafts.find_one(
        {"id": draft_id, "status": "draft"},
        {"_id": 0, "owner_id": 1},
    )
    if not draft or not draft.get("owner_id"):
        raise HTTPException(404, "Spielentwurf nicht gefunden")
    return str(draft["owner_id"])


@router.get("/plans")
async def list_plans():
    return {
        "plans": [
            {
                **plan,
                "checkout_ready": bool(BILLING_READY and plan["price_eur_cents"]),
            }
            for plan in PLANS.values()
        ],
        "billing_ready": BILLING_READY,
        "currency": "EUR",
    }


@router.get("/me")
async def developer_status(request: Request):
    owner_id = await _owner(request)
    entitlement = await db.games_developer_entitlements.find_one({"owner_id": owner_id}, {"_id": 0})
    published_count = await db.games_catalog.count_documents({
        "owner_id": owner_id,
        "status": "published",
    })
    plan = PLANS.get((entitlement or {}).get("plan"))
    return {
        "entitlement": _public_entitlement(entitlement),
        "active": _active_entitlement(entitlement),
        "published_games": published_count,
        "max_published_games": plan["max_published_games"] if plan else 0,
        "billing_ready": BILLING_READY,
    }


@router.get("/analytics")
async def developer_analytics(request: Request):
    """Read-only portfolio metrics scoped to the signed-in developer."""
    owner_id = await _owner(request)

    published_rows = await db.games_catalog.find(
        {"owner_id": owner_id},
        {"_id": 0, "id": 1, "status": 1},
    ).limit(100).to_list(100)
    game_ids = [row.get("id") for row in published_rows if row.get("id")]

    review_visible = 0
    review_hidden = 0
    approximate_launches = 0
    if game_ids:
        review_visible = await db.games_reviews.count_documents({
            "game_id": {"$in": game_ids},
            "status": "visible",
        })
        review_hidden = await db.games_reviews.count_documents({
            "game_id": {"$in": game_ids},
            "status": "hidden",
        })
        launch_rows = await db.games_launch_totals.find(
            {"game_id": {"$in": game_ids}},
            {"_id": 0, "launches": 1},
        ).limit(100).to_list(100)
        approximate_launches = sum(
            max(0, int(row.get("launches") or 0))
            for row in launch_rows
            if isinstance(row.get("launches"), int)
        )

    return {
        "drafts": await db.game_studio_drafts.count_documents({
            "owner_id": owner_id,
            "status": "draft",
        }),
        "versions": await db.game_studio_versions.count_documents({"owner_id": owner_id}),
        "submitted": await db.game_studio_versions.count_documents({
            "owner_id": owner_id,
            "review_status": "submitted",
        }),
        "archive_approved": await db.game_studio_versions.count_documents({
            "owner_id": owner_id,
            "review_status": "archive_approved",
        }),
        "preview_approved": await db.game_studio_versions.count_documents({
            "owner_id": owner_id,
            "review_status": "preview_approved",
        }),
        "published": sum(1 for row in published_rows if row.get("status") == "published"),
        "unpublished": sum(1 for row in published_rows if row.get("status") == "unpublished"),
        "reviews_visible": review_visible,
        "reviews_hidden": review_hidden,
        "approximate_launches": approximate_launches,
        "launch_measurement": "approximate_non_monetary",
        "billing_ready": BILLING_READY,
    }


async def assert_publication_entitlement(owner_id: str, draft_id: str) -> dict:
    entitlement = await db.games_developer_entitlements.find_one({"owner_id": owner_id})
    if not _active_entitlement(entitlement):
        raise HTTPException(402, "Aktiver Entwicklerplan erforderlich")
    if entitlement.get("plan") not in PLANS:
        raise HTTPException(402, "Ungültiger Entwicklerplan")
    return entitlement


async def reserve_publication_slot(owner_id: str, draft_id: str, entitlement: dict) -> bool:
    existing = await db.games_publication_slots.find_one({
        "owner_id": owner_id,
        "draft_id": draft_id,
    })
    if existing:
        return False

    plan = PLANS.get(entitlement.get("plan"))
    if not plan:
        raise HTTPException(402, "Ungültiger Entwicklerplan")

    for slot in range(plan["max_published_games"]):
        try:
            await db.games_publication_slots.insert_one({
                "_id": f"{owner_id}:{slot}",
                "owner_id": owner_id,
                "draft_id": draft_id,
                "slot": slot,
                "plan": entitlement.get("plan"),
                "created_at": datetime.now(timezone.utc),
            })
            return True
        except Exception as exc:
            if not _duplicate_key(exc):
                raise
            existing = await db.games_publication_slots.find_one({
                "owner_id": owner_id,
                "draft_id": draft_id,
            })
            if existing:
                return False
    raise HTTPException(409, "Veröffentlichungslimit des Entwicklerplans erreicht")


async def release_publication_slot(owner_id: str, draft_id: str) -> None:
    await db.games_publication_slots.delete_one({
        "owner_id": owner_id,
        "draft_id": draft_id,
    })


@admin_router.get("/by-draft/{draft_id}")
async def entitlement_by_draft(draft_id: str, request: Request):
    await _admin(request)
    owner_id = await _draft_owner(draft_id)
    entitlement = await db.games_developer_entitlements.find_one(
        {"owner_id": owner_id},
        {"_id": 0, "payment_reference": 0, "note": 0, "granted_by": 0, "revoked_by": 0},
    )
    plan = PLANS.get((entitlement or {}).get("plan"))
    return {
        "entitlement": _public_entitlement(entitlement),
        "active": _active_entitlement(entitlement),
        "max_published_games": plan["max_published_games"] if plan else 0,
    }


@admin_router.post("/by-draft/{draft_id}")
async def grant_entitlement_by_draft(draft_id: str, grant: EntitlementGrant, request: Request):
    owner_id = await _draft_owner(draft_id)
    return await grant_entitlement(owner_id, grant, request)


@admin_router.delete("/by-draft/{draft_id}")
async def revoke_entitlement_by_draft(draft_id: str, request: Request):
    owner_id = await _draft_owner(draft_id)
    return await revoke_entitlement(owner_id, request)


@admin_router.post("/{owner_id}")
async def grant_entitlement(owner_id: str, grant: EntitlementGrant, request: Request):
    admin = await _admin(request)
    owner_id = str(owner_id or "").strip()
    if not owner_id or len(owner_id) > 200:
        raise HTTPException(400, "Ungültige Entwickler-ID")

    now = datetime.now(timezone.utc)
    if grant.valid_until is not None:
        valid_until = grant.valid_until
        if valid_until.tzinfo is None:
            valid_until = valid_until.replace(tzinfo=timezone.utc)
        if valid_until <= now:
            raise HTTPException(400, "Ablaufdatum muss in der Zukunft liegen")
    else:
        valid_until = None

    doc = {
        "owner_id": owner_id,
        "plan": grant.plan,
        "status": "active",
        "payment_reference": grant.payment_reference,
        "valid_until": valid_until,
        "started_at": now,
        "updated_at": now,
        "granted_by": str(admin.get("_id") or admin.get("id") or ""),
        "note": grant.note,
    }
    await db.games_developer_entitlements.update_one(
        {"owner_id": owner_id},
        {"$set": doc, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    await db.games_developer_entitlement_events.insert_one({
        "owner_id": owner_id,
        "action": "grant",
        "plan": grant.plan,
        "payment_reference": grant.payment_reference,
        "admin_id": doc["granted_by"],
        "created_at": now,
    })
    return {
        "entitlement": _public_entitlement(doc),
        "max_published_games": PLANS[grant.plan]["max_published_games"],
    }


@admin_router.delete("/{owner_id}")
async def revoke_entitlement(owner_id: str, request: Request):
    admin = await _admin(request)
    now = datetime.now(timezone.utc)
    result = await db.games_developer_entitlements.update_one(
        {"owner_id": owner_id, "status": "active"},
        {"$set": {
            "status": "revoked",
            "revoked_at": now,
            "updated_at": now,
            "revoked_by": str(admin.get("_id") or admin.get("id") or ""),
        }},
    )
    if not result.matched_count:
        raise HTTPException(404, "Aktiver Entwicklerplan nicht gefunden")
    await db.games_developer_entitlement_events.insert_one({
        "owner_id": owner_id,
        "action": "revoke",
        "admin_id": str(admin.get("_id") or admin.get("id") or ""),
        "created_at": now,
    })
    return {"revoked": True}


@router.post("/checkout")
async def developer_checkout(_request: Request):
    # Deliberately fail closed: no fake checkout or fake payment success.
    if not BILLING_READY:
        raise HTTPException(503, "Games-Abrechnung ist noch nicht freigeschaltet")
    raise HTTPException(503, "Games-Zahlungsanbieter ist noch nicht angebunden")
