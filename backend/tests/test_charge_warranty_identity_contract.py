"""Static guards for Charge warranty product/serial identity rules."""
from __future__ import annotations

import ast
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ROUTE = ROOT / "backend" / "routes" / "charge_app.py"


def test_charge_warranty_duplicate_detection_is_product_aware():
    src = ROUTE.read_text(encoding="utf-8")
    ast.parse(src)
    assert "async def _find_conflicting_active_warranty" in src
    assert '"product_id": product_id' in src
    assert '"product_name": {"$regex":' in src
    assert '"serial_key": key' in src
    assert "_warranty_card(candidate).get("status") == "active"" in src


def test_same_active_product_serial_cannot_be_claimed_by_another_account():
    src = ROUTE.read_text(encoding="utf-8")
    register_start = src.index("async def register_charge_warranty")
    register_end = src.index('@router.post("/invoices/save")', register_start)
    block = src[register_start:register_end]
    assert "_find_conflicting_active_warranty(" in block
    assert "bereits auf einem anderen Konto aktiv registriert" in block
    assert '"duplicate": True' in block


def test_old_user_only_serial_duplicate_check_is_removed():
    src = ROUTE.read_text(encoding="utf-8")
    register_start = src.index("async def register_charge_warranty")
    register_end = src.index('@router.post("/invoices/save")', register_start)
    block = src[register_start:register_end]
    assert '{"user_id": user_id, "serial_number": serial}' not in block


def test_warranty_update_revalidates_product_serial_identity():
    src = ROUTE.read_text(encoding="utf-8")
    update_start = src.index("async def update_charge_warranty")
    update_end = src.index('@router.delete("/warranty/{registration_id}")', update_start)
    block = src[update_start:update_end]
    assert "_find_conflicting_active_warranty(" in block
    assert 'updates["serial_key"] = _serial_key(serial_number)' in block
