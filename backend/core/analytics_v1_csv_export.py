"""Privacy-safe, read-only CSV export for the V1 admin event portfolio.

Exported rows contain only server-registered project names, UTC dates, and
fixed event counters. They never contain raw event records, customer identity,
sessions, financial amounts, or browser-provided text. Empty projects get a
clearly marked *no recorded events* row, not fictitious zero-traffic days.
"""
import csv
from datetime import date, datetime, timedelta
from io import StringIO
import re
from typing import get_args

from core.analytics_event_schema import EventName, ProjectName


EVENTS = get_args(EventName)
PROJECTS = get_args(ProjectName)
MAX_SAFE_COUNT = 2**53 - 1
HEADER = (
    "project", "utc_date", *EVENTS, "record_status",
    "verified_revenue_included", "data_scope",
)
_SCOPE = "v1_project_events_only"


def _safe_counters(value):
    if not isinstance(value, dict) or any(event not in EVENTS for event in value):
        raise ValueError("Invalid V1 event counters")
    if any(type(count) is not int or not 0 <= count <= MAX_SAFE_COUNT
           for count in value.values()):
        raise ValueError("Invalid V1 event count")
    return value


def render_v1_portfolio_daily_csv(reports, *, days, as_of):
    """Render a bounded event-only CSV after validating the server-owned reports.

    This is deliberately not an export of unique users, confirmed payments,
    profit, or a collector availability measurement.
    """
    if (type(days) is not int or not 1 <= days <= 90
            or not isinstance(as_of, datetime)
            or as_of.tzinfo is None or as_of.utcoffset() != timedelta(0)
            or not isinstance(reports, (list, tuple))
            or len(reports) != len(PROJECTS)):
        raise ValueError("Invalid V1 export parameters")

    earliest = (as_of - timedelta(days=days)).date()
    latest = as_of.date()
    by_project = {}

    for report in reports:
        if not isinstance(report, dict):
            raise ValueError("Invalid V1 project report")
        project = report.get("project")
        if (project not in PROJECTS or project in by_project
                or report.get("period_days") != days
                or report.get("verified_revenue_included") is not False
                or report.get("data_scope") != _SCOPE):
            raise ValueError("Invalid V1 project scope")
        totals = _safe_counters(report.get("totals"))
        daily = report.get("daily")
        if not isinstance(daily, dict):
            raise ValueError("Invalid V1 daily report")

        summed = {event: 0 for event in EVENTS}
        for day, counts in daily.items():
            # Validate date before putting any DB-derived string into a CSV.
            if not isinstance(day, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", day):
                raise ValueError("Invalid UTC day")
            try:
                parsed = date.fromisoformat(day)
            except ValueError:
                raise ValueError("Invalid UTC day") from None
            if not earliest <= parsed <= latest:
                raise ValueError("UTC day outside report period")
            counts = _safe_counters(counts)
            if not any(counts.values()):
                raise ValueError("Empty recorded day")
            for event, count in counts.items():
                if summed[event] > MAX_SAFE_COUNT - count:
                    raise ValueError("V1 event total overflow")
                summed[event] += count

        if any(summed[event] != totals.get(event, 0) for event in EVENTS):
            raise ValueError("Inconsistent V1 event totals")
        by_project[project] = daily

    if set(by_project) != set(PROJECTS):
        raise ValueError("Incomplete V1 project catalog")

    output = StringIO(newline="")
    writer = csv.writer(output, lineterminator="\r\n")
    writer.writerow(HEADER)
    for project in PROJECTS:
        daily = by_project[project]
        if not daily:
            writer.writerow([project, "", *("" for _ in EVENTS),
                             "no_recorded_events", "false", _SCOPE])
            continue
        for day in sorted(daily):
            counts = daily[day]
            writer.writerow([project, day,
                             *(counts[event] if event in counts else "" for event in EVENTS),
                             "recorded_events", "false", _SCOPE])
    return output.getvalue()
