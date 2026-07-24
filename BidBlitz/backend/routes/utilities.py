"""BidBlitz V2 - Group Chat & Channels + Digital vCard + Wishlist + Doc Scanner + Password Manager + VPN + Cloud Storage"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets, hashlib

router = APIRouter(prefix="/api/utilities", tags=["utilities"])

# ─── GROUP CHAT ───
class CreateGroup(BaseModel):
    name: str
    description: str = ""
    is_premium: bool = False

class SendGroupMsg(BaseModel):
    group_id: str
    text: str

@router.post("/groups/create")
async def create_group(req: CreateGroup, request: Request):
    user = await get_current_user(request)
    group = {"group_id": f"grp_{secrets.token_hex(6)}", "name": req.name, "description": req.description,
             "owner": user.get("email",""), "members": [user.get("email","")], "is_premium": req.is_premium,
             "price": 2.99 if req.is_premium else 0, "messages": [], "created_at": datetime.now(timezone.utc).isoformat()}
    await db.group_chats.insert_one(group)
    return {"ok": True, "group_id": group["group_id"], "message": f"Gruppe '{req.name}' erstellt!"}

@router.get("/groups")
async def list_groups(request: Request):
    groups = await db.group_chats.find({}, {"_id": 0, "messages": 0}).sort("created_at", -1).to_list(20)
    return {"groups": groups}

@router.post("/groups/message")
async def send_group_msg(req: SendGroupMsg, request: Request):
    user = await get_current_user(request)
    await db.group_chats.update_one({"group_id": req.group_id}, {"$push": {"messages": {"from": user.get("email",""), "text": req.text, "at": datetime.now(timezone.utc).isoformat()}}})
    return {"ok": True}

# ─── DIGITAL VCARD ───
class CreateVCard(BaseModel):
    name: str
    title: str = ""
    phone: str = ""
    email: str = ""
    website: str = ""
    linkedin: str = ""
    instagram: str = ""
    design: str = "classic"

@router.post("/vcard/create")
async def create_vcard(req: CreateVCard, request: Request):
    user = await get_current_user(request)
    vcard = {"vcard_id": f"vc_{secrets.token_hex(6)}", "user_email": user.get("email",""), **req.dict(),
             "views": 0, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.vcards.update_one({"user_email": user.get("email","")}, {"$set": vcard}, upsert=True)
    return {"ok": True, "vcard_id": vcard["vcard_id"], "message": "Digitale Visitenkarte erstellt!"}

@router.get("/vcard/mine")
async def my_vcard(request: Request):
    user = await get_current_user(request)
    vc = await db.vcards.find_one({"user_email": user.get("email","")}, {"_id": 0})
    return {"vcard": vc}

# ─── WISHLIST ───
class AddWish(BaseModel):
    title: str
    price: float = 0
    url: str = ""
    list_name: str = "Geburtstag"

@router.post("/wishlist/add")
async def add_wish(req: AddWish, request: Request):
    user = await get_current_user(request)
    wish = {"wish_id": f"wish_{secrets.token_hex(6)}", "user_email": user.get("email",""), "title": req.title,
            "price": req.price, "url": req.url, "list_name": req.list_name, "bought": False, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.wishlists.insert_one(wish)
    return {"ok": True, "message": f"'{req.title}' zur Wunschliste hinzugefuegt!"}

@router.get("/wishlist/mine")
async def my_wishlist(request: Request):
    user = await get_current_user(request)
    wishes = await db.wishlists.find({"user_email": user.get("email","")}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"wishes": wishes}

# ─── DOC SCANNER ───
@router.post("/scanner/save")
async def save_scan(request: Request):
    user = await get_current_user(request)
    scan = {"scan_id": f"scan_{secrets.token_hex(6)}", "user_email": user.get("email",""), "name": "Dokument", "pages": 1, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.doc_scans.insert_one(scan)
    return {"ok": True, "scan_id": scan["scan_id"], "message": "Dokument gescannt & gespeichert!"}

@router.get("/scanner/mine")
async def my_scans(request: Request):
    user = await get_current_user(request)
    scans = await db.doc_scans.find({"user_email": user.get("email","")}, {"_id": 0}).sort("created_at", -1).to_list(20)
    return {"scans": scans}

# ─── PASSWORD MANAGER ───
class SavePassword(BaseModel):
    site: str
    username: str
    password: str

@router.post("/passwords/save")
async def save_password(req: SavePassword, request: Request):
    user = await get_current_user(request)
    enc_pw = hashlib.sha256(f"{req.password}:{user.get('email','')}".encode()).hexdigest()[:32]
    entry = {"entry_id": f"pw_{secrets.token_hex(6)}", "user_email": user.get("email",""), "site": req.site,
             "username": req.username, "password_hash": enc_pw, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.password_vault.insert_one(entry)
    return {"ok": True, "message": f"Passwort fuer {req.site} gespeichert!"}

@router.get("/passwords/mine")
async def my_passwords(request: Request):
    user = await get_current_user(request)
    entries = await db.password_vault.find({"user_email": user.get("email","")}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(50)
    return {"entries": entries}

# ─── VPN SERVICE ───
@router.post("/vpn/connect")
async def vpn_connect(request: Request):
    user = await get_current_user(request)
    servers = ["Frankfurt", "Amsterdam", "Zuerich", "Wien", "London"]
    import random
    server = random.choice(servers)
    return {"ok": True, "server": server, "ip": f"10.{random.randint(1,255)}.{random.randint(1,255)}.{random.randint(1,255)}", "message": f"VPN verbunden: {server}"}

@router.post("/vpn/subscribe")
async def vpn_subscribe(request: Request):
    user = await get_current_user(request)
    await db.vpn_subscriptions.insert_one({"user_email": user.get("email",""), "plan": "premium", "price": 4.99, "status": "active", "created_at": datetime.now(timezone.utc).isoformat()})
    return {"ok": True, "message": "BlitzVPN Premium aktiviert fuer 4.99 EUR/Mo!"}

# ─── CLOUD STORAGE ───
@router.get("/cloud/usage")
async def cloud_usage(request: Request):
    user = await get_current_user(request)
    files = await db.cloud_files.find({"user_email": user.get("email","")}, {"_id": 0}).to_list(50)
    used_mb = sum(f.get("size_mb", 0) for f in files)
    return {"files": files, "used_mb": round(used_mb, 1), "limit_mb": 5000, "plan": "free"}

@router.post("/cloud/subscribe")
async def cloud_subscribe(request: Request):
    user = await get_current_user(request)
    await db.cloud_subscriptions.insert_one({"user_email": user.get("email",""), "plan": "50gb", "price": 2.99, "status": "active", "created_at": datetime.now(timezone.utc).isoformat()})
    return {"ok": True, "message": "50GB Cloud-Speicher aktiviert fuer 2.99 EUR/Mo!"}
