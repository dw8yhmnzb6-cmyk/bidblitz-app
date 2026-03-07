"""
BidBlitz Dashboard - Main Navigation
All app sections with icons and routes
Static configuration - no persistence needed
"""
from fastapi import APIRouter

router = APIRouter(tags=["Dashboard"])

# Dashboard configuration - static data, no DB needed
DASHBOARD_ITEMS = [
    {"id": 1, "name": "Wallet", "icon": "💳", "route": "/wallet"},
    {"id": 2, "name": "Games", "icon": "🎮", "route": "/games"},
    {"id": 3, "name": "Mining", "icon": "⛏", "route": "/miners"},
    {"id": 4, "name": "Marketplace", "icon": "🛒", "route": "/marketplace"},
    {"id": 5, "name": "Taxi", "icon": "🚕", "route": "/taxi"},
    {"id": 6, "name": "Food", "icon": "🍔", "route": "/food"},
    {"id": 7, "name": "Hotels", "icon": "🏨", "route": "/hotels"},
    {"id": 8, "name": "Auctions", "icon": "🔨", "route": "/auctions"},
    {"id": 9, "name": "Referral", "icon": "👥", "route": "/referral"},
    {"id": 10, "name": "Leaderboard", "icon": "🏆", "route": "/games/leaderboard"}
]

DASHBOARD_CATEGORIES = {
    "finance": [
        {"name": "Wallet", "icon": "💳", "route": "/wallet"},
        {"name": "Auctions", "icon": "🔨", "route": "/auctions"}
    ],
    "entertainment": [
        {"name": "Games", "icon": "🎮", "route": "/games"},
        {"name": "Mining", "icon": "⛏", "route": "/miners"}
    ],
    "services": [
        {"name": "Taxi", "icon": "🚕", "route": "/taxi"},
        {"name": "Food", "icon": "🍔", "route": "/food"},
        {"name": "Hotels", "icon": "🏨", "route": "/hotels"},
        {"name": "Marketplace", "icon": "🛒", "route": "/marketplace"}
    ],
    "social": [
        {"name": "Referral", "icon": "👥", "route": "/referral"},
        {"name": "Leaderboard", "icon": "🏆", "route": "/games/leaderboard"}
    ]
}


@router.get("/dashboard")
def get_dashboard():
    """Get all dashboard items"""
    return DASHBOARD_ITEMS


@router.get("/dashboard/categories")
def get_categories():
    """Get dashboard by category"""
    return DASHBOARD_CATEGORIES
