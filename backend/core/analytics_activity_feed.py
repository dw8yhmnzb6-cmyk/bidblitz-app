"""Privacy-minimized activity feed for the existing Stack dashboard.

Only backend-confirmed business actions may appear here. Never include free
text, account identifiers, payment details or visitor session data.
"""
from datetime import datetime, timezone, timedelta

ACTIONS = frozenset({
    "registration_completed", "subscription_activated",
    "subscription_cancelled", "payment_confirmed", "refund_confirmed",
})
PROJECTS = frozenset({
    "bidblitz_main", "trade", "eyes", "power", "verify",
    "iptv", "games", "fuel", "identity", "stack",
})

def recent_business_activity(rows, authorized_projects, now=None, limit=50):
    if not isinstance(authorized_projects, (set, frozenset)) or not authorized_projects <= PROJECTS:
        raise ValueError("Authorized project set required")
    if type(limit) is not int or not 1 <= limit <= 100:
        raise ValueError("Invalid limit")
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        raise ValueError("Timezone-aware clock required")
    current = now.astimezone(timezone.utc)
    cutoff = current - timedelta(days=30)
    results = []
    for row in rows:
        if row.get("verified") is not True:
            continue
        project, action, when = row.get("project"), row.get("action"), row.get("occurred_at")
        if project not in authorized_projects or action not in ACTIONS:
            continue
        if not isinstance(when, datetime) or when.tzinfo is None:
            continue
        when = when.astimezone(timezone.utc)
        if not cutoff <= when <= current:
            continue
        results.append({"project": project, "action": action, "occurred_at": when.isoformat()})
    return sorted(results, key=lambda x: x["occurred_at"], reverse=True)[:limit]
