"""Create 30 new mixed auctions starting at 0.01 EUR with real product photos"""
import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os
import random

MONGO_URL = os.environ.get("MONGO_URL", "mongodb+srv://sappicapp_db_user:nUEUHyexecwlc44T@afrimkrasniqi007.2uyxsqz.mongodb.net/bidblitz?retryWrites=true&w=majority")
DB_NAME = os.environ.get("DB_NAME", "bidblitz")

# 30 diverse products with real images
PRODUCTS = [
    {
        "name": "iPhone 16 Pro Max 256GB",
        "category": "Elektronik",
        "retail_price": 1499,
        "image_url": "https://images.unsplash.com/photo-1759588071790-9afb3fd61d23?w=400&q=80",
        "description": "Das neueste iPhone mit A18 Pro Chip, 48MP Kamera und Titan-Design"
    },
    {
        "name": "Samsung Galaxy S25 Ultra",
        "category": "Elektronik",
        "retail_price": 1399,
        "image_url": "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=400&q=80",
        "description": "Premium Android-Smartphone mit S Pen, 200MP Kamera und Galaxy AI"
    },
    {
        "name": "MacBook Pro M4 16 Zoll",
        "category": "Elektronik",
        "retail_price": 2999,
        "image_url": "https://images.unsplash.com/photo-1644171703660-81c9da68402b?w=400&q=80",
        "description": "Leistungsstarkes Notebook mit M4 Pro Chip und Liquid Retina XDR Display"
    },
    {
        "name": "Sony PlayStation 5 Pro",
        "category": "Elektronik",
        "retail_price": 799,
        "image_url": "https://images.unsplash.com/photo-1709587797077-7a2c94411514?w=400&q=80",
        "description": "Next-Gen Gaming-Konsole mit 8K Support und Ultra-Speed SSD"
    },
    {
        "name": "Apple AirPods Pro 3",
        "category": "Elektronik",
        "retail_price": 299,
        "image_url": "https://images.unsplash.com/photo-1755182529034-189a6051faae?w=400&q=80",
        "description": "Kabellose In-Ear-Kopfhoerer mit adaptivem ANC und Spatial Audio"
    },
    {
        "name": "iPad Pro M4 13 Zoll",
        "category": "Elektronik",
        "retail_price": 1599,
        "image_url": "https://images.unsplash.com/photo-1636614178501-e03f25a87516?w=400&q=80",
        "description": "Das duennste und leistungsstaerkste iPad aller Zeiten mit OLED Display"
    },
    {
        "name": "DJI Mavic 4 Pro Drohne",
        "category": "Elektronik",
        "retail_price": 1899,
        "image_url": "https://images.unsplash.com/photo-1497912653891-7fd58687cc4b?w=400&q=80",
        "description": "Profi-Drohne mit Hasselblad Kamera, 48MP und 46 Min Flugzeit"
    },
    {
        "name": "Nintendo Switch 2",
        "category": "Elektronik",
        "retail_price": 449,
        "image_url": "https://images.unsplash.com/photo-1709587796970-4e6bae1d4c68?w=400&q=80",
        "description": "Hybride Gaming-Konsole mit 8-Zoll LCD und verbesserter Leistung"
    },
    {
        "name": "Rolex Submariner Date",
        "category": "Mode & Accessoires",
        "retail_price": 10500,
        "image_url": "https://images.unsplash.com/photo-1749831754129-3a84b9fdeb87?w=400&q=80",
        "description": "Ikonische Taucheruhr in Edelstahl mit schwarzem Zifferblatt"
    },
    {
        "name": "Rolex Datejust 41",
        "category": "Mode & Accessoires",
        "retail_price": 8900,
        "image_url": "https://images.unsplash.com/photo-1572194812951-f9a56327d2f7?w=400&q=80",
        "description": "Klassische Luxusuhr in Gold/Stahl mit Jubilee-Band"
    },
    {
        "name": "Louis Vuitton Neverfull MM",
        "category": "Mode & Accessoires",
        "retail_price": 2030,
        "image_url": "https://images.unsplash.com/photo-1758171692659-024183c2c272?w=400&q=80",
        "description": "Zeitlose Designer-Handtasche aus Monogram Canvas"
    },
    {
        "name": "Gucci Marmont Tasche",
        "category": "Mode & Accessoires",
        "retail_price": 2350,
        "image_url": "https://images.unsplash.com/photo-1758959791346-66e1e8ab21ea?w=400&q=80",
        "description": "GG Marmont Schultertasche in Matelasse-Leder"
    },
    {
        "name": "Nike Air Jordan 1 Retro High OG",
        "category": "Mode & Accessoires",
        "retail_price": 189,
        "image_url": "https://images.unsplash.com/photo-1610664676996-84b489284b95?w=400&q=80",
        "description": "Legendaere Sneaker in limitierter Colorway Edition"
    },
    {
        "name": "Adidas Yeezy Boost 350 V2",
        "category": "Mode & Accessoires",
        "retail_price": 280,
        "image_url": "https://images.unsplash.com/photo-1715773408837-b7074beb12d5?w=400&q=80",
        "description": "Beliebte Lifestyle-Sneaker mit Boost-Technologie"
    },
    {
        "name": "Goldkette 750er 18K 50cm",
        "category": "Mode & Accessoires",
        "retail_price": 3200,
        "image_url": "https://images.pexels.com/photos/29502933/pexels-photo-29502933.jpeg?auto=compress&cs=tinysrgb&w=400",
        "description": "Massive 18 Karat Goldkette, Panzerkette, 50cm Laenge"
    },
    {
        "name": "Dyson V20 Detect Absolute",
        "category": "Haus & Garten",
        "retail_price": 799,
        "image_url": "https://images.unsplash.com/photo-1722710070534-e31f0290d8de?w=400&q=80",
        "description": "Kabelloser Staubsauger mit Laser-Stauberkennung und 70 Min Akku"
    },
    {
        "name": "iRobot Roomba j9+ Combo",
        "category": "Haus & Garten",
        "retail_price": 1099,
        "image_url": "https://images.unsplash.com/photo-1765970101376-4d5153f56e81?w=400&q=80",
        "description": "Saug- und Wischroboter mit automatischer Absaugstation"
    },
    {
        "name": "De'Longhi Magnifica Evo",
        "category": "Haus & Garten",
        "retail_price": 599,
        "image_url": "https://images.unsplash.com/photo-1637029765108-b2eec167fc83?w=400&q=80",
        "description": "Kaffeevollautomat mit LatteCrema-System und 13 Spezialitaeten"
    },
    {
        "name": "KitchenAid Artisan 5KSM185",
        "category": "Haus & Garten",
        "retail_price": 649,
        "image_url": "https://images.unsplash.com/photo-1619912922763-79c213e10263?w=400&q=80",
        "description": "Premium Kuechenmaschine mit planetarischem Ruehrsystem"
    },
    {
        "name": "E-Bike Cube Reaction Pro 750",
        "category": "Sport & Freizeit",
        "retail_price": 3299,
        "image_url": "https://images.unsplash.com/photo-1722250588825-69a41ddfe100?w=400&q=80",
        "description": "E-Mountainbike mit Bosch CX Motor und 750Wh Akku"
    },
    {
        "name": "E-Scooter Xiaomi Pro 4",
        "category": "Sport & Freizeit",
        "retail_price": 699,
        "image_url": "https://images.unsplash.com/photo-1719885959194-44c60b62508b?w=400&q=80",
        "description": "Elektroroller mit 50km Reichweite und Strassenzulassung"
    },
    {
        "name": "GoPro Hero 13 Black",
        "category": "Sport & Freizeit",
        "retail_price": 449,
        "image_url": "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400&q=80",
        "description": "Action-Kamera mit 5.3K60 Video, HyperSmooth 7.0 und GPS"
    },
    {
        "name": "Sony WH-1000XM6",
        "category": "Elektronik",
        "retail_price": 399,
        "image_url": "https://images.unsplash.com/photo-1677346414290-d337cbc682a6?w=400&q=80",
        "description": "Premium Over-Ear-Kopfhoerer mit bestem ANC und 40h Akku"
    },
    {
        "name": "Samsung Galaxy Tab S10 Ultra",
        "category": "Elektronik",
        "retail_price": 1299,
        "image_url": "https://images.unsplash.com/photo-1636614223954-db6a663293ef?w=400&q=80",
        "description": "14.6 Zoll AMOLED Tablet mit S Pen und Galaxy AI"
    },
    {
        "name": "Xbox Series X 2TB",
        "category": "Elektronik",
        "retail_price": 599,
        "image_url": "https://images.unsplash.com/photo-1709587797203-b28ef0e16e31?w=400&q=80",
        "description": "Leistungsstaerkste Xbox mit 2TB SSD und 4K Gaming"
    },
    {
        "name": "Omega Speedmaster Moonwatch",
        "category": "Mode & Accessoires",
        "retail_price": 7100,
        "image_url": "https://images.unsplash.com/photo-1763923025466-fa424ebe01b1?w=400&q=80",
        "description": "Legendaerer Chronograph - die Uhr auf dem Mond"
    },
    {
        "name": "Ray-Ban Meta Smart Glasses",
        "category": "Elektronik",
        "retail_price": 379,
        "image_url": "https://images.unsplash.com/photo-1759933253608-ba60cfb8dcf0?w=400&q=80",
        "description": "Smarte Sonnenbrille mit Kamera, Lautsprecher und Meta AI"
    },
    {
        "name": "Garmin Fenix 8 Pro Solar",
        "category": "Sport & Freizeit",
        "retail_price": 999,
        "image_url": "https://images.pexels.com/photos/32988685/pexels-photo-32988685.jpeg?auto=compress&cs=tinysrgb&w=400",
        "description": "Premium GPS-Multisportuhr mit AMOLED, Solar und Taschenlampe"
    },
    {
        "name": "Nespresso Vertuo Next Premium",
        "category": "Haus & Garten",
        "retail_price": 199,
        "image_url": "https://images.unsplash.com/photo-1664135974084-465ca3fcf5ab?w=400&q=80",
        "description": "Kapsel-Kaffeemaschine fuer Espresso bis XL-Tasse"
    },
    {
        "name": "Peloton Bike+ Heimtrainer",
        "category": "Sport & Freizeit",
        "retail_price": 2495,
        "image_url": "https://images.unsplash.com/photo-1610664676282-55c8de64f746?w=400&q=80",
        "description": "Premium Indoor-Bike mit drehbarem 24-Zoll HD Touchscreen"
    },
]

async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    print("=== Alte Auktionen loeschen ===")
    result = await db.auctions.delete_many({})
    print(f"  {result.deleted_count} Auktionen geloescht")

    # Delete old products (keep a backup)
    old_products = await db.products.find({}, {"_id": 0}).to_list(1000)
    print(f"  {len(old_products)} alte Produkte vorhanden (werden ersetzt)")
    await db.products.delete_many({})

    print("\n=== 30 neue Produkte erstellen ===")
    now = datetime.now(timezone.utc)

    # Create products
    for i, p in enumerate(PRODUCTS):
        product_id = f"prod-new-{i+1:03d}"
        doc = {
            "id": product_id,
            "name": p["name"],
            "name_de": p["name"],
            "category": p["category"],
            "retail_price": p["retail_price"],
            "image_url": p["image_url"],
            "description": p["description"],
            "description_translations": {
                "de": p["description"],
                "en": p["description"],
            },
            "name_translations": {
                "de": p["name"],
                "en": p["name"],
            },
            "created_at": now.isoformat(),
        }
        await db.products.insert_one(doc)
        print(f"  [{i+1}] {p['name']} (EUR {p['retail_price']})")

    print("\n=== 30 Auktionen erstellen (ab 0.01 EUR) ===")

    # Shuffle order for variety
    product_indices = list(range(len(PRODUCTS)))
    random.shuffle(product_indices)

    # Check time for night auction logic
    now_berlin = datetime.now(timezone.utc) + timedelta(hours=1)
    current_hour = now_berlin.hour + now_berlin.minute / 60
    is_night_time = current_hour >= 23.5 or current_hour < 6

    for i, idx in enumerate(product_indices):
        p = PRODUCTS[idx]
        product_id = f"prod-new-{idx+1:03d}"

        # Random durations between 2-72 hours for variety
        duration_hours = random.choice([2, 4, 6, 8, 12, 24, 36, 48, 72])
        duration_seconds = duration_hours * 3600
        end_time = now + timedelta(seconds=duration_seconds)

        # Determine auction type (mostly normal, some special)
        is_night = False
        is_vip = False
        is_beginner = False
        is_free = False

        # Make 3 night auctions, 2 VIP, 2 beginner
        if i < 3:
            is_night = True
        elif i < 5:
            is_vip = True
        elif i < 7:
            is_beginner = True

        # Status based on type and time
        status = "active"
        if is_night and not is_night_time:
            status = "night_paused"

        # Bot target price (for bot bidding simulation)
        bot_target = round(random.uniform(1.5, 15.0), 2)

        auction_id = str(uuid.uuid4())
        doc = {
            "id": auction_id,
            "product_id": product_id,
            "title": p["name"],
            "description": p["description"],
            "category": p["category"],
            "starting_price": 0.01,
            "current_price": 0.01,
            "bid_increment": 0.01,
            "start_time": now.isoformat(),
            "end_time": end_time.isoformat(),
            "duration_seconds": duration_seconds,
            "status": status,
            "total_bids": 0,
            "bid_count": 0,
            "last_bidder_id": None,
            "last_bidder_name": None,
            "last_bid_time": None,
            "winner_id": None,
            "winner_name": None,
            "bid_history": [],
            "bot_target_price": bot_target,
            "buy_now_price": round(p["retail_price"] * 0.5, 2),
            "retail_price": p["retail_price"],
            "is_night_auction": is_night,
            "is_vip_only": is_vip,
            "is_beginner_only": is_beginner,
            "is_beginner_auction": is_beginner,
            "is_free_auction": is_free,
            "is_gift_auction": False,
            "auction_type": "normal",
            "created_at": now.isoformat(),
        }
        await db.auctions.insert_one(doc)

        type_label = ""
        if is_night:
            type_label = " [NACHT]"
        elif is_vip:
            type_label = " [VIP]"
        elif is_beginner:
            type_label = " [ANFAENGER]"

        print(f"  [{i+1}] {p['name']} | {duration_hours}h | 0.01 EUR{type_label}")

    # Verify
    count = await db.auctions.count_documents({})
    active = await db.auctions.count_documents({"status": "active"})
    print(f"\n=== FERTIG: {count} Auktionen erstellt ({active} aktiv) ===")

    client.close()

if __name__ == "__main__":
    asyncio.run(main())
