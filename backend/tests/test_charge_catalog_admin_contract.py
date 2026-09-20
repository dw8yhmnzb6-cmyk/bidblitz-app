"""Side-effect-free regression guards for BidBlitz Charge catalog admin."""
from __future__ import annotations

import ast
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
ROUTE = BACKEND / "routes" / "charge_app.py"
PAGE = FRONTEND / "src" / "pages" / "AdminChargeCatalogPage.jsx"
APP = FRONTEND / "src" / "App.js"
API = FRONTEND / "src" / "services" / "api.js"
OFFER_PAGE = FRONTEND / "src" / "pages" / "AdminChargeOfferRulesPage.jsx"


def _py(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    ast.parse(text)
    return text


def _text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_charge_catalog_admin_routes_are_admin_protected():
    src = _py(ROUTE)
    assert '@router.get("/admin/catalog")' in src
    assert '@router.put("/admin/catalog/{product_id}")' in src
    assert '@router.delete("/admin/catalog/{product_id}")' in src
    assert "await _require_admin(request)" in src


def test_charge_catalog_admin_does_not_modify_pos_product_data():
    src = _py(ROUTE)
    start = src.index('async def admin_charge_catalog')
    end = src.index('@router.get("/admin/offer-rules")', start)
    block = src[start:end]
    assert "charge_catalog_overrides" in block
    assert "db.pos_products.update_one" not in block
    assert "db.pos_products.delete_one" not in block


def test_customer_catalog_applies_visibility_feature_and_sort_overrides():
    src = _py(ROUTE)
    assert 'override.get("visible") is False' in src
    assert '"featured": bool(override.get("featured", False))' in src
    assert '"sort_order": int(override.get("sort_order") or 100)' in src


def test_charge_catalog_admin_ui_and_route_are_registered():
    page = _text(PAGE)
    app = _text(APP)
    api = _text(API)
    offers = _text(OFFER_PAGE)
    assert "AdminChargeCatalogPage" in app
    assert 'case "/admin/charge-catalog":' in app
    assert "getChargeCatalogAdmin" in api
    assert "updateChargeCatalogProductAdmin" in api
    assert "resetChargeCatalogProductAdmin" in api
    assert "Produktkatalog steuern" in page
    assert "admin-charge-catalog-save" in page
    assert "admin-charge-offer-rules-catalog-link" in offers


def test_catalog_admin_cannot_expose_internal_purchase_price():
    src = _py(ROUTE)
    start = src.index('async def admin_charge_catalog')
    end = src.index('@router.get("/admin/offer-rules")', start)
    block = src[start:end]
    assert '"purchase_price"' not in block
