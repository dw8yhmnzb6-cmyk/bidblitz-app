"""Static regression guards for BidBlitz Charge saved products."""
from __future__ import annotations

import ast
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ROUTE = ROOT / "backend" / "routes" / "charge_app.py"
PAGE = ROOT / "frontend" / "src" / "pages" / "ChargeAppPage.jsx"
DETAIL = ROOT / "frontend" / "src" / "pages" / "ChargeProductDetailPage.jsx"
API = ROOT / "frontend" / "src" / "services" / "api.js"


def test_saved_products_backend_is_user_scoped_and_visibility_safe():
    route = ROUTE.read_text(encoding="utf-8")
    ast.parse(route)

    assert '@router.get("/saved-products")' in route
    assert '@router.put("/saved-products/{product_id}")' in route
    assert '@router.delete("/saved-products/{product_id}")' in route
    assert '"user_id": user_id' in route
    assert 'override.get("visible") is False' in route
    assert "charge_saved_products" in route


def test_catalog_and_product_detail_include_saved_state():
    route = ROUTE.read_text(encoding="utf-8")
    assert 'card["saved"]' in route
    assert '"saved_products_total"' in route


def test_saved_products_frontend_is_wired():
    page = PAGE.read_text(encoding="utf-8")
    detail = DETAIL.read_text(encoding="utf-8")
    api = API.read_text(encoding="utf-8")

    for token in ("getSavedChargeProducts", "saveChargeProduct", "unsaveChargeProduct"):
        assert token in api
    assert "toggleSavedProduct" in page
    assert "charge-app-catalog-saved-filter" in page
    assert "charge-app-catalog-product-save-" in page
    assert "toggleSaved" in detail
    assert "charge-product-detail-save-button" in detail
