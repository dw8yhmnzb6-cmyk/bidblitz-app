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
import secrets, random

router = APIRouter(prefix="/api/ladesaeulen", tags=["ladesaeulen"])

SEED = [
    {"station_id":"ev_001","name":"Schnelllader Alexanderplatz","operator":"EnBW","type":"DC","power_kw":150,"connectors":["CCS","CHAdeMO"],"price_per_kwh":0.49,"address":"Alexanderplatz 3, 10178 Berlin","city":"Berlin","lat":52.5219,"lng":13.4132,"status":"available","slots_total":4,"slots_available":3,"rating":4.7,"reviews":89,"features":["Überdacht","24/7","Karte/App","Café nebenan"],"image":"https://images.unsplash.com/photo-1772256019760-a144ae100cc4?w=800&q=80"},
    {"station_id":"ev_002","name":"Tesla Supercharger Stachus","operator":"Tesla","type":"DC","power_kw":250,"connectors":["Tesla","CCS"],"price_per_kwh":0.45,"address":"Karlsplatz 1, 80335 München","city":"München","lat":48.1394,"lng":11.5653,"status":"available","slots_total":8,"slots_available":5,"rating":4.9,"reviews":234,"features":["250kW","24/7","Lounge","Toilette"],"image":"https://images.unsplash.com/photo-1775138260921-883455954eb0?w=800&q=80"},
    {"station_id":"ev_003","name":"Stadtwerke Ladepark Hafen","operator":"Stadtwerke Hamburg","type":"DC","power_kw":100,"connectors":["CCS","Typ 2"],"price_per_kwh":0.39,"address":"Am Sandtorkai 50, 20457 Hamburg","city":"Hamburg","lat":53.5432,"lng":9.9876,"status":"available","slots_total":6,"slots_available":4,"rating":4.6,"reviews":156,"features":["Ökostrom","Parkhaus","Shopping","Barrierefrei"],"image":"https://images.unsplash.com/photo-1762452059456-e4c16c256dd1?w=800&q=80"},
    {"station_id":"ev_004","name":"IONITY Autobahn A3","operator":"IONITY","type":"HPC","power_kw":350,"connectors":["CCS"],"price_per_kwh":0.79,"address":"Raststätte Fernthal, A3","city":"Neustadt/Wied","lat":50.5912,"lng":7.4123,"status":"available","slots_total":6,"slots_available":6,"rating":4.5,"reviews":67,"features":["350kW HPC","24/7","Raststätte","WC"],"image":"https://images.unsplash.com/photo-1774685110718-c5b4fe026144?w=800&q=80"},
    {"station_id":"ev_005","name":"AC Wallbox Parkhaus City","operator":"Allego","type":"AC","power_kw":22,"connectors":["Typ 2"],"price_per_kwh":0.35,"address":"Zeil 112, 60313 Frankfurt","city":"Frankfurt","lat":50.1145,"lng":8.6823,"status":"occupied","slots_total":10,"slots_available":2,"rating":4.4,"reviews":112,"features":["Günstig","Parkhaus","Shopping","Überdacht"],"image":"https://images.unsplash.com/photo-1638454795595-0a0abf68614d?w=800&q=80"},
    {"station_id":"ev_006","name":"Schnelllader Mediapark","operator":"E.ON","type":"DC","power_kw":150,"connectors":["CCS","CHAdeMO"],"price_per_kwh":0.44,"address":"Mediapark 5, 50670 Köln","city":"Köln","lat":50.9498,"lng":6.9432,"status":"available","slots_total":4,"slots_available":4,"rating":4.8,"reviews":78,"features":["150kW","Überdacht","App-Bezahlung","Café"],"image":"https://images.unsplash.com/photo-1757439402101-55d1da381e70?w=800&q=80"},
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
    user = await get_current_user(request)
    station = await db.ev_stations.find_one({"station_id":req.station_id},{"_id":0})
    if not station: raise HTTPException(404, "Station nicht gefunden")
    if station.get("slots_available",0) < 1: raise HTTPException(400, "Keine freien Ladepunkte")
    user_doc = await db.users.find_one({"email": user.get("email","")})
    balance = user_doc.get("balance", 0) if user_doc else 0
    if balance < 5: raise HTTPException(400, "Mindestguthaben 5€ erforderlich")
    session = {
        "session_id": secrets.token_hex(8), "station_id": req.station_id,
        "station_name": station["name"], "operator": station["operator"],
        "connector": req.connector, "vehicle": req.vehicle,
        "user_email": user.get("email",""), "user_name": user.get("name",""),
        "power_kw": station["power_kw"], "price_per_kwh": station["price_per_kwh"],
        "kwh_charged": 0, "cost": 0, "status": "charging",
        "started_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.ev_sessions.insert_one(session)
    session.pop("_id", None)
    await db.ev_stations.update_one({"station_id":req.station_id},{"$inc":{"slots_available":-1}})
    return {"ok": True, "session": session}

class StopChargingReq(BaseModel):
    session_id: str

@router.post("/stop")
async def stop_charging(req: StopChargingReq, request: Request):
    user = await get_current_user(request)
    session = await db.ev_sessions.find_one({"session_id":req.session_id,"user_email":user.get("email","")})
    if not session: raise HTTPException(404, "Session nicht gefunden")
    kwh = round(random.uniform(5, 60), 1)
    cost = round(kwh * session.get("price_per_kwh", 0.45), 2)
    await db.ev_sessions.update_one({"session_id":req.session_id},{"$set":{"status":"completed","kwh_charged":kwh,"cost":cost,"ended_at":datetime.now(timezone.utc).isoformat()}})
    await db.ev_stations.update_one({"station_id":session["station_id"]},{"$inc":{"slots_available":1,"total_sessions":1}})
    return {"ok": True, "kwh_charged": kwh, "cost": cost}

@router.get("/my-sessions")
async def my_sessions(request: Request):
    user = await get_current_user(request)
    sessions = await db.ev_sessions.find({"user_email":user.get("email","")},{"_id":0}).sort("started_at",-1).to_list(50)
    return {"sessions": sessions}
