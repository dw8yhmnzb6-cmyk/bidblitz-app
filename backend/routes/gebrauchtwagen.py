"""
BidBlitz V2 - Gebrauchtwagen-Marktplatz
Autos kaufen & verkaufen
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from core.database import db
from core.security import get_current_user
import secrets

router = APIRouter(prefix="/api/gebrauchtwagen", tags=["gebrauchtwagen"])

SEED = [
    {"car_id":"gw_001","title":"BMW 320d Touring M-Sport","brand":"BMW","model":"320d","year":2022,"mileage":45000,"price":32900,"fuel":"Diesel","transmission":"Automatik","power_hp":190,"color":"Schwarz","city":"München","description":"Scheckheftgepflegt, Leder, Navi, LED, Sitzheizung, Panoramadach. TÜV neu.","features":["Leder","Navigation","LED","Sitzheizung","Panoramadach","Rückfahrkamera"],"image":"https://images.unsplash.com/photo-1622015663319-e97e697503ee?w=800&q=80","seller":"AutoHaus Premium München","featured":True,"views":567},
    {"car_id":"gw_002","title":"VW Golf 8 GTI","brand":"VW","model":"Golf GTI","year":2023,"mileage":28000,"price":29500,"fuel":"Benzin","transmission":"DSG","power_hp":245,"color":"Rot","city":"Berlin","description":"1. Hand, Vollausstattung, Sport-Fahrwerk, Digital Cockpit, Beats Sound.","features":["Digital Cockpit","Sport-Fahrwerk","Beats Sound","ACC","Park Assist"],"image":"https://images.unsplash.com/photo-1774685110718-c5b4fe026144?w=800&q=80","seller":"AutoCenter Berlin","featured":True,"views":423},
    {"car_id":"gw_003","title":"Tesla Model 3 Long Range","brand":"Tesla","model":"Model 3","year":2023,"mileage":32000,"price":35900,"fuel":"Elektro","transmission":"Automatik","power_hp":325,"color":"Weiß","city":"Hamburg","description":"Autopilot, Reichweite 580km, Lederausstattung, Premium Connectivity.","features":["Autopilot","Glasdach","Premium Sound","Schnellladen","Weiß Interieur"],"image":"https://images.unsplash.com/photo-1772256019760-a144ae100cc4?w=800&q=80","seller":"E-Mobility Hamburg","featured":True,"views":891},
    {"car_id":"gw_004","title":"Mercedes C200 Limousine AMG-Line","brand":"Mercedes","model":"C200","year":2021,"mileage":62000,"price":28500,"fuel":"Benzin","transmission":"Automatik","power_hp":184,"color":"Silber","city":"Frankfurt","description":"AMG-Line, MBUX, 360°-Kamera, Multibeam LED, Burmester Sound.","features":["AMG-Line","MBUX","360° Kamera","Burmester","Multibeam LED"],"image":"https://images.unsplash.com/photo-1622015663381-d2e05ae91b72?w=800&q=80","seller":"Stern Auto Frankfurt","featured":False,"views":334},
    {"car_id":"gw_005","title":"Fiat 500e Elektro","brand":"Fiat","model":"500e","year":2024,"mileage":8000,"price":22900,"fuel":"Elektro","transmission":"Automatik","power_hp":118,"color":"Mintgrün","city":"Köln","description":"Fast wie neu! 320km Reichweite, Apple CarPlay, Panoramadach, Level 2 Assistenz.","features":["Apple CarPlay","Panoramadach","Level 2","Schnellladen"],"image":"https://images.unsplash.com/photo-1775138260921-883455954eb0?w=800&q=80","seller":"Privat — Claudia M.","featured":False,"views":198},
]

@router.on_event("startup")
async def seed():
    if await db.gebrauchtwagen.count_documents({}) == 0:
        now = datetime.now(timezone.utc).isoformat()
        for c in SEED:
            c["created_at"] = now
            c["status"] = "active"
        await db.gebrauchtwagen.insert_many(SEED)

@router.get("/listings")
async def list_cars(brand: Optional[str]=None, fuel: Optional[str]=None, min_price: Optional[float]=None, max_price: Optional[float]=None, search: Optional[str]=None):
    q = {"status":"active"}
    if brand: q["brand"] = brand
    if fuel: q["fuel"] = fuel
    if min_price: q.setdefault("price",{})["$gte"] = min_price
    if max_price: q.setdefault("price",{})["$lte"] = max_price
    if search: q["$or"] = [{"title":{"$regex":search,"$options":"i"}},{"brand":{"$regex":search,"$options":"i"}}]
    cars = await db.gebrauchtwagen.find(q, {"_id":0}).sort("featured",-1).to_list(100)
    return {"cars": cars, "total": len(cars)}

@router.get("/car/{car_id}")
async def get_car(car_id: str):
    c = await db.gebrauchtwagen.find_one({"car_id":car_id},{"_id":0})
    if not c: raise HTTPException(404, "Auto nicht gefunden")
    await db.gebrauchtwagen.update_one({"car_id":car_id},{"$inc":{"views":1}})
    return c

@router.get("/brands")
async def get_brands():
    brands = await db.gebrauchtwagen.distinct("brand")
    return {"brands": sorted(brands)}

class ContactReq(BaseModel):
    car_id: str
    message: str = ""
    phone: str = ""

@router.post("/contact")
async def contact_seller(req: ContactReq, request: Request):
    user = await get_current_user(request)
    contact = {
        "contact_id": secrets.token_hex(8), "car_id": req.car_id,
        "buyer_email": user.get("email",""), "buyer_name": user.get("name",""),
        "message": req.message, "phone": req.phone, "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.gebrauchtwagen_contacts.insert_one(contact)
    contact.pop("_id", None)
    return {"ok": True, "contact": contact}
