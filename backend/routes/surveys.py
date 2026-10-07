"""BidBlitz V2 - Umfragen & Belohnungen"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone
from core.database import db
from core.config import TEST_MODE
from core.security import get_current_user

router = APIRouter(prefix="/api/surveys", tags=["surveys"])

SURVEYS = [
    {"id": "s1", "title": "Shopping-Gewohnheiten 2026", "sponsor": "MediaMarkt", "questions": 8, "reward_eur": 2.50, "time_min": 5, "category": "Shopping"},
    {"id": "s2", "title": "Lieblings-Streaming-Dienst", "sponsor": "Netflix", "questions": 6, "reward_eur": 1.50, "time_min": 3, "category": "Entertainment"},
    {"id": "s3", "title": "Krypto-Nutzung in Deutschland", "sponsor": "Bitpanda", "questions": 12, "reward_eur": 5.00, "time_min": 8, "category": "Finanzen"},
    {"id": "s4", "title": "Fitness & Ernaehrung", "sponsor": "MyProtein", "questions": 10, "reward_eur": 3.00, "time_min": 6, "category": "Gesundheit"},
    {"id": "s5", "title": "Smartphone-Nutzung", "sponsor": "Samsung", "questions": 7, "reward_eur": 2.00, "time_min": 4, "category": "Tech"},
    {"id": "s6", "title": "Reiseverhalten Post-Covid", "sponsor": "Booking.com", "questions": 9, "reward_eur": 4.00, "time_min": 7, "category": "Reisen"},
]

class CompleteSurvey(BaseModel):
    survey_id: str


async def _require_survey_admin(request: Request):
    user = await get_current_user(request)
    if (user.get("role") or "") not in {"admin", "super_admin"}:
        raise HTTPException(status_code=403, detail="Admin-Rechte erforderlich")
    return user


@router.get("/admin/stats")
async def admin_survey_stats(request: Request):
    """Read-only survey catalog and completion/reward totals for the admin panel."""
    await _require_survey_admin(request)
    grouped = {}
    async for row in db.survey_completions.aggregate([
        {"$group": {
            "_id": "$survey_id",
            "completed_count": {"$sum": 1},
            "reward_total": {"$sum": {"$ifNull": ["$reward", 0]}},
        }},
    ]):
        grouped[str(row.get("_id") or "")] = {
            "completed_count": int(row.get("completed_count") or 0),
            "reward_total": round(float(row.get("reward_total") or 0), 2),
        }

    catalog = []
    for survey in SURVEYS:
        stats = grouped.get(survey["id"], {})
        catalog.append({
            **survey,
            "completed_count": stats.get("completed_count", 0),
            "reward_total": stats.get("reward_total", 0.0),
        })

    return {
        "surveys": catalog,
        "active_count": len(catalog),
        "completion_count": sum(item["completed_count"] for item in catalog),
        "reward_total": round(sum(item["reward_total"] for item in catalog), 2),
        "reward_actions_enabled": bool(TEST_MODE),
        "provider_mode": "test" if TEST_MODE else "preview",
    }

@router.get("/available")
async def available_surveys(request: Request):
    user = await get_current_user(request)
    user_id = str(user.get("_id") or user.get("id") or "")
    email = user.get("email", "")
    completed = await db.survey_completions.find(
        {
            "$or": [
                {"user_id": user_id},
                {"user_email": email},
            ]
        },
        {"survey_id": 1, "reward": 1, "_id": 0},
    ).to_list(100)
    done_ids = {item["survey_id"] for item in completed if item.get("survey_id")}
    available = [survey for survey in SURVEYS if survey["id"] not in done_ids]
    return {
        "surveys": available,
        "completed_count": len(done_ids),
        "total_earned": round(sum(float(item.get("reward") or 0) for item in completed), 2),
        "reward_actions_enabled": bool(TEST_MODE),
        "production_message": None if TEST_MODE else "Umfrage-Rewards sind Preview, bis ein verifizierter Sponsor-/Settlement-Provider angebunden ist.",
    }

@router.post("/complete")
async def complete_survey(req: CompleteSurvey, request: Request):
    """Credit a survey reward exactly once in test mode; production stays fail-closed without sponsor settlement."""
    from core.payment_engine import credit_wallet, TransactionType

    user = await get_current_user(request)
    user_id = str(user.get("_id") or user.get("id") or "")
    email = user.get("email", "")
    survey = next((item for item in SURVEYS if item["id"] == req.survey_id), None)
    if not survey:
        raise HTTPException(status_code=404, detail="Umfrage nicht gefunden")

    existing = await db.survey_completions.find_one(
        {
            "survey_id": req.survey_id,
            "$or": [
                {"user_id": user_id},
                {"user_email": email},
            ],
        },
        {"_id": 0},
    )
    if existing:
        fresh = await db.users.find_one({"_id": user["_id"]}, {"_id": 0, "balance": 1}) or {}
        return {
            "ok": True,
            "reward": float(existing.get("reward") or survey["reward_eur"]),
            "new_balance": round(float(fresh.get("balance") or 0), 2),
            "replayed": True,
            "message": "Umfrage wurde bereits vergütet.",
        }

    if not TEST_MODE:
        raise HTTPException(
            status_code=503,
            detail=(
                "Umfrage-Rewards sind in Production noch Preview. "
                "Ohne verifizierten Sponsor-/Settlement-Provider wird kein EUR-Wallet-Guthaben erzeugt."
            ),
        )

    reward = round(float(survey["reward_eur"]), 2)
    reward_result = await credit_wallet(
        user_id=user_id,
        amount=reward,
        tx_type=TransactionType.REWARD,
        description=f"Umfrage Preview: {survey['title']}",
        reference=f"SURVEY-{req.survey_id.upper()}",
        source="survey_reward_test",
        metadata={
            "survey_id": req.survey_id,
            "sponsor": survey.get("sponsor"),
            "kind": "survey_reward_test",
        },
        idempotency_key=f"survey-reward:{user_id}:{req.survey_id}",
    )
    if not reward_result.success:
        raise HTTPException(status_code=409, detail=reward_result.error or "Umfrage-Reward konnte nicht gebucht werden")

    now = datetime.now(timezone.utc).isoformat()
    completion_id = f"survey:{user_id}:{req.survey_id}"
    completion = {
        "completion_id": completion_id,
        "user_id": user_id,
        "user_email": email,
        "survey_id": req.survey_id,
        "reward": reward,
        "reward_transaction_id": reward_result.transaction_id,
        "reward_mode": "test",
        "created_at": now,
    }
    await db.survey_completions.update_one(
        {"completion_id": completion_id},
        {"$setOnInsert": completion},
        upsert=True,
    )
    return {
        "ok": True,
        "reward": reward,
        "new_balance": reward_result.new_balance,
        "replayed": bool(reward_result.idempotent_replay),
        "message": f"+{reward:.2f} EUR Test-Reward verbucht.",
    }
