"""Fail-closed validation for customer-scoped V1 event aggregates.

Only the bounded MongoDB group projection is accepted. Raw records, identifiers
and arbitrary database fields are never copied into the public response.
"""
from datetime import date, datetime, timedelta, timezone

CUSTOMER_EVENT_NAMES = (
    "page_view",
    "cta_click",
    "signup_started",
    "signup_completed",
    "checkout_started",
    "flow_abandoned",
)
_MAX_SAFE_INTEGER = 2**53 - 1
_MAX_DAYS = 90


def build_customer_site_event_report(records, *, days, as_of):
    """Validate grouped UTC-day counts and return only safe aggregate fields.

    The query feeding this function is already bound to a verified tenant/site.
    This function independently validates its result so malformed or unexpected
    aggregate rows fail closed instead of becoming misleading customer metrics.
    """
    if isinstance(days, bool) or not isinstance(days, int) or not 1 <= days <= _MAX_DAYS:
        raise ValueError("Invalid reporting period")
    if (not isinstance(as_of, datetime) or as_of.tzinfo is None
            or as_of.utcoffset() is None):
        raise ValueError("Timezone-aware report timestamp required")
    if not isinstance(records, list):
        raise ValueError("Aggregate rows must be a list")

    report_time = as_of.astimezone(timezone.utc)
    earliest_day = (report_time - timedelta(days=days)).date()
    latest_day = report_time.date()
    if len(records) > (days + 1) * len(CUSTOMER_EVENT_NAMES):
        raise ValueError("Too many aggregate rows")

    totals = {}
    daily = {}
    seen = set()
    for record in records:
        if not isinstance(record, dict) or set(record) != {"_id", "count"}:
            raise ValueError("Unexpected aggregate shape")
        dimensions = record["_id"]
        if not isinstance(dimensions, dict) or set(dimensions) != {"day", "event"}:
            raise ValueError("Unexpected aggregate dimensions")

        day_value = dimensions["day"]
        event = dimensions["event"]
        if not isinstance(day_value, str):
            raise ValueError("Invalid aggregate day")
        try:
            parsed_day = date.fromisoformat(day_value)
        except ValueError:
            raise ValueError("Invalid aggregate day") from None
        if parsed_day.isoformat() != day_value or not earliest_day <= parsed_day <= latest_day:
            raise ValueError("Aggregate day outside report period")
        if not isinstance(event, str) or event not in CUSTOMER_EVENT_NAMES:
            raise ValueError("Unknown aggregate event")

        count = record["count"]
        if (isinstance(count, bool) or not isinstance(count, int)
                or not 1 <= count <= _MAX_SAFE_INTEGER):
            raise ValueError("Invalid aggregate count")

        dimension = (day_value, event)
        if dimension in seen:
            raise ValueError("Duplicate aggregate dimension")
        seen.add(dimension)

        current_total = totals.get(event, 0)
        if current_total > _MAX_SAFE_INTEGER - count:
            raise ValueError("Aggregate total exceeds safe integer range")
        totals[event] = current_total + count
        daily.setdefault(day_value, {})[event] = count

    ordered_totals = {
        event: totals[event]
        for event in CUSTOMER_EVENT_NAMES
        if event in totals
    }
    ordered_daily = {
        day: {
            event: daily[day][event]
            for event in CUSTOMER_EVENT_NAMES
            if event in daily[day]
        }
        for day in sorted(daily)
    }
    return {
        "totals": ordered_totals,
        "daily": ordered_daily,
        "has_recorded_events": bool(ordered_daily),
    }
