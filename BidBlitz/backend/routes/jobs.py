"""
BidBlitz V2 - Job Marketplace
Vollzeit, Teilzeit, Mini-Job, Freelance, Praktikum
Unternehmen + Privatpersonen können Jobs posten
Bewerbung direkt in der App oder per Kontakt
Freemium: Basic kostenlos, Premium-Boost per Wallet
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List
from bson import ObjectId
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/jobs", tags=["jobs"])

BOOST_PRICE = 9.99
CATEGORIES = [
    {"id": "it", "label": "IT & Tech"},
    {"id": "gastro", "label": "Gastronomie"},
    {"id": "retail", "label": "Handel & Verkauf"},
    {"id": "craft", "label": "Handwerk"},
    {"id": "office", "label": "Büro & Verwaltung"},
    {"id": "logistics", "label": "Logistik & Transport"},
    {"id": "health", "label": "Gesundheit & Pflege"},
    {"id": "finance", "label": "Finanzen"},
    {"id": "marketing", "label": "Marketing & Medien"},
    {"id": "education", "label": "Bildung"},
    {"id": "other", "label": "Sonstiges"},
]

JOB_TYPES = [
    {"id": "fulltime", "label": "Vollzeit"},
    {"id": "parttime", "label": "Teilzeit"},
    {"id": "minijob", "label": "Mini-Job"},
    {"id": "freelance", "label": "Freelance"},
    {"id": "internship", "label": "Praktikum"},
]


class JobCreate(BaseModel):
    title: str
    description: str = ""
    category: str = "other"
    job_type: str = "fulltime"
    company_name: str = ""
    company_logo: str = ""
    company_phone: str = ""
    company_email: str = ""
    company_website: str = ""
    company_description: str = ""
    city: str = ""
    address: str = ""
    salary_min: float = 0
    salary_max: float = 0
    salary_type: str = "monthly"  # monthly | hourly | yearly | project
    remote: bool = False
    requirements: List[str] = []
    benefits: List[str] = []


class ApplicationCreate(BaseModel):
    job_id: str
    cover_letter: str = ""
    resume_url: str = ""
    phone: str = ""


@router.get("/categories")
async def get_categories():
    return {"categories": CATEGORIES, "job_types": JOB_TYPES}


@router.get("/list")
async def list_jobs(
    category: str = "", job_type: str = "", city: str = "",
    remote: str = "", search: str = "", limit: int = 30
):
    query = {"status": "active"}
    if category:
        query["category"] = category
    if job_type:
        query["job_type"] = job_type
    if city:
        query["city"] = {"$regex": city, "$options": "i"}
    if remote == "true":
        query["remote"] = True
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"company_name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
        ]

    # Boosted jobs first, then by date
    jobs = await db.jobs.find(query, {"_id": 0}).sort(
        [("is_boosted", -1), ("created_at", -1)]
    ).limit(limit).to_list(limit)
    return {"jobs": jobs, "count": len(jobs)}


@router.get("/detail/{job_id}")
async def get_job(job_id: str):
    j = await db.jobs.find_one({"job_id": job_id}, {"_id": 0})
    if not j:
        raise HTTPException(status_code=404, detail="Job nicht gefunden")
    # Increment views
    await db.jobs.update_one({"job_id": job_id}, {"$inc": {"view_count": 1}})
    return j


@router.post("/create")
async def create_job(req: JobCreate, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    now = datetime.now(timezone.utc).isoformat()
    jid = secrets.token_hex(8)

    doc = {
        "job_id": jid,
        "poster_id": user_id,
        "poster_name": user.get("name", ""),
        "poster_email": user.get("email", ""),
        "title": req.title,
        "description": req.description,
        "category": req.category,
        "job_type": req.job_type,
        "company_name": req.company_name or user.get("name", ""),
        "company_logo": req.company_logo,
        "company_phone": req.company_phone,
        "company_email": req.company_email or user.get("email", ""),
        "company_website": req.company_website,
        "company_description": req.company_description,
        "city": req.city,
        "address": req.address,
        "salary_min": req.salary_min,
        "salary_max": req.salary_max,
        "salary_type": req.salary_type,
        "remote": req.remote,
        "requirements": req.requirements,
        "benefits": req.benefits,
        "is_boosted": False,
        "view_count": 0,
        "application_count": 0,
        "status": "active",
        "created_at": now,
    }
    await db.jobs.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "job": doc}


@router.post("/boost/{job_id}")
async def boost_job(job_id: str, request: Request):
    """Premium-Boost per Wallet — Job wird oben angezeigt."""
    user = await get_current_user(request)
    j = await db.jobs.find_one({"job_id": job_id})
    if not j or j["poster_id"] != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Nicht berechtigt")
    if j.get("is_boosted"):
        raise HTTPException(status_code=400, detail="Job ist bereits geboostet")

    balance = user.get("balance", 0)
    if balance < BOOST_PRICE:
        raise HTTPException(status_code=400, detail=f"Nicht genug Guthaben (€{BOOST_PRICE})")

    await db.users.update_one({"_id": user["_id"]}, {"$inc": {"balance": -BOOST_PRICE}})
    await db.jobs.update_one({"job_id": job_id}, {"$set": {"is_boosted": True}})

    now = datetime.now(timezone.utc).isoformat()
    await db.transactions.insert_one({
        "id": secrets.token_hex(8), "user_id": str(user["_id"]), "type": "job_boost",
        "amount": -BOOST_PRICE, "description": f"Job-Boost: {j['title']}",
        "status": "completed", "reference": f"JOB-{job_id[:8].upper()}", "category": "job", "created_at": now,
    })
    return {"ok": True, "price": BOOST_PRICE}


@router.get("/my-jobs")
async def my_jobs(request: Request):
    user = await get_current_user(request)
    jobs = await db.jobs.find(
        {"poster_id": str(user["_id"])}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"jobs": jobs}


@router.delete("/delete/{job_id}")
async def delete_job(job_id: str, request: Request):
    user = await get_current_user(request)
    j = await db.jobs.find_one({"job_id": job_id})
    if not j or j["poster_id"] != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Nicht berechtigt")
    await db.jobs.update_one({"job_id": job_id}, {"$set": {"status": "closed"}})
    return {"ok": True}


# ─── Applications ───

@router.post("/apply")
async def apply_to_job(req: ApplicationCreate, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])

    job = await db.jobs.find_one({"job_id": req.job_id, "status": "active"})
    if not job:
        raise HTTPException(status_code=404, detail="Job nicht gefunden")
    if job["poster_id"] == user_id:
        raise HTTPException(status_code=400, detail="Kann sich nicht auf eigenen Job bewerben")

    existing = await db.job_applications.find_one({"job_id": req.job_id, "applicant_id": user_id})
    if existing:
        raise HTTPException(status_code=400, detail="Bereits beworben")

    now = datetime.now(timezone.utc).isoformat()
    app_id = secrets.token_hex(8)

    # Auto-attach CV if enabled
    cv = await db.user_cvs.find_one({"user_id": user_id})
    has_cv = bool(cv and cv.get("full_name"))
    cv_attached = has_cv and cv.get("auto_attach", True)

    application = {
        "application_id": app_id,
        "job_id": req.job_id,
        "job_title": job["title"],
        "company_name": job.get("company_name", ""),
        "applicant_id": user_id,
        "applicant_name": user.get("name", ""),
        "applicant_email": user.get("email", ""),
        "cover_letter": req.cover_letter,
        "resume_url": req.resume_url,
        "phone": req.phone,
        "cv_attached": cv_attached,
        "status": "pending",
        "created_at": now,
    }
    await db.job_applications.insert_one(application)
    application.pop("_id", None)

    await db.jobs.update_one({"job_id": req.job_id}, {"$inc": {"application_count": 1}})

    return {"ok": True, "application": application}


@router.get("/my-applications")
async def my_applications(request: Request):
    user = await get_current_user(request)
    apps = await db.job_applications.find(
        {"applicant_id": str(user["_id"])}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"applications": apps}


@router.get("/applications/{job_id}")
async def get_job_applications(job_id: str, request: Request):
    user = await get_current_user(request)
    job = await db.jobs.find_one({"job_id": job_id})
    if not job or job["poster_id"] != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Nicht berechtigt")
    apps = await db.job_applications.find(
        {"job_id": job_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return {"applications": apps}


@router.post("/applications/{app_id}/status")
async def update_application_status(app_id: str, request: Request):
    user = await get_current_user(request)
    body = await request.json()
    new_status = body.get("status", "")  # accepted | rejected | interview

    app = await db.job_applications.find_one({"application_id": app_id})
    if not app:
        raise HTTPException(status_code=404, detail="Bewerbung nicht gefunden")

    job = await db.jobs.find_one({"job_id": app["job_id"]})
    if not job or job["poster_id"] != str(user["_id"]):
        raise HTTPException(status_code=403, detail="Nicht berechtigt")

    await db.job_applications.update_one(
        {"application_id": app_id},
        {"$set": {"status": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True, "status": new_status}
