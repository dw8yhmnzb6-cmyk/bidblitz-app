"""Static regression guards for Charge offer-rule deletion."""
from __future__ import annotations

import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ROUTE = ROOT / "backend" / "routes" / "charge_app.py"
PAGE = ROOT / "frontend" / "src" / "pages" / "AdminChargeOfferRulesPage.jsx"
API = ROOT / "frontend" / "src" / "services" / "api.js"


def test_offer_rule_delete_is_admin_protected_and_wired():
    route = ROUTE.read_text(encoding="utf-8")
    ast.parse(route)
    page = PAGE.read_text(encoding="utf-8")
    api = API.read_text(encoding="utf-8")

    assert '@router.delete("/admin/offer-rules/{rule_id}")' in route
    assert "await _require_admin(request)" in route
    assert "deleteChargeOfferRuleAdmin" in api
    assert "deleteRule" in page
    assert "admin-charge-offer-rule-delete-" in page
