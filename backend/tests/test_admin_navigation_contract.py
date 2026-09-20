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


def test_legacy_dead_coupon_route_is_not_reintroduced():
    sections = read("frontend/src/components/admin/sections.js")

    assert 'nav: "/admin/coupons"' not in sections
    assert '{ key: "coupon-manager", icon: Gift, label: "Gutschein-Manager", nav: "/admin/discounts" }' in sections


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
