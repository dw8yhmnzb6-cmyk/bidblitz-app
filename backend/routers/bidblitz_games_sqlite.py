"""
BidBlitz Games System - SQLite Version
Wallet, Games, Leaderboard
"""
from fastapi import APIRouter
import sqlite3
import random
import time
import os

router = APIRouter(prefix="/bbz-lite", tags=["BBZ Games SQLite"])

# SQLite Database
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "bidblitz_games.db")

conn = sqlite3.connect(DB_PATH, check_same_thread=False)
cursor = conn.cursor()

# Tabellen erstellen
cursor.execute("""
CREATE TABLE IF NOT EXISTS users(
    user_id TEXT PRIMARY KEY,
    coins INTEGER DEFAULT 0
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS daily_rewards(
    user_id TEXT PRIMARY KEY,
    last_claim INTEGER
)
""")

cursor.execute("""
CREATE TABLE IF NOT EXISTS game_plays(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    game_id INTEGER,
    reward INTEGER,
    played_at INTEGER
)
""")

conn.commit()

# Spieleliste (10 Games)
games = [
    {"id": 1, "name": "Puzzle Blocks", "reward": 5, "icon": "🧩"},
    {"id": 2, "name": "Car Traffic Jam", "reward": 6, "icon": "🚗"},
    {"id": 3, "name": "Idle Miner Tycoon", "reward": 10, "icon": "⛏️"},
    {"id": 4, "name": "Space Battle", "reward": 12, "icon": "🚀"},
    {"id": 5, "name": "Treasure Hunter", "reward": 8, "icon": "💎"},
    {"id": 6, "name": "Fruit Match", "reward": 7, "icon": "🍎"},
    {"id": 7, "name": "Speed Racer", "reward": 9, "icon": "🏎️"},
    {"id": 8, "name": "City Builder", "reward": 15, "icon": "🏙️"},
    {"id": 9, "name": "Zombie Attack", "reward": 11, "icon": "🧟"},
    {"id": 10, "name": "Dragon Quest", "reward": 20, "icon": "🐉"}
]


# -------------------------
# WALLET
# -------------------------

@router.post("/wallet/create")
def create_wallet(user_id: str):
    """Create wallet with 50 coins"""
    cursor.execute("SELECT * FROM users WHERE user_id=?", (user_id,))
    if cursor.fetchone():
        return {"message": "wallet exists"}
    
    cursor.execute("INSERT INTO users VALUES (?,?)", (user_id, 50))
    conn.commit()
    
    return {"user_id": user_id, "coins": 50}


@router.get("/wallet")
def wallet(user_id: str):
    """Get wallet balance"""
    cursor.execute("SELECT coins FROM users WHERE user_id=?", (user_id,))
    row = cursor.fetchone()
    
    if not row:
        return {"coins": 0}
    
    return {"coins": row[0]}


# Alias für Kompatibilität
@router.get("/wallet/balance")
def wallet_balance(user_id: str):
    return wallet(user_id)


# -------------------------
# GAMES
# -------------------------

@router.get("/games")
def list_games():
    """Get all games"""
    return {"games": games}


@router.post("/games/play")
def play_game(user_id: str, game_id: int):
    """Play a game and earn coins"""
    now = int(time.time())
    
    # Ensure user exists
    cursor.execute("SELECT * FROM users WHERE user_id=?", (user_id,))
    if not cursor.fetchone():
        cursor.execute("INSERT INTO users VALUES (?,?)", (user_id, 0))
    
    # Random reward 5-20
    reward = random.randint(5, 20)
    
    cursor.execute(
        "UPDATE users SET coins = coins + ? WHERE user_id=?",
        (reward, user_id)
    )
    
    # Record play
    cursor.execute(
        "INSERT INTO game_plays (user_id, game_id, reward, played_at) VALUES (?,?,?,?)",
        (user_id, game_id, reward, now)
    )
    
    conn.commit()
    
    # Get game name
    game_name = "Unknown"
    for g in games:
        if g["id"] == game_id:
            game_name = g["name"]
            break
    
    # Get new balance
    cursor.execute("SELECT coins FROM users WHERE user_id=?", (user_id,))
    balance = cursor.fetchone()[0]
    
    return {
        "game_id": game_id,
        "game": game_name,
        "reward": reward,
        "balance": balance
    }


# -------------------------
# DAILY REWARD
# -------------------------

@router.get("/reward/daily")
def daily_reward(user_id: str):
    """Claim daily reward"""
    now = int(time.time())
    
    # Ensure user exists
    cursor.execute("SELECT * FROM users WHERE user_id=?", (user_id,))
    if not cursor.fetchone():
        cursor.execute("INSERT INTO users VALUES (?,?)", (user_id, 0))
    
    # Check last claim
    cursor.execute("SELECT last_claim FROM daily_rewards WHERE user_id=?", (user_id,))
    row = cursor.fetchone()
    
    if row and now - row[0] < 86400:
        return {"error": "already claimed", "wait": 86400 - (now - row[0])}
    
    reward = random.choice([10, 15, 20, 25, 50])
    
    cursor.execute(
        "UPDATE users SET coins = coins + ? WHERE user_id=?",
        (reward, user_id)
    )
    
    cursor.execute("DELETE FROM daily_rewards WHERE user_id=?", (user_id,))
    cursor.execute("INSERT INTO daily_rewards VALUES (?,?)", (user_id, now))
    
    conn.commit()
    
    cursor.execute("SELECT coins FROM users WHERE user_id=?", (user_id,))
    balance = cursor.fetchone()[0]
    
    return {"reward": reward, "balance": balance}


# -------------------------
# LEADERBOARD
# -------------------------

@router.get("/leaderboard")
def leaderboard():
    """Get top 10 players"""
    cursor.execute(
        "SELECT user_id, coins FROM users ORDER BY coins DESC LIMIT 10"
    )
    
    rows = cursor.fetchall()
    
    return {
        "leaderboard": [{"user_id": r[0], "coins": r[1]} for r in rows]
    }


# -------------------------
# STATS
# -------------------------

@router.get("/stats")
def stats(user_id: str):
    """Get user stats"""
    cursor.execute("SELECT coins FROM users WHERE user_id=?", (user_id,))
    row = cursor.fetchone()
    
    if not row:
        return {"error": "user not found"}
    
    cursor.execute("SELECT COUNT(*) FROM game_plays WHERE user_id=?", (user_id,))
    games_played = cursor.fetchone()[0]
    
    return {
        "user_id": user_id,
        "coins": row[0],
        "games_played": games_played
    }
