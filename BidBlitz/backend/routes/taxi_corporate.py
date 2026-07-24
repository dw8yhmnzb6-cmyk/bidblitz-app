"""
BidBlitz Taxi — B2B Corporate Accounts (iter123 P0-2)
========================================================
Firmen können einen Corporate-Account anlegen, Mitarbeiter einladen,
Cost-Center definieren und am Monatsende eine konsolidierte Rechnung erhalten.

Models:
  taxi_corporate_accounts {
    id, owner_user_id, company_name, vat_id, billing_email, billing_address,
    monthly_limit_eur, active, cost_centers:[str], created_at,
  }
  taxi_corporate_members {
    id, account_id, user_id, role: 'owner'|'admin'|'employee',
    monthly_limit_eur, added_at,
  }
  taxi_corporate_invites {
    id, account_id, email, token, expires_at, role, accepted: bool
  }

Auf book() wird `corporate_account_id` + `cost_center` mitgegeben; die Fahrt
wird in der Monats-Aggregation gezählt.
"""
from __future__ import annotations
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/taxi/corporate", tags=["taxi-corporate"])


class AccountCreate(BaseModel):
    company_name: str = Field(..., min_length=2, max_length=120)
    vat_id: Optional[str] = Field(None, max_length=32)
    billing_email: EmailStr
    billing_address: Optional[str] = Field(None, max_length=500)
    monthly_limit_eur: Optional[float] = None
    cost_centers: List[str] = Field(default_factory=list)


class InviteCreate(BaseModel):
    email: EmailStr
    role: str = Field("employee", pattern=r"^(employee|admin)$")
    monthly_limit_eur: Optional[float] = None


@router.post("/accounts")
async def create_account(payload: AccountCreate, request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    # 1 Account pro User MVP
    existing = await db.taxi_corporate_accounts.find_one({"owner_user_id": uid}, {"_id": 0, "id": 1})
    if existing:
        raise HTTPException(409, "Bereits ein Corporate-Account vorhanden")
    doc = {
        "id": str(uuid4()),
        "owner_user_id": uid,
        "company_name": payload.company_name,
        "vat_id": payload.vat_id,
        "billing_email": payload.billing_email,
        "billing_address": payload.billing_address,
        "monthly_limit_eur": payload.monthly_limit_eur,
        "cost_centers": payload.cost_centers,
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.taxi_corporate_accounts.insert_one(doc)
    await db.taxi_corporate_members.insert_one({
        "id": str(uuid4()), "account_id": doc["id"], "user_id": uid,
        "role": "owner", "monthly_limit_eur": None,
        "added_at": datetime.now(timezone.utc).isoformat(),
    })
    doc.pop("_id", None)
    return {"success": True, "account": doc}


@router.get("/accounts/mine")
async def my_account(request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    # Owner?
    own = await db.taxi_corporate_accounts.find_one({"owner_user_id": uid}, {"_id": 0})
    if own:
        return {"role": "owner", "account": own}
    # Member?
    member = await db.taxi_corporate_members.find_one({"user_id": uid}, {"_id": 0})
    if member:
        acc = await db.taxi_corporate_accounts.find_one({"id": member["account_id"]}, {"_id": 0})
        return {"role": member["role"], "account": acc, "limit": member.get("monthly_limit_eur")}
    return {"role": None, "account": None}


@router.post("/accounts/{aid}/invite")
async def invite_member(aid: str, payload: InviteCreate, request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    acc = await db.taxi_corporate_accounts.find_one({"id": aid, "owner_user_id": uid}, {"_id": 0, "id": 1})
    if not acc:
        raise HTTPException(403, "Nur Owner kann einladen")
    invite = {
        "id": str(uuid4()),
        "account_id": aid,
        "email": str(payload.email),
        "token": str(uuid4()).replace("-", "")[:20],
        "role": payload.role,
        "monthly_limit_eur": payload.monthly_limit_eur,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "accepted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.taxi_corporate_invites.insert_one(invite)
    invite.pop("_id", None)
    return {"success": True, "invite": invite,
            "invite_url": f"/corporate/accept?token={invite['token']}"}


@router.post("/accept")
async def accept_invite(request: Request, token: str):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    inv = await db.taxi_corporate_invites.find_one({"token": token, "accepted": False}, {"_id": 0})
    if not inv:
        raise HTTPException(404, "Einladung ungültig oder eingelöst")
    if _iso_passed(inv["expires_at"]):
        raise HTTPException(410, "Einladung abgelaufen")
    await db.taxi_corporate_members.insert_one({
        "id": str(uuid4()), "account_id": inv["account_id"], "user_id": uid,
        "role": inv["role"], "monthly_limit_eur": inv.get("monthly_limit_eur"),
        "added_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.taxi_corporate_invites.update_one({"id": inv["id"]}, {"$set": {"accepted": True}})
    return {"success": True, "account_id": inv["account_id"]}


@router.get("/accounts/{aid}/members")
async def list_members(aid: str, request: Request):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    acc = await db.taxi_corporate_accounts.find_one({"id": aid, "owner_user_id": uid}, {"_id": 0, "id": 1})
    if not acc:
        raise HTTPException(403, "Nur Owner")
    cursor = db.taxi_corporate_members.find({"account_id": aid}, {"_id": 0})
    return {"items": [m async for m in cursor]}


@router.get("/accounts/{aid}/summary")
async def monthly_summary(aid: str, request: Request, year: int, month: int):
    user = await get_current_user(request)
    uid = str(user.get("_id") or user.get("id"))
    acc = await db.taxi_corporate_accounts.find_one(
        {"id": aid, "$or": [{"owner_user_id": uid}]}, {"_id": 0},
    )
    if not acc:
        raise HTTPException(403, "Nur Owner")
    start = datetime(year, month, 1, tzinfo=timezone.utc).isoformat()
    next_month = month % 12 + 1
    next_year = year + (1 if month == 12 else 0)
    end = datetime(next_year, next_month, 1, tzinfo=timezone.utc).isoformat()

    rides_cursor = db.taxi_rides.find(
        {"corporate_account_id": aid,
         "completed_at": {"$gte": start, "$lt": end},
         "status": "completed"},
        {"_id": 0, "ride_id": 1, "user_id": 1, "fare": 1, "final_fare": 1,
         "tip": 1, "cost_center": 1, "completed_at": 1,
         "pickup": 1, "dropoff": 1},
    )
    items = [r async for r in rides_cursor]
    total = sum((r.get("final_fare") or r.get("fare") or 0) + (r.get("tip") or 0) for r in items)
    by_cc: dict = {}
    by_user: dict = {}
    for r in items:
        cc = r.get("cost_center") or "—"
        by_cc[cc] = by_cc.get(cc, 0) + ((r.get("final_fare") or r.get("fare") or 0) + (r.get("tip") or 0))
        u = r.get("user_id")
        by_user[u] = by_user.get(u, 0) + ((r.get("final_fare") or r.get("fare") or 0) + (r.get("tip") or 0))
    return {
        "year": year, "month": month,
        "total_eur": round(total, 2),
        "ride_count": len(items),
        "by_cost_center": [{"cost_center": k, "total": round(v, 2)} for k, v in by_cc.items()],
        "by_user": [{"user_id": k, "total": round(v, 2)} for k, v in by_user.items()],
        "rides": items[:200],
    }


def _iso_passed(s: Optional[str]) -> bool:
    if not s: return False
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")) < datetime.now(timezone.utc)
    except Exception:
        return True
