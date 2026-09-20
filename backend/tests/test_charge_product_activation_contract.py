"""Static guards for BidBlitz Charge barcode/QR warranty activation."""
from __future__ import annotations

import ast
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ROUTE = ROOT / "backend" / "routes" / "charge_app.py"
PAGE = ROOT / "frontend" / "src" / "pages" / "ChargeAppPage.jsx"
API = ROOT / "frontend" / "src" / "services" / "api.js"


def _py(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    ast.parse(text)
    return text


def _text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_product_lookup_accepts_real_product_identifiers_only():
    src = _py(ROUTE)
    assert '@router.get("/product-lookup")' in src
    for key in ("barcode", "qr_code", "sku", "product_id"):
        assert f'{{"{key}": value}}' in src
    assert "db.pos_products.find_one" in src
    assert '"active": True' in src
    assert "_charge_catalog_categories(product)" in src


def test_warranty_persists_canonical_product_and_merchant_binding():
    src = _py(ROUTE)
    assert "async def _resolve_charge_product" in src
    assert '"product_id": (product or {}).get("product_id")' in src
    assert '"merchant_id": merchant_binding.get("merchant_id") or ""' in src
    assert '"merchant_user_id": merchant_binding.get("merchant_user_id") or ""' in src
    assert '"merchant_slug": merchant_binding.get("merchant_slug") or ""' in src


def test_lookup_does_not_return_hidden_catalog_products():
    src = _py(ROUTE)
    lookup_start = src.index("async def lookup_charge_product")
    lookup_end = src.index('@router.get("/catalog/{product_id}")', lookup_start)
    block = src[lookup_start:lookup_end]
    assert 'override.get("visible") is False' in block


def test_charge_app_has_mobile_product_code_activation_flow():
    page = _text(PAGE)
    api = _text(API)
    assert "lookupChargeProduct" in api
    assert "lookupActivationProduct" in page
    assert "charge-app-warranty-activation-code" in page
    assert "charge-app-warranty-activation-submit" in page
    assert "charge-app-warranty-activation-result" in page
    assert "product_id: prefill.product_id" in page
