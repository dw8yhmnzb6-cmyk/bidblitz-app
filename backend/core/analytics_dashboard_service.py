"""Read-only dashboard composition over authorized first-party analytics data.

Does not connect to the database, create routes or enable collection.
"""
from core.analytics_dashboard_metrics import dashboard_metrics
from core.analytics_revenue import revenue_by_project

def build_project_dashboard(events, verified_ledger_rows, project, period, now=None):
    traffic = dashboard_metrics(events, project, period, now)
    revenue = [entry for entry in revenue_by_project(verified_ledger_rows, period, now)
               if entry["project"] == project]
    return {
        "project": project,
        "period": period,
        "traffic": traffic,
        "revenue": revenue,
        "revenue_source": "verified_server_ledger",
        "unique_visitors_available": False,
    }

def build_portfolio_dashboard(events, verified_ledger_rows, projects, period, now=None):
    # Project list MUST be determined from server-side RBAC, not a browser filter.
    if not isinstance(projects, (list, tuple)) or len(projects) != len(set(projects)):
        raise ValueError("Expected unique authorized projects")
    return {
        "period": period,
        "projects": [
            build_project_dashboard(events, verified_ledger_rows, project, period, now)
            for project in projects
        ],
    }
