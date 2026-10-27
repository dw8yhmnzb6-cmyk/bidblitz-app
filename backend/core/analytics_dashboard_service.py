"""Read-only dashboard composition over authorized first-party analytics data.

Does not connect to the database, create routes or enable collection.
"""
from datetime import datetime, timezone

from core.analytics_dashboard_metrics import dashboard_metrics
from core.analytics_revenue import revenue_by_project, period_bounds
from core.analytics_portfolio_summary import summarize_portfolio
from core.analytics_activity_feed import recent_business_activity

def build_project_dashboard(events, verified_ledger_rows, project, period, now=None, business_actions=()):
    # Use one clock reading for traffic, revenue and activity at period boundaries.
    current = datetime.now(timezone.utc) if now is None else now
    traffic = dashboard_metrics(events, project, period, current)
    revenue = [entry for entry in revenue_by_project(verified_ledger_rows, period, current)
               if entry["project"] == project]
    return {
        "project": project,
        "period": period,
        "traffic": traffic,
        "revenue": revenue,
        "revenue_source": "verified_server_ledger",
        "unique_visitors_available": False,
        "recent_business_actions": recent_business_activity(business_actions, {project}, current, period=period),
    }

def build_portfolio_dashboard(events, verified_ledger_rows, projects, period, now=None, business_actions=()):
    # Project list MUST be determined from server-side RBAC, not a browser filter.
    if (not isinstance(projects, (list, tuple)) or
            not all(isinstance(project, str) and project for project in projects) or
            len(projects) != len(set(projects))):
        raise ValueError("Expected unique authorized projects")
    current = datetime.now(timezone.utc) if now is None else now
    period_bounds(period, current)  # Validate period even when scope is empty.
    if not projects:
        return {"period": period, "projects": [], "summary": summarize_portfolio(())}
    # DB adapters can supply one-shot iterators. Snapshot once after scope
    # validation so later projects receive the same input as the first one.
    # Callers must supply bounded, authorized records for the requested period.
    event_rows = tuple(events)
    ledger_rows = tuple(verified_ledger_rows)
    action_rows = tuple(business_actions)
    reports = [
        build_project_dashboard(event_rows, ledger_rows, project, period, current, action_rows)
        for project in projects
    ]
    return {"period": period, "projects": reports, "summary": summarize_portfolio(reports)}

