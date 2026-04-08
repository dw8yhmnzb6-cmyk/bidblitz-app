from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from core.config import MONGO_URL, DB_NAME

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


def sanitize_doc(doc):
    """Remove MongoDB _id from document and convert ObjectId fields to strings."""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [sanitize_doc(d) for d in doc]
    if isinstance(doc, dict):
        result = {}
        for key, value in doc.items():
            if key == "_id":
                continue  # Skip _id entirely
            if isinstance(value, ObjectId):
                result[key] = str(value)
            elif isinstance(value, dict):
                result[key] = sanitize_doc(value)
            elif isinstance(value, list):
                result[key] = sanitize_doc(value)
            else:
                result[key] = value
        return result
    if isinstance(doc, ObjectId):
        return str(doc)
    return doc

async def create_indexes():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.transactions.create_index("user_id")
    await db.transactions.create_index("created_at")
    await db.merchants.create_index("user_id", unique=True)

async def close_connection():
    client.close()
