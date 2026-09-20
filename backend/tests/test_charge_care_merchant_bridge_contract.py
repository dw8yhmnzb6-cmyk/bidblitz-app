"""Static regression guards for the Charge Care merchant/customer bridge."""
from __future__ import annotations

import ast
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CHARGE = ROOT / "backend" / "routes" / "charge_app.py"
MERCHANT = ROOT / "backend" / "routes" / "merchant_portal.py"
PORTAL = ROOT / "frontend" / "src" / "pages" / "MerchantPortalPage.jsx"


def _py(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    ast.parse(text)
    return text


def _text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_charge_warranty_persists_stable_merchant_identity():
    src = _py(CHARGE)
    for field in ("merchant_id", "merchant_user_id", "merchant_slug"):
        assert f'"{field}"' in src
    assert 'warranty.get("merchant_user_id")' in src
    assert 'warranty.get("merchant_id")' in src
    assert 'warranty.get("merchant_slug")' in src


def test_customer_claims_share_existing_merchant_warranty_collection():
    src = _py(CHARGE)
    assert "merchant_warranty_claims" in src
    assert "charge_warranty_claims" not in src
    assert '"customer_user_id": user_id' in src
    assert '"user_id": merchant_binding.get("merchant_user_id") or ""' in src


def test_merchant_portal_maps_dealer_status_to_customer_status():
    src = _py(MERCHANT)
    for dealer, customer in (
        ("submitted", "open"),
        ("under_review", "in_review"),
        ("replacement_sent", "approved"),
        ("resolved", "resolved"),
        ("rejected", "rejected"),
    ):
        assert f'"{dealer}": "{customer}"' in src
    assert '"author_role": "merchant"' in src
    assert '"messages"' in src


def test_claim_evidence_allows_only_customer_admin_or_assigned_merchant():
    src = _py(CHARGE)
    assert "is_admin" in src
    assert "is_customer" in src
    assert "is_merchant" in src
    assert 'str(claim.get("user_id") or "") == user_id' in src


def test_merchant_portal_has_real_customer_reply_ui():
    src = _text(PORTAL)
    assert "dealerWarrantyNotes" in src
    assert "sendWarrantyResponse" in src
    assert "Antwort an Kunden" in src
    assert "merchant-dealer-warranty-response-input-" in src
    assert "merchant-dealer-warranty-response-send-" in src
    assert "Letzte Kundenkommunikation" in src
