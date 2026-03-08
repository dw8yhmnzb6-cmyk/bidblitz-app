"""
Seed Script: 50 Produkte 2026 & 50 Auktionen (6 Tage gemischt)
BidBlitz.ae
"""
import asyncio
import uuid
import random
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "bidblitz")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# 50 Produkte für 2026
PRODUCTS_2026 = [
    # Smartphones
    {"name": "iPhone 17 Pro Max", "description": "Das neueste Apple Flaggschiff mit A20 Chip, 8K Kamera und 1TB Speicher. Das ultimative iPhone-Erlebnis 2026.", "category": "Smartphones", "retail_price": 1899.00, "image_url": "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?w=800"},
    {"name": "iPhone 17 Pro", "description": "Apple iPhone 17 Pro mit ProMotion Display, revolutionärer KI-Fotografie und titanischem Rahmen.", "category": "Smartphones", "retail_price": 1599.00, "image_url": "https://images.unsplash.com/photo-1591337676887-a217a6970a8a?w=800"},
    {"name": "iPhone 17", "description": "Das neue iPhone 17 mit Dynamic Island 2.0, ganztägiger Akkulaufzeit und 5G Plus.", "category": "Smartphones", "retail_price": 1199.00, "image_url": "https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=800"},
    {"name": "Samsung Galaxy S26 Ultra", "description": "Galaxy S26 Ultra mit 200MP Kamera, S Pen Pro und revolutionärem Galaxy AI 2.0.", "category": "Smartphones", "retail_price": 1799.00, "image_url": "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800"},
    {"name": "Samsung Galaxy S26+", "description": "Samsung Galaxy S26+ mit AMOLED 2X Display, 100x Space Zoom und 5000mAh Akku.", "category": "Smartphones", "retail_price": 1399.00, "image_url": "https://images.unsplash.com/photo-1585060544812-6b45742d762f?w=800"},
    {"name": "Samsung Galaxy Z Fold 6", "description": "Das faltbare Meisterwerk: Galaxy Z Fold 6 mit größerem Außendisplay und verbesserter Falz.", "category": "Smartphones", "retail_price": 2199.00, "image_url": "https://images.unsplash.com/photo-1628815113969-0489084eb990?w=800"},
    {"name": "Google Pixel 10 Pro", "description": "Google Pixel 10 Pro mit Tensor G5 Chip, AI-Magic-Eraser 3.0 und 7 Jahren Updates.", "category": "Smartphones", "retail_price": 1299.00, "image_url": "https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=800"},
    {"name": "OnePlus 14 Pro", "description": "OnePlus 14 Pro mit Hasselblad 2.0 Kamera, 150W SuperVOOC und Snapdragon 8 Gen 5.", "category": "Smartphones", "retail_price": 1099.00, "image_url": "https://images.unsplash.com/photo-1546054454-aa26e2b734c7?w=800"},
    {"name": "Xiaomi 16 Ultra", "description": "Xiaomi 16 Ultra mit Leica 4.0 Optik, 120W HyperCharge und Liquid-Cooling.", "category": "Smartphones", "retail_price": 1199.00, "image_url": "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800"},
    {"name": "Huawei Mate 70 Pro", "description": "Huawei Mate 70 Pro mit Kirin 9100, revolutionärer AI-Kamera und HarmonyOS 5.", "category": "Smartphones", "retail_price": 1499.00, "image_url": "https://images.unsplash.com/photo-1574944985070-8f3ebc6b79d2?w=800"},
    
    # Laptops & Computer
    {"name": "MacBook Pro 16\" M5 Max", "description": "MacBook Pro 2026 mit M5 Max Chip, 48-Core GPU und 128GB RAM. Für Profis.", "category": "Laptops", "retail_price": 4299.00, "image_url": "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800"},
    {"name": "MacBook Pro 14\" M5 Pro", "description": "MacBook Pro 14 Zoll mit M5 Pro, Liquid Retina XDR und 22h Akkulaufzeit.", "category": "Laptops", "retail_price": 2799.00, "image_url": "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=800"},
    {"name": "MacBook Air 15\" M5", "description": "Das dünnste MacBook Air mit M5 Chip, ganztägiger Batterielaufzeit und MagSafe.", "category": "Laptops", "retail_price": 1699.00, "image_url": "https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=800"},
    {"name": "Dell XPS 15 2026", "description": "Dell XPS 15 mit Intel Core Ultra 9, OLED Display und Thunderbolt 5.", "category": "Laptops", "retail_price": 2299.00, "image_url": "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=800"},
    {"name": "Lenovo ThinkPad X1 Carbon 2026", "description": "ThinkPad X1 Carbon Gen 13 mit AI-Copilot, 4K OLED und 5G LTE.", "category": "Laptops", "retail_price": 2199.00, "image_url": "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800"},
    {"name": "ASUS ROG Zephyrus G16 2026", "description": "Gaming-Laptop mit RTX 5090, Intel i9-15900K und 240Hz OLED.", "category": "Gaming", "retail_price": 3299.00, "image_url": "https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=800"},
    {"name": "HP Spectre x360 2026", "description": "Premium 2-in-1 mit OLED Touch, Intel Core Ultra 7 und Thunderbolt 5.", "category": "Laptops", "retail_price": 1899.00, "image_url": "https://images.unsplash.com/photo-1544731612-de7f96afe55f?w=800"},
    
    # Tablets
    {"name": "iPad Pro 13\" M5", "description": "iPad Pro 2026 mit M5 Chip, tandem OLED XDR und Apple Pencil Pro 2.", "category": "Tablets", "retail_price": 1799.00, "image_url": "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800"},
    {"name": "iPad Pro 11\" M5", "description": "Kompaktes iPad Pro mit M5 Power, nano-texture Display und Face ID.", "category": "Tablets", "retail_price": 1299.00, "image_url": "https://images.unsplash.com/photo-1585790050230-5dd28404ccb9?w=800"},
    {"name": "iPad Air 2026", "description": "iPad Air mit M4 Chip, Liquid Retina Display und Magic Keyboard Support.", "category": "Tablets", "retail_price": 899.00, "image_url": "https://images.unsplash.com/photo-1561154464-82e9adf32764?w=800"},
    {"name": "Samsung Galaxy Tab S10 Ultra", "description": "Galaxy Tab S10 Ultra mit 14.6\" AMOLED, DeX Mode 3.0 und S Pen.", "category": "Tablets", "retail_price": 1399.00, "image_url": "https://images.unsplash.com/photo-1632634255468-d36e3d54d2c8?w=800"},
    
    # Wearables
    {"name": "Apple Watch Ultra 4", "description": "Apple Watch Ultra 4 mit Satellitenverbindung, 72h Akku und Tauch-Computer.", "category": "Wearables", "retail_price": 999.00, "image_url": "https://images.unsplash.com/photo-1434494878577-86c23bcb06b9?w=800"},
    {"name": "Apple Watch Series 12", "description": "Apple Watch Series 12 mit Blutzuckermessung und komplett neues Design.", "category": "Wearables", "retail_price": 599.00, "image_url": "https://images.unsplash.com/photo-1551816230-ef5deaed4a26?w=800"},
    {"name": "Samsung Galaxy Watch 8 Ultra", "description": "Galaxy Watch 8 Ultra mit Titan-Gehäuse, BIA-Sensor und 100h GPS.", "category": "Wearables", "retail_price": 749.00, "image_url": "https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=800"},
    {"name": "AirPods Pro 4", "description": "AirPods Pro 4 mit verlustfreiem Audio, AI-Hearing und USB-C Ladecase.", "category": "Audio", "retail_price": 349.00, "image_url": "https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?w=800"},
    {"name": "AirPods Max 2", "description": "AirPods Max 2 mit Spatial Audio Pro, verbessertem ANC und Alu-Mesh.", "category": "Audio", "retail_price": 699.00, "image_url": "https://images.unsplash.com/photo-1613040809024-b4ef7ba99bc3?w=800"},
    
    # Gaming
    {"name": "PlayStation 6", "description": "Sony PlayStation 6 mit 8K Gaming, Ray Tracing Pro und DualSense 2.", "category": "Gaming", "retail_price": 699.00, "image_url": "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=800"},
    {"name": "Xbox Series X Pro", "description": "Microsoft Xbox Series X Pro mit 4K/120fps, Quick Resume 2.0 und Game Pass Ultimate.", "category": "Gaming", "retail_price": 649.00, "image_url": "https://images.unsplash.com/photo-1621259182978-fbf93132d53d?w=800"},
    {"name": "Nintendo Switch 3", "description": "Nintendo Switch 3 mit 4K Docking, OLED Pro Screen und Joy-Con Pro.", "category": "Gaming", "retail_price": 449.00, "image_url": "https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?w=800"},
    {"name": "Steam Deck 2", "description": "Valve Steam Deck 2 mit AMD Zen 5, OLED Display und 1TB SSD.", "category": "Gaming", "retail_price": 649.00, "image_url": "https://images.unsplash.com/photo-1640955014216-75201056c829?w=800"},
    {"name": "NVIDIA GeForce RTX 5090", "description": "RTX 5090 mit 32GB GDDR7, DLSS 5.0 und AI-Frame Generation.", "category": "Gaming", "retail_price": 2299.00, "image_url": "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=800"},
    
    # TV & Home
    {"name": "Samsung QN95D Neo QLED 85\"", "description": "Samsung 85\" Neo QLED 8K mit AI-Upscaling, Dolby Atmos und One Connect.", "category": "TV", "retail_price": 4999.00, "image_url": "https://images.unsplash.com/photo-1593784991095-a205069470b6?w=800"},
    {"name": "LG OLED G5 77\"", "description": "LG OLED evo G5 77\" mit MLA-Technologie, Dolby Vision IQ und Gaming Hub.", "category": "TV", "retail_price": 3799.00, "image_url": "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800"},
    {"name": "Sony Bravia XR A95M 65\"", "description": "Sony Bravia XR QD-OLED 65\" mit Cognitive Processor XR und Acoustic Surface.", "category": "TV", "retail_price": 2999.00, "image_url": "https://images.unsplash.com/photo-1461151304267-38535e780c79?w=800"},
    {"name": "Apple TV 4K 2026", "description": "Apple TV 4K mit A17 Pro Chip, Thread Border Router und FaceTime Kamera.", "category": "TV", "retail_price": 229.00, "image_url": "https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=800"},
    {"name": "Sonos Arc Ultra", "description": "Sonos Arc Ultra Soundbar mit Spatial Audio 3.0, Dolby Atmos und AirPlay 3.", "category": "Audio", "retail_price": 1099.00, "image_url": "https://images.unsplash.com/photo-1545454675-3531b543be5d?w=800"},
    
    # Smart Home
    {"name": "Apple HomePod 3", "description": "HomePod 3 mit Spatial Audio, Matter Support und Privacy-First Siri.", "category": "Smart Home", "retail_price": 399.00, "image_url": "https://images.unsplash.com/photo-1558089687-f282ffcbc126?w=800"},
    {"name": "Google Nest Hub Max 2", "description": "Nest Hub Max 2 mit 12\" Display, verbesserten Kameras und Gemini AI.", "category": "Smart Home", "retail_price": 349.00, "image_url": "https://images.unsplash.com/photo-1558002038-1055907df827?w=800"},
    {"name": "Amazon Echo Studio 2", "description": "Echo Studio 2 mit Hi-Res Audio, 3D-Sound und Matter Integration.", "category": "Smart Home", "retail_price": 249.00, "image_url": "https://images.unsplash.com/photo-1543512214-318c7553f230?w=800"},
    {"name": "Ring Video Doorbell 6 Pro", "description": "Ring Doorbell 6 Pro mit 4K Video, Pre-Roll, Package Detection.", "category": "Smart Home", "retail_price": 299.00, "image_url": "https://images.unsplash.com/photo-1558002038-1055907df827?w=800"},
    {"name": "Philips Hue Gradient Lightstrip 3m", "description": "Hue Gradient Lightstrip mit 16 Mio. Farben und Sync Box Kompatibilität.", "category": "Smart Home", "retail_price": 199.00, "image_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800"},
    
    # Kameras
    {"name": "Sony Alpha A9 IV", "description": "Sony A9 IV mit 61MP Sensor, 8K Video und AI-Tracking für Profis.", "category": "Kameras", "retail_price": 6499.00, "image_url": "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800"},
    {"name": "Canon EOS R6 Mark III", "description": "Canon EOS R6 III mit 35MP, 8K Video und verbessertem IBIS.", "category": "Kameras", "retail_price": 3299.00, "image_url": "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=800"},
    {"name": "DJI Mavic 5 Pro", "description": "DJI Mavic 5 Pro Drohne mit 8K Kamera, 50 Min Flugzeit und AI-Tracking.", "category": "Kameras", "retail_price": 2199.00, "image_url": "https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=800"},
    {"name": "GoPro Hero 14 Black", "description": "GoPro Hero 14 mit 8K Video, GPS, HyperSmooth 7.0 und wasserdicht.", "category": "Kameras", "retail_price": 549.00, "image_url": "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800"},
    {"name": "Insta360 X5", "description": "Insta360 X5 mit 12K 360° Video, Invisible Selfie Stick und FlowState.", "category": "Kameras", "retail_price": 699.00, "image_url": "https://images.unsplash.com/photo-1613727798351-3b7c7d5c6f37?w=800"},
    
    # E-Mobilität
    {"name": "Xiaomi Electric Scooter 5 Pro", "description": "Xiaomi E-Scooter 5 Pro mit 60km Reichweite, App-Steuerung und Blinker.", "category": "E-Mobilität", "retail_price": 899.00, "image_url": "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=800"},
    {"name": "Segway Ninebot MAX G65", "description": "Ninebot MAX G65 mit 65km Reichweite, Stoßdämpfern und IPX7.", "category": "E-Mobilität", "retail_price": 1099.00, "image_url": "https://images.unsplash.com/photo-1604868189265-219ba7ffc595?w=800"},
    {"name": "VanMoof V", "description": "VanMoof V E-Bike mit 60km/h, Anti-Diebstahl-Tracking und App.", "category": "E-Mobilität", "retail_price": 3498.00, "image_url": "https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?w=800"},
    
    # Luxus & Lifestyle
    {"name": "Dyson V20 Detect", "description": "Dyson V20 mit Laser-Stauberkennung, 90 Min Laufzeit und HEPA.", "category": "Haushalt", "retail_price": 899.00, "image_url": "https://images.unsplash.com/photo-1558317374-067fb5f30001?w=800"},
    {"name": "Dyson Airwrap 2.0", "description": "Dyson Airwrap 2.0 Multi-Styler mit verbessertem Coanda-Effekt.", "category": "Beauty", "retail_price": 599.00, "image_url": "https://images.unsplash.com/photo-1522338242042-2d1c0ea11d16?w=800"},
]

async def seed_products():
    """Insert 50 products for 2026"""
    print("🚀 Starte Produkt-Seeding für 2026...")
    
    inserted = 0
    for product in PRODUCTS_2026:
        product_id = str(uuid.uuid4())
        doc = {
            "id": product_id,
            "name": product["name"],
            "description": product["description"],
            "image_url": product["image_url"],
            "retail_price": product["retail_price"],
            "category": product["category"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "name_translations": {"de": product["name"]},
            "description_translations": {"de": product["description"]}
        }
        
        # Check if product already exists
        existing = await db.products.find_one({"name": product["name"]})
        if not existing:
            await db.products.insert_one(doc)
            inserted += 1
            print(f"✅ Produkt erstellt: {product['name']}")
        else:
            print(f"⏭️ Produkt existiert bereits: {product['name']}")
    
    print(f"\n📦 {inserted} neue Produkte erstellt!")
    return inserted

async def seed_auctions():
    """Create 50 auctions spread over 6 days"""
    print("\n🎯 Starte Auktions-Seeding (6 Tage gemischt)...")
    
    # Get all 2026 products
    products = await db.products.find(
        {"name": {"$regex": "2026|17|S26|M5|Ultra 4|Series 12|Watch 8|Pro 4|Max 2|6|X Pro|3|V20|2.0", "$options": "i"}},
        {"_id": 0}
    ).to_list(100)
    
    if not products:
        # Fallback: get any products
        products = await db.products.find({}, {"_id": 0}).to_list(100)
    
    if not products:
        print("❌ Keine Produkte gefunden!")
        return 0
    
    print(f"📦 {len(products)} Produkte gefunden")
    
    now = datetime.now(timezone.utc)
    inserted = 0
    
    # Create 50 auctions over 6 days
    for i in range(50):
        product = random.choice(products)
        
        # Spread auctions over 6 days (randomly distributed)
        day_offset = random.randint(0, 5)  # 0-5 Tage
        hour_offset = random.randint(0, 23)  # 0-23 Stunden
        minute_offset = random.randint(0, 59)  # 0-59 Minuten
        
        start_time = now + timedelta(days=day_offset, hours=hour_offset, minutes=minute_offset)
        
        # Duration: 2-4 hours
        duration_hours = random.choice([2, 3, 4])
        end_time = start_time + timedelta(hours=duration_hours)
        
        # Starting price: €0.01
        starting_price = 0.01
        
        # Bot target price: 3-8% of retail price
        retail = product.get("retail_price", 100)
        bot_target = round(retail * random.uniform(0.03, 0.08), 2)
        bot_target = max(10, min(bot_target, 100))  # €10 - €100
        
        # Buy now price: 50-70% of retail
        buy_now_price = round(retail * random.uniform(0.50, 0.70), 2)
        
        # Auction type distribution
        auction_types = ["normal"] * 10 + ["beginner"] * 3 + ["vip"] * 2
        auction_type = random.choice(auction_types)
        
        auction_id = str(uuid.uuid4())
        
        auction_doc = {
            "id": auction_id,
            "product_id": product["id"],
            "title": product["name"],
            "starting_price": starting_price,
            "current_price": starting_price,
            "current_bid": starting_price,
            "bid_increment": 0.01,
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "duration_seconds": duration_hours * 3600,
            "bot_target_price": bot_target,
            "buy_now_price": buy_now_price,
            "retail_price": retail,
            "status": "scheduled" if start_time > now else "active",
            "auction_type": auction_type,
            "is_beginner_auction": auction_type == "beginner",
            "is_vip_only": auction_type == "vip",
            "is_night_auction": False,
            "is_free_auction": False,
            "total_bids": 0,
            "bid_count": 0,
            "last_bidder": None,
            "last_bidder_id": None,
            "last_bidder_name": None,
            "bid_history": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "product": product  # Embed product info
        }
        
        await db.auctions.insert_one(auction_doc)
        inserted += 1
        
        day_label = ["Heute", "Morgen", "Tag 3", "Tag 4", "Tag 5", "Tag 6"][day_offset]
        print(f"✅ Auktion #{i+1}: {product['name'][:40]} | {day_label} {start_time.strftime('%H:%M')} | €{retail:.0f} UVP | Bot: €{bot_target:.2f}")
    
    print(f"\n🎯 {inserted} Auktionen erstellt (über 6 Tage verteilt)!")
    return inserted

async def main():
    print("=" * 60)
    print("🎮 BidBlitz 2026 Product & Auction Seeder")
    print("=" * 60)
    
    products_count = await seed_products()
    auctions_count = await seed_auctions()
    
    print("\n" + "=" * 60)
    print(f"✅ FERTIG!")
    print(f"   📦 {products_count} Produkte erstellt")
    print(f"   🎯 {auctions_count} Auktionen erstellt")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
