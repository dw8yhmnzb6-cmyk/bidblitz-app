"""
Seed Marketplace & Jobs mit realistischen Daten aus Deutschland & Dubai
Mit echten Unsplash-Bildern
"""
import asyncio
import secrets
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient
import os

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "bidblitz")

client = MongoClient(MONGO_URL)
db = client[DB_NAME]

# ══════════════════════════════════════════════════════════════════════════════
# MARKETPLACE LISTINGS (30 Produkte)
# ══════════════════════════════════════════════════════════════════════════════

MARKETPLACE_ITEMS = [
    # Electronics
    {"title": "iPhone 15 Pro Max 256GB - Neuwertig", "description": "Sehr gut erhaltenes iPhone 15 Pro Max in Space Grau. 256GB Speicher, keine Kratzer, mit Originalverpackung und Ladekabel. Gekauft vor 3 Monaten in Berlin.", "price": 899.00, "category": "electronics", "location": "Berlin, Deutschland", "images": ["https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600&h=400&fit=crop"], "lat": 52.5200, "lng": 13.4050},
    
    {"title": "Samsung 55\" 4K Smart TV", "description": "Samsung Crystal UHD 55 Zoll Smart TV. 4K Auflösung, HDR, Tizen OS. Funktioniert einwandfrei, Fernbedienung und Standfuß dabei.", "price": 399.00, "category": "electronics", "location": "München, Deutschland", "images": ["https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600&h=400&fit=crop"], "lat": 48.1351, "lng": 11.5820},
    
    {"title": "MacBook Air M2 - Wie neu", "description": "Apple MacBook Air M2 Chip, 8GB RAM, 256GB SSD. Space Grau. Gekauft Ende 2023, kaum benutzt. Mit Original-Ladegerät.", "price": 950.00, "category": "electronics", "location": "Hamburg, Deutschland", "images": ["https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&h=400&fit=crop"], "lat": 53.5511, "lng": 9.9937},
    
    {"title": "Sony PlayStation 5 + Controller", "description": "PS5 Disc Edition mit 2 DualSense Controllern. Originalverpackung vorhanden. Dubai Warehouse, schneller Versand in die VAE.", "price": 450.00, "category": "electronics", "location": "Dubai, VAE", "images": ["https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=600&h=400&fit=crop"], "lat": 25.2048, "lng": 55.2708},
    
    {"title": "Canon EOS R6 Kamera Body", "description": "Profi-Kamera für Fotografie & Video. 20MP Vollformat, 4K Video. Sehr wenig benutzt, wie neu. Mit Objektivdeckel und Tragegurt.", "price": 1799.00, "category": "electronics", "location": "Frankfurt, Deutschland", "images": ["https://images.unsplash.com/photo-1606980618765-d42fe6f85e5e?w=600&h=400&fit=crop"], "lat": 50.1109, "lng": 8.6821},
    
    # Fashion
    {"title": "Nike Air Max 90 - Gr. 42", "description": "Original Nike Air Max 90 in Weiß/Schwarz. Größe 42, neuwertig. Nur 2x getragen. Mit Originalkarton.", "price": 89.00, "category": "fashion", "location": "Köln, Deutschland", "images": ["https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=400&fit=crop"], "lat": 50.9375, "lng": 6.9603},
    
    {"title": "Rolex Submariner Homage Uhr", "description": "Hochwertige Automatikuhr im Rolex-Stil. Saphirglas, Edelstahl, wasserdicht bis 200m. Perfekt für Sammler.", "price": 349.00, "category": "fashion", "location": "Dubai, VAE", "images": ["https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=600&h=400&fit=crop"], "lat": 25.2048, "lng": 55.2708},
    
    {"title": "Louis Vuitton Handtasche - Vintage", "description": "Authentische Louis Vuitton Speedy 30. Monogram Canvas, guter Zustand. Mit Authentizitätscode.", "price": 650.00, "category": "fashion", "location": "Berlin, Deutschland", "images": ["https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&h=400&fit=crop"], "lat": 52.5200, "lng": 13.4050},
    
    # Home
    {"title": "IKEA Ektorp 3er Sofa - Grau", "description": "Gemütliches 3-Sitzer Sofa von IKEA. Farbe: Grau. Abnehmbarer Bezug (waschbar). Guter Zustand, keine Flecken.", "price": 180.00, "category": "home", "location": "Stuttgart, Deutschland", "images": ["https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&h=400&fit=crop"], "lat": 48.7758, "lng": 9.1829},
    
    {"title": "Luxus Esstisch - Massivholz", "description": "Esstisch aus massivem Eichenholz. 200x100cm. Platz für 8 Personen. Handgefertigt, sehr stabil und schwer.", "price": 890.00, "category": "home", "location": "München, Deutschland", "images": ["https://images.unsplash.com/photo-1617806118233-18e1de247200?w=600&h=400&fit=crop"], "lat": 48.1351, "lng": 11.5820},
    
    # Vehicles
    {"title": "BMW 320i - Bj. 2019", "description": "BMW 3er Limousine, 184 PS, Automatik. 45.000 km, TÜV neu. Navigationssystem, Sitzheizung, Xenon-Licht.", "price": 22500.00, "category": "vehicles", "location": "Düsseldorf, Deutschland", "images": ["https://images.unsplash.com/photo-1555215695-3004980ad54e?w=600&h=400&fit=crop"], "lat": 51.2277, "lng": 6.7735},
    
    {"title": "E-Bike Trek Powerfly - 2023", "description": "Elektrisches Mountainbike. Bosch Motor, 500Wh Akku, Reichweite 80km. Kaum gefahren, wie neu.", "price": 2100.00, "category": "vehicles", "location": "Hamburg, Deutschland", "images": ["https://images.unsplash.com/photo-1571333250630-f0230c320b6d?w=600&h=400&fit=crop"], "lat": 53.5511, "lng": 9.9937},
    
    # Sports
    {"title": "Fitnessstudio-Set: Hanteln + Bank", "description": "Komplettes Home-Gym: 2x Kurzhanteln (bis 20kg), Hantelbank klappbar, Yogamatte. Perfekt für Training zuhause.", "price": 149.00, "category": "sports", "location": "Berlin, Deutschland", "images": ["https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=600&h=400&fit=crop"], "lat": 52.5200, "lng": 13.4050},
    
    # Books
    {"title": "Harry Potter Komplettset - Deutsch", "description": "Alle 7 Harry Potter Bücher auf Deutsch. Hardcover, sehr guter Zustand. Perfekt zum Sammeln oder Verschenken.", "price": 65.00, "category": "books", "location": "Frankfurt, Deutschland", "images": ["https://images.unsplash.com/photo-1589998059171-988d887df646?w=600&h=400&fit=crop"], "lat": 50.1109, "lng": 8.6821},
    
    # Music
    {"title": "Yamaha Keyboard PSR-E373", "description": "61 Tasten Keyboard mit Touch Response. 622 Instrumenten-Sounds, USB-Anschluss. Ideal für Anfänger.", "price": 189.00, "category": "music", "location": "Köln, Deutschland", "images": ["https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=600&h=400&fit=crop"], "lat": 50.9375, "lng": 6.9603},
    
    # Garden
    {"title": "Gartenmöbel-Set: Tisch + 4 Stühle", "description": "Wetterfestes Rattan-Set für Terrasse/Balkon. Tisch 120x80cm, 4 Stühle mit Kissen. Farbe: Braun.", "price": 250.00, "category": "garden", "location": "München, Deutschland", "images": ["https://images.unsplash.com/photo-1600210491892-03d54c0aaf87?w=600&h=400&fit=crop"], "lat": 48.1351, "lng": 11.5820},
    
    # More items (Dubai focus)
    {"title": "Dyson V15 Staubsauger - Neu", "description": "Brandneuer Dyson V15 Detect Absolute. Laser Dust Detection, LCD Display, 60 Min Laufzeit. Originalverpackt.", "price": 549.00, "category": "electronics", "location": "Dubai Marina, VAE", "images": ["https://images.unsplash.com/photo-1558317374-067fb5f30001?w=600&h=400&fit=crop"], "lat": 25.0805, "lng": 55.1400},
    
    {"title": "Gaming Setup: Monitor + Tastatur", "description": "27\" 144Hz Gaming Monitor + RGB Mechanical Keyboard. Perfekt für Gamer. Zustand: Neuwertig.", "price": 399.00, "category": "electronics", "location": "Abu Dhabi, VAE", "images": ["https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600&h=400&fit=crop"], "lat": 24.4539, "lng": 54.3773},
    
    {"title": "Gucci Sonnenbrille - Original", "description": "Echte Gucci Sonnenbrille für Damen. Mit Zertifikat und Etui. Kaum getragen, perfekter Zustand.", "price": 220.00, "category": "fashion", "location": "Dubai, VAE", "images": ["https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=600&h=400&fit=crop"], "lat": 25.2048, "lng": 55.2708},
    
    {"title": "Espressomaschine Sage Barista", "description": "Profi-Espressomaschine für zuhause. 15 Bar Druck, integrierte Kaffeemühle. Mit Milchaufschäumer.", "price": 399.00, "category": "home", "location": "Hamburg, Deutschland", "images": ["https://images.unsplash.com/photo-1611564355173-f2b7b80a55b0?w=600&h=400&fit=crop"], "lat": 53.5511, "lng": 9.9937},
]

# ══════════════════════════════════════════════════════════════════════════════
# JOBS (30 Jobs)
# ══════════════════════════════════════════════════════════════════════════════

JOBS_DATA = [
    # Delivery
    {"title": "Paket nach München liefern", "description": "Kleine Pakete (5kg) von Berlin nach München transportieren. Zeitfenster: Diese Woche.", "category": "delivery", "budget": 45.00, "location": "Berlin → München", "duration_hours": 6.0, "urgent": False, "lat": 52.5200, "lng": 13.4050},
    
    {"title": "Dokumente zu Notariat bringen - EILIG", "description": "Wichtige Unterlagen müssen heute noch zum Notar in Hamburg-Altstadt gebracht werden. Zeitkritisch!", "category": "delivery", "budget": 25.00, "location": "Hamburg, Deutschland", "duration_hours": 1.0, "urgent": True, "lat": 53.5511, "lng": 9.9937},
    
    # Shopping
    {"title": "Wocheneinkauf für Familie", "description": "Lebensmittel bei REWE einkaufen nach Liste (ca. 50 Artikel). Lieferung nach Frankfurt-Sachsenhausen.", "category": "shopping", "budget": 30.00, "location": "Frankfurt, Deutschland", "duration_hours": 2.0, "urgent": False, "lat": 50.1109, "lng": 8.6821},
    
    {"title": "Geschenke in Dubai Mall kaufen", "description": "3 Geschenke für Hochzeit in Dubai Mall besorgen. Budget €200. Geschmackvolle Auswahl wichtig!", "category": "shopping", "budget": 50.00, "location": "Dubai Mall, VAE", "duration_hours": 3.0, "urgent": False, "lat": 25.1972, "lng": 55.2744},
    
    # Cleaning
    {"title": "Wohnung putzen - 80qm", "description": "3-Zimmer-Wohnung in Berlin-Mitte gründlich putzen. Bad, Küche, Böden wischen, Staubsaugen.", "category": "cleaning", "budget": 60.00, "location": "Berlin-Mitte, Deutschland", "duration_hours": 4.0, "urgent": False, "lat": 52.5200, "lng": 13.4050},
    
    {"title": "Büro-Reinigung nach Umzug", "description": "Kleines Büro (30qm) nach Umzug reinigen. Fenster putzen, Böden wischen, Staub entfernen.", "category": "cleaning", "budget": 40.00, "location": "München, Deutschland", "duration_hours": 2.5, "urgent": True, "lat": 48.1351, "lng": 11.5820},
    
    # Tutoring
    {"title": "Mathe Nachhilfe - Klasse 10", "description": "Schüler (10. Klasse Gymnasium) braucht Mathe-Nachhilfe. Thema: Quadratische Funktionen. 2x pro Woche.", "category": "tutoring", "budget": 35.00, "location": "Hamburg, Deutschland", "duration_hours": 1.5, "urgent": False, "lat": 53.5511, "lng": 9.9937},
    
    {"title": "Englisch für Erwachsene", "description": "Business Englisch für Meetings üben. Level: B1/B2. Fokus auf Konversation und Präsentationen.", "category": "tutoring", "budget": 40.00, "location": "Frankfurt, Deutschland", "duration_hours": 2.0, "urgent": False, "lat": 50.1109, "lng": 8.6821},
    
    # Pet Care
    {"title": "Hund Gassi gehen - 1 Woche", "description": "Labrador (3 Jahre) braucht täglich 1h Spaziergang. Besitzer im Urlaub 7 Tage. Sehr lieber Hund!", "category": "petcare", "budget": 120.00, "location": "Berlin-Prenzlauer Berg", "duration_hours": 7.0, "urgent": False, "lat": 52.5400, "lng": 13.4200},
    
    {"title": "Katze füttern während Urlaub", "description": "2 Katzen müssen 5 Tage lang gefüttert werden. 2x täglich (morgens/abends). Katzenklo reinigen.", "category": "petcare", "budget": 75.00, "location": "München, Deutschland", "duration_hours": 5.0, "urgent": False, "lat": 48.1351, "lng": 11.5820},
    
    # Garden
    {"title": "Rasen mähen + Hecke schneiden", "description": "Großer Garten (300qm) in Vorort. Rasen mähen, Hecke trimmen, Unkraut jäten. Werkzeug vorhanden.", "category": "garden", "budget": 80.00, "location": "Hamburg-Blankenese", "duration_hours": 4.0, "urgent": False, "lat": 53.5600, "lng": 9.8000},
    
    # Moving
    {"title": "Umzugshilfe - 2-Zimmer-Wohnung", "description": "Umzug von Köln nach Bonn. 2 Zimmer, 3. Stock ohne Aufzug. Transporter vorhanden. 2 Helfer gesucht!", "category": "moving", "budget": 150.00, "location": "Köln → Bonn", "duration_hours": 5.0, "urgent": True, "lat": 50.9375, "lng": 6.9603},
    
    # Tech
    {"title": "PC aufsetzen + Software installieren", "description": "Neuer Gaming-PC muss aufgesetzt werden. Windows 11, Treiber, Steam, Discord installieren.", "category": "tech", "budget": 60.00, "location": "Berlin, Deutschland", "duration_hours": 2.0, "urgent": False, "lat": 52.5200, "lng": 13.4050},
    
    {"title": "WLAN-Router einrichten", "description": "Neuer Fritz!Box Router muss konfiguriert werden. WLAN-Reichweite optimieren, Gastnetz einrichten.", "category": "tech", "budget": 40.00, "location": "Frankfurt, Deutschland", "duration_hours": 1.5, "urgent": False, "lat": 50.1109, "lng": 8.6821},
    
    # Handyman
    {"title": "Möbel aufbauen - IKEA", "description": "IKEA PAX Kleiderschrank (2m breit) + Bett aufbauen. Werkzeug vorhanden. Erfahrung mit IKEA wichtig!", "category": "handyman", "budget": 70.00, "location": "München, Deutschland", "duration_hours": 3.0, "urgent": False, "lat": 48.1351, "lng": 11.5820},
    
    {"title": "Lampen montieren + Bohren", "description": "3 Deckenlampen montieren, Löcher bohren, Kabel verlegen. Handwerkliches Geschick erforderlich.", "category": "handyman", "budget": 55.00, "location": "Hamburg, Deutschland", "duration_hours": 2.5, "urgent": False, "lat": 53.5511, "lng": 9.9937},
    
    # Dubai/VAE specific
    {"title": "Flughafen Transfer - Dubai International", "description": "Abholung vom Dubai International Airport nach Dubai Marina. Mit Gepäck (2 Koffer). Pünktlichkeit wichtig!", "category": "delivery", "budget": 35.00, "location": "Dubai, VAE", "duration_hours": 1.0, "urgent": True, "lat": 25.2532, "lng": 55.3657},
    
    {"title": "Office-Dokumente übersetzen (AR→EN)", "description": "15 Seiten Geschäftsdokumente von Arabisch nach Englisch übersetzen. Fachkenntnisse Verträge hilfreich.", "category": "other", "budget": 120.00, "location": "Dubai, VAE", "duration_hours": 4.0, "urgent": False, "lat": 25.2048, "lng": 55.2708},
    
    {"title": "Personal Trainer für 2 Wochen", "description": "Fitnesstraining für Anfänger. 3x pro Woche, je 1 Stunde. Erfahrung mit Gewichtsverlust wichtig.", "category": "other", "budget": 300.00, "location": "Dubai Marina, VAE", "duration_hours": 6.0, "urgent": False, "lat": 25.0805, "lng": 55.1400},
    
    {"title": "Event-Fotografie - Hochzeit", "description": "Hochzeitsfeier in Burj Al Arab fotografieren. 6 Stunden, ca. 300 Fotos bearbeitet. Portfolio erforderlich!", "category": "other", "budget": 500.00, "location": "Dubai, VAE", "duration_hours": 6.0, "urgent": False, "lat": 25.1414, "lng": 55.1852},
]


async def seed_marketplace():
    """Seed marketplace listings"""
    print("🛒 Seeding Marketplace...")
    
    # Clear existing
    db.marketplace_listings.delete_many({})
    
    for item in MARKETPLACE_ITEMS:
        listing = {
            "listing_id": secrets.token_hex(8),
            "seller_email": "demo@bidblitz.ae",
            "seller_name": "BidBlitz Verkäufer",
            "title": item["title"],
            "description": item["description"],
            "price": item["price"],
            "category": item["category"],
            "images": item["images"],
            "location": item["location"],
            "lat": item.get("lat"),
            "lng": item.get("lng"),
            "negotiable": True,
            "shipping_available": True,
            "shipping_cost": 5.99,
            "status": "active",
            "views": 0,
            "favorites": 0,
            "messages_count": 0,
            "boost_until": None,
            "is_vip": False,
            "created_at": (datetime.now(timezone.utc) - timedelta(days=secrets.randbelow(30))).isoformat(),
        }
        db.marketplace_listings.insert_one(listing)
        print(f"✅ {item['title']}")
    
    print(f"✅ {len(MARKETPLACE_ITEMS)} Marketplace-Einträge erstellt!\n")


async def seed_jobs():
    """Seed BlitzJobs"""
    print("💼 Seeding BlitzJobs...")
    
    # Clear existing
    db.blitz_jobs.delete_many({})
    
    for job in JOBS_DATA:
        job_doc = {
            "job_id": f"job_{secrets.token_hex(6)}",
            "poster_email": "demo@bidblitz.ae",
            "poster_name": "BidBlitz User",
            "title": job["title"],
            "description": job["description"],
            "category": job["category"],
            "budget": job["budget"],
            "location": job["location"],
            "lat": job.get("lat"),
            "lng": job.get("lng"),
            "duration_hours": job["duration_hours"],
            "urgent": job["urgent"],
            "status": "open",
            "applicants": [],
            "created_at": (datetime.now(timezone.utc) - timedelta(hours=secrets.randbelow(72))).isoformat(),
        }
        db.blitz_jobs.insert_one(job_doc)
        print(f"✅ {job['title']}")
    
    print(f"✅ {len(JOBS_DATA)} Jobs erstellt!\n")


async def main():
    print("🚀 Starting BidBlitz Marketplace & Jobs Seeding...\n")
    await seed_marketplace()
    await seed_jobs()
    print("🎉 Seeding complete!")


if __name__ == "__main__":
    import sys
    sys.path.insert(0, '/app/backend')
    from dotenv import load_dotenv
    load_dotenv('/app/backend/.env')
    
    asyncio.run(main())
