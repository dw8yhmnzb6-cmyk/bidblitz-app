"""Regression contract for the canonical Admin menu navigation."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def test_every_admin_menu_nav_destination_exists_in_app_router():
    sections = read("frontend/src/components/admin/sections.js")
    app = read("frontend/src/App.js")

    destinations = sorted(set(re.findall(r'nav:\s*"([^"]+)"', sections)))
    assert destinations, "Admin menu must expose real navigation destinations"

    missing = [route for route in destinations if f'case "{route}"' not in app]
    assert missing == [], f"Dead Admin navigation destinations: {missing}"


def test_coupon_manager_uses_live_canonical_route():
    sections = read("frontend/src/components/admin/sections.js")
    app = read("frontend/src/App.js")
    route_map = read("frontend/src/app/adminRouteMap.js")

    assert '{ key: "coupon-manager", icon: Gift, label: "Gutschein-Manager", nav: "/admin/coupons" }' in sections
    assert 'case "/admin/coupons":' in app
    assert 'coupons: "promos"' in route_map


def test_key_admin_sections_open_existing_manager_pages():
    sections = read("frontend/src/components/admin/sections.js")

    expected = {
        "staff": "/admin/employees",
        "enterprise": "/admin/enterprise",
        "influencer": "/admin/influencer",
        "admin-taxi": "/admin/taxi",
        "products": "/admin/products",
        "standard-auctions": "/admin/auctions",
        "winner-control": "/admin/winners",
        "system-health": "/admin/system-health",
        "database": "/admin/database",
    }
    for key, route in expected.items():
        assert re.search(rf'key:\s*"{re.escape(key)}"[^\n]*nav:\s*"{re.escape(route)}"', sections)


def test_admin_module_query_selection_tracks_route_changes():
    page = read("frontend/src/pages/AdminManagementPage.jsx")

    assert "const ModulesTab = ({ initialModule }) => {" in page
    assert "useEffect(() => {" in page
    assert "MODULE_DEFS.find((m) => m.key === initialModule) || null" in page
    assert "setSelectedMod(requested)" in page
    assert "}, [initialModule]);" in page


def test_live_ev_admin_uses_canonical_sources_and_stays_read_only():
    backend = read("backend/routes/admin_management.py")
    page = read("frontend/src/pages/AdminManagementPage.jsx")
    ladesaeulen = read("backend/routes/ladesaeulen.py")

    assert '"ladesaeulen": ("ev_stations", "name")' in backend
    assert 'if module_key == "ladesaeulen" and not TEST_MODE:' in backend
    assert '"collection": "ev_charge_points"' in backend
    assert '"read_only": True' in backend
    assert 'data-testid="module-read-only-note"' in page
    assert 'db.ev_stations.find' in ladesaeulen
    assert 'db.ev_charge_points.find' in ladesaeulen


def test_scooter_subscription_admin_and_customer_share_same_plan_source():
    backend = read("backend/routes/admin_management.py")
    scooter = read("backend/routes/scooter.py")
    page = read("frontend/src/pages/AdminManagementPage.jsx")

    assert "async def _get_scooter_plans()" in scooter
    assert "plans = await _get_scooter_plans()" in scooter
    assert 'await db.scooter_plans.find({}, {"_id": 0})' in scooter
    assert 'if row.get("enabled") is False:' in scooter
    assert 'if module_key == "scooter-abos":' in backend
    assert 'from routes.scooter import _get_scooter_plans' in backend
    assert '"enabled": False' in backend
    assert 'fields: ["plan_id", "name", "duration", "price", "duration_days", "unlock_fee", "free_minutes_per_day", "per_minute_rate"]' in page
