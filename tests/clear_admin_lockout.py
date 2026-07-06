import os
from pymongo import MongoClient


def main():
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    if not mongo_url or not db_name:
        raise RuntimeError("MONGO_URL/DB_NAME missing")

    client = MongoClient(mongo_url)
    db = client[db_name]
    result = db.login_attempts.delete_many({"identifier": {"$regex": "admin@bidblitz\\.ae$"}})
    print(f"Deleted login_attempts records: {result.deleted_count}")


if __name__ == "__main__":
    main()
