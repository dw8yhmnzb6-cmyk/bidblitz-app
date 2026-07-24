"""
BidBlitz V2 - CV Builder
Lebenslauf erstellen, speichern, PDF-Export, auto-attach bei Bewerbungen
"""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user

router = APIRouter(prefix="/api/cv", tags=["cv"])


class Experience(BaseModel):
    company: str = ""
    position: str = ""
    start_date: str = ""
    end_date: str = ""
    description: str = ""
    current: bool = False


class Education(BaseModel):
    institution: str = ""
    degree: str = ""
    field: str = ""
    start_date: str = ""
    end_date: str = ""


class Certificate(BaseModel):
    name: str = ""
    issuer: str = ""
    date: str = ""


class Reference(BaseModel):
    name: str = ""
    company: str = ""
    phone: str = ""
    email: str = ""
    relation: str = ""


class CVData(BaseModel):
    # Personal
    full_name: str = ""
    title: str = ""
    summary: str = ""
    email: str = ""
    phone: str = ""
    address: str = ""
    city: str = ""
    website: str = ""
    linkedin: str = ""
    photo_url: str = ""
    date_of_birth: str = ""
    nationality: str = ""
    # Sections
    experience: List[Experience] = []
    education: List[Education] = []
    skills: List[str] = []
    languages: List[dict] = []  # [{"name": "Deutsch", "level": "Muttersprache"}]
    certificates: List[Certificate] = []
    references: List[Reference] = []
    hobbies: List[str] = []
    # Settings
    auto_attach: bool = True


@router.get("/me")
async def get_cv(request: Request):
    user = await get_current_user(request)
    cv = await db.user_cvs.find_one({"user_id": str(user["_id"])}, {"_id": 0})
    if not cv:
        return {
            "exists": False,
            "cv": {
                "full_name": user.get("name", ""),
                "email": user.get("email", ""),
                "auto_attach": True,
            },
        }
    return {"exists": True, "cv": cv}


@router.post("/save")
async def save_cv(req: CVData, request: Request):
    user = await get_current_user(request)
    user_id = str(user["_id"])
    now = datetime.now(timezone.utc).isoformat()

    doc = {
        "user_id": user_id,
        "full_name": req.full_name,
        "title": req.title,
        "summary": req.summary,
        "email": req.email,
        "phone": req.phone,
        "address": req.address,
        "city": req.city,
        "website": req.website,
        "linkedin": req.linkedin,
        "photo_url": req.photo_url,
        "date_of_birth": req.date_of_birth,
        "nationality": req.nationality,
        "experience": [e.dict() for e in req.experience],
        "education": [e.dict() for e in req.education],
        "skills": req.skills,
        "languages": req.languages,
        "certificates": [c.dict() for c in req.certificates],
        "references": [r.dict() for r in req.references],
        "hobbies": req.hobbies,
        "auto_attach": req.auto_attach,
        "updated_at": now,
    }

    await db.user_cvs.update_one(
        {"user_id": user_id},
        {"$set": doc, "$setOnInsert": {"created_at": now}},
        upsert=True,
    )
    return {"ok": True}


@router.get("/pdf")
async def get_cv_pdf(request: Request):
    """Generate HTML CV for PDF rendering in frontend."""
    user = await get_current_user(request)
    cv = await db.user_cvs.find_one({"user_id": str(user["_id"])})
    if not cv:
        raise HTTPException(status_code=404, detail="Kein CV vorhanden")

    # Build HTML
    exp_html = ""
    for e in cv.get("experience", []):
        end = "Aktuell" if e.get("current") else e.get("end_date", "")
        exp_html += f"""<div class="entry"><div class="dates">{e.get('start_date','')} — {end}</div>
        <div class="details"><strong>{e.get('position','')}</strong><br><span class="company">{e.get('company','')}</span>
        <p>{e.get('description','')}</p></div></div>"""

    edu_html = ""
    for e in cv.get("education", []):
        edu_html += f"""<div class="entry"><div class="dates">{e.get('start_date','')} — {e.get('end_date','')}</div>
        <div class="details"><strong>{e.get('degree','')}</strong> — {e.get('field','')}<br><span class="company">{e.get('institution','')}</span></div></div>"""

    skills_html = "".join(f'<span class="tag">{s}</span>' for s in cv.get("skills", []))
    langs_html = "".join(f'<div class="lang"><span>{l.get("name","")}</span><span class="level">{l.get("level","")}</span></div>' for l in cv.get("languages", []))

    certs_html = ""
    for c in cv.get("certificates", []):
        certs_html += f'<div class="cert"><strong>{c.get("name","")}</strong> — {c.get("issuer","")} ({c.get("date","")})</div>'

    refs_html = ""
    for r in cv.get("references", []):
        refs_html += f'<div class="ref"><strong>{r.get("name","")}</strong> — {r.get("company","")}<br><small>{r.get("phone","")} | {r.get("email","")}</small></div>'

    hobbies_html = ", ".join(cv.get("hobbies", []))

    photo = f'<img src="{cv["photo_url"]}" class="photo" />' if cv.get("photo_url") else ""

    html = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    *{{margin:0;padding:0;box-sizing:border-box}}
    body{{font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1a2e;background:#fff;max-width:800px;margin:0 auto;padding:40px}}
    .header{{display:flex;gap:20px;align-items:center;margin-bottom:30px;border-bottom:3px solid #6366f1;padding-bottom:20px}}
    .photo{{width:90px;height:90px;border-radius:50%;object-fit:cover;border:3px solid #6366f1}}
    .header-info h1{{font-size:26px;color:#1a1a2e;margin-bottom:2px}}
    .header-info .title{{font-size:14px;color:#6366f1;font-weight:600}}
    .header-info .contact{{font-size:11px;color:#666;margin-top:6px}}
    .summary{{background:#f8f9fa;padding:16px;border-radius:8px;font-size:12px;color:#444;line-height:1.6;margin-bottom:24px}}
    h2{{font-size:15px;color:#6366f1;border-bottom:2px solid #e8e8ee;padding-bottom:6px;margin:20px 0 12px}}
    .entry{{display:flex;gap:16px;margin-bottom:14px}}
    .dates{{font-size:10px;color:#888;min-width:120px;padding-top:2px}}
    .details{{font-size:12px;line-height:1.5}}
    .details strong{{color:#1a1a2e}}
    .company{{color:#6366f1;font-size:11px}}
    .details p{{color:#555;margin-top:4px;font-size:11px}}
    .tag{{display:inline-block;background:#6366f1;color:#fff;padding:3px 10px;border-radius:12px;font-size:10px;margin:2px}}
    .lang{{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f0f0f0;font-size:12px}}
    .level{{color:#888;font-size:11px}}
    .cert,.ref{{font-size:12px;margin-bottom:8px}}
    .cert small,.ref small{{color:#888}}
    </style></head><body>
    <div class="header">{photo}<div class="header-info">
    <h1>{cv.get('full_name','')}</h1>
    <div class="title">{cv.get('title','')}</div>
    <div class="contact">{cv.get('email','')} | {cv.get('phone','')} | {cv.get('city','')}</div>
    {f'<div class="contact">{cv.get("website","")} | {cv.get("linkedin","")}</div>' if cv.get('website') or cv.get('linkedin') else ''}
    </div></div>
    {f'<div class="summary">{cv.get("summary","")}</div>' if cv.get('summary') else ''}
    {f'<h2>Berufserfahrung</h2>{exp_html}' if exp_html else ''}
    {f'<h2>Ausbildung</h2>{edu_html}' if edu_html else ''}
    {f'<h2>Fähigkeiten</h2><div style="margin-bottom:16px">{skills_html}</div>' if skills_html else ''}
    {f'<h2>Sprachen</h2>{langs_html}' if langs_html else ''}
    {f'<h2>Zertifikate</h2>{certs_html}' if certs_html else ''}
    {f'<h2>Referenzen</h2>{refs_html}' if refs_html else ''}
    {f'<h2>Hobbys & Interessen</h2><p style="font-size:12px;color:#555">{hobbies_html}</p>' if hobbies_html else ''}
    </body></html>"""

    return HTMLResponse(content=html)
