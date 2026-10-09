"""Fail-closed financial sandbox for BidBlitz Games.

This module models purchases, refunds and developer revenue-share accounting
without charging a customer, crediting a wallet or executing a payout.
All mutations require an explicit sandbox flag and admin privileges.
"""

import hashlib
import os
import re
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field, field_validator
from pymongo import ReturnDocument

from core.database import db
from core.security import get_current_user


router = APIRouter(prefix="/api/games/finance", tags=["games-finance"])
admin_router = APIRouter(prefix="/api/admin/game-studio/finance", tags=["admin-game-studio"])

_GAME_ID = re.compile(r"^[a-z0-9][a-z0-9_-]{0,79}$")
_KEY = re.compile(r"^[A-Za-z0-9._:-]{8,120}$")
CURRENCY = "EUR"
FINANCE_SANDBOX_ENABLED = os.environ.get("GAMES_FINANCE_SANDBOX", "false").lower() == "true"
DEVELOPER_SHARE_BPS = max(
    0,
    min(10_000, int(os.environ.get("GAMES_DEVELOPER_SHARE_BPS", "0"))),
)
_MAX_SANDBOX_CENTS = max(
    1,
    int(os.environ.get("GAMES_FINANCE_SANDBOX_MAX_EUR_CENTS", "10000000")),
)


class SandboxPurchaseInput(BaseModel):
    game_id: str = Field(min_length=1, max_length=80)
    gross_eur_cents: int = Field(strict=True, ge=1, le=_MAX_SANDBOX_CENTS)
    idempotency_key: str = Field(min_length=8, max_length=120)
    note: str = Field(default="", max_length=500)

    @field_validator("game_id", mode="before")
    @classmethod
    def normalize_game_id(cls, value):
        value = str(value or "").strip().lower()
        if not _GAME_ID.fullmatch(value):
            raise ValueError("Ungültige Spiel-ID")
        return value

    @field_validator("idempotency_key", mode="before")
    @classmethod
    def normalize_idempotency_key(cls, value):
        value = str(value or "").strip()
        if not _KEY.fullmatch(value):
            raise ValueError("Ungültiger Idempotency-Key")
        return value

    @field_validator("note", mode="before")
    @classmethod
    def normalize_note(cls, value):
        value = str(value or "").strip()
        if "\x00" in value:
            raise ValueError("Ungültige Notiz")
        return value


class SandboxRefundInput(BaseModel):
    amount_eur_cents: int = Field(strict=True, ge=1, le=_MAX_SANDBOX_CENTS)
    reason: str = Field(min_length=3, max_length=500)
    idempotency_key: str = Field(min_length=8, max_length=120)

    @field_validator("reason", mode="before")
    @classmethod
    def normalize_reason(cls, value):
        value = str(value or "").strip()
        if "\x00" in value:
            raise ValueError("Ungültiger Refund-Grund")
        return value

    @field_validator("idempotency_key", mode="before")
    @classmethod
    def normalize_idempotency_key(cls, value):
        value = str(value or "").strip()
        if not _KEY.fullmatch(value):
            raise ValueError("Ungültiger Idempotency-Key")
        return value


def _duplicate_key(exc: Exception) -> bool:
    return exc.__class__.__name__ == "DuplicateKeyError" or getattr(exc, "code", None) == 11000


async def _admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") not in {"admin", "super_admin"}:
        raise HTTPException(403, "Admin only")
    return user


async def _owner(request: Request) -> str:
    user = await get_current_user(request)
    return str(user["_id"])


def _assert_sandbox_ready() -> None:
    if not FINANCE_SANDBOX_ENABLED:
        raise HTTPException(503, "Games-Finanzsandbox ist nicht aktiviert")
    if DEVELOPER_SHARE_BPS <= 0 or DEVELOPER_SHARE_BPS >= 10_000:
        raise HTTPException(503, "Games-Revenue-Share ist noch nicht konfiguriert")


def _split(gross_cents: int, share_bps: int) -> tuple[int, int]:
    developer_cents = (int(gross_cents) * int(share_bps)) // 10_000
    platform_cents = int(gross_cents) - developer_cents
    return developer_cents, platform_cents


def _public_transaction(doc: dict) -> dict:
    return {
        "id": doc.get("id"),
        "kind": doc.get("kind"),
        "game_id": doc.get("game_id"),
        "purchase_id": doc.get("purchase_id"),
        "currency": CURRENCY,
        "gross_eur_cents": int(doc.get("gross_eur_cents") or 0),
        "developer_eur_cents": int(doc.get("developer_eur_cents") or 0),
        "platform_eur_cents": int(doc.get("platform_eur_cents") or 0),
        "developer_share_bps": int(doc.get("developer_share_bps") or 0),
        "status": doc.get("status", "completed"),
        "created_at": doc.get("created_at"),
        "sandbox": True,
        "monetary_execution": False,
    }


def _transaction_id(kind: str, idempotency_key: str) -> str:
    digest = hashlib.sha256(f"games-finance:{kind}:{idempotency_key}".encode("utf-8")).hexdigest()
    return f"gfs_{digest[:24]}"


async def _published_game(game_id: str) -> dict:
    game = await db.games_catalog.find_one(
        {"id": game_id, "status": "published"},
        {"_id": 0, "id": 1, "owner_id": 1, "title": 1},
    )
    if not game or not game.get("owner_id"):
        raise HTTPException(404, "Veröffentlichtes Entwickler-Spiel nicht gefunden")
    return game


async def _existing_request(idempotency_key: str) -> dict | None:
    return await db.games_finance_sandbox_transactions.find_one(
        {"idempotency_key": idempotency_key},
        {"_id": 0},
    )


def _assert_same_purchase(existing: dict, body: SandboxPurchaseInput) -> None:
    if (
        existing.get("kind") != "purchase"
        or existing.get("game_id") != body.game_id
        or int(existing.get("gross_eur_cents") or 0) != body.gross_eur_cents
    ):
        raise HTTPException(409, "Idempotency-Key wurde bereits anders verwendet")


def _assert_same_refund(existing: dict, purchase_id: str, body: SandboxRefundInput) -> None:
    if (
        existing.get("kind") != "refund"
        or existing.get("purchase_id") != purchase_id
        or int(existing.get("gross_eur_cents") or 0) != body.amount_eur_cents
    ):
        raise HTTPException(409, "Idempotency-Key wurde bereits anders verwendet")


async def _summary(owner_id: str | None = None) -> dict:
    query = {} if owner_id is None else {"developer_owner_id": owner_id}
    rows = await db.games_finance_sandbox_transactions.find(
        query,
        {
            "_id": 0,
            "kind": 1,
            "status": 1,
            "gross_eur_cents": 1,
            "developer_eur_cents": 1,
            "platform_eur_cents": 1,
        },
    ).limit(10000).to_list(10000)

    purchases = [
        row for row in rows
        if row.get("kind") == "purchase" and row.get("status", "completed") == "completed"
    ]
    refunds = [
        row for row in rows
        if row.get("kind") == "refund" and row.get("status") == "completed"
    ]

    def total(items, key):
        return sum(max(0, int(row.get(key) or 0)) for row in items)

    return {
        "sandbox_enabled": FINANCE_SANDBOX_ENABLED,
        "configured": 0 < DEVELOPER_SHARE_BPS < 10_000,
        "currency": CURRENCY,
        "developer_share_bps": DEVELOPER_SHARE_BPS or None,
        "purchase_count": len(purchases),
        "refund_count": len(refunds),
        "gross_purchase_eur_cents": total(purchases, "gross_eur_cents"),
        "gross_refund_eur_cents": total(refunds, "gross_eur_cents"),
        "net_gross_eur_cents": total(purchases, "gross_eur_cents") - total(refunds, "gross_eur_cents"),
        "net_developer_eur_cents": total(purchases, "developer_eur_cents") - total(refunds, "developer_eur_cents"),
        "net_platform_eur_cents": total(purchases, "platform_eur_cents") - total(refunds, "platform_eur_cents"),
        "monetary_execution": False,
        "payout_execution": False,
    }


@router.get("/readiness")
async def finance_readiness():
    return {
        "sandbox_enabled": FINANCE_SANDBOX_ENABLED,
        "configured": 0 < DEVELOPER_SHARE_BPS < 10_000,
        "currency": CURRENCY,
        "developer_share_bps": DEVELOPER_SHARE_BPS or None,
        "payments_enabled": False,
        "wallet_debits_enabled": False,
        "payouts_enabled": False,
    }


@router.get("/me")
async def developer_finance_sandbox_summary(request: Request):
    return await _summary(await _owner(request))


@admin_router.get("/summary")
async def admin_finance_sandbox_summary(request: Request):
    await _admin(request)
    return await _summary()


@admin_router.post("/sandbox/purchases")
async def create_sandbox_purchase(body: SandboxPurchaseInput, request: Request):
    admin = await _admin(request)
    _assert_sandbox_ready()

    existing = await _existing_request(body.idempotency_key)
    if existing:
        _assert_same_purchase(existing, body)
        return _public_transaction(existing)

    game = await _published_game(body.game_id)
    developer_cents, platform_cents = _split(body.gross_eur_cents, DEVELOPER_SHARE_BPS)
    now = datetime.now(timezone.utc)
    doc = {
        "id": _transaction_id("purchase", body.idempotency_key),
        "kind": "purchase",
        "game_id": body.game_id,
        "purchase_id": None,
        "developer_owner_id": str(game["owner_id"]),
        "gross_eur_cents": body.gross_eur_cents,
        "developer_eur_cents": developer_cents,
        "platform_eur_cents": platform_cents,
        "developer_share_bps": DEVELOPER_SHARE_BPS,
        "idempotency_key": body.idempotency_key,
        "note": body.note,
        "created_by": str(admin.get("_id") or admin.get("id") or ""),
        "created_at": now,
        "status": "completed",
        "refunded_eur_cents": 0,
        "sandbox": True,
        "monetary_execution": False,
    }
    try:
        await db.games_finance_sandbox_transactions.insert_one(doc)
    except Exception as exc:
        if not _duplicate_key(exc):
            raise
        existing = await _existing_request(body.idempotency_key)
        if not existing:
            raise
        _assert_same_purchase(existing, body)
        return _public_transaction(existing)
    return _public_transaction(doc)


@admin_router.post("/sandbox/purchases/{purchase_id}/refunds")
async def create_sandbox_refund(
    purchase_id: str,
    body: SandboxRefundInput,
    request: Request,
):
    admin = await _admin(request)
    _assert_sandbox_ready()

    existing = await _existing_request(body.idempotency_key)
    if existing:
        _assert_same_refund(existing, purchase_id, body)
        return _public_transaction(existing)

    purchase = await db.games_finance_sandbox_transactions.find_one(
        {"id": purchase_id, "kind": "purchase", "status": "completed"},
        {"_id": 0},
    )
    if not purchase:
        raise HTTPException(404, "Sandbox-Kauf nicht gefunden")

    share_bps = int(purchase.get("developer_share_bps") or 0)
    now = datetime.now(timezone.utc)
    refund_id = _transaction_id("refund", body.idempotency_key)
    pending = {
        "id": refund_id,
        "kind": "refund",
        "status": "pending",
        "game_id": purchase.get("game_id"),
        "purchase_id": purchase_id,
        "developer_owner_id": purchase.get("developer_owner_id"),
        "gross_eur_cents": body.amount_eur_cents,
        "developer_eur_cents": 0,
        "platform_eur_cents": 0,
        "developer_share_bps": share_bps,
        "idempotency_key": body.idempotency_key,
        "reason": body.reason,
        "created_by": str(admin.get("_id") or admin.get("id") or ""),
        "created_at": now,
        "sandbox": True,
        "monetary_execution": False,
    }
    try:
        await db.games_finance_sandbox_transactions.insert_one(pending)
    except Exception as exc:
        if not _duplicate_key(exc):
            raise
        existing = await _existing_request(body.idempotency_key)
        if not existing:
            raise
        _assert_same_refund(existing, purchase_id, body)
        if existing.get("status") != "completed":
            raise HTTPException(409, "Refund wird bereits verarbeitet")
        return _public_transaction(existing)

    reserved = await db.games_finance_sandbox_transactions.find_one_and_update(
        {
            "id": purchase_id,
            "kind": "purchase",
            "status": "completed",
            "$expr": {
                "$lte": [
                    {
                        "$add": [
                            {"$ifNull": ["$refunded_eur_cents", 0]},
                            body.amount_eur_cents,
                        ]
                    },
                    "$gross_eur_cents",
                ]
            },
        },
        {
            "$inc": {"refunded_eur_cents": body.amount_eur_cents},
            "$set": {"refund_updated_at": now},
        },
        projection={"_id": 0},
        return_document=ReturnDocument.BEFORE,
    )
    if not reserved:
        await db.games_finance_sandbox_transactions.delete_one(
            {"id": refund_id, "status": "pending"}
        )
        raise HTTPException(409, "Refund überschreitet den verbleibenden Sandbox-Betrag")

    prior_refunded = max(0, int(reserved.get("refunded_eur_cents") or 0))
    new_refunded = prior_refunded + body.amount_eur_cents
    developer_before = (prior_refunded * share_bps) // 10_000
    developer_after = (new_refunded * share_bps) // 10_000
    developer_cents = developer_after - developer_before
    platform_cents = body.amount_eur_cents - developer_cents

    try:
        result = await db.games_finance_sandbox_transactions.update_one(
            {"id": refund_id, "status": "pending"},
            {
                "$set": {
                    "status": "completed",
                    "developer_eur_cents": developer_cents,
                    "platform_eur_cents": platform_cents,
                    "completed_at": datetime.now(timezone.utc),
                }
            },
        )
        if not result.matched_count:
            raise RuntimeError("Sandbox refund reservation disappeared")
    except Exception:
        await db.games_finance_sandbox_transactions.update_one(
            {"id": purchase_id, "kind": "purchase"},
            {"$inc": {"refunded_eur_cents": -body.amount_eur_cents}},
        )
        await db.games_finance_sandbox_transactions.delete_one(
            {"id": refund_id, "status": "pending"}
        )
        raise

    completed = await db.games_finance_sandbox_transactions.find_one(
        {"id": refund_id, "status": "completed"},
        {"_id": 0},
    )
    return _public_transaction(completed or pending)


@admin_router.get("/sandbox/transactions")
async def list_sandbox_transactions(
    request: Request,
    limit: int = Query(100, ge=1, le=500),
):
    await _admin(request)
    rows = await db.games_finance_sandbox_transactions.find(
        {},
        {"_id": 0, "idempotency_key": 0, "developer_owner_id": 0, "created_by": 0, "note": 0, "reason": 0},
    ).sort("created_at", -1).limit(limit).to_list(limit)
    return {
        "transactions": [_public_transaction(row) for row in rows],
        "count": len(rows),
        "sandbox": True,
        "monetary_execution": False,
    }
