from __future__ import annotations

from typing import Iterable


PAYMENT_ACTIVITY_TYPES = ("payment", "send", "topup")
AUCTION_REVENUE_TYPES = ("credit_purchase", "bid_credits_purchase")


def _debit_side_clause() -> dict:
    """Match the initiating side of a wallet movement, including legacy negatives."""
    return {
        "$or": [
            {"direction": "debit"},
            {
                "$and": [
                    {"direction": {"$in": [None, ""]}},
                    {"amount": {"$lt": 0}},
                ]
            },
        ]
    }


def _topup_side_clause() -> dict:
    """Match one completed wallet-funding row for canonical and legacy Stripe top-ups."""
    return {
        "$and": [
            {"type": "topup"},
            {
                "$or": [
                    {"direction": "credit"},
                    {
                        "$and": [
                            {"direction": {"$in": [None, ""]}},
                            {"amount": {"$gt": 0}},
                        ]
                    },
                ]
            },
        ]
    }


def payment_activity_match(created_after: str | None = None) -> dict:
    """Match each completed payment/send/top-up exactly once.

    Wallet payments and sends are represented by their initiating debit side.
    Top-ups are external wallet funding and therefore represented by their credit row.
    This excludes merchant credits, transfer receive rows, refunds and rewards.
    """
    clauses: list[dict] = [{"status": "completed"}]
    if created_after:
        clauses.append({"created_at": {"$gte": created_after}})
    clauses.append({
        "$or": [
            {
                "$and": [
                    {"type": {"$in": ["payment", "send"]}},
                    _debit_side_clause(),
                ]
            },
            _topup_side_clause(),
        ]
    })
    return {"$and": clauses}


def payment_volume_pipeline(created_after: str | None = None) -> list[dict]:
    return [
        {"$match": payment_activity_match(created_after)},
        {"$group": {"_id": None, "total": {"$sum": {"$abs": {"$ifNull": ["$amount", 0]}}}}},
    ]


def platform_fee_pipeline() -> list[dict]:
    """Count the platform fee only on the payer debit row.

    New payment records keep fee_amount in metadata. The top-level fallback keeps
    older completed rows readable without counting the merchant-credit copy.
    """
    return [
        {"$match": {
            "$and": [
                {"status": "completed"},
                {"type": "payment"},
                _debit_side_clause(),
            ]
        }},
        {"$group": {
            "_id": None,
            "total": {
                "$sum": {
                    "$ifNull": [
                        "$metadata.fee_amount",
                        {"$ifNull": ["$fee_amount", 0]},
                    ]
                }
            },
        }},
    ]


def revenue_pipeline(types: Iterable[str]) -> list[dict]:
    """Gross completed sales for explicit product/subscription transaction types."""
    return [
        {"$match": {"type": {"$in": list(types)}, "status": "completed"}},
        {"$group": {"_id": None, "total": {"$sum": {"$abs": {"$ifNull": ["$amount", 0]}}}}},
    ]
