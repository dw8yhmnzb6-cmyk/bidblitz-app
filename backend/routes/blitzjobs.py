"""
BidBlitz V2 - BlitzJobs Micro-Job Platform
Short gigs: delivery, shopping, tutoring, pet care — 15% service fee
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/jobs", tags=["blitzjobs"])

SERVICE_FEE = 0.15  # 15%
JOB_CATEGORIES = [
    {"id": "delivery", "name": "Lieferung", "icon": "📦", "color": "#3B82F6"},
    {"id": "shopping", "name": "Einkaufen", "icon": "🛒", "color": "#10B981"},
    {"id": "cleaning", "name": "Putzen", "icon": "🧹", "color": "#8B5CF6"},
    {"id": "tutoring", "name": "Nachhilfe", "icon": "📚", "color": "#F59E0B"},
    {"id": "petcare", "name": "Tierbetreuung", "icon": "🐕", "color": "#EC4899"},
    {"id": "garden", "name": "Garten", "icon": "🌿", "color": "#22C55E"},
    {"id": "moving", "name": "Umzugshilfe", "icon": "📦", "color": "#F97316"},
    {"id": "tech", "name": "Tech-Hilfe", "icon": "💻", "color": "#06B6D4"},
    {"id": "handyman", "name": "Handwerk", "icon": "🔧", "color": "#EAB308"},
    {"id": "other", "name": "Sonstiges", "icon": "⚡", "color": "#6366F1"},
]


class JobCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=100)
    description: str = ""
    category: str = "other"
    budget: float = Field(..., gt=0, le=5000)
    location: str = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
    duration_hours: float = 1.0
    urgent: bool = False


class JobApply(BaseModel):
    job_id: str
    message: str = ""


class JobComplete(BaseModel):
    job_id: str
    rating: int = Field(5, ge=1, le=5)
    tip: float = 0


@router.get("/feed")
async def job_feed(category: Optional[str] = None, search: Optional[str] = None, urgent_only: bool = False):
    query = {"status": "open"}
    if category:
        query["category"] = category
    if urgent_only:
        query["urgent"] = True
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]

    jobs = await db.blitz_jobs.find(query, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"jobs": jobs, "total": len(jobs)}


@router.get("/job/{job_id}")
async def get_job(job_id: str):
    job = await db.blitz_jobs.find_one({"job_id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(404, "Job nicht gefunden")
    return job


@router.post("/create")
async def create_job(req: JobCreate, request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")

    # Check balance
    balance = user.get("balance", 0)
    if balance < req.budget:
        raise HTTPException(400, f"Nicht genug Guthaben. Benötigt: €{req.budget:.2f}")

    job = {
        "job_id": f"job_{secrets.token_hex(6)}",
        "poster_email": email,
        "poster_name": user.get("name", email),
        "title": req.title,
        "description": req.description,
        "category": req.category,
        "budget": round(req.budget, 2),
        "location": req.location,
        "lat": req.lat,
        "lng": req.lng,
        "duration_hours": req.duration_hours,
        "urgent": req.urgent,
        "status": "open",
        "applicants": [],
        "worker_email": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.blitz_jobs.insert_one(job)
    job.pop("_id", None)
    return {"ok": True, "job": job}


@router.post("/apply")
async def apply_for_job(req: JobApply, request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")

    job = await db.blitz_jobs.find_one({"job_id": req.job_id, "status": "open"})
    if not job:
        raise HTTPException(404, "Job nicht verfügbar")
    if job["poster_email"] == email:
        raise HTTPException(400, "Eigener Job")

    # Check not already applied
    if any(a["email"] == email for a in job.get("applicants", [])):
        raise HTTPException(400, "Bereits beworben")

    applicant = {
        "email": email,
        "name": user.get("name", email),
        "message": req.message,
        "applied_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.blitz_jobs.update_one(
        {"job_id": req.job_id},
        {"$push": {"applicants": applicant}}
    )
    return {"ok": True, "message": "Bewerbung gesendet!"}


@router.post("/accept/{job_id}/{worker_email}")
async def accept_worker(job_id: str, worker_email: str, request: Request):
    user = await get_current_user(request)
    job = await db.blitz_jobs.find_one({"job_id": job_id, "poster_email": user.get("email", "")})
    if not job:
        raise HTTPException(403, "Kein Zugriff")

    await db.blitz_jobs.update_one(
        {"job_id": job_id},
        {"$set": {"worker_email": worker_email, "status": "in_progress",
                  "accepted_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"ok": True, "message": f"{worker_email} angenommen!"}


@router.post("/complete")
async def complete_job(req: JobComplete, request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")

    job = await db.blitz_jobs.find_one({"job_id": req.job_id, "status": "in_progress"})
    if not job:
        raise HTTPException(404, "Job nicht gefunden")
    if job["poster_email"] != email:
        raise HTTPException(403, "Nur der Auftraggeber kann abschließen")

    budget = job["budget"]
    fee = round(budget * SERVICE_FEE, 2)
    worker_payout = round(budget - fee + req.tip, 2)

    # Deduct from poster
    await db.users.update_one({"email": email}, {"$inc": {"balance": -(budget + req.tip)}})
    # Pay worker
    await db.users.update_one({"email": job["worker_email"]}, {"$inc": {"balance": worker_payout}})

    await db.blitz_jobs.update_one(
        {"job_id": req.job_id},
        {"$set": {"status": "completed", "rating": req.rating, "tip": req.tip,
                  "fee": fee, "worker_payout": worker_payout,
                  "completed_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"ok": True, "worker_payout": worker_payout, "fee": fee}


@router.get("/my-jobs")
async def my_jobs(request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    posted = await db.blitz_jobs.find({"poster_email": email}, {"_id": 0}).sort("created_at", -1).to_list(30)
    applied = await db.blitz_jobs.find({"applicants.email": email}, {"_id": 0}).sort("created_at", -1).to_list(30)
    working = await db.blitz_jobs.find({"worker_email": email, "status": "in_progress"}, {"_id": 0}).to_list(10)
    return {"posted": posted, "applied": applied, "working": working}


@router.get("/categories")
async def get_job_categories():
    return {"categories": JOB_CATEGORIES}


@router.get("/stats")
async def job_stats():
    open_jobs = await db.blitz_jobs.count_documents({"status": "open"})
    completed = await db.blitz_jobs.count_documents({"status": "completed"})
    return {"open_jobs": open_jobs, "completed": completed, "service_fee_pct": SERVICE_FEE * 100}
