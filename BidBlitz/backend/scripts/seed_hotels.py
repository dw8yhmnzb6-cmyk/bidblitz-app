"""
Seed Hotels/Unterkünfte aus Deutschland & Dubai mit echten Fotos
"""
import secrets
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient
import os

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

client = MongoClient(MONGO_URL)
db = client[DB_NAME]

# ══════════════════════════════════════════════════════════════════════════════
# HOTELS & UNTERKÜNFTE (30)
# ══════════════════════════════════════════════════════════════════════════════

PROPERTIES = [
    # Deutschland - Berlin
    {"title": "Luxus-Apartment am Alexanderplatz", "description": "Modernes 2-Zimmer-Apartment im Herzen Berlins. 5 Min zu Fuß zum Alexanderplatz. Voll ausgestattet mit W-Lan, Smart-TV, Küche. Perfekt für Städtereisen!", "property_type": "apartment", "city": "Berlin", "address": "Alexanderstraße 7, 10178 Berlin", "price_per_night": 89.00, "max_guests": 4, "bedrooms": 2, "bathrooms": 1, "amenities": ["wifi", "tv", "kitchen", "elevator"], "images": ["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=500&fit=crop"], "rating": 4.8},
    
    {"title": "Gemütliches Studio in Kreuzberg", "description": "Helles Studio-Apartment in angesagtem Kiez. Balkon, modernes Bad, voll möbliert. Bars, Cafés & Restaurants vor der Tür. U-Bahn 2 Min.", "property_type": "apartment", "city": "Berlin", "address": "Oranienstraße 45, 10999 Berlin", "price_per_night": 65.00, "max_guests": 2, "bedrooms": 1, "bathrooms": 1, "amenities": ["wifi", "balcony", "kitchen"], "images": ["https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=500&fit=crop"], "rating": 4.6},
    
    # München
    {"title": "Designer-Loft nahe Marienplatz", "description": "Exklusives 100qm Loft mit Dachterrasse. 10 Min zu Fuß zum Marienplatz. Hochwertige Ausstattung, offene Küche, 2 Schlafzimmer. Business & Leisure perfekt.", "property_type": "apartment", "city": "München", "address": "Sendlinger Straße 12, 80331 München", "price_per_night": 140.00, "max_guests": 4, "bedrooms": 2, "bathrooms": 2, "amenities": ["wifi", "ac", "terrace", "dishwasher"], "images": ["https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&h=500&fit=crop"], "rating": 4.9},
    
    {"title": "Apartment mit Alpenblick", "description": "2-Zimmer-Wohnung in Schwabing mit Blick auf die Alpen (bei gutem Wetter). Ruhig gelegen, U-Bahn 5 Min. Ideal für Familien.", "property_type": "apartment", "city": "München", "address": "Leopoldstraße 88, 80802 München", "price_per_night": 95.00, "max_guests": 3, "bedrooms": 1, "bathrooms": 1, "amenities": ["wifi", "parking", "kitchen"], "images": ["https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=800&h=500&fit=crop"], "rating": 4.5},
    
    # Hamburg
    {"title": "Hafenblick-Apartment Elbphilharmonie", "description": "Atemberaubende Aussicht auf Elbe & Hafen. Direkt an der HafenCity. Modern, stylish, zentral. 3 Zimmer, Balkon, Premium-Ausstattung.", "property_type": "apartment", "city": "Hamburg", "address": "Am Kaiserkai 10, 20457 Hamburg", "price_per_night": 120.00, "max_guests": 5, "bedrooms": 2, "bathrooms": 1, "amenities": ["wifi", "balcony", "tv", "elevator"], "images": ["https://images.unsplash.com/photo-1564078516393-cf04bd966897?w=800&h=500&fit=crop"], "rating": 4.9},
    
    {"title": "Gemütliches Zimmer in Altona", "description": "Privatzimmer in WG-Wohnung. Gemeinschaftsküche, Bad zur Mitbenutzung. Sehr zentral, S-Bahn Altona 3 Min. Budget-friendly!", "property_type": "room", "city": "Hamburg", "address": "Ottenser Hauptstraße 28, 22765 Hamburg", "price_per_night": 35.00, "max_guests": 1, "bedrooms": 1, "bathrooms": 1, "amenities": ["wifi", "kitchen"], "images": ["https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=800&h=500&fit=crop"], "rating": 4.3},
    
    # Frankfurt
    {"title": "Business-Apartment Bankenviertel", "description": "Modernes 1-Zimmer-Apartment perfekt für Geschäftsreisende. Schreibtisch, Highspeed-Internet, 24/7 Check-in. 5 Min zur Messe Frankfurt.", "property_type": "apartment", "city": "Frankfurt", "address": "Mainzer Landstraße 50, 60325 Frankfurt", "price_per_night": 85.00, "max_guests": 2, "bedrooms": 1, "bathrooms": 1, "amenities": ["wifi", "desk", "elevator", "ac"], "images": ["https://images.unsplash.com/photo-1554995207-c18c203602cb?w=800&h=500&fit=crop"], "rating": 4.7},
    
    # Köln
    {"title": "Loft am Rhein mit Dom-Blick", "description": "Einzigartiges Industrial-Loft mit Panoramafenster zum Kölner Dom. 80qm, 2 Etagen, voll ausgestattet. Traumlage direkt am Rheinufer.", "property_type": "apartment", "city": "Köln", "address": "Rheinuferstraße 15, 50679 Köln", "price_per_night": 130.00, "max_guests": 4, "bedrooms": 2, "bathrooms": 1, "amenities": ["wifi", "tv", "kitchen", "view"], "images": ["https://images.unsplash.com/photo-1502672023488-70e25813eb80?w=800&h=500&fit=crop"], "rating": 4.8},
    
    # Dubai - Luxury
    {"title": "Luxury Suite Burj Khalifa View", "description": "Spectacular 2-bedroom suite on 40th floor with direct Burj Khalifa view. Dubai Mall 5min walk. Pool, gym, concierge. 5-star amenities!", "property_type": "apartment", "city": "Dubai", "address": "Downtown Dubai, Sheikh Mohammed bin Rashid Blvd", "price_per_night": 250.00, "max_guests": 4, "bedrooms": 2, "bathrooms": 2, "amenities": ["wifi", "pool", "gym", "ac", "parking"], "images": ["https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?w=800&h=500&fit=crop"], "rating": 5.0},
    
    {"title": "Penthouse Dubai Marina", "description": "Stunning 3-bedroom penthouse with panoramic Marina views. Private terrace, jacuzzi, chef's kitchen. Walk to beach, restaurants & nightlife.", "property_type": "apartment", "city": "Dubai", "address": "Dubai Marina, Emaar Beachfront", "price_per_night": 320.00, "max_guests": 6, "bedrooms": 3, "bathrooms": 3, "amenities": ["wifi", "pool", "gym", "ac", "balcony", "jacuzzi"], "images": ["https://images.unsplash.com/photo-1568084680786-a84f91d1153c?w=800&h=500&fit=crop"], "rating": 4.9},
    
    {"title": "Beachfront Villa Palm Jumeirah", "description": "Exclusive 5-bedroom villa on Palm Jumeirah. Private beach access, infinity pool, maid service. Ultimate luxury for families/groups.", "property_type": "villa", "city": "Dubai", "address": "Palm Jumeirah, Frond G", "price_per_night": 850.00, "max_guests": 10, "bedrooms": 5, "bathrooms": 4, "amenities": ["wifi", "pool", "beach", "ac", "parking", "maid"], "images": ["https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&h=500&fit=crop"], "rating": 5.0},
    
    {"title": "Studio Apartment JBR Beach", "description": "Cozy studio in Jumeirah Beach Residence. Sea view, 2min to beach. Perfect for solo travelers or couples. Affordable luxury!", "property_type": "apartment", "city": "Dubai", "address": "JBR, The Walk", "price_per_night": 120.00, "max_guests": 2, "bedrooms": 1, "bathrooms": 1, "amenities": ["wifi", "beach", "pool", "ac"], "images": ["https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&h=500&fit=crop"], "rating": 4.6},
    
    # Abu Dhabi
    {"title": "Luxury Hotel Suite Abu Dhabi", "description": "5-star hotel suite near Sheikh Zayed Grand Mosque. King bed, marble bathroom, butler service. Business & leisure perfection.", "property_type": "hotel", "city": "Abu Dhabi", "address": "Corniche Road, Abu Dhabi", "price_per_night": 180.00, "max_guests": 2, "bedrooms": 1, "bathrooms": 1, "amenities": ["wifi", "pool", "gym", "spa", "restaurant"], "images": ["https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&h=500&fit=crop"], "rating": 4.9},
    
    # Weitere Deutschland
    {"title": "Ferienhaus Ostsee mit Garten", "description": "Charmantes Ferienhaus 100m vom Strand. Garten, Terrasse, Grill. 3 Schlafzimmer, voll ausgestattet. Perfekt für Familienurlaub!", "property_type": "house", "city": "Timmendorfer Strand", "address": "Strandallee 45, 23669 Timmendorfer Strand", "price_per_night": 180.00, "max_guests": 6, "bedrooms": 3, "bathrooms": 2, "amenities": ["wifi", "garden", "parking", "bbq"], "images": ["https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=500&fit=crop"], "rating": 4.7},
    
    {"title": "Bergchalet Garmisch-Partenkirchen", "description": "Traditionelles Holzchalet mit Zugspitz-Blick. Kamin, Sauna, Balkon. Ski-in/Ski-out im Winter. Wandern im Sommer. Traumhaft!", "property_type": "house", "city": "Garmisch-Partenkirchen", "address": "Am Kreuzweg 12, 82467 Garmisch", "price_per_night": 220.00, "max_guests": 8, "bedrooms": 4, "bathrooms": 2, "amenities": ["wifi", "sauna", "fireplace", "parking", "ski"], "images": ["https://images.unsplash.com/photo-1542718610-a1d656d1884c?w=800&h=500&fit=crop"], "rating": 4.9},
    
    {"title": "Stadthaus Leipzig Zentrum", "description": "Historisches Stadthaus in Leipziger Innenstadt. 2 Etagen, 3 Zimmer, moderner Komfort in Altbau-Charme. Fußgängerzone 1 Min.", "property_type": "house", "city": "Leipzig", "address": "Grimmaische Straße 8, 04109 Leipzig", "price_per_night": 105.00, "max_guests": 5, "bedrooms": 3, "bathrooms": 1, "amenities": ["wifi", "kitchen", "washer"], "images": ["https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=500&fit=crop"], "rating": 4.5},
    
    {"title": "Design-Apartment Stuttgart", "description": "Minimalistisches Apartment im Stuttgarter Westen. Hohe Decken, Designermöbel, voll ausgestattet. Nahe Mercedes-Museum.", "property_type": "apartment", "city": "Stuttgart", "address": "Schwabstraße 55, 70197 Stuttgart", "price_per_night": 75.00, "max_guests": 2, "bedrooms": 1, "bathrooms": 1, "amenities": ["wifi", "kitchen", "parking"], "images": ["https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&h=500&fit=crop"], "rating": 4.6},
    
    {"title": "Apartment Düsseldorf Altstadt", "description": "2-Zimmer direkt in der Altstadt ('längste Theke der Welt'). Bars & Restaurants unten, Rheinufer 2 Min. Party & Kultur!", "property_type": "apartment", "city": "Düsseldorf", "address": "Bolkerstraße 22, 40213 Düsseldorf", "price_per_night": 80.00, "max_guests": 3, "bedrooms": 1, "bathrooms": 1, "amenities": ["wifi", "kitchen"], "images": ["https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=500&fit=crop"], "rating": 4.4},
    
    {"title": "Luxus-Villa Bodensee", "description": "Exklusive Villa direkt am Bodensee. Privatstrand, Pool, 5 Schlafzimmer, Chef-Küche. Segelboot inkl. Sommer-Traum!", "property_type": "villa", "city": "Konstanz", "address": "Seestraße 88, 78464 Konstanz", "price_per_night": 450.00, "max_guests": 10, "bedrooms": 5, "bathrooms": 3, "amenities": ["wifi", "pool", "beach", "boat", "bbq"], "images": ["https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=500&fit=crop"], "rating": 5.0},
]

def seed_properties():
    """Seed hotels/properties"""
    print("🏨 Seeding Hotels/Unterkünfte...")
    
    # Clear existing
    db.properties.delete_many({})
    
    for prop in PROPERTIES:
        doc = {
            "property_id": secrets.token_hex(8),
            "owner_id": "demo_owner",
            "owner_name": "BidBlitz Vermieter",
            "owner_email": "vermieter@bidblitz.ae",
            "title": prop["title"],
            "description": prop["description"],
            "property_type": prop["property_type"],
            "city": prop["city"],
            "address": prop["address"],
            "price_per_night": prop["price_per_night"],
            "max_guests": prop["max_guests"],
            "bedrooms": prop["bedrooms"],
            "bathrooms": prop["bathrooms"],
            "amenities": prop["amenities"],
            "images": prop["images"],
            "rules": "Keine Haustiere, Nichtraucher, Check-in ab 15 Uhr",
            "status": "active",
            "rating": prop.get("rating", 4.5),
            "reviews_count": secrets.randbelow(50) + 5,
            "bookings_count": secrets.randbelow(100) + 10,
            "created_at": (datetime.now(timezone.utc) - timedelta(days=secrets.randbelow(180))).isoformat(),
        }
        db.properties.insert_one(doc)
        print(f"✅ {prop['title']} ({prop['city']})")
    
    print(f"\n✅ {len(PROPERTIES)} Unterkünfte erstellt!\n")


if __name__ == "__main__":
    import sys
    sys.path.insert(0, '/app/backend')
    from dotenv import load_dotenv
    load_dotenv('/app/backend/.env')
    
    seed_properties()
    print("🎉 Hotels Seeding complete!")
