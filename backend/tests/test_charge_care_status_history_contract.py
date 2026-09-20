"""Static guards for Charge Care status history across customer/admin/merchant."""
from __future__ import annotations

import ast
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CHARGE = ROOT / "backend" / "routes" / "charge_app.py"
MERCHANT = ROOT / "backend" / "routes" / "merchant_portal.py"
PAGE = ROOT / "frontend" / "src" / "pages" / "ChargeCareClaimsPage.jsx"


def _py(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    ast.parse(text)
    return text


def _text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_claim_creation_and_customer_cancel_write_status_history():
    src = _py(CHARGE)
    assert '"status_history": [{' in src
    assert '"actor_role": "customer"' in src
    assert '"note": "Garantiefall eröffnet"' in src
    assert '"note": "Garantiefall vom Kunden storniert"' in src


def test_admin_status_change_writes_history_only_when_status_changes():
    src = _py(CHARGE)
    assert 'if status != str(claim.get("status") or ""):' in src
    assert 'push_ops["status_history"]' in src
    assert '"actor_role": "admin"' in src


def test_merchant_status_change_writes_customer_visible_history():
    src = _py(MERCHANT)
    assert 'if customer_status != str(claim.get("status") or ""):' in src
    assert 'push_ops["status_history"]' in src
    assert '"actor_role": "merchant"' in src


def test_customer_claim_card_exposes_status_history():
    src = _py(CHARGE)
    card_start = src.index("def _claim_card")
    card_end = src.index("def _validate_claim_status", card_start)
    block = src[card_start:card_end]
    assert '"status_history"' in block


def test_customer_ui_renders_status_timeline():
    page = _text(PAGE)
    assert "Statusverlauf" in page
    assert "charge-care-status-history" in page
    assert "charge-care-status-history-item-" in page
    assert "actorLabel" in page
    assert "formatClaimDate" in page
