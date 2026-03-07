"""
BidBlitz Game Hub - 20 Games
Auto-generated games with random rewards
"""
from fastapi import APIRouter
import random
import time

router = APIRouter(prefix="/hub", tags=["BidBlitz Game Hub"])

wallets = {}
history = {}

# Spiele-Daten
games = []

# automatisch viele Spiele erzeugen
game_names = [
    "Puzzle Blocks", "Car Jam", "Idle Miner", "Fruit Match", "Space Battle",
    "Zombie Attack", "Speed Racer", "Treasure Hunter", "Dragon Quest", "City Builder",
    "Tower Defense", "Monster Battle", "Sky Adventure", "Island Escape", "Gold Rush",
    "Alien Invaders", "Rocket Escape", "Maze Runner", "Ocean Quest", "Farm Builder"
]

gid = 1
for name in game_names:
    games.append({
        "id": gid,
        "name": name,
        "reward": random.randint(5, 20)
    })
    gid += 1


# Wallet erstellen
@router.post("/wallet/create")
def wallet_create(user_id: str):
    if user_id not in wallets:
        wallets[user_id] = 50
    return {"coins": wallets[user_id]}


# Wallet anzeigen
@router.get("/wallet")
def wallet_balance(user_id: str):
    return {"coins": wallets.get(user_id, 0)}


# Spiele anzeigen
@router.get("/games")
def games_list():
    return games


# Spiel starten
@router.post("/games/play")
def play_game(user_id: str, game_id: int):
    game = next((g for g in games if g["id"] == game_id), None)
    
    if not game:
        return {"error": "game not found"}
    
    reward = game["reward"] + random.randint(0, 5)
    
    wallets[user_id] = wallets.get(user_id, 0) + reward
    
    history[user_id] = {
        "game": game["name"],
        "reward": reward,
        "time": time.time()
    }
    
    return {
        "game": game["name"],
        "reward": reward,
        "wallet": wallets[user_id]
    }


# Ranking
@router.get("/games/leaderboard")
def leaderboard():
    ranking = sorted(wallets.items(), key=lambda x: x[1], reverse=True)
    return ranking[:10]


# History
@router.get("/history")
def get_history(user_id: str):
    return history.get(user_id, {})
