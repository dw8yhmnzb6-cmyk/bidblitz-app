"""
BidBlitz V2 - Realistische Daten fuer Taxi, Scooter, Hotels, Fluege, Mietwagen, Nearby
"""
import secrets
import random
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient
import os

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
client = MongoClient(MONGO_URL)
db = client[DB_NAME]

NOW = datetime.now(timezone.utc)
def ts(d=0, h=0): return (NOW - timedelta(days=d, hours=h)).isoformat()
def rid(): return secrets.token_hex(8)

print(f"DB: {DB_NAME}\n")

# ============================================================
# 1. TAXI DRIVERS (echte deutsche Staedte)
# ============================================================
TAXI_DRIVERS = [
    {"driver_id": f"drv_{rid()}", "name": "Mehmet Yilmaz", "phone": "+49 176 12345678", "vehicle": "Mercedes E-Klasse", "plate": "B-MY 2024", "city": "Berlin", "lat": 52.5200, "lng": 13.4050, "rating": 4.9, "rides_completed": 2847, "status": "online", "vehicle_type": "comfort", "photo": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80"},
    {"driver_id": f"drv_{rid()}", "name": "Thomas Mueller", "phone": "+49 176 23456789", "vehicle": "BMW 5er", "plate": "B-TM 1985", "city": "Berlin", "lat": 52.5170, "lng": 13.3889, "rating": 4.8, "rides_completed": 1523, "status": "online", "vehicle_type": "premium", "photo": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80"},
    {"driver_id": f"drv_{rid()}", "name": "Ahmed Hassan", "phone": "+49 176 34567890", "vehicle": "VW Passat", "plate": "B-AH 7788", "city": "Berlin", "lat": 52.5244, "lng": 13.4105, "rating": 4.7, "rides_completed": 945, "status": "online", "vehicle_type": "standard", "photo": "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&q=80"},
    {"driver_id": f"drv_{rid()}", "name": "Stefan Braun", "phone": "+49 176 45678901", "vehicle": "Tesla Model 3", "plate": "B-SB 2026", "city": "Berlin", "lat": 52.5127, "lng": 13.3260, "rating": 4.9, "rides_completed": 3201, "status": "online", "vehicle_type": "electric", "photo": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80"},
    {"driver_id": f"drv_{rid()}", "name": "Osman Demir", "phone": "+49 176 56789012", "vehicle": "Mercedes V-Klasse", "plate": "B-OD 5555", "city": "Berlin", "lat": 52.5080, "lng": 13.3756, "rating": 4.8, "rides_completed": 1876, "status": "online", "vehicle_type": "van", "photo": "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&q=80"},
    {"driver_id": f"drv_{rid()}", "name": "Klaus Weber", "phone": "+49 89 11223344", "vehicle": "Audi A6", "plate": "M-KW 4040", "city": "Muenchen", "lat": 48.1351, "lng": 11.5820, "rating": 4.9, "rides_completed": 4102, "status": "online", "vehicle_type": "premium", "photo": "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&q=80"},
    {"driver_id": f"drv_{rid()}", "name": "Fatih Kaya", "phone": "+49 89 22334455", "vehicle": "Toyota Camry Hybrid", "plate": "M-FK 8899", "city": "Muenchen", "lat": 48.1372, "lng": 11.5755, "rating": 4.7, "rides_completed": 1267, "status": "online", "vehicle_type": "eco", "photo": "https://images.unsplash.com/photo-1504257432389-52343af06ae3?w=200&q=80"},
    {"driver_id": f"drv_{rid()}", "name": "Lukas Schmidt", "phone": "+49 40 33445566", "vehicle": "VW ID.4", "plate": "HH-LS 2025", "city": "Hamburg", "lat": 53.5511, "lng": 9.9937, "rating": 4.8, "rides_completed": 2034, "status": "online", "vehicle_type": "electric", "photo": "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=200&q=80"},
    {"driver_id": f"drv_{rid()}", "name": "Ali Reza", "phone": "+49 221 44556677", "vehicle": "Mercedes C-Klasse", "plate": "K-AR 3030", "city": "Koeln", "lat": 50.9375, "lng": 6.9603, "rating": 4.6, "rides_completed": 890, "status": "offline", "vehicle_type": "comfort", "photo": "https://images.unsplash.com/photo-1552058544-f2b08422138a?w=200&q=80"},
    {"driver_id": f"drv_{rid()}", "name": "Hans Gruber", "phone": "+49 69 55667788", "vehicle": "BMW i4", "plate": "F-HG 7070", "city": "Frankfurt", "lat": 50.1109, "lng": 8.6821, "rating": 4.9, "rides_completed": 3567, "status": "online", "vehicle_type": "premium", "photo": "https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=200&q=80"},
]

for d in TAXI_DRIVERS:
    d["created_at"] = ts(random.randint(30, 365))
    d["earnings_total"] = round(random.uniform(8000, 45000), 2)
    d["acceptance_rate"] = round(random.uniform(0.85, 0.98), 2)

if db.taxi_drivers.count_documents({}) < 5:
    db.taxi_drivers.insert_many(TAXI_DRIVERS)
    print(f"[OK] {len(TAXI_DRIVERS)} Taxi-Fahrer")
else:
    print("[SKIP] Taxi-Fahrer vorhanden")

# ============================================================
# 2. SCOOTERS (echte Standorte in Berlin, Muenchen, Hamburg)
# ============================================================
existing_scooters = db.scooters.count_documents({})
if existing_scooters < 30:
    BERLIN_SPOTS = [(52.5200,13.4050),(52.5170,13.3889),(52.5244,13.4105),(52.5127,13.3260),(52.5080,13.3756),(52.5308,13.3847),(52.4862,13.3891),(52.5219,13.4133),(52.4971,13.4482),(52.5398,13.4053)]
    MUNICH_SPOTS = [(48.1351,11.5820),(48.1372,11.5755),(48.1496,11.5679),(48.1297,11.5561),(48.1418,11.5838)]
    HAMBURG_SPOTS = [(53.5511,9.9937),(53.5520,10.0004),(53.5563,9.9858),(53.5488,10.0072),(53.5460,9.9685)]

    new_scooters = []
    brands = ["TIER", "Lime", "Bolt", "Voi", "Bird"]
    for i, (lat, lng) in enumerate(BERLIN_SPOTS + MUNICH_SPOTS + HAMBURG_SPOTS):
        city = "Berlin" if i < 10 else ("Muenchen" if i < 15 else "Hamburg")
        brand = random.choice(brands)
        new_scooters.append({
            "scooter_id": f"SC-{brand[0]}{random.randint(1000,9999)}",
            "brand": brand,
            "model": f"{brand} G4" if brand != "Bird" else "Bird One",
            "city": city,
            "lat": lat + random.uniform(-0.003, 0.003),
            "lng": lng + random.uniform(-0.003, 0.003),
            "battery": random.randint(25, 100),
            "status": random.choice(["available", "available", "available", "in_use", "charging"]),
            "price_unlock": 1.00,
            "price_per_min": 0.25,
            "max_speed_kmh": 20,
            "range_km": round(random.uniform(8, 35), 1),
            "last_maintenance": ts(random.randint(1, 30)),
            "total_rides": random.randint(50, 800),
            "created_at": ts(random.randint(30, 180)),
        })
    db.scooters.delete_many({})
    db.scooters.insert_many(new_scooters)
    print(f"[OK] {len(new_scooters)} Scooters (Berlin/Muenchen/Hamburg)")
else:
    print(f"[SKIP] Scooters vorhanden ({existing_scooters})")

# ============================================================
# 3. HOTELS (echte deutsche Hotels)
# ============================================================
HOTELS = [
    {"property_id": f"htl_{rid()}", "name": "Hotel Adlon Kempinski", "city": "Berlin", "address": "Unter den Linden 77, 10117 Berlin", "type": "luxury", "stars": 5, "price_per_night": 389, "description": "Legendaeres Luxushotel am Brandenburger Tor. Spa, Michelin-Restaurant, Butler-Service.", "amenities": ["Spa", "Pool", "Restaurant", "Bar", "Fitness", "Concierge", "Valet Parking"], "rating": 4.9, "reviews_count": 2847, "rooms_total": 382, "rooms_available": 12, "lat": 52.5163, "lng": 13.3810, "images": ["https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&q=80"], "host_email": "admin@bidblitz.com"},
    {"property_id": f"htl_{rid()}", "name": "25hours Hotel Bikini Berlin", "city": "Berlin", "address": "Budapester Str. 40, 10787 Berlin", "type": "boutique", "stars": 4, "price_per_night": 149, "description": "Stylishes Designhotel mit Blick auf den Berliner Zoo. Rooftop Bar, Sauna, Monkey Bar.", "amenities": ["Bar", "Sauna", "Restaurant", "Fitness", "Fahrradverleih"], "rating": 4.6, "reviews_count": 1523, "rooms_total": 149, "rooms_available": 8, "lat": 52.5072, "lng": 13.3416, "images": ["https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=600&q=80"], "host_email": "admin@bidblitz.com"},
    {"property_id": f"htl_{rid()}", "name": "Motel One Alexanderplatz", "city": "Berlin", "address": "Grunerstr. 12, 10179 Berlin", "type": "budget", "stars": 3, "price_per_night": 79, "description": "Modernes Budget-Design-Hotel. Zentrale Lage direkt am Alex. One Lounge mit Cocktails.", "amenities": ["Bar", "Fruehstueck", "WLAN"], "rating": 4.4, "reviews_count": 4521, "rooms_total": 414, "rooms_available": 23, "lat": 52.5219, "lng": 13.4133, "images": ["https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=600&q=80"], "host_email": "admin@bidblitz.com"},
    {"property_id": f"htl_{rid()}", "name": "Bayerischer Hof Muenchen", "city": "Muenchen", "address": "Promenadeplatz 2-6, 80333 Muenchen", "type": "luxury", "stars": 5, "price_per_night": 450, "description": "Traditionsreiches Grandhotel seit 1841. Blue Spa, 5 Restaurants, Kino, Nachtclub.", "amenities": ["Spa", "Pool", "5 Restaurants", "Kino", "Nachtclub", "Fitness"], "rating": 4.8, "reviews_count": 1876, "rooms_total": 337, "rooms_available": 6, "lat": 48.1401, "lng": 11.5740, "images": ["https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=600&q=80"], "host_email": "admin@bidblitz.com"},
    {"property_id": f"htl_{rid()}", "name": "EAST Hotel Hamburg", "city": "Hamburg", "address": "Simon-von-Utrecht-Str. 31, 20359 Hamburg", "type": "boutique", "stars": 4, "price_per_night": 139, "description": "Trendiges Hotel auf St. Pauli. Industrial Design, Yakshi's Rooftop Bar, Naehe Reeperbahn.", "amenities": ["Bar", "Restaurant", "Fitness", "Event-Raeume"], "rating": 4.5, "reviews_count": 987, "rooms_total": 128, "rooms_available": 11, "lat": 53.5488, "lng": 9.9628, "images": ["https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=600&q=80"], "host_email": "admin@bidblitz.com"},
    {"property_id": f"htl_{rid()}", "name": "Steigenberger Frankfurter Hof", "city": "Frankfurt", "address": "Am Kaiserplatz, 60311 Frankfurt", "type": "luxury", "stars": 5, "price_per_night": 320, "description": "Historisches Grandhotel im Herzen Frankfurts. Seit 1876. Oscar's Restaurant, Spa.", "amenities": ["Spa", "Restaurant", "Bar", "Fitness", "Concierge"], "rating": 4.7, "reviews_count": 1234, "rooms_total": 261, "rooms_available": 9, "lat": 50.1109, "lng": 8.6750, "images": ["https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=600&q=80"], "host_email": "admin@bidblitz.com"},
    {"property_id": f"htl_{rid()}", "name": "a&o Hostel Koeln Neumarkt", "city": "Koeln", "address": "Caecilientsr. 32, 50667 Koeln", "type": "hostel", "stars": 2, "price_per_night": 29, "description": "Guenstiges Hostel direkt am Neumarkt. Dorm & Private Rooms. Naehe Dom & Altstadt.", "amenities": ["WLAN", "Waschmaschine", "Gemeinschaftskueche", "Bar"], "rating": 4.1, "reviews_count": 3456, "rooms_total": 160, "rooms_available": 35, "lat": 50.9343, "lng": 6.9493, "images": ["https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=600&q=80"], "host_email": "admin@bidblitz.com"},
    {"property_id": f"htl_{rid()}", "name": "Schlosshotel Kronberg", "city": "Frankfurt", "address": "Hainstr. 25, 61476 Kronberg", "type": "castle", "stars": 5, "price_per_night": 520, "description": "Maerchenhaftes Schlosshotel im Taunus. 18-Loch Golfplatz, Park, Fine Dining.", "amenities": ["Golf", "Spa", "Park", "Restaurant", "Tennis"], "rating": 4.9, "reviews_count": 567, "rooms_total": 62, "rooms_available": 3, "lat": 50.1830, "lng": 8.5150, "images": ["https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=600&q=80"], "host_email": "admin@bidblitz.com"},
]

for h in HOTELS:
    h["created_at"] = ts(random.randint(30, 365))
    h["status"] = "active"

if db.hotels.count_documents({}) < 3:
    db.hotels.insert_many(HOTELS)
    print(f"[OK] {len(HOTELS)} Hotels")
else:
    print("[SKIP] Hotels vorhanden")

# ============================================================
# 4. FLIGHTS (echte Routen)
# ============================================================
AIRPORTS = {"BER": "Berlin", "MUC": "Muenchen", "FRA": "Frankfurt", "HAM": "Hamburg", "DUS": "Duesseldorf", "CGN": "Koeln/Bonn", "STR": "Stuttgart", "PMI": "Mallorca", "AYT": "Antalya", "IST": "Istanbul", "BCN": "Barcelona", "LHR": "London", "CDG": "Paris", "FCO": "Rom", "ATH": "Athen", "DXB": "Dubai"}
AIRLINES = ["Lufthansa", "Eurowings", "Ryanair", "easyJet", "Turkish Airlines", "SunExpress", "Condor", "Wizz Air"]

new_flights = []
ROUTES = [
    ("BER","PMI",149), ("BER","AYT",189), ("BER","IST",159), ("BER","BCN",99), ("BER","LHR",79),
    ("FRA","DXB",399), ("FRA","IST",179), ("FRA","CDG",89), ("FRA","FCO",119), ("FRA","ATH",139),
    ("MUC","PMI",129), ("MUC","AYT",169), ("MUC","BCN",109), ("MUC","LHR",99), ("MUC","FCO",99),
    ("HAM","PMI",139), ("HAM","AYT",199), ("HAM","LHR",69), ("DUS","IST",149), ("DUS","PMI",119),
    ("BER","MUC",59), ("BER","FRA",49), ("HAM","MUC",69), ("CGN","BER",55), ("STR","BER",59),
]

for origin, dest, base_price in ROUTES:
    for day_offset in range(1, 8):
        dep_date = (NOW + timedelta(days=day_offset + random.randint(0, 21))).strftime("%Y-%m-%d")
        dep_time = f"{random.randint(6,21):02d}:{random.choice(['00','15','30','45'])}"
        duration_h = random.randint(1, 5)
        duration_m = random.choice([0, 15, 30, 45])
        price = base_price + random.randint(-30, 80)
        new_flights.append({
            "flight_id": f"FL-{rid()[:6].upper()}",
            "airline": random.choice(AIRLINES),
            "flight_number": f"{random.choice(['LH','EW','FR','U2','TK','XQ','DE','W6'])}{random.randint(100,9999)}",
            "origin": origin, "origin_city": AIRPORTS[origin],
            "destination": dest, "destination_city": AIRPORTS[dest],
            "departure_date": dep_date,
            "departure_time": dep_time,
            "arrival_time": f"{(int(dep_time[:2])+duration_h)%24:02d}:{duration_m:02d}",
            "duration_min": duration_h * 60 + duration_m,
            "price_economy": max(29, price),
            "price_business": max(29, price) * 3,
            "seats_available": random.randint(2, 45),
            "stops": 0 if duration_h <= 3 else random.choice([0, 1]),
            "aircraft": random.choice(["A320", "A321", "B737-800", "B737 MAX", "A330", "A350"]),
            "baggage_included": random.choice([True, True, False]),
            "status": "scheduled",
            "created_at": ts(1),
        })

existing_flights = db.flights.count_documents({})
if existing_flights < 50:
    db.flights.delete_many({})
    db.flights.insert_many(new_flights)
    print(f"[OK] {len(new_flights)} Fluege ({len(ROUTES)} Routen)")
else:
    print(f"[SKIP] Fluege vorhanden ({existing_flights})")

# ============================================================
# 5. CAR RENTALS (Mietwagen)
# ============================================================
CARS = [
    {"car_id": f"car_{rid()}", "brand": "BMW", "model": "3er Touring", "year": 2025, "type": "kombi", "transmission": "automatik", "fuel": "diesel", "seats": 5, "price_per_day": 69, "city": "Berlin", "vendor_name": "BlitzRent Berlin", "images": ["https://images.unsplash.com/photo-1555215695-3004980ad54e?w=600&q=80"], "features": ["Navigation", "Klimaautomatik", "Rueckfahrkamera", "Apple CarPlay"], "mileage_included": 300, "extra_km_price": 0.25},
    {"car_id": f"car_{rid()}", "brand": "VW", "model": "Golf 8", "year": 2025, "type": "kompakt", "transmission": "automatik", "fuel": "benzin", "seats": 5, "price_per_day": 45, "city": "Berlin", "vendor_name": "BlitzRent Berlin", "images": ["https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=600&q=80"], "features": ["Navigation", "Klimaanlage", "Bluetooth"], "mileage_included": 200, "extra_km_price": 0.20},
    {"car_id": f"car_{rid()}", "brand": "Mercedes", "model": "C-Klasse", "year": 2026, "type": "limousine", "transmission": "automatik", "fuel": "hybrid", "seats": 5, "price_per_day": 89, "city": "Muenchen", "vendor_name": "Premium Cars Muenchen", "images": ["https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=600&q=80"], "features": ["Lederausstattung", "Sitzheizung", "360-Kamera", "Ambientebeleuchtung"], "mileage_included": 300, "extra_km_price": 0.30},
    {"car_id": f"car_{rid()}", "brand": "Tesla", "model": "Model Y", "year": 2025, "type": "suv", "transmission": "automatik", "fuel": "elektro", "seats": 5, "price_per_day": 99, "city": "Berlin", "vendor_name": "E-Mobility Berlin", "images": ["https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=600&q=80"], "features": ["Autopilot", "Supercharger Zugang", "Panoramadach", "15\" Touchscreen"], "mileage_included": 500, "extra_km_price": 0},
    {"car_id": f"car_{rid()}", "brand": "Fiat", "model": "500e", "year": 2025, "type": "kleinwagen", "transmission": "automatik", "fuel": "elektro", "seats": 4, "price_per_day": 35, "city": "Hamburg", "vendor_name": "CityRent Hamburg", "images": ["https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=600&q=80"], "features": ["Navigation", "Klimaanlage", "Einparkhilfe"], "mileage_included": 150, "extra_km_price": 0.15},
    {"car_id": f"car_{rid()}", "brand": "Porsche", "model": "911 Carrera", "year": 2025, "type": "sportwagen", "transmission": "automatik", "fuel": "benzin", "seats": 2, "price_per_day": 299, "city": "Muenchen", "vendor_name": "Prestige Cars", "images": ["https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600&q=80"], "features": ["Sport Chrono", "BOSE Sound", "Sport Abgasanlage", "Keramikbremsen"], "mileage_included": 200, "extra_km_price": 0.50},
    {"car_id": f"car_{rid()}", "brand": "VW", "model": "Transporter T7", "year": 2025, "type": "transporter", "transmission": "automatik", "fuel": "diesel", "seats": 9, "price_per_day": 79, "city": "Koeln", "vendor_name": "Van4You Koeln", "images": ["https://images.unsplash.com/photo-1549317661-bd32c8ce0afa?w=600&q=80"], "features": ["9 Sitze", "Klimaanlage", "Rueckfahrkamera", "Anhaengerkupplung"], "mileage_included": 300, "extra_km_price": 0.20},
    {"car_id": f"car_{rid()}", "brand": "Audi", "model": "e-tron GT", "year": 2026, "type": "limousine", "transmission": "automatik", "fuel": "elektro", "seats": 5, "price_per_day": 179, "city": "Frankfurt", "vendor_name": "LuxDrive Frankfurt", "images": ["https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=600&q=80"], "features": ["Matrix LED", "Bang & Olufsen", "Luftfederung", "Head-Up Display"], "mileage_included": 400, "extra_km_price": 0},
]

for c in CARS:
    c["status"] = "available"
    c["rating"] = round(random.uniform(4.3, 5.0), 1)
    c["bookings_count"] = random.randint(10, 200)
    c["insurance_included"] = True
    c["min_age"] = 21 if c["type"] == "sportwagen" else 18
    c["deposit"] = c["price_per_day"] * 3
    c["created_at"] = ts(random.randint(10, 120))
    c["vendor_id"] = f"vnd_{rid()}"

if db.car_rentals.count_documents({}) < 3:
    db.car_rentals.insert_many(CARS)
    print(f"[OK] {len(CARS)} Mietwagen")
else:
    print("[SKIP] Mietwagen vorhanden")

# ============================================================
# 6. NEARBY PLACES
# ============================================================
NEARBY = [
    {"place_id": f"np_{rid()}", "name": "Rossmann", "category": "drogerie", "lat": 52.5205, "lng": 13.4070, "city": "Berlin", "address": "Alexanderplatz 3", "rating": 4.2, "open_now": True, "opening_hours": "08:00-21:00", "distance_m": 120},
    {"place_id": f"np_{rid()}", "name": "REWE City", "category": "supermarkt", "lat": 52.5195, "lng": 13.4085, "city": "Berlin", "address": "Karl-Liebknecht-Str. 11", "rating": 4.0, "open_now": True, "opening_hours": "07:00-22:00", "distance_m": 250},
    {"place_id": f"np_{rid()}", "name": "Deutsche Bank Filiale", "category": "bank", "lat": 52.5180, "lng": 13.4020, "city": "Berlin", "address": "Unter den Linden 13", "rating": 3.8, "open_now": True, "opening_hours": "09:00-16:00", "distance_m": 400},
    {"place_id": f"np_{rid()}", "name": "dm-drogerie markt", "category": "drogerie", "lat": 52.5210, "lng": 13.4110, "city": "Berlin", "address": "Alexanderstr. 5", "rating": 4.3, "open_now": True, "opening_hours": "08:00-20:00", "distance_m": 180},
    {"place_id": f"np_{rid()}", "name": "Aral Tankstelle", "category": "tankstelle", "lat": 52.5160, "lng": 13.3950, "city": "Berlin", "address": "Friedrichstr. 100", "rating": 3.9, "open_now": True, "opening_hours": "24h", "distance_m": 600},
    {"place_id": f"np_{rid()}", "name": "Apotheke am Alex", "category": "apotheke", "lat": 52.5215, "lng": 13.4125, "city": "Berlin", "address": "Alexanderplatz 7", "rating": 4.5, "open_now": True, "opening_hours": "08:00-20:00", "distance_m": 90},
    {"place_id": f"np_{rid()}", "name": "Commerzbank", "category": "bank", "lat": 52.5170, "lng": 13.3890, "city": "Berlin", "address": "Potsdamer Platz 1", "rating": 3.7, "open_now": False, "opening_hours": "09:00-16:00", "distance_m": 800},
    {"place_id": f"np_{rid()}", "name": "Shell Ladestation", "category": "ladestation", "lat": 52.5140, "lng": 13.3800, "city": "Berlin", "address": "Potsdamer Str. 50", "rating": 4.1, "open_now": True, "opening_hours": "24h", "distance_m": 950},
    {"place_id": f"np_{rid()}", "name": "Lidl", "category": "supermarkt", "lat": 52.5230, "lng": 13.4000, "city": "Berlin", "address": "Torstr. 89", "rating": 4.0, "open_now": True, "opening_hours": "07:00-22:00", "distance_m": 450},
    {"place_id": f"np_{rid()}", "name": "McFit Fitness", "category": "fitness", "lat": 52.5190, "lng": 13.4150, "city": "Berlin", "address": "Karl-Marx-Allee 33", "rating": 4.2, "open_now": True, "opening_hours": "00:00-24:00", "distance_m": 350},
]

for p in NEARBY:
    p["created_at"] = ts(0)

if db.nearby_places.count_documents({}) < 5:
    db.nearby_places.insert_many(NEARBY)
    print(f"[OK] {len(NEARBY)} Nearby Places")
else:
    print("[SKIP] Nearby Places vorhanden")

# ============================================================
# SUMMARY
# ============================================================
print(f"\nFertig!")
print(f"  Taxi-Fahrer: {db.taxi_drivers.count_documents({})}")
print(f"  Scooters: {db.scooters.count_documents({})}")
print(f"  Hotels: {db.hotels.count_documents({})}")
print(f"  Fluege: {db.flights.count_documents({})}")
print(f"  Mietwagen: {db.car_rentals.count_documents({})}")
print(f"  Nearby: {db.nearby_places.count_documents({})}")
