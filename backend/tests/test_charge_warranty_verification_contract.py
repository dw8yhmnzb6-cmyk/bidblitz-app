"""Static guards for signed BidBlitz Charge warranty verification."""
from __future__ import annotations

import ast
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ROUTE = ROOT / "backend" / "routes" / "charge_app.py"
PAGE = ROOT / "frontend" / "src" / "pages" / "ChargeWarrantyVerifyPage.jsx"
APP = ROOT / "frontend" / "src" / "App.js"
API = ROOT / "frontend" / "src" / "services" / "api.js"


def _py(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    ast.parse(text)
    return text


def _text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_warranty_pass_uses_hmac_signature_and_constant_time_compare():
    src = _py(ROUTE)
    assert "def _warranty_signature" in src
    assert "JWT_SECRET" in src
    assert "hmac.new" in src
    assert "hashlib.sha256" in src
    assert "hmac.compare_digest" in src


def test_public_verification_exposes_only_minimal_pass_data():
    src = _py(ROUTE)
    start = src.index("async def verify_charge_warranty_pass")
    end = src.index('@router.get("/warranty/{registration_id}/pass")', start)
    block = src[start:end]
    assert "serial_number_masked" in block
    assert '"verified": True' in block
    assert '"customer_email"' not in block
    assert '"user_email"' not in block
    assert '"invoice_number"' not in block
    assert '"messages"' not in block
    assert '"attachments"' not in block


def test_qr_points_to_frontend_verification_route():
    src = _py(ROUTE)
    assert "FRONTEND_URL" in src
    assert "/charge-app/warranty-verify?registration_id=" in src


def test_public_verification_page_is_not_guest_blocked():
    app = _text(APP)
    page = _text(PAGE)
    api = _text(API)
    assert 'case "/charge-app/warranty-verify":' in app
    route_start = app.index('case "/charge-app/warranty-verify":')
    route_block = app[route_start:route_start + 420]
    assert "isGuest" not in route_block
    assert "verifyChargeWarrantyPass" in api
    assert "Garantiepass verifiziert" in page
    assert "Kundennamen, E-Mail-Adressen, Rechnungen und Reklamationsverläufe werden nicht angezeigt" in page
