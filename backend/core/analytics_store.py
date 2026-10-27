"""Storage adapter using the EXISTING conversion_events collection.

Do not call this until trusted-project, consent and rate-limit gates are enforced.
"""
from core.analytics_ingestion import prepare_event, aggregate_counter_key

async def persist_validated_event(collection, counters, payload, trusted_project, now=None):
    record = prepare_event(payload, trusted_project, now)
    # No transaction claim: readers must consider lag between write and counter.
    await collection.insert_one(record)
    await counters.update_one(
        aggregate_counter_key(record),
        {"$inc": {"count": 1}, "$set": {"updated_at": record["received_at"]}},
        upsert=True,
    )
    return {"ok": True, "project": trusted_project}
