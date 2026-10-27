"""Privacy-preserving comparison of two adjacent V1 event recording windows.

Input reports come only from _v1_project_reports with the full server-owned
catalog. No customer, payment, session, IP or browser identifiers are read.
Comparisons describe *recorded events*, not unique people, conversion rates,
verified revenue or collector health.
"""

from datetime import datetime, timedelta
from typing import get_args

from core.analytics_event_schema import EventName, ProjectName

MAX_SAFE_INTEGER = 2**53 - 1
EVENTS = get_args(EventName)
PROJECTS = get_args(ProjectName)


def _index_reports(reports):
    """Validate the complete catalog and return safe count-only snapshots."""
    if not isinstance(reports, list) or len(reports) != len(PROJECTS):
        raise ValueError("Incomplete analytics project catalog")
    indexed = {}
    for report in reports:
        if not isinstance(report, dict) or report.get("project") not in PROJECTS:
            raise ValueError("Unknown analytics project")
        project = report["project"]
        if project in indexed or report.get("verified_revenue_included") is not False:
            raise ValueError("Invalid analytics project report")
        if report.get("data_scope") != "v1_project_events_only":
            raise ValueError("Invalid analytics data scope")
        totals, daily = report.get("totals"), report.get("daily")
        if not isinstance(totals, dict) or not isinstance(daily, dict):
            raise ValueError("Invalid analytics counters")
        counts = {}
        for event, count in totals.items():
            if event not in EVENTS or type(count) is not int or not 0 <= count <= MAX_SAFE_INTEGER:
                raise ValueError("Invalid analytics counter")
        for event in EVENTS:
            counts[event] = totals.get(event, 0)
        indexed[project] = {"events": counts, "recorded_utc_days": len(daily)}
    if set(indexed) != set(PROJECTS):
        raise ValueError("Missing analytics projects")
    return indexed


def _sum_event_counts(snapshots):
    counts = {event: 0 for event in EVENTS}
    for snapshot in snapshots.values():
        for event, value in snapshot["events"].items():
            if counts[event] > MAX_SAFE_INTEGER - value:
                raise ValueError("Unsafe cross-project total")
            counts[event] += value
    return counts


def compare_v1_recorded_periods(current_reports, previous_reports, days, as_of):
    """Compute bounded event-count changes, never treating missing data as uptime."""
    if not isinstance(days, int) or isinstance(days, bool) or not 1 <= days <= 90:
        raise ValueError("Invalid comparison period")
    if (not isinstance(as_of, datetime) or as_of.tzinfo is None
            or as_of.utcoffset() != timedelta(0)):
        raise ValueError("UTC comparison timestamp required")
    now = as_of
    boundary = now - timedelta(days=days)
    previous_start = boundary - timedelta(days=days)
    current = _index_reports(current_reports)
    previous = _index_reports(previous_reports)
    current_totals = _sum_event_counts(current)
    previous_totals = _sum_event_counts(previous)
    changes = {event: current_totals[event] - previous_totals[event] for event in EVENTS}
    project_reports = []
    for project in PROJECTS:
        current_counts = current[project]["events"]
        previous_counts = previous[project]["events"]
        project_reports.append({
            "project": project,
            "current_events": current_counts,
            "previous_events": previous_counts,
            "recorded_event_change": {
                event: current_counts[event] - previous_counts[event] for event in EVENTS
            },
            "current_recorded_utc_days": current[project]["recorded_utc_days"],
            "previous_recorded_utc_days": previous[project]["recorded_utc_days"],
        })
    return {
        "period_days": days,
        "as_of": now.isoformat(),
        "timezone": "UTC",
        "windows": {
            "current": {
                "start_inclusive": boundary.isoformat(),
                "end_inclusive": now.isoformat(),
            },
            "previous": {
                "start_inclusive": previous_start.isoformat(),
                "end_exclusive": boundary.isoformat(),
            },
        },
        "projects": project_reports,
        "summary": {
            "current_events": current_totals,
            "previous_events": previous_totals,
            "recorded_event_change": changes,
            "current_projects_with_events": sum(
                any(current[p]["events"].values()) for p in PROJECTS
            ),
            "previous_projects_with_events": sum(
                any(previous[p]["events"].values()) for p in PROJECTS
            ),
        },
        "data_scope": "v1_project_events_only",
        "verified_revenue_included": False,
        "unique_visitors": None,
        "net_profit_available": False,
        "collection_health_verified": False,
    }
