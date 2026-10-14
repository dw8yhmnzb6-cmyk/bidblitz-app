"""Period-filtered dashboard counters from authorized, minimized event records.

Pure functions: no production routes, network calls or database migrations.
'Online' means observed sessions within the last five minutes, not guaranteed
humans currently looking at a screen.
"""
from collections import Counter
from datetime import datetime, timezone, timedelta
from core.analytics_revenue import period_bounds

ALLOWED = frozenset({"page_view", "cta_click", "signup_started", "signup_completed",
                     "checkout_started", "flow_abandoned"})

def dashboard_metrics(events, project, period, now=None):
    current = now or datetime.now(timezone.utc)
    start, end = period_bounds(period, current)
    online_since = current - timedelta(minutes=5)
    counts = Counter()
    online_sessions = set()
    for item in events:
        if item.get("project") != project or item.get("event") not in ALLOWED:
            continue
        stamp = item.get("received_at")
        try:
            instant = datetime.fromisoformat(stamp.replace("Z", "+00:00"))
            if instant.tzinfo is None:
                continue
            instant = instant.astimezone(timezone.utc)
        except (TypeError, ValueError, AttributeError):
            continue
        if start <= instant < end:
            counts[item["event"]] += 1
        # Session IDs must be short-lived, consented, opaque, and validated by the caller.
        session = item.get("anonymous_session")
        if (period == "today" and isinstance(session, str) and session and
                online_since <= instant <= current):
            online_sessions.add(session)
    return {
        "project": project,
        "period": period,
        "page_views": counts["page_view"],
        "cta_clicks": counts["cta_click"],
        "registrations_started": counts["signup_started"],
        "registrations_completed": counts["signup_completed"],
        "checkout_started": counts["checkout_started"],
        "online_sessions_5m": len(online_sessions) if period == "today" else None,
        "unique_visitors": None,  # Needs a separate privacy-reviewed measurement definition.
    }
