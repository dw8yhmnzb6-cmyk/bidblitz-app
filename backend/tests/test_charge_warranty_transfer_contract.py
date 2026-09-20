"""Static guards for secure BidBlitz Charge warranty ownership transfer."""
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


def test_transfer_endpoints_and_recipient_decline_exist():
    src = _py(ROUTE)
    for route in (
        '@router.post("/warranty/{registration_id}/transfer")',
        '@router.get("/warranty-transfers")',
        '@router.put("/warranty-transfers/{transfer_id}/accept")',
        '@router.put("/warranty-transfers/{transfer_id}/decline")',
        '@router.put("/warranty-transfers/{transfer_id}/cancel")',
    ):
        assert route in src


def test_transfer_is_bound_to_owner_and_recipient_email():
    src = _py(ROUTE)
    assert '"from_user_id": user_id' in src
    assert '"recipient_email": recipient_email' in src
    assert '_normalized_email(transfer.get("recipient_email")) != recipient_email' in src
    assert '"user_id": transfer.get("from_user_id")' in src


def test_transfer_expires_and_active_care_claim_blocks_creation():
    src = _py(ROUTE)
    assert "timedelta(hours=72)" in src
    assert '"status": {"$in": ["open", "in_review", "approved"]}' in src
    assert "Übertragung nicht möglich: Charge-Care-Fall" in src


def test_acceptance_moves_warranty_without_purchase_documents():
    src = _py(ROUTE)
    start = src.index("async def accept_charge_warranty_transfer")
    end = src.index('@router.put("/warranty-transfers/{transfer_id}/decline")', start)
    block = src[start:end]
    assert '"user_id": recipient_user_id' in block
    assert '"invoice_id": ""' in block
    assert '"invoice_number": ""' in block
    assert '"transfer_history": history_entry' in block


def test_pending_transfer_locks_warranty_update_and_delete():
    src = _py(ROUTE)
    assert "async def _active_warranty_transfer" in src
    assert "Garantie kann während der offenen Übertragung" in src


def test_transfer_customer_ui_is_wired():
    page = _text(PAGE)
    api = _text(API)
    for token in (
        "createChargeWarrantyTransfer",
        "getChargeWarrantyTransfers",
        "acceptChargeWarrantyTransfer",
        "declineChargeWarrantyTransfer",
        "cancelChargeWarrantyTransfer",
    ):
        assert token in api
    assert "Garantieübertragungen" in page
    assert "charge-app-warranty-transfer-modal" in page
    assert "charge-app-transfer-accept-" in page
    assert "charge-app-transfer-decline-" in page
    assert "Übertragung offen" in page
