"""
BidBlitz V2 - Digitale Vertraege & E-Signatur
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets, hashlib

router = APIRouter(prefix="/api/contracts", tags=["contracts"])

TEMPLATES = [
    {"id": "mietvertrag", "name": "Mietvertrag", "category": "Immobilien", "price": 1.99, "fields": ["Vermieter", "Mieter", "Adresse", "Miete/Monat", "Kaution", "Laufzeit"]},
    {"id": "kaufvertrag", "name": "Kaufvertrag", "category": "Allgemein", "price": 1.99, "fields": ["Verkaeufer", "Kaeufer", "Gegenstand", "Kaufpreis", "Liefertermin"]},
    {"id": "arbeitsvertrag", "name": "Arbeitsvertrag", "category": "Arbeit", "price": 2.99, "fields": ["Arbeitgeber", "Arbeitnehmer", "Position", "Gehalt", "Beginn", "Probezeit"]},
    {"id": "freelancer", "name": "Freelancer-Vertrag", "category": "Arbeit", "price": 1.99, "fields": ["Auftraggeber", "Auftragnehmer", "Projekt", "Honorar", "Deadline"]},
    {"id": "nda", "name": "Geheimhaltungsvertrag (NDA)", "category": "Business", "price": 0.99, "fields": ["Partei A", "Partei B", "Gegenstand", "Laufzeit"]},
    {"id": "darlehen", "name": "Darlehensvertrag", "category": "Finanzen", "price": 1.99, "fields": ["Darlehensgeber", "Darlehensnehmer", "Betrag", "Zinssatz", "Rueckzahlung"]},
]

class CreateContract(BaseModel):
    template_id: str
    fields: dict
    counterparty_email: str = ""

class SignContract(BaseModel):
    contract_id: str

@router.get("/templates")
async def get_templates():
    return {"templates": TEMPLATES}

@router.post("/create")
async def create_contract(req: CreateContract, request: Request):
    user = await get_current_user(request)
    template = next((t for t in TEMPLATES if t["id"] == req.template_id), None)
    if not template:
        raise HTTPException(404, "Vorlage nicht gefunden")
    raw = f"{user.get('email','')}:{secrets.token_hex(16)}:{datetime.now(timezone.utc).isoformat()}"
    doc_hash = hashlib.sha256(raw.encode()).hexdigest()[:16].upper()
    contract = {
        "contract_id": f"ctr_{secrets.token_hex(6)}",
        "doc_hash": doc_hash,
        "user_email": user.get("email", ""),
        "template_id": req.template_id,
        "template_name": template["name"],
        "fields": req.fields,
        "price": template["price"],
        "counterparty_email": req.counterparty_email,
        "signatures": [{"email": user.get("email", ""), "signed_at": datetime.now(timezone.utc).isoformat(), "hash": doc_hash[:8]}],
        "status": "pending_signature" if req.counterparty_email else "signed",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.digital_contracts.insert_one(contract)
    return {"ok": True, "contract_id": contract["contract_id"], "doc_hash": doc_hash, "price": template["price"],
            "message": f"{template['name']} erstellt! Hash: {doc_hash}"}

@router.post("/sign")
async def sign_contract(req: SignContract, request: Request):
    user = await get_current_user(request)
    contract = await db.digital_contracts.find_one({"contract_id": req.contract_id, "status": "pending_signature"})
    if not contract:
        raise HTTPException(404, "Vertrag nicht gefunden oder bereits unterschrieben")
    sig = {"email": user.get("email", ""), "signed_at": datetime.now(timezone.utc).isoformat(), "hash": secrets.token_hex(4).upper()}
    await db.digital_contracts.update_one({"contract_id": req.contract_id}, {
        "$push": {"signatures": sig}, "$set": {"status": "signed"}
    })
    return {"ok": True, "message": "Vertrag unterschrieben!"}

@router.get("/my-contracts")
async def my_contracts(request: Request):
    user = await get_current_user(request)
    email = user.get("email", "")
    contracts = await db.digital_contracts.find(
        {"$or": [{"user_email": email}, {"counterparty_email": email}]}, {"_id": 0}
    ).sort("created_at", -1).to_list(30)
    return {"contracts": contracts}
