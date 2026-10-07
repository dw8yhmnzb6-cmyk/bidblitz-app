import ast
from pathlib import Path
from uuid import uuid4

from pymongo import MongoClient

from core.admin_financial_metrics import (
    AUCTION_REVENUE_TYPES,
    payment_activity_match,
    payment_volume_pipeline,
    platform_fee_pipeline,
    revenue_pipeline,
)


BACKEND_DIR = Path(__file__).resolve().parent.parent
ADMIN_ROUTE = BACKEND_DIR / "routes" / "admin.py"


def _test_collection():
    client = MongoClient("mongodb://localhost:27017", serverSelectionTimeoutMS=3000)
    name = f"admin_financial_metrics_{uuid4().hex}"
    return client, client["bidblitz_ci"][name]


def test_payment_volume_and_fees_count_each_logical_payment_once():
    client, coll = _test_collection()
    try:
        coll.insert_many([
            # One merchant payment: payer debit + merchant credit carry the same fee.
            {"status": "completed", "type": "payment", "direction": "debit", "amount": -100.0,
             "metadata": {"fee_amount": 2.0}, "created_at": "2026-09-13T10:00:00+00:00"},
            {"status": "completed", "type": "merchant_credit", "direction": "credit", "amount": 98.0,
             "metadata": {"fee_amount": 2.0}, "created_at": "2026-09-13T10:00:00+00:00"},
            # Current canonical P2P transfer: only the sender/debit side counts.
            {"status": "completed", "type": "transfer", "direction": "debit", "amount": -20.0,
             "created_at": "2026-09-13T10:05:00+00:00"},
            {"status": "completed", "type": "transfer", "direction": "credit", "amount": 20.0,
             "created_at": "2026-09-13T10:05:00+00:00"},
            # Legacy P2P rows used type=send and must stay visible historically.
            {"status": "completed", "type": "send", "direction": "debit", "amount": -7.0,
             "created_at": "2026-09-13T10:06:00+00:00"},
            {"status": "completed", "type": "send", "direction": "credit", "amount": 7.0,
             "created_at": "2026-09-13T10:06:00+00:00"},
            # Stripe top-up is one external funding row and must count once.
            {"status": "completed", "type": "topup", "amount": 50.0,
             "created_at": "2026-09-13T10:10:00+00:00"},
            # Legacy payment: negative amount, no direction, top-level fee.
            {"status": "completed", "type": "payment", "amount": -30.0, "fee_amount": 1.5,
             "created_at": "2026-09-13T10:15:00+00:00"},
            # These are not payment volume and must not inflate the number.
            {"status": "completed", "type": "refund", "direction": "credit", "amount": 100.0,
             "created_at": "2026-09-13T10:20:00+00:00"},
            {"status": "completed", "type": "reward", "direction": "credit", "amount": 5.0,
             "created_at": "2026-09-13T10:25:00+00:00"},
            {"status": "failed", "type": "payment", "direction": "debit", "amount": -999.0,
             "metadata": {"fee_amount": 99.0}, "created_at": "2026-09-13T10:30:00+00:00"},
        ])

        volume = list(coll.aggregate(payment_volume_pipeline()))
        fees = list(coll.aggregate(platform_fee_pipeline()))

        assert volume == [{"_id": None, "total": 207.0}]
        assert fees == [{"_id": None, "total": 3.5}]
        assert coll.count_documents(payment_activity_match()) == 5
    finally:
        coll.drop()
        client.close()


def test_payment_activity_time_filter_excludes_older_rows():
    client, coll = _test_collection()
    try:
        coll.insert_many([
            {"status": "completed", "type": "topup", "amount": 10.0,
             "created_at": "2026-09-12T09:00:00+00:00"},
            {"status": "completed", "type": "topup", "amount": 25.0,
             "created_at": "2026-09-13T11:00:00+00:00"},
        ])
        rows = list(coll.aggregate(payment_volume_pipeline("2026-09-13T00:00:00+00:00")))
        assert rows == [{"_id": None, "total": 25.0}]
    finally:
        coll.drop()
        client.close()


def test_revenue_pipeline_supports_current_and_legacy_auction_types():
    client, coll = _test_collection()
    try:
        coll.insert_many([
            {"status": "completed", "type": "credit_purchase", "amount": 10.0},
            {"status": "completed", "type": "bid_credits_purchase", "amount": 25.0},
            {"status": "failed", "type": "bid_credits_purchase", "amount": 100.0},
            {"status": "completed", "type": "mining_purchase", "amount": -49.0},
        ])
        auction = list(coll.aggregate(revenue_pipeline(AUCTION_REVENUE_TYPES)))
        mining = list(coll.aggregate(revenue_pipeline(("mining_purchase",))))
        assert auction == [{"_id": None, "total": 35.0}]
        assert mining == [{"_id": None, "total": 49.0}]
    finally:
        coll.drop()
        client.close()


def test_admin_overview_uses_verified_kids_stripe_source_and_shared_metric_rules():
    source = ADMIN_ROUTE.read_text(encoding="utf-8")
    ast.parse(source)

    assert "payment_volume_pipeline()" in source
    assert "platform_fee_pipeline()" in source
    assert "revenue_pipeline(AUCTION_REVENUE_TYPES)" in source
    assert "db.kids_checkout_sessions.aggregate" in source
    assert '"status": "completed"' in source
    assert '"kids_stripe": round(kids_stripe_revenue, 2)' in source
    assert "payment_activity_match(h24)" in source
    assert "payment_volume_pipeline(h24)" in source
