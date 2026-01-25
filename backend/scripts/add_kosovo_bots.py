"""
Script to add 100 bots with Kosovo names to the database
"""
import asyncio
import random
from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime, timezone

# Kosovo first names (male and female)
KOSOVO_FIRST_NAMES_MALE = [
    "Arben", "Driton", "Faton", "Valon", "Besnik", "Burim", "Kujtim", "Shpend",
    "Agim", "Ilir", "Labinot", "Mentor", "Nexhat", "Petrit", "Qerim", "Ramiz",
    "Shkelzen", "Taulant", "Ukshin", "Visar", "Xhevdet", "Ylber", "Zenel", "Blerim",
    "Dardan", "Ermal", "Fisnik", "Gëzim", "Hasan", "Ibrahim", "Jetmir", "Kastriot",
    "Liridon", "Muhamet", "Nehat", "Osman", "Përparim", "Rexhep", "Sokol", "Trim",
    "Yll", "Zenun", "Afrim", "Bajram", "Çelik", "Daut", "Enver", "Fadil", "Gani",
    "Halil", "Imer", "Jakup", "Kadri", "Luan", "Muharrem", "Naim", "Orhan", "Pajazit",
    "Qazim", "Rrahim", "Sami", "Tahir", "Ukë", "Veli", "Xhafer", "Ymer", "Zyhdi"
]

KOSOVO_FIRST_NAMES_FEMALE = [
    "Drita", "Blerta", "Fjolla", "Vlora", "Shqipe", "Afërdita", "Bardha", "Jehona",
    "Kaltrina", "Lumnije", "Mimoza", "Njomza", "Pranvera", "Qëndresa", "Rina", "Saranda",
    "Teuta", "Uresa", "Venera", "Xhevahire", "Yllka", "Zana", "Adelina", "Blerina",
    "Dafina", "Era", "Fatime", "Genta", "Hanife", "Igballe", "Jeta", "Kimete",
    "Lindita", "Merita", "Nazmie", "Orkide", "Pajtesa", "Qendresa", "Rezarta", "Selvije",
    "Tringa", "Urtina", "Valbona", "Xhemile", "Yrfete", "Zenepe", "Albulena", "Bukurije",
    "Dardane", "Egzona", "Flaka", "Ganimete", "Hana", "Iliriana", "Jemima", "Kushtrime"
]

KOSOVO_LAST_NAMES = [
    "Krasniqi", "Gashi", "Berisha", "Hoxha", "Shala", "Rexhepi", "Morina", "Ahmeti",
    "Bytyqi", "Syla", "Murati", "Aliu", "Islami", "Haliti", "Shabani", "Mustafa",
    "Ibrahimi", "Sadiku", "Rama", "Hoti", "Beqiri", "Dervishi", "Kelmendi", "Thaqi",
    "Osmani", "Hasani", "Zeneli", "Daci", "Fazliu", "Gërvalla", "Haradinaj", "Jashari",
    "Kuqi", "Limani", "Maloku", "Neziraj", "Uka", "Peci", "Qerimi", "Rugova",
    "Selimi", "Tahiri", "Ukaj", "Vitia", "Xhaka", "Ymeri", "Zeka", "Abazi",
    "Blakaj", "Caka", "Demaj", "Elezi", "Fetahu", "Gerbeshi", "Hamiti", "Isufi"
]

async def add_kosovo_bots():
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(mongo_url)
    db = client["bidblitz"]
    
    # Get existing bots to avoid duplicates
    existing_bots = await db.bots.find({}).to_list(length=1000)
    existing_names = {bot.get("name", "").lower() for bot in existing_bots}
    
    bots_to_add = []
    added_names = set()
    
    while len(bots_to_add) < 100:
        # Randomly choose male or female
        is_male = random.random() > 0.5
        first_names = KOSOVO_FIRST_NAMES_MALE if is_male else KOSOVO_FIRST_NAMES_FEMALE
        
        first_name = random.choice(first_names)
        last_name = random.choice(KOSOVO_LAST_NAMES)
        
        # Create full name with random format
        name_format = random.choice([
            f"{first_name} {last_name}",
            f"{first_name} {last_name[0]}.",
            f"{first_name}{random.randint(1, 99)}",
            f"{first_name}_{last_name}",
            f"{first_name}.{last_name}",
        ])
        
        name_lower = name_format.lower()
        
        # Check for duplicates
        if name_lower not in existing_names and name_lower not in added_names:
            bots_to_add.append({
                "name": name_format,
                "is_active": True,
                "total_bids": random.randint(0, 500),
                "created_at": datetime.now(timezone.utc)
            })
            added_names.add(name_lower)
    
    # Insert bots
    if bots_to_add:
        result = await db.bots.insert_many(bots_to_add)
        print(f"✅ {len(result.inserted_ids)} Kosovo-Bots erfolgreich hinzugefügt!")
        
        # Print some sample names
        print("\n📋 Beispiel-Namen:")
        for bot in bots_to_add[:10]:
            print(f"   - {bot['name']}")
        print(f"   ... und {len(bots_to_add) - 10} weitere")
    else:
        print("❌ Keine Bots hinzugefügt (alle Namen existieren bereits)")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(add_kosovo_bots())
