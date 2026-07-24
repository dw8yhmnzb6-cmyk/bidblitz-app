"""
Seed realistic BlitzMine data.
- Creates ~30 fake pioneers with varied mining history (for leaderboard).
- Gives main test user some realistic stats + 2 security circle members.
- Safe to re-run (uses upsert).

Run from /app/backend:
    python scripts/seed_blitz_mine.py
"""
import asyncio
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
import random

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from core.database import db  # noqa: E402
from core.security import hash_password  # noqa: E402


FAKE_PIONEERS = [
    ("max.weber",      "Max Weber",       12480.42, 312, 48, "node"),
    ("lina.kaiser",    "Lina Kaiser",     9860.11,  278, 36, "node"),
    ("jonas.ott",      "Jonas Ott",       7340.55,  241, 29, "ambassador"),
    ("amelie.neumann", "Amélie Neumann",  6220.08,  210, 21, "ambassador"),
    ("felix.hartmann", "Felix Hartmann",  5180.77,  198, 17, "ambassador"),
    ("clara.steiner",  "Clara Steiner",   4320.90,  182, 14, "ambassador"),
    ("leon.fischer",   "Leon Fischer",    3610.25,  160, 11, "contributor"),
    ("emma.bauer",     "Emma Bauer",      3140.66,  151, 9,  "contributor"),
    ("noah.schulz",    "Noah Schulz",     2710.19,  138, 7,  "contributor"),
    ("mia.hofmann",    "Mia Hofmann",     2390.44,  129, 5,  "contributor"),
    ("paul.richter",   "Paul Richter",    2050.88,  118, 4,  "contributor"),
    ("hanna.lange",    "Hanna Lange",     1820.31,  109, 6,  "contributor"),
    ("lukas.werner",   "Lukas Werner",    1540.12,  97,  3,  "contributor"),
    ("sofia.koch",     "Sofia Koch",      1310.57,  88,  8,  "contributor"),
    ("ben.jung",       "Ben Jung",        1095.20,  79,  2,  "contributor"),
    ("lea.vogel",      "Lea Vogel",       920.08,   71,  4,  "contributor"),
    ("elias.zimmer",   "Elias Zimmer",    780.45,   64,  1,  "pioneer"),
    ("anna.schwarz",   "Anna Schwarz",    670.30,   58,  2,  "pioneer"),
    ("finn.brandt",    "Finn Brandt",     560.12,   52,  3,  "pioneer"),
    ("ida.ziegler",    "Ida Ziegler",     475.00,   47,  1,  "pioneer"),
    ("tim.krause",     "Tim Krause",      390.22,   42,  2,  "pioneer"),
    ("lara.fuchs",     "Lara Fuchs",      310.77,   37,  0,  "pioneer"),
    ("david.pohl",     "David Pohl",      245.50,   31,  1,  "pioneer"),
    ("emilia.graf",    "Emilia Graf",     180.60,   25,  0,  "pioneer"),
    ("jan.hahn",       "Jan Hahn",        135.10,   20,  2,  "pioneer"),
    ("marie.berg",     "Marie Berg",       95.40,   15,  1,  "pioneer"),
    ("erik.roth",      "Erik Roth",        60.85,   11,  0,  "pioneer"),
    ("julia.vogt",     "Julia Vogt",       35.25,    7,  1,  "pioneer"),
    ("moritz.sommer",  "Moritz Sommer",    18.12,    4,  0,  "pioneer"),
    ("nele.winter",    "Nele Winter",       7.44,    2,  0,  "pioneer"),
]

TEST_USER_EMAIL = "kunde@bidblitz.com"
# Extra circle-ready accounts for the test user
CIRCLE_CANDIDATES = [
    ("anna.schwarz",    "Anna Schwarz",    "anna.schwarz@bidblitz.com"),
    ("jonas.ott",       "Jonas Ott",       "jonas.ott@bidblitz.com"),
]


async def ensure_user(username: str, full_name: str, email: str, pw: str = "Pioneer2026!") -> str:
    """Create a user if missing, return the _id as string."""
    existing = await db.users.find_one({"email": email}, {"_id": 1})
    if existing:
        return str(existing["_id"])
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "email": email,
        "username": username,
        "full_name": full_name,
        "password": hash_password(pw),
        "role": "user",
        "modes": ["personal"],
        "current_mode": "personal",
        "wallet_balance": 0.0,
        "kyc_status": "verified",
        "created_at": now,
        "updated_at": now,
        "seeded": True,
    }
    res = await db.users.insert_one(doc)
    return str(res.inserted_id)


async def seed_pioneer(username: str, full_name: str, total_mined: float,
                       total_sessions: int, streak: int, role: str):
    email = f"{username}@bidblitz.com"
    uid = await ensure_user(username, full_name, email)

    # profile upsert
    now = datetime.now(timezone.utc)
    first_session = now - timedelta(days=max(total_sessions, 30))
    await db.blitz_mine_profile.update_one(
        {"user_id": uid},
        {"$set": {
            "user_id": uid,
            "role": role,
            "total_mined": round(total_mined, 4),
            "total_sessions": total_sessions,
            "streak_days": streak,
            "last_claim_date": (now - timedelta(days=1)).date().isoformat(),
            "first_session_at": first_session.isoformat(),
        }},
        upsert=True,
    )
    # a few historical sessions (for 'active last 7d' referral logic)
    for d in range(min(streak, 3)):
        started = now - timedelta(days=d + 1)
        await db.blitz_mine_sessions.update_one(
            {"user_id": uid, "started_at": started.isoformat()},
            {"$set": {
                "user_id": uid,
                "started_at": started.isoformat(),
                "ends_at": (started + timedelta(hours=24)).isoformat(),
                "claimed": True,
                "claimed_at": (started + timedelta(hours=24, minutes=5)).isoformat(),
                "rate_per_hour": 0.02,
                "estimated_earnings": round(random.uniform(0.4, 1.2), 4),
                "final_earnings": round(random.uniform(0.4, 1.2), 4),
            }},
            upsert=True,
        )


async def seed_main_user():
    u = await db.users.find_one({"email": TEST_USER_EMAIL})
    if not u:
        print(f"[skip] Main test user {TEST_USER_EMAIL} not found – run your auth seeder first.")
        return
    uid = str(u["_id"])
    now = datetime.now(timezone.utc)

    # Give the test user a modest starting history
    await db.blitz_mine_profile.update_one(
        {"user_id": uid},
        {"$set": {
            "user_id": uid,
            "role": "contributor",
            "total_mined": 48.21,
            "total_sessions": 42,
            "streak_days": 5,
            "last_claim_date": (now - timedelta(days=1)).date().isoformat(),
            "first_session_at": (now - timedelta(days=46)).isoformat(),
        }},
        upsert=True,
    )

    # Make sure all circle-candidate users actually exist
    circle_members = []
    for username, name, email in CIRCLE_CANDIDATES:
        mid = await ensure_user(username, name, email)
        circle_members.append({
            "user_id": mid,
            "username": username,
            "added_at": (now - timedelta(days=random.randint(3, 30))).isoformat(),
        })

    await db.blitz_mine_circle.update_one(
        {"user_id": uid},
        {"$set": {"user_id": uid, "members": circle_members}},
        upsert=True,
    )

    # One active lockup of 50 BLZ for 1 year
    existing_lk = await db.blitz_mine_lockup.find_one({"user_id": uid, "status": "active", "seeded": True})
    if not existing_lk:
        await db.blitz_mine_lockup.insert_one({
            "user_id": uid,
            "amount": 50.0,
            "duration_days": 365,
            "bonus_rate": 0.30,
            "started_at": (now - timedelta(days=15)).isoformat(),
            "ends_at": (now + timedelta(days=350)).isoformat(),
            "status": "active",
            "seeded": True,
        })

    # Link a few seeded pioneers as "referrals" so the referral bonus visibly works
    ref_ids = []
    for uname, _, email in [("lea.vogel", "", "lea.vogel@bidblitz.com"),
                             ("emma.bauer", "", "emma.bauer@bidblitz.com"),
                             ("leon.fischer", "", "leon.fischer@bidblitz.com")]:
        ru = await db.users.find_one({"email": email}, {"_id": 1})
        if ru:
            ref_ids.append(str(ru["_id"]))
    if ref_ids:
        await db.users.update_many(
            {"_id": {"$in": [r for r in ref_ids]}},
            {"$set": {"referred_by": uid}},
        )

    print(f"[ok] Seeded profile + circle + lockup + referrals for {TEST_USER_EMAIL} (uid={uid})")


async def main():
    print(f"[db] Seeding BlitzMine into {db.name} ...")
    for row in FAKE_PIONEERS:
        await seed_pioneer(*row)
    print(f"[ok] {len(FAKE_PIONEERS)} fake pioneers inserted.")
    await seed_main_user()

    total = await db.blitz_mine_profile.count_documents({})
    print(f"[db] blitz_mine_profile now has {total} docs.")


if __name__ == "__main__":
    asyncio.run(main())
