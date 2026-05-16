"""
BidBlitz Staff — Open Shifts (Schichttausch) MVP
====================================================
Erweitert das `staff_shifts` Modell um einen Tausch-Workflow:

Schicht-Felder (zusätzlich, optional):
  release_status  : null | "open" | "pending_approval" | "swapped" | "cancelled"
  released_by     : staff_id (releaser)
  released_at     : iso datetime
  release_reason  : string

Zusätzliche Collection `staff_shift_claims`:
  id, shift_id, merchant_id, claimer_id, status (pending|approved|rejected|withdrawn),
  message, created_at, decided_at, decided_by

Workflow:
  1) Staff release-t Schicht  →  release_status = "open"
  2) Anderer Staff claim-t    →  Claim erstellt, release_status = "pending_approval"
  3) Manager approve          →  Shift staff_id = claimer, release_status = "swapped"
  4) Manager reject           →  Claim.status = rejected, release_status zurück auf "open"
  5) Releaser cancel          →  release_status = null  (nur solange keine Claims pending)

Endpoints:
  POST   /api/staff/open-shifts/release/{shift_id}       (Staff)
  POST   /api/staff/open-shifts/cancel-release/{shift_id} (Staff – Releaser)
  GET    /api/staff/open-shifts                          (Staff)
  POST   /api/staff/open-shifts/claim/{shift_id}         (Staff)
  POST   /api/staff/open-shifts/withdraw-claim/{claim_id} (Staff)
  GET    /api/staff/open-shifts/manager/pending          (Manager)
  POST   /api/staff/open-shifts/manager/decide/{claim_id} (Manager)
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/staff/open-shifts", tags=["staff-open-shifts"])


# ── Auth helpers ───────────────────────────────────────────────────
async def _staff(request: Request) -> dict:
    sid = request.cookies.get("staff_session")
    if not sid:
        raise HTTPException(401, "Nicht angemeldet")
    m = await db.staff_members.find_one({"id": sid, "active": True}, {"_id": 0})
    if not m:
        raise HTTPException(401, "Session ungültig")
    return m


async def _manager(request: Request) -> dict:
    user = await get_current_user(request)
    role = user.get("role")
    if role not in ("merchant", "admin"):
        raise HTTPException(403, "Nur Manager")
    uid = str(user.get("_id") or user.get("id") or "")
    merchant = await db.merchants.find_one({"owner_user_id": uid}, {"_id": 1})
    if not merchant:
        merchant = await db.merchants.find_one({"email": user.get("email")}, {"_id": 1})
    merchant_id = str(merchant["_id"]) if merchant else uid
    return {"id": uid, "merchant_id": merchant_id, "name": user.get("name") or user.get("email")}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _push_safe(staff_id: str, title: str, body: str):
    try:
        from utils.onesignal_push import send_to_staff, is_configured
        if is_configured():
            await send_to_staff(staff_id, title, body)
    except Exception:
        pass


# ── Models ─────────────────────────────────────────────────────────
class ReleaseBody(BaseModel):
    reason: Optional[str] = None


class ClaimBody(BaseModel):
    message: Optional[str] = None


class DecideBody(BaseModel):
    approve: bool
    note: Optional[str] = None


# ── Helpers ────────────────────────────────────────────────────────
async def _hydrate_shifts(shifts: list) -> list:
    """Add staff/releaser names + pending claim count."""
    staff_ids: set = set()
    shift_ids: list = []
    for s in shifts:
        if s.get("staff_id"):
            staff_ids.add(s["staff_id"])
        if s.get("released_by"):
            staff_ids.add(s["released_by"])
        shift_ids.append(s["id"])
    members = {}
    if staff_ids:
        async for m in db.staff_members.find({"id": {"$in": list(staff_ids)}}, {"_id": 0, "id": 1, "name": 1, "email": 1, "role": 1}):
            members[m["id"]] = m
    claims_count = {}
    if shift_ids:
        async for c in db.staff_shift_claims.find({"shift_id": {"$in": shift_ids}, "status": "pending"}, {"_id": 0, "shift_id": 1}):
            claims_count[c["shift_id"]] = claims_count.get(c["shift_id"], 0) + 1
    for s in shifts:
        s["staff"] = members.get(s.get("staff_id")) or {}
        s["released_by_staff"] = members.get(s.get("released_by")) or None
        s["pending_claims"] = claims_count.get(s["id"], 0)
    return shifts


# ════════════════════════════════════════════════════════════════════
# Staff Endpoints
# ════════════════════════════════════════════════════════════════════
@router.post("/release/{shift_id}")
async def release_shift(shift_id: str, body: ReleaseBody, request: Request):
    staff = await _staff(request)
    shift = await db.staff_shifts.find_one({"id": shift_id, "merchant_id": staff["merchant_id"]}, {"_id": 0})
    if not shift:
        raise HTTPException(404, "Schicht nicht gefunden")
    if shift.get("staff_id") != staff["id"]:
        raise HTTPException(403, "Du bist nicht Inhaber dieser Schicht")
    if shift.get("release_status") in ("open", "pending_approval"):
        raise HTTPException(409, "Schicht ist bereits zur Übernahme freigegeben")
    if shift.get("release_status") == "swapped":
        raise HTTPException(409, "Schicht wurde bereits getauscht")
    start = shift.get("start_time")
    if start and start < _now_iso():
        raise HTTPException(400, "Vergangene Schichten können nicht freigegeben werden")

    await db.staff_shifts.update_one(
        {"id": shift_id},
        {"$set": {
            "release_status": "open",
            "released_by": staff["id"],
            "released_at": _now_iso(),
            "release_reason": (body.reason or "").strip()[:300],
            "updated_at": _now_iso(),
        }},
    )

    # Notify other active staff members
    others = await db.staff_members.find(
        {"merchant_id": staff["merchant_id"], "active": True, "id": {"$ne": staff["id"]}},
        {"_id": 0, "id": 1},
    ).to_list(500)
    title = "Schicht zur Übernahme verfügbar"
    body_text = f"{staff.get('name')} bietet eine Schicht — {shift.get('title') or 'Schicht'} am {start[:10]}"
    for o in others:
        await _push_safe(o["id"], title, body_text)

    updated = await db.staff_shifts.find_one({"id": shift_id}, {"_id": 0})
    return {"success": True, "shift": updated}


@router.post("/cancel-release/{shift_id}")
async def cancel_release(shift_id: str, request: Request):
    staff = await _staff(request)
    shift = await db.staff_shifts.find_one({"id": shift_id, "merchant_id": staff["merchant_id"]}, {"_id": 0})
    if not shift:
        raise HTTPException(404, "Schicht nicht gefunden")
    if shift.get("released_by") != staff["id"]:
        raise HTTPException(403, "Nur der Releaser kann die Freigabe zurücknehmen")
    if shift.get("release_status") not in ("open", "pending_approval"):
        raise HTTPException(400, "Schicht ist nicht freigegeben")
    pending = await db.staff_shift_claims.count_documents({"shift_id": shift_id, "status": "pending"})
    if pending > 0:
        raise HTTPException(409, "Es liegen offene Anfragen vor — bitte erst Manager-Entscheidung abwarten")

    await db.staff_shifts.update_one(
        {"id": shift_id},
        {"$set": {"release_status": None, "released_by": None, "released_at": None, "release_reason": None, "updated_at": _now_iso()}},
    )
    return {"success": True}


@router.get("")
async def list_open_shifts(request: Request):
    """Staff sieht alle offenen Schichten + eigene Claims."""
    staff = await _staff(request)
    shifts = await db.staff_shifts.find(
        {"merchant_id": staff["merchant_id"], "release_status": {"$in": ["open", "pending_approval"]}, "staff_id": {"$ne": staff["id"]}},
        {"_id": 0},
    ).sort("start_time", 1).to_list(200)
    shifts = await _hydrate_shifts(shifts)

    # mark which ones I already claimed
    my_claims = await db.staff_shift_claims.find(
        {"claimer_id": staff["id"], "status": "pending"}, {"_id": 0}
    ).to_list(200)
    claimed_set = {c["shift_id"]: c for c in my_claims}
    for s in shifts:
        c = claimed_set.get(s["id"])
        s["my_claim"] = c

    # also include shifts I released
    mine = await db.staff_shifts.find(
        {"merchant_id": staff["merchant_id"], "released_by": staff["id"], "release_status": {"$in": ["open", "pending_approval"]}},
        {"_id": 0},
    ).sort("start_time", 1).to_list(200)
    mine = await _hydrate_shifts(mine)
    return {"open": shifts, "released_by_me": mine}


@router.post("/claim/{shift_id}")
async def claim_shift(shift_id: str, body: ClaimBody, request: Request):
    staff = await _staff(request)
    shift = await db.staff_shifts.find_one({"id": shift_id, "merchant_id": staff["merchant_id"]}, {"_id": 0})
    if not shift:
        raise HTTPException(404, "Schicht nicht gefunden")
    if shift.get("staff_id") == staff["id"]:
        raise HTTPException(400, "Eigene Schicht kann nicht übernommen werden")
    if shift.get("release_status") not in ("open", "pending_approval"):
        raise HTTPException(409, "Schicht ist aktuell nicht zur Übernahme freigegeben")
    existing = await db.staff_shift_claims.find_one(
        {"shift_id": shift_id, "claimer_id": staff["id"], "status": "pending"}, {"_id": 0}
    )
    if existing:
        raise HTTPException(409, "Du hast diese Schicht bereits angefragt")

    # overlap check for claimer
    overlaps = await db.staff_shifts.count_documents({
        "merchant_id": staff["merchant_id"],
        "staff_id": staff["id"],
        "start_time": {"$lt": shift["end_time"]},
        "end_time": {"$gt": shift["start_time"]},
    })
    if overlaps > 0:
        raise HTTPException(409, "Schicht-Konflikt mit deinem Kalender")

    claim = {
        "id": str(uuid4()),
        "shift_id": shift_id,
        "merchant_id": staff["merchant_id"],
        "claimer_id": staff["id"],
        "claimer_name": staff.get("name"),
        "releaser_id": shift.get("released_by"),
        "status": "pending",
        "message": (body.message or "").strip()[:300],
        "created_at": _now_iso(),
        "decided_at": None,
        "decided_by": None,
    }
    await db.staff_shift_claims.insert_one(claim.copy())
    claim.pop("_id", None)

    await db.staff_shifts.update_one(
        {"id": shift_id},
        {"$set": {"release_status": "pending_approval", "updated_at": _now_iso()}},
    )

    # Notify releaser
    if shift.get("released_by"):
        await _push_safe(shift["released_by"], "Schicht wird übernommen",
                         f"{staff.get('name')} möchte deine Schicht übernehmen.")
    return {"success": True, "claim": claim}


@router.post("/withdraw-claim/{claim_id}")
async def withdraw_claim(claim_id: str, request: Request):
    staff = await _staff(request)
    claim = await db.staff_shift_claims.find_one({"id": claim_id, "claimer_id": staff["id"]}, {"_id": 0})
    if not claim:
        raise HTTPException(404, "Anfrage nicht gefunden")
    if claim["status"] != "pending":
        raise HTTPException(400, "Anfrage ist bereits entschieden")
    await db.staff_shift_claims.update_one(
        {"id": claim_id}, {"$set": {"status": "withdrawn", "decided_at": _now_iso()}}
    )
    # If no more pending claims, set shift back to "open"
    remaining = await db.staff_shift_claims.count_documents({"shift_id": claim["shift_id"], "status": "pending"})
    if remaining == 0:
        await db.staff_shifts.update_one(
            {"id": claim["shift_id"], "release_status": "pending_approval"},
            {"$set": {"release_status": "open", "updated_at": _now_iso()}},
        )
    return {"success": True}


# ════════════════════════════════════════════════════════════════════
# Manager Endpoints
# ════════════════════════════════════════════════════════════════════
@router.get("/manager/pending")
async def manager_pending(request: Request):
    mgr = await _manager(request)
    claims = await db.staff_shift_claims.find(
        {"merchant_id": mgr["merchant_id"], "status": "pending"}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)

    # Hydrate shift + releaser/claimer
    shift_ids = list({c["shift_id"] for c in claims})
    shift_map = {}
    if shift_ids:
        async for s in db.staff_shifts.find({"id": {"$in": shift_ids}}, {"_id": 0}):
            shift_map[s["id"]] = s
    staff_ids = set()
    for c in claims:
        staff_ids.add(c["claimer_id"])
        if c.get("releaser_id"):
            staff_ids.add(c["releaser_id"])
    members = {}
    if staff_ids:
        async for m in db.staff_members.find({"id": {"$in": list(staff_ids)}}, {"_id": 0, "id": 1, "name": 1, "email": 1, "role": 1}):
            members[m["id"]] = m

    out = []
    for c in claims:
        s = shift_map.get(c["shift_id"])
        out.append({
            **c,
            "shift": s,
            "claimer": members.get(c["claimer_id"]),
            "releaser": members.get(c.get("releaser_id")),
        })
    return {"claims": out, "count": len(out)}


@router.post("/manager/decide/{claim_id}")
async def manager_decide(claim_id: str, body: DecideBody, request: Request):
    mgr = await _manager(request)
    claim = await db.staff_shift_claims.find_one(
        {"id": claim_id, "merchant_id": mgr["merchant_id"]}, {"_id": 0}
    )
    if not claim:
        raise HTTPException(404, "Anfrage nicht gefunden")
    if claim["status"] != "pending":
        raise HTTPException(400, "Anfrage bereits entschieden")
    shift = await db.staff_shifts.find_one({"id": claim["shift_id"]}, {"_id": 0})
    if not shift:
        raise HTTPException(404, "Schicht nicht gefunden")

    if body.approve:
        # Approve this claim, mark shift as swapped, reject other pending
        await db.staff_shifts.update_one(
            {"id": claim["shift_id"]},
            {"$set": {
                "staff_id": claim["claimer_id"],
                "release_status": "swapped",
                "swapped_at": _now_iso(),
                "previous_staff_id": shift.get("staff_id"),
                "updated_at": _now_iso(),
            }},
        )
        await db.staff_shift_claims.update_one(
            {"id": claim_id},
            {"$set": {"status": "approved", "decided_at": _now_iso(), "decided_by": mgr["id"], "decision_note": body.note}},
        )
        # auto-reject other pending claims for the same shift
        await db.staff_shift_claims.update_many(
            {"shift_id": claim["shift_id"], "status": "pending", "id": {"$ne": claim_id}},
            {"$set": {"status": "rejected", "decided_at": _now_iso(), "decided_by": mgr["id"], "decision_note": "Andere Anfrage angenommen"}},
        )
        # Notify
        await _push_safe(claim["claimer_id"], "Schicht-Übernahme bestätigt",
                         f"Du übernimmst die Schicht am {shift['start_time'][:10]}")
        if claim.get("releaser_id"):
            await _push_safe(claim["releaser_id"], "Schicht-Tausch bestätigt",
                             f"{claim.get('claimer_name')} hat deine Schicht übernommen.")
    else:
        await db.staff_shift_claims.update_one(
            {"id": claim_id},
            {"$set": {"status": "rejected", "decided_at": _now_iso(), "decided_by": mgr["id"], "decision_note": body.note}},
        )
        # if no more pending, set shift back to "open"
        remaining = await db.staff_shift_claims.count_documents({"shift_id": claim["shift_id"], "status": "pending"})
        if remaining == 0:
            await db.staff_shifts.update_one(
                {"id": claim["shift_id"], "release_status": "pending_approval"},
                {"$set": {"release_status": "open", "updated_at": _now_iso()}},
            )
        await _push_safe(claim["claimer_id"], "Übernahme abgelehnt",
                         f"Deine Anfrage für die Schicht am {shift['start_time'][:10]} wurde abgelehnt.")

    updated = await db.staff_shift_claims.find_one({"id": claim_id}, {"_id": 0})
    return {"success": True, "claim": updated}
