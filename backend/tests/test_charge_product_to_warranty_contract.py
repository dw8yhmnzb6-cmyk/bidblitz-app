"""Static guards for Charge product-detail to warranty activation flow."""
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "frontend" / "src" / "App.js"
DETAIL = ROOT / "frontend" / "src" / "pages" / "ChargeProductDetailPage.jsx"
CHARGE = ROOT / "frontend" / "src" / "pages" / "ChargeAppPage.jsx"


def _text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_product_detail_has_direct_warranty_activation_cta():
    detail = _text(DETAIL)
    assert "charge-product-detail-activate-warranty" in detail
    assert "/charge-app?activate_product_id=" in detail
    assert "Garantie aktivieren" in detail


def test_charge_route_passes_query_params_to_charge_app():
    app = _text(APP)
    assert "<ChargeAppPage" in app
    assert "routeParams={routeParams}" in app


def test_charge_app_prefills_exact_product_and_merchant():
    page = _text(CHARGE)
    assert "activationPrefillRef" in page
    assert "routeParams?.activate_product_id" in page
    assert "api.getChargeCatalogProduct(productId)" in page
    assert "product_id: product.product_id || productId" in page
    assert "merchant.business_name || product.merchant_name" in page
    assert 'charge-app-warranty-card' in page
