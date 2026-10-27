"""Read-only totals for reports already scoped to server-authorized projects.

The input must be the output of build_project_dashboard for server-authorized
projects. This module never grants project access, queries a database or
accepts untrusted client-side project selectors. Payment volumes are grouped
by currency (integer minor units), never converted or called profit.
"""
_TRAFFIC_COUNTERS = (
    "page_views",
    "cta_clicks",
    "registrations_started",
    "registrations_completed",
    "checkout_started",
)
_REVENUE_COUNTERS = (
    "gross_minor",
    "refund_minor",
    "net_volume_minor",
    "platform_fee_minor",
    "payment_count",
)


def summarize_portfolio(project_reports):
    """Aggregate only safe counters; do not propagate raw records or PII."""
    traffic = {key: 0 for key in _TRAFFIC_COUNTERS}
    by_currency = {}
    project_count = 0

    for report in project_reports:
        project_count += 1
        metrics = report["traffic"]
        for key in _TRAFFIC_COUNTERS:
            traffic[key] += metrics[key]
        for line in report["revenue"]:
            currency = line["currency"]
            if currency not in by_currency:
                by_currency[currency] = {
                    "currency": currency,
                    **{key: 0 for key in _REVENUE_COUNTERS},
                }
            for key in _REVENUE_COUNTERS:
                by_currency[currency][key] += line[key]

    return {
        "project_count": project_count,
        "traffic_events": traffic,  # Event counts, not unique people.
        "revenue_by_currency": [by_currency[c] for c in sorted(by_currency)],
        "unique_visitors": None,  # Requires a privacy-reviewed definition.
        "online_sessions_5m": None,  # Cross-project sessions are NOT unique.
        "net_profit_available": False,  # Fees are revenue, not net profit.
    }
