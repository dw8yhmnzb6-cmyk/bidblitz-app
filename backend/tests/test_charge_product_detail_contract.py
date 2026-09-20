"""Side-effect-free regression guards for BidBlitz Charge product details."""
from __future__ import annotations

import ast
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"

ROUTE = BACKEND / "routes" / "charge_app.py"
PAGE = FRONTEND / "src" / "pages" / "ChargeProductDetailPage.jsx"
CHARGE_PAGE = FRONTEND / "src" / "pages" / "ChargeAppPage.jsx"
APP = FRONTEND / "src" / "App.js"
API = FRONTEND / "src" / "services" / "api.js"


def _py(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    ast.parse(text)
    return text


def _text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_charge_product_detail_endpoint_exists_and_respects_visibility():
    src = _py(ROUTE)
    assert '@router.get("/catalog/{product_id}")' in src
    assert 'override.get("visible") is False' in src
    assert "Charge-Produkt nicht gefunden" in src


def test_charge_product_detail_never_exposes_purchase_price():
    src = _py(ROUTE)
    start = src.index('async def get_charge_catalog_product')
    end = src.index('@router.get("/dashboard")', start)
    block = src[start:end]
    assert '"purchase_price"' not in block


def test_charge_product_detail_returns_real_merchant_and_related_products():
    src = _py(ROUTE)
    start = src.index('async def get_charge_catalog_product')
    end = src.index('@router.get("/dashboard")', start)
    block = src[start:end]
    assert "db.pos_products.find_one" in block
    assert "db.merchants.find_one" in block
    assert "db.merchant_profiles.find_one" in block
    assert '"related_products"' in block


def test_charge_product_detail_frontend_and_route_are_registered():
    page = _text(PAGE)
    app = _text(APP)
    api = _text(API)
    assert "ChargeProductDetailPage" in app
    assert 'case "/charge-app/product":' in app
    assert "getChargeCatalogProduct" in api
    assert "Ähnliche Charge-Produkte" in page
    assert "Zum Händler" in page
    assert "Verfügbar" in page


def test_charge_catalog_cards_link_to_detail_page():
    page = _text(CHARGE_PAGE)
    assert "openProductDetail" in page
    assert "/charge-app/product?product_id=" in page
    assert "charge-app-catalog-product-detail-" in page
