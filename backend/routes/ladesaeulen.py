"""
BidBlitz V2 - Ladesäulen-Finder (EV Charging)
E-Ladestationen finden, Laden starten, Bezahlen
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from core.database import db
from core.config import TEST_MODE
from core.security import get_current_user
from core.legacy_ev_wallet import start_legacy_ev_session, stop_legacy_ev_session
import secrets, random

router = APIRouter(prefix="/api/ladesaeulen", tags=["ladesaeulen"])

SEED = [
    {"station_id":"ev_001","name":"Schnelllader Alexanderplatz","operator":"EnBW","type":"DC","power_kw":150,"connectors":["CCS","CHAdeMO"],"price_per_kwh":0.49,"address":"Alexanderplatz 3, 10178 Berlin","city":"Berlin","lat":52.5219,"lng":13.4132,"status":"available","slots_total":4,"slots_available":3,"rating":4.7,"reviews":89,"features":["Überdacht","24/7","Karte/App","Café nebenan"],"image":"https://images.unsplash.com/photo-1692052664566-477579a08e8c?w=800&q=80"},
    {"station_id":"ev_002","name":"Tesla Supercharger Stachus","operator":"Tesla","type":"DC","power_kw":250,"connectors":["Tesla","CCS"],"price_per_kwh":0.45,"address":"Karlsplatz 1, 80335 München","city":"München","lat":48.1394,"lng":11.5653,"status":"available","slots_total":8,"slots_available":5,"rating":4.9,"reviews":234,"features":["250kW","24/7","Lounge","Toilette"],"image":"https://images.unsplash.com/photo-1672542128826-5f0d578713d2?w=800&q=80"},
    {"station_id":"ev_003","name":"Stadtwerke Ladepark Hafen","operator":"Stadtwerke Hamburg","type":"DC","power_kw":100,"connectors":["CCS","Typ 2"],"price_per_kwh":0.39,"address":"Am Sandtorkai 50, 20457 Hamburg","city":"Hamburg","lat":53.5432,"lng":9.9876,"status":"available","slots_total":6,"slots_available":4,"rating":4.6,"reviews":156,"features":["Ökostrom","Parkhaus","Shopping","Barrierefrei"],"image":"https://images.unsplash.com/photo-1692052626528-cb97a934a63b?w=800"},
    {"station_id":"ev_004","name":"IONITY Autobahn A3","operator":"IONITY","type":"HPC","power_kw":350,"connectors":["CCS"],"price_per_kwh":0.79,"address":"Raststätte Fernthal, A3","city":"Neustadt/Wied","lat":50.5912,"lng":7.4123,"status":"available","slots_total":6,"slots_available":6,"rating":4.5,"reviews":67,"features":["350kW HPC","24/7","Raststätte","WC"],"image":"https://images.unsplash.com/photo-1672542128827-ccbb7b8b8099?w=800&q=80"},
    {"station_id":"ev_005","name":"AC Wallbox Parkhaus City","operator":"Allego","type":"AC","power_kw":22,"connectors":["Typ 2"],"price_per_kwh":0.35,"address":"Zeil 112, 60313 Frankfurt","city":"Frankfurt","lat":50.1145,"lng":8.6823,"status":"occupied","slots_total":10,"slots_available":2,"rating":4.4,"reviews":112,"features":["Günstig","Parkhaus","Shopping","Überdacht"],"image":"https://images.pexels.com/photos/32472665/pexels-photo-32472665.jpeg?w=800"},
    {"station_id":"ev_006","name":"Schnelllader Mediapark","operator":"E.ON","type":"DC","power_kw":150,"connectors":["CCS","CHAdeMO"],"price_per_kwh":0.44,"address":"Mediapark 5, 50670 Köln","city":"Köln","lat":50.9498,"lng":6.9432,"status":"available","slots_total":4,"slots_available":4,"rating":4.8,"reviews":78,"features":["150kW","Überdacht","App-Bezahlung","Café"],"image":"https://images.pexels.com/photos/5391511/pexels-photo-5391511.jpeg?w=800"},
]

@router.on_event("startup")
async def seed():
    # The static catalog is test/demo data only.
    if not TEST_MODE:
        return
    if await db.ev_stations.count_documents({}) == 0:
        now = datetime.now(timezone.utc).isoformat()
        rows = []
        for source in SEED:
            s = dict(source)
            s["created_at"] = now
            s["total_sessions"] = random.randint(500, 5000)
            s["is_demo"] = True
            rows.append(s)
        await db.ev_stations.insert_many(rows)


async def _live_station_doc(cp: dict) -> dict:
    from routes.ev_charging import _cp_is_online, _cp_protocol, _load_tariff

    charge_point_id = cp["charge_point_id"]
    connectors = await db.ev_connectors.find(
        {"charge_point_id": charge_point_id},
        {"_id": 0},
    ).sort("connector_id", 1).to_list(50)
    tariff = await _load_tariff(cp.get("tariff_id"))
    location = cp.get("location") or {}
    online = _cp_is_online(charge_point_id, _cp_protocol(cp))
    available_connectors = [
        row for row in connectors
        if row.get("status") in (None, "Available", "Preparing")
    ]
    connector_types = sorted({
        str(row.get("type") or row.get("connector_type") or "Type 2")
        for row in connectors
    })
    max_power = max(
        [float(row.get("max_power_kw") or 0) for row in connectors] or [0.0]
    )
    if max_power >= 150:
        station_type = "HPC"
    elif max_power > 22:
        station_type = "DC"
    else:
        station_type = "AC"

    return {
        "station_id": charge_point_id,
        "charge_point_id": charge_point_id,
        "name": cp.get("name") or charge_point_id,
        "operator": cp.get("operator_name") or cp.get("operator") or "BidBlitz EV",
        "type": station_type,
        "power_kw": max_power,
        "connectors": connector_types,
        "available_connector_id": (
            int(available_connectors[0].get("connector_id"))
            if available_connectors else None
        ),
        "price_per_kwh": float((tariff or {}).get("price_per_kwh") or 0),
        "address": location.get("address") or "",
        "city": location.get("city") or "",
        "country": location.get("country") or "",
        "lat": location.get("lat"),
        "lng": location.get("lng"),
        "status": "available" if online and available_connectors else ("occupied" if online else "offline"),
        "slots_total": len(connectors),
        "slots_available": len(available_connectors) if online else 0,
        "rating": float(cp.get("rating") or 0),
        "reviews": int(cp.get("reviews") or 0),
        "features": [f"OCPP {_cp_protocol(cp)}", "BidBlitz Wallet"],
        "online": online,
        "live_ocpp": True,
        "protocol": _cp_protocol(cp),
    }

@router.get("/stations")
async def list_stations(
    city: Optional[str] = None,
    type: Optional[str] = None,
    connector: Optional[str] = None,
    available_only: bool = False,
):
    if TEST_MODE:
        q = {}
        if city:
            q["city"] = {"$regex": city, "$options": "i"}
        if type:
            q["type"] = type
        if connector:
            q["connectors"] = connector
        if available_only:
            q["slots_available"] = {"$gt": 0}
        stations = await db.ev_stations.find(q, {"_id": 0}).sort("rating", -1).to_list(100)
        return {"stations": stations, "total": len(stations), "mode": "test_demo"}

    query = {"active": True}
    if city:
        query["location.city"] = {"$regex": city, "$options": "i"}
    cps = await db.ev_charge_points.find(query, {"_id": 0, "ocpp_auth_hash": 0}).to_list(500)
    stations = []
    for cp in cps:
        station = await _live_station_doc(cp)
        if type and station["type"] != type:
            continue
        if connector and connector not in station["connectors"]:
            continue
        if available_only and station["slots_available"] < 1:
            continue
        stations.append(station)
    stations.sort(key=lambda row: (not row["online"], -row["slots_available"], row["name"]))
    return {"stations": stations, "total": len(stations), "mode": "live_ocpp"}

@router.get("/station/{station_id}")
async def get_station(station_id: str):
    if TEST_MODE:
        station = await db.ev_stations.find_one({"station_id": station_id}, {"_id": 0})
        if not station:
            raise HTTPException(404, "Station nicht gefunden")
        return station

    cp = await db.ev_charge_points.find_one(
        {"charge_point_id": station_id, "active": True},
        {"_id": 0, "ocpp_auth_hash": 0},
    )
    if not cp:
        raise HTTPException(404, "Station nicht gefunden")
    return await _live_station_doc(cp)

@router.get("/stats")
async def get_stats():
    if TEST_MODE:
        total = await db.ev_stations.count_documents({})
        available = await db.ev_stations.count_documents({"slots_available": {"$gt": 0}})
        cities = await db.ev_stations.distinct("city")
        return {"total_stations": total, "available": available, "cities": len(cities), "mode": "test_demo"}

    cps = await db.ev_charge_points.find({"active": True}, {"_id": 0, "location.city": 1, "charge_point_id": 1}).to_list(500)
    live = [await _live_station_doc(cp) for cp in cps]
    return {
        "total_stations": len(live),
        "available": len([s for s in live if s["slots_available"] > 0]),
        "cities": len({s["city"] for s in live if s["city"]}),
        "mode": "live_ocpp",
    }

class StartChargingReq(BaseModel):
    station_id: str
    connector: str = "CCS"
    vehicle: str = ""
    unlock_code: str = ""
    idempotency_key: str = ""


@router.post("/unlock")
async def unlock_station(req: StartChargingReq, request: Request):
    """Legacy demo unlock. Production uses /api/ev/start."""
    if not TEST_MODE:
        raise HTTPException(status_code=410, detail="Legacy-Freischaltung ist deaktiviert. Nutze den OCPP-Live-Start.")
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
    if not TEST_MODE:
        raise HTTPException(status_code=410, detail="Legacy-Ladevorgang ist deaktiviert. Nutze /api/ev/start.")
    return await start_legacy_ev_session(req, request)

class StopChargingReq(BaseModel):
    session_id: str
    idempotency_key: str = ""


@router.post("/stop")
async def stop_charging(req: StopChargingReq, request: Request):
    if not TEST_MODE:
        raise HTTPException(status_code=410, detail="Legacy-Ladevorgang ist deaktiviert. Nutze /api/ev/stop/{session_id}.")
    return await stop_legacy_ev_session(req, request)

@router.get("/my-sessions")
async def my_sessions(request: Request):
    user = await get_current_user(request)
    if TEST_MODE:
        sessions = await db.ev_sessions.find(
            {"user_email": user.get("email", "")}, {"_id": 0}
        ).sort("started_at", -1).to_list(50)
        return {"sessions": sessions, "mode": "test_demo"}

    sessions = await db.ev_charging_sessions.find(
        {
            "user_id": str(user["_id"]),
            "status": {"$in": ["completed", "cancelled", "failed", "settle_failed"]},
        },
        {"_id": 0},
    ).sort("created_at", -1).to_list(50)
    return {"sessions": sessions, "mode": "live_ocpp"}

@router.get("/active-session")
async def get_active_session(request: Request):
    """Return the active test session or canonical live OCPP session."""
    user = await get_current_user(request)
    if TEST_MODE:
        session = await db.ev_sessions.find_one(
            {"user_email": user.get("email", ""), "status": "charging"},
            {"_id": 0},
        )
        return {"session": session, "mode": "test_demo"}

    session = await db.ev_charging_sessions.find_one(
        {
            "user_id": str(user["_id"]),
            "status": {"$in": ["authorized", "starting", "active", "stopping", "settle_failed"]},
        },
        {"_id": 0},
        sort=[("created_at", -1)],
    )
    return {"session": session, "mode": "live_ocpp"}
