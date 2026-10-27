"""Self-hosted revenue reporting core. No database or external service access.

Only canonical, server-verified ledger rows may be supplied by the trusted
payments adapter. All money is integer minor units; currencies never mixed.
"""
from collections import defaultdict
from datetime import datetime, timezone, timedelta

PERIODS = frozenset(("today", "yesterday", "week", "month", "year"))
STATUSES = frozenset(("captured", "refunded", "chargeback"))

def period_bounds(period, now):
    if period not in PERIODS or now.tzinfo is None:
        raise ValueError("Invalid period or timezone")
    current = now.astimezone(timezone.utc)
    start_day = current.replace(hour=0, minute=0, second=0, microsecond=0)
    if period == "today":
        return start_day, current
    if period == "yesterday":
        return start_day - timedelta(days=1), start_day
    if period == "week":
        return start_day - timedelta(days=start_day.weekday()), current
    if period == "month":
        return start_day.replace(day=1), current
    return start_day.replace(month=1, day=1), current

def revenue_by_project(rows, period, now=None):
    """Return per-project per-currency payment volume and platform fees.

    Rows must be produced by a trusted server ledger, not browser analytics.
    Each ledger adjustment has a globally unique transaction_event_id.
    Refunds/chargebacks are negative adjustments. Fee is BidBlitz's share,
    not total merchant/payment volume.
    """
    now = now or datetime.now(timezone.utc)
    start, end = period_bounds(period, now)
    seen = set()
    totals = defaultdict(lambda: {"gross_minor": 0, "refund_minor": 0, "net_volume_minor": 0, "platform_fee_minor": 0, "payment_count": 0})
    for row in rows:
        if row.get("verified") is not True:
            continue
        key = row.get("transaction_event_id")
        if not isinstance(key, str) or not key:
            raise ValueError("Verified ledger row needs transaction_event_id")
        if key in seen:
            continue
        seen.add(key)
        project, currency, status = row.get("project"), row.get("currency"), row.get("status")
        amount, fee = row.get("amount_minor"), row.get("platform_fee_minor")
        timestamp = row.get("occurred_at")
        if not isinstance(timestamp, datetime) or timestamp.tzinfo is None:
            raise ValueError("Verified ledger row requires timezone-aware datetime")
        if not isinstance(project, str) or not project or not isinstance(currency, str) or len(currency) != 3 or not currency.isupper() or status not in STATUSES:
            raise ValueError("Invalid ledger dimensions")
        if type(amount) is not int or type(fee) is not int or amount < 0 or fee < 0 or fee > amount:
            raise ValueError("Invalid minor-unit amounts")
        when = timestamp.astimezone(timezone.utc)
        if not start <= when < end:
            continue
        record = totals[(project, currency)]
        if status == "captured":
            record["gross_minor"] += amount
            record["net_volume_minor"] += amount
            record["platform_fee_minor"] += fee
            record["payment_count"] += 1
        else:
            record["refund_minor"] += amount
            record["net_volume_minor"] -= amount
            record["platform_fee_minor"] -= fee
    return [{"project": p, "currency": c, **values} for (p, c), values in sorted(totals.items())]
