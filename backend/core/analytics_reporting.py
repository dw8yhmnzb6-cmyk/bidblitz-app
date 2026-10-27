"""Pure, project-scoped analytics reporting helpers.

No database connections, tracking activation or production changes.
"""
from collections import Counter
from datetime import datetime, timedelta, timezone

EVENTS = frozenset({
    "page_view", "cta_click", "signup_started", "signup_completed",
    "checkout_started", "checkout_completed", "flow_abandoned",
})


def summarize_project(events, project, days=30, now=None):
    """Aggregate validated event records for one project only.

    Input should already be authorized and validated by the API layer.
    Browser 'checkout_completed' is an interaction, NOT verified revenue.
    """
    if not isinstance(days, int) or isinstance(days, bool) or not 1 <= days <= 90:
        raise ValueError("days must be an integer between 1 and 90")
    if not isinstance(project, str) or not project:
        raise ValueError("project required")
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None:
        raise ValueError("now must be timezone aware")
    current = current.astimezone(timezone.utc)
    since = current - timedelta(days=days)
    counts = Counter()
    daily = {}
    for row in events:
        if row.get("project") != project or row.get("event") not in EVENTS:
            continue
        stamp = row.get("received_at")
        try:
            dt = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                continue
            dt = dt.astimezone(timezone.utc)
        except (ValueError, TypeError, AttributeError):
            continue
        if not since <= dt <= current:
            continue
        kind = row["event"]
        counts[kind] += 1
        day = dt.date().isoformat()
        daily.setdefault(day, Counter())[kind] += 1
    return {
        "project": project,
        "period_days": days,
        "events": {event: counts[event] for event in sorted(EVENTS)},
        "daily": {day: dict(values) for day, values in sorted(daily.items())},
        "revenue_verified": False,
    }
