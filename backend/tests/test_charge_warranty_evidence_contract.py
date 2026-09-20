"""Static guards for transparent Charge warranty evidence levels."""
from __future__ import annotations

import ast
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ROUTE = ROOT / "backend" / "routes" / "charge_app.py"
APP_PAGE = ROOT / "frontend" / "src" / "pages" / "ChargeAppPage.jsx"
VERIFY_PAGE = ROOT / "frontend" / "src" / "pages" / "ChargeWarrantyVerifyPage.jsx"


def _py(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    ast.parse(text)
    return text


def _text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_warranty_evidence_levels_distinguish_linked_records():
    src = _py(ROUTE)
    assert "def _warranty_evidence" in src
    for level in ("manual", "catalog_linked", "invoice_linked", "catalog_and_invoice"):
        assert f'"level": "{level}"' in src


def test_warranty_card_and_pass_expose_evidence_label():
    src = _py(ROUTE)
    assert '"evidence_level": evidence["level"]' in src
    assert '"evidence_label": evidence["label"]' in src
    assert '"evidence_label": card.get("evidence_label")' in src


def test_public_verification_does_not_claim_physical_product_authenticity():
    page = _text(VERIFY_PAGE)
    assert "keine unabhängige Echtheitsprüfung des physischen Produkts" in page
    assert "pass.evidence_label" in page


def test_customer_app_and_downloadable_pass_show_evidence():
    page = _text(APP_PAGE)
    src = _py(ROUTE)
    assert "charge-app-pass-evidence" in page
    assert "item.evidence_label" in page
    assert "<strong>Nachweis:</strong>" in src
    assert "keine unabhängige Echtheitsprüfung des physischen Produkts" in src
