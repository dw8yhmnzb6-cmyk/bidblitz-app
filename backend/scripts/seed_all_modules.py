"""
BidBlitz V2 - Umfassendes Seed-Script fuer alle neuen Module
Fuegt realistische deutsche Dummy-Daten in die Datenbank ein.
Kann lokal oder gegen Produktion (Atlas) laufen.

Usage:
  python seed_all_modules.py                          # Lokal
  MONGO_URL="mongodb+srv://..." python seed_all_modules.py  # Produktion
"""
import os
import sys
import secrets
import random
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

client = MongoClient(MONGO_URL)
db = client[DB_NAME]

NOW = datetime.now(timezone.utc)
def ts(days_ago=0, hours_ago=0):
    return (NOW - timedelta(days=days_ago, hours=hours_ago)).isoformat()

def rid():
    return secrets.token_hex(8)

print(f"Verbinde mit: {MONGO_URL}")
print(f"Datenbank: {DB_NAME}")
print(f"Starte Seeding...\n")

# ============================================================
# 1. RESTAURANTS (Reservierungssystem)
# ============================================================
RESTAURANTS_SEED = [
    {"restaurant_id": f"rest_{rid()}", "name": "Trattoria Bella Napoli", "cuisine": "italian", "city": "Berlin", "address": "Friedrichstr. 112, 10117 Berlin", "description": "Authentische neapolitanische Kueche mit handgemachter Pasta und Holzofenpizza.", "price_range": "mid", "capacity": 55, "opening_hours": "12:00-23:00", "phone": "+49 30 1234567", "rating": 4.8, "reviews_count": 342, "reservations_count": 0, "status": "active", "images": ["https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80"], "created_at": ts(90)},
    {"restaurant_id": f"rest_{rid()}", "name": "Sakura Japanese Fine Dining", "cuisine": "japanese", "city": "Berlin", "address": "Kantstr. 45, 10625 Berlin", "description": "Premium Sushi & Ramen. Omakase-Menue ab 89 EUR.", "price_range": "fine", "capacity": 30, "opening_hours": "17:00-23:00", "phone": "+49 30 2345678", "rating": 4.9, "reviews_count": 187, "reservations_count": 0, "status": "active", "images": ["https://images.unsplash.com/photo-1579027989536-b7b1f875659b?w=800&q=80"], "created_at": ts(85)},
    {"restaurant_id": f"rest_{rid()}", "name": "Kebab Sultan Palast", "cuisine": "turkish", "city": "Berlin", "address": "Kottbusser Damm 12, 10967 Berlin", "description": "Traditionelle tuerkische Kueche. Iskender Kebab, Lahmacun & Baklava.", "price_range": "budget", "capacity": 65, "opening_hours": "11:00-01:00", "phone": "+49 30 3456789", "rating": 4.6, "reviews_count": 523, "reservations_count": 0, "status": "active", "images": ["https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=800&q=80"], "created_at": ts(120)},
    {"restaurant_id": f"rest_{rid()}", "name": "Bayerischer Hof", "cuisine": "german", "city": "Muenchen", "address": "Marienplatz 8, 80331 Muenchen", "description": "Bayerische Spezialitaeten: Schweinshaxe, Weisswurst & Brezen. Biergarten vorhanden.", "price_range": "mid", "capacity": 120, "opening_hours": "10:00-23:30", "phone": "+49 89 4567890", "rating": 4.7, "reviews_count": 891, "reservations_count": 0, "status": "active", "images": ["https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80"], "created_at": ts(200)},
    {"restaurant_id": f"rest_{rid()}", "name": "Taj Mahal Palace", "cuisine": "indian", "city": "Hamburg", "address": "Reeperbahn 65, 20359 Hamburg", "description": "Authentisch indisch: Butter Chicken, Tikka Masala, Naan aus dem Tandoor.", "price_range": "mid", "capacity": 45, "opening_hours": "11:30-22:30", "phone": "+49 40 5678901", "rating": 4.5, "reviews_count": 267, "reservations_count": 0, "status": "active", "images": ["https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80"], "created_at": ts(150)},
    {"restaurant_id": f"rest_{rid()}", "name": "El Fuego Taqueria", "cuisine": "mexican", "city": "Koeln", "address": "Ehrenstr. 33, 50672 Koeln", "description": "Mexikanisches Streetfood: Tacos, Burritos, Quesadillas. Margarita Happy Hour 17-19 Uhr.", "price_range": "budget", "capacity": 40, "opening_hours": "12:00-00:00", "phone": "+49 221 6789012", "rating": 4.4, "reviews_count": 198, "reservations_count": 0, "status": "active", "images": ["https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=800&q=80"], "created_at": ts(100)},
    {"restaurant_id": f"rest_{rid()}", "name": "Le Petit Paris", "cuisine": "french", "city": "Frankfurt", "address": "Neue Mainzer Str. 22, 60311 Frankfurt", "description": "Franzoesische Haute Cuisine. 5-Gaenge-Menue ab 129 EUR. Sommelier-Service.", "price_range": "fine", "capacity": 25, "opening_hours": "18:00-23:00", "phone": "+49 69 7890123", "rating": 4.9, "reviews_count": 134, "reservations_count": 0, "status": "active", "images": ["https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80"], "created_at": ts(75)},
    {"restaurant_id": f"rest_{rid()}", "name": "Golden Dragon", "cuisine": "asian", "city": "Berlin", "address": "Alexanderplatz 5, 10178 Berlin", "description": "Dim Sum, Peking-Ente & Szechuan-Gerichte. All-you-can-eat Mittagsbuffet 12.99 EUR.", "price_range": "budget", "capacity": 80, "opening_hours": "11:00-23:00", "phone": "+49 30 8901234", "rating": 4.3, "reviews_count": 445, "reservations_count": 0, "status": "active", "images": ["https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&q=80"], "created_at": ts(180)},
    {"restaurant_id": f"rest_{rid()}", "name": "Osteria Mediterranea", "cuisine": "mediterranean", "city": "Stuttgart", "address": "Koenigstr. 70, 70173 Stuttgart", "description": "Mediterrane Kueche: Griechisch, Spanisch, Italienisch. Tapas-Abend jeden Donnerstag.", "price_range": "mid", "capacity": 50, "opening_hours": "11:30-22:00", "phone": "+49 711 9012345", "rating": 4.6, "reviews_count": 312, "reservations_count": 0, "status": "active", "images": ["https://images.unsplash.com/photo-1544148103-0773bf10d330?w=800&q=80"], "created_at": ts(60)},
    {"restaurant_id": f"rest_{rid()}", "name": "Stars & Stripes Diner", "cuisine": "american", "city": "Duesseldorf", "address": "Altstadt 18, 40213 Duesseldorf", "description": "American Style: Smash Burgers, BBQ Ribs, Milkshakes. Retro 50s Ambiente.", "price_range": "mid", "capacity": 60, "opening_hours": "12:00-23:00", "phone": "+49 211 0123456", "rating": 4.5, "reviews_count": 278, "reservations_count": 0, "status": "active", "images": ["https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=800&q=80"], "created_at": ts(45)},
    {"restaurant_id": f"rest_{rid()}", "name": "Pho Saigon", "cuisine": "asian", "city": "Muenchen", "address": "Leopoldstr. 88, 80802 Muenchen", "description": "Vietnamesische Kueche: Pho, Banh Mi, Sommerrollen. Frisch & leicht.", "price_range": "budget", "capacity": 35, "opening_hours": "11:00-21:30", "phone": "+49 89 1112233", "rating": 4.7, "reviews_count": 198, "reservations_count": 0, "status": "active", "images": ["https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?w=800&q=80"], "created_at": ts(30)},
    {"restaurant_id": f"rest_{rid()}", "name": "Ristorante Da Giovanni", "cuisine": "italian", "city": "Hamburg", "address": "Eppendorfer Weg 55, 20259 Hamburg", "description": "Familienrestaurant seit 1985. Steinofenpizza, hausgemachtes Tiramisu.", "price_range": "mid", "capacity": 48, "opening_hours": "12:00-22:30", "phone": "+49 40 2223344", "rating": 4.6, "reviews_count": 467, "reservations_count": 0, "status": "active", "images": ["https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&q=80"], "created_at": ts(250)},
]

existing_rest = db.restaurants.count_documents({"status": "active"})
if existing_rest < 5:
    db.restaurants.insert_many(RESTAURANTS_SEED)
    print(f"[OK] {len(RESTAURANTS_SEED)} Restaurants eingefuegt")
else:
    print(f"[SKIP] Restaurants bereits vorhanden ({existing_rest})")

# ============================================================
# 2. RESTAURANT REVIEWS
# ============================================================
rest_ids = [r["restaurant_id"] for r in RESTAURANTS_SEED]
NAMES = ["Stefan M.", "Anna K.", "Mehmet Y.", "Lisa R.", "Tobias W.", "Julia H.", "Ahmed B.", "Claudia S.", "Maximilian P.", "Sophie L.", "Kenan D.", "Elena V.", "Fabian G.", "Nina F.", "Jens T."]
REVIEW_TEXTS = [
    "Absolut fantastisch! Das beste Essen seit langem.",
    "Sehr gutes Preis-Leistungs-Verhaeltnis. Kommen wieder!",
    "Service war top, Essen kam schnell und war heiss.",
    "Tolles Ambiente, perfekt fuer ein Date.",
    "Lecker, aber etwas laut am Wochenende.",
    "Die Vorspeisen waren hervorragend!",
    "Wunderbares Erlebnis. Personal sehr freundlich.",
    "Gutes Essen, aber Wartezeit etwas lang.",
    "Unbedingt die Tageskarte probieren - mega!",
    "Bestes Restaurant in der Gegend. 5 Sterne!",
]

reviews = []
for rest_id in rest_ids[:8]:
    for i in range(random.randint(3, 6)):
        reviews.append({
            "review_id": f"rev_{rid()}",
            "restaurant_id": rest_id,
            "reviewer_name": random.choice(NAMES),
            "rating": random.choice([4, 4, 4, 5, 5, 5, 5, 3]),
            "comment": random.choice(REVIEW_TEXTS),
            "created_at": ts(random.randint(1, 60)),
        })

if db.restaurant_reviews.count_documents({}) < 10:
    db.restaurant_reviews.insert_many(reviews)
    print(f"[OK] {len(reviews)} Restaurant-Reviews eingefuegt")
else:
    print(f"[SKIP] Restaurant-Reviews bereits vorhanden")

# ============================================================
# 3. RESERVATIONS (Tischreservierungen)
# ============================================================
reservations = []
for rest_id in rest_ids[:6]:
    rest = next(r for r in RESTAURANTS_SEED if r["restaurant_id"] == rest_id)
    for i in range(random.randint(2, 5)):
        days_future = random.randint(1, 14)
        reservations.append({
            "reservation_id": f"res_{rid()}",
            "restaurant_id": rest_id,
            "restaurant_name": rest["name"],
            "user_email": random.choice(["kunde@bidblitz.com", "admin@bidblitz.com", f"user{random.randint(1,20)}@email.de"]),
            "user_name": random.choice(NAMES),
            "date": (NOW + timedelta(days=days_future)).strftime("%Y-%m-%d"),
            "time": random.choice(["12:00", "13:00", "18:00", "19:00", "19:30", "20:00", "20:30"]),
            "guests": random.randint(2, 6),
            "special_requests": random.choice(["", "", "Fensterplatz bitte", "Kinderstuhl benoetigt", "Allergien: Gluten", ""]),
            "deposit": random.choice([0, 0, 10, 15, 20]),
            "status": random.choice(["confirmed", "confirmed", "confirmed", "pending"]),
            "created_at": ts(random.randint(0, 7)),
        })

if db.reservations.count_documents({}) < 5:
    db.reservations.insert_many(reservations)
    print(f"[OK] {len(reservations)} Reservierungen eingefuegt")
else:
    print(f"[SKIP] Reservierungen bereits vorhanden")

# ============================================================
# 4. MARKETPLACE LISTINGS (Digitale Produkte)
# ============================================================
MARKETPLACE = [
    {"listing_id": f"mp_{rid()}", "title": "Figma UI Kit - 200+ Komponenten", "seller": "DesignLukas", "seller_email": "lukas@design.de", "category": "design", "price": 29.99, "description": "Komplettes UI Kit mit Dark/Light Mode. Figma & Sketch kompatibel.", "downloads": 1243, "rating": 4.8, "status": "active", "type": "digital", "created_at": ts(30)},
    {"listing_id": f"mp_{rid()}", "title": "Python Trading Bot Template", "seller": "CryptoKarl", "seller_email": "karl@crypto.de", "category": "code", "price": 49.99, "description": "Automatisierter Krypto-Trading Bot. Backtesting inkl. Dokumentation.", "downloads": 567, "rating": 4.6, "status": "active", "type": "digital", "created_at": ts(20)},
    {"listing_id": f"mp_{rid()}", "title": "10.000 Stockfotos Bundle", "seller": "FotoMax", "seller_email": "max@foto.de", "category": "media", "price": 19.99, "description": "Hochauflösende Stockfotos. Kommerzielle Lizenz inklusive.", "downloads": 2891, "rating": 4.5, "status": "active", "type": "digital", "created_at": ts(45)},
    {"listing_id": f"mp_{rid()}", "title": "Social Media Templates (50 Stueck)", "seller": "MarketingPro", "seller_email": "pro@marketing.de", "category": "design", "price": 14.99, "description": "Instagram, TikTok & LinkedIn Templates. Canva & Photoshop.", "downloads": 4521, "rating": 4.9, "status": "active", "type": "digital", "created_at": ts(15)},
    {"listing_id": f"mp_{rid()}", "title": "Businessplan Vorlage (Startup)", "seller": "StartupLena", "seller_email": "lena@startup.de", "category": "business", "price": 39.99, "description": "Professioneller Businessplan. Investor-Ready. 40 Seiten + Finanzplan Excel.", "downloads": 890, "rating": 4.7, "status": "active", "type": "digital", "created_at": ts(10)},
    {"listing_id": f"mp_{rid()}", "title": "Fitness E-Book: 12-Wochen-Plan", "seller": "FitMia", "seller_email": "mia@fit.de", "category": "fitness", "price": 12.99, "description": "Trainingsplan + Ernaehrungsplan + Rezepte. PDF + Videos.", "downloads": 3456, "rating": 4.8, "status": "active", "type": "digital", "created_at": ts(25)},
    {"listing_id": f"mp_{rid()}", "title": "WordPress Theme - E-Commerce Pro", "seller": "WebDevTom", "seller_email": "tom@webdev.de", "category": "code", "price": 59.99, "description": "Premium WordPress Theme mit WooCommerce Integration. 1-Klick Setup.", "downloads": 1678, "rating": 4.4, "status": "active", "type": "digital", "created_at": ts(40)},
    {"listing_id": f"mp_{rid()}", "title": "Podcast Intro & Outro Pack", "seller": "AudioMaster", "seller_email": "audio@master.de", "category": "media", "price": 9.99, "description": "20 professionelle Audio-Intros/Outros. Royalty-Free. WAV + MP3.", "downloads": 789, "rating": 4.3, "status": "active", "type": "digital", "created_at": ts(35)},
]

if db.marketplace_listings.count_documents({}) < 3:
    db.marketplace_listings.insert_many(MARKETPLACE)
    print(f"[OK] {len(MARKETPLACE)} Marketplace-Listings eingefuegt")
else:
    print(f"[SKIP] Marketplace-Listings bereits vorhanden")

# ============================================================
# 5. BLITZ CLIPS (Mehr User-Generated Content)
# ============================================================
CLIPS = [
    {"clip_id": f"clip_{rid()}", "creator": "SneakerKing", "creator_email": "sneaker@bidblitz.com", "title": "Seltene Nike Dunk Low fuer 50 EUR gefunden!", "description": "Reselling Tip des Monats", "duration": "28s", "category": "Fashion", "likes": 18500, "views": 145000, "shares": 4200, "comments": 780, "created_at": ts(2)},
    {"clip_id": f"clip_{rid()}", "creator": "KryptoQueen", "creator_email": "krypto@bidblitz.com", "title": "Bitcoin 150K? Meine Prognose fuer 2027", "description": "Analyse + Chart Review", "duration": "45s", "category": "Crypto", "likes": 32000, "views": 280000, "shares": 9800, "comments": 3400, "created_at": ts(1)},
    {"clip_id": f"clip_{rid()}", "creator": "KochAnna", "creator_email": "anna@bidblitz.com", "title": "Steak perfekt braten in 3 Minuten", "description": "Restaurant-Qualitaet zuhause", "duration": "55s", "category": "Kochen", "likes": 45000, "views": 520000, "shares": 15600, "comments": 5200, "created_at": ts(3)},
    {"clip_id": f"clip_{rid()}", "creator": "TechTimDE", "creator_email": "tim@bidblitz.com", "title": "iPhone 17 Pro: Lohnt sich das Upgrade?", "description": "Ehrlicher Test nach 2 Wochen", "duration": "58s", "category": "Tech", "likes": 28000, "views": 320000, "shares": 8900, "comments": 4100, "created_at": ts(1, 5)},
    {"clip_id": f"clip_{rid()}", "creator": "FitMax", "creator_email": "max@bidblitz.com", "title": "6-Pack in 30 Tagen? Mein Experiment", "description": "Vorher/Nachher Transformation", "duration": "60s", "category": "Fitness", "likes": 67000, "views": 890000, "shares": 23000, "comments": 8900, "created_at": ts(5)},
    {"clip_id": f"clip_{rid()}", "creator": "ComedyJan", "creator_email": "jan@bidblitz.com", "title": "Wenn du bei BidBlitz den Jackpot gewinnst", "description": "Sketch: Vom Studenten zum Millionaer", "duration": "22s", "category": "Comedy", "likes": 120000, "views": 2100000, "shares": 56000, "comments": 15000, "created_at": ts(0, 12)},
    {"clip_id": f"clip_{rid()}", "creator": "GamerPro", "creator_email": "gamer@bidblitz.com", "title": "Erster Kill mit der neuen Waffe", "description": "GTA 7 Gameplay", "duration": "18s", "category": "Gaming", "likes": 89000, "views": 1500000, "shares": 34000, "comments": 11000, "created_at": ts(0, 6)},
    {"clip_id": f"clip_{rid()}", "creator": "StyleLisa", "creator_email": "lisa@bidblitz.com", "title": "Zara Haul: Fruehling 2026", "description": "5 Outfits unter 100 EUR", "duration": "48s", "category": "Fashion", "likes": 34000, "views": 410000, "shares": 12000, "comments": 4800, "created_at": ts(2, 8)},
    {"clip_id": f"clip_{rid()}", "creator": "FinanzFuchs", "creator_email": "fuchs@bidblitz.com", "title": "ETF-Sparplan vs. Tagesgeld 2026", "description": "Wo lohnt sich dein Geld mehr?", "duration": "50s", "category": "Finanzen", "likes": 15000, "views": 180000, "shares": 6700, "comments": 2300, "created_at": ts(4)},
    {"clip_id": f"clip_{rid()}", "creator": "ReiseElena", "creator_email": "elena@bidblitz.com", "title": "Bali fuer 800 EUR: So geht's!", "description": "Budget-Reise Hack", "duration": "42s", "category": "Reisen", "likes": 52000, "views": 670000, "shares": 19000, "comments": 7200, "created_at": ts(3, 4)},
]

if db.blitz_clips.count_documents({}) < 5:
    db.blitz_clips.delete_many({})
    db.blitz_clips.insert_many(CLIPS)
    print(f"[OK] {len(CLIPS)} BlitzClips eingefuegt")
else:
    print(f"[SKIP] BlitzClips bereits vorhanden")

# ============================================================
# 6. TRANSACTIONS (Fuer Admin Dashboard Stats)
# ============================================================
TXN_TYPES = ["top_up", "payment", "transfer", "credit_purchase", "mining_purchase", "cashback", "reward", "kids_subscription"]

new_txns = []
for i in range(80):
    txn_type = random.choice(TXN_TYPES)
    amount = round(random.uniform(1, 500), 2)
    fee = round(amount * random.uniform(0.01, 0.05), 2)
    new_txns.append({
        "transaction_id": f"txn_{rid()}",
        "type": txn_type,
        "amount": amount,
        "fee_amount": fee,
        "user_email": random.choice(["admin@bidblitz.com", "kunde@bidblitz.com", f"user{random.randint(1,30)}@email.de"]),
        "status": random.choice(["completed", "completed", "completed", "completed", "pending"]),
        "description": {
            "top_up": "Guthaben-Aufladung",
            "payment": "Zahlung",
            "transfer": "Ueberweisung",
            "credit_purchase": "Credits gekauft",
            "mining_purchase": "Mining-Paket",
            "cashback": "Cashback-Gutschrift",
            "reward": "Belohnung",
            "kids_subscription": "Kids Premium",
        }.get(txn_type, "Transaktion"),
        "created_at": ts(random.randint(0, 30), random.randint(0, 23)),
    })

existing_txns = db.transactions.count_documents({})
if existing_txns < 250:
    db.transactions.insert_many(new_txns)
    print(f"[OK] {len(new_txns)} Transaktionen eingefuegt (Total: {existing_txns + len(new_txns)})")
else:
    print(f"[SKIP] Transaktionen bereits ausreichend ({existing_txns})")

# ============================================================
# 7. PET BOOKINGS (Tierbetreuung)
# ============================================================
PET_NAMES = ["Bello", "Luna", "Rocky", "Mia", "Max", "Nala", "Bruno", "Lilly", "Rex", "Cleo"]
PET_TYPES = ["Hund", "Katze", "Hund", "Hund", "Katze", "Hund"]

pet_bookings = []
for i in range(12):
    pet_bookings.append({
        "booking_id": f"pet_{rid()}",
        "sitter_id": f"pet_00{random.randint(1,5)}",
        "sitter_name": random.choice(["Marie Tierlieb", "Gassi-Koenig Tom", "Katzenpension Schnurr", "Tier-Taxi Express", "Dr. Pfote Mobil"]),
        "client_email": random.choice(["kunde@bidblitz.com", f"user{random.randint(1,15)}@email.de"]),
        "client_name": random.choice(NAMES),
        "start_date": (NOW + timedelta(days=random.randint(1, 21))).strftime("%Y-%m-%d"),
        "end_date": (NOW + timedelta(days=random.randint(22, 35))).strftime("%Y-%m-%d"),
        "pet_name": random.choice(PET_NAMES),
        "pet_type": random.choice(PET_TYPES),
        "notes": random.choice(["", "Medikamente morgens", "Futter mitgebracht", "Vertraegt kein Trockenfutter", ""]),
        "price_per_day": random.choice([15, 25, 35, 40, 65]),
        "status": random.choice(["confirmed", "confirmed", "pending", "completed"]),
        "created_at": ts(random.randint(0, 14)),
    })

if db.pet_bookings.count_documents({}) < 5:
    db.pet_bookings.insert_many(pet_bookings)
    print(f"[OK] {len(pet_bookings)} Tierbetreuung-Buchungen eingefuegt")
else:
    print(f"[SKIP] Tierbetreuung-Buchungen bereits vorhanden")

# ============================================================
# 8. APPOINTMENT BOOKINGS (Termine)
# ============================================================
appointments = []
for i in range(15):
    provider = random.choice(["Salon Elegance", "Dr. Mueller Praxis", "Massage Oase", "AutoFit Werkstatt"])
    service = random.choice(["Herrenschnitt", "Check-Up", "Rueckenmassage", "Oelwechsel", "Damenschnitt", "Hot Stone"])
    appointments.append({
        "booking_id": f"appt_{rid()}",
        "user_email": random.choice(["kunde@bidblitz.com", "admin@bidblitz.com", f"user{random.randint(1,20)}@email.de"]),
        "provider_id": f"b{random.randint(1,4)}",
        "provider_name": provider,
        "provider_type": random.choice(["Friseur", "Arzt", "Wellness", "KFZ"]),
        "service": service,
        "price": random.choice([25, 45, 50, 79, 89, 149]),
        "duration_min": random.choice([20, 30, 45, 60, 90]),
        "platform_fee": round(random.uniform(1, 7), 2),
        "date": (NOW + timedelta(days=random.randint(1, 14))).strftime("%Y-%m-%d"),
        "time": random.choice(["09:00", "10:30", "11:00", "14:00", "15:30", "16:00"]),
        "status": random.choice(["confirmed", "confirmed", "completed", "pending"]),
        "created_at": ts(random.randint(0, 10)),
    })

if db.appointment_bookings.count_documents({}) < 5:
    db.appointment_bookings.insert_many(appointments)
    print(f"[OK] {len(appointments)} Termin-Buchungen eingefuegt")
else:
    print(f"[SKIP] Termin-Buchungen bereits vorhanden")

# ============================================================
# 9. LIVE SHOPPING ORDERS
# ============================================================
live_orders = []
for i in range(10):
    product = random.choice(["Nike Air Max 2026", "AirPods Pro 3", "K-Beauty Set", "RGB Gaming Bundle", "Pokemon Booster Box", "Protein Bundle"])
    live_orders.append({
        "order_id": f"live_{rid()}",
        "user_email": random.choice(["kunde@bidblitz.com", f"user{random.randint(1,20)}@email.de"]),
        "stream_id": f"ls{random.randint(1,6)}",
        "product": product,
        "quantity": random.randint(1, 3),
        "unit_price": round(random.uniform(29, 279), 2),
        "total": round(random.uniform(29, 450), 2),
        "discount_pct": random.choice([10, 15, 20, 30, 35, 40]),
        "host": random.choice(["SneakerKing", "TechBuzz", "GlowUp_Lisa", "ProGamer_DE"]),
        "status": random.choice(["confirmed", "shipped", "delivered"]),
        "created_at": ts(random.randint(0, 14)),
    })

if db.live_shopping_orders.count_documents({}) < 5:
    db.live_shopping_orders.insert_many(live_orders)
    print(f"[OK] {len(live_orders)} Live-Shopping-Bestellungen eingefuegt")
else:
    print(f"[SKIP] Live-Shopping-Bestellungen bereits vorhanden")

# ============================================================
# 10. CREATOR SUBSCRIPTIONS & TIPS
# ============================================================
creator_subs = []
creator_tips = []
for i in range(8):
    creator_subs.append({
        "sub_id": f"csub_{rid()}",
        "user_email": random.choice(["kunde@bidblitz.com", f"user{random.randint(1,15)}@email.de"]),
        "creator_id": f"c{random.randint(1,6)}",
        "creator_name": random.choice(["TechTim", "FitnessMia", "CryptoKarl", "KochAnna", "DesignLukas", "MusikSophie"]),
        "monthly_price": random.choice([2.99, 3.99, 4.99, 7.99, 9.99, 14.99]),
        "status": "active",
        "created_at": ts(random.randint(1, 30)),
    })

for i in range(12):
    amount = round(random.uniform(1, 50), 2)
    creator_tips.append({
        "tip_id": f"tip_{rid()}",
        "from_email": random.choice(["kunde@bidblitz.com", f"user{random.randint(1,20)}@email.de"]),
        "creator_id": f"c{random.randint(1,6)}",
        "creator_name": random.choice(["TechTim", "FitnessMia", "CryptoKarl", "KochAnna", "DesignLukas", "MusikSophie"]),
        "amount_eur": amount,
        "message": random.choice(["Mega Content!", "Weiter so!", "Danke fuer den Tipp!", "Top Video!", "Beste Analyse!", ""]),
        "platform_fee": round(amount * 0.20, 2),
        "created_at": ts(random.randint(0, 20)),
    })

if db.creator_subscriptions.count_documents({}) < 3:
    db.creator_subscriptions.insert_many(creator_subs)
    print(f"[OK] {len(creator_subs)} Creator-Abos eingefuegt")
else:
    print(f"[SKIP] Creator-Abos bereits vorhanden")

if db.creator_tips.count_documents({}) < 3:
    db.creator_tips.insert_many(creator_tips)
    print(f"[OK] {len(creator_tips)} Creator-Tips eingefuegt")
else:
    print(f"[SKIP] Creator-Tips bereits vorhanden")

# ============================================================
# 11. TRADING BOTS (Aktive Bots)
# ============================================================
bots = []
for i in range(6):
    budget = random.choice([100, 250, 500, 1000, 2000, 5000])
    pnl_pct = round(random.uniform(-5, 18), 2)
    bots.append({
        "bot_id": f"bot_{rid()}",
        "user_email": random.choice(["admin@bidblitz.com", "kunde@bidblitz.com"]),
        "strategy_id": random.choice(["dca_btc", "dca_eth", "grid_btc", "grid_sol", "copy_whale", "arb_stable"]),
        "strategy_name": random.choice(["BTC DCA Bot", "ETH DCA Bot", "BTC Grid Bot", "SOL Grid Bot", "Whale Tracker", "Stablecoin Arbitrage"]),
        "type": random.choice(["DCA", "Grid", "Copy", "Arbitrage"]),
        "coin": random.choice(["BTC", "ETH", "SOL", "USDT/USDC"]),
        "budget_eur": budget,
        "trades_executed": random.randint(5, 120),
        "pnl": round(budget * pnl_pct / 100, 2),
        "pnl_pct": pnl_pct,
        "status": random.choice(["running", "running", "running", "stopped"]),
        "created_at": ts(random.randint(1, 30)),
    })

if db.trading_bots.count_documents({}) < 3:
    db.trading_bots.insert_many(bots)
    print(f"[OK] {len(bots)} Trading-Bots eingefuegt")
else:
    print(f"[SKIP] Trading-Bots bereits vorhanden")

# ============================================================
# 12. CRYPTO BASKETS PURCHASES
# ============================================================
basket_purchases = []
for i in range(10):
    amount = round(random.uniform(50, 2000), 2)
    basket_purchases.append({
        "purchase_id": f"bsk_{rid()}",
        "user_email": random.choice(["admin@bidblitz.com", "kunde@bidblitz.com", f"user{random.randint(1,15)}@email.de"]),
        "basket_id": random.choice(["top5", "defi", "gaming", "layer2", "meme", "stable"]),
        "basket_name": random.choice(["Top 5 Coins", "DeFi Power", "Gaming & Metaverse", "Layer 2 Bundle", "Meme Coins", "Stablecoin Yield"]),
        "amount_eur": amount,
        "fee": round(amount * random.uniform(0.005, 0.025), 2),
        "coins": [{"coin": "BTC", "weight": 40}, {"coin": "ETH", "weight": 25}],
        "status": "active",
        "created_at": ts(random.randint(0, 30)),
    })

if db.crypto_baskets_purchases.count_documents({}) < 3:
    db.crypto_baskets_purchases.insert_many(basket_purchases)
    print(f"[OK] {len(basket_purchases)} Crypto-Basket-Kaeufe eingefuegt")
else:
    print(f"[SKIP] Crypto-Basket-Kaeufe bereits vorhanden")

# ============================================================
# 13. BOX SUBSCRIPTIONS (Abo-Boxen)
# ============================================================
box_subs = []
for i in range(8):
    box_subs.append({
        "sub_id": f"box_{rid()}",
        "user_email": random.choice(["kunde@bidblitz.com", f"user{random.randint(1,20)}@email.de"]),
        "box_id": random.choice(["snack", "gaming", "beauty", "crypto", "fitness", "mystery"]),
        "box_name": random.choice(["Snack Box", "Gaming Box", "Beauty Box", "Crypto Merch Box", "Fitness Box", "Mystery Premium Box"]),
        "price": random.choice([14.99, 19.99, 22.99, 24.99, 29.99, 39.99]),
        "status": "active",
        "next_delivery": (NOW + timedelta(days=random.randint(5, 25))).strftime("%Y-%m-%d"),
        "created_at": ts(random.randint(5, 40)),
    })

if db.box_subscriptions.count_documents({}) < 3:
    db.box_subscriptions.insert_many(box_subs)
    print(f"[OK] {len(box_subs)} Abo-Box-Abos eingefuegt")
else:
    print(f"[SKIP] Abo-Box-Abos bereits vorhanden")

# ============================================================
# 14. DIGITAL CONTRACTS
# ============================================================
contracts = []
CONTRACT_TYPES = ["freelancer", "rental", "nda", "service", "employment"]
for i in range(6):
    contracts.append({
        "contract_id": f"ctr_{rid()}",
        "title": random.choice([
            "Freelancer-Vertrag: Webdesign Projekt",
            "Mietvertrag: 2-Zimmer Berlin Mitte",
            "NDA: Startup Kooperation",
            "Dienstleistungsvertrag: Marketing",
            "Werkvertrag: App-Entwicklung",
            "Beratungsvertrag: Steuerberatung",
        ]),
        "type": random.choice(CONTRACT_TYPES),
        "party_a": random.choice(NAMES),
        "party_a_email": random.choice(["admin@bidblitz.com", "kunde@bidblitz.com"]),
        "party_b": random.choice(NAMES),
        "party_b_email": f"partner{random.randint(1,10)}@email.de",
        "value_eur": round(random.uniform(500, 10000), 2),
        "status": random.choice(["active", "active", "signed", "pending"]),
        "signed_at": ts(random.randint(0, 5)) if random.random() > 0.3 else None,
        "expires_at": (NOW + timedelta(days=random.randint(30, 365))).isoformat(),
        "created_at": ts(random.randint(1, 20)),
    })

if db.digital_contracts.count_documents({}) < 3:
    db.digital_contracts.insert_many(contracts)
    print(f"[OK] {len(contracts)} Digitale Vertraege eingefuegt")
else:
    print(f"[SKIP] Digitale Vertraege bereits vorhanden")

# ============================================================
# 15. INVOICES
# ============================================================
invoices = []
for i in range(8):
    amount = round(random.uniform(50, 5000), 2)
    tax = round(amount * 0.19, 2)
    invoices.append({
        "invoice_id": f"inv_{rid()}",
        "invoice_number": f"INV-2026-{1000+i}",
        "from_name": random.choice(["BidBlitz GmbH", "Max Mustermann", "Webdesign Studio Berlin"]),
        "from_email": random.choice(["admin@bidblitz.com", "buchhaltung@bidblitz.com"]),
        "to_name": random.choice(NAMES),
        "to_email": f"kunde{random.randint(1,20)}@email.de",
        "items": [
            {"description": random.choice(["Beratung", "Webdesign", "Marketing", "Entwicklung"]), "quantity": random.randint(1, 10), "unit_price": round(random.uniform(50, 500), 2)},
        ],
        "subtotal": amount,
        "tax": tax,
        "total": round(amount + tax, 2),
        "currency": "EUR",
        "status": random.choice(["paid", "sent", "overdue", "draft"]),
        "due_date": (NOW + timedelta(days=random.randint(-10, 30))).strftime("%Y-%m-%d"),
        "created_at": ts(random.randint(1, 30)),
    })

if db.invoices.count_documents({}) < 3:
    db.invoices.insert_many(invoices)
    print(f"[OK] {len(invoices)} Rechnungen eingefuegt")
else:
    print(f"[SKIP] Rechnungen bereits vorhanden")

# ============================================================
# 16. P2P LENDING OFFERS
# ============================================================
p2p_offers = []
for i in range(6):
    amount = random.choice([500, 1000, 2000, 5000, 10000])
    p2p_offers.append({
        "offer_id": f"p2p_{rid()}",
        "lender_email": random.choice(["admin@bidblitz.com", f"investor{random.randint(1,10)}@email.de"]),
        "lender_name": random.choice(NAMES),
        "amount_eur": amount,
        "interest_rate": round(random.uniform(3, 12), 1),
        "duration_months": random.choice([3, 6, 12, 24]),
        "min_credit_score": random.choice([600, 650, 700]),
        "purpose": random.choice(["Geschaeftskredit", "Bildung", "Auto", "Renovation", "Sonstig"]),
        "status": random.choice(["active", "active", "funded", "completed"]),
        "funded_amount": round(amount * random.uniform(0, 1), 2),
        "created_at": ts(random.randint(1, 30)),
    })

if db.p2p_offers.count_documents({}) < 3:
    db.p2p_offers.insert_many(p2p_offers)
    print(f"[OK] {len(p2p_offers)} P2P-Angebote eingefuegt")
else:
    print(f"[SKIP] P2P-Angebote bereits vorhanden")

# ============================================================
# 17. CRYPTO LOANS
# ============================================================
crypto_loans = []
for i in range(5):
    collateral = round(random.uniform(500, 10000), 2)
    crypto_loans.append({
        "loan_id": f"loan_{rid()}",
        "user_email": random.choice(["admin@bidblitz.com", "kunde@bidblitz.com"]),
        "collateral_coin": random.choice(["BTC", "ETH", "SOL"]),
        "collateral_amount_eur": collateral,
        "loan_amount_eur": round(collateral * 0.5, 2),
        "ltv": 50,
        "interest_rate": round(random.uniform(5, 15), 1),
        "duration_days": random.choice([30, 90, 180, 365]),
        "status": random.choice(["active", "active", "repaid"]),
        "created_at": ts(random.randint(1, 30)),
    })

if db.crypto_loans.count_documents({}) < 3:
    db.crypto_loans.insert_many(crypto_loans)
    print(f"[OK] {len(crypto_loans)} Crypto-Kredite eingefuegt")
else:
    print(f"[SKIP] Crypto-Kredite bereits vorhanden")

# ============================================================
# 18. PREDICTION BETS
# ============================================================
predictions = []
PREDICTION_EVENTS = [
    "Bitcoin ueber 120K bis Ende Mai?",
    "Wird Deutschland Europameister?",
    "Tesla Aktie ueber 300 USD?",
    "Naechster Apple Launch im Juni?",
    "Bundesliga: Bayern Meister?",
    "ETH ueber 5000 USD bis Sommer?",
]

for i in range(8):
    bet_amount = round(random.uniform(5, 100), 2)
    predictions.append({
        "bet_id": f"pred_{rid()}",
        "user_email": random.choice(["admin@bidblitz.com", "kunde@bidblitz.com", f"user{random.randint(1,15)}@email.de"]),
        "event": random.choice(PREDICTION_EVENTS),
        "prediction": random.choice(["yes", "no"]),
        "amount_eur": bet_amount,
        "odds": round(random.uniform(1.2, 4.5), 2),
        "potential_win": round(bet_amount * random.uniform(1.5, 4), 2),
        "status": random.choice(["active", "active", "won", "lost"]),
        "created_at": ts(random.randint(0, 14)),
    })

if db.prediction_bets.count_documents({}) < 3:
    db.prediction_bets.insert_many(predictions)
    print(f"[OK] {len(predictions)} Predictions eingefuegt")
else:
    print(f"[SKIP] Predictions bereits vorhanden")

# ============================================================
# 19. SOCIAL POSTS (Mehr Content)
# ============================================================
social_posts = []
POST_TEXTS = [
    "Gerade meinen ersten BidBlitz Trade gemacht! +15% in 2 Stunden",
    "Hat jemand Erfahrung mit dem Grid Trading Bot? Ueberlege zu starten.",
    "Die neue Snack Box ist mega! Japanische Kit-Kats sind der Hammer.",
    "Tipp: Daily Spin nicht vergessen - hab gestern 5 EUR gewonnen!",
    "Mein Portfolio hat die 10K Marke geknackt. Danke BidBlitz!",
    "Live Shopping Deal: AirPods Pro 3 fuer nur 237 EUR. Zuschlagen!",
    "Wer will zum BidBlitz Meetup in Berlin? Naechsten Samstag 15 Uhr.",
    "Challenge geschafft: 30 Tage Spar-Challenge. 450 EUR gespart!",
    "Der neue Creator Content von CryptoKarl ist Gold wert.",
    "BidBlitz Referral: 10 EUR fuer euch, 10 EUR fuer mich. Link in Bio!",
]

for i in range(15):
    social_posts.append({
        "post_id": f"post_{rid()}",
        "author_email": random.choice(["admin@bidblitz.com", "kunde@bidblitz.com", f"user{random.randint(1,20)}@email.de"]),
        "author_name": random.choice(NAMES),
        "content": random.choice(POST_TEXTS),
        "likes": random.randint(5, 500),
        "comments": random.randint(0, 50),
        "shares": random.randint(0, 30),
        "type": random.choice(["text", "text", "image"]),
        "created_at": ts(random.randint(0, 14), random.randint(0, 23)),
    })

existing_posts = db.social_posts.count_documents({})
if existing_posts < 15:
    db.social_posts.insert_many(social_posts)
    print(f"[OK] {len(social_posts)} Social-Posts eingefuegt")
else:
    print(f"[SKIP] Social-Posts bereits vorhanden ({existing_posts})")

# ============================================================
# 20. ADDITIONAL USERS (Fuer Admin Panel Statistiken)
# ============================================================
from hashlib import sha256

new_users = []
CITIES = ["Berlin", "Muenchen", "Hamburg", "Koeln", "Frankfurt", "Stuttgart", "Duesseldorf", "Leipzig"]
FIRST_NAMES = ["Luca", "Emilia", "Noah", "Hannah", "Leon", "Mia", "Finn", "Emma", "Paul", "Sophia", "Felix", "Marie", "Elias", "Leonie", "Ben", "Anna", "Jonas", "Lena", "Luis", "Amelie"]
LAST_NAMES = ["Mueller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Schulz", "Hoffmann"]

existing_users = db.users.count_documents({})
if existing_users < 80:
    for i in range(30):
        first = random.choice(FIRST_NAMES)
        last = random.choice(LAST_NAMES)
        email = f"{first.lower()}.{last.lower()}{random.randint(1,99)}@email.de"
        new_users.append({
            "name": f"{first} {last}",
            "email": email,
            "password_hash": sha256(f"User{i}2026!".encode()).hexdigest(),
            "role": "user",
            "balance": round(random.uniform(0, 500), 2),
            "city": random.choice(CITIES),
            "is_verified": random.random() > 0.2,
            "premium": random.random() > 0.7,
            "referral_code": secrets.token_hex(4).upper(),
            "created_at": ts(random.randint(0, 60)),
            "last_login": ts(random.randint(0, 7)),
        })
    db.users.insert_many(new_users)
    print(f"[OK] {len(new_users)} zusaetzliche User eingefuegt (Total: {existing_users + len(new_users)})")
else:
    print(f"[SKIP] Users bereits ausreichend ({existing_users})")

# ============================================================
# 21. NOTIFICATIONS
# ============================================================
notifications = []
NOTIF_TYPES = [
    ("Willkommen bei BidBlitz V2!", "system"),
    ("Du hast 5 EUR Cashback erhalten!", "cashback"),
    ("Deine Reservierung wurde bestaetigt.", "booking"),
    ("Neues Live-Shopping Event startet in 10 Min!", "live"),
    ("Dein Trading Bot hat +8.5% Gewinn gemacht.", "trading"),
    ("Neue Challenge verfuegbar: 30-Tage-Spar-Challenge", "challenge"),
    ("Dein Creator-Abo wurde verlaengert.", "subscription"),
    ("Jackpot! Du hast 50 EUR beim Gluecksrad gewonnen!", "reward"),
]

for i in range(20):
    msg, ntype = random.choice(NOTIF_TYPES)
    notifications.append({
        "notification_id": f"notif_{rid()}",
        "user_email": random.choice(["admin@bidblitz.com", "kunde@bidblitz.com", f"user{random.randint(1,15)}@email.de"]),
        "message": msg,
        "type": ntype,
        "read": random.random() > 0.4,
        "created_at": ts(random.randint(0, 7), random.randint(0, 23)),
    })

existing_notifs = db.notifications.count_documents({})
if existing_notifs < 25:
    db.notifications.insert_many(notifications)
    print(f"[OK] {len(notifications)} Benachrichtigungen eingefuegt")
else:
    print(f"[SKIP] Benachrichtigungen bereits vorhanden ({existing_notifs})")

# ============================================================
# 22. CHALLENGE PARTICIPANTS (Virale Challenges)
# ============================================================
challenges = []
CHALLENGE_TITLES = [
    "30-Tage Spar-Challenge",
    "Krypto-Beginner Challenge",
    "Fitness 4 Wochen",
    "Zero-Waste Monat",
    "Kochen ohne Lieferdienst",
]

for i in range(12):
    challenges.append({
        "participant_id": f"cp_{rid()}",
        "user_email": random.choice(["kunde@bidblitz.com", f"user{random.randint(1,20)}@email.de"]),
        "user_name": random.choice(NAMES),
        "challenge": random.choice(CHALLENGE_TITLES),
        "progress_pct": random.randint(10, 100),
        "days_completed": random.randint(1, 30),
        "reward_claimed": random.random() > 0.5,
        "status": random.choice(["active", "active", "completed"]),
        "created_at": ts(random.randint(1, 20)),
    })

if db.challenge_participants.count_documents({}) < 5:
    db.challenge_participants.insert_many(challenges)
    print(f"[OK] {len(challenges)} Challenge-Teilnehmer eingefuegt")
else:
    print(f"[SKIP] Challenge-Teilnehmer bereits vorhanden")

# ============================================================
# 23. QUIZ MATCHES
# ============================================================
quiz_matches = []
for i in range(10):
    quiz_matches.append({
        "match_id": f"quiz_{rid()}",
        "player1_email": random.choice(["admin@bidblitz.com", "kunde@bidblitz.com"]),
        "player1_name": random.choice(NAMES[:5]),
        "player2_email": f"user{random.randint(1,20)}@email.de",
        "player2_name": random.choice(NAMES[5:]),
        "category": random.choice(["Allgemeinwissen", "Sport", "Geographie", "Geschichte", "Wissenschaft"]),
        "bet_amount": random.choice([1, 2, 5, 10]),
        "player1_score": random.randint(0, 5),
        "player2_score": random.randint(0, 5),
        "winner_email": random.choice(["admin@bidblitz.com", "kunde@bidblitz.com", None]),
        "status": random.choice(["completed", "completed", "active"]),
        "created_at": ts(random.randint(0, 14)),
    })

if db.quiz_matches.count_documents({}) < 5:
    db.quiz_matches.insert_many(quiz_matches)
    print(f"[OK] {len(quiz_matches)} Quiz-Matches eingefuegt")
else:
    print(f"[SKIP] Quiz-Matches bereits vorhanden")

# ============================================================
# 24. SKILL BOOKINGS
# ============================================================
skill_bookings = []
for i in range(8):
    price = random.choice([18, 20, 22, 25, 30, 35, 40, 50, 60])
    skill_bookings.append({
        "booking_id": f"skill_{rid()}",
        "user_email": random.choice(["kunde@bidblitz.com", f"user{random.randint(1,15)}@email.de"]),
        "session_id": f"sk{random.randint(1,6)}",
        "tutor": random.choice(["MaxCode", "DesignSara", "GuitarJan", "EnglishPro", "StartupLena", "CoachMike"]),
        "title": random.choice(["Python fuer Anfaenger", "Figma Masterclass", "Gitarre fuer Einsteiger", "Business English", "Social Media Marketing", "Home Workout Plan"]),
        "duration_min": random.choice([30, 60]),
        "price": price,
        "platform_fee": round(price * 0.15, 2),
        "status": random.choice(["confirmed", "completed", "completed"]),
        "scheduled_at": (NOW + timedelta(days=random.randint(1, 14))).isoformat(),
        "created_at": ts(random.randint(0, 10)),
    })

if db.skill_bookings.count_documents({}) < 3:
    db.skill_bookings.insert_many(skill_bookings)
    print(f"[OK] {len(skill_bookings)} Skill-Buchungen eingefuegt")
else:
    print(f"[SKIP] Skill-Buchungen bereits vorhanden")

# ============================================================
# FINAL SUMMARY
# ============================================================
print("\n" + "="*60)
print("SEEDING ABGESCHLOSSEN!")
print("="*60)

total_collections = len(db.list_collection_names())
total_docs = sum(db[col].count_documents({}) for col in db.list_collection_names())
print(f"Datenbank: {DB_NAME}")
print(f"Collections: {total_collections}")
print(f"Dokumente gesamt: {total_docs}")
print(f"\nDie App sollte jetzt volle Daten anzeigen.")
print("Admin Panel: /admin")
print("Login: admin@bidblitz.com / BidBlitz2026!")
