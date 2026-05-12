"""
Seed the QR Test Bistro menu with rich Mr-Yum-style items
including Unsplash photos, tags, allergens, modifiers, i18n.
Run: python /app/scripts/seed_qr_demo_menu.py
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")
MERCHANT_ID = "69d0126144299a2e0d94c788"

# Unsplash CDN URLs (royalty free, hot-linkable)
IMG = {
    "pizza_marg":   "https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?w=800&q=80",
    "pizza_diavola":"https://images.unsplash.com/photo-1628840042765-356cda07504e?w=800&q=80",
    "burger":       "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80",
    "pasta":        "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&q=80",
    "salad":        "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80",
    "fries":        "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=800&q=80",
    "wings":        "https://images.unsplash.com/photo-1608039755401-742074f0548d?w=800&q=80",
    "tiramisu":     "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=800&q=80",
    "panna":        "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&q=80",
    "cola":         "https://images.unsplash.com/photo-1554866585-cd94860890b7?w=800&q=80",
    "water":        "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=800&q=80",
    "wine":         "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&q=80",
    "beer":         "https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=800&q=80",
    "espresso":     "https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=800&q=80",
    "hero":         "https://images.unsplash.com/photo-1551218808-94e220e084d2?w=1600&q=80",
}

SIZE_GROUP = {
    "group_id": "size", "name": "Größe", "required": True, "min_select": 1, "max_select": 1,
    "options": [
        {"option_id": "s", "name": "Klein (26cm)", "price_delta": -2.0, "default": False},
        {"option_id": "m", "name": "Medium (30cm)", "price_delta": 0.0, "default": True},
        {"option_id": "l", "name": "Family (40cm)", "price_delta": 5.0, "default": False},
    ],
}
TOPPINGS = {
    "group_id": "toppings", "name": "Extra-Toppings", "required": False, "min_select": 0, "max_select": 4,
    "options": [
        {"option_id": "cheese", "name": "Extra Käse", "price_delta": 1.5},
        {"option_id": "olives", "name": "Oliven", "price_delta": 1.0},
        {"option_id": "salami", "name": "Salami", "price_delta": 2.0},
        {"option_id": "mushroom", "name": "Champignons", "price_delta": 1.5},
    ],
}
BURGER_DONENESS = {
    "group_id": "doneness", "name": "Garstufe", "required": True, "min_select": 1, "max_select": 1,
    "options": [
        {"option_id": "medium-rare", "name": "Medium Rare", "price_delta": 0.0},
        {"option_id": "medium", "name": "Medium", "price_delta": 0.0, "default": True},
        {"option_id": "well-done", "name": "Well Done", "price_delta": 0.0},
    ],
}
BURGER_EXTRAS = {
    "group_id": "burger_extras", "name": "Extras", "required": False, "min_select": 0, "max_select": 3,
    "options": [
        {"option_id": "bacon", "name": "Speck", "price_delta": 2.0},
        {"option_id": "egg", "name": "Spiegelei", "price_delta": 1.5},
        {"option_id": "cheddar", "name": "Extra Cheddar", "price_delta": 1.5},
    ],
}

MENU = [
    # ── PIZZA
    {"item_id": "pizza-margherita", "name": "Pizza Margherita", "name_i18n": {"en": "Pizza Margherita", "tr": "Margarita Pizza"},
     "description": "Tomate, Mozzarella di Bufala, frisches Basilikum, Olivenöl extra vergine.",
     "description_i18n": {"en": "Tomato, buffalo mozzarella, fresh basil, extra-virgin olive oil."},
     "price": 8.50, "category": "Pizza", "scope": "food", "image_url": IMG["pizza_marg"],
     "tags": ["vegetarian", "popular"], "allergens": ["gluten", "milk"], "calories": 720,
     "is_popular": True, "sort_order": 10, "modifier_groups": [SIZE_GROUP, TOPPINGS]},

    {"item_id": "pizza-diavola", "name": "Pizza Diavola", "name_i18n": {"en": "Pizza Diavola"},
     "description": "Scharfe Salami, Tomate, Mozzarella, Chili-Öl.",
     "price": 11.50, "category": "Pizza", "scope": "food", "image_url": IMG["pizza_diavola"],
     "tags": ["spicy"], "allergens": ["gluten", "milk"], "calories": 880, "sort_order": 11,
     "modifier_groups": [SIZE_GROUP, TOPPINGS]},

    # ── BURGER
    {"item_id": "burger-classic", "name": "Classic Beef Burger", "name_i18n": {"en": "Classic Beef Burger"},
     "description": "200g Rindfleisch, Cheddar, karamellisierte Zwiebeln, hausgemachte BBQ-Sauce, Brioche-Bun.",
     "price": 12.90, "category": "Burger", "scope": "food", "image_url": IMG["burger"],
     "tags": ["popular"], "allergens": ["gluten", "milk", "egg", "soy"], "calories": 950,
     "is_popular": True, "sort_order": 20, "modifier_groups": [BURGER_DONENESS, BURGER_EXTRAS]},

    # ── PASTA
    {"item_id": "pasta-truffle", "name": "Truffle Pasta", "name_i18n": {"en": "Truffle Tagliatelle"},
     "description": "Hausgemachte Tagliatelle, schwarze Trüffel, Parmesan, brauner Butter.",
     "price": 16.50, "category": "Pasta", "scope": "food", "image_url": IMG["pasta"],
     "tags": ["vegetarian"], "allergens": ["gluten", "milk", "egg"], "calories": 680, "sort_order": 30},

    # ── SALATE
    {"item_id": "salad-quinoa", "name": "Quinoa Power Bowl", "name_i18n": {"en": "Quinoa Power Bowl"},
     "description": "Rote Quinoa, Avocado, Kichererbsen, Cherry-Tomaten, Granatapfel, Tahini-Dressing.",
     "price": 11.50, "category": "Salate", "scope": "food", "image_url": IMG["salad"],
     "tags": ["vegan", "healthy"], "allergens": ["sesame"], "calories": 480, "sort_order": 40},

    # ── SIDES
    {"item_id": "fries", "name": "Truffle Fries", "name_i18n": {"en": "Truffle Fries"},
     "description": "Belgische Pommes, Trüffel-Mayo, Parmesan, Petersilie.",
     "price": 5.50, "category": "Beilagen", "scope": "food", "image_url": IMG["fries"],
     "tags": ["vegetarian", "popular"], "allergens": ["egg", "milk"], "calories": 520,
     "is_popular": True, "sort_order": 50},

    {"item_id": "wings", "name": "Buffalo Wings (6 St.)", "name_i18n": {"en": "Buffalo Wings (6 pcs)"},
     "description": "Knusprige Hähnchen-Wings mit hausgemachter Buffalo-Sauce + Blue-Cheese-Dip.",
     "price": 8.90, "category": "Beilagen", "scope": "food", "image_url": IMG["wings"],
     "tags": ["spicy"], "allergens": ["milk", "egg"], "calories": 640, "sort_order": 51},

    # ── DESSERT
    {"item_id": "tiramisu", "name": "Tiramisu", "name_i18n": {"en": "Tiramisu"},
     "description": "Klassisch mit Mascarpone, Espresso, Savoiardi, Marsala, Kakao.",
     "price": 6.50, "category": "Dessert", "scope": "food", "image_url": IMG["tiramisu"],
     "tags": ["vegetarian"], "allergens": ["gluten", "milk", "egg"], "calories": 410, "sort_order": 60},

    {"item_id": "panna-cotta", "name": "Panna Cotta Beeren", "name_i18n": {"en": "Berry Panna Cotta"},
     "description": "Vanille-Panna-Cotta mit warmen Waldbeeren.",
     "price": 5.90, "category": "Dessert", "scope": "food", "image_url": IMG["panna"],
     "tags": ["vegetarian"], "allergens": ["milk"], "calories": 320, "sort_order": 61},

    # ── DRINKS
    {"item_id": "cola", "name": "Coca-Cola 0,33l", "name_i18n": {"en": "Coca-Cola 0.33l"},
     "description": "Eiskalt serviert mit Zitrone.",
     "price": 2.50, "category": "Softdrinks", "scope": "drinks", "image_url": IMG["cola"],
     "tags": [], "allergens": [], "calories": 139, "sort_order": 100},

    {"item_id": "water-still", "name": "Stilles Wasser 0,5l", "name_i18n": {"en": "Still Water 0.5l"},
     "description": "Lokales Quellwasser, ohne Kohlensäure.",
     "price": 2.00, "category": "Softdrinks", "scope": "drinks", "image_url": IMG["water"],
     "tags": ["vegan"], "allergens": [], "calories": 0, "sort_order": 101},

    {"item_id": "wine-red", "name": "Hauswein Rot 0,2l", "name_i18n": {"en": "House Red Wine 0.2l"},
     "description": "Chianti DOCG, Toskana, fruchtig & samtig.",
     "price": 5.50, "category": "Wein", "scope": "drinks", "image_url": IMG["wine"],
     "tags": [], "allergens": ["sulfites"], "calories": 170, "sort_order": 110},

    {"item_id": "beer-pils", "name": "Pils 0,5l", "name_i18n": {"en": "Pilsner 0.5l"},
     "description": "Frisch gezapftes Pils vom Fass.",
     "price": 3.90, "category": "Bier", "scope": "drinks", "image_url": IMG["beer"],
     "tags": ["popular"], "allergens": ["gluten"], "calories": 215, "is_popular": True, "sort_order": 111},

    {"item_id": "espresso", "name": "Espresso Doppio", "name_i18n": {"en": "Double Espresso"},
     "description": "100% Arabica, frisch gemahlen.",
     "price": 2.80, "category": "Kaffee", "scope": "drinks", "image_url": IMG["espresso"],
     "tags": ["vegan"], "allergens": [], "calories": 10, "sort_order": 120},
]


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    await db.merchants.update_one(
        {"merchant_id": MERCHANT_ID},
        {"$set": {
            "merchant_id": MERCHANT_ID,
            "name": "Bella Vita Bistro",
            "hero_image_url": IMG["hero"],
            "logo_url": None,
            "currency": "EUR",
            "menu": MENU,
        }},
        upsert=True,
    )
    print(f"✅ Seeded {len(MENU)} items for merchant {MERCHANT_ID}")
    cats = {}
    for it in MENU:
        cats.setdefault((it["scope"], it["category"]), 0)
        cats[(it["scope"], it["category"])] += 1
    for (s, c), n in sorted(cats.items()):
        print(f"   {s:7s} {c:14s} {n}")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
