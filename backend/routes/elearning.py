"""
BidBlitz V2 - E-Learning / Online-Kurse
Kurse kaufen, Module absolvieren, Zertifikate, Fortschritt
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/elearning", tags=["elearning"])


SEED_COURSES = [
    {
        "course_id": "crs_001",
        "title": "Python Masterclass — Von Null zum Profi",
        "category": "programmierung",
        "instructor": "Prof. Dr. Thomas Richter",
        "price": 49.99,
        "original_price": 199.99,
        "discount_percent": 75,
        "rating": 4.8,
        "reviews_count": 2847,
        "students_count": 12500,
        "duration_hours": 42,
        "modules_count": 12,
        "level": "anfaenger",
        "language": "Deutsch",
        "description": "Der umfassendste Python-Kurs auf Deutsch. Von den Grundlagen über OOP bis zu Data Science und Machine Learning. 42 Stunden Videomaterial, 120+ Übungen.",
        "what_you_learn": [
            "Python von Grund auf verstehen",
            "Objektorientierte Programmierung",
            "Web-Scraping & Automatisierung",
            "Datenanalyse mit Pandas",
            "Machine Learning Basics"
        ],
        "modules": [
            {"id": "m1", "title": "Einführung & Setup", "duration_min": 45, "lessons": 8},
            {"id": "m2", "title": "Variablen & Datentypen", "duration_min": 90, "lessons": 12},
            {"id": "m3", "title": "Kontrollstrukturen", "duration_min": 120, "lessons": 15},
            {"id": "m4", "title": "Funktionen & Module", "duration_min": 150, "lessons": 18},
            {"id": "m5", "title": "OOP in Python", "duration_min": 180, "lessons": 20},
            {"id": "m6", "title": "Dateien & Datenbanken", "duration_min": 120, "lessons": 14},
        ],
        "image": "https://images.unsplash.com/photo-1758611971270-89ce7ed506e1?w=800&q=80",
        "tags": ["Python", "Programmierung", "Data Science"],
        "featured": True,
        "bestseller": True,
    },
    {
        "course_id": "crs_002",
        "title": "Digital Marketing Komplett-Kurs 2026",
        "category": "marketing",
        "instructor": "Lisa Neumann, MBA",
        "price": 39.99,
        "original_price": 149.99,
        "discount_percent": 73,
        "rating": 4.7,
        "reviews_count": 1923,
        "students_count": 8700,
        "duration_hours": 28,
        "modules_count": 10,
        "level": "anfaenger",
        "language": "Deutsch",
        "description": "Alles über Digital Marketing: SEO, Google Ads, Social Media, E-Mail Marketing, Analytics. Praxisnah mit echten Kampagnen-Beispielen.",
        "what_you_learn": [
            "SEO-Strategien für Google",
            "Google Ads & Facebook Ads schalten",
            "Content Marketing & Storytelling",
            "E-Mail Funnels aufbauen",
            "Analytics & KPIs verstehen"
        ],
        "modules": [
            {"id": "m1", "title": "Marketing Grundlagen", "duration_min": 60, "lessons": 8},
            {"id": "m2", "title": "SEO Masterclass", "duration_min": 120, "lessons": 15},
            {"id": "m3", "title": "Google Ads", "duration_min": 90, "lessons": 12},
            {"id": "m4", "title": "Social Media Marketing", "duration_min": 120, "lessons": 16},
            {"id": "m5", "title": "E-Mail Marketing", "duration_min": 90, "lessons": 10},
        ],
        "image": "https://images.unsplash.com/photo-1758612214848-04e700d192ce?w=800&q=80",
        "tags": ["Marketing", "SEO", "Google Ads"],
        "featured": True,
        "bestseller": True,
    },
    {
        "course_id": "crs_003",
        "title": "Figma UI/UX Design — Portfolio-Kurs",
        "category": "design",
        "instructor": "Mia Vogel",
        "price": 34.99,
        "original_price": 129.99,
        "discount_percent": 73,
        "rating": 4.9,
        "reviews_count": 1456,
        "students_count": 6200,
        "duration_hours": 22,
        "modules_count": 8,
        "level": "anfaenger",
        "language": "Deutsch",
        "description": "Lerne Figma von Grund auf und baue ein beeindruckendes Portfolio. Auto-Layout, Components, Prototyping, Design Systems. Mit 5 realen Projekten.",
        "what_you_learn": [
            "Figma Interface & Tools",
            "Auto-Layout meistern",
            "Components & Variants",
            "Interaktives Prototyping",
            "Portfolio mit 5 Projekten"
        ],
        "modules": [
            {"id": "m1", "title": "Figma Basics", "duration_min": 45, "lessons": 6},
            {"id": "m2", "title": "Layout & Grids", "duration_min": 60, "lessons": 8},
            {"id": "m3", "title": "Components & Variants", "duration_min": 90, "lessons": 12},
            {"id": "m4", "title": "Prototyping", "duration_min": 75, "lessons": 10},
        ],
        "image": "https://images.unsplash.com/photo-1758612898304-1a6bb546ac44?w=800&q=80",
        "tags": ["Figma", "UI Design", "UX"],
        "featured": False,
        "bestseller": False,
    },
    {
        "course_id": "crs_004",
        "title": "Kryptowährungen & Blockchain verstehen",
        "category": "finanzen",
        "instructor": "Dr. Felix Braun",
        "price": 29.99,
        "original_price": 99.99,
        "discount_percent": 70,
        "rating": 4.6,
        "reviews_count": 987,
        "students_count": 4500,
        "duration_hours": 16,
        "modules_count": 7,
        "level": "anfaenger",
        "language": "Deutsch",
        "description": "Bitcoin, Ethereum, DeFi, NFTs — alles auf Deutsch erklärt. Investieren, Wallets, Sicherheit, steuerliche Behandlung in Deutschland.",
        "what_you_learn": [
            "Blockchain-Technologie verstehen",
            "Bitcoin & Ethereum analysieren",
            "DeFi Protokolle nutzen",
            "Sichere Wallet-Verwaltung",
            "Krypto-Steuern in Deutschland"
        ],
        "modules": [
            {"id": "m1", "title": "Blockchain Grundlagen", "duration_min": 60, "lessons": 8},
            {"id": "m2", "title": "Bitcoin Deep Dive", "duration_min": 90, "lessons": 10},
            {"id": "m3", "title": "Ethereum & Smart Contracts", "duration_min": 75, "lessons": 9},
            {"id": "m4", "title": "DeFi & NFTs", "duration_min": 60, "lessons": 7},
        ],
        "image": "https://images.unsplash.com/photo-1758612214917-81d7956c09de?w=800&q=80",
        "tags": ["Krypto", "Blockchain", "Finanzen"],
        "featured": True,
        "bestseller": False,
    },
    {
        "course_id": "crs_005",
        "title": "Deutsch als Fremdsprache (B1-B2)",
        "category": "sprachen",
        "instructor": "Claudia Werner",
        "price": 24.99,
        "original_price": 89.99,
        "discount_percent": 72,
        "rating": 4.8,
        "reviews_count": 3200,
        "students_count": 15000,
        "duration_hours": 35,
        "modules_count": 14,
        "level": "mittel",
        "language": "Deutsch",
        "description": "Deutschkurs für Fortgeschrittene (B1-B2). Grammatik, Konversation, Business-Deutsch, Prüfungsvorbereitung. Mit Muttersprachlerin.",
        "what_you_learn": [
            "Grammatik B1-B2 Niveau",
            "Flüssig konversieren",
            "Business-Deutsch",
            "Prüfungsvorbereitung",
            "Alltagssituationen meistern"
        ],
        "modules": [
            {"id": "m1", "title": "Grammatik Auffrischung", "duration_min": 90, "lessons": 12},
            {"id": "m2", "title": "Konversation & Dialoge", "duration_min": 120, "lessons": 15},
            {"id": "m3", "title": "Business-Deutsch", "duration_min": 90, "lessons": 10},
            {"id": "m4", "title": "Prüfungstraining", "duration_min": 60, "lessons": 8},
        ],
        "image": "https://images.unsplash.com/photo-1758612214848-04e700d192ce?w=800&q=80",
        "tags": ["Deutsch", "Sprache", "DaF"],
        "featured": False,
        "bestseller": True,
    },
    {
        "course_id": "crs_006",
        "title": "Fotografie Meisterkurs — DSLR & Smartphone",
        "category": "kreativ",
        "instructor": "Jonas Hartmann",
        "price": 44.99,
        "original_price": 169.99,
        "discount_percent": 74,
        "rating": 4.7,
        "reviews_count": 1100,
        "students_count": 5800,
        "duration_hours": 18,
        "modules_count": 9,
        "level": "anfaenger",
        "language": "Deutsch",
        "description": "Von Automatik zu Manuell. Komposition, Licht, Porträt, Landschaft, Bearbeitung in Lightroom. Für DSLR und Smartphone-Fotografie.",
        "what_you_learn": [
            "Kamera-Einstellungen verstehen",
            "Komposition & Bildaufbau",
            "Licht richtig nutzen",
            "Porträt- & Landschaftsfotografie",
            "Lightroom Bearbeitung"
        ],
        "modules": [
            {"id": "m1", "title": "Kamera Basics", "duration_min": 45, "lessons": 6},
            {"id": "m2", "title": "Komposition", "duration_min": 60, "lessons": 8},
            {"id": "m3", "title": "Licht & Belichtung", "duration_min": 75, "lessons": 10},
            {"id": "m4", "title": "Porträt-Fotografie", "duration_min": 90, "lessons": 12},
        ],
        "image": "https://images.unsplash.com/photo-1758612214917-81d7956c09de?w=800&q=80",
        "tags": ["Fotografie", "Lightroom", "Kreativ"],
        "featured": False,
        "bestseller": False,
    },
]


@router.on_event("startup")
async def seed_elearning():
    count = await db.elearning_courses.count_documents({})
    if count == 0:
        now = datetime.now(timezone.utc).isoformat()
        for c in SEED_COURSES:
            c["created_at"] = now
            c["status"] = "published"
        await db.elearning_courses.insert_many(SEED_COURSES)


# ═══ PUBLIC ═══

@router.get("/courses")
async def list_courses(
    category: Optional[str] = None,
    level: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = "popular",
):
    query = {"status": "published"}
    if category:
        query["category"] = category
    if level:
        query["level"] = level
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"tags": {"$regex": search, "$options": "i"}},
            {"instructor": {"$regex": search, "$options": "i"}},
        ]

    sort_field = "students_count"
    if sort_by == "rating":
        sort_field = "rating"
    elif sort_by == "newest":
        sort_field = "created_at"
    elif sort_by == "price_low":
        sort_field = "price"

    courses = await db.elearning_courses.find(query, {"_id": 0}).sort(sort_field, -1).to_list(100)
    return {"courses": courses, "total": len(courses)}


@router.get("/course/{course_id}")
async def get_course(course_id: str):
    course = await db.elearning_courses.find_one({"course_id": course_id}, {"_id": 0})
    if not course:
        raise HTTPException(status_code=404, detail="Kurs nicht gefunden")
    return course


@router.get("/categories")
async def get_categories():
    return {
        "categories": [
            {"id": "programmierung", "label": "Programmierung & IT"},
            {"id": "marketing", "label": "Marketing & Business"},
            {"id": "design", "label": "Design & Kreativität"},
            {"id": "finanzen", "label": "Finanzen & Investieren"},
            {"id": "sprachen", "label": "Sprachen"},
            {"id": "kreativ", "label": "Fotografie & Video"},
        ]
    }


# ═══ AUTHENTICATED ═══

class EnrollRequest(BaseModel):
    course_id: str

@router.post("/enroll")
async def enroll_course(req: EnrollRequest, request: Request):
    user = await get_current_user(request)
    course = await db.elearning_courses.find_one({"course_id": req.course_id}, {"_id": 0})
    if not course:
        raise HTTPException(status_code=404, detail="Kurs nicht gefunden")

    existing = await db.elearning_enrollments.find_one({
        "user_email": user.get("email", ""),
        "course_id": req.course_id,
    })
    if existing:
        raise HTTPException(status_code=400, detail="Bereits eingeschrieben")

    enrollment = {
        "enrollment_id": secrets.token_hex(8),
        "user_email": user.get("email", ""),
        "user_name": user.get("name", ""),
        "course_id": req.course_id,
        "course_title": course.get("title", ""),
        "progress_percent": 0,
        "completed_modules": [],
        "status": "active",
        "enrolled_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.elearning_enrollments.insert_one(enrollment)
    enrollment.pop("_id", None)

    await db.elearning_courses.update_one({"course_id": req.course_id}, {"$inc": {"students_count": 1}})

    return {"ok": True, "enrollment": enrollment}


class ProgressUpdate(BaseModel):
    course_id: str
    module_id: str

@router.post("/progress")
async def update_progress(req: ProgressUpdate, request: Request):
    user = await get_current_user(request)
    enrollment = await db.elearning_enrollments.find_one({
        "user_email": user.get("email", ""),
        "course_id": req.course_id,
    })
    if not enrollment:
        raise HTTPException(status_code=404, detail="Nicht eingeschrieben")

    completed = enrollment.get("completed_modules", [])
    if req.module_id not in completed:
        completed.append(req.module_id)

    course = await db.elearning_courses.find_one({"course_id": req.course_id}, {"_id": 0})
    total_modules = len(course.get("modules", [])) if course else 1
    progress = round((len(completed) / total_modules) * 100)

    status = "completed" if progress >= 100 else "active"

    await db.elearning_enrollments.update_one(
        {"user_email": user.get("email", ""), "course_id": req.course_id},
        {"$set": {"completed_modules": completed, "progress_percent": progress, "status": status}}
    )
    return {"ok": True, "progress": progress, "status": status, "completed_modules": completed}


@router.get("/my-courses")
async def get_my_courses(request: Request):
    user = await get_current_user(request)
    enrollments = await db.elearning_enrollments.find(
        {"user_email": user.get("email", "")}, {"_id": 0}
    ).sort("enrolled_at", -1).to_list(50)
    return {"enrollments": enrollments}


@router.get("/stats")
async def get_stats():
    total = await db.elearning_courses.count_documents({"status": "published"})
    students = await db.elearning_enrollments.count_documents({})
    categories = await db.elearning_courses.distinct("category")
    return {"total_courses": total, "total_students": students, "categories": len(categories)}
