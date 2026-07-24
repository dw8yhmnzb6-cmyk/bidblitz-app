"""
BidBlitz V2 - Freelancer-Plattform
Freelancer finden & beauftragen. Kategorien, Bewertungen, Projekte
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/freelancer", tags=["freelancer"])


SEED_FREELANCERS = [
    {
        "freelancer_id": "fl_001",
        "name": "Sarah Müller",
        "title": "UI/UX Designerin",
        "category": "design",
        "hourly_rate": 85,
        "rating": 4.9,
        "reviews_count": 127,
        "location": "Berlin",
        "description": "Senior UI/UX Designerin mit 8 Jahren Erfahrung. Spezialisiert auf Mobile Apps, Design Systems und Prototyping. Figma, Sketch, Adobe XD.",
        "skills": ["Figma", "UI Design", "UX Research", "Prototyping", "Design Systems"],
        "avatar": "https://images.unsplash.com/photo-1765648580890-732fa6d769c5?w=400&q=80",
        "portfolio_images": [
            "https://images.unsplash.com/photo-1765648580575-e1423b361ed5?w=800&q=80"
        ],
        "languages": ["Deutsch", "Englisch"],
        "response_time": "< 2 Std.",
        "completed_projects": 89,
        "featured": True,
        "available": True,
    },
    {
        "freelancer_id": "fl_002",
        "name": "Markus Weber",
        "title": "Full-Stack Entwickler",
        "category": "entwicklung",
        "hourly_rate": 95,
        "rating": 4.8,
        "reviews_count": 203,
        "location": "München",
        "description": "Full-Stack Developer — React, Node.js, Python, AWS. Erfahrung mit Startups und Enterprise-Projekten. Clean Code, CI/CD, Agile.",
        "skills": ["React", "Node.js", "Python", "AWS", "TypeScript", "PostgreSQL"],
        "avatar": "https://images.unsplash.com/photo-1758519290828-2e62b7699b28?w=400&q=80",
        "portfolio_images": [
            "https://images.unsplash.com/photo-1758611971270-89ce7ed506e1?w=800&q=80"
        ],
        "languages": ["Deutsch", "Englisch", "Französisch"],
        "response_time": "< 1 Std.",
        "completed_projects": 156,
        "featured": True,
        "available": True,
    },
    {
        "freelancer_id": "fl_003",
        "name": "Anna Schmidt",
        "title": "Content-Autorin & SEO-Spezialistin",
        "category": "marketing",
        "hourly_rate": 65,
        "rating": 4.7,
        "reviews_count": 94,
        "location": "Hamburg",
        "description": "SEO-optimierte Texte, Blogposts, Landing Pages, Social Media Content. Erfahrung in E-Commerce, SaaS, FinTech. Deutsch und Englisch.",
        "skills": ["SEO", "Content Writing", "Copywriting", "Social Media", "WordPress"],
        "avatar": "https://images.unsplash.com/photo-1765648580528-8d659861d81a?w=400&q=80",
        "portfolio_images": [],
        "languages": ["Deutsch", "Englisch"],
        "response_time": "< 4 Std.",
        "completed_projects": 67,
        "featured": False,
        "available": True,
    },
    {
        "freelancer_id": "fl_004",
        "name": "Kemal Yilmaz",
        "title": "Video-Editor & Motion Designer",
        "category": "video",
        "hourly_rate": 75,
        "rating": 4.9,
        "reviews_count": 68,
        "location": "Köln",
        "description": "Professioneller Video-Schnitt, Motion Graphics, After Effects, Premiere Pro. YouTube-Intros, Produktvideos, Werbefilme, Erklärvideos.",
        "skills": ["After Effects", "Premiere Pro", "Motion Design", "Color Grading", "Animation"],
        "avatar": "https://images.unsplash.com/photo-1758519290828-2e62b7699b28?w=400&q=80",
        "portfolio_images": [],
        "languages": ["Deutsch", "Englisch", "Türkisch"],
        "response_time": "< 3 Std.",
        "completed_projects": 45,
        "featured": True,
        "available": True,
    },
    {
        "freelancer_id": "fl_005",
        "name": "Elena Petrova",
        "title": "Übersetzerin (DE/EN/RU)",
        "category": "uebersetzung",
        "hourly_rate": 55,
        "rating": 5.0,
        "reviews_count": 312,
        "location": "Frankfurt",
        "description": "Zertifizierte Übersetzerin für Deutsch, Englisch, Russisch. Fachgebiete: Recht, Medizin, Technik, Marketing. Schnell und präzise.",
        "skills": ["Deutsch", "Englisch", "Russisch", "Fachübersetzung", "Lektorat"],
        "avatar": "https://images.unsplash.com/photo-1765648580890-732fa6d769c5?w=400&q=80",
        "portfolio_images": [],
        "languages": ["Deutsch", "Englisch", "Russisch"],
        "response_time": "< 1 Std.",
        "completed_projects": 234,
        "featured": False,
        "available": True,
    },
    {
        "freelancer_id": "fl_006",
        "name": "Jan Becker",
        "title": "Buchhalter & Steuerberater",
        "category": "finanzen",
        "hourly_rate": 90,
        "rating": 4.8,
        "reviews_count": 76,
        "location": "Düsseldorf",
        "description": "Digitale Buchhaltung, Steuererklärungen, EÜR, Bilanzierung. Spezialisiert auf Freelancer und kleine Unternehmen. DATEV, Lexoffice.",
        "skills": ["Buchhaltung", "Steuererklärung", "DATEV", "Lexoffice", "Bilanzierung"],
        "avatar": "https://images.unsplash.com/photo-1758519290828-2e62b7699b28?w=400&q=80",
        "portfolio_images": [],
        "languages": ["Deutsch", "Englisch"],
        "response_time": "< 6 Std.",
        "completed_projects": 112,
        "featured": False,
        "available": True,
    },
    {
        "freelancer_id": "fl_007",
        "name": "Lena Hoffmann",
        "title": "Social Media Managerin",
        "category": "marketing",
        "hourly_rate": 60,
        "rating": 4.6,
        "reviews_count": 53,
        "location": "Stuttgart",
        "description": "Instagram, TikTok, LinkedIn Content-Strategie. Community Management, Paid Ads, Influencer-Kooperationen. Für Brands und Startups.",
        "skills": ["Instagram", "TikTok", "LinkedIn", "Paid Ads", "Content Strategy"],
        "avatar": "https://images.unsplash.com/photo-1765648580528-8d659861d81a?w=400&q=80",
        "portfolio_images": [],
        "languages": ["Deutsch", "Englisch"],
        "response_time": "< 2 Std.",
        "completed_projects": 38,
        "featured": False,
        "available": True,
    },
]

SEED_GIGS = [
    {
        "gig_id": "gig_001",
        "freelancer_id": "fl_001",
        "title": "Professionelles App-Design (UI/UX)",
        "category": "design",
        "price_from": 490,
        "delivery_days": 7,
        "description": "Komplettes App-Design inkl. Wireframes, UI-Kit, Prototyp in Figma. Bis zu 10 Screens.",
        "tags": ["App Design", "Figma", "UI Kit"],
        "orders_count": 45,
        "image": "https://images.unsplash.com/photo-1765648580575-e1423b361ed5?w=800&q=80",
    },
    {
        "gig_id": "gig_002",
        "freelancer_id": "fl_002",
        "title": "React Web-App Entwicklung",
        "category": "entwicklung",
        "price_from": 1200,
        "delivery_days": 14,
        "description": "Full-Stack Web-App mit React + Node.js. REST API, Datenbank, Deployment. Bis zu 5 Features.",
        "tags": ["React", "Node.js", "Full-Stack"],
        "orders_count": 67,
        "image": "https://images.unsplash.com/photo-1758611971270-89ce7ed506e1?w=800&q=80",
    },
    {
        "gig_id": "gig_003",
        "freelancer_id": "fl_003",
        "title": "SEO-Blogpost (2000 Wörter)",
        "category": "marketing",
        "price_from": 180,
        "delivery_days": 3,
        "description": "Recherchierter, SEO-optimierter Blogpost mit Keywords, Meta-Description, Headings. Inkl. 1 Revision.",
        "tags": ["SEO", "Blog", "Content"],
        "orders_count": 89,
        "image": "https://images.unsplash.com/photo-1765648580528-8d659861d81a?w=800&q=80",
    },
    {
        "gig_id": "gig_004",
        "freelancer_id": "fl_004",
        "title": "Professionelles Erklärvideo (60 Sek.)",
        "category": "video",
        "price_from": 650,
        "delivery_days": 10,
        "description": "Animiertes Erklärvideo mit Voiceover, Musik, Untertitel. Perfekt für Produkte, Services, Startups.",
        "tags": ["Video", "Animation", "Erklärvideo"],
        "orders_count": 32,
        "image": "https://images.unsplash.com/photo-1758519290828-2e62b7699b28?w=800&q=80",
    },
    {
        "gig_id": "gig_005",
        "freelancer_id": "fl_005",
        "title": "Fachübersetzung DE-EN (5000 Wörter)",
        "category": "uebersetzung",
        "price_from": 320,
        "delivery_days": 5,
        "description": "Professionelle Fachübersetzung Deutsch-Englisch. Recht, Technik, Medizin, Marketing. Inkl. Lektorat.",
        "tags": ["Übersetzung", "Deutsch", "Englisch"],
        "orders_count": 156,
        "image": "https://images.unsplash.com/photo-1765648580890-732fa6d769c5?w=800&q=80",
    },
]


@router.on_event("startup")
async def seed_freelancer():
    count = await db.freelancers.count_documents({})
    if count == 0:
        now = datetime.now(timezone.utc).isoformat()
        for f in SEED_FREELANCERS:
            f["created_at"] = now
        await db.freelancers.insert_many(SEED_FREELANCERS)
    gig_count = await db.freelancer_gigs.count_documents({})
    if gig_count == 0:
        now = datetime.now(timezone.utc).isoformat()
        for g in SEED_GIGS:
            g["created_at"] = now
        await db.freelancer_gigs.insert_many(SEED_GIGS)


# ═══ PUBLIC ENDPOINTS ═══

@router.get("/freelancers")
async def list_freelancers(
    category: Optional[str] = None,
    min_rate: Optional[float] = None,
    max_rate: Optional[float] = None,
    location: Optional[str] = None,
    search: Optional[str] = None,
):
    query = {"available": True}
    if category:
        query["category"] = category
    if location:
        query["location"] = {"$regex": location, "$options": "i"}
    if min_rate is not None:
        query.setdefault("hourly_rate", {})["$gte"] = min_rate
    if max_rate is not None:
        query.setdefault("hourly_rate", {})["$lte"] = max_rate
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"title": {"$regex": search, "$options": "i"}},
            {"skills": {"$regex": search, "$options": "i"}},
        ]

    freelancers = await db.freelancers.find(query, {"_id": 0}).sort("featured", -1).to_list(100)
    return {"freelancers": freelancers, "total": len(freelancers)}


@router.get("/freelancer/{freelancer_id}")
async def get_freelancer(freelancer_id: str):
    f = await db.freelancers.find_one({"freelancer_id": freelancer_id}, {"_id": 0})
    if not f:
        raise HTTPException(status_code=404, detail="Freelancer nicht gefunden")
    gigs = await db.freelancer_gigs.find({"freelancer_id": freelancer_id}, {"_id": 0}).to_list(20)
    f["gigs"] = gigs
    return f


@router.get("/gigs")
async def list_gigs(category: Optional[str] = None):
    query = {}
    if category:
        query["category"] = category
    gigs = await db.freelancer_gigs.find(query, {"_id": 0}).sort("orders_count", -1).to_list(50)
    return {"gigs": gigs, "total": len(gigs)}


@router.get("/categories")
async def get_categories():
    return {
        "categories": [
            {"id": "design", "label": "Design & Kreativ", "icon": "Palette"},
            {"id": "entwicklung", "label": "Entwicklung & IT", "icon": "Code"},
            {"id": "marketing", "label": "Marketing & Content", "icon": "Megaphone"},
            {"id": "video", "label": "Video & Animation", "icon": "Film"},
            {"id": "uebersetzung", "label": "Übersetzung & Text", "icon": "Languages"},
            {"id": "finanzen", "label": "Finanzen & Recht", "icon": "Calculator"},
        ]
    }


# ═══ AUTHENTICATED ═══

class ProjectRequest(BaseModel):
    freelancer_id: str
    gig_id: Optional[str] = ""
    title: str
    description: str
    budget: float
    deadline: Optional[str] = ""

@router.post("/project/request")
async def create_project_request(req: ProjectRequest, request: Request):
    user = await get_current_user(request)
    project = {
        "project_id": secrets.token_hex(8),
        "freelancer_id": req.freelancer_id,
        "gig_id": req.gig_id,
        "client_email": user.get("email", ""),
        "client_name": user.get("name", ""),
        "title": req.title,
        "description": req.description,
        "budget": req.budget,
        "deadline": req.deadline,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.freelancer_projects.insert_one(project)
    project.pop("_id", None)
    return {"ok": True, "project": project}


@router.get("/my-projects")
async def get_my_projects(request: Request):
    user = await get_current_user(request)
    projects = await db.freelancer_projects.find(
        {"client_email": user.get("email", "")}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return {"projects": projects}
