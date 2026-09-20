"""Side-effect-free regression guards for the BidBlitz Charge catalog."""
from __future__ import annotations

import ast
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
ROUTE = BACKEND / "routes" / "charge_app.py"
PAGE = FRONTEND / "src" / "pages" / "ChargeAppPage.jsx"
API = FRONTEND / "src" / "services" / "api.js"


def _py(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    ast.parse(text)
    return text


def _text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_charge_catalog_uses_live_pos_products():
    src = _py(ROUTE)
    assert '@router.get("/catalog")' in src
    assert "db.pos_products.find(" in src
    assert '"active": True' in src
    assert "_charge_product_card" in src
    assert "_charge_catalog_categories" in src


def test_charge_catalog_has_expected_accessory_categories():
    src = _py(ROUTE)
    for category in ("charger", "cable", "powerbank", "wireless", "dock", "car", "audio"):
        assert f'"{category}"' in src


def test_catalog_never_exposes_purchase_price():
    src = _py(ROUTE)
    card_start = src.index("def _charge_product_card")
    card_end = src.index("async def _get_charge_merchants", card_start)
    card = src[card_start:card_end]
    assert '"purchase_price"' not in card


def test_charge_catalog_api_client_exists():
    src = _text(API)
    assert "getChargeCatalog" in src
    assert "/api/charge-app/catalog" in src


def test_charge_catalog_customer_ui_has_search_categories_and_stock():
    src = _text(PAGE)
    for token in (
        "Charge Produkte entdecken",
        "catalogQuery",
        "catalogCategory",
        "charge-app-catalog-search",
        "charge-app-catalog-categories",
        "item.in_stock",
        "Zum Händler",
    ):
        assert token in src


def test_charge_catalog_search_is_regex_safe():
    src = _py(ROUTE)
    assert "import re" in src
    assert "re.escape(needle)" in src
    assert "q.strip()[:100]" in src
