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
