from motor.motor_asyncio import AsyncIOMotorClient
from core.config import MONGO_URL, DB_NAME

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

async def create_indexes():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.transactions.create_index("user_id")
    await db.transactions.create_index("created_at")
    await db.merchants.create_index("user_id", unique=True)

async def close_connection():
    client.close()
