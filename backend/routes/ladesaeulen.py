"""
BidBlitz V2 - Ladesäulen-Finder (EV Charging)
E-Ladestationen finden, Laden starten, Bezahlen
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
from core.payment_engine import credit_wallet, debit_wallet, TransactionType
import hashlib, secrets, random

router = APIRouter(prefix="/api/ladesaeulen", tags=["ladesaeulen"])

SEED = [
    {"station_id":"ev_001","name":"Schnelllader Alexanderplatz","operator":"EnBW","type":"DC","power_kw":150,"connectors":["CCS","CHAdeMO"],"price_per_kwh":0.49,"address":"Alexanderplatz 3, 10178 Berlin","city":"Berlin","lat":52.5219,"lng":13.4132,"status":"available","slots_total":4,"slots_available":3,"rating":4.7,"reviews":89,"features":["Überdacht","24/7","Karte/App","Café nebenan"],"image":"https://images.unsplash.com/photo-1692052664566-477579a08e8c?w=800&q=80"},
    {"station_id":"ev_002","name":"Tesla Supercharger Stachus","operator":"Tesla","type":"DC","power_kw":250,"connectors":["Tesla","CCS"],"price_per_kwh":0.45,"address":"Karlsplatz 1, 80335 München","city":"München","lat":48.1394,"lng":11.5653,"status":"available","slots_total":8,"slots_available":5,"rating":4.9,"reviews":234,"features":["250kW","24/7","Lounge","Toilette"],"image":"https://images.unsplash.com/photo-1672542128826-5f0d578713d2?w=800&q=80"},
    {"station_id":"ev_003","name":"Stadtwerke Ladepark Hafen","operator":"Stadtwerke Hamburg","type":"DC","power_kw":100,"connectors":["CCS","Typ 2"],"price_per_kwh":0.39,"address":"Am Sandtorkai 50, 20457 Hamburg","city":"Hamburg","lat":53.5432,"lng":9.9876,"status":"available","slots_total":6,"slots_available":4,"rating":4.6,"reviews":156,"features":["Ökostrom","Parkhaus","Shopping","Barrierefrei"],"image":"https://images.unsplash.com/photo-1692052626528-cb97a934a63b?w=800&q=80"},
    {"station_id":"ev_004","name":"IONITY Autobahn A3","operator":"IONITY","type":"HPC","power_kw":350,"connectors":["CCS"],"price_per_kwh":0.79,"address":"Raststätte Fernthal, A3","city":"Neustadt/Wied","lat":50.5912,"lng":7.4123,"status":"available","slots_total":6,"slots_available":6,"rating":4.5,"reviews":67,"features":["350kW HPC","24/7","Raststätte","WC"],"image":"https://images.unsplash.com/photo-1672542128827-ccbb7b8b8099?w=800&q=80"},
    {"station_id":"ev_005","name":"AC Wallbox Parkhaus City","operator":"Allego","type":"AC","power_kw":22,"connectors":["Typ 2"],"price_per_kwh":0.35,"address":"Zeil 112, 60313 Frankfurt","city":"Frankfurt","lat":50.1145,"lng":8.6823,"status":"occupied","slots_total":10,"slots_available":2,"rating":4.4,"reviews":112,"features":["Günstig","Parkhaus","Shopping","Überdacht"],"image":"https://images.pexels.com/photos/32472665/pexels-photo-32472665.jpeg?w=800"},
    {"station_id":"ev_006","name":"Schnelllader Mediapark","operator":"E.ON","type":"DC","power_kw":150,"connectors":["CCS","CHAdeMO"],"price_per_kwh":0.44,"address":"Mediapark 5, 50670 Köln","city":"Köln","lat":50.9498,"lng":6.9432,"status":"available","slots_total":4,"slots_available":4,"rating":4.8,"reviews":78,"features":["150kW","Überdacht","App-Bezahlung","Café"],"image":"https://images.pexels.com/photos/5391511/pexels-photo-5391511.jpeg?w=800"},
]

@router.on_event("startup")
async def seed():
    if await db.ev_stations.count_documents({}) == 0:
        now = datetime.now(timezone.utc).isoformat()
        for s in SEED:
            s["created_at"] = now
            s["total_sessions"] = random.randint(500, 5000)
        await db.ev_stations.insert_many(SEED)

@router.get("/stations")
async def list_stations(city: Optional[str]=None, type: Optional[str]=None, connector: Optional[str]=None, available_only: bool=False):
    q = {}
    if city: q["city"] = {"$regex":city,"$options":"i"}
    if type: q["type"] = type
    if connector: q["connectors"] = connector
    if available_only: q["slots_available"] = {"$gt": 0}
    stations = await db.ev_stations.find(q, {"_id":0}).sort("rating",-1).to_list(100)
    return {"stations": stations, "total": len(stations)}

@router.get("/station/{station_id}")
async def get_station(station_id: str):
    s = await db.ev_stations.find_one({"station_id":station_id},{"_id":0})
    if not s: raise HTTPException(404, "Station nicht gefunden")
    return s

@router.get("/stats")
async def get_stats():
    total = await db.ev_stations.count_documents({})
    available = await db.ev_stations.count_documents({"slots_available":{"$gt":0}})
    cities = await db.ev_stations.distinct("city")
    return {"total_stations": total, "available": available, "cities": len(cities)}

class StartChargingReq(BaseModel):
    station_id: str
    connector: str = "CCS"
    vehicle: str = ""
    unlock_code: str = ""
    idempotency_key: str = ""


def _idempotency_key(request: Request, supplied: str, operation: str) -> str:
    header = (request.headers.get("Idempotency-Key") or "").strip()
    key = (supplied or header).strip()
    if not key or len(key) > 200:
        raise HTTPException(400, f"Idempotency-Key für {operation} erforderlich")
    if header and header != key:
        raise HTTPException(400, "Idempotency-Keys stimmen nicht überein")
    return key


def _stable_key(prefix: str, user_id: str, key: str) -> str:
    digest = hashlib.sha256(f"{user_id}:{key}".encode()).hexdigest()
    return f"{prefix}:{digest}"

@router.post("/unlock")
async def unlock_station(req: StartChargingReq, request: Request):
    """Ladesäule freischalten via QR-Code oder App-Button"""
    user = await get_current_user(request)
    station = await db.ev_stations.find_one({"station_id":req.station_id},{"_id":0})
    if not station: raise HTTPException(404, "Station nicht gefunden")
    if station.get("slots_available",0) < 1: raise HTTPException(400, "Keine freien Ladepunkte")
    user_doc = await db.users.find_one({"email": user.get("email","")})
    balance = user_doc.get("balance", 0) if user_doc else 0
    if balance < 5: raise HTTPException(400, "Mindestguthaben 5€ erforderlich. Bitte Wallet aufladen.")
    unlock = {
        "unlock_id": secrets.token_hex(8), "station_id": req.station_id,
        "station_name": station["name"], "operator": station["operator"],
        "connector": req.connector, "user_email": user.get("email",""),
        "user_name": user.get("name",""), "power_kw": station["power_kw"],
        "price_per_kwh": station["price_per_kwh"],
        "unlock_code": req.unlock_code or secrets.token_hex(4).upper(),
        "status": "unlocked", "unlocked_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.ev_unlocks.insert_one(unlock)
    unlock.pop("_id", None)
    return {"ok": True, "unlock": unlock, "message": f"Ladesäule freigeschaltet! Code: {unlock['unlock_code']}"}

@router.post("/start")
async def start_charging(req: StartChargingReq, request: Request):
    """Start charging with a retry-safe €5 wallet reservation."""
    user = await get_current_user(request)
    email = user.get("email", "")
    user_doc = await db.users.find_one({"email": email})
    if not user_doc:
        raise HTTPException(404, "User nicht gefunden")
    user_id = str(user_doc["_id"])
    key = _idempotency_key(request, req.idempotency_key, "Ladestart")
    session_id = "evs_" + hashlib.sha256(f"{user_id}:{key}".encode()).hexdigest()[:20]

    existing = await db.ev_sessions.find_one({"session_id": session_id, "user_email": email})
    if existing and existing.get("station_id") != req.station_id:
        raise HTTPException(409, "Idempotency-Key wurde bereits für eine andere Station verwendet")
    if existing and existing.get("status") == "charging":
        existing.pop("_id", None)
        return {"ok": True, "session": existing, "reserved": 5.0,
                "wallet_balance": float(user_doc.get("balance", 0)), "idempotent_replay": True}
    if existing and existing.get("status") in {"failed", "completed"}:
        raise HTTPException(409, "Dieser Ladestart ist bereits abgeschlossen. Bitte einen neuen Auftrag starten")
    other_active = await db.ev_sessions.find_one(
        {"user_email": email, "status": {"$in": ["charging", "starting", "stopping"]},
         "session_id": {"$ne": session_id}}, {"session_id": 1}
    )
    if other_active:
        raise HTTPException(409, "Es läuft bereits ein anderer Ladevorgang")

    station = await db.ev_stations.find_one({"station_id": req.station_id}, {"_id": 0})
    if not station:
        raise HTTPException(404, "Station nicht gefunden")

    lock_result = await db.users.update_one(
        {"_id": user_doc["_id"], "$or": [
            {"active_legacy_ev_session_id": {"$exists": False}},
            {"active_legacy_ev_session_id": None},
            {"active_legacy_ev_session_id": session_id},
        ]},
        {"$set": {"active_legacy_ev_session_id": session_id}},
    )
    if lock_result.modified_count != 1:
        locked = await db.users.find_one({"_id": user_doc["_id"]}, {"active_legacy_ev_session_id": 1}) or {}
        if locked.get("active_legacy_ev_session_id") != session_id:
            raise HTTPException(409, "Es läuft bereits ein anderer Ladevorgang")

    reserve_key = _stable_key("ladesaeulen:start", user_id, key)
    reserve = await debit_wallet(
        user_id=user_id, amount=5.0, tx_type=TransactionType.EV_CHARGING,
        description=f"Ladesäule Reservierung: {station['name']}", reference=session_id,
        metadata={"station_id": req.station_id, "phase": "reservation"},
        idempotency_key=reserve_key,
    )
    if not reserve.success:
        if str(getattr(reserve.status, "value", reserve.status)) not in {"pending", "reconciliation_required"}:
            await db.users.update_one(
                {"_id": user_doc["_id"], "active_legacy_ev_session_id": session_id},
                {"$set": {"active_legacy_ev_session_id": None}},
            )
        code = 409 if str(getattr(reserve.status, "value", reserve.status)) in {"pending", "reconciliation_required"} else 400
        raise HTTPException(code, reserve.error or "Mindestguthaben 5€ erforderlich. Bitte Wallet aufladen.")

    session_doc = {
        "_id": session_id, "session_id": session_id, "station_id": req.station_id,
        "station_name": station["name"], "operator": station["operator"],
        "connector": req.connector, "vehicle": req.vehicle, "user_email": email,
        "user_id": user_id, "user_name": user.get("name", ""), "power_kw": station["power_kw"],
        "price_per_kwh": station["price_per_kwh"], "kwh_charged": 0, "cost": 0,
        "reserved": 5.0, "reserve_transaction_id": reserve.transaction_id,
        "status": "starting", "payment_method": "bidblitz_wallet",
        "start_idempotency_key": key, "started_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.ev_sessions.update_one({"_id": session_id}, {"$setOnInsert": session_doc}, upsert=True)

    station_result = await db.ev_stations.update_one(
        {"station_id": req.station_id, "slots_available": {"$gt": 0}, "active_session_markers": {"$ne": session_id}},
        {"$inc": {"slots_available": -1}, "$addToSet": {"active_session_markers": session_id}},
    )
    if station_result.modified_count != 1:
        current_station = await db.ev_stations.find_one({"station_id": req.station_id}, {"active_session_markers": 1}) or {}
        if session_id not in (current_station.get("active_session_markers") or []):
            refund = await credit_wallet(
                user_id=user_id, amount=5.0, tx_type=TransactionType.REFUND,
                description=f"Ladesäule Reservierung storniert: {station['name']}", reference=session_id,
                metadata={"station_id": req.station_id, "phase": "reservation_refund"},
                idempotency_key=f"{reserve_key}:refund",
            )
            await db.ev_sessions.update_one({"_id": session_id}, {"$set": {
                "status": "failed", "failure_reason": "no_slot",
                "refund_transaction_id": refund.transaction_id, "failed_at": datetime.now(timezone.utc).isoformat(),
            }})
            if refund.success:
                await db.users.update_one(
                    {"_id": user_doc["_id"], "active_legacy_ev_session_id": session_id},
                    {"$set": {"active_legacy_ev_session_id": None}},
                )
            raise HTTPException(409, "Keine freien Ladepunkte")

    await db.ev_sessions.update_one({"_id": session_id}, {"$set": {"status": "charging"}})
    session = await db.ev_sessions.find_one({"