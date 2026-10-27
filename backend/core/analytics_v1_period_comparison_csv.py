"""Bounded admin CSV export of V1 *recorded event* period comparisons.

No raw events, identities, payments, inferred visitors, conversion rates or
revenue. All CSV text is derived from fixed server-owned enums and timestamps.
"""
import csv
from datetime import datetime, timedelta
from io import StringIO
from typing import get_args

from core.analytics_event_schema import EventName, ProjectName

EVENTS = get_args(EventName)
PROJECTS = get_args(ProjectName)
MAX_SAFE = 2**53 - 1
SCOPE = "v1_project_events_only"
HEADER = (
    "row_scope", "project", "event",
    "current_recorded_events", "previous_recorded_events", "recorded_event_change",
    "current_recorded_utc_days", "previous_recorded_utc_days",
    "current_start_utc", "previous_start_utc", "period_boundary_utc", "as_of_utc",
    "data_scope", "verified_revenue_included", "collection_health_verified",
)


def _utc(value):
    if type(value) is not str or not value.endswith("+00:00"):
        raise ValueError("Invalid UTC comparison boundary")
    try:
        timestamp = datetime.fromisoformat(value)
    except ValueError:
        raise ValueError("Invalid UTC comparison boundary") from None
    if timestamp.utcoffset() != timedelta(0) or timestamp.isoformat() != value:
        raise ValueError("Invalid UTC comparison boundary")
    return timestamp


def _counts(value, signed=False):
    if type(value) is not dict or set(value) != set(EVENTS):
        raise ValueError("Invalid V1 event catalog")
    minimum = -MAX_SAFE if signed else 0
    if any(type(count) is not int or not minimum <= count <= MAX_SAFE
           for count in value.values()):
        raise ValueError("Invalid V1 event count")
    return value


def render_v1_period_comparison_csv(report):
    """Validate fixed-size portfolio contract and emit project/event count deltas."""
    if (type(report) is not dict or type(report.get("period_days")) is not int
            or not 1 <= report["period_days"] <= 90
            or report.get("timezone") != "UTC"
            or report.get("data_scope") != SCOPE
            or report.get("verified_revenue_included") is not False
            or report.get("collection_health_verified") is not False
            or report.get("unique_visitors", 1) is not None
            or report.get("net_profit_available") is not False):
        raise ValueError("Invalid V1 comparison export scope")

    days = report["period_days"]
    as_of = _utc(report.get("as_of"))
    windows = report.get("windows")
    if type(windows) is not dict:
        raise ValueError("Missing V1 comparison windows")
    current = windows.get("current")
    previous = windows.get("previous")
    if type(current) is not dict or type(previous) is not dict:
        raise ValueError("Missing V1 comparison windows")
    current_start = _utc(current.get("start_inclusive"))
    previous_start = _utc(previous.get("start_inclusive"))
    boundary = _utc(previous.get("end_exclusive"))
    current_end = _utc(current.get("end_inclusive"))
    if (current_end != as_of or boundary != current_start
            or current_start != as_of - timedelta(days=days)
            or previous_start != current_start - timedelta(days=days)):
        raise ValueError("Mismatched V1 comparison windows")

    project_rows = report.get("projects")
    summary = report.get("summary")
    if (type(project_rows) is not list or len(project_rows) != len(PROJECTS)
            or type(summary) is not dict):
        raise ValueError("Incomplete V1 comparison")

    totals = {period: {event: 0 for event in EVENTS}
              for period in ("current", "previous")}
    covered = {"current": 0, "previous": 0}
    validated = []
    for expected_project, row in zip(PROJECTS, project_rows):
        if type(row) is not dict or row.get("project") != expected_project:
            raise ValueError("Invalid V1 comparison project")
        current_counts = _counts(row.get("current_events"))
        previous_counts = _counts(row.get("previous_events"))
        differences = _counts(row.get("recorded_event_change"), signed=True)
        current_days = row.get("current_recorded_utc_days")
        previous_days = row.get("previous_recorded_utc_days")
        if (type(current_days) is not int or type(previous_days) is not int
                or not 0 <= current_days <= days + 1
                or not 0 <= previous_days <= days + 1
                or bool(any(current_counts.values())) != bool(current_days)
                or bool(any(previous_counts.values())) != bool(previous_days)):
            raise ValueError("Invalid V1 comparison coverage")
        covered["current"] += int(current_days > 0)
        covered["previous"] += int(previous_days > 0)
        for event in EVENTS:
            now_count, old_count = current_counts[event], previous_counts[event]
            if differences[event] != now_count - old_count:
                raise ValueError("Inconsistent V1 comparison delta")
            for period, count in (("current", now_count), ("previous", old_count)):
                if totals[period][event] > MAX_SAFE - count:
                    raise ValueError("Unsafe V1 comparison sum")
                totals[period][event] += count
        validated.append((expected_project, current_counts, previous_counts,
                          differences, current_days, previous_days))

    summary_current = _counts(summary.get("current_events"))
    summary_previous = _counts(summary.get("previous_events"))
    summary_change = _counts(summary.get("recorded_event_change"), signed=True)
    if (summary_current != totals["current"]
            or summary_previous != totals["previous"]
            or any(summary_change[event] != summary_current[event] - summary_previous[event]
                   for event in EVENTS)
            or type(summary.get("current_projects_with_events")) is not int
            or type(summary.get("previous_projects_with_events")) is not int
            or summary["current_projects_with_events"] != covered["current"]
            or summary["previous_projects_with_events"] != covered["previous"]):
        raise ValueError("Inconsistent V1 comparison summary")

    output = StringIO(newline="")
    writer = csv.writer(output, lineterminator="\r\n")
    writer.writerow(HEADER)
    bounds = (current_start.isoformat(), previous_start.isoformat(),
              boundary.isoformat(), as_of.isoformat(), SCOPE, "false", "false")
    for project, current_counts, previous_counts, differences, now_days, old_days in validated:
        for event in EVENTS:
            writer.writerow(("project", project, event, current_counts[event],
                             previous_counts[event], differences[event],
                             now_days, old_days, *bounds))
    for event in EVENTS:
        writer.writerow(("portfolio", "all_registered_projects", event,
                         summary_current[event], summary_previous[event],
                         summary_change[event], "", "", *bounds))
    return output.getvalue()
